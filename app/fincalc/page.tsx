import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ScanSearch } from "lucide-react";
import { ProjectsDrawer } from "@/components/projects-drawer";
import { FinCalcFrame } from "@/components/fincalc-frame";

export const metadata: Metadata = {
  title: "FinCalc | Financial Calculator | FundLenz",
  description: "Explore compound interest, loan EMI and repayment schedules, investment CAGR, and present value with FinCalc by Atharva Sahu.",
};

export default function FinCalcPage() {
  return (
    <main className="min-h-screen bg-[#f3f6f9]">
      <header className="masthead fincalc-header">
        <Link href="/" aria-label="FundLenz portfolio lab home" className="brand focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">
          <span className="brand-mark"><ScanSearch size={25} strokeWidth={1.7} aria-hidden="true" /></span>
          Fund<span>Lenz</span><span className="brand-divider" /><small>FINCALC</small>
        </Link>
        <div className="masthead-right">
          <Link href="/catalogue-global" className="catalog-nav-link">Catalogue</Link>
          <Link href="/blogpost" className="catalog-nav-link lab-blog-link">Blog</Link>
          <ProjectsDrawer />
          <span className="project-credit inline-flex items-center gap-1.5 whitespace-nowrap">
            A project by <Link href="/about" className="font-medium text-[#dce7ec] underline decoration-[#9ab5c2] underline-offset-[3px] hover:text-[#8adacc] hover:decoration-[#8adacc] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">Atharva Sahu</Link>
            
          </span>
          <Link href="/" className="catalog-nav-link masthead-action inline-flex items-center gap-2 transition-colors hover:border-[#8adacc] hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">
            <ArrowLeft size={14} aria-hidden="true" /> Portfolio Lab
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1536px]">
        <FinCalcFrame />
      </div>
    </main>
  );
}
