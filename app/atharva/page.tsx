import type { Metadata } from "next";
import PortfolioExperience from "./portfolio-experience";

export const metadata: Metadata = {
  title: "Atharva Sahu — Finance, Research & Things I Build",
  description: "A connected exploration of finance experience, mutual-fund research, projects and the ideas behind them. Atharva Sahu, Nagpur.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    title: "Atharva Sahu — Finance, Research & Things I Build",
    description: "From equipment financing to portfolio research and building financial tools.",
    type: "website",
    url: "https://fundlenz.com/atharva"
  }
};

export default function AtharvaPage() {
  return <PortfolioExperience />;
}
