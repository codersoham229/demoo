import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { Header } from "@/components/Header";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "TrustLedger — SIH 26125 Blockchain Identity, Access & Assets",
  description:
    "Prototype platform for blockchain-based identity, role-based access control, and digital asset management. Test networks and synthetic data only."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <WalletProvider>
          <Header />
          <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">{children}</div>
          <footer className="border-t border-white/[0.06]">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-5 text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-600" />
              <span>TrustLedger · SIH 2026 · Problem Statement 26125 prototype</span>
              <span className="text-slate-700">·</span>
              <span>Test networks + synthetic data only · No real personal data · Never share private keys</span>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
