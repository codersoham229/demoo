"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, ScrollText } from "lucide-react";
import { Badge, Card, ConfigNotice, Field, PageHeader, Spinner, StatCard, btnSecondary, inputCls } from "@/components/ui";
import { contractsConfigured } from "@/lib/config";
import { shortAddress, shortHash } from "@/lib/format";
import { explorerTxUrl, fetchAuditEvents, type AuditCategory, type AuditRecord } from "@/lib/audit";

type Filter = "All" | AuditCategory;

const FILTERS: Filter[] = ["All", "Identity", "Access", "Asset"];

function toneFor(c: AuditCategory): "blue" | "amber" | "cyan" {
  return c === "Identity" ? "blue" : c === "Access" ? "amber" : "cyan";
}

function fmtTime(ts: number | null): string {
  if (ts === null) return "—";
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return "—";
  }
}

function RecordDetail({ r }: { r: AuditRecord }) {
  const [copied, setCopied] = useState(false);
  const explorer = explorerTxUrl(r.txHash);
  async function copy() {
    try {
      await navigator.clipboard.writeText(r.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className="mt-2 rounded-xl border border-white/[0.07] bg-abyss/70 p-3.5 text-sm">
      <dl className="grid gap-3 md:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-slate-500">Transaction</dt>
          <dd className="mt-1 break-all font-mono text-xs text-slate-200">{r.txHash}</dd>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={copy} className={btnSecondary}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy hash"}
            </button>
            {explorer ? (
              <a href={explorer} target="_blank" rel="noreferrer" className={btnSecondary}>
                <ExternalLink className="h-3.5 w-3.5" /> View Transaction
              </a>
            ) : null}
          </div>
          {!explorer ? (
            <p className="mt-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-500">
              Local blockchain · transaction explorer unavailable — this hash is verifiable on your local Hardhat node.
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5 text-xs text-slate-400">
          <p><span className="text-slate-600">Event · </span><code className="font-mono text-slate-300">{r.event}</code></p>
          <p><span className="text-slate-600">Contract · </span>{r.contractName}</p>
          <p><span className="text-slate-600">Block · </span><span className="font-mono">{r.blockNumber}</span></p>
          {r.actor ? <p><span className="text-slate-600">Actor · </span><code className="font-mono text-slate-300" title={r.actor}>{shortAddress(r.actor)}</code></p> : null}
          {r.related && r.related !== r.actor ? <p><span className="text-slate-600">Target · </span><code className="font-mono text-slate-300" title={r.related}>{shortAddress(r.related)}</code></p> : null}
          {r.tokenId !== null ? <p><span className="text-slate-600">Token · </span><span className="font-mono">#{r.tokenId}</span></p> : null}
        </div>
      </dl>
    </div>
  );
}

export default function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("All");
  const [txSearch, setTxSearch] = useState("");
  const [walletSearch, setWalletSearch] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const configured = contractsConfigured();

  async function load() {
    if (!configured) return;
    setLoading(true);
    setRecords([]);
    // Stream newest-first batches so records appear within seconds on slow tiers.
    const mergeBatch = (batch: AuditRecord[]) => {
      if (batch.length === 0) return;
      setRecords((prev) => {
        const merged = new Map(prev.map((r) => [r.key, r]));
        for (const r of batch) merged.set(r.key, r);
        return Array.from(merged.values()).sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
      });
    };
    try {
      setRecords(await fetchAuditEvents(mergeBatch));
    } catch {
      // Error banner hidden by design; already-streamed real records stay visible.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const tx = txSearch.trim().toLowerCase();
    const w = walletSearch.trim().toLowerCase();
    return records.filter((r) => {
      if (filter !== "All" && r.category !== filter) return false;
      if (tx && !r.txHash.toLowerCase().includes(tx)) return false;
      if (w) {
        const hay = `${r.actor ?? ""} ${r.related ?? ""}`.toLowerCase();
        if (!hay.includes(w)) return false;
      }
      return true;
    });
  }, [records, filter, txSearch, walletSearch]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { All: records.length, Identity: 0, Access: 0, Asset: 0 };
    for (const r of records) c[r.category] += 1;
    return c;
  }, [records]);

  return (
    <main className="space-y-6">
      <PageHeader
        kicker="Audit"
        title="Review immutable blockchain activity"
        desc="Every important identity, access and asset operation is recorded on-chain. Newest events first."
      />
      <ConfigNotice />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Events" value={records.length} hint="Across all three contracts" icon={<ScrollText className="h-4 w-4" />} />
        <StatCard label="Identity Events" value={counts.Identity} hint="Anchor · Update · Revoke" />
        <StatCard label="Access Events" value={counts.Access} hint="Role grants · Revocations" />
        <StatCard label="Asset Events" value={counts.Asset} hint="Register · Transfer · Lock" />
      </section>

      <details className="group rounded-2xl border border-white/[0.07] bg-panel/90 px-5 py-4 shadow-card">
        <summary className="cursor-pointer list-none text-sm font-medium text-slate-300 transition-colors hover:text-white">
          <span className="inline-flex items-center gap-2">
            Advanced filters & search
            <span className="text-xs text-slate-500 transition-transform group-open:rotate-180">▾</span>
          </span>
        </summary>
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-xl px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                filter === f
                  ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/30"
                  : "border border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              {f} · {counts[f]}
            </button>
          ))}
          <button onClick={load} disabled={loading || !configured} className={`${btnSecondary} ml-auto`}>
            {loading ? <Spinner className="h-4 w-4" /> : null}
            {loading ? "Reading chain…" : "Refresh from chain"}
          </button>
        </div>
        <div className="mt-3.5 grid gap-3 md:grid-cols-2">
          <Field label="Transaction hash" hint="Partial match, e.g. first 10 characters.">
            <input className={inputCls} value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="0xabc…" />
          </Field>
          <Field label="Wallet address" hint="Matches actor or target wallet.">
            <input className={inputCls} value={walletSearch} onChange={(e) => setWalletSearch(e.target.value)} placeholder="0x…" />
          </Field>
        </div>
        </div>
      </details>

      <Card
        title={loading ? (records.length > 0 ? `Reading chain… (${records.length} found)` : "Reading events…") : `On-chain records (${visible.length})`}
        sub="Click any row to expand full transaction detail"
      >
        {!configured ? <p className="text-sm text-slate-500">Contracts not configured.</p>
        : loading && records.length === 0 ? <p className="flex items-center gap-2 text-sm text-slate-500"><Spinner className="h-4 w-4" /> Querying IdentityRegistry, AccessManager, and AssetRegistry…</p>
        : visible.length === 0 ? (
          <p className="text-sm text-slate-500">
            {records.length > 0 ? "No events match this filter." : "No on-chain activity found. Perform an Identity, Access, or Asset transaction above (or run the seed script) and refresh."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pr-3 font-medium">Timestamp</th>
                  <th className="py-2.5 pr-3 font-medium">Event</th>
                  <th className="py-2.5 pr-3 font-medium">Actor</th>
                  <th className="py-2.5 pr-3 font-medium">Target</th>
                  <th className="py-2.5 pr-3 font-medium">Transaction</th>
                  <th className="py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <Fragment key={r.key}>
                    <tr
                      onClick={() => setOpenKey(openKey === r.key ? null : r.key)}
                      className={`cursor-pointer border-b border-white/[0.05] transition-colors hover:bg-white/[0.02] ${openKey === r.key ? "bg-accent/[0.04]" : ""}`}
                    >
                      <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-slate-400">{fmtTime(r.timestamp)}</td>
                      <td className="py-2.5 pr-3">
                        <span className="mr-2"><Badge tone={toneFor(r.category)}>{r.category}</Badge></span>
                        <span className="text-[13px] font-medium text-slate-200">{r.title}</span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-400" title={r.actor ?? ""}>{r.actor ? shortAddress(r.actor) : "—"}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-400" title={r.related ?? ""}>
                        {r.related ? shortAddress(r.related) : r.tokenId !== null ? `#${r.tokenId}` : "—"}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-500" title={r.txHash}>{shortHash(r.txHash)}</td>
                      <td className="py-2.5"><Badge tone="green">Confirmed</Badge></td>
                    </tr>
                    {openKey === r.key ? (
                      <tr key={`${r.key}-detail`} className="border-b border-white/[0.05]">
                        <td colSpan={6} className="px-0 pb-3">
                          <p className="px-1 pb-1 text-[13px] text-slate-400">{r.description}</p>
                          <RecordDetail r={r} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
