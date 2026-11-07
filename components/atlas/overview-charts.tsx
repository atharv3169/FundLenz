'use client';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Model, Result, Row } from '@/lib/atlas/model';
import { Card, n, pct } from './ui';

type Selection = { index: number; track: number };
type Active = Selection & { id: string; input: 'hover' | 'touch' | 'keys' };
type Mark = {
  x: number;
  y: number;
  label: string;
  value: string;
  insight: string;
};
const Inspector = createContext<{
  active: Active | null;
  show: (a: Active) => void;
  clear: () => void;
} | null>(null);
export function ChartInspector({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const id = active?.id;
  useEffect(() => {
    if (!id) return;
    const outside = (e: PointerEvent) => {
      if (
        !(e.target instanceof Element) ||
        e.target
          .closest('[data-chart-inspector]')
          ?.getAttribute('data-chart-inspector') !== id
      )
        setActive(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null);
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape);
    };
  }, [id]);
  return (
    <Inspector.Provider
      value={{
        active,
        show: (a) =>
          setActive((old) =>
            old?.id === a.id &&
            old.index === a.index &&
            old.track === a.track &&
            old.input === a.input
              ? old
              : a,
          ),
        clear: () => setActive(null),
      }}
    >
      {children}
    </Inspector.Provider>
  );
}
const bound = (v: number, hi: number) => Math.max(0, Math.min(v, hi));
const amount = (v: number, unit: string) => unit + ' ' + n(v) + 'm';
const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** The tooltip is anchored in chart coordinates, not to the pointer. All input modes inspect the same mark. */
function Surface({
  id,
  title,
  width,
  height,
  fallback,
  getMark,
  hit,
  move,
  choose,
  help,
  children,
}: {
  id: string;
  title: string;
  width: number;
  height: number;
  fallback: Selection;
  getMark: (p: Selection) => Mark;
  hit: (x: number, y: number) => Selection;
  move: (p: Selection, key: string) => Selection;
  choose?: (p: Selection) => void;
  help: string;
  children: (p: Selection, inspecting: boolean) => ReactNode;
}) {
  const ctx = useContext(Inspector)!;
  const tip = useId(),
    instructions = useId();
  const contact = useRef<{ x: number; y: number } | null>(null);
  const active = ctx.active?.id === id ? ctx.active : null;
  const p = active ?? fallback,
    mark = getMark(p);
  const open = (p: Selection, input: Active['input']) => {
    choose?.(p);
    ctx.show({ id, ...p, input });
  };
  const locate = (event: ReactPointerEvent<HTMLDivElement>) => {
    const svg = event.currentTarget.querySelector('svg')!;
    const box = svg.getBoundingClientRect();
    return hit(
      ((event.clientX - box.left) * width) / Math.max(1, box.width),
      ((event.clientY - box.top) * height) / Math.max(1, box.height),
    );
  };
  return (
    <div
      className="ao-surface"
      data-chart-inspector={id}
      role="group"
      tabIndex={0}
      aria-label={title + ', interactive chart'}
      aria-describedby={active ? instructions + ' ' + tip : instructions}
      onFocus={(e) => {
        if (e.currentTarget.matches(':focus-visible')) open(fallback, 'keys');
      }}
      onBlur={() => {
        if (active) ctx.clear();
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'touch') open(locate(e), 'hover');
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch')
          contact.current = { x: e.clientX, y: e.clientY };
        else open(locate(e), 'hover');
      }}
      onPointerCancel={() => {
        contact.current = null;
      }}
      onPointerUp={(e) => {
        const start = contact.current;
        contact.current = null;
        if (
          e.pointerType === 'touch' &&
          start &&
          Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10
        )
          open(locate(e), 'touch');
      }}
      onPointerLeave={() => {
        if (active?.input === 'hover') ctx.clear();
      }}
      onKeyDown={(e) => {
        if (
          [
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Home',
            'End',
            'Enter',
            ' ',
          ].includes(e.key)
        ) {
          e.preventDefault();
          open(move(p, e.key), 'keys');
        }
      }}
    >
      <span className="a-sr" id={instructions}>
        {help} Press Escape to dismiss.
      </span>
      <svg
        viewBox={'0 0 ' + width + ' ' + height}
        aria-hidden="true"
        focusable="false"
      >
        {children(p, !!active)}
      </svg>
      {active && (
        <div
          className={'ao-tip ' + (mark.y / height < 0.38 ? 'ao-tip-below' : '')}
          role="tooltip"
          id={tip}
          style={{
            left:
              'clamp(0px, calc(' +
              bound(mark.x / width, 1) * 100 +
              '% - 88px), max(0px, calc(100% - 176px)))',
            top: bound(mark.y / height, 1) * 100 + '%',
          }}
        >
          <span>{mark.label}</span>
          <strong>{mark.value}</strong>
          <p>{mark.insight}</p>
        </div>
      )}
      <span className="a-sr" aria-live="polite" aria-atomic="true">
        {active?.input === 'keys'
          ? mark.label + '. ' + mark.value + '. ' + mark.insight
          : ''}
      </span>
    </div>
  );
}

type Trace = {
  name: string;
  value: (r: Row) => number;
  explain: (r: Row, i: number) => string;
};
export function ForecastChart({
  kind,
  result,
  model,
  index,
  select,
}: {
  kind: 'cash' | 'operations' | 'rates';
  result: Result;
  model: Model;
  index: number;
  select: (i: number) => void;
}) {
  const { rows } = result,
    currency = model.currency,
    money = (x: number) => amount(x, currency);
  const signed = (v: number) =>
    v === 0
      ? 'unchanged'
      : v > 0
        ? 'up ' + n(v) + ' percentage points'
        : 'down ' + n(-v) + ' percentage points';
  const spec: Record<
    typeof kind,
    { title: string; kicker: string; traces: Trace[] }
  > = {
    cash: {
      title: 'Cash-flow outlook',
      kicker: '01 / Cash generation',
      traces: [
        {
          name: 'Free cash flow',
          value: (r) => r.fcff,
          explain: (r) =>
            r.fcff < 0
              ? 'Operations and reinvestment consume ' +
                money(-r.fcff) +
                ' this year.'
              : pct((100 * r.fcff) / r.sales) +
                ' of forecast sales converts to free cash flow.',
        },
        {
          name: 'Present value',
          value: (r) => r.pv,
          explain: (r) =>
            'Discounting at ' +
            pct(result.w) +
            ' gives each unit of this year’s cash flow ' +
            n(r.factor, 3) +
            ' units of present value.',
        },
      ],
    },
    operations: {
      title: 'Operating performance',
      kicker: '02 / Operations',
      traces: [
        {
          name: 'Revenue',
          value: (r) => r.sales,
          explain: (r) =>
            r.growth === 0
              ? 'Sales are unchanged from the preceding fiscal year.'
              : 'Sales are ' +
                pct(Math.abs(r.growth)) +
                (r.growth > 0 ? ' higher' : ' lower') +
                ' than FY' +
                (r.year - 1) +
                '.',
        },
        {
          name: 'Operating profit',
          value: (r) => r.ebit,
          explain: (r) =>
            r.ebit < 0
              ? 'The operating loss equals ' +
                pct(Math.abs(r.margin)) +
                ' of sales before interest and tax.'
              : 'Operating profit is ' +
                pct(r.margin) +
                ' of sales before interest and tax.',
        },
      ],
    },
    rates: {
      title: 'Growth & margins',
      kicker: '03 / Operating rates',
      traces: [
        {
          name: 'Sales growth',
          value: (r) => r.growth,
          explain: (r, i) => {
            const delta =
              r.sales - (i ? rows[i - 1].sales : model.inputs.revenue!);
            return delta === 0
              ? 'Forecast revenue is flat.'
              : 'Revenue ' +
                  (delta > 0 ? 'rises' : 'falls') +
                  ' by ' +
                  money(Math.abs(delta)) +
                  ' from FY' +
                  (r.year - 1) +
                  '.';
          },
        },
        {
          name: 'EBIT margin',
          value: (r) => r.margin,
          explain: (r, i) => {
            if (!i)
              return r.margin < 0
                ? 'Each 100 of sales generates an operating loss of ' +
                    n(-r.margin) +
                    '.'
                : 'Each 100 of sales generates ' +
                    n(r.margin) +
                    ' of operating profit.';
            return (
              'Operating margin is ' +
              signed(r.margin - rows[i - 1].margin) +
              ' from FY' +
              rows[i - 1].year +
              '.'
            );
          },
        },
      ],
    },
  };
  const { title, kicker, traces } = spec[kind],
    isRate = kind === 'rates',
    fmt = (v: number) => (isRate ? pct(v) : money(v));
  const [hidden, setHidden] = useState<number | null>(null),
    ctx = useContext(Inspector)!;
  const visible = [0, 1].filter((j) => j !== hidden);
  const id = useId().replace(/:/g, '');
  const values = visible.flatMap((j) => rows.map(traces[j].value)),
    lo = Math.min(0, ...values),
    hi = Math.max(0, ...values),
    span = hi - lo || 1;
  const W = 256,
    H = 118,
    L = 40,
    R = 17,
    T = 10,
    B = 96;
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, rows.length - 1),
    y = (v: number) => B - ((B - T) * (v - lo)) / span;
  const first = visible[0],
    colors = ['#087d70', '#a96628'];
  const normalize = (p: Selection) => ({
    index: bound(p.index, rows.length - 1),
    track: visible.includes(p.track) ? p.track : first,
  });
  const points = (j: number) =>
    rows
      .map((r, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(traces[j].value(r)))
      .join(' ');
  return (
    <Card className="ao-tile ao-trace" title={title} kicker={kicker}>
      <div className="ao-chart-meta">
        <span>{isRate ? 'Percent' : currency + ' · millions'}</span>
        <b>FY{rows[index].year}</b>
      </div>
      <Surface
        id={kind}
        title={title}
        width={W}
        height={H}
        fallback={{ index, track: first }}
        help="Hover or tap a point. Left and right change the fiscal year; up and down switch the series."
        choose={(p) => {
          if (p.index !== index) select(p.index);
        }}
        getMark={(raw) => {
          const p = normalize(raw),
            r = rows[p.index],
            s = traces[p.track],
            v = s.value(r);
          return {
            x: x(p.index),
            y: y(v),
            label: s.name + ' · FY' + r.year,
            value: fmt(v),
            insight: s.explain(r, p.index),
          };
        }}
        hit={(px, py) => {
          const i = bound(
            Math.round(((px - L) / (W - L - R)) * (rows.length - 1)),
            rows.length - 1,
          );
          const j = visible.reduce((a, b) =>
            Math.abs(y(traces[b].value(rows[i])) - py) <
            Math.abs(y(traces[a].value(rows[i])) - py)
              ? b
              : a,
          );
          return { index: i, track: j };
        }}
        move={(raw, key) => {
          const p = normalize(raw);
          return {
            index:
              key === 'Home'
                ? 0
                : key === 'End'
                  ? rows.length - 1
                  : bound(
                      p.index +
                        (key === 'ArrowRight'
                          ? 1
                          : key === 'ArrowLeft'
                            ? -1
                            : 0),
                      rows.length - 1,
                    ),
            track:
              key === 'ArrowUp' || key === 'ArrowDown'
                ? (visible.find((j) => j !== p.track) ?? p.track)
                : p.track,
          };
        }}
      >
        {(raw, hot) => {
          const p = normalize(raw);
          return (
            <>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={colors[first]} stopOpacity=".2" />
                  <stop
                    offset="1"
                    stopColor={colors[first]}
                    stopOpacity=".02"
                  />
                </linearGradient>
              </defs>
              {[0, 0.5, 1].map((f) => (
                <g key={f}>
                  <line
                    className="ao-guide"
                    x1={L}
                    x2={W - R}
                    y1={B - (B - T) * f}
                    y2={B - (B - T) * f}
                  />
                  <text x={L - 5} y={B - (B - T) * f + 3} textAnchor="end">
                    {compact.format(lo + span * f)}
                    {isRate ? '%' : ''}
                  </text>
                </g>
              ))}
              <path
                d={
                  points(first) +
                  ' L' +
                  x(rows.length - 1) +
                  ' ' +
                  y(0) +
                  ' L' +
                  x(0) +
                  ' ' +
                  y(0) +
                  ' Z'
                }
                fill={'url(#' + id + ')'}
              />
              {visible.map((j) => (
                <path
                  key={j}
                  d={points(j)}
                  stroke={colors[j]}
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeDasharray={j ? '5 3' : undefined}
                  fill="none"
                />
              ))}
              <line
                x1={x(p.index)}
                x2={x(p.index)}
                y1={T}
                y2={B}
                stroke="#8aa49b"
                strokeDasharray="2 3"
              />
              {visible.map((j) =>
                rows.map((r, i) => (
                  <circle
                    key={j + ':' + i}
                    data-point={j + ':' + i}
                    cx={x(i)}
                    cy={y(traces[j].value(r))}
                    r={i === p.index ? (hot && p.track === j ? 4.5 : 3) : 1.8}
                    stroke={colors[j]}
                    strokeWidth={i === p.index ? 1.8 : 1}
                    fill={i === p.index ? '#fffdf8' : colors[j]}
                  />
                )),
              )}
              {rows.map((r, i) =>
                i === 0 ||
                i === rows.length - 1 ||
                i === Math.floor((rows.length - 1) / 2) ? (
                  <text key={r.year} x={x(i)} y="112" textAnchor="middle">
                    FY{String(r.year).slice(-2)}
                  </text>
                ) : null,
              )}
            </>
          );
        }}
      </Surface>
      <div className="ao-legend">
        {traces.map((s, j) => (
          <button
            key={s.name}
            type="button"
            aria-pressed={visible.includes(j)}
            onClick={() => {
              if (hidden === 1 - j) return;
              ctx.clear();
              setHidden(hidden === j ? null : j);
            }}
          >
            <i style={{ background: colors[j] }} />
            {s.name}
          </button>
        ))}
      </div>
    </Card>
  );
}

export function steps(row: Row, currency: string) {
  const data = [
    {
      name: 'NOPAT',
      full: 'After-tax operating profit',
      v: row.nopat,
      why:
        'Operating profit after ' +
        amount(row.taxes, currency) +
        ' in cash taxes.',
    },
    {
      name: 'D&A',
      full: 'Depreciation & amortization',
      v: row.da,
      why: 'This non-cash expense is added back to operating profit.',
    },
    {
      name: 'Capex',
      full: 'Capital expenditure',
      v: -row.capex,
      why: 'Spending on long-lived assets is deducted from cash flow.',
    },
    {
      name: 'ΔNWC',
      full: 'Working capital change',
      v: -row.delta,
      why:
        row.delta > 0
          ? 'More cash is tied up in operating working capital.'
          : row.delta < 0
            ? 'Lower operating working capital releases cash.'
            : 'Operating working capital has not changed.',
    },
  ];
  const bridge: ((typeof data)[number] & { start: number; end: number })[] = [];
  for (const d of data) {
    const start = bridge.at(-1)?.end ?? 0;
    bridge.push({ ...d, start, end: start + d.v });
  }
  return [
    ...bridge,
    {
      name: 'FCFF',
      full: 'Free cash flow',
      v: row.fcff,
      start: 0,
      end: row.fcff,
      why: 'Cash available to all capital providers after operations and reinvestment.',
    },
  ];
}
function stepAlong(p: Selection, key: string, count: number) {
  return {
    index:
      key === 'Home'
        ? 0
        : key === 'End'
          ? count - 1
          : bound(
              p.index +
                (['ArrowRight', 'ArrowUp'].includes(key)
                  ? 1
                  : ['ArrowLeft', 'ArrowDown'].includes(key)
                    ? -1
                    : 0),
              count - 1,
            ),
    track: 0,
  };
}
export function BridgeChart({ row, currency }: { row: Row; currency: string }) {
  const data = steps(row, currency),
    W = 256,
    H = 118,
    L = 11,
    gap = 47;
  const lo = Math.min(0, ...data.map((d) => Math.min(d.start, d.end))),
    hi = Math.max(0, ...data.map((d) => Math.max(d.start, d.end)));
  const y = (v: number) => 92 - ((v - lo) / (hi - lo || 1)) * 72;
  return (
    <Card
      className="ao-tile ao-bridge"
      kicker="04 / Cash bridge"
      title="From profit to free cash"
    >
      <div className="ao-chart-meta">
        <span>{currency} · millions</span>
        <b>FY{row.year}</b>
      </div>
      <Surface
        id="bridge"
        title="Cash-flow bridge"
        width={W}
        height={H}
        fallback={{ index: 4, track: 0 }}
        help="Hover or tap a bar. Use the arrow keys to inspect each bridge component."
        getMark={(p) => {
          const d = data[p.index];
          return {
            x: L + p.index * gap + 15,
            y: y(Math.max(d.start, d.end)),
            label: d.full + ' · FY' + row.year,
            value: amount(d.v, currency),
            insight: d.why,
          };
        }}
        hit={(x) => ({
          index: bound(Math.round((x - L - 15) / gap), 4),
          track: 0,
        })}
        move={(p, k) => stepAlong(p, k, 5)}
      >
        {(p, hot) => (
          <>
            <line className="ao-guide" x1="5" x2="249" y1={y(0)} y2={y(0)} />
            {data.map((d, i) => (
              <g key={d.name}>
                <rect
                  data-bar={i}
                  x={L + i * gap}
                  width="30"
                  y={Math.min(y(d.end), y(d.start))}
                  height={Math.max(2, Math.abs(y(d.end) - y(d.start)))}
                  rx="2"
                  fill={i === 4 ? '#294653' : d.v < 0 ? '#ba7452' : '#319a84'}
                  stroke={hot && p.index === i ? '#173e39' : 'none'}
                  strokeWidth="2"
                />
                {i < 4 && (
                  <line
                    x1={L + i * gap + 30}
                    x2={L + (i + 1) * gap}
                    y1={y(d.end)}
                    y2={y(d.end)}
                    stroke="#a0b6ae"
                    strokeDasharray="2 2"
                  />
                )}
                <text x={L + i * gap + 15} y="111" textAnchor="middle">
                  {d.name}
                </text>
              </g>
            ))}
          </>
        )}
      </Surface>
      <div className="ao-bridge-caption">
        <span>Free cash flow</span>
        <b>{amount(row.fcff, currency)}</b>
      </div>
    </Card>
  );
}

export function DependenceChart({ r, m }: { r: Result; m: Model }) {
  const p = r.terminalShare;
  if (p === null || p < 0 || p > 100)
    return (
      <p>
        Terminal share: {pct(p)}. The signed cash flows cannot be shown as parts
        of a whole.
      </p>
    );
  const angle = (value: number) => (value / 100) * 2 * Math.PI - Math.PI / 2;
  const end = r.rows.at(-1)!.year,
    rad = 29.5,
    cx = 43,
    cy = 44,
    C = 2 * Math.PI * rad;
  return (
    <Surface
      id="dependence"
      title="Terminal dependence"
      width={235}
      height={87}
      fallback={{ index: 0, track: 0 }}
      help="Hover or tap a segment or its label. Use the arrow keys to compare terminal and forecast value."
      hit={(x, y) => {
        if (x > 83) return { index: y < 43 ? 0 : 1, track: 0 };
        const a =
          (Math.atan2(y - cy, x - cx) + Math.PI / 2 + Math.PI * 2) %
          (Math.PI * 2);
        return { index: (a / (2 * Math.PI)) * 100 < p ? 0 : 1, track: 0 };
      }}
      move={(i, k) => stepAlong(i, k, 2)}
      getMark={(sel) => {
        const isTerm = sel.index === 0,
          a = angle(isTerm ? p / 2 : p + (100 - p) / 2);
        return {
          x: cx + rad * Math.cos(a),
          y: cy + rad * Math.sin(a),
          label: isTerm ? 'Terminal contribution' : 'Explicit forecast',
          value: amount(isTerm ? r.terminalPV : r.explicit, m.currency),
          insight: isTerm
            ? pct(p) +
              ' of operating value comes from the terminal estimate at FY' +
              end +
              '.'
            : pct(100 - p) +
              ' of operating value comes from discounted annual cash flows through FY' +
              end +
              '.',
        };
      }}
    >
      {(sel, hot) => (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={rad}
            fill="none"
            stroke="#cac3a3"
            strokeWidth={hot && sel.index === 1 ? 11 : 9}
          />
          <circle
            cx={cx}
            cy={cy}
            r={rad}
            fill="none"
            stroke="#137a65"
            strokeWidth={hot && sel.index === 0 ? 11 : 9}
            strokeDasharray={(C * p) / 100 + ' ' + C}
            transform={'rotate(-90 ' + cx + ' ' + cy + ')'}
          />
          <text
            className="ao-ring-number"
            x={cx}
            y={cy + 5}
            textAnchor="middle"
          >
            {n(p, 0)}%
          </text>
          {[
            ['Terminal', p, '#137a65'],
            ['Forecast', 100 - p, '#a49a68'],
          ].map(([l, v, c], i) => (
            <g key={String(l)}>
              <circle cx="95" cy={28 + i * 30} r="3" fill={String(c)} />
              <text className="ao-ring-key" x="104" y={32 + i * 30}>
                {l}
              </text>
              <text
                className="ao-ring-pct"
                x="226"
                y={32 + i * 30}
                textAnchor="end"
              >
                {pct(Number(v))}
              </text>
            </g>
          ))}
        </>
      )}
    </Surface>
  );
}
