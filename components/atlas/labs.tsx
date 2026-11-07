'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Download, Play, Save } from 'lucide-react';
import {
  clone,
  defaultSim,
  evaluate,
  reverse,
  shocks,
  simulate,
  type SimSpec,
} from '@/lib/atlas/model';
import simulationUrl from '@/lib/atlas/simulation.worker.ts?worker&url';
import { holdingReturn } from '@/lib/atlas/equity';
import { csv, download, filename } from '@/lib/atlas/files';
import { useAtlas } from './context';
import { Bars, Card, Kpi, Num, Plot, Table, cash, n, pct } from './ui';
import { Incomplete } from './model-views';
export function Scenarios() {
  const { m, r, edit, save, library, period, setPeriod } = useAtlas();
  const caseSettings = m.labs?.scenarios ?? {},
    spread = caseSettings.spread === undefined ? 3 : caseSettings.spread,
    profit = caseSettings.profit === undefined ? 2 : caseSettings.profit,
    bear = caseSettings.bear ?? 25,
    bull = caseSettings.bull ?? 25;
  const put = (key: 'spread' | 'profit' | 'bear' | 'bull', v: number | null) =>
    edit(
      { ...m, labs: { ...m.labs, scenarios: { ...caseSettings, [key]: v } } },
      'Edited scenario ' + key,
    );
  const spreadTo = (v: number | null) => put('spread', v),
    profitTo = (v: number | null) => put('profit', v),
    setBear = (v: number) => put('bear', v),
    setBull = (v: number) => put('bull', v);
  const [label, setLabel] = useState(''),
    [picked, setPicked] = useState<string[]>([]);
  if (!r) return <Incomplete />;
  const valid =
    spread !== null &&
    profit !== null &&
    spread >= 0 &&
    profit >= 0 &&
    spread <= 50 &&
    profit <= 50;
  const cases = valid
    ? ['Downside', 'Active', 'Upside'].map((name, i) => {
        const mod = shocks(m, {
          growth: (i - 1) * spread,
          margin: (i - 1) * profit,
        });
        return { name, m: mod, r: evaluate(mod).r };
      })
    : [];
  const weights = [bear, 100 - bull - bear, bull],
    weighted =
      cases.length && cases.every((c) => c.r) && weights.every((w) => w >= 0)
        ? cases.reduce((s, c, i) => s + (c.r!.perShare * weights[i]) / 100, 0)
        : null;
  const selected = library.filter((x) => picked.includes(x.id));
  return (
    <>
      <Card kicker="01 / Scenario bench" title="Operating cases">
        <p>
          Stress the whole operating path, including annual overrides. Financing
          and terminal assumptions stay fixed.
        </p>
        <div className="a-gridform">
          <Num label="Growth shift (± pp)" value={spread} onChange={spreadTo} />
          <Num label="Margin shift (± pp)" value={profit} onChange={profitTo} />
        </div>
        {valid ? (
          <>
            <Table
              heads={[
                'Case',
                'First-year sales',
                'Final EBIT margin',
                'Value / share',
                'Action',
              ]}
              rows={cases.map((c, i) => [
                c.name,
                n(c.r?.rows[0].sales),
                pct(c.r?.rows.at(-1)?.margin),
                cash(c.r?.perShare, m.currency),
                i === 1 ? (
                  'Active'
                ) : (
                  <button
                    disabled={!c.r}
                    className="a-link"
                    onClick={() =>
                      edit(c.m, 'Applied ' + c.name + ' operating case')
                    }
                  >
                    Apply case
                  </button>
                ),
              ])}
            />
            {cases.filter((c) => c.r).length > 0 && (
              <Plot
                labels={r.rows.map((x) => 'FY' + String(x.year).slice(-2))}
                series={cases
                  .filter((c) => c.r)
                  .map((c) => ({
                    name: c.name,
                    values: c.r!.rows.map((x) => x.fcff),
                  }))}
                unit={m.currency + ' m · FCFF'}
                at={period}
                onSelect={setPeriod}
              />
            )}
          </>
        ) : (
          <p className="a-note">
            Use shifts between 0 and 50 percentage points.
          </p>
        )}
      </Card>
      <Card kicker="02 / Conditional outcomes" title="Weight the cases">
        <div className="a-gridform">
          <Num
            label="Downside weight (%)"
            value={bear}
            onChange={(v) => setBear(Math.min(100, Math.max(0, v ?? 0)))}
          />
          <Num
            label="Upside weight (%)"
            value={bull}
            onChange={(v) => setBull(Math.min(100, Math.max(0, v ?? 0)))}
          />
        </div>
        <div className="a-keyline">
          <span>
            {weights[1] < 0
              ? 'Weights exceed 100%'
              : 'Active weight: ' + n(weights[1]) + '%'}
          </span>
          <b>{cash(weighted, m.currency)} / share</b>
        </div>
        <p className="a-muted">
          Weights are your judgments, not estimated probabilities.
        </p>
      </Card>
      <Card kicker="03 / Model vault" title="Save & compare custom cases">
        <div className="a-tools">
          <input
            aria-label="Snapshot label"
            placeholder="Name this snapshot"
            maxLength={80}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button
            className="a-btn"
            onClick={() => save(label || m.name + ' · case')}
          >
            <Save size={15} /> Save case
          </button>
        </div>
        <p>
          Select up to four saved models. Percentages can be compared across
          currencies; per-share values are shown only for the same company,
          share basis and currency.
        </p>
        <div className="a-chips">
          {library.map((s) => (
            <label className="a-check" key={s.id}>
              <input
                type="checkbox"
                checked={picked.includes(s.id)}
                disabled={!picked.includes(s.id) && picked.length >= 4}
                onChange={() =>
                  setPicked(
                    picked.includes(s.id)
                      ? picked.filter((x) => x !== s.id)
                      : [...picked, s.id],
                  )
                }
              />
              {s.label}
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <Table
            heads={[
              'Snapshot',
              'Currency',
              'Horizon',
              'Final EBIT margin',
              'WACC',
              'Model gap',
              'Value/share¹',
            ]}
            rows={selected.map((s) => {
              const v = evaluate(s.model).r,
                match =
                  s.model.name === m.name &&
                  s.model.ticker === m.ticker &&
                  s.model.currency === m.currency &&
                  s.model.inputs.shares === m.inputs.shares;
              return [
                s.label,
                s.model.currency,
                s.model.horizon + ' yr',
                pct(v?.rows.at(-1)?.margin),
                pct(v?.w),
                pct(v?.gap),
                match ? cash(v?.perShare, m.currency) : 'Not comparable',
              ];
            })}
          />
        )}
      </Card>
    </>
  );
}
type Axis = 'Capital × perpetuity' | 'Growth × margin' | 'Capex × discount';
export function Sensitivity() {
  const { m, r, edit } = useAtlas(),
    [axis, select] = useState<Axis>('Capital × perpetuity'),
    [step, setStep] = useState<number | null>(0.5),
    [size, setSize] = useState(5),
    [cell, pick] = useState<[number, number]>([0, 0]);
  if (!r) return <Incomplete />;
  const validStep = step !== null && step > 0 && step <= 10,
    off = Array.from({ length: size }, (_, i) => i - (size - 1) / 2),
    st = step ?? 0;
  const mode =
    axis === 'Capital × perpetuity' ? 0 : axis === 'Growth × margin' ? 1 : 2;
  const gridCase = (x: number, y: number) => {
    const o = shocks(
      m,
      mode === 0
        ? { wacc: y * st, terminalG: x * st }
        : mode === 1
          ? { growth: x * st, margin: y * st }
          : { capex: x * st, wacc: y * st },
    );
    if (mode === 0 && m.terminal !== 'growth') o.terminal = 'growth';
    return o;
  };
  const tableData = off.map((y) =>
      off.map((x) => evaluate(gridCase(x, y)).r?.perShare ?? null),
    ),
    vals = tableData.flat().filter((v): v is number => v !== null),
    low = Math.min(...vals),
    high = Math.max(...vals),
    preview = gridCase(cell[0], cell[1]),
    pr = evaluate(preview);
  const col = (x: number) =>
      mode === 0 ? (m.inputs.terminalG ?? 0) + x * st : x * st,
    row = (y: number) => (mode === 1 ? y * st : r.w + y * st);
  const changes: [string, number | null, number | null][] = (
    [
      'growth',
      'margin',
      'capex',
      'wacc',
      ...(m.terminal === 'growth' ? ['terminalG'] : []),
    ] as const
  )
    .map((k) => {
      const delta = (sign: number) => {
        const out = evaluate(shocks(m, { [k]: sign })).r;
        return out ? out.perShare - r.perShare : null;
      };
      return [k, delta(-1), delta(1)] as [string, number | null, number | null];
    })
    .sort(
      (a, b) =>
        Math.max(Math.abs(b[1] ?? 0), Math.abs(b[2] ?? 0)) -
        Math.max(Math.abs(a[1] ?? 0), Math.abs(a[2] ?? 0)),
    );
  return (
    <>
      <Card kicker="01 / Sensitivity lab" title="Valuation surface">
        <div className="a-tools">
          <label>
            Axes{' '}
            <select
              value={axis}
              onChange={(e) => {
                select(e.target.value as Axis);
                pick([0, 0]);
              }}
            >
              {[
                'Capital × perpetuity',
                'Growth × margin',
                'Capex × discount',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Grid{' '}
            <select
              value={size}
              onChange={(e) => {
                setSize(+e.target.value);
                pick([0, 0]);
              }}
            >
              {[3, 5, 7].map((v) => (
                <option key={v} value={v}>
                  {v} × {v}
                </option>
              ))}
            </select>
          </label>
          <Num label="Step (pp)" value={step} onChange={setStep} />
        </div>
        <p>
          {mode === 0
            ? 'Rows: absolute WACC · columns: perpetual growth'
            : mode === 1
              ? 'Rows: margin shift · columns: growth shift'
              : 'Rows: absolute WACC · columns: capex / sales shift'}
          . Cells show {m.currency} per share.
        </p>
        {mode === 0 && m.terminal !== 'growth' ? (
          <p className="a-note">
            This surface needs a perpetual-growth terminal model. Select a
            different surface or change the terminal method in Assumptions.
          </p>
        ) : !validStep ? (
          <p className="a-note">
            Enter a step greater than 0 and at most 10 pp.
          </p>
        ) : (
          <>
            <div className="a-heat">
              <Table
                heads={[
                  'Row / column',
                  ...off.map((x) => n(col(x)) + (mode === 0 ? '%' : ' pp')),
                ]}
                rows={off.map((y, i) => [
                  n(row(y)) + (mode === 1 ? ' pp' : '%'),
                  ...off.map((x, j) => {
                    const v = tableData[i][j],
                      selected = x === cell[0] && y === cell[1];
                    return (
                      <button
                        key={x}
                        className={
                          (x === 0 && y === 0 ? 'base ' : '') +
                          (selected ? 'chosen' : '')
                        }
                        style={{
                          background:
                            v === null
                              ? '#eff0ec'
                              : 'hsl(161 32% ' +
                                (95 -
                                  44 *
                                    (high === low
                                      ? 0.5
                                      : (v - low) / (high - low))) +
                                '%)',
                        }}
                        aria-pressed={selected}
                        aria-label={
                          'Row ' +
                          n(row(y)) +
                          ', column ' +
                          n(col(x)) +
                          '; ' +
                          cash(v, m.currency)
                        }
                        disabled={v === null}
                        onClick={() => pick([x, y])}
                      >
                        {n(v)}
                      </button>
                    );
                  }),
                ])}
              />
            </div>
            <div className="a-tools">
              <b>Selected: {cash(pr.r?.perShare, m.currency)}</b>
              <button
                className="a-btn"
                disabled={!pr.r || cell.every((v) => v === 0)}
                onClick={() => {
                  edit(preview, 'Adopted sensitivity cell');
                  pick([0, 0]);
                }}
              >
                Adopt inputs <ArrowUpRight size={14} />
              </button>
              <button
                className="a-btn"
                onClick={() =>
                  download(
                    filename(m) + '-surface.csv',
                    csv([
                      [axis + '; row / column', ...off.map(col)],
                      ...off.map((y, i) => [row(y), ...tableData[i]]),
                    ]),
                    'text/csv',
                  )
                }
              >
                <Download size={14} /> Grid CSV
              </button>
            </div>
          </>
        )}
      </Card>
      <Card kicker="02 / Impact ranking" title="One-point stress test">
        <p>
          Ranked by the largest absolute value change from a
          one-percentage-point shock, holding other assumptions fixed.
        </p>
        <Bars
          items={changes.map(([k, a, b]) => [
            k,
            Math.max(Math.abs(a ?? 0), Math.abs(b ?? 0)),
          ])}
          unit={' ' + m.currency}
        />
        <Table
          heads={['Driver', '−1 pp: Δ / share', '+1 pp: Δ / share']}
          rows={changes.map(([k, a, b]) => [k, n(a), n(b)])}
        />
      </Card>
    </>
  );
}
export function Risk() {
  const { m, r, edit } = useAtlas(),
    key = m.labs?.reverse?.key ?? 'growth',
    target = m.labs?.reverse?.target ?? null,
    spec = Object.fromEntries(
      Object.entries({ ...defaultSim, ...m.labs?.risk }).map(([k, v]) => [
        k,
        v ?? NaN,
      ]),
    ) as SimSpec;
  const setKey = (key: 'growth' | 'margin' | 'wacc') =>
      edit(
        { ...m, labs: { ...m.labs, reverse: { key, target } } },
        'Changed reverse driver',
      ),
    setTarget = (target: number | null) =>
      edit(
        { ...m, labs: { ...m.labs, reverse: { key, target } } },
        'Changed target price',
      );
  const setRisk = (k: keyof SimSpec, v: number | null) =>
    edit(
      { ...m, labs: { ...m.labs, risk: { ...m.labs?.risk, [k]: v } } },
      'Edited simulation ' + k,
    );
  const [simulation, setSimulation] = useState<ReturnType<
      typeof simulate
    > | null>(null),
    [sig, setSig] = useState(''),
    [message, setMessage] = useState('');
  const goal = target ?? m.inputs.price,
    roots = useMemo(
      () => (r && goal !== null ? reverse(m, key, goal) : []),
      [m, r, key, goal],
    ),
    fingerprint = JSON.stringify([m, spec]),
    sim = sig === fingerprint ? simulation : null;
  const task = useRef<Worker | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      task.current?.terminate();
      task.current = null;
    },
    [],
  );
  const stop = () => {
    task.current?.terminate();
    task.current = null;
    setBusy(false);
  };
  const run = () => {
    stop();
    setMessage('');
    setSimulation(null);
    try {
      const worker = new Worker(simulationUrl, { type: 'module' });
      task.current = worker;
      setBusy(true);
      worker.onmessage = (
        event: MessageEvent<{
          result?: ReturnType<typeof simulate>;
          error?: string;
        }>,
      ) => {
        if (task.current !== worker) return;
        if (event.data.result) {
          setSimulation(event.data.result);
          setSig(fingerprint);
        } else setMessage(event.data.error || 'Simulation failed.');
        stop();
      };
      worker.onerror = () => {
        if (task.current === worker) {
          setMessage('The simulation could not start. Run it again.');
          stop();
        }
      };
      worker.postMessage({ model: m, spec });
    } catch {
      stop();
      setMessage('The browser could not start the simulation worker.');
    }
  };
  if (!r) return <Incomplete />;
  const apply = (v: number) => {
    const out = clone(m);
    if (key === 'wacc') {
      out.discount = 'direct';
      out.inputs.wacc = v;
    } else {
      out.inputs[key] = v;
      out.inputs[key === 'growth' ? 'growthEnd' : 'marginEnd'] = v;
      out.overrides.forEach((x) => delete x[key]);
    }
    edit(out, 'Applied reverse DCF solution');
  };
  return (
    <>
      <Card kicker="01 / Implied expectations" title="Solve from the price">
        <div className="a-gridform">
          <label>
            Solve for
            <select
              value={key}
              onChange={(e) => setKey(e.target.value as typeof key)}
            >
              <option value="growth">Constant annual revenue growth</option>
              <option value="margin">Constant operating margin</option>
              <option value="wacc">Discount rate (WACC)</option>
            </select>
          </label>
          <Num
            label="Target price"
            value={goal}
            onChange={setTarget}
            unit={m.currency}
          />
        </div>
        <div className="a-keyline">
          <span>Implied {key}</span>
          <strong>
            {roots.length === 1
              ? pct(roots[0])
              : roots.length
                ? 'Multiple solutions'
                : 'No bracketed solution'}
          </strong>
        </div>
        <p className="a-muted">
          The solver replaces only the selected driver, including its annual
          overrides. Search bounds: growth −40–100%, margin −30–85%, WACC
          0.25–60%.
        </p>
        <button
          className="a-btn"
          disabled={roots.length !== 1}
          onClick={() => apply(roots[0])}
        >
          Apply implied assumption
        </button>
      </Card>
      <Card kicker="02 / Distribution" title="Monte Carlo stress lab">
        <p>
          Draw correlated growth and margin shocks, plus an independent WACC
          shock. Volatilities are standard deviations in percentage points.
          Results describe this experiment, not market probabilities.
        </p>
        <div className="a-gridform">
          {(
            [
              ['growth', 'Growth volatility (pp)'],
              ['margin', 'Margin volatility (pp)'],
              ['rate', 'WACC volatility (pp)'],
              ['rho', 'Growth / margin correlation'],
              ['draws', 'Number of draws'],
              ['seed', 'Random seed'],
            ] as const
          ).map(([k, label]) => (
            <Num
              key={k}
              label={label}
              value={Number.isNaN(spec[k]) ? null : spec[k]}
              onChange={(v) => setRisk(k, v)}
            />
          ))}
        </div>
        <div className="a-tools">
          <button className="a-primary" disabled={busy} onClick={run}>
            <Play size={15} /> {busy ? 'Simulating…' : 'Run simulation'}
          </button>
          {busy && (
            <button
              className="a-btn"
              onClick={() => {
                stop();
                setMessage('Simulation cancelled.');
              }}
            >
              Cancel run
            </button>
          )}
          {sim && (
            <button
              className="a-btn"
              onClick={() =>
                download(
                  filename(m) + '-simulation.csv',
                  csv([
                    [
                      'Sorted sample',
                      'Value/share',
                      'Currency',
                      'Seed',
                      'Requested draws',
                      'Rejected draws',
                      'Growth SD pp',
                      'Margin SD pp',
                      'WACC SD pp',
                      'Growth-margin correlation',
                    ],
                    ...sim.sorted.map((v, i) => [
                      i + 1,
                      v,
                      m.currency,
                      spec.seed,
                      spec.draws,
                      sim.excluded,
                      spec.growth,
                      spec.margin,
                      spec.rate,
                      spec.rho,
                    ]),
                  ]),
                  'text/csv',
                )
              }
            >
              Export samples
            </button>
          )}
        </div>
        {message && <p role="alert">{message}</p>}
        {sim ? (
          <>
            <div className="a-metrics slim">
              {[
                ['P10', sim.p10],
                ['Median', sim.p50],
                ['P90', sim.p90],
              ].map(([k, v]) => (
                <Kpi
                  key={k}
                  label={String(k)}
                  value={cash(Number(v), m.currency)}
                  hint="Value per share"
                />
              ))}
            </div>
            <div className="a-hist">
              {sim.bins.map((b, i) => (
                <div
                  key={i}
                  style={{ height: 4 + (94 * b) / Math.max(...sim.bins) + '%' }}
                  title={b + ' samples'}
                />
              ))}
            </div>
            <div className="a-keyline">
              <span>{cash(sim.min, m.currency)}</span>
              <span>{cash(sim.max, m.currency)}</span>
            </div>
            <p>
              {sim.valid} valid draws · {sim.excluded} excluded for invalid
              assumptions. Percentiles use only valid draws.
            </p>
            <details className="a-disclosure">
              <summary>Histogram data</summary>
              <Table
                heads={['From', 'To', 'Draws']}
                rows={sim.bins.map((b, i) => [
                  n(sim.min + ((sim.max - sim.min) * i) / 15),
                  n(sim.min + ((sim.max - sim.min) * (i + 1)) / 15),
                  b,
                ])}
              />
            </details>
          </>
        ) : (
          <p className="a-muted">
            {simulation
              ? 'Inputs changed. Run again to refresh the distribution.'
              : 'Run to generate a reproducible distribution.'}
          </p>
        )}
      </Card>
      <HoldingPeriod />
    </>
  );
}
function HoldingPeriod() {
  const { m, r, edit } = useAtlas(),
    h = m.labs?.holding ?? {};
  const val = (k: keyof typeof h, d: number | null) =>
    h[k] === undefined ? d : h[k]!;
  const a = {
    entry: val('entry', m.inputs.price),
    exit: val('exit', null),
    annual: val('annual', 0),
    years: val('years', 5),
  };
  let rate: number | null = null,
    msg = '';
  try {
    rate = holdingReturn(
      a.entry ?? NaN,
      a.exit ?? NaN,
      a.annual ?? NaN,
      a.years ?? NaN,
    );
  } catch (e) {
    msg = (e as Error).message;
  }
  const set = (k: keyof typeof h, v: number | null) =>
    edit(
      { ...m, labs: { ...m.labs, holding: { ...h, [k]: v } } },
      'Edited holding-period ' + k,
    );
  return (
    <Card kicker="03 / Investor returns" title="Holding-period IRR">
      <p>
        Estimate an investor’s annual return from a purchase price, equal
        year-end cash distributions and a sale at the end of the holding period.
        Supply a future sale price; today’s intrinsic value is not an exit
        forecast.
      </p>
      <div className="a-gridform">
        {(
          [
            ['entry', 'Entry price'],
            ['exit', 'Expected exit price'],
            ['annual', 'Annual distribution / share'],
            ['years', 'Holding years'],
          ] as const
        ).map(([k, l]) => (
          <Num
            key={k}
            label={l}
            value={a[k]}
            unit={k === 'years' ? 'years' : m.currency}
            onChange={(v) => set(k, v)}
          />
        ))}
      </div>
      <div className="a-keyline">
        <span>Annualized investor IRR</span>
        <b>{pct(rate)}</b>
      </div>
      {msg && <p className="a-muted">{msg}</p>}
      {r && (
        <p className="a-muted">
          Current modeled value: {cash(r.perShare, m.currency)} per share.
        </p>
      )}
    </Card>
  );
}
