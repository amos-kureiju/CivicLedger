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
  title: "CivicLedger — Kupon Sembako Wilayah Toba",
  description:
    "Aplikasi pembagian dan penukaran kupon sembako di kedai sekitar Toba yang tetap bisa dipakai saat sinyal tidak ada.",
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
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function isExt(s){return typeof s==='string'&&s.indexOf('chrome-extension://')!==-1;}window.addEventListener('error',function(e){if(isExt(e.filename)||(e.error&&isExt(e.error.stack))){e.stopImmediatePropagation();e.preventDefault();}},true);window.addEventListener('unhandledrejection',function(e){var r=e.reason;if(r&&isExt(r.stack||String(r))){e.stopImmediatePropagation();e.preventDefault();}},true);})();`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-canvas text-ink-body font-sans antialiased selection:bg-cta-bg selection:text-cta-ink transition-colors duration-200"
      >
        {children}
      </body>
    </html>
  );
}
