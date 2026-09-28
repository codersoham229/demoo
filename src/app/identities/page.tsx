"use client";

import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { Search, Wallet } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import {
  Badge,
  Card,
  ConfigNotice,
  Field,
  PageHeader,
  ReadTag,
  Spinner,
  TxStatus,
  WriteTag,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputCls
} from "@/components/ui";
import { contractsConfigured } from "@/lib/config";
import { type TxStage, friendlyError, shortAddress } from "@/lib/format";
import { getIdentityWrite, readIdentity, type IdentityRecord } from "@/lib/contracts";
import { pushRecentTx } from "@/lib/txhistory";

export default function IdentitiesPage() {
  const { address, signer, connect, connecting } = useWallet();
  // Section A — create / update fields
  const [did, setDid] = useState("");
  const [credInput, setCredInput] = useState("");
  // Section B — loaded identity
  const [lookup, setLookup] = useState("");
  const [loadedAddr, setLoadedAddr] = useState<string | null>(null);
  const [record, setRecord] = useState<IdentityRecord | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [stage, setStage] = useState<TxStage>("ready");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState<"anchor" | "update" | "revoke" | null>(null);
  // The contract anchors msg.sender only — track whether the CONNECTED wallet
  // already has one so Anchor can't be fired into a guaranteed revert.
  const [ownState, setOwnState] = useState<"unknown" | "none" | "active" | "revoked">("unknown");
  const configured = contractsConfigured();
  const managesLoaded = !!signer && !!loadedAddr && !!address && loadedAddr.toLowerCase() === address.toLowerCase();

  useEffect(() => {
    if (address && !did) setDid(`did:demo:${address.toLowerCase()}`);
    if (address && !lookup) {
      setLookup(address);
      loadIdentity(address);
    }
    loadOwn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  async function loadOwn() {
    if (!address || !configured) {
      setOwnState("unknown");
      return;
    }
    try {
      const r = await readIdentity(address);
      if (!r.record.did) setOwnState("none");
      else if (r.record.revoked || !r.valid) setOwnState("revoked");
      else setOwnState("active");
    } catch {
      setOwnState("unknown");
    }
  }

  async function loadIdentity(wallet: string) {
    setError(null);
    setRecord(null);
    setValid(null);
    setLoadedAddr(null);
    if (!ethers.isAddress(wallet)) {
      setError("Enter a valid 0x wallet address.");
      return;
    }
    if (!configured) {
      setError("Contracts are not configured yet.");
      return;
    }
    setReading(true);
    try {
      const r = await readIdentity(wallet);
      setRecord(r.record.did ? r.record : null);
      setValid(r.valid);
      setLoadedAddr(wallet);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setReading(false);
    }
  }

  function credentialHash(): string {
    // Prototype: hash any reference string (doc number, certificate id) — never raw personal data.
    return ethers.keccak256(ethers.toUtf8Bytes(credInput || did || "demo"));
  }

  async function submit(kind: "anchor" | "update" | "revoke") {
    if (!signer || !address) {
      setError("Connect your wallet first.");
      return;
    }
    setStage("confirm");
    setBusy(kind);
    setError(null);
    setHash(null);
    try {
      const c = getIdentityWrite(signer);
      let tx;
      if (kind === "anchor") {
        if (!did.trim()) throw new Error("Enter a DID identifier first.");
        tx = await c.anchorIdentity(did.trim(), credentialHash());
      } else if (kind === "update") {
        if (!did.trim()) throw new Error("Enter a DID identifier first.");
        tx = await c.updateIdentity(did.trim(), credentialHash());
      } else {
        tx = await c.revokeIdentity();
      }
      setHash(tx.hash as string);
      setStage("pending");
      await tx.wait();
      setStage("confirmed");
      pushRecentTx({ hash: tx.hash as string, label: `Identity ${kind}`, at: new Date().toISOString() });
      await loadIdentity(address);
      await loadOwn();
    } catch (e) {
      setStage("failed");
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="space-y-6">
      <PageHeader
        kicker="Identity"
        title="Manage verifiable identities anchored on the blockchain"
        desc="Start by creating an identity for your wallet. To inspect or change an existing one, load it below."
      />
      <ConfigNotice />

      {/* A — Create */}
      <Card title="A · Create Identity" sub="Anchor a new identity for your connected wallet" action={<WriteTag />}>
        {!address ? (
          <button onClick={connect} disabled={connecting} className={btnPrimary}>
            {connecting ? <Spinner className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        ) : (
          <div className="grid gap-3.5 md:grid-cols-3">
            <Field label="Connected Wallet / Identity Wallet" hint="The identity is always anchored FOR this connected wallet (the transaction sender).">
              <input className={inputCls} value={address} readOnly />
            </Field>
            <Field label="DID / Identity Reference" hint="Suggested: did:demo:<address>">
              <input className={inputCls} value={did} onChange={(e) => setDid(e.target.value)} placeholder="did:demo:0x…" />
            </Field>
            <Field label="Credential Reference" hint="Hashed before sending — raw text never goes on-chain.">
              <input className={inputCls} value={credInput} onChange={(e) => setCredInput(e.target.value)} placeholder="e.g. CERT-2026-0042" />
            </Field>
          </div>
        )}
        {address ? (
          <div className="mt-3.5">
            <p className="break-all rounded-xl border border-white/[0.07] bg-abyss/70 px-3 py-2 font-mono text-[11px] text-slate-500">
              Credential hash: <span className="text-accent/80">{credentialHash()}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => submit("anchor")}
                disabled={!signer || !configured || busy !== null || ownState === "active" || ownState === "revoked"}
                className={btnPrimary}
                title={ownState === "active" || ownState === "revoked" ? "This wallet already has an on-chain identity" : "Anchor Identity"}
              >
                {busy === "anchor" ? <Spinner className="h-4 w-4" /> : null}
                {busy === "anchor" ? "Anchoring…" : "Anchor Identity"}
              </button>
              <button
                onClick={() => {
                  setDid("did:trustledger:demo-user-001");
                  setCredInput("CRED-001");
                }}
                className={btnSecondary}
              >
                Fill demo values
              </button>
            </div>
            {ownState === "active" || ownState === "revoked" ? (
              <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5 text-[13px] leading-relaxed text-amber-200/90">
                Connected wallet {shortAddress(address)} already has an on-chain identity (
                {ownState === "active" ? "active" : "revoked"}), so anchoring again would revert.
                The contract anchors one identity per wallet for the sender itself — it cannot anchor for a
                different address. To register the demo wallet, switch MetaMask to that wallet and anchor here.
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      {/* B — Existing */}
      <Card title="B · Existing Identity" sub="Load any wallet to see its identity, then update or revoke it" action={<ReadTag />}>
        <div className="flex gap-2">
          <input className={inputCls} value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="0x…" />
          <button onClick={() => loadIdentity(lookup)} disabled={reading || !configured} className={btnSecondary}>
            {reading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            {reading ? "…" : "Load Identity"}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.07] bg-abyss/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs text-slate-400" title={loadedAddr ?? ""}>
              {loadedAddr ? shortAddress(loadedAddr) : "No identity loaded yet"}
            </p>
            {valid === null ? <Badge tone="slate">Unknown</Badge> : valid ? <Badge tone="green">✓ Verified</Badge> : <Badge tone="red">✕ Not verified</Badge>}
          </div>

          {!loadedAddr ? (
            <p className="mt-2 text-sm text-slate-500">Enter a wallet address and press “Load Identity”.</p>
          ) : !record ? (
            <p className="mt-2 text-sm text-slate-500">This wallet has no anchored identity. Create one in section A.</p>
          ) : (
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Identity Status</dt><dd className="mt-0.5 text-slate-200">{record.revoked ? "Revoked" : "Active"}</dd></div>
              <div><dt className="text-xs text-slate-500">Revoked</dt><dd className="mt-0.5 text-slate-200">{record.revoked ? "Yes" : "No"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">DID</dt><dd className="mt-0.5 break-all font-mono text-xs text-slate-200">{record.did}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Credential Hash</dt><dd className="mt-0.5 break-all font-mono text-xs text-slate-200">{record.credentialHash}</dd></div>
              <div><dt className="text-xs text-slate-500">Created</dt><dd className="mt-0.5 text-slate-300">{record.updatedAt === BigInt(0) ? "—" : new Date(Number(record.updatedAt) * 1000).toLocaleString()}</dd></div>
              <div><dt className="text-xs text-slate-500">Updated</dt><dd className="mt-0.5 text-slate-300">{record.updatedAt === BigInt(0) ? "—" : new Date(Number(record.updatedAt) * 1000).toLocaleString()}</dd></div>
            </dl>
          )}

          {loadedAddr && record ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="text-[13px] font-medium text-slate-300">Actions</p>
              {!managesLoaded ? (
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  Update and Revoke act on the connected wallet. Connect wallet <code className="font-mono">{shortAddress(loadedAddr)}</code> to manage this identity.
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-500">Edit the DID / credential fields in section A, then update. Revoking is permanent.</p>
              )}
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button onClick={() => submit("update")} disabled={!managesLoaded || !configured || busy !== null} className={btnSecondary}>
                  {busy === "update" ? <Spinner className="h-4 w-4" /> : null}
                  {busy === "update" ? "Updating…" : "Update Identity"}
                </button>
                <button onClick={() => submit("revoke")} disabled={!managesLoaded || !configured || busy !== null} className={btnDanger}>
                  {busy === "revoke" ? <Spinner className="h-4 w-4" /> : null}
                  {busy === "revoke" ? "Revoking…" : "Revoke Identity"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4"><TxStatus stage={stage} hash={hash} error={error} /></div>
      </Card>
    </main>
  );
}
