"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  FileSearch,
  Fingerprint,
  LayoutDashboard,
  Menu,
  ScrollText,
  ShieldCheck,
  Stamp,
  Wallet,
  X
} from "lucide-react";
import { CHAIN_ID, NETWORK_NAME, chainLabel } from "@/lib/config";
import { shortAddress } from "@/lib/format";
import { useWallet } from "./WalletProvider";
import { Spinner } from "./ui";
const LINKS = [
  { href: "/dashboard", label: "Dashboard", desc: "System overview and actions", icon: LayoutDashboard },
  { href: "/identities", label: "Identity", desc: "Manage on-chain identities", icon: Fingerprint },
  { href: "/access", label: "Access", desc: "Manage roles & permissions", icon: ShieldCheck },
  { href: "/assets", label: "Assets", desc: "Manage digital ownership", icon: Stamp },
  { href: "/verify", label: "Verify", desc: "Verify identity & ownership", icon: FileSearch },
  { href: "/audit", label: "Audit", desc: "View blockchain activity", icon: ScrollText }
];

export function Header() {
  const { address, chainId, connecting, error, hasProvider, isWrongNetwork, connect, disconnect, switchNetwork } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const path = usePathname();
  const chainOk = chainId === null || chainId === CHAIN_ID;

  async function onSwitch() {
    if (switching) return;
    setSwitching(true);
    try {
      await switchNetwork();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-void/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-accent ring-1 ring-inset ring-accent/30">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <span className="leading-none">
            <span className="block text-[15px] font-bold tracking-tight text-white">TrustLedger</span>
            <span className="mt-0.5 block text-[10px] font-medium tracking-[0.14em] text-slate-500">SIH 2026 • PS 26125</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-0.5 lg:flex">
          {LINKS.map((l) => {
            const active = path === l.href;
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                title={l.desc}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  active ? "bg-accent/10 text-accent" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2.5 md:flex">
          <span
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
              address && chainOk
                ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-slate-400"
            }`}
            title={address ? `Chain ${chainId}` : "Wallet not connected"}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className={`absolute h-full w-full rounded-full ${address && chainOk ? "animate-pulse-dot bg-emerald-400" : "bg-slate-500"}`} />
            </span>
            <span className="font-semibold">{address ? (chainOk ? "Local Blockchain" : "Wrong Network") : "Offline"}</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono">{address ? chainLabel(chainId) : "No chain"}</span>
          </span>

          {address ? (
            <div className="flex items-center gap-1.5">
              <code className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-xs text-slate-200" title={address}>
                {shortAddress(address)}
              </code>
              <button
                onClick={disconnect}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-1.5 text-[13px] font-semibold text-[#04121a] shadow-glow transition-all hover:bg-cyan-400 disabled:opacity-50 disabled:shadow-none"
            >
              {connecting ? <Spinner className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
              {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="ml-auto rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {menuOpen ? (
        <nav className="border-t border-white/[0.07] px-4 py-3 lg:hidden">
          <div className="grid gap-1">
            {LINKS.map((l) => {
              const active = path === l.href;
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  title={l.desc}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    active ? "bg-accent/10 text-accent" : "text-slate-400 hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {l.label}
                </Link>
              );
            })}
            <div className="mt-2 flex items-center gap-2 border-t border-white/[0.07] pt-3 md:hidden">
              {address ? (
                <>
                  <code className="flex-1 truncate rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-slate-200">
                    {shortAddress(address)}
                  </code>
                  <button onClick={disconnect} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400">
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={connect}
                  disabled={connecting}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-[#04121a] disabled:opacity-50"
                >
                  {connecting ? <Spinner className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                  {connecting ? "Connecting…" : "Connect Wallet"}
                </button>
              )}
            </div>
          </div>
        </nav>
      ) : null}

      {!hasProvider || error || isWrongNetwork ? (
        <div className="border-t border-white/[0.07] px-4 py-1.5 text-center text-xs">
          {!hasProvider ? (
            <span className="text-amber-200/90">
              No Web3 wallet detected — install MetaMask and use Localhost 31337 or Sepolia testnet to interact.
            </span>
          ) : isWrongNetwork ? (
            <span className="inline-flex flex-wrap items-center justify-center gap-2 text-amber-200/90">
              <span className="font-semibold">Wrong Network</span>
              <span className="text-amber-200/60">TrustLedger requires {NETWORK_NAME} · Chain ID {CHAIN_ID}</span>
              <button
                onClick={onSwitch}
                disabled={switching}
                className="inline-flex items-center gap-1 rounded-md border border-amber-300/30 bg-amber-300/10 px-2.5 py-0.5 font-semibold text-amber-100 transition-colors hover:bg-amber-300/20 disabled:opacity-50"
              >
                {switching ? <Spinner className="h-3 w-3" /> : null}
                {switching ? "Switching…" : "Switch Network"}
              </button>
            </span>
          ) : (
            <span className="text-red-300/90">{error}</span>
          )}
        </div>
      ) : null}
    </header>
  );
}
