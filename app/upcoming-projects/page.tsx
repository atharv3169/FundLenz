import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, FlaskConical, ScanSearch, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Upcoming Projects | Atharva Sahu | FundLenz",
  description: "A look at upcoming finance and investment research projects, including a collaborative Short Trading Recommender research prototype.",
};

export default function UpcomingProjectsPage() {
  return (
    <main className="min-h-[calc(100svh-76px)]">
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-7 sm:px-8 sm:pt-12">
        <nav aria-label="Page navigation" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/about" className="inline-flex items-center gap-2 rounded-md py-2 text-sm font-medium text-[#315c73] hover:text-[#087f8c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f8c]">
            <ArrowLeft size={16} aria-hidden="true" /> Back to creator page
          </Link>
        </nav>

        <section className="relative overflow-hidden rounded-2xl border border-[#29485a] bg-[#102c40] px-6 py-10 text-white sm:px-10 sm:py-12" aria-labelledby="projects-heading">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-[#20636a]/30 blur-3xl" />
          <div className="relative">
            <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8adacc]">
              <ScanSearch size={16} aria-hidden="true" /> FundLenz · Creator
            </p>
            <h1 id="projects-heading" className="text-4xl font-semibold tracking-tight sm:text-5xl">Upcoming Projects<span className="text-[#8adacc]">.</span></h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#cadce5] sm:text-base">
              I&apos;m exploring more ways to bring together finance, investment research, and technology. This page highlights projects that are still being developed.
            </p>
          </div>
        </section>

        <section aria-labelledby="short-trading-heading" className="mt-8 overflow-hidden rounded-xl border border-[#dce7ee] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1ebf0] px-6 py-5 sm:px-8">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-[#087f8c]">
              <FlaskConical size={15} aria-hidden="true" /> Collaborative research project
            </p>
            <span className="rounded-full border border-[#c8dce3] bg-[#eff7f8] px-3 py-1 text-xs font-medium text-[#246777]">
              In development
            </span>
          </div>
          <div className="p-6 sm:p-8">
            <h2 id="short-trading-heading" className="text-2xl font-semibold tracking-tight text-[#193246] sm:text-3xl">
              Short Trading Recommender
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#536d7c] sm:text-base">
              An experimental research project exploring how market events, public disclosures, and structured analysis can help investigate potential short-side trading ideas. The focus is on understanding the evidence and risks behind a candidate, not simply producing a buy or sell signal.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-[#e0e9ee] bg-[#f7fafb] p-5">
                <BarChart3 size={20} className="text-[#087f8c]" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-[#24485c]">Research and evidence</h3>
                <p className="mt-2 text-sm leading-6 text-[#607987]">
                  Exploring event-driven candidate discovery and assessment of relevant public information.
                </p>
              </div>
              <div className="rounded-lg border border-[#e0e9ee] bg-[#f7fafb] p-5">
                <ShieldCheck size={20} className="text-[#087f8c]" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-[#24485c]">Risk-aware analysis</h3>
                <p className="mt-2 text-sm leading-6 text-[#607987]">
                  Considering uncertainty and risk checks before any candidate reaches human review.
                </p>
              </div>
            </div>
            <p className="mt-6 text-xs leading-6 text-[#718895]">
              Research prototype only. Not a live trading service, an automated brokerage system, or investment advice.
            </p>
          </div>
        </section>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <Link href="/about" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#c8dce3] px-4 py-2 text-sm font-medium text-[#24566a] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f8c]">
            <ArrowLeft size={16} aria-hidden="true" /> About the creator
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#087f8c] px-4 py-2 text-sm font-medium text-white hover:bg-[#076976] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f8c]">
            Explore FundLenz <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
