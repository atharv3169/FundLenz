"use client";

import { useState, type MouseEvent } from "react";
import { ChevronRight } from "lucide-react";
import type { Exposure } from "@/lib/finance";

const INITIAL_ROWS = 60;
const PAGE_ROWS = 60;

/** Keep large holdings lists out of the DOM until their sector is expanded. */
export function SectorExposureGroup({
  sector, stocks, color, money,
}: {
  sector: { name: string; weight: number; value: number };
  stocks: Exposure[];
  color: string;
  money: (value: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);
  // Only scan the stock collection when the user opens this sector.
  const matches = expanded ? stocks.filter(stock => stock.sector === sector.name) : [];
  function toggle(event: MouseEvent<HTMLElement>) {
    event.preventDefault(); // React owns open/close, including keyboard-triggered clicks.
    if (expanded) setVisibleCount(INITIAL_ROWS);
    setExpanded(value => !value);
  }
  const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
  return <details className="sector-group" data-sector={sector.name} open={expanded}>
    <summary className="sector-row" aria-expanded={expanded} onClick={toggle}>
      <span>{sector.name}</span>
      <div className="bar-track"><div style={{ width: `${sector.weight * 100}%`, background: color }} /></div>
      <strong>{pct(sector.weight)}</strong><ChevronRight size={14} aria-hidden="true" />
    </summary>
    {expanded && <>
      <ul className="sector-stocks" aria-label={`${sector.name} stocks`}>
        {matches.slice(0, visibleCount).map(stock => <li key={stock.id}>
          <span><strong>{stock.name}</strong><small>{stock.id}</small></span>
          <span className="sector-stock-value"><strong>{pct(stock.weight)}</strong><small>{money(stock.value)}</small></span>
        </li>)}
      </ul>
      {matches.length > visibleCount && <button type="button" className="sector-show-more"
        onClick={() => setVisibleCount(n => Math.min(n + PAGE_ROWS, matches.length))}>
        Show more stocks ({Math.min(visibleCount, matches.length)} of {matches.length})
      </button>}
    </>}
  </details>;
}
