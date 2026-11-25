import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CivicLedger — Lembaga Kliring Voucher Bantuan Komunitas",
  description:
    "Platform kliring voucher pangan lokal berbasis offline-first untuk bantuan gotong royong warga. Tim Run.exe — STACK 2026 (Kasus 2).",
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
    <html
      lang="id"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function isExt(s){return typeof s==='string'&&s.indexOf('chrome-extension://')!==-1;}window.addEventListener('error',function(e){if(isExt(e.filename)||(e.error&&isExt(e.error.stack))){e.stopImmediatePropagation();e.preventDefault();}},true);window.addEventListener('unhandledrejection',function(e){var r=e.reason;if(r&&isExt(r.stack||String(r))){e.stopImmediatePropagation();e.preventDefault();}},true);})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#F7F7F8] text-zinc-900 dark:bg-[#09090B] dark:text-zinc-100 font-sans antialiased selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-200 dark:selection:text-zinc-950 transition-colors duration-150">
        {children}
      </body>
    </html>
  );
}
