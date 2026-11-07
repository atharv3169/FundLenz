'use client';
import { useState } from 'react';
import {
  ArrowDownToLine,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Printer,
  Save,
} from 'lucide-react';
import { evaluate, fields, keys, type Model } from '@/lib/atlas/model';
import {
  download,
  filename,
  forecastCsv,
  modelCsv,
  snapshot,
} from '@/lib/atlas/files';
import { equityInputs } from '@/lib/atlas/lab-book';
import { equityMethod, methods } from '@/lib/atlas/equity';
import { ModelImporter } from './model-importer';
import { useAtlas } from './context';
import { Card, Table, cash, n, pct } from './ui';
export function AuditReport({ m }: { m: Model }) {
  const { r, error } = evaluate(m);
  return (
    <article className="a-report">
      <div className="a-over">FundLenz Research / DCF Atlas</div>
      <h1>{m.name}</h1>
      <p>
        Valuation memorandum · {m.ticker || 'Private model'} · {m.basis} inputs
        · {m.currency} millions except per-share figures
      </p>
      <p>
        Fiscal base: FY{m.year} · Financial period end:{' '}
        {m.asOf || 'Not supplied'} · Reference price date:{' '}
        {m.priceDate || 'Not supplied'} · Model schema 1
      </p>
      {r ? (
        <>
          <h2>Valuation conclusion</h2>
          <p>
            The {m.horizon}-year operating FCFF model implies{' '}
            {cash(r.perShare, m.currency)} per diluted share, using a {pct(r.w)}{' '}
            discount rate and{' '}
            {m.terminal === 'growth'
              ? 'normalized perpetual growth'
              : 'an exit EBITDA multiple'}
            .{' '}
            {m.inputs.price !== null
              ? 'The entered reference price of ' +
                cash(m.inputs.price, m.currency) +
                ' implies a model gap of ' +
                pct(r.gap) +
                '.'
              : 'No reference price was supplied.'}
          </p>
          <Table
            heads={['Component', 'Amount']}
            rows={[
              ['Forecast PV', n(r.explicit)],
              ['Terminal PV', n(r.terminalPV)],
              ['Operating enterprise value', n(r.ev)],
              ['Net equity adjustment', n(r.netAdj)],
              ['Equity value', n(r.equity)],
              ['Diluted shares (millions)', n(m.inputs.shares)],
              ['Value per share', cash(r.perShare, m.currency)],
            ]}
          />
          <h2>Annual forecast</h2>
          <Table
            heads={[
              'FY',
              'Sales',
              'EBIT',
              'Tax',
              'D&A',
              'Capex',
              'ΔNWC',
              'FCFF',
              'PV FCFF',
            ]}
            rows={r.rows.map((x) => [
              x.year,
              ...[
                x.sales,
                x.ebit,
                x.taxes,
                x.da,
                x.capex,
                x.delta,
                x.fcff,
                x.pv,
              ].map((v) => n(v)),
            ])}
          />
          <h2>Model checks</h2>
          <ul>
            {findings(m).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>Incomplete valuation: {error}</p>
      )}
      {m.labs?.equity && (
        <>
          <h2>Independent equity worksheets</h2>
          <Table
            heads={['Method', 'Value / share', 'Edited assumptions']}
            rows={methods
              .filter((k) => m.labs?.equity?.[k])
              .map((k) => {
                let value = 'Incomplete';
                try {
                  value = cash(
                    equityMethod(
                      k,
                      equityInputs(m.labs, k, m.basis === 'Fictional'),
                    ).value,
                    m.currency,
                  );
                } catch {}
                return [
                  k,
                  value,
                  Object.entries(m.labs?.equity?.[k] ?? {})
                    .map(([key, val]) => key + ': ' + n(val))
                    .join(' · '),
                ];
              })}
          />
        </>
      )}
      {m.labs?.peers?.length ? (
        <>
          <h2>Peer market cross-check</h2>
          <Table
            heads={[
              'Peer',
              'Enterprise value',
              'Forward EBITDA',
              'EV / EBITDA',
            ]}
            rows={m.labs.peers.map((p) => [
              p.name,
              n(p.ev),
              n(p.ebitda),
              p.ev !== null && p.ev > 0 && p.ebitda !== null && p.ebitda > 0
                ? n(p.ev / p.ebitda) + '×'
                : 'N/A',
            ])}
          />
        </>
      ) : null}
      <h2>Sources & analyst notes</h2>
      <p>{m.source || 'No source supplied.'}</p>
      <p>{m.notes || 'No analyst notes entered.'}</p>
      {m.history.length > 0 && (
        <>
          <h2>Historical financials</h2>
          <Table
            heads={['FY', 'Sales', 'EBIT', 'Cash capex']}
            rows={m.history.map((h) => [
              h.year,
              n(h.sales),
              n(h.ebit),
              n(h.capex),
            ])}
          />
        </>
      )}
      <h2>Model assumptions</h2>
      <p>
        Nominal {m.currency}. Discount method: {m.discount}. Timing: {m.timing}.
        Terminal value is discounted from the end of the final year.
      </p>
      <Table
        heads={['Input', 'Value', 'Unit']}
        rows={keys.map((k) => [fields[k][0], n(m.inputs[k], 5), fields[k][2]])}
      />
      {m.overrides.some(
        (x, i) => i < m.horizon && Object.keys(x).length > 0,
      ) && (
        <>
          <h2>Annual overrides</h2>
          <Table
            heads={['FY', 'Driver', 'Override (%)']}
            rows={m.overrides
              .slice(0, m.horizon)
              .flatMap((x, i) =>
                Object.entries(x).map(([k, v]) => [m.year + i + 1, k, n(v, 5)]),
              )}
          />
        </>
      )}
      <p>
        FCFF = after-tax operating income + depreciation − capital expenditure −
        change in operating working capital. Forecast losses carry forward
        without expiry or jurisdiction-specific restrictions. Perpetual cash
        flow normalizes reinvestment to growth / ROIC; unused terminal tax
        losses receive no extra value. Valuations are conditional on the entered
        assumptions.
      </p>
    </article>
  );
}
export function findings(m: Model) {
  const { r, error } = evaluate(m);
  if (!r) return [error!];
  const out = [] as string[];
  if (m.basis === 'Fictional')
    out.push('Fictional case: no live company figures or market quote.');
  if (!m.source.trim()) out.push('Source information is missing.');
  if (!m.asOf) out.push('Financial period end is missing.');
  if (m.inputs.price !== null && !m.priceDate)
    out.push('Reference price has no observation date.');
  if (r.terminalShare !== null && r.terminalShare > 70)
    out.push(
      'More than 70% of operating value is attributable to the terminal period.',
    );
  if (m.terminal === 'growth' && r.w - m.inputs.terminalG! < 2)
    out.push(
      'WACC and stable growth differ by less than two percentage points.',
    );
  if (
    m.terminal === 'growth' &&
    m.inputs.rf !== null &&
    m.inputs.terminalG! > m.inputs.rf
  )
    out.push(
      'Stable growth exceeds the entered nominal risk-free rate; justify the long-run growth assumption.',
    );
  if (r.rows.some((x) => x.fcff < 0))
    out.push('One or more forecast years have negative free cash flow.');
  if (r.equity <= 0)
    out.push(
      'The model produces nonpositive equity value; percentage margin of safety is undefined.',
    );
  if (r.rows.at(-1)!.losses > 0)
    out.push(
      'Unutilized losses remain at the horizon. No separate tax asset is included.',
    );
  if (!out.length)
    out.push(
      'No threshold warnings under the current assumptions. Source accuracy still requires analyst review.',
    );
  return out;
}
const dict = [
  [
    'Free cash flow to the firm',
    'NOPAT + D&A − capital spending − change in operating working capital. This is before debt service.',
  ],
  [
    'Cost of equity',
    'Risk-free rate + levered beta × equity risk premium. Match the nominal currency to forecast cash flows.',
  ],
  [
    'WACC',
    'Equity cost × equity weight + pre-tax debt cost × (1 − marginal tax rate) × debt weight. Uses market-value capital weights.',
  ],
  [
    'Terminal reinvestment',
    'Stable growth ÷ stable ROIC. Next-year NOPAT × (1 − reinvestment rate) determines normalized cash flow.',
  ],
  [
    'Margin of safety',
    '(Model value − price) ÷ model value, only when model value is positive. The model-to-price gap uses price in the denominator.',
  ],
  [
    'Discount timing',
    'Midyear timing discounts explicit flows half a year earlier. Terminal value remains at the end of the final year.',
  ],
  [
    'Working capital',
    'Operating NWC = revenue × NWC ratio. Subtract the change in this balance; a release of capital adds to cash flow.',
  ],
  [
    'Alternative models',
    'FCFE and dividends are equity flows discounted at cost of equity. Residual income starts with book equity. An AFFO multiple is a market cross-check, not an FCFF perpetuity.',
  ],
];
export function Reports() {
  const { m, r, edit, notify, save } = useAtlas();
  const [q, search] = useState(''),
    [show, setShow] = useState(false);
  function report() {
    const markup = document.getElementById('atlas-print-report')?.innerHTML;
    if (!markup) return;
    download(
      filename(m) + '-report.html',
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DCF Atlas valuation memorandum</title><style>body{max-width:900px;margin:4vw auto;padding:24px;color:#203b40;font:15px/1.5 system-ui}h1,h2{font-family:Georgia;color:#144e45}th,td{padding:5px 9px;border-bottom:1px solid #bbb;text-align:left}table{width:100%;border-collapse:collapse}.a-sr{position:absolute;clip-path:inset(50%)}.a-scroll{overflow:auto}p{overflow-wrap:anywhere}tr{break-inside:avoid}@media print{body{padding:0;font-size:10pt}h2{break-after:avoid}}</style>' +
        markup +
        '</html>',
      'text/html',
    );
  }
  return (
    <>
      <Card kicker="01 / Data exchange" title="Import a working model">
        <ModelImporter />
      </Card>
      <Card kicker="02 / Output desk" title="Reports & exports">
        <div className="a-exportgrid">
          {[
            {
              title: 'Editable Excel workbook',
              text: 'Four sheets with linked inputs, forecast formulas, reported history and the equity bridge.',
              icon: FileSpreadsheet,
              disabled: !r,
              act: async () => {
                if (r) {
                  try {
                    const x = await import('@/lib/atlas/workbook');
                    download(filename(m) + '.xlsx', x.workbook(m, r));
                  } catch {
                    notify('Workbook export failed. Please try again.');
                  }
                }
              },
            },
            {
              title: 'Print / save as PDF',
              text: 'A valuation memorandum with model basis, forecasts, assumptions, overrides and sources.',
              icon: Printer,
              act: () => window.print(),
            },
            {
              title: 'Offline HTML report',
              text: 'A self-contained, read-only report to send to a reviewer.',
              icon: FileText,
              act: report,
            },
            {
              title: 'Model snapshot',
              text: 'Versioned JSON for sharing, backup and re-import.',
              icon: Save,
              act: () =>
                download(
                  filename(m) + '.json',
                  snapshot(m),
                  'application/json',
                ),
            },
            {
              title: 'Input worksheet',
              text: 'Editable CSV. Round-trips the settings, annual overrides and financial history.',
              icon: ClipboardList,
              act: () =>
                download(filename(m) + '-inputs.csv', modelCsv(m), 'text/csv'),
            },
            {
              title: 'Forecast CSV',
              text: 'Annual operating figures and discounted cash flows at full precision.',
              icon: ArrowDownToLine,
              disabled: !r,
              act: () => {
                if (r)
                  download(
                    filename(m) + '-forecast.csv',
                    forecastCsv(m, r),
                    'text/csv',
                  );
              },
            },
          ].map((a) => (
            <button
              className="a-export"
              key={a.title}
              disabled={a.disabled}
              onClick={() => {
                try {
                  void a.act();
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <a.icon size={20} />
              <b>{a.title}</b>
              <small>{a.text}</small>
            </button>
          ))}
        </div>
        <div className="a-tools">
          <button className="a-btn" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Preview'} memorandum
          </button>
          <button
            className="a-btn"
            onClick={() => save(m.name + ' · research snapshot')}
          >
            Save to model library
          </button>
        </div>
        {show && <AuditReport m={m} />}
      </Card>
      <Card kicker="03 / Analyst notebook" title="Thesis & model checks">
        <label className="a-full">
          Research notes
          <textarea
            rows={4}
            maxLength={10000}
            placeholder="What would have to be true for this valuation to hold?"
            value={m.notes}
            onChange={(e) =>
              edit({ ...m, notes: e.target.value }, 'Research notes')
            }
          />
        </label>
        <ul className="a-bullets">
          {findings(m).map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </Card>
      <Card kicker="04 / Field guide" title="Formula dictionary">
        <input
          aria-label="Search formula dictionary"
          type="search"
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Search formulas…"
        />
        {dict
          .filter((x) => x.join(' ').toLowerCase().includes(q.toLowerCase()))
          .map(([k, v]) => (
            <details className="a-disclosure" key={k}>
              <summary>{k}</summary>
              <p>{v}</p>
            </details>
          ))}
      </Card>
    </>
  );
}
