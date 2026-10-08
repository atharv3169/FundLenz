import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "FundLenz — See what your funds really hold",
  description: "Explore Indian and international fund catalogues and inspect verified US ETF and Indian mutual fund holdings in the FundLenz portfolio lab by Atharva Sahu.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <footer className="legal-footer" aria-label="FundLenz legal information">
          <nav aria-label="Legal links">
            <Link href="/privacy">Privacy Policy</Link>
            <span aria-hidden="true">·</span>
            <Link href="/terms">Terms of Service</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
