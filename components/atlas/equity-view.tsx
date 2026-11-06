'use client';
import { useState } from 'react';
import { Download, Plus, X } from 'lucide-react';
import {
  methods,
  equityMethod,
  type Method,
  type EquityInputs,
} from '@/lib/atlas/equity';
import { csv, download } from '@/lib/atlas/files';
import { useAtlas } from './context';
import { Card, Num, Plot, Table, cash, n } from './ui';
import { equityInputs, type Peer, type LabBook } from '@/lib/atlas/lab-book';
export function EquityView() {
  const { m, r, edit } = useAtlas();
  const [at, period] = useState(0);
  const book = m.labs ?? {},
    method = book.method ?? 'Dividend discount',
    setBook = (patch: Partial<LabBook>, why: string) =>
      edit({ ...m, labs: { ...book, ...patch } }, why);
  const choose = (method: Method) =>
      setBook({ method }, 'Changed equity worksheet'),
    v = equityInputs(book, method, m.basis === 'Fictional');
  const set = (k: keyof EquityInputs, value: number | null) =>
    setBook(
      {
        equity: {
          ...book.equity,
          [method]: { ...book.equity?.[method], [k]: value },
        },
      },
      'Edited ' + method + ' assumption',
    );
  const peers = book.peers ?? [
      { name: 'Peer 1', ev: null, ebitda: null },
      { name: 'Peer 2', ev: null, ebitda: null },
    ],
    update = (peers: Peer[]) => setBook({ peers }, 'Edited peer group');
  const inputs: [keyof EquityInputs, string][] = [
    [
      'base',
      method === 'Residual income'
        ? 'Opening book value / share'
        : method === 'REIT distributions'
          ? 'Starting AFFO / share'
          : method === 'Dividend discount'
            ? 'Starting dividend / share'
            : 'Starting FCFE / share',
    ],
    ['years', 'Forecast years'],
    ['rate', 'Cost of equity (%)'],
    ...((method === 'Residual income'
      ? [
          ['roe', 'Forecast ROE (%)'],
          ['stableRoe', 'Stable ROE (%)'],
        ]
      : [['growth', 'Annual growth (%)']]) as [keyof EquityInputs, string][]),
    ...((method !== 'REIT distributions'
      ? [['stable', 'Stable growth (%)']]
      : [['exit', 'Exit price / AFFO (×)']]) as [keyof EquityInputs, string][]),
    ...((['REIT distributions', 'Residual income'].includes(method)
      ? [['payout', 'Payout ratio (%)']]
      : []) as [keyof EquityInputs, string][]),
  ];
  let result: null | ReturnType<typeof equityMethod> = null,
    error = '';
  try {
    result = equityMethod(method, v);
  } catch (e) {
    error = (e as Error).message;
  }
  const multiples = peers
      .filter(
        (p) => p.ev !== null && p.ev > 0 && p.ebitda !== null && p.ebitda > 0,
      )
      .map((p) => p.ev! / p.ebitda!)
      .sort((a, b) => a - b),
    med = multiples.length
      ? (multiples[(multiples.length - 1) >> 1] +
          multiples[multiples.length >> 1]) /
        2
      : null,
    ebitda = r ? r.rows[0].ebit + r.rows[0].da : null,
    comp =
      med !== null && ebitda !== null && ebitda > 0 && r
        ? (med * ebitda + r.netAdj) / m.inputs.shares!
        : null;
  return (
    <>
      <Card
        kicker="01 / Independent equity worksheet"
        title="Choose the cash flow that fits"
      >
        <p>
          {m.basis === 'Fictional'
            ? 'The example starts with illustrative per-share figures.'
            : 'Enter sourced per-share figures for this company.'}{' '}
          Each method keeps its own inputs and discounts at cost of equity. The
          worksheet and peer group are saved with this model.
        </p>
        <div className="a-chips">
          {methods.map((s) => (
            <button
              className="a-pill"
              aria-pressed={method === s}
              key={s}
              onClick={() => {
                choose(s);
                period(0);
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="a-gridform">
          {inputs.map(([k, l]) => (
            <Num
              key={k}
              label={l}
              value={Number.isFinite(v[k]) ? v[k] : null}
              onChange={(x) => set(k, x)}
            />
          ))}
        </div>
        {result ? (
          <>
            <div className="a-keyline">
              <span>{method} · model value per share</span>
              <strong>{cash(result.value, m.currency)}</strong>
            </div>
            <Plot
              labels={result.flows.map((_, i) => 'Y' + (i + 1))}
              series={[
                {
                  name:
                    method === 'Residual income'
                      ? 'Residual earnings'
                      : 'Equity flow',
                  values: result.flows,
                },
                { name: 'Present value', values: result.pvs },
              ]}
              unit={m.currency + ' / share'}
              at={at}
              onSelect={period}
            />
            <p className="a-muted">
              {method === 'Residual income'
                ? 'Opening book value + PV of excess returns + PV of continuing excess returns. Assumes clean-surplus book accounting.'
                : method === 'REIT distributions'
                  ? 'Discount distributions (AFFO × payout) and the terminal sale price (final AFFO × exit multiple).'
                  : 'Discount explicit distributions or FCFE, plus normalized next-year flow divided by cost of equity minus stable growth.'}
            </p>
            <button
              className="a-btn"
              onClick={() =>
                download(
                  'atlas-equity-worksheet.csv',
                  csv([
                    ['Method', method],
                    ['Currency', m.currency],
                    ...inputs.map(([k, l]) => [l, v[k]]),
                    ['Value per share', result!.value],
                    ['Terminal PV', result!.terminalPV],
                    ['Year', 'Equity flow', 'PV'],
                    ...result!.flows.map((x, i) => [i + 1, x, result!.pvs[i]]),
                  ]),
                  'text/csv',
                )
              }
            >
              <Download size={14} /> Worksheet CSV
            </button>
          </>
        ) : (
          <p className="a-note">{error}</p>
        )}
      </Card>
      <Card kicker="02 / Market cross-check" title="Peer multiple bench">
        <p>
          Enter enterprise value and forward EBITDA in matching units for each
          peer. Use comparable industries, periods and lease treatment. The
          median multiple is applied to the active model’s year-one EBITDA.
        </p>
        <Table
          heads={[
            'Peer',
            'Enterprise value',
            'Forward EBITDA',
            'EV / EBITDA',
            '',
          ]}
          rows={peers.map((p, i) => [
            <input
              key="peer-name"
              aria-label={'Peer ' + (i + 1) + ' name'}
              value={p.name}
              maxLength={60}
              onChange={(e) =>
                update(
                  peers.map((x, j) =>
                    i === j ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
            />,
            ...(['ev', 'ebitda'] as const).map((k) => (
              <input
                key={k}
                aria-label={'Peer ' + (i + 1) + ' ' + k}
                type="number"
                step="any"
                placeholder="Amount"
                value={p[k] ?? ''}
                onChange={(e) =>
                  update(
                    peers.map((x, j) =>
                      i === j
                        ? {
                            ...x,
                            [k]:
                              e.target.value === ''
                                ? null
                                : e.target.valueAsNumber,
                          }
                        : x,
                    ),
                  )
                }
              />
            )),
            p.ev !== null && p.ev > 0 && p.ebitda !== null && p.ebitda > 0
              ? n(p.ev / p.ebitda) + '×'
              : 'N/A',
            <button
              key="remove"
              aria-label={'Remove peer ' + (i + 1)}
              className="a-icon"
              onClick={() => update(peers.filter((_, j) => j !== i))}
            >
              <X size={14} />
            </button>,
          ])}
        />
        <div className="a-tools">
          <button
            className="a-btn"
            disabled={peers.length >= 12}
            onClick={() =>
              update([
                ...peers,
                { name: 'Peer ' + (peers.length + 1), ev: null, ebitda: null },
              ])
            }
          >
            <Plus size={14} /> Add peer
          </button>
          <button
            className="a-btn"
            disabled={!multiples.length}
            onClick={() =>
              download(
                'atlas-peer-comparison.csv',
                csv([
                  ['Peer', 'EV', 'Forward EBITDA'],
                  ...peers.map((p) => [p.name, p.ev, p.ebitda]),
                  ['Median EV / EBITDA', med],
                  ['Target company', m.name],
                  ['Implied share value', comp, m.currency],
                ]),
                'text/csv',
              )
            }
          >
            Export peers
          </button>
        </div>
        <div className="a-keyline">
          <span>
            {multiples.length} eligible · median {n(med)}×
          </span>
          <b>{cash(comp, m.currency)} / share</b>
        </div>
      </Card>
    </>
  );
}
