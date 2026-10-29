"use client";

import { useEffect, useRef, useState } from "react";

export function FinCalcFrame() {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1200);
  useEffect(() => {
    const node = iframe.current;
    if (!node) return;
    let observer: ResizeObserver | null = null;
    function measure() {
      try {
        const doc = node?.contentDocument;
        if (!doc) return;
        const next = Math.max(doc.body?.scrollHeight ?? 0, doc.documentElement.scrollHeight);
        if (next > 100) setHeight(Math.min(4000, next + 8));
      } catch {
        // Retain a usable scrolling fallback if the origin changes unexpectedly.
      }
    }
    function loaded() {
      observer?.disconnect();
      measure();
      const body = node?.contentDocument?.body;
      if (body && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(measure);
        observer.observe(body);
      }
    }
    node.addEventListener("load", loaded);
    if (node.contentDocument?.readyState === "complete") loaded();
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      node.removeEventListener("load", loaded);
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <iframe
      ref={iframe}
      title="FinCalc — financial calculator"
      src="/projects/fincalc/index.html"
      loading="eager"
      className="block w-full border-0"
      style={{ height }}
    />
  );
}
