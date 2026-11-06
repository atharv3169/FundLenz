'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
export const n = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v)
    ? 'N/A'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(v);
export const cash = (v: number | null | undefined, c = 'USD') =>
  v == null
    ? 'N/A'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: c,
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(v);
export const pct = (v: number | null | undefined) =>
  v == null ? 'N/A' : n(v) + '%';
export const palette = ['#087c70', '#b27736', '#486eab', '#8c5989'];
export function Card({
  kicker,
  title,
  action,
  children,
  className = '',
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={'atlas-card ' + className}>
      <div className="a-cardhead">
        <div>
          {kicker && <div className="a-over">{kicker}</div>}
          <h3>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="a-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}
export function Table({
  heads,
  rows,
  caption,
}: {
  heads: string[];
  rows: ReactNode[][];
  caption?: string;
}) {
  return (
    <div
      className="a-scroll"
      tabIndex={0}
      role="region"
      aria-label={caption || heads.join(', ')}
    >
      <table>
        <caption className="a-sr">{caption || heads.join(', ')}</caption>
        <thead>
          <tr>
            {heads.map((h, i) => (
              <th scope="col" key={i}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) =>
                j === 0 ? (
                  <th scope="row" key={j}>
                    {v}
                  </th>
                ) : (
                  <td key={j}>{v}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function AtlasArt() {
  const paths: string[] = [];
  for (let level = 0; level < 28; level++) {
    const points: string[] = [];
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2,
        rad = 19 + level * 3.95,
        scale =
          1 +
          0.13 * Math.sin(3 * a + 0.55) +
          0.08 * Math.cos(5 * a + level * 0.025) +
          0.09 * Math.sin(2 * a + 0.3);
      points.push(
        (i ? 'L' : 'M') +
          (
            167 +
            Math.cos(a) * rad * scale * 1.56 +
            Math.sin(a) * rad * 0.35
          ).toFixed(1) +
          ' ' +
          (99 + Math.sin(a) * rad * scale * 0.85).toFixed(1),
      );
    }
    paths.push(points.join(' ') + 'Z');
  }
  return (
    <svg className="a-atlas-art" viewBox="0 0 360 210" aria-hidden="true">
      <defs>
        <pattern
          id="atlas-graticule"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M28 0H0V28"
            fill="none"
            stroke="#b5ddd0"
            opacity=".22"
            strokeWidth=".6"
          />
        </pattern>
      </defs>
      <rect width="360" height="210" fill="url(#atlas-graticule)" />
      {paths.map((p, i) => (
        <path
          key={i}
          d={p}
          stroke={i % 5 === 0 ? '#c7cf9c' : '#78bdab'}
          strokeWidth={i % 5 === 0 ? 1.45 : 0.68}
          opacity={0.64}
          fill="none"
        />
      ))}
      <circle cx="166" cy="98" r="3" fill="#f6d79b" />
      <path d="M166 98l30-40h35" stroke="#edd298" fill="none" />
      <text x="235" y="60" fill="#e8dbb9" fontSize="7" letterSpacing="1.4">
        ATLAS / 01
      </text>
      <path d="M320 35v30m-4-24 4-8 4 8" stroke="#c9e9df" fill="none" />
      <text x="317" y="29" fontSize="8" fill="#c9e9df">
        N
      </text>
    </svg>
  );
}
export interface Series {
  name: string;
  values: number[];
}
export function Plot({
  labels,
  series,
  unit,
  at,
  onSelect,
}: {
  labels: string[];
  series: Series[];
  unit: string;
  at: number;
  onSelect: (i: number) => void;
}) {
  const [off, setOff] = useState<string[]>([]);
  const id = useId().replace(/:/g, '');
  const active = series.filter((s) => !off.includes(s.name)),
    visible = active.length ? active : series.slice(0, 1);
  if (!labels.length) return <p>No periods available.</p>;
  const index = Math.min(Math.max(at, 0), labels.length - 1),
    values = visible.flatMap((s) => s.values),
    min = Math.min(...values, 0),
    max = Math.max(...values, 0),
    range = max - min || 1;
  const W = 660,
    H = 230,
    L = 65,
    R = 18,
    T = 18,
    B = 38,
    X = (i: number) => L + ((W - L - R) * i) / Math.max(1, labels.length - 1),
    Y = (v: number) => T + ((max - v) / range) * (H - T - B),
    compact = (x: number) =>
      Intl.NumberFormat('en', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(x);
  const points = (s: Series) =>
    s.values.map((v, i) => (i ? 'L' : 'M') + X(i) + ' ' + Y(v)).join(' ');
  return (
    <div className="a-plot">
      <div className="a-legend">
        {series.map((s, i) => (
          <button
            key={s.name}
            aria-pressed={visible.includes(s)}
            onClick={() => {
              if (visible.includes(s) && visible.length === 1) return;
              setOff(
                visible.includes(s)
                  ? [...off, s.name]
                  : off.filter((k) => k !== s.name),
              );
            }}
          >
            <i style={{ background: palette[i % 4] }} />
            {s.name}
          </button>
        ))}
        <small>{unit}</small>
      </div>
      <svg
        className="a-series"
        viewBox={'0 0 ' + W + ' ' + H}
        aria-label={
          'Forecast chart in ' + unit + '; use the year controls or data table'
        }
        role="img"
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect(),
            f = (e.clientX - box.left) / box.width;
          onSelect(
            Math.max(
              0,
              Math.min(
                labels.length - 1,
                Math.round(((f * W - L) / (W - L - R)) * (labels.length - 1)),
              ),
            ),
          );
        }}
      >
        <defs>
          <linearGradient id={id + 'fill'} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              stopColor={palette[series.indexOf(visible[0]) % 4]}
              stopOpacity=".22"
            />
            <stop offset="1" stopColor="#b5e4d8" stopOpacity=".04" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((k) => (
          <g key={k}>
            <line
              x1={L}
              x2={W - R}
              y1={Y(min + range * k)}
              y2={Y(min + range * k)}
              stroke="#ccdad7"
              strokeDasharray="2 5"
            />
            <text x={L - 9} y={Y(min + range * k) + 4} textAnchor="end">
              {compact(min + range * k)}
            </text>
          </g>
        ))}
        <path
          d={
            points(visible[0]) +
            'L' +
            X(labels.length - 1) +
            ' ' +
            Y(min) +
            'L' +
            X(0) +
            ' ' +
            Y(min) +
            'Z'
          }
          fill={'url(#' + id + 'fill)'}
        />
        {visible.map((s) => (
          <path
            key={s.name}
            d={points(s)}
            stroke={palette[series.indexOf(s) % 4]}
            strokeWidth="3"
            fill="none"
            strokeLinejoin="round"
            strokeDasharray={series.indexOf(s) % 2 ? '7 4' : undefined}
          />
        ))}
        <line
          x1={X(index)}
          x2={X(index)}
          y1={T}
          y2={H - B}
          stroke="#718d86"
          strokeDasharray="3 4"
        />
        {visible.map((s) => (
          <circle
            key={s.name}
            cx={X(index)}
            cy={Y(s.values[index])}
            r="4.6"
            fill="white"
            strokeWidth="2.5"
            stroke={palette[series.indexOf(s) % 4]}
          />
        ))}
        {labels.map((label, i) => (
          <text key={i} x={X(i)} y={H - 13} textAnchor="middle">
            {label}
          </text>
        ))}
      </svg>
      <div className="a-readout">
        <button
          aria-label="Previous chart period"
          disabled={index === 0}
          onClick={() => onSelect(index - 1)}
        >
          <ChevronLeft size={14} />
        </button>
        <b>{labels[index]}</b>
        <button
          aria-label="Next chart period"
          disabled={index === labels.length - 1}
          onClick={() => onSelect(index + 1)}
        >
          <ChevronRight size={14} />
        </button>
        {visible.map((s) => (
          <span key={s.name}>
            {s.name} <b>{n(s.values[index])}</b>
          </span>
        ))}
      </div>
      <details className="a-disclosure">
        <summary>
          Chart data <ChevronDown size={13} />
        </summary>
        <Table
          heads={['Period', ...series.map((s) => s.name + ' (' + unit + ')')]}
          rows={labels.map((l, i) => [l, ...series.map((s) => n(s.values[i]))])}
        />
      </details>
    </div>
  );
}
export function Bars({
  items,
  unit = '',
}: {
  items: [string, number][];
  unit?: string;
}) {
  const max = Math.max(...items.map((x) => Math.abs(x[1])), 0.000001);
  return (
    <div className="a-bars">
      {items.map(([s, v]) => (
        <div className="a-barrow" key={s}>
          <span>{s}</span>
          <div className="a-track">
            <i
              style={{
                width: (Math.abs(v) / max) * 100 + '%',
                background: v < 0 ? '#b76c52' : undefined,
              }}
            />
          </div>
          <b>
            {n(v)}
            {unit}
          </b>
        </div>
      ))}
    </div>
  );
}
export function Waterfall({
  items,
  unit,
}: {
  items: [string, number][];
  unit: string;
}) {
  const seg: { s: string; v: number; start: number; end: number }[] = [];
  for (const [s, v] of items) {
    const start = seg.at(-1)?.end ?? 0;
    seg.push({ s, v, start, end: start + v });
  }
  const total = seg.at(-1)?.end ?? 0;
  seg.push({ s: 'Total', v: total, start: 0, end: total });
  const min = Math.min(0, ...seg.map((x) => Math.min(x.start, x.end))),
    max = Math.max(0, ...seg.map((x) => Math.max(x.start, x.end))),
    y = (v: number) => 132 - ((v - min) / (max - min || 1)) * 112,
    step = 550 / seg.length;
  return (
    <>
      <svg
        className="a-waterfall"
        viewBox="0 0 570 170"
        role="img"
        aria-label={'Waterfall in ' + unit}
      >
        <line x1="8" x2="562" y1={y(0)} y2={y(0)} stroke="#aabdb7" />
        {seg.map((x, i) => (
          <g key={i}>
            <rect
              x={12 + i * step}
              width={step * 0.65}
              y={Math.min(y(x.start), y(x.end))}
              height={Math.max(1, Math.abs(y(x.start) - y(x.end)))}
              fill={
                i === seg.length - 1
                  ? '#263f4a'
                  : x.v < 0
                    ? '#c48969'
                    : '#299b84'
              }
              rx="3"
            />
            {i < seg.length - 1 && (
              <line
                x1={12 + i * step + step * 0.65}
                x2={12 + (i + 1) * step}
                y1={y(x.end)}
                y2={y(x.end)}
                stroke="#a1b6ae"
                strokeDasharray="3 3"
              />
            )}
            <text x={12 + i * step + step * 0.325} y="154" textAnchor="middle">
              {x.s}
            </text>
            <title>{x.s + ': ' + n(x.v) + ' ' + unit}</title>
          </g>
        ))}
      </svg>
      <details className="a-disclosure">
        <summary>
          Waterfall figures <ChevronDown size={13} />
        </summary>
        <Table
          heads={['Component', 'Change (' + unit + ')', 'Running total']}
          rows={seg.map((x) => [x.s, n(x.v), n(x.end)])}
        />
      </details>
    </>
  );
}
export function Ring({ value }: { value: number }) {
  const bounded = Math.min(100, Math.max(0, value));
  return (
    <div className="a-ring">
      <svg viewBox="0 0 88 88" aria-hidden="true">
        <circle
          cx="44"
          cy="44"
          r="34"
          stroke="#dce7df"
          fill="none"
          strokeWidth="9"
        />
        <circle
          cx="44"
          cy="44"
          r="34"
          stroke="#137b68"
          fill="none"
          strokeWidth="9"
          strokeDasharray={bounded * 2.136 + ' 214'}
          transform="rotate(-90 44 44)"
        />
      </svg>
      <b>{n(value, 0)}%</b>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    d.showModal();
    return () => {
      d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="a-dialog"
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="a-dialog-inner">
        <div className="a-cardhead">
          <h3 id={id}>{title}</h3>
          <button
            type="button"
            className="a-icon"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Num({
  label,
  value,
  onChange,
  min,
  max,
  step = 'any',
  unit,
  disabled = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number | string;
  unit?: string;
  disabled?: boolean;
}) {
  return (
    <label className="a-field">
      <span>{label}</span>
      <span className="a-fieldbox">
        <input
          aria-label={label}
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          placeholder="Enter value"
          onChange={(e) =>
            onChange(
              e.target.value === '' || !Number.isFinite(e.target.valueAsNumber)
                ? null
                : e.target.valueAsNumber,
            )
          }
        />
        {unit && <small>{unit}</small>}
      </span>
    </label>
  );
}
