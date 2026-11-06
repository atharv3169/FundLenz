import type { LabBook } from './lab-book';
/** All cash amounts and diluted shares are in millions. Rates are percentages (never fractions in the UI). */
export const fields = {
  revenue: ['Starting revenue', 'Operating base', 'm', 1e-8, 1e12],
  growth: ['First-year growth', 'Forecast drivers', '%', -95, 250],
  growthEnd: ['Final-year growth', 'Forecast drivers', '%', -95, 250],
  margin: ['First-year EBIT margin', 'Forecast drivers', '%', -200, 100],
  marginEnd: ['Final-year EBIT margin', 'Forecast drivers', '%', -200, 100],
  tax: ['Marginal cash tax', 'Forecast drivers', '%', 0, 99],
  da: ['D&A / revenue', 'Forecast drivers', '%', 0, 200],
  capex: ['Capital expenditure / revenue', 'Forecast drivers', '%', 0, 300],
  nwc: ['Operating NWC / revenue', 'Forecast drivers', '%', -150, 200],
  nol: ['Opening tax losses', 'Operating base', 'm', 0, 1e12],
  rf: ['Risk-free rate', 'Cost of capital', '%', -10, 50],
  beta: ['Levered beta', 'Cost of capital', '×', -5, 10],
  erp: ['Equity risk premium', 'Cost of capital', '%', 0, 50],
  debtCost: ['Pre-tax cost of debt', 'Cost of capital', '%', 0, 100],
  debtWeight: ['Debt / market capital', 'Cost of capital', '%', 0, 100],
  wacc: ['Direct WACC', 'Cost of capital', '%', 0.01, 100],
  terminalG: ['Perpetual growth', 'Terminal economics', '%', -15, 30],
  roic: ['Stable return on capital', 'Terminal economics', '%', 0.01, 150],
  multiple: ['Exit EV / EBITDA', 'Terminal economics', '×', 0.01, 150],
  cash: ['Excess cash', 'Equity bridge', 'm', 0, 1e12],
  assets: ['Non-operating investments', 'Equity bridge', 'm', 0, 1e12],
  debt: ['Debt and debt-like claims', 'Equity bridge', 'm', 0, 1e12],
  claims: [
    'Preferred, minority and other claims',
    'Equity bridge',
    'm',
    0,
    1e12,
  ],
  shares: ['Diluted shares', 'Equity bridge', 'm shares', 1e-8, 1e12],
  price: ['Reference share price', 'Equity bridge', '/share', 1e-8, 1e10],
} as const;
export type Key = keyof typeof fields;
export const keys = Object.keys(fields) as Key[];
export const drivers = ['growth', 'margin', 'da', 'capex', 'nwc'] as const;
export type Driver = (typeof drivers)[number];
export type Values = Record<Key, number | null>;
export type Historical = {
  year: number;
  sales: number;
  ebit: number;
  capex: number | null;
};
export type Model = {
  version: 1;
  labs?: LabBook;
  name: string;
  ticker: string;
  currency: 'USD' | 'EUR' | 'INR' | 'GBP';
  sector: 'Operating company' | 'Bank / insurer' | 'REIT';
  year: number;
  horizon: number;
  asOf: string;
  priceDate: string;
  source: string;
  notes: string;
  basis: 'Fictional' | 'Manual' | 'Filing';
  timing: 'year-end' | 'midyear';
  discount: 'built' | 'direct';
  terminal: 'growth' | 'multiple';
  inputs: Values;
  overrides: Partial<Record<Driver, number>>[];
  history: Historical[];
};
export const emptyInputs = () =>
  Object.fromEntries(keys.map((k) => [k, null])) as Values;
export function blank(name = 'Untitled company', ticker = ''): Model {
  return {
    version: 1,
    name,
    ticker,
    currency: 'USD',
    sector: 'Operating company',
    year: 2025,
    horizon: 5,
    asOf: '',
    priceDate: '',
    source: '',
    notes: '',
    basis: 'Manual',
    timing: 'year-end',
    discount: 'direct',
    terminal: 'growth',
    inputs: emptyInputs(),
    overrides: [],
    history: [],
  };
}
export function demo(which = 0): Model {
  const base = blank(
    ['Meridian Instruments', 'Linden Software', 'Harbour Freight Systems'][
      which
    ] || 'Meridian Instruments',
    ['MRDN', 'LIND', 'HBRF'][which] || 'MRDN',
  );
  const v: Values = {
    revenue: 1240,
    growth: 12,
    growthEnd: 5,
    margin: 19,
    marginEnd: 22,
    tax: 25,
    da: 3.2,
    capex: 5.4,
    nwc: 12,
    nol: 0,
    rf: 4,
    beta: 1.1,
    erp: 5.5,
    debtCost: 5.2,
    debtWeight: 20,
    wacc: 9,
    terminalG: 2.5,
    roic: 13,
    multiple: 11,
    cash: 140,
    assets: 18,
    debt: 265,
    claims: 12,
    shares: 86,
    price: 30,
  };
  if (which === 1)
    Object.assign(v, {
      revenue: 540,
      growth: 21,
      growthEnd: 8,
      margin: 13,
      marginEnd: 24,
      capex: 3.2,
      nwc: -4,
      shares: 51,
      price: 28,
      debt: 75,
    });
  if (which === 2)
    Object.assign(v, {
      revenue: 3400,
      growth: 4,
      growthEnd: 3,
      margin: 12,
      marginEnd: 14,
      capex: 8,
      da: 6,
      nwc: 7,
      shares: 64,
      price: 45,
      debt: 920,
    });
  return {
    ...base,
    basis: 'Fictional',
    source:
      'Fictional teaching case. All financials, prices and assumptions are illustrative.',
    asOf: '2025-12-31',
    priceDate: '2025-12-31',
    discount: 'built',
    inputs: v,
    history: [0.78, 0.87, 1].map((s, i) => ({
      year: 2023 + i,
      sales: v.revenue! * s,
      ebit: (v.revenue! * s * (v.margin! - 2 + i)) / 100,
      capex: (v.revenue! * s * v.capex!) / 100,
    })),
  };
}
export type Row = {
  year: number;
  sales: number;
  growth: number;
  margin: number;
  ebit: number;
  taxes: number;
  nopat: number;
  da: number;
  capex: number;
  nwc: number;
  delta: number;
  losses: number;
  fcff: number;
  factor: number;
  pv: number;
};
export function driver(m: Model, k: Driver, i: number) {
  const ov = m.overrides[i]?.[k];
  if (ov !== undefined) return ov;
  const start = m.inputs[k],
    end =
      k === 'growth'
        ? m.inputs.growthEnd
        : k === 'margin'
          ? m.inputs.marginEnd
          : start;
  if (start === null || end === null) return null;
  return start + ((end - start) * i) / (m.horizon - 1);
}
export function capital(m: Model) {
  const { rf, beta, erp, debtCost, tax, debtWeight } = m.inputs;
  const ke =
    rf !== null && beta !== null && erp !== null ? rf + beta * erp : null;
  const kd =
    debtCost !== null && tax !== null ? debtCost * (1 - tax / 100) : null;
  const built =
    ke !== null && kd !== null && debtWeight !== null
      ? ke * (1 - debtWeight / 100) + (kd * debtWeight) / 100
      : null;
  return { ke, kd, built, w: m.discount === 'direct' ? m.inputs.wacc : built };
}
export function calculate(m: Model) {
  if (m.sector !== 'Operating company')
    throw Error(
      'Operating FCFF does not fit this sector. Open Alternative methods for a separate equity calculation.',
    );
  if (!Number.isInteger(m.horizon) || m.horizon < 3 || m.horizon > 10)
    throw Error('Choose a forecast of 3–10 years.');
  for (const k of keys) {
    const n = m.inputs[k],
      f = fields[k];
    if (n !== null && (!Number.isFinite(n) || n < f[3] || n > f[4]))
      throw Error(f[0] + ' must be between ' + f[3] + ' and ' + f[4] + '.');
  }
  const need = (k: Key) => {
    const n = m.inputs[k];
    if (n === null)
      throw Error('Enter ' + fields[k][0].toLowerCase() + ' in Assumptions.');
    return n;
  };
  const { w } = capital(m);
  if (w === null || w <= 0)
    throw Error('Enter a positive discount rate or complete the WACC build.');
  const tax = need('tax') / 100,
    sh = need('shares'),
    netAdj = need('cash') + need('assets') - need('debt') - need('claims');
  let sales = need('revenue'),
    lastNwc = (sales * need('nwc')) / 100,
    nol = need('nol'),
    explicit = 0;
  const rows: Row[] = [];
  for (let i = 0; i < m.horizon; i++) {
    const vals = drivers.map((k) => {
      const v = driver(m, k, i),
        f = fields[k];
      if (v === null || !Number.isFinite(v) || v < f[3] || v > f[4])
        throw Error('Check ' + f[0] + ' for forecast year ' + (i + 1) + '.');
      return v;
    });
    const [growth, margin, dp, cp, np] = vals;
    sales *= 1 + growth / 100;
    const ebit = (sales * margin) / 100,
      used = Math.min(nol, Math.max(0, ebit)),
      taxes = Math.max(0, ebit - used) * tax;
    nol = nol - used + Math.max(0, -ebit);
    const nopat = ebit - taxes,
      da = (sales * dp) / 100,
      capex = (sales * cp) / 100,
      nwc = (sales * np) / 100,
      delta = nwc - lastNwc,
      fcff = nopat + da - capex - delta,
      factor = 1 / (1 + w / 100) ** (i + (m.timing === 'midyear' ? 0.5 : 1)),
      pv = fcff * factor;
    explicit += pv;
    lastNwc = nwc;
    rows.push({
      year: m.year + i + 1,
      sales,
      growth,
      margin,
      ebit,
      taxes,
      nopat,
      da,
      capex,
      nwc,
      delta,
      losses: nol,
      fcff,
      factor,
      pv,
    });
  }
  const last = rows[rows.length - 1],
    ebitda = last.ebit + last.da;
  let tv: number,
    next: number | null = null;
  if (m.terminal === 'growth') {
    const g = need('terminalG'),
      roic = need('roic');
    if (g >= w) throw Error('Stable growth must be below WACC.');
    if (g >= roic || last.ebit <= 0)
      throw Error(
        'Perpetuity requires sustainable positive terminal cash flow: check final EBIT and stable ROIC.',
      );
    next = last.ebit * (1 - tax) * (1 + g / 100) * (1 - g / roic);
    tv = next / ((w - g) / 100);
  } else {
    if (ebitda <= 0) throw Error('Exit multiple needs positive final EBITDA.');
    tv = ebitda * need('multiple');
  }
  const terminalPV = tv / (1 + w / 100) ** m.horizon,
    ev = explicit + terminalPV,
    equity = ev + netAdj,
    perShare = equity / sh;
  if (
    ![
      ev,
      equity,
      perShare,
      tv,
      terminalPV,
      explicit,
      ...rows.flatMap(Object.values),
    ].every(Number.isFinite)
  )
    throw Error('Result is outside numeric range.');
  const p = m.inputs.price;
  return {
    rows,
    w,
    explicit,
    terminalPV,
    tv,
    next,
    ev,
    equity,
    netAdj,
    perShare,
    terminalShare: ev > 0 ? (terminalPV / ev) * 100 : null,
    impliedMultiple: ebitda > 0 ? tv / ebitda : null,
    gap: p !== null ? (perShare / p - 1) * 100 : null,
    safety: p !== null && perShare > 0 ? (1 - p / perShare) * 100 : null,
  };
}
export type Result = ReturnType<typeof calculate>;
export function evaluate(
  m: Model,
): { r: Result; error: null } | { r: null; error: string } {
  try {
    return { r: calculate(m), error: null };
  } catch (e) {
    return {
      r: null,
      error: e instanceof Error ? e.message : 'Check assumptions.',
    };
  }
}
export const clone = (m: Model): Model => ({
  ...m,
  inputs: { ...m.inputs },
  overrides: m.overrides.map((o) => ({ ...o })),
  history: m.history.map((x) => ({ ...x })),
});
export function shocks(
  m: Model,
  changes: {
    growth?: number;
    margin?: number;
    capex?: number;
    wacc?: number;
    terminalG?: number;
  },
) {
  const out = clone(m);
  for (const key of ['growth', 'margin', 'capex'] as const) {
    const v = changes[key];
    if (v === undefined || v === 0) continue;
    for (const k of [
      key,
      ...(key === 'growth'
        ? (['growthEnd'] as const)
        : key === 'margin'
          ? (['marginEnd'] as const)
          : []),
    ]) {
      if (out.inputs[k] !== null) out.inputs[k] += v;
    }
    for (const row of out.overrides) if (row[key] !== undefined) row[key] += v;
  }
  if (changes.wacc !== undefined && changes.wacc !== 0) {
    const w = capital(m).w;
    out.discount = 'direct';
    out.inputs.wacc = w === null ? null : w + changes.wacc;
  }
  if (changes.terminalG !== undefined && out.inputs.terminalG !== null)
    out.inputs.terminalG += changes.terminalG;
  return out;
}
export function reverse(
  m: Model,
  key: 'growth' | 'margin' | 'wacc',
  target: number,
) {
  if (!Number.isFinite(target) || target <= 0) return [];
  const [lo, hi] =
    key === 'growth' ? [-40, 100] : key === 'margin' ? [-30, 85] : [0.25, 60];
  function val(v: number) {
    const m2 = clone(m);
    if (key === 'wacc') {
      m2.discount = 'direct';
      m2.inputs.wacc = v;
    } else {
      m2.inputs[key] = v;
      m2.inputs[key === 'growth' ? 'growthEnd' : 'marginEnd'] = v;
      for (const yr of m2.overrides) delete yr[key];
    }
    const r = evaluate(m2).r;
    return r ? r.perShare - target : null;
  }
  let prev: number | null = null,
    px = lo;
  const roots: number[] = [];
  for (let i = 0; i <= 240; i++) {
    const x = lo + ((hi - lo) * i) / 240,
      y = val(x);
    if (y !== null && Math.abs(y) < 1e-9) roots.push(x);
    else if (y !== null && prev !== null && prev * y < 0) {
      let l = px,
        h = x,
        fl = prev;
      for (let j = 0; j < 45; j++) {
        const mid = (l + h) / 2,
          f = val(mid);
        if (f === null) break;
        if (fl * f <= 0) h = mid;
        else {
          l = mid;
          fl = f;
        }
      }
      const ans = (l + h) / 2,
        residual = val(ans);
      if (residual !== null && Math.abs(residual) < Math.max(1, target) * 1e-7)
        roots.push(ans);
    }
    prev = y;
    px = x;
  }
  return roots.filter((n, i) => !i || Math.abs(n - roots[i - 1]) > 0.001);
}
export type SimSpec = {
  seed: number;
  draws: number;
  growth: number;
  margin: number;
  rate: number;
  rho: number;
};
export const defaultSim: SimSpec = {
  seed: 7123,
  draws: 1000,
  growth: 3,
  margin: 2,
  rate: 0.8,
  rho: 0.35,
};
export function simulate(m: Model, s: SimSpec) {
  calculate(m);
  if (
    !Number.isInteger(s.seed) ||
    s.seed < 0 ||
    s.seed > 2147483647 ||
    !Number.isInteger(s.draws) ||
    s.draws < 100 ||
    s.draws > 5000 ||
    !Number.isFinite(s.rho) ||
    Math.abs(s.rho) > 1 ||
    ![s.growth, s.margin, s.rate].every(
      (x) => Number.isFinite(x) && x >= 0 && x <= 30,
    )
  )
    throw Error(
      'Use 100–5,000 draws, nonnegative volatility (≤30 pp), a valid seed and a correlation between −1 and 1.',
    );
  let seed = s.seed >>> 0;
  const u = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return (seed + 0.5) / 4294967296;
    },
    normal = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  const sorted: number[] = [];
  for (let i = 0; i < s.draws; i++) {
    const z = normal(),
      z2 = s.rho * z + Math.sqrt(Math.max(0, 1 - s.rho ** 2)) * normal();
    const r = evaluate(
      shocks(m, {
        growth: z * s.growth,
        margin: z2 * s.margin,
        wacc: normal() * s.rate,
      }),
    ).r;
    if (r) sorted.push(r.perShare);
  }
  if (!sorted.length)
    throw Error('No valid simulated draws. Narrow the stress ranges.');
  sorted.sort((a, b) => a - b);
  const pct = (p: number) => {
    const i = p * (sorted.length - 1),
      l = Math.floor(i);
    return sorted[l] + (i - l) * (sorted[Math.ceil(i)] - sorted[l]);
  };
  const min = sorted[0],
    max = sorted[sorted.length - 1],
    bins = Array(15).fill(0) as number[];
  for (const x of sorted)
    bins[Math.min(14, Math.floor(((x - min) / (max - min || 1)) * 15))]++;
  return {
    p10: pct(0.1),
    p50: pct(0.5),
    p90: pct(0.9),
    min,
    max,
    bins,
    valid: sorted.length,
    excluded: s.draws - sorted.length,
    sorted,
  };
}
