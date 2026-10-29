import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Calculator, ScanSearch } from "lucide-react";
import { ProjectsDrawer } from "@/components/projects-drawer";
import { FinCalcFrame } from "@/components/fincalc-frame";

export const metadata: Metadata = {
  title: "FinCalc | Financial Calculator | FundLenz",
  description: "Explore compound interest, loan EMI and repayment schedules, investment CAGR, and present value with FinCalc by Atharva Sahu.",
};

export default function FinCalcPage() {
  return (
    <main className="min-h-screen bg-[#f3f6f9]">
      <header className="masthead">
        <Link href="/" aria-label="FundLenz portfolio lab home" className="brand focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">
          <span className="brand-mark"><ScanSearch size={25} strokeWidth={1.7} aria-hidden="true" /></span>
          Fund<span>Lenz</span><span className="brand-divider" /><small>FINCALC</small>
        </Link>
        <div className="masthead-right">
          <ProjectsDrawer />
          <Link href="/" className="catalog-nav-link inline-flex items-center gap-2 transition-colors hover:border-[#8adacc] hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">
            <ArrowLeft size={14} aria-hidden="true" /> Portfolio Lab
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1480px]">
        <div className="flex items-center gap-2 px-5 pt-5 text-xs font-semibold text-[#607f90] sm:px-9">
          <Calculator size={15} aria-hidden="true" /> Independent financial mathematics tools
        </div>
        <FinCalcFrame />
      </div>
    </main>
  );
}
