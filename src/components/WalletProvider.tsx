"use client";

import { BrowserProvider, Signer } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CHAIN_ID, NETWORK_NAME, RPC_URL } from "@/lib/config";
import { friendlyError } from "@/lib/format";

type WalletState = {
  address: string | null;
  chainId: number | null;
  signer: Signer | null;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  /** True when connected to a different chain than configured. Drives the Switch banner. */
  isWrongNetwork: boolean;
  /** Explicit user action only — the SOLE caller of eth_requestAccounts. */
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Explicit user action only — the SOLE caller of wallet_switchEthereumChain. */
  switchNetwork: () => Promise<void>;
};

const WalletCtx = createContext<WalletState | null>(null);

const SESSION_KEY = "trustledger.wallet.v1";

type InjectedEth = {
  request: (a: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (ev: string, fn: (...a: never[]) => void) => void;
  removeListener?: (ev: string, fn: (...a: never[]) => void) => void;
};

function injectedEthereum(): InjectedEth | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: InjectedEth }).ethereum;
  if (!eth || typeof eth.request !== "function") return null;
  return eth;
}

function toHex(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  const isWrongNetwork = address !== null && chainId !== null && chainId !== CHAIN_ID;

  /**
   * Silent state sync. Uses eth_accounts ONLY — never eth_requestAccounts,
   * so this can run on page load, route changes, and chain/account events
   * without ever opening a wallet popup.
   */
  const silentRefresh = useCallback(async () => {
    const eth = injectedEthereum();
    if (!eth) {
      setHasProvider(false);
      return;
    }
    setHasProvider(true);
    try {
      const provider = new BrowserProvider(eth as unknown as import("ethers").Eip1193Provider);
      const [accounts, net] = await Promise.all([
        provider.send("eth_accounts", []) as Promise<string[]>,
        provider.getNetwork()
      ]);
      setChainId(Number(net.chainId));
      if (accounts.length === 0) {
        setAddress(null);
        setSigner(null);
        return;
      }
      // An account exists WITHOUT asking — only then is getSigner safe & silent.
      const s = await provider.getSigner(accounts[0]);
      setAddress(accounts[0]);
      setSigner(s);
    } catch {
      // Silent path must never surface popups or break the page.
    }
  }, []);

  // Mount once: restore session silently. No popups possible here.
  useEffect(() => {
    silentRefresh();
  }, [silentRefresh]);

  // Wallet-initiated events only update state — never request anything.
  useEffect(() => {
    const eth = injectedEthereum();
    if (!eth || !eth.on) return;
    const onAccounts = (accs: unknown) => {
      const list = Array.isArray(accs) ? (accs as string[]) : [];
      if (list.length === 0) {
        // User disconnected in the wallet UI.
        setAddress(null);
        setSigner(null);
        try {
          sessionStorage.removeItem(SESSION_KEY);
        } catch {
          /* ignore */
        }
        return;
      }
      silentRefresh();
    };
    const onChain = () => {
      // Chain switch may drop the signer — re-sync silently.
      silentRefresh();
    };
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [silentRefresh]);

  /** THE only eth_requestAccounts call site. Invoked from Connect buttons only. */
  const connect = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const eth = injectedEthereum();
      if (!eth) {
        throw new Error(`No injected wallet found. Install MetaMask and use ${NETWORK_NAME} (chain ${CHAIN_ID}).`);
      }
      const provider = new BrowserProvider(eth as unknown as import("ethers").Eip1193Provider);
      const accounts = (await provider.send("eth_requestAccounts", [])) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error("Connection failed: the wallet returned no accounts.");
      }
      const s = await provider.getSigner();
      const addr = await s.getAddress();
      const net = await provider.getNetwork();
      setAddress(addr);
      setSigner(s);
      setChainId(Number(net.chainId));
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ address: addr }));
      } catch {
        /* ignore */
      }
      // Wrong network is NOT an error here — the header banner handles it.
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (/user rejected|user denied|rejected the request|user closed/i.test(msg)) {
        setError("Connection cancelled in the wallet — still not connected.");
      } else if (/no injected wallet/i.test(msg)) {
        setError(friendlyError(e));
      } else {
        setError(`Connection failed: ${friendlyError(e)}`);
      }
    } finally {
      // Every attempt resolves — "Connecting…" can never stick.
      setConnecting(false);
    }
  }, [connecting]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setError(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * THE only wallet_switchEthereumChain call site. Invoked from the Switch button only.
   * Flow: switch -> (4902 ? add -> switch again) -> explicit eth_chainId refresh.
   * Never calls eth_requestAccounts.
   */
  const switchNetwork = useCallback(async () => {
    setError(null);
    const eth = injectedEthereum();
    if (!eth) {
      setError("No injected wallet found. Install MetaMask first.");
      return;
    }
    const target = toHex(CHAIN_ID);

    const doSwitch = () =>
      eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: target }] });

    const readChainId = async (): Promise<number | null> => {
      try {
        const hex = (await eth.request({ method: "eth_chainId", params: [] })) as string;
        return parseInt(hex, 16);
      } catch {
        return null;
      }
    };

    try {
      await doSwitch();
    } catch (e) {
      const code = (e as { code?: number })?.code;
      if (code === 4001) {
        setError("Network switch cancelled in the wallet.");
        return;
      }
      if (code !== 4902) {
        setError(`Network switch failed: ${friendlyError(e)}`);
        return;
      }
      // 4902: configured chain is unknown to the wallet — add it (user approves in MetaMask).
      try {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: target,
              chainName: NETWORK_NAME,
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: [RPC_URL]
            }
          ]
        });
      } catch (addErr) {
        const addCode = (addErr as { code?: number })?.code;
        const addMsg = addErr instanceof Error ? addErr.message : "";
        if (addCode === 4001 || /user rejected|user denied|rejected the request/i.test(addMsg)) {
          setError("Network switch cancelled in the wallet.");
          return;
        }
        // Chain may already exist (manual entry / race) — fall through and try the switch anyway.
        if (!/already exists|duplicate|already added/i.test(addMsg)) {
          setError(`Could not add ${NETWORK_NAME} to the wallet: ${friendlyError(addErr)}`);
          return;
        }
      }
      // MetaMask does not always land on a newly added chain — switch explicitly.
      try {
        await doSwitch();
      } catch (reErr) {
        const reCode = (reErr as { code?: number })?.code;
        if (reCode === 4001) {
          setError("Network switch cancelled in the wallet.");
        } else {
          setError(`Network was added but switching failed: ${friendlyError(reErr)}`);
        }
        return;
      }
    }

    // Read the chain back explicitly so the banner updates immediately,
    // even if the chainChanged event is delayed. Silent — no popups.
    const fresh = await readChainId();
    if (fresh === null) {
      setError("Switched, but the network could not be read. Unlock MetaMask and check the current network.");
      await silentRefresh();
      return;
    }
    setChainId(fresh);
    await silentRefresh();
  }, [silentRefresh]);

  const value = useMemo<WalletState>(
    () => ({ address, chainId, signer, connecting, error, hasProvider, isWrongNetwork, connect, disconnect, switchNetwork }),
    [address, chainId, signer, connecting, error, hasProvider, isWrongNetwork, connect, disconnect, switchNetwork]
  );

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
