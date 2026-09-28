"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { TX_STAGE_LABEL, type TxStage, shortHash, txStageHint } from "@/lib/format";
import { ACCESS_ADDR, ASSET_ADDR, IDENTITY_ADDR, isAddressConfigured } from "@/lib/config";

/* ---------- Cards ---------- */

export function Card({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-panel/90 p-5 shadow-card transition-colors hover:border-white/[0.12]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-white">{title}</h2>
          {sub ? <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{sub}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ kicker, title, desc }: { kicker: string; title: string; desc: string }) {
  return (
    <div className="animate-fade-up">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/90">{kicker}</p>
      <h1 className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight text-white">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-panel/90 p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/25">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        {icon ? <span className="text-slate-500">{icon}</span> : null}
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight text-white">{value}</div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

/* ---------- Badges ---------- */

type Tone = "green" | "red" | "amber" | "slate" | "blue" | "cyan" | "violet";

const TONES: Record<Tone, string> = {
  green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  red: "border-red-400/20 bg-red-400/10 text-red-300",
  amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  slate: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  blue: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  cyan: "border-accent/25 bg-accent/10 text-accent",
  violet: "border-viol/25 bg-viol/10 text-violet-300"
};

export function Badge({ tone, children, pulse }: { tone: Tone; children: ReactNode; pulse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${TONES[tone]}`}>
      {pulse ? <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <span className="relative flex h-2 w-2">
        <span className={`absolute h-full w-full animate-pulse-dot rounded-full ${on ? "bg-emerald-400" : "bg-slate-500"}`} />
      </span>
      <span className={on ? "text-emerald-300" : "text-slate-400"}>{label}</span>
    </span>
  );
}

/* ---------- READ vs WRITE tags ---------- */

export function ReadTag() {
  return <Badge tone="slate">READ-ONLY</Badge>;
}

export function WriteTag() {
  return <Badge tone="violet">ON-CHAIN WRITE</Badge>;
}

/* ---------- Forms & buttons ---------- */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-slate-300">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint ? <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-white/10 bg-abyss px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#04121a] shadow-glow transition-all hover:bg-cyan-400 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50";

/* ---------- Transaction status ---------- */

export function TxStatus({ stage, hash, error }: { stage: TxStage; hash?: string | null; error?: string | null }) {
  const tone: Tone = stage === "confirmed" ? "green" : stage === "failed" ? "red" : stage === "ready" ? "slate" : "amber";
  const busy = stage === "confirm" || stage === "pending";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-abyss/80 px-3.5 py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-slate-300">
          {busy ? <Spinner className="h-3.5 w-3.5 text-amber-300" /> : null}
          Status
        </span>
        <Badge tone={tone}>{TX_STAGE_LABEL[stage]}</Badge>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{txStageHint(stage)}</p>
      {hash ? (
        <p className="mt-1.5 break-all text-xs text-slate-400">
          Tx hash: <code className="font-mono text-slate-300">{hash}</code>{" "}
          <span className="text-slate-600">({shortHash(hash)})</span>
        </p>
      ) : null}
      {error ? <p className="mt-1.5 text-xs leading-relaxed text-red-300">{error}</p> : null}
    </div>
  );
}

/* ---------- Compact config banner ---------- */

export function ConfigNotice() {
  const [open, setOpen] = useState(false);
  const missing: string[] = [];
  if (!isAddressConfigured(IDENTITY_ADDR)) missing.push("NEXT_PUBLIC_IDENTITY_ADDR");
  if (!isAddressConfigured(ACCESS_ADDR)) missing.push("NEXT_PUBLIC_ACCESS_ADDR");
  if (!isAddressConfigured(ASSET_ADDR)) missing.push("NEXT_PUBLIC_ASSET_ADDR");
  if (missing.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5 text-sm">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2.5 text-left">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
        <span className="font-medium text-amber-200">Contract configuration required</span>
        <span className="hidden text-xs text-amber-200/60 sm:inline">Identity · Access · Assets</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-amber-200/70">
          Configuration details
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open ? (
        <p className="mt-2 border-t border-amber-400/10 pt-2 text-xs leading-relaxed text-amber-200/80">
          Missing: <code className="font-mono">{missing.join(", ")}</code>. Run{" "}
          <code className="font-mono">npx hardhat run scripts/deploy.ts --network localhost</code>, copy the addresses into{" "}
          <code className="font-mono">.env.local</code>, and restart the app.
        </p>
      ) : null}
    </div>
  );
}
