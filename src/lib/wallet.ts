"use client";

import { BrowserProvider, JsonRpcProvider, Signer } from "ethers";

// Browser-safe config only. Never read DEPLOYER_PRIVATE_KEY here.
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && typeof (window as any).ethereum !== "undefined";
}

export async function connectWallet(): Promise<{ address: string; signer: Signer }> {
  if (!hasInjectedWallet()) {
    throw new Error("No injected wallet found. Install MetaMask (test network only).");
  }
  const provider = new BrowserProvider((window as any).ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { address, signer };
}

export function getReadProvider() {
  return new JsonRpcProvider(RPC_URL);
}

export async function getChainId(provider?: BrowserProvider): Promise<bigint> {
  const p = provider ?? (hasInjectedWallet() ? new BrowserProvider((window as any).ethereum) : getReadProvider());
  const net = await (p as BrowserProvider).getNetwork?.() ?? await (p as JsonRpcProvider).getNetwork();
  return net.chainId;
}
