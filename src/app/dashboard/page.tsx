"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Fingerprint,
  ShieldCheck,
  Stamp
} from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { Badge, Card, ConfigNotice, Spinner, StatCard } from "@/components/ui";
import {
  ACCESS_ADDR,
  ASSET_ADDR,
  CHAIN_ID,
  IDENTITY_ADDR,
  NETWORK_NAME,
  isAddressConfigured
} from "@/lib/config";
import { listAssets, readIdentity, readRoles } from "@/lib/contracts";
import { fetchAuditEvents, type AuditRecord } from "@/lib/audit";
import { loadRecentTx, type RecentTx } from "@/lib/txhistory";

const ACTIONS = [
  {
    n: "1. CREATE IDENTITY",
    desc: "Anchor a wallet identity on-chain",
    href: "/identities",
    cta: "Open Identity",
    icon: Fingerprint
  },
  {
    n: "2. MANAGE ACCESS",
    desc: "Assign Issuer or Verifier permissions",
    href: "/access",
    cta: "Open Access",
    icon: ShieldCheck
  },
  {
    n: "3. REGISTER ASSET",
    desc: "Create a blockchain-backed digital asset",
    href: "/assets",
    cta: "Open Assets",
    icon: Stamp
  },
  {
    n: "4. VERIFY",
    desc: "Verify identity or asset ownership",
    href: "/verify",
    cta: "Open Verify",
    icon: ArrowRight
  }
];

export default function DashboardPage() {
  const { address, connect, connecting } = useWallet();
  const [recent, setRecent] = useState<RecentTx[]>([]);
  const [onchain, setOnchain] = useState<AuditRecord[] | null>(null);
  const [auditTotal, setAuditTotal] = useState<number | null>(null);
  const [identityState, setIdentityState] = useState<"unknown" | "valid" | "revoked" | "none">("unknown");
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  const [assetCount, setAssetCount] = useState<number | null>(null);
  const configured = [IDENTITY_ADDR, ACCESS_ADDR, ASSET_ADDR].filter((a) => isAddressConfigured(a)).length;

  useEffect(() => {
    setRecent(loadRecentTx());
    // Prefer real on-chain events; fall back to localStorage when unavailable.
    if (configured !== 3) {
      setOnchain(null);
      return;
    }
    let cancelled = false;
    // Lightweight chain read also proves connectivity for the status row.
    Promise.all([
      fetchAuditEvents(),
      readIdentity(address ?? "0x0000000000000000000000000000000000000000").catch(() => null),
      address ? readRoles(address).catch(() => null) : Promise.resolve(null),
      listAssets(25).catch(() => null)
    ])
      .then(([all, id, r, assets]) => {
        if (cancelled) return;
        setOnchain(all.slice(0, 5));
        setAuditTotal(all.length);
        if (!id) setIdentityState("unknown");
        else if (id.record.did === "" && !id.valid) setIdentityState("none");
        else if (id.record.revoked || !id.valid) setIdentityState("revoked");
        else setIdentityState("valid");
        if (!r) setRoleLabel(null);
        else if (r.admin) setRoleLabel("Admin");
        else if (r.issuer) setRoleLabel("Issuer");
        else if (r.verifier) setRoleLabel("Verifier");
        else setRoleLabel("User");
        setAssetCount(assets ? assets.assets.length : null);
      })
      .catch(() => {
        if (cancelled) return;
        setOnchain(null);
        setAuditTotal(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return (
    <main className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-[26px] font-bold tracking-tight text-white">TrustLedger</h1>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/90">
          Identity • Access • Digital Assets
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Manage verifiable identities, role-based permissions and blockchain-backed digital ownership from one platform.
        </p>
      </div>

      <ConfigNotice />

      {/* Primary actions */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <div key={a.n} className="flex flex-col rounded-2xl border border-white/[0.07] bg-panel/90 p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/25">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/[0.08] text-accent ring-1 ring-inset ring-accent/20">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-sm font-bold tracking-wide text-white">{a.n}</h2>
              <p className="mt-1 flex-1 text-[13px] leading-relaxed text-slate-400">{a.desc}</p>
              <Link
                href={a.href}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#04121a] transition-colors hover:bg-cyan-400"
              >
                {a.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          );
        })}
      </section>

      {/* System status */}
      <Card title="System status" sub="Live state of the platform">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/[0.06] bg-abyss/70 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">Blockchain</p>
            <p className="mt-1.5">
              {address ? <Badge tone="green" pulse>Connected</Badge> : <Badge tone="slate">Disconnected</Badge>}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-abyss/70 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">Network</p>
            <p className="mt-1.5 text-sm font-semibold text-white">{NETWORK_NAME} <span className="font-mono text-xs font-normal text-slate-500">· Chain {CHAIN_ID}</span></p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-abyss/70 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">Contracts</p>
            <p className="mt-1.5 text-sm font-semibold text-white">
              {configured} / 3 {configured === 3 ? "configured" : "configured"}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-abyss/70 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">Wallet</p>
            <div className="mt-1.5">
              {address ? (
                <code className="font-mono text-sm text-slate-200" title={address}>
                  {address.slice(0, 6)}…{address.slice(-4)}
                </code>
              ) : (
                <button onClick={connect} disabled={connecting} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-[#04121a] hover:bg-cyan-400 disabled:opacity-50">
                  {connecting ? <Spinner className="h-3.5 w-3.5" /> : null}
                  {connecting ? "Connecting…" : "Connect"}
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Demo state — all values read live from the contracts */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Identity"
          value={
            <Badge tone={identityState === "valid" ? "green" : identityState === "none" ? "slate" : identityState === "revoked" ? "red" : "amber"}>
              {identityState === "valid" ? "Active" : identityState === "none" ? "None yet" : identityState === "revoked" ? "Revoked" : "Unknown"}
            </Badge>
          }
          hint="Your wallet in IdentityRegistry"
        />
        <StatCard
          label="My Role"
          value={roleLabel ?? "—"}
          hint="Your highest AccessManager role"
        />
        <StatCard
          label="Digital Assets"
          value={assetCount === null ? "—" : assetCount}
          hint="NFTs registered in AssetRegistry"
        />
        <StatCard
          label="Audit Events"
          value={auditTotal === null ? "—" : auditTotal}
          hint="Immutable events on-chain"
        />
      </section>

      {/* Recent activity */}
      <Card
        title={onchain ? "Recent activity · On-chain" : "Recent activity · Local demo"}
        sub={onchain ? "Latest real blockchain events across all contracts" : "This browser's session log — shown because on-chain events could not be loaded"}
        action={
          onchain ? (
            <Link href="/audit" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-cyan-300">
              Open Audit <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : recent.length > 0 ? (
            <Badge tone="slate">{recent.length}</Badge>
          ) : undefined
        }
      >
          {onchain ? (
            onchain.length === 0 ? (
              <p className="text-sm text-slate-500">No on-chain activity yet. Start with “1. Create Identity” above.</p>
            ) : (
            <ul className="space-y-2 text-sm">
              {onchain.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-abyss/70 px-3 py-2">
                  <span className="text-slate-300">{r.title} <span className="text-xs text-slate-600">· #{r.blockNumber}</span></span>
                  <code className="shrink-0 font-mono text-xs text-slate-500" title={r.txHash}>{r.txHash.slice(0, 10)}…{r.txHash.slice(-6)}</code>
                </li>
              ))}
            </ul>
          )
        ) : recent.length === 0 ? (
          <p className="text-sm text-slate-500">No transactions yet. Actions you take will appear here with their hashes.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recent.map((t) => (
              <li key={t.hash} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-abyss/70 px-3 py-2">
                <span className="text-slate-300">{t.label}</span>
                <code className="shrink-0 font-mono text-xs text-slate-500" title={t.hash}>{t.hash.slice(0, 10)}…{t.hash.slice(-6)}</code>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
