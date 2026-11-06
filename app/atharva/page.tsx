import type { Metadata } from "next";
import PortfolioExperience from "./portfolio-v2";
import "./route.css";

export const metadata: Metadata = {
  title: "Atharva Sahu — Finance, Research & Things I Build",
  description: "A collection of finance stories, independent research, engineering experiments and interactive tools by Atharva Sahu.",
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
