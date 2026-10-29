"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, Calculator, Layers3, ScanSearch, X } from "lucide-react";

const focusable = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function ProjectsDrawer() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("[data-close-projects]")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const controls = [...dialog.current.querySelectorAll<HTMLElement>(focusable)];
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="fundlenz-projects-panel"
        className="hidden min-[1024px]:inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-[#466575] bg-white/[0.06] px-3 py-2 text-xs font-semibold text-[#dce7ec] transition-colors hover:border-[#8adacc] hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]"
      >
        <Layers3 size={15} aria-hidden="true" />
        More projects
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] hidden min-[1024px]:block">
          <button type="button" aria-label="Close projects menu" tabIndex={-1}
            className="absolute inset-0 h-full w-full bg-[#091e2c]/65 backdrop-blur-[2px]"
            onClick={close} />
          <div id="fundlenz-projects-panel" ref={dialog} role="dialog" aria-modal="true"
            aria-labelledby="fundlenz-projects-heading"
            className="absolute inset-y-0 right-0 flex w-[min(390px,90vw)] flex-col overflow-y-auto border-l border-[#385d6c] bg-[#102c40] px-7 py-7 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8adacc]">
                  <Layers3 size={14} aria-hidden="true" /> FundLenz projects
                </div>
                <h2 id="fundlenz-projects-heading" className="text-2xl font-semibold tracking-tight">Explore more tools.</h2>
                <p className="mt-2 text-sm leading-6 text-[#b6ccd5]">Independent experiments in finance and technology.</p>
              </div>
              <button type="button" data-close-projects aria-label="Close projects menu"
                onClick={close}
                className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md border border-[#456778] text-[#dce7ec] hover:bg-[#25495a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="FundLenz projects" className="mt-9 grid gap-3">
              <Link href="/" onClick={close}
                className="group flex items-start gap-4 rounded-xl border border-[#3b6873] bg-[#234d57] p-4 transition hover:border-[#8adacc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#366676] text-[#b6f1e6]">
                  <ScanSearch size={21} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#93d9cb]">01 · Default tool</span>
                  <span className="mt-1 block text-base font-semibold text-white">Portfolio Lab</span>
                  <span className="mt-1 block text-xs leading-5 text-[#bfd0d9]">Explore fund holdings, overlap and portfolio concentration.</span>
                </div>
                <ArrowRight size={16} aria-hidden="true" className="mt-4 shrink-0 text-[#a3d7cc] transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/fincalc" onClick={close}
                className="group flex items-start gap-4 rounded-xl border border-[#385766] bg-white/[0.045] p-4 transition hover:border-[#8adacc] hover:bg-[#24495a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#23485b] text-[#a9d9dc]">
                  <Calculator size={21} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#97bdcc]">02 · Financial calculator</span>
                  <span className="mt-1 block text-base font-semibold text-white">FinCalc</span>
                  <span className="mt-1 block text-xs leading-5 text-[#b6cad5]">Compound interest, EMI, CAGR, present value and loan schedules.</span>
                </div>
                <ArrowRight size={16} aria-hidden="true" className="mt-4 shrink-0 text-[#a3d7cc] transition group-hover:translate-x-0.5" />
              </Link>
            </nav>
            <div className="mt-auto border-t border-[#355569] pt-5 text-xs leading-6 text-[#8fabb9]">
              More finance projects may be added here as they are developed.
            </div>
          </div>
        </div>, document.body
      )}
    </>
  );
}
