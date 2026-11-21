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
  title: "CivicLedger — Local Voucher Clearinghouse",
  description:
    "Offline-first cryptographic voucher clearinghouse for community mutual aid. Team Run.exe — STACK 2026 (Case 2).",
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
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-screen bg-[#09090B] text-zinc-100 font-sans antialiased selection:bg-zinc-200 selection:text-zinc-950">
        {children}
      </body>
    </html>
  );
}
