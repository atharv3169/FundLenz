'use client';
import { useMemo, useState } from 'react';
import type { Model } from '@/lib/atlas/model';
import { evaluate } from '@/lib/atlas/model';
import { csv, download } from '@/lib/atlas/files';
import { Card, Table, Num, cash, n, pct } from './ui';
type Entry = { id: string; label: string; model: Model };
export function Screener({
  entries,
  open,
}: {
  entries: Entry[];
  open: (m: Model) => void;
}) {
  const [query, filter] = useState(''),
    [basis, setBasis] = useState('All'),
    [ccy, setCurrency] = useState('All'),
    [min, setMin] = useState<number | null>(null),
    [term, maxTerm] = useState<number | null>(null),
    [sort, order] = useState('Model gap');
  const valid = useMemo(
    () =>
      entries
        .map((e) => ({ ...e, r: evaluate(e.model).r }))
        .filter((e) => e.r !== null),
    [entries],
  );
  const filtered = valid.filter(
    ({ label, model: m, r }) =>
      (!query ||
        (label + ' ' + m.name + ' ' + m.ticker)
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (ccy === 'All' || m.currency === ccy) &&
      (basis === 'All' || m.basis === basis) &&
      (min === null || (r!.gap !== null && r!.gap >= min)) &&
      (term === null ||
        (r!.terminalShare !== null && r!.terminalShare <= term)),
  );
  const rows = filtered.sort((a, b) =>
    sort === 'Company'
      ? a.label.localeCompare(b.label)
      : sort === 'Discount rate'
        ? b.r!.w - a.r!.w
        : (b.r!.gap ?? -Infinity) - (a.r!.gap ?? -Infinity),
  );
  return (
    <Card kicker="02 / Cross-model discovery" title="Model screener">
      <p>
        Screen your saved cases and worked examples against your own
        assumptions. Only completed operating valuations enter the screen.
        Market gaps refer to the price and date stored in each model.
      </p>
      <div className="a-tools">
        <input
          aria-label="Search screen results"
          placeholder="Search company or ticker…"
          type="search"
          value={query}
          onChange={(e) => filter(e.target.value)}
        />
        <label>
          Origin{' '}
          <select value={basis} onChange={(e) => setBasis(e.target.value)}>
            {['All', 'Manual', 'Filing', 'Fictional'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Currency{' '}
          <select value={ccy} onChange={(e) => setCurrency(e.target.value)}>
            {['All', 'USD', 'EUR', 'GBP', 'INR'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Sort{' '}
          <select value={sort} onChange={(e) => order(e.target.value)}>
            {['Model gap', 'Discount rate', 'Company'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="a-gridform">
        <Num label="Minimum model gap (%)" value={min} onChange={setMin} />
        <Num
          label="Maximum terminal contribution (%)"
          value={term}
          onChange={maxTerm}
        />
      </div>
      <p>
        {rows.length} matching valuations · {entries.length - valid.length}{' '}
        incomplete entries excluded.
      </p>
      <Table
        heads={[
          'Model',
          'Origin',
          'Value / share',
          'Model gap',
          'WACC',
          'Terminal share',
          'Price date',
          '',
        ]}
        rows={rows.map((e) => [
          e.label,
          e.model.basis,
          cash(e.r!.perShare, e.model.currency),
          pct(e.r!.gap),
          pct(e.r!.w),
          pct(e.r!.terminalShare),
          e.model.priceDate || 'Unknown',
          <button key={e.id} className="a-link" onClick={() => open(e.model)}>
            Open model
          </button>,
        ])}
      />
      {!rows.length && (
        <p className="a-note">
          No completed valuations match. Clear a filter or save another case.
        </p>
      )}
      <button
        className="a-btn"
        disabled={!rows.length}
        onClick={() =>
          download(
            'atlas-model-screen.csv',
            csv([
              [
                'Case',
                'Ticker',
                'Origin',
                'Currency',
                'Value/share',
                'Price',
                'Price date',
                'Gap %',
                'WACC %',
                'Terminal PV / EV %',
              ],
              ...rows.map((e) => [
                e.label,
                e.model.ticker,
                e.model.basis,
                e.model.currency,
                e.r!.perShare,
                e.model.inputs.price,
                e.model.priceDate,
                e.r!.gap,
                e.r!.w,
                e.r!.terminalShare,
              ]),
            ]),
            'text/csv',
          )
        }
      >
        Export {n(rows.length, 0)} results
      </button>
    </Card>
  );
}
