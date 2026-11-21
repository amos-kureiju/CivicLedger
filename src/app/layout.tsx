import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:
    "CivicLedger — Resilient Local Voucher Clearinghouse for Community Mutual Aid",
  description:
    "Team Run.exe • STACK 2026 by GDGoC ITB (Case 2: Stronger Communities and Everyday Services) — Offline-first voucher clearinghouse built with React PWA, IndexedDB, Golang, and PostgreSQL.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
