import type { Metadata } from "next";
import { LegalLink } from "@/components/legal-navigation";
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
            <LegalLink href="/privacy">Privacy Policy</LegalLink>
            <span aria-hidden="true">·</span>
            <LegalLink href="/terms">Terms of Service</LegalLink>
          </nav>
        </footer>
      </body>
    </html>
  );
}
