'use client';
import { useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { fields } from '@/lib/atlas/model';
import { useAtlas } from './context';
import { Incomplete } from './model-views';
import { Card, Kpi, Table, cash, n, pct } from './ui';
import {
  ChartInspector,
  ForecastChart,
  BridgeChart,
  DependenceChart,
  steps,
} from './overview-charts';

export function Overview() {
  const { m, r, period, setPeriod, go, edit } = useAtlas();
  const [haircut, setHaircut] = useState(20);
  if (!r) return <Incomplete />;
  const idx = Math.max(0, Math.min(period, r.rows.length - 1)),
    row = r.rows[idx],
    unit = m.currency + ' m';
  return (
    <ChartInspector>
      <div className="ao-frame">
        <div className="ao-grid" aria-label="Valuation overview">
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
          {(['cash', 'operations', 'rates'] as const).map((kind) => (
            <ForecastChart
              key={kind}
              kind={kind}
              result={r}
              model={m}
              index={idx}
              select={setPeriod}
            />
          ))}
          <BridgeChart row={row} currency={m.currency} />
          <Card
            className="ao-tile ao-dependence"
            kicker="05 / Value composition"
            title="Terminal dependence"
          >
            <DependenceChart r={r} m={m} />
            <div className="ao-stat">
              <span>Forecast PV</span>
              <b>{n(r.explicit)}m</b>
            </div>
            <div className="ao-stat">
              <span>Terminal PV</span>
              <b>{n(r.terminalPV)}m</b>
            </div>
            <button
              className="a-link ao-link"
              onClick={() => go('Sensitivity')}
            >
              Stress assumptions <ArrowUpRight size={13} />
            </button>
          </Card>
          <Card
            className="ao-tile ao-safety"
            kicker="06 / Price discipline"
            title="Margin of safety"
          >
            <div className="ao-value">{pct(r.safety)}</div>
            <p>Discount from model value to the reference price.</p>
            <label className="ao-range">
              <span>
                Target discount <b>{haircut}%</b>
              </span>
              <input
                aria-label="Target discount"
                type="range"
                min="0"
                max="60"
                value={haircut}
                onChange={(e) => setHaircut(Number(e.target.value))}
              />
            </label>
            <div className="ao-stat">
              <span>Target price</span>
              <b>
                {r.perShare > 0
                  ? cash(r.perShare * (1 - haircut / 100), m.currency)
                  : 'N/A'}
              </b>
            </div>
          </Card>
          <Card
            className="ao-tile ao-drivers"
            kicker="07 / Assumptions"
            title="Tune forecast drivers"
          >
            <p>
              Adjust a driver to recalculate every chart. Annual overrides take
              priority.
            </p>
            <div className="ao-driver-sliders">
              {(['growth', 'margin', 'capex'] as const).map((k) => (
                <label className="ao-range" key={k}>
                  <span>
                    {fields[k][0]} <b>{pct(m.inputs[k])}</b>
                  </span>
                  <input
                    aria-label={fields[k][0]}
                    type="range"
                    min={Math.min(
                      k === 'growth' ? -30 : k === 'margin' ? -20 : 0,
                      m.inputs[k] ?? 0,
                    )}
                    max={Math.max(k === 'capex' ? 45 : 70, m.inputs[k] ?? 0)}
                    step=".01"
                    value={m.inputs[k] ?? 0}
                    onChange={(e) =>
                      edit(
                        {
                          ...m,
                          inputs: { ...m.inputs, [k]: Number(e.target.value) },
                        },
                        fields[k][0],
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </Card>
          <Card
            className="ao-tile ao-ledger"
            kicker="08 / Annual figures"
            title="Forecast by year"
            action={
              <div
                className="ao-period"
                role="group"
                aria-label="Selected fiscal year"
              >
                <button
                  className="a-icon"
                  aria-label="Previous overview year"
                  disabled={idx === 0}
                  onClick={() => setPeriod(idx - 1)}
                >
                  <ChevronLeft size={15} />
                </button>
                <b>FY{row.year}</b>
                <button
                  className="a-icon"
                  aria-label="Next overview year"
                  disabled={idx === r.rows.length - 1}
                  onClick={() => setPeriod(idx + 1)}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            }
          >
            <p className="ao-note">
              Amounts in {unit}. Select a year to inspect the bridge.
            </p>
            <Table
              caption="Overview annual forecast"
              heads={[
                'Fiscal year',
                'Revenue',
                'Sales growth',
                'EBIT',
                'EBIT margin',
                'Free cash flow',
                'PV of FCF',
              ]}
              rows={r.rows.map((v, i) => [
                <button
                  key={v.year}
                  className="ao-year"
                  aria-pressed={i === idx}
                  aria-label={'Inspect FY' + v.year}
                  onClick={() => setPeriod(i)}
                >
                  FY{v.year}
                </button>,
                n(v.sales),
                pct(v.growth),
                n(v.ebit),
                pct(v.margin),
                n(v.fcff),
                n(v.pv),
              ])}
            />
          </Card>
          <Card
            className="ao-tile ao-bridge-table"
            kicker="09 / Bridge figures"
            title={'Cash bridge · FY' + row.year}
          >
            <p className="ao-note">{unit} · signed cash movements</p>
            <Table
              caption={'Cash-flow bridge figures for FY' + row.year}
              heads={['Item', 'Change', 'Balance']}
              rows={steps(row, m.currency).map((s) => [
                s.name,
                n(s.v),
                n(s.end),
              ])}
            />
          </Card>
        </div>
      </div>
    </ChartInspector>
  );
}
