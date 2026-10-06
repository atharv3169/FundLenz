import type { Metadata } from "next";
import GlobalCatalog from "@/components/global-catalog";
export const metadata: Metadata = { title: "International Fund & ETF Catalogue | FundLenz", description: "Explore overseas fund series, share classes and ETFs using official regulatory, exchange and issuer sources. Search by name, ticker or ISIN." };
export default function InternationalFundsPage() { return <GlobalCatalog />; }
