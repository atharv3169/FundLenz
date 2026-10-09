"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { LEGAL_CAPTURE_EVENT, LEGAL_SOURCE_KEY, validLegalSource } from "@/lib/legal-navigation-state";

export function LegalLink({ href, children, className }: {
  href: "/privacy" | "/terms"; children: ReactNode; className?: string;
}) {
  function capture(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.altKey || event.shiftKey) return;
    // Give the portfolio lab a chance to snapshot its current tool/input state.
    window.dispatchEvent(new Event(LEGAL_CAPTURE_EVENT));
    try {
      window.sessionStorage.setItem(LEGAL_SOURCE_KEY, JSON.stringify({
        from: location.pathname + location.search + location.hash,
        to: href, at: Date.now(),
      }));
    } catch { /* Session storage can be blocked; history fallback remains available. */ }
  }
  return <Link href={href} onClick={capture} className={className}>{children}</Link>;
}

export function LegalBackLink() {
  const router = useRouter();
  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    let previousIsLocal = false;
    try {
      const raw = sessionStorage.getItem(LEGAL_SOURCE_KEY);
      previousIsLocal = validLegalSource(raw ? JSON.parse(raw) : null, location.pathname);
    } catch { /* Malformed/unavailable storage must not break the back action. */ }
    if (!previousIsLocal) {
      try {
        const referrer = new URL(document.referrer);
        previousIsLocal = referrer.origin === location.origin &&
          referrer.pathname !== location.pathname;
      } catch { /* Direct entries have no safe prior in-site page. */ }
    }
    if (previousIsLocal && history.length > 1) router.back();
    else router.replace("/");
  }
  // The href is a functional fallback for no-JavaScript/direct visits.
  return <a href="/" className="legal-home-link" onClick={goBack}
    aria-label="Back to previous page">← Back</a>;
}
