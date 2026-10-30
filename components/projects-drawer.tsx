"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Calculator, Layers3, Menu, ScanSearch, X } from "lucide-react";

const focusable = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function ProjectsDrawer() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const closingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openingAnimation = useRef<Animation | null>(null);
  const closingAnimation = useRef<Animation | null>(null);
  const currentPath = usePathname();
  const isFinCalc = currentPath === "/fincalc";
  const isPortfolioLab = currentPath === "/";
  const trigger = useRef<HTMLButtonElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openingAnimation.current?.cancel();
    closingAnimation.current?.cancel();
    closingRef.current = false;
    setEntered(false);
    setClosing(false);
    setOpen(true);
  }
  function close() {
    if (closingRef.current) return; // Ignore repeated Escape/backdrop/link closes.
    closingRef.current = true;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const desktop = window.matchMedia("(min-width: 801px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const panel = dialog.current;
    if (desktop && !reduced && panel) {
      // Animate from the actual displayed position, even if opening was interrupted.
      const from = window.getComputedStyle(panel).transform;
      openingAnimation.current?.cancel();
      closingAnimation.current = panel.animate(
        [{ transform: from }, { transform: "translate3d(100%, 0, 0)" }],
        { duration: 480, easing: "cubic-bezier(.4, 0, .7, 1)", fill: "forwards" },
      );
      const backdrop = panel.parentElement?.querySelector<HTMLElement>(".projects-drawer-backdrop");
      backdrop?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 360, easing: "ease-in", fill: "forwards",
      });
    }
    setClosing(true);
    const delay = reduced ? 0 : desktop ? 480 : 240;
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closingRef.current = false;
      closingAnimation.current?.cancel();
      closingAnimation.current = null;
      closeTimer.current = null;
      const useMobileTrigger = window.matchMedia("(max-width: 800px)").matches;
      (useMobileTrigger ? mobileTrigger.current : trigger.current)?.focus();
    }, delay);
  }
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  // Animate the actual portal panel so desktop motion does not depend on
  // CSS transition timing or the mounting frame. Keep reduced-motion opt-out.
  useEffect(() => {
    if (!open) return;
    const panel = dialog.current;
    const desktop = window.matchMedia("(min-width: 801px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!panel || !desktop || reduced) {
      setEntered(true);
      return;
    }
    const opening = panel.animate(
      [{ transform: "translate3d(100%, 0, 0)" }, { transform: "translate3d(0, 0, 0)" }],
      { duration: 560, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "forwards" },
    );
    openingAnimation.current = opening;
    const backdrop = panel.parentElement?.querySelector<HTMLElement>(".projects-drawer-backdrop");
    const fade = backdrop?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 340, easing: "ease-out", fill: "forwards",
    });
    opening.onfinish = () => setEntered(true);
    return () => {
      opening.onfinish = null;
      opening.cancel();
      fade?.cancel();
      if (openingAnimation.current === opening) openingAnimation.current = null;
    };
  }, [open]);
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
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open && !closing}
        aria-controls="fundlenz-projects-panel"
        className="catalog-nav-link projects-desktop-trigger hidden min-[801px]:inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-colors hover:border-[#8adacc] hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]"
      >
        <Layers3 size={14} strokeWidth={1.8} aria-hidden="true" />
        More projects
      </button>
      <button
        ref={mobileTrigger}
        type="button"
        onClick={show}
        aria-label="Open navigation menu"
        title="Menu"
        aria-haspopup="dialog"
        aria-expanded={open && !closing}
        aria-controls="fundlenz-projects-panel"
        className="fundlenz-mobile-menu-trigger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]"
      >
        <Menu size={22} strokeWidth={1.9} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="projects-drawer-layer fixed inset-0 z-[100]" data-state={closing ? "closing" : entered ? "open" : "entering"}>
          <button type="button" aria-label="Close projects menu" tabIndex={-1}
            className="projects-drawer-backdrop absolute inset-0 h-full w-full bg-[#091e2c]/65 backdrop-blur-[2px]"
            onClick={close} />
          <div id="fundlenz-projects-panel" ref={dialog} role="dialog" aria-modal="true"
            aria-labelledby="fundlenz-projects-heading"
            className="projects-drawer-panel absolute inset-y-0 right-0 flex w-[min(380px,90vw)] flex-col overflow-y-auto bg-[#102c40] px-6 py-7 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="fundlenz-drawer-creator mb-5 text-[13px] leading-6 text-[#b6ccd5]">
                  A project by <Link href="/about" onClick={close} className="fundlenz-creator-link font-semibold text-[#e4f2f4] hover:text-[#8adacc]">Atharva Sahu</Link>
                </p>
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-[#8adacc]">
                  <Layers3 size={14} aria-hidden="true" /> FundLenz projects
                </div>
                <h2 id="fundlenz-projects-heading" className="text-xl font-semibold tracking-tight">Explore more tools.</h2>
                <p className="mt-2 text-[14px] leading-6 text-[#b6ccd5]">Independent experiments in finance and technology.</p>
              </div>
              <button type="button" data-close-projects aria-label="Close projects menu"
                onClick={close}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border-0 bg-transparent text-[#dce7ec] hover:text-[#8adacc] focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="FundLenz projects" className="mt-7 grid gap-3">
              <Link href="/" onClick={close} aria-current={isPortfolioLab ? "page" : undefined}
                className={`group flex items-start gap-3 rounded-[8px] border p-4 transition hover:border-[#8adacc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc] ${isPortfolioLab ? "border-[#537080] bg-[#234d57]" : "border-[#385766] bg-white/[0.04]"}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] bg-[#254759] text-[#b6f1e6]">
                  <ScanSearch size={18} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#93d9cb]">01 · Default tool</span>
                  <span className="mt-1 block text-[15px] font-semibold text-white">Portfolio Lab</span>
                  <span className="mt-1 block text-[13px] leading-5 text-[#bfd0d9]">Explore fund holdings, overlap and portfolio concentration.</span>
                </div>
                <ArrowRight size={16} aria-hidden="true" className="mt-4 shrink-0 text-[#a3d7cc] transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/fincalc" onClick={close} aria-current={isFinCalc ? "page" : undefined}
                className={`group flex items-start gap-3 rounded-[8px] border p-4 transition hover:border-[#8adacc] hover:bg-[#24495a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc] ${isFinCalc ? "border-[#537080] bg-[#234d57]" : "border-[#385766] bg-white/[0.04]"}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] bg-[#254759] text-[#a9d9dc]">
                  <Calculator size={18} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#97bdcc]">02 · Financial calculator</span>
                  <span className="mt-1 block text-base font-semibold text-white">FinCalc</span>
                  <span className="mt-1 block text-[13px] leading-5 text-[#b6cad5]">Compound interest, EMI, CAGR, present value and loan schedules.</span>
                </div>
                <ArrowRight size={16} aria-hidden="true" className="mt-4 shrink-0 text-[#a3d7cc] transition group-hover:translate-x-0.5" />
              </Link>
            </nav>
            <nav aria-label="Other site pages" className="fundlenz-drawer-mobile-links mt-5 border-t border-[#355569] pt-4">
              <Link href="/blogpost" onClick={close} className="flex min-h-11 items-center justify-between rounded-[7px] px-3 text-[14px] font-medium text-[#dce7ec] hover:bg-[#24495a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8adacc]">
                Blog <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </nav>
            <div className="fundlenz-drawer-footer mt-auto border-t border-[#355569] pt-5 text-[13px] leading-6 text-[#9db4c1]">
              More finance projects may be added here as they are developed.
            </div>
          </div>
        </div>, document.body
      )}
    </>
  );
}
