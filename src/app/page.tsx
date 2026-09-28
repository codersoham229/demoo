"use client";

import Link from "next/link";
import { ArrowRight, Fingerprint, Lock, ScrollText, ShieldCheck, Stamp } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import { Badge, Card, ConfigNotice, Spinner } from "@/components/ui";
import { SplineScene } from "@/components/SplineScene";
import { SPLINE_SCENE_URL } from "@/lib/config";

const FEATURES = [
  { n: "01", icon: Fingerprint, title: "Decentralized Identity", desc: "Verifiable identity anchored on blockchain" },
  { n: "02", icon: Lock, title: "Role-Based Access", desc: "Smart-contract enforced permissions" },
  { n: "03", icon: Stamp, title: "Digital Asset Ownership", desc: "NFT-backed ownership and transfer history" },
  { n: "04", icon: ScrollText, title: "Immutable Audit Trail", desc: "Every important operation recorded on-chain" }
];

const FLOW = [
  { icon: Fingerprint, t: "Identity", d: "Wallet-anchored DID" },
  { icon: ShieldCheck, t: "Access Control", d: "Admin · Issuer · Verifier" },
  { icon: Stamp, t: "Digital Assets", d: "NFT certificates" },
  { icon: ScrollText, t: "Audit Trail", d: "Immutable events" }
];

export default function Home() {
  const { address, connect, connecting } = useWallet();

  return (
    <main className="space-y-10">
      <ConfigNotice />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-panel/80 px-6 py-10 shadow-card md:px-10 md:py-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(600px 220px at 50% 0%, rgba(34,211,238,0.09), transparent 70%)" }}
        />
        <div className="relative grid items-center gap-8 animate-fade-up lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <Badge tone="cyan">
              <span className="tracking-[0.16em]">SMART INDIA HACKATHON 2026 • PS 26125</span>
            </Badge>
            <h1 className="mt-5 text-5xl font-bold tracking-tight text-white md:text-6xl">
              Trust<span className="text-accent">Ledger</span>
            </h1>
            <p className="mt-4 text-lg font-medium text-slate-200 md:text-xl">
              Blockchain-based Identity, Access Control &amp; Digital Asset Management
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400 lg:mx-0">
              One verifiable identity layer. Role-based access enforced by smart contracts. Digital assets with an immutable
              ownership trail.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-[#04121a] shadow-glow transition-all hover:bg-cyan-400"
              >
                Open Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              {address ? (
                <Link
                  href="/verify"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <ShieldCheck className="h-4 w-4 text-accent" /> Verify Identity
                </Link>
              ) : (
                <button
                  onClick={connect}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {connecting ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4 text-accent" />}
                  {connecting ? "Connecting…" : "Verify Identity"}
                </button>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-600">Test networks and synthetic demo data only · No wallet needed to explore Verify</p>
          </div>

          {/* Interactive 3D scene */}
          <div className="relative h-[300px] overflow-hidden rounded-2xl border border-white/[0.07] bg-abyss/60 md:h-[400px]">
            {SPLINE_SCENE_URL ? (
              <SplineScene scene={SPLINE_SCENE_URL} className="h-full w-full" />
            ) : (
              <div className="flex h-full flex-col justify-center gap-2.5 p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">TrustLedger live layer</p>
                {FLOW.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.t} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/[0.08] text-accent ring-1 ring-inset ring-accent/20">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-white">{s.t}</span>
                        <span className="block text-xs text-slate-500">{s.d}</span>
                      </span>
                    </div>
                  );
                })}
                <p className="mt-1 text-[11px] text-slate-600">
                  Set <code className="font-mono text-slate-500">NEXT_PUBLIC_SPLINE_SCENE</code> to render the interactive 3D scene here.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.n}
              className="rounded-2xl border border-white/[0.07] bg-panel/90 p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/25"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/[0.08] text-accent ring-1 ring-inset ring-accent/20">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-mono text-xs text-slate-600">{f.n}</span>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-white">{f.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{f.desc}</p>
            </div>
          );
        })}
      </section>

      {/* Architecture */}
      <Card title="Platform architecture" sub="How trust flows through TrustLedger — each layer enforced on-chain">
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.t} className="relative">
                <div className="flex h-full items-center gap-3 rounded-xl border border-white/[0.07] bg-abyss/70 p-4 transition-colors hover:border-accent/25">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-accent ring-1 ring-inset ring-white/10">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      <span className="mr-1.5 font-mono text-[11px] text-slate-600">{i + 1}</span>
                      {s.t}
                    </span>
                    <span className="block text-xs text-slate-500">{s.d}</span>
                  </span>
                </div>
                {i < FLOW.length - 1 ? (
                  <span className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 font-mono text-accent/50 lg:block">›</span>
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          IdentityRegistry anchors who · AccessManager enforces who-can · AssetRegistry tracks what-belongs-to-whom ·
          every step emits events for the Audit Trail.
        </p>
      </Card>
    </main>
  );
}
