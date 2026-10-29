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
      <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-[#294759] bg-[#102c40] px-4 py-3 text-white sm:px-9">
        <Link href="/" aria-label="FundLenz portfolio lab home"
          className="inline-flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#456778] bg-[#254759] text-[#8adacc]">
            <ScanSearch size={20} aria-hidden="true" />
          </span> Fund<span className="-ml-2 font-normal text-[#8adacc]">Lenz</span>
          <span className="ml-3 hidden border-l border-[#476878] pl-3 text-[11px] font-semibold tracking-widest text-[#a9c0ca] sm:inline">FINCALC</span>
        </Link>
        <div className="flex items-center gap-3">
          <ProjectsDrawer />
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#466575] px-3 text-xs font-medium text-[#dce7ec] hover:border-[#8adacc] hover:text-[#8adacc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">
            <ArrowLeft size={15} aria-hidden="true" /> Portfolio Lab
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
