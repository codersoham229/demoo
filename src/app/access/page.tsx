"use client";

import { ethers } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { Crown, FileSearch, Stamp, Wallet } from "lucide-react";
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
import { getAccessWrite, readRoles, type RoleStatus } from "@/lib/contracts";
import { fetchAuditEvents, type AuditRecord } from "@/lib/audit";
import { pushRecentTx } from "@/lib/txhistory";

const ROLES = [
  { key: "admin", label: "ADMIN", icon: Crown, tone: "violet" as const, desc: "Platform administration" },
  { key: "issuer", label: "ISSUER", icon: Stamp, tone: "cyan" as const, desc: "Can anchor / manage authorized identities" },
  { key: "verifier", label: "VERIFIER", icon: FileSearch, tone: "blue" as const, desc: "Can verify identities" }
];

export default function AccessPage() {
  const { address, signer, connect, connecting } = useWallet();
  const [target, setTarget] = useState("");
  const [targetRoles, setTargetRoles] = useState<RoleStatus | null>(null);
  const [myRoles, setMyRoles] = useState<RoleStatus | null>(null);
  const [stage, setStage] = useState<TxStage>("ready");
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [events, setEvents] = useState<AuditRecord[] | null>(null);
  const configured = contractsConfigured();
  const isAdmin = myRoles?.admin === true;

  async function refreshMine() {
    if (!address || !configured) return;
    try {
      setMyRoles(await readRoles(address));
    } catch {
      /* keep null */
    }
  }

  useEffect(() => {
    refreshMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (!configured) {
      setEvents(null);
      return;
    }
    let cancelled = false;
    fetchAuditEvents()
      .then((all) => {
        if (!cancelled) setEvents(all.filter((r) => r.category === "Access"));
      })
      .catch(() => {
        if (!cancelled) setEvents(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grantInfo = useMemo(() => {
    if (!events || !ethers.isAddress(target)) return null;
    const t = target.toLowerCase();
    const grants = events.filter(
      (e) => (e.event === "RoleGrantedLogged" || e.event === "RoleGranted") && (e.related ?? "").toLowerCase() === t
    );
    if (grants.length === 0) return null;
    const latest = grants.reduce((a, b) => (b.blockNumber > a.blockNumber ? b : a));
    return { count: grants.length, at: latest.timestamp, block: latest.blockNumber };
  }, [events, target]);

  async function checkTargetFor(wallet: string) {
    if (!ethers.isAddress(wallet) || !configured) return;
    setReading(true);
    setError(null);
    try {
      setTargetRoles(await readRoles(wallet));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setReading(false);
    }
  }

  async function checkTarget() {
    if (!ethers.isAddress(target)) {
      setError("Enter a valid 0x wallet address to check.");
      return;
    }
    await checkTargetFor(target);
  }

  async function act(kind: "grantIssuer" | "revokeIssuer" | "grantVerifier" | "revokeVerifier") {
    setError(null);
    setHash(null);
    if (!signer) {
      setError("Connect an admin wallet first.");
      return;
    }
    if (!isAdmin) {
      setError("Your connected wallet is not an Admin, so it cannot grant or revoke roles. Connect the deployer/admin wallet.");
      return;
    }
    if (!ethers.isAddress(target)) {
      setError("Enter a valid 0x wallet address first.");
      return;
    }
    setStage("confirm");
    setBusy(kind);
    try {
      const c = getAccessWrite(signer);
      const tx = await c[kind](target);
      setHash(tx.hash as string);
      setStage("pending");
      await tx.wait();
      setStage("confirmed");
      pushRecentTx({ hash: tx.hash as string, label: `Access ${kind}`, at: new Date().toISOString() });
      await checkTargetFor(target);
      await refreshMine();
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
        kicker="Access"
        title="Manage platform roles and permissions"
        desc="Control who can issue identities and verify users. Only Admin wallets can grant or revoke."
      />
      <ConfigNotice />

      {/* Role cards */}
      <section className="grid gap-4 md:grid-cols-3">
        {ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.key} className="rounded-2xl border border-white/[0.07] bg-panel/90 p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/25">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/[0.08] text-accent ring-1 ring-inset ring-accent/20">
                  <Icon className="h-5 w-5" />
                </span>
                <Badge tone={r.tone}>{r.label}</Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{r.desc}</p>
            </div>
          );
        })}
      </section>

      {/* Grant / revoke */}
      <Card title="Grant / Revoke Role" sub={isAdmin ? "Your wallet is an Admin — changes allowed" : "Checking authority from your connected wallet"} action={<WriteTag />}>
        {!address ? (
          <button onClick={connect} disabled={connecting} className={btnPrimary}>
            {connecting ? <Spinner className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        ) : !isAdmin ? (
          <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5 text-[13px] leading-relaxed text-amber-200/90">
            Your wallet is not an Admin, so granting is disabled. You can still look up any role holder below — or reconnect
            with the deployer wallet to make changes.
          </p>
        ) : null}
        <div className="rounded-xl border border-white/[0.06] bg-abyss/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Transaction Signer</p>
          <p className="mt-1.5 font-mono text-sm text-slate-200" title={address ?? ""}>
            {address ? shortAddress(address) : "Not connected — connect a wallet to sign"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            The connected wallet signs this transaction. Enter the wallet whose role should be changed.
          </p>
        </div>
        <div className="mt-3 grid gap-3.5 md:grid-cols-[1fr_auto] md:items-end">
          <Field label="Target Wallet" hint="Wallet receiving or losing the role — starts empty, never auto-filled.">
            <input className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Enter wallet address" />
          </Field>
          <button onClick={checkTarget} disabled={!configured || reading} className={btnSecondary}>
            {reading ? <Spinner className="h-4 w-4" /> : null} Look up
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => act("grantIssuer")} disabled={!signer || !isAdmin || !configured || busy !== null} className={btnPrimary}>
            {busy === "grantIssuer" ? <Spinner className="h-4 w-4" /> : null} Grant Issuer
          </button>
          <button onClick={() => act("revokeIssuer")} disabled={!signer || !isAdmin || !configured || busy !== null} className={btnDanger}>
            {busy === "revokeIssuer" ? <Spinner className="h-4 w-4" /> : null} Revoke Issuer
          </button>
          <button onClick={() => act("grantVerifier")} disabled={!signer || !isAdmin || !configured || busy !== null} className={btnPrimary}>
            {busy === "grantVerifier" ? <Spinner className="h-4 w-4" /> : null} Grant Verifier
          </button>
          <button onClick={() => act("revokeVerifier")} disabled={!signer || !isAdmin || !configured || busy !== null} className={btnDanger}>
            {busy === "revokeVerifier" ? <Spinner className="h-4 w-4" /> : null} Revoke Verifier
          </button>
        </div>
        <div className="mt-4"><TxStatus stage={stage} hash={hash} error={error} /></div>
      </Card>

      {/* Role holders */}
      <Card title="Role holders" sub="Live status of the target wallet" action={<ReadTag />}>
        {reading ? <p className="flex items-center gap-2 text-sm text-slate-500"><Spinner className="h-4 w-4" /> Reading…</p>
        : !targetRoles ? <p className="text-sm text-slate-500">Enter a wallet address and press “Look up”.</p>
        : (
          <div className="space-y-2.5">
            <p className="font-mono text-xs text-slate-400" title={target}>{shortAddress(target)}</p>
            {(
              [
                ["Admin", targetRoles.admin, "violet"],
                ["Issuer", targetRoles.issuer, "cyan"],
                ["Verifier", targetRoles.verifier, "blue"]
              ] as const
            ).map(([label, holds, tone]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-abyss/60 px-4 py-2.5 text-sm">
                <span className="font-medium text-slate-200">{label}</span>
                <Badge tone={holds ? tone : "slate"}>{holds ? "Active holder" : "Not held"}</Badge>
              </div>
            ))}
            <p className="pt-1 text-xs text-slate-500">
              On-chain history:{" "}
              {grantInfo && grantInfo.at !== null
                ? `${grantInfo.count} grant event${grantInfo.count === 1 ? "" : "s"} · latest block #${grantInfo.block} · ${new Date(grantInfo.at * 1000).toLocaleString()}`
                : grantInfo
                  ? `${grantInfo.count} grant event${grantInfo.count === 1 ? "" : "s"} · timestamp unavailable`
                  : "no grant events found for this wallet"}
            </p>
          </div>
        )}
      </Card>
    </main>
  );
}
