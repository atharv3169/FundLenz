'use client';
import { useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  Info,
  SlidersHorizontal,
  Download,
} from 'lucide-react';
import {
  capital,
  clone,
  driver,
  drivers,
  fields,
  keys,
  type Driver,
  type Key,
  type Model,
} from '@/lib/atlas/model';
import { download, filename, forecastCsv } from '@/lib/atlas/files';
import { useAtlas } from './context';
import {
  Bars,
  Card,
  Kpi,
  Num,
  Plot,
  Ring,
  Table,
  Waterfall,
  cash,
  n,
  pct,
} from './ui';
export function Incomplete() {
  const { error, go } = useAtlas();
  return (
    <div className="a-notice">
      <Info size={18} />
      <div>
        <b>Model needs inputs</b>
        <p>{error}</p>
        <button className="a-link" onClick={() => go('Assumptions')}>
          Open assumptions <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
export function Overview() {
  const { m, r, period, setPeriod, go, edit } = useAtlas();
  const [metric, setMetric] = useState('Cash flow'),
    [haircut, setHaircut] = useState(20);
  if (!r) return <Incomplete />;
  const unit = m.currency + ' m',
    idx = Math.min(period, r.rows.length - 1),
    row = r.rows[idx],
    series =
      metric === 'Cash flow'
        ? [
            { name: 'Free cash flow', values: r.rows.map((x) => x.fcff) },
            { name: 'Present value', values: r.rows.map((x) => x.pv) },
          ]
        : metric === 'Operations'
          ? [
              { name: 'Revenue', values: r.rows.map((x) => x.sales) },
              { name: 'Operating profit', values: r.rows.map((x) => x.ebit) },
            ]
          : [
              { name: 'Sales growth', values: r.rows.map((x) => x.growth) },
              { name: 'EBIT margin', values: r.rows.map((x) => x.margin) },
            ];
  return (
    <>
      <div className="a-metrics">
        <Kpi
          label="Intrinsic value / share"
          value={cash(r.perShare, m.currency)}
          hint="Discounted operating cash flows"
        />
        <Kpi
          label="Model vs. reference"
          value={pct(r.gap)}
          hint={'Reference: ' + cash(m.inputs.price, m.currency)}
        />
        <Kpi
          label="Operating value"
          value={n(r.ev, 1) + 'm'}
          hint={m.currency + ' · before equity claims'}
        />
        <Kpi
          label="Cost of capital"
          value={pct(r.w)}
          hint={
            m.discount === 'built'
              ? 'Market-weighted WACC'
              : 'Direct WACC assumption'
          }
        />
      </div>
      <Card
        kicker="01 / Forecast lens"
        title="Cash-flow outlook"
        action={
          <select
            aria-label="Chart measure"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {['Cash flow', 'Operations', 'Rates'].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        }
      >
        <Plot
          labels={r.rows.map((x) => 'FY' + String(x.year).slice(-2))}
          series={series}
          unit={metric === 'Rates' ? '%' : unit}
          at={idx}
          onSelect={setPeriod}
        />
        <details className="a-disclosure">
          <summary>
            <SlidersHorizontal size={14} /> Tune forecast drivers
          </summary>
          <p>
            Change an assumption and watch the chart and value update. Annual
            overrides take priority.
          </p>
          <div className="a-gridform">
            {(['growth', 'margin', 'capex'] as const).map((k) => (
              <label key={k} className="a-slider">
                {fields[k][0]} <b>{pct(m.inputs[k])}</b>
                <input
                  aria-label={fields[k][0]}
                  type="range"
                  min={Math.min(
                    k === 'growth' ? -30 : k === 'margin' ? -20 : 0,
                    m.inputs[k] ?? 0,
                  )}
                  max={Math.max(k === 'capex' ? 45 : 70, m.inputs[k] ?? 0)}
                  step=".25"
                  value={m.inputs[k] ?? 0}
                  onChange={(e) =>
                    edit(
                      { ...m, inputs: { ...m.inputs, [k]: +e.target.value } },
                      fields[k][0],
                    )
                  }
                />
              </label>
            ))}
          </div>
        </details>
      </Card>
      <div className="a-duo">
        <Card kicker="02 / Anatomy" title="Terminal dependence">
          {r.terminalShare !== null &&
          r.terminalShare >= 0 &&
          r.terminalShare <= 100 ? (
            <div className="a-inline">
              <Ring value={r.terminalShare} />
              <p>
                of enterprise value comes from cash flows beyond FY
                {r.rows.at(-1)!.year}.
              </p>
            </div>
          ) : (
            <p>
              Terminal share: {pct(r.terminalShare)}. Signed cash flows cannot
              be shown as a percentage ring.
            </p>
          )}
          <div className="a-keyline">
            <span>Explicit forecast PV</span>
            <b>{n(r.explicit)}m</b>
          </div>
          <div className="a-keyline">
            <span>Terminal PV</span>
            <b>{n(r.terminalPV)}m</b>
          </div>
          <button className="a-link" onClick={() => go('Sensitivity')}>
            Stress the terminal assumptions <ArrowUpRight size={15} />
          </button>
        </Card>
        <Card kicker="03 / Price discipline" title="Margin of safety">
          <div className="a-big">{pct(r.safety)}</div>
          <p>
            Difference between value and reference price, as a share of model
            value.
          </p>
          <label className="a-slider">
            Target discount <b>{haircut}%</b>
            <input
              aria-label="Target discount"
              type="range"
              min="0"
              max="60"
              value={haircut}
              onChange={(e) => setHaircut(+e.target.value)}
            />
          </label>
          <div className="a-keyline">
            <span>Price at target discount</span>
            <b>
              {r.perShare > 0
                ? cash(r.perShare * (1 - haircut / 100), m.currency)
                : 'N/A'}
            </b>
          </div>
        </Card>
      </div>
      <Card
        kicker={'04 / Linked period · FY' + row.year}
        title="From operating profit to free cash"
      >
        <Waterfall
          unit={unit}
          items={[
            ['NOPAT', row.nopat],
            ['D&A', row.da],
            ['Capex', -row.capex],
            ['ΔNWC', -row.delta],
          ]}
        />
      </Card>
    </>
  );
}
export function Assumptions() {
  const { m, r, edit, go } = useAtlas();
  const [q, search] = useState(''),
    [all, setAll] = useState(false);
  const groups = [...new Set(keys.map((k) => fields[k][1]))];
  const set = (k: Key, v: number | null) =>
    edit({ ...m, inputs: { ...m.inputs, [k]: v } }, fields[k][0]);
  return (
    <>
      <Card kicker="Model identity" title="Basis of valuation">
        <div className="a-gridform">
          <label>
            Company name
            <input
              aria-label="Company name"
              maxLength={100}
              value={m.name}
              onChange={(e) =>
                edit({ ...m, name: e.target.value }, 'Company name')
              }
            />
          </label>
          <label>
            Ticker
            <input
              maxLength={32}
              value={m.ticker}
              onChange={(e) => edit({ ...m, ticker: e.target.value }, 'Ticker')}
            />
          </label>
          <label>
            Business type
            <select
              value={m.sector}
              onChange={(e) =>
                edit(
                  { ...m, sector: e.target.value as Model['sector'] },
                  'Sector',
                )
              }
            >
              {['Operating company', 'Bank / insurer', 'REIT'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Forecast base FY
            <input
              type="number"
              value={m.year}
              min="1900"
              max="2200"
              onChange={(e) => {
                const y = +e.target.value;
                if (
                  Number.isInteger(y) &&
                  y >= Math.max(1900, ...m.history.map((h) => h.year)) &&
                  y <= 2200
                )
                  edit({ ...m, year: y }, 'Base fiscal year');
              }}
            />
          </label>
          <label>
            Financial period end
            <input
              type="date"
              value={m.asOf}
              onChange={(e) =>
                edit({ ...m, asOf: e.target.value }, 'Financial period')
              }
            />
          </label>
          <label>
            Reference price date
            <input
              type="date"
              value={m.priceDate}
              onChange={(e) =>
                edit({ ...m, priceDate: e.target.value }, 'Price date')
              }
            />
          </label>
          <label>
            Forecast length
            <select
              value={m.horizon}
              onChange={(e) =>
                edit({ ...m, horizon: +e.target.value }, 'Forecast horizon')
              }
            >
              {[3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                <option key={v} value={v}>
                  {v} years
                </option>
              ))}
            </select>
          </label>
          <label>
            Cash-flow timing
            <select
              value={m.timing}
              onChange={(e) =>
                edit(
                  { ...m, timing: e.target.value as Model['timing'] },
                  'Discount timing',
                )
              }
            >
              <option value="year-end">Year-end</option>
              <option value="midyear">Midyear flows · year-end terminal</option>
            </select>
          </label>
        </div>
        <label className="a-full">
          Source and basis
          <textarea
            maxLength={3000}
            value={m.source}
            onChange={(e) =>
              edit({ ...m, source: e.target.value }, 'Source note')
            }
          />
        </label>
        <div className="a-muted">
          Amounts: {m.currency} millions. Shares: millions. Enter all figures in
          the same nominal currency. Start a new model in Research to use a
          different currency.
        </div>
      </Card>
      <Card
        kicker="Input ledger"
        title="Assumption controls"
        action={<SlidersHorizontal size={19} />}
      >
        <div className="a-tools">
          <input
            type="search"
            placeholder="Filter assumptions…"
            aria-label="Filter assumptions"
            value={q}
            onChange={(e) => search(e.target.value)}
          />
          <label className="a-check">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
            />
            Show inactive inputs
          </label>
        </div>
        <div className="a-gridform">
          <label>
            Discount method
            <select
              value={m.discount}
              onChange={(e) =>
                edit(
                  { ...m, discount: e.target.value as Model['discount'] },
                  'Discount method',
                )
              }
            >
              <option value="built">Build WACC from components</option>
              <option value="direct">Enter WACC directly</option>
            </select>
          </label>
          <label>
            Terminal method
            <select
              value={m.terminal}
              onChange={(e) =>
                edit(
                  { ...m, terminal: e.target.value as Model['terminal'] },
                  'Terminal method',
                )
              }
            >
              <option value="growth">Perpetual growth</option>
              <option value="multiple">Exit EV / EBITDA</option>
            </select>
          </label>
        </div>
        {groups.map((group) => {
          const found = keys.filter(
            (k) =>
              fields[k][1] === group &&
              (fields[k][0] + ' ' + group)
                .toLowerCase()
                .includes(q.toLowerCase()) &&
              (all ||
                ((m.discount === 'direct' || k !== 'wacc') &&
                  (m.discount === 'built' ||
                    !['rf', 'beta', 'erp', 'debtCost', 'debtWeight'].includes(
                      k,
                    )) &&
                  (m.terminal === 'growth'
                    ? k !== 'multiple'
                    : !['roic', 'terminalG'].includes(k)))),
          );
          return found.length ? (
            <div className="a-inputgroup" key={group}>
              <h4>{group}</h4>
              <div className="a-gridform">
                {found.map((k) => (
                  <Num
                    key={k}
                    label={fields[k][0]}
                    value={m.inputs[k]}
                    unit={fields[k][2]}
                    min={fields[k][3]}
                    max={fields[k][4]}
                    onChange={(v) => set(k, v)}
                  />
                ))}
              </div>
            </div>
          ) : null;
        })}
        <p className="a-muted">
          Growth and margins fade linearly between the first and final forecast
          years. Use Forecast studio to override individual periods.
        </p>
        <button className="a-link" onClick={() => go('Forecast studio')}>
          Open annual driver grid <ArrowUpRight size={14} />
        </button>
      </Card>
      <CapitalTools />
      {!r && <Incomplete />}
    </>
  );
}
function CapitalTools() {
  const { m, edit } = useAtlas();
  const c = capital(m),
    [peer, setPeer] = useState<number | null>(1.15),
    [leverage, setLev] = useState<number | null>(35),
    [target, setTar] = useState<number | null>(40),
    tax = m.inputs.tax;
  const ok =
      peer !== null &&
      leverage !== null &&
      target !== null &&
      tax !== null &&
      tax >= 0 &&
      tax < 100 &&
      leverage >= 0 &&
      target >= 0,
    un = ok ? peer / (1 + ((1 - tax / 100) * leverage) / 100) : null,
    re = ok && un !== null ? un * (1 + ((1 - tax / 100) * target) / 100) : null;
  return (
    <Card kicker="Financing workshop" title="Cost of capital & beta">
      <div className="a-metrics slim">
        <Kpi
          label="Equity cost"
          value={pct(c.ke)}
          hint="Risk-free + beta × ERP"
        />
        <Kpi
          label="After-tax debt"
          value={pct(c.kd)}
          hint="Debt cost × (1 − tax)"
        />
        <Kpi
          label="Weighted WACC"
          value={pct(c.built)}
          hint="Assumes usable tax shield"
        />
      </div>
      <details className="a-disclosure">
        <summary>Unlever and relever a peer beta</summary>
        <p>
          Hamada approximation; assumes zero debt beta. D/E is a percentage of
          equity, not a percentage of total capital.
        </p>
        <div className="a-gridform">
          <Num label="Peer levered beta" value={peer} onChange={setPeer} />
          <Num label="Peer D/E (%)" value={leverage} onChange={setLev} />
          <Num label="Target D/E (%)" value={target} onChange={setTar} />
        </div>
        <p>
          Unlevered: {n(un, 3)} · Relevered: {n(re, 3)}
        </p>
        <button
          className="a-btn"
          disabled={re === null || re < -5 || re > 10}
          onClick={() =>
            edit(
              {
                ...m,
                discount: 'built',
                inputs: {
                  ...m.inputs,
                  beta: re,
                  debtWeight: (100 * target!) / (100 + target!),
                },
              },
              'Applied peer beta and target gearing',
            )
          }
        >
          Use beta and capital weights
        </button>
      </details>
    </Card>
  );
}
export function Forecast() {
  const { m, r, edit, period, setPeriod } = useAtlas();
  const [driverKey, setDriver] = useState<Driver>('growth');
  const set = (i: number, k: Driver, v: number | null) => {
    const next = clone(m);
    while (next.overrides.length <= i) next.overrides.push({});
    if (v === null) delete next.overrides[i][k];
    else next.overrides[i][k] = v;
    edit(next, 'Year ' + (i + 1) + ' ' + k);
  };
  return (
    <>
      <Card kicker="01 / Forecast studio" title="Annual driver grid">
        <p>
          Blank cells inherit the model path shown as a placeholder. Enter a
          number to override one year; clear it to restore the formula.
        </p>
        <div className="a-tools">
          <label>
            Driver{' '}
            <select
              value={driverKey}
              onChange={(e) => setDriver(e.target.value as Driver)}
            >
              {drivers.map((k) => (
                <option key={k} value={k}>
                  {fields[k][0].replace('First-year ', '')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="a-years">
          {Array.from({ length: m.horizon }, (_, i) => (
            <label key={i}>
              FY{m.year + i + 1}
              <input
                aria-label={'Year ' + (i + 1) + ' ' + driverKey + ' override'}
                type="number"
                step="any"
                placeholder={n(driver(m, driverKey, i))}
                value={m.overrides[i]?.[driverKey] ?? ''}
                onChange={(e) =>
                  set(
                    i,
                    driverKey,
                    e.target.value === '' ? null : e.target.valueAsNumber,
                  )
                }
              />
              <small>
                {m.overrides[i]?.[driverKey] === undefined
                  ? 'Inherited'
                  : 'Override'}{' '}
                · %
              </small>
            </label>
          ))}
        </div>
      </Card>
      {r ? (
        <>
          <Card
            kicker="02 / Forecast ledger"
            title="Discounted cash flows"
            action={
              <button
                className="a-btn"
                onClick={() =>
                  download(
                    filename(m) + '-forecast.csv',
                    forecastCsv(m, r),
                    'text/csv',
                  )
                }
              >
                <Download size={15} /> CSV
              </button>
            }
          >
            <Table
              heads={[
                'FY',
                'Sales',
                'EBIT',
                'Cash tax',
                'NOPAT',
                'D&A',
                'Capex',
                'ΔNWC',
                'FCFF',
                'PV factor',
                'PV FCFF',
              ]}
              rows={r.rows.map((x, i) => [
                <button
                  key={x.year}
                  className={'a-link ' + (period === i ? 'current' : '')}
                  onClick={() => setPeriod(i)}
                >
                  {x.year}
                </button>,
                ...[
                  x.sales,
                  x.ebit,
                  x.taxes,
                  x.nopat,
                  x.da,
                  x.capex,
                  x.delta,
                  x.fcff,
                  x.factor,
                  x.pv,
                ].map((v, j) => n(v, j === 8 ? 4 : 2)),
              ])}
            />
            <p className="a-muted">
              Amounts in {m.currency} millions. Tax losses carry forward within
              the forecast; normalized terminal profit is fully taxed.
            </p>
          </Card>
          <Card
            kicker="03 / Claim structure"
            title="Enterprise-to-equity bridge"
          >
            <Waterfall
              unit={m.currency + ' m'}
              items={[
                ['Forecast', r.explicit],
                ['Terminal', r.terminalPV],
                ['Cash', m.inputs.cash!],
                ['Assets', m.inputs.assets!],
                ['Debt', -m.inputs.debt!],
                ['Claims', -m.inputs.claims!],
              ]}
            />
            <div className="a-keyline">
              <span>Equity value ÷ diluted shares</span>
              <b>
                {n(r.equity)}m ÷ {n(m.inputs.shares)}m ={' '}
                {cash(r.perShare, m.currency)}
              </b>
            </div>
          </Card>
          <Card
            kicker="04 / Reinvestment"
            title={
              'FY' +
              r.rows[Math.min(period, r.rows.length - 1)].year +
              ' cash flows'
            }
          >
            <Bars
              items={(() => {
                const x = r.rows[Math.min(period, r.rows.length - 1)];
                return [
                  ['After-tax EBIT', x.nopat],
                  ['Depreciation', x.da],
                  ['Capital spending', -x.capex],
                  ['Working capital', -x.delta],
                  ['Free cash flow', x.fcff],
                ] as [string, number][];
              })()}
              unit="m"
            />
          </Card>
        </>
      ) : (
        <Incomplete />
      )}
    </>
  );
}
