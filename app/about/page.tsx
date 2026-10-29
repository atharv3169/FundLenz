import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Github, Linkedin, Mail, ScanSearch } from "lucide-react";

export const metadata: Metadata = {
  title: "Atharva Sahu | Creator of FundLenz",
  description: "About Atharva Sahu, an engineering graduate and aspiring finance postgraduate interested in building finance and investment research projects.",
};

const outline = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f8c]";

export default function AboutPage() {
  return (
    <main className="min-h-[calc(100svh-76px)]">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-7 sm:px-8 sm:pt-12">
        <nav aria-label="Page navigation" className="mb-6">
          <Link href="/" className={`inline-flex items-center gap-2 rounded-md py-2 text-sm font-medium text-[#315c73] hover:text-[#087f8c] ${outline}`}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to FundLenz
          </Link>
        </nav>

        <section className="relative overflow-hidden rounded-2xl border border-[#29485a] bg-[#102c40] px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14" aria-labelledby="creator-name">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#20636a]/30 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_270px] lg:items-end">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8adacc]">
                <ScanSearch size={16} aria-hidden="true" /> Behind FundLenz
              </p>
              <h1 id="creator-name" className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Atharva Sahu<span className="text-[#8adacc]">.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#d2e1e7] sm:text-xl">
                Engineering graduate. Aspiring finance postgraduate. Curious about what technology can make possible.
              </p>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#b7cbd5] sm:text-base">
                I&apos;m interested in building practical projects around finance, accounting, asset analysis, and investment research.
              </p>
            </div>
            <div className="rounded-xl border border-[#456575] bg-white/[0.06] p-5 backdrop-blur-sm">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-[#507c84] bg-[#244e58] text-lg font-semibold text-[#b5eee3]" aria-hidden="true">AS</div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8adacc]">Creator</p>
              <p className="mt-2 text-lg font-semibold">FundLenz</p>
              <p className="mt-2 text-sm leading-6 text-[#bfd0da]">
                An independent educational project for looking inside funds and understanding portfolio exposure.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section className="rounded-xl border border-[#dce7ee] bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#087f8c]">About me</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#193246]">Building at the intersection of finance and technology.</h2>
            <p className="mt-4 text-sm leading-7 text-[#536d7c] sm:text-base">
              My engineering background shaped how I approach problems: break them down, work with the data, and build something useful. I&apos;m now focused on expanding my knowledge of finance and exploring projects in accounting, assets, investment analysis, and financial research.
            </p>
          </section>
          <section className="rounded-xl border border-[#dce7ee] bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#087f8c]">Why FundLenz</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#193246]">Look beyond the fund name.</h2>
            <p className="mt-4 text-sm leading-7 text-[#536d7c] sm:text-base">
              Funds with different names can hold many of the same assets. I built FundLenz to make underlying holdings, concentration, and portfolio overlap easier to explore, with an emphasis on transparent data and educational analysis.
            </p>
          </section>
        </div>

        <section className="mt-5 rounded-xl border border-[#dce7ee] bg-white p-6 sm:p-8" aria-labelledby="creator-connect">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#087f8c]">Connect</p>
          <h2 id="creator-connect" className="mt-2 text-xl font-semibold text-[#193246]">Find me online</h2>
          <p className="mt-2 text-sm text-[#607987]">Project discussions, feedback, and collaborations are welcome.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="https://github.com/atharv3169" target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#c8dce3] px-4 py-2 text-sm font-medium text-[#24566a] hover:border-[#087f8c] hover:bg-[#f0f8f8] ${outline}`}>
              <Github size={17} aria-hidden="true" /> GitHub <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a href="https://www.linkedin.com/in/atharvasahu/" target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#c8dce3] px-4 py-2 text-sm font-medium text-[#24566a] hover:border-[#087f8c] hover:bg-[#f0f8f8] ${outline}`}>
              <Linkedin size={17} aria-hidden="true" /> LinkedIn <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a href="mailto:atharva@fundlenz.com" className={`inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#087f8c] px-4 py-2 text-sm font-medium text-white hover:bg-[#076976] ${outline}`}>
              <Mail size={17} aria-hidden="true" /> atharva@fundlenz.com
            </a>
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-[#dce7ee] bg-white p-6 sm:p-8" aria-labelledby="upcoming-heading">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#087f8c]">What&apos;s next</p>
              <h2 id="upcoming-heading" className="mt-2 text-xl font-semibold text-[#193246]">Upcoming Projects</h2>
              <p className="mt-2 text-sm leading-6 text-[#607987]">
                A look at finance-related ideas and research projects currently in development.
              </p>
            </div>
            <Link href="/upcoming-projects" className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#b7d5dd] px-4 py-2 text-sm font-semibold text-[#176979] hover:bg-[#eff8f9] ${outline}`}>
              View upcoming projects <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <p className="mt-6 text-center text-xs leading-6 text-[#728995]">
          FundLenz is an educational project and does not provide investment advice.
        </p>
      </div>
    </main>
  );
}
