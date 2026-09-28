"use client";

import { ethers } from "ethers";
import { useState } from "react";
import { BadgeCheck, Fingerprint, ShieldAlert, Stamp } from "lucide-react";
import { Badge, Card, ConfigNotice, Field, PageHeader, Spinner, btnPrimary, inputCls } from "@/components/ui";
import { contractsConfigured } from "@/lib/config";
import { friendlyError, shortAddress } from "@/lib/format";
import { readAsset, readIdentity, readRoles, type AssetInfo, type IdentityRecord, type RoleStatus } from "@/lib/contracts";

function assetName(uri: string): string {
  const body = uri.startsWith("sih26125:") ? uri.slice("sih26125:".length) : uri;
  return body.split("|")[0] || uri;
}

export default function VerifyPage() {
  const [wallet, setWallet] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [identity, setIdentity] = useState<{ record: IdentityRecord; valid: boolean } | null>(null);
  const [roles, setRoles] = useState<RoleStatus | null>(null);
  const [asset, setAsset] = useState<AssetInfo | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorAsset, setErrorAsset] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState(false);
  const [checkingAsset, setCheckingAsset] = useState(false);
  const configured = contractsConfigured();

  async function verifyIdentity() {
    setErrorId(null);
    setIdentity(null);
    setRoles(null);
    if (!configured) {
      setErrorId("Contracts are not configured yet.");
      return;
    }
    if (!ethers.isAddress(wallet)) {
      setErrorId("Enter a valid 0x wallet address.");
      return;
    }
    setCheckingId(true);
    try {
      const [id, r] = await Promise.all([readIdentity(wallet), readRoles(wallet)]);
      setIdentity(id);
      setRoles(r);
    } catch (e) {
      setErrorId(friendlyError(e));
    } finally {
      setCheckingId(false);
    }
  }

  async function verifyAsset() {
    setErrorAsset(null);
    setAsset(null);
    if (!configured) {
      setErrorAsset("Contracts are not configured yet.");
      return;
    }
    if (!tokenId || !Number.isInteger(Number(tokenId)) || Number(tokenId) <= 0) {
      setErrorAsset("Enter a valid positive token ID.");
      return;
    }
    setCheckingAsset(true);
    try {
      setAsset(await readAsset(Number(tokenId)));
    } catch (e) {
      setErrorAsset(friendlyError(e));
    } finally {
      setCheckingAsset(false);
    }
  }

  return (
    <main className="space-y-6">
      <PageHeader
        kicker="Verify"
        title="Verify identity and ownership without modifying blockchain state"
        desc="Check whether an identity or digital asset is valid on-chain. Reads only — no wallet needed."
      />
      <ConfigNotice />

      <section className="grid gap-4 lg:grid-cols-2">
        {/* Verify identity */}
        <Card title="VERIFY IDENTITY" sub="Enter a wallet address">
          <Field label="Wallet Address">
            <input className={inputCls} value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x…" />
          </Field>
          <button onClick={verifyIdentity} disabled={checkingId || !configured} className={`${btnPrimary} mt-3.5 w-full`}>
            {checkingId ? <Spinner className="h-4 w-4" /> : <Fingerprint className="h-4 w-4" />}
            {checkingId ? "Verifying…" : "Verify Identity"}
          </button>
          {errorId ? <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-3 py-2.5 text-sm text-red-300">{errorId}</p> : null}
          {identity ? (
            <div className={`mt-4 rounded-2xl border p-4 ${identity.valid ? "border-emerald-400/25 bg-emerald-400/[0.06]" : "border-red-400/25 bg-red-400/[0.06]"}`}>
              <p className="flex items-center gap-2 text-lg font-bold tracking-tight">
                {identity.valid ? <BadgeCheck className="h-6 w-6 text-emerald-300" /> : <ShieldAlert className="h-6 w-6 text-red-300" />}
                <span className={identity.valid ? "text-emerald-300" : "text-red-300"}>
                  {identity.valid ? "✓ VERIFIED" : "✕ NOT VERIFIED"}
                </span>
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Wallet</dt><dd className="font-mono text-xs text-slate-200">{wallet ? shortAddress(wallet) : "—"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">DID</dt><dd className="break-all text-right font-mono text-xs text-slate-200">{identity.record.did || "—"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Role</dt><dd>{roles && (roles.admin || roles.issuer || roles.verifier) ? <Badge tone={roles.verifier ? "cyan" : roles.admin ? "violet" : "blue"}>{[roles.admin && "ADMIN", roles.issuer && "ISSUER", roles.verifier && "VERIFIER"].filter(Boolean).join(" · ")}</Badge> : <span className="text-slate-400">User</span>}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Identity</dt><dd className={identity.valid ? "font-semibold text-emerald-300" : "font-semibold text-red-300"}>{identity.valid ? "VALID" : identity.record.did ? "REVOKED" : "NOT FOUND"}</dd></div>
              </dl>
              {identity.record.did ? (
                <p className="mt-2 break-all font-mono text-[11px] text-slate-600">{identity.record.did}</p>
              ) : null}
            </div>
          ) : null}
        </Card>

        {/* Verify asset */}
        <Card title="VERIFY ASSET" sub="Enter a token ID">
          <Field label="Token ID" hint="The certificate number from the Assets page.">
            <input className={inputCls} value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="e.g. 1" inputMode="numeric" />
          </Field>
          <button onClick={verifyAsset} disabled={checkingAsset || !configured} className={`${btnPrimary} mt-3.5 w-full`}>
            {checkingAsset ? <Spinner className="h-4 w-4" /> : <Stamp className="h-4 w-4" />}
            {checkingAsset ? "Verifying…" : "Verify Asset"}
          </button>
          {errorAsset ? <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-3 py-2.5 text-sm text-red-300">{errorAsset}</p> : null}
          {asset ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
              <p className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <BadgeCheck className="h-6 w-6 text-emerald-300" />
                <span className="text-emerald-300">✓ VERIFIED</span>
                <span className="ml-auto"><Badge tone={asset.locked ? "amber" : "green"}>{asset.locked ? "Locked" : "Active"}</Badge></span>
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Asset</dt><dd className="text-right text-slate-200">{assetName(asset.uri)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Owner</dt><dd className="font-mono text-xs text-slate-200" title={asset.owner}>{shortAddress(asset.owner)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Status</dt><dd className={asset.locked ? "font-semibold text-amber-300" : "font-semibold text-emerald-300"}>{asset.locked ? "LOCKED" : "ACTIVE"}</dd></div>
              </dl>
              <p className="mt-2 break-all font-mono text-[11px] text-slate-600">{asset.uri}</p>
            </div>
          ) : null}
        </Card>
      </section>
    </main>
  );
}
