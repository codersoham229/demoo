"use client";

import { ethers } from "ethers";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, Lock, LockOpen, Plus, Wallet } from "lucide-react";
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
  btnPrimary,
  btnSecondary,
  inputCls
} from "@/components/ui";
import { contractsConfigured } from "@/lib/config";
import { type TxStage, friendlyError, shortAddress, shortHash } from "@/lib/format";
import { getAssetWrite, listAssets, type AssetInfo } from "@/lib/contracts";
import { fetchAuditEvents } from "@/lib/audit";
import { pushRecentTx } from "@/lib/txhistory";

function parseTokenURI(uri: string): { name: string; type: string; ref: string } {
  const body = uri.startsWith("sih26125:") ? uri.slice("sih26125:".length) : uri;
  const [name, type, ref] = body.split("|");
  return { name: name || uri, type: type || "—", ref: ref || "—" };
}

export default function AssetsPage() {
  const { address, signer, connect, connecting } = useWallet();
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<TxStage>("ready");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  // Register form
  const [name, setName] = useState("");
  const [atype, setAtype] = useState("Certificate");
  const [docRef, setDocRef] = useState("");
  const [recipient, setRecipient] = useState("");

  // Selected-asset actions
  const [actionId, setActionId] = useState("");
  const [transferTo, setTransferTo] = useState("");

  const [createdAt, setCreatedAt] = useState<Record<number, number | null>>({});

  const configured = contractsConfigured();
  const visible = mineOnly && address ? assets.filter((a) => a.owner.toLowerCase() === address.toLowerCase()) : assets;

  useEffect(() => {
    if (address && !recipient) setRecipient(address);
  }, [address, recipient]);

  async function refresh() {
    if (!configured) return;
    setLoading(true);
    setError(null);
    try {
      const r = await listAssets(25);
      setAssets(r.assets);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    if (!configured) {
      setCreatedAt({});
      return;
    }
    let cancelled = false;
    fetchAuditEvents()
      .then((all) => {
        if (cancelled) return;
        const map: Record<number, number | null> = {};
        for (const r of all) {
          if (r.event === "AssetRegistered" && r.tokenId !== null && !(r.tokenId in map)) {
            map[r.tokenId] = r.timestamp;
          }
        }
        setCreatedAt(map);
      })
      .catch(() => {
        if (!cancelled) setCreatedAt({});
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildTokenURI(): string {
    const n = name.trim() || "Untitled asset";
    const t = atype.trim() || "Document";
    const d = docRef.trim() || "no-ref";
    return `sih26125:${n}|${t}|${d}`;
  }

  async function runTx(op: string, label: string, fn: (c: ReturnType<typeof getAssetWrite>) => Promise<{ hash: string; wait: () => Promise<unknown> }>) {
    setError(null);
    setHash(null);
    if (!signer) {
      setError("Connect a wallet with MINTER/owner rights first.");
      return;
    }
    setStage("confirm");
    setBusy(op);
    try {
      const c = getAssetWrite(signer);
      const tx = await fn(c);
      setHash(tx.hash);
      setStage("pending");
      await tx.wait();
      setStage("confirmed");
      pushRecentTx({ hash: tx.hash, label, at: new Date().toISOString() });
      await refresh();
    } catch (e) {
      setStage("failed");
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function register() {
    if (!ethers.isAddress(recipient)) {
      setError("Enter a valid recipient wallet address.");
      return;
    }
    if (!docRef.trim()) {
      setError("Enter a document/hash/URI reference so the asset is traceable.");
      return;
    }
    await runTx("register", "Asset register", async (c) => {
      const tx = await c.registerAsset(recipient, buildTokenURI());
      return tx as unknown as { hash: string; wait: () => Promise<unknown> };
    });
  }

  function parseId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  async function transfer(idOverride?: number) {
    const id = idOverride ?? parseId(actionId);
    if (id === null) {
      setError("Enter a valid asset/token ID.");
      return;
    }
    if (!ethers.isAddress(transferTo)) {
      setError("Enter a valid destination wallet address.");
      return;
    }
    await runTx(`transfer-${id}`, `Asset #${id} transfer`, async (c) => {
      const tx = await c.transferAsset(transferTo, id);
      return tx as unknown as { hash: string; wait: () => Promise<unknown> };
    });
  }

  async function lock(unlock: boolean, idOverride?: number) {
    const id = idOverride ?? parseId(actionId);
    if (id === null) {
      setError("Enter a valid asset/token ID.");
      return;
    }
    await runTx(`${unlock ? "unlock" : "lock"}-${id}`, `Asset #${id} ${unlock ? "unlock" : "lock"}`, async (c) => {
      const tx = unlock ? await c.unlockAsset(id) : await c.lockAsset(id);
      return tx as unknown as { hash: string; wait: () => Promise<unknown> };
    });
  }

  function fmtCreated(id: number): string {
    const ts = createdAt[id];
    if (ts === undefined) return "—";
    if (ts === null) return "unavailable";
    try {
      return new Date(ts * 1000).toLocaleDateString();
    } catch {
      return "—";
    }
  }

  return (
    <main className="space-y-6">
      <PageHeader
        kicker="Assets"
        title="Manage blockchain-backed digital ownership"
        desc="Register certificates as NFTs, then transfer or lock them. Everything below reads live from the AssetRegistry contract."
      />
      <ConfigNotice />

      {/* Register */}
      <Card title="Register Digital Asset" sub="Requires a wallet with MINTER_ROLE (deployer by default)" action={<WriteTag />}>
        {!address ? (
          <button onClick={connect} disabled={connecting} className={btnPrimary}>
            {connecting ? <Spinner className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        ) : (
          <div className="grid gap-3.5 md:grid-cols-2">
            <Field label="Recipient Wallet"><input className={inputCls} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x…" /></Field>
            <Field label="Asset Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Degree Certificate" /></Field>
            <Field label="Asset Type"><input className={inputCls} value={atype} onChange={(e) => setAtype(e.target.value)} placeholder="Certificate" /></Field>
            <Field label="Reference" hint="Document ID, hash, or URI — never raw personal data.">
              <input className={inputCls} value={docRef} onChange={(e) => setDocRef(e.target.value)} placeholder="CERT-2026-0042 or ipfs://…" />
            </Field>
          </div>
        )}
        {address ? (
          <div className="mt-3.5">
            <p className="break-all rounded-xl border border-white/[0.07] bg-abyss/70 px-3 py-2 font-mono text-[11px] text-slate-500">
              Stored reference: <span className="text-accent/80">{buildTokenURI()}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={register} disabled={!signer || !configured || busy !== null} className={btnPrimary}>
                {busy === "register" ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {busy === "register" ? "Registering…" : "Register Asset"}
              </button>
              <button
                onClick={() => {
                  setName("College Degree Certificate");
                  setAtype("Digital Certificate");
                  setDocRef("CERT-2026-001");
                  if (address) setRecipient(address);
                }}
                className={btnSecondary}
              >
                Fill demo values
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Selected-asset actions */}
      <Card title="Transfer / Lock" sub="Enter an asset ID and destination, or use the per-row buttons below">
        <div className="grid gap-3.5 md:grid-cols-2">
          <Field label="Asset / token ID"><input className={inputCls} value={actionId} onChange={(e) => setActionId(e.target.value)} placeholder="1" inputMode="numeric" /></Field>
          <Field label="Transfer to"><input className={inputCls} value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="0x…" /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => transfer()} disabled={!signer || !configured || busy !== null} className={btnPrimary}>
            {busy?.startsWith("transfer-") ? <Spinner className="h-4 w-4" /> : null} Transfer
          </button>
          <button onClick={() => lock(false)} disabled={!signer || !configured || busy !== null} className={btnSecondary}>
            {busy?.startsWith("lock-") ? <Spinner className="h-4 w-4" /> : null} Lock
          </button>
          <button onClick={() => lock(true)} disabled={!signer || !configured || busy !== null} className={btnSecondary}>
            {busy?.startsWith("unlock-") ? <Spinner className="h-4 w-4" /> : null} Unlock
          </button>
        </div>
        <div className="mt-4"><TxStatus stage={stage} hash={hash} error={error} /></div>
      </Card>

      {/* Your assets */}
      <Card
        title="Your Digital Assets"
        sub={address ? "Filtered to your connected wallet — toggle to see everything" : "Connect a wallet to filter to your assets"}
        action={<ReadTag />}
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button onClick={refresh} disabled={!configured || loading} className={btnSecondary}>
            {loading ? <Spinner className="h-4 w-4" /> : null} {loading ? "Scanning…" : "Refresh"}
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
            <button
              role="switch"
              aria-checked={mineOnly}
              onClick={() => setMineOnly(!mineOnly)}
              className={`relative h-5 w-9 rounded-full transition-colors ${mineOnly ? "bg-cyan-500" : "bg-white/10"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${mineOnly ? "left-[18px]" : "left-0.5"}`} />
            </button>
            Mine only
          </label>
          {visible.length > 0 ? <span className="text-xs text-slate-500">{visible.length} asset{visible.length === 1 ? "" : "s"}</span> : null}
        </div>
        {!configured ? <p className="text-sm text-slate-500">Contracts not configured.</p>
        : loading ? <p className="flex items-center gap-2 text-sm text-slate-500"><Spinner className="h-4 w-4" /> Scanning token IDs 1–25…</p>
        : visible.length === 0 ? (
          <p className="text-sm text-slate-500">
            {mineOnly && address
              ? "Your wallet owns no assets yet. Register one above, or turn off “Mine only” to browse everything."
              : "No assets found. Register the first one above — it will appear here as token #1."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pr-3 font-medium">Asset</th>
                  <th className="py-2.5 pr-3 font-medium">Token ID</th>
                  <th className="py-2.5 pr-3 font-medium">Owner</th>
                  <th className="py-2.5 pr-3 font-medium">Status</th>
                  <th className="py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const meta = parseTokenURI(a.uri);
                  const open = openId === a.tokenId;
                  return (
                    <Fragment key={a.tokenId}>
                      <tr key={a.tokenId} className="border-b border-white/[0.05] transition-colors last:border-0 hover:bg-white/[0.02]">
                        <td className="max-w-[200px] truncate py-2.5 pr-3 font-medium text-slate-100" title={meta.name}>{meta.name}</td>
                        <td className="py-2.5 pr-3 font-mono font-semibold text-accent">#{a.tokenId}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-slate-400" title={a.owner}>{shortAddress(a.owner)}</td>
                        <td className="py-2.5 pr-3"><Badge tone={a.locked ? "red" : "green"}>{a.locked ? "Locked" : "Active"}</Badge></td>
                        <td className="py-2.5">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <button
                              title="Transfer using the destination above"
                              onClick={() => { setActionId(String(a.tokenId)); transfer(a.tokenId); }}
                              disabled={!signer || !configured || busy !== null}
                              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-accent/40 hover:text-accent disabled:opacity-40"
                            >
                              Transfer
                            </button>
                            {a.locked ? (
                              <button
                                title="Unlock this asset"
                                onClick={() => { setActionId(String(a.tokenId)); lock(true, a.tokenId); }}
                                disabled={!signer || !configured || busy !== null}
                                className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-accent/40 hover:text-accent disabled:opacity-40"
                              >
                                <LockOpen className="h-3 w-3" /> Unlock
                              </button>
                            ) : (
                              <button
                                title="Lock this asset"
                                onClick={() => { setActionId(String(a.tokenId)); lock(false, a.tokenId); }}
                                disabled={!signer || !configured || busy !== null}
                                className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-accent/40 hover:text-accent disabled:opacity-40"
                              >
                                <Lock className="h-3 w-3" /> Lock
                              </button>
                            )}
                            <Link
                              title="Open in Verify"
                              href="/verify"
                              className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-accent/40 hover:text-accent"
                            >
                              <Eye className="h-3 w-3" /> View
                            </Link>
                            <button
                              title="Blockchain details"
                              onClick={() => setOpenId(open ? null : a.tokenId)}
                              className="flex items-center gap-0.5 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-300"
                            >
                              Details <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
                            </button>
                          </span>
                        </td>
                      </tr>
                      {open ? (
                        <tr key={`${a.tokenId}-detail`} className="border-b border-white/[0.05]">
                          <td colSpan={5} className="px-1 pb-3">
                            <div className="grid gap-2 rounded-xl border border-white/[0.07] bg-abyss/70 p-3 text-xs text-slate-400 sm:grid-cols-2">
                              <p><span className="text-slate-600">Type · </span>{meta.type}</p>
                              <p><span className="text-slate-600">Reference · </span><code className="font-mono">{meta.ref}</code></p>
                              <p className="break-all"><span className="text-slate-600">Full URI · </span><code className="font-mono">{a.uri}</code></p>
                              <p><span className="text-slate-600">Owner · </span><code className="font-mono" title={a.owner}>{a.owner}</code></p>
                              <p><span className="text-slate-600">Registered · </span>{fmtCreated(a.tokenId)}</p>
                              <p><span className="text-slate-600">Contract · </span>AssetRegistry</p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-600">
          {address ? <>Connected as <code className="font-mono text-slate-500">{shortAddress(address)}</code>.</> : null}
          {hash ? <> Last hash: <code className="font-mono text-slate-500">{shortHash(hash)}</code>.</> : null}
        </p>
      </Card>
    </main>
  );
}
