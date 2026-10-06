import type { Metadata } from "next";
import FundCatalog from "@/components/fund-catalog";
export const metadata: Metadata = { title: "Indian Mutual Fund Catalogue | FundLenz", description: "Search the complete AMFI NAV snapshot, inspect dated official portfolios, and analyse mutual fund holdings with FundLenz." };
export default function FundsPage() { return <FundCatalog />; }
