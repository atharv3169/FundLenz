import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Github, Mail, ScanSearch } from "lucide-react";

export const metadata: Metadata = {
  title: "Atharva Sahu | About the Creator of FundLenz",
  description: "Meet Atharva Sahu, the creator of FundLenz, and learn why he built an independent educational portfolio research project.",
};

export default function AboutPage() {
  return (
    <main className="min-h-[calc(100svh-76px)]">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-7 sm:px-8 sm:pt-12">
        <nav aria-label="Back to FundLenz" className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 rounded-md py-2 text-sm font-medium text-[#315c73] hover:text-[#087f8c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f8c]">
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
                I work at the intersection of finance, investment research, and technology.
              </p>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#b7cbd5] sm:text-base">
                I created FundLenz to make it easier to look beyond a fund&apos;s name and understand what is actually inside a portfolio.
              </p>
            </div>
            <div className="rounded-xl border border-[#456575] bg-white/[0.06] p-5 backdrop-blur-sm">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-[#507c84] bg-[#244e58] text-lg font-semibold text-[#b5eee3]" aria-hidden="true">AS</div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8adacc]">Independent project</p>
              <p className="mt-2 text-lg font-semibold">FundLenz</p>
              <p className="mt-2 text-sm leading-6 text-[#bfd0da]">An educational research platform for exploring fund holdings, portfolio overlap, and concentration.</p>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section className="rounded-xl border border-[#dce7ee] bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#087f8c]">A little about me</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#193246]">Curious about the numbers behind decisions.</h2>
            <p className="mt-4 text-sm leading-7 text-[#536d7c] sm:text-base">
              My background brings together engineering, financial analysis, and quantitative research. I enjoy building practical tools that make complicated financial information easier to explore and understand.
            </p>
          </section>

          <section className="rounded-xl border border-[#dce7ee] bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#087f8c]">Why I built it</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#193246]">Transparency should be useful.</h2>
            <p className="mt-4 text-sm leading-7 text-[#536d7c] sm:text-base">
              Two funds can have different names and still own many of the same securities. FundLenz helps make those underlying holdings visible, so people can investigate exposure and overlap for themselves.
            </p>
          </section>
        </div>

        <section className="mt-5 flex flex-col gap-5 rounded-xl border border-[#dce7ee] bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8" aria-labelledby="creator-connect">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#087f8c]">Get in touch</p>
            <h2 id="creator-connect" className="mt-2 text-xl font-semibold text-[#193246]">Explore the project or say hello.</h2>
            <p className="mt-2 text-sm text-[#607987]">Questions, feedback, and thoughtful ideas are welcome.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="https://github.com/atharv3169/FundLenz" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#c8dce3] px-4 py-2 text-sm font-medium text-[#24566a] hover:border-[#087f8c] hover:bg-[#f0f8f8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f8c]">
              <Github size={17} aria-hidden="true" /> GitHub <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a href="mailto:info@fundlenz.com" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#087f8c] px-4 py-2 text-sm font-medium text-white hover:bg-[#076976] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f8c]">
              <Mail size={17} aria-hidden="true" /> Contact
            </a>
          </div>
        </section>

        <p className="mt-6 text-center text-xs leading-6 text-[#728995]">
          FundLenz is an educational project, not an investment advisory service.
        </p>
      </div>
    </main>
  );
}
