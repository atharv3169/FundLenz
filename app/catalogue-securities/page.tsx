import type { Metadata } from "next";
import SecuritiesCatalog from "@/components/securities-catalog";
export const metadata: Metadata = { title: "Stocks & Bonds Catalogue | FundLenz", description: "Search dated exchange listings and individually identified bonds from official fund disclosures, with security identifiers and source records." };
export default function SecuritiesPage() { return <SecuritiesCatalog />; }
