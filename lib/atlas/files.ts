import { readBook } from './lab-book';
import {
  blank,
  drivers,
  fields,
  keys,
  type Driver,
  type Historical,
  type Key,
  type Model,
  type Result,
} from './model';

const meta = [
  'name',
  'ticker',
  'currency',
  'sector',
  'year',
  'horizon',
  'asOf',
  'priceDate',
  'source',
  'notes',
  'basis',
  'timing',
  'discount',
  'terminal',
] as const;
const bad = (m: string): never => {
  throw Error(m);
};
const object = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : bad('Expected an object.');
const str = (x: unknown, max = 3000) =>
  typeof x === 'string' && x.length <= max
    ? x
    : bad('Text is missing or too long.');
const number = (x: unknown, min: number, max: number) =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max
    ? x
    : bad('A numeric field is missing or outside its limits.');
function integer(x: unknown, min: number, max: number) {
  const v = number(x, min, max);
  return Number.isInteger(v) ? v : bad('Expected a whole number.');
}
function choice<T extends string>(x: unknown, list: readonly T[]) {
  return list.includes(x as T)
    ? (x as T)
    : bad('Unsupported setting: ' + String(x).slice(0, 50));
}
function date(x: unknown) {
  const s = str(x, 10);
  if (s === '') return '';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    Number.isNaN(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    bad('Use an ISO date (YYYY-MM-DD).');
  return s;
}
function shape(x: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(x).some((k) => !allowed.includes(k)))
    bad('Unrecognized input field.');
}
export function parseModel(raw: unknown): Model {
  const x = object(raw);
  shape(x, ['version', ...meta, 'inputs', 'history', 'overrides', 'labs']);
  if (x.version !== 1) bad('Unsupported Atlas snapshot version.');
  const m = blank(str(x.name, 100), str(x.ticker, 32));
  if (!m.name.trim()) bad('Model name cannot be empty.');
  if (x.labs !== undefined) m.labs = readBook(x.labs);
  m.currency = choice(x.currency, ['USD', 'EUR', 'INR', 'GBP']);
  m.sector = choice(x.sector, ['Operating company', 'Bank / insurer', 'REIT']);
  m.year = integer(x.year, 1900, 2200);
  m.horizon = integer(x.horizon, 3, 10);
  m.source = str(x.source);
  m.notes = str(x.notes, 10000);
  m.asOf = date(x.asOf);
  m.priceDate = date(x.priceDate);
  m.basis = choice(x.basis, ['Fictional', 'Manual', 'Filing']);
  m.timing = choice(x.timing, ['year-end', 'midyear']);
  m.discount = choice(x.discount, ['direct', 'built']);
  m.terminal = choice(x.terminal, ['multiple', 'growth']);
  const vs = object(x.inputs);
  shape(vs, keys);
  for (const k of keys) {
    const f = fields[k];
    m.inputs[k] = vs[k] === null ? null : number(vs[k], f[3], f[4]);
  }
  const ov = x.overrides;
  if (!Array.isArray(ov) || ov.length > 10)
    return bad('At most ten annual overrides are supported.');
  m.overrides = ov.map((row) => {
    const o = object(row);
    shape(o, drivers);
    const out: Partial<Record<Driver, number>> = {};
    for (const k of drivers)
      if (o[k] !== undefined) out[k] = number(o[k], fields[k][3], fields[k][4]);
    return out;
  });
  const hist = x.history;
  if (!Array.isArray(hist) || hist.length > 30)
    return bad('History must have at most 30 fiscal periods.');
  m.history = hist
    .map((row) => {
      const o = object(row);
      shape(o, ['year', 'sales', 'ebit', 'capex']);
      return {
        year: integer(o.year, 1900, m.year),
        sales: number(o.sales, 0, 1e12),
        ebit: number(o.ebit, -1e12, 1e12),
        capex: o.capex === null ? null : number(o.capex, 0, 1e12),
      };
    })
    .sort((a, b) => a.year - b.year);
  while (m.overrides.length && !Object.keys(m.overrides.at(-1)!).length)
    m.overrides.pop();
  if (new Set(m.history.map((x) => x.year)).size !== m.history.length)
    bad('Duplicate historical fiscal year.');
  return m;
}
export function csv(rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    let s = v === null ? '' : String(v);
    if (typeof v === 'string' && /^(?:['\t\r\n]|\s*[=+\-@])/.test(s))
      s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
export function readCsv(text: string): string[][] {
  if (text.length > 2_000_000) bad('CSV exceeds 2 MB.');
  text = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [],
    s = '',
    quoted = false,
    closed = false;
  const field = () => {
    row.push(s);
    s = '';
    closed = false;
  };
  const line = () => {
    field();
    if (row.some((x) => x !== '')) rows.push(row);
    row = [];
    if (rows.length > 4000) bad('Too many CSV rows.');
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          s += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else s += c;
    } else if (c === ',') field();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      line();
    } else if (c === '"' && !s && !closed) quoted = true;
    else {
      if (closed || c === '"') bad('Invalid CSV quoting.');
      s += c;
    }
  }
  if (quoted) bad('Unclosed CSV quote.');
  line();
  return rows;
}
const csvNumber = (s: string) => {
  if (
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s.trim()) ||
    !Number.isFinite(Number(s))
  )
    return bad('Invalid CSV number.');
  return Number(s);
};
export function modelCsv(m: Model) {
  const rows: (string | number | null)[][] = [
    ['section', 'field', 'period', 'value'],
    ['schema', 'version', '', 1],
  ];
  if (m.labs)
    rows.push(['research', 'worksheets', '', JSON.stringify(readBook(m.labs))]);
  for (const k of meta) rows.push(['model', k, '', m[k]]);
  for (const k of keys) rows.push(['input', k, '', m.inputs[k]]);
  m.overrides.forEach((r, i) => {
    for (const k of drivers)
      if (r[k] !== undefined) rows.push(['forecast', k, i + 1, r[k]!]);
  });
  for (const h of m.history)
    for (const k of ['sales', 'ebit', 'capex'] as const)
      rows.push(['history', k, h.year, h[k]]);
  return csv(rows);
}
export function importCsv(s: string) {
  return worksheetRows(readCsv(s));
}
function worksheetRows([hdr, ...rows]: string[][]) {
  if (hdr?.join(',') !== 'section,field,period,value')
    bad('Use the Atlas input template, not a forecast export.');
  const m = blank(),
    hs = new Map<number, Partial<Historical>>(),
    seen = new Set<string>(),
    raw = m as unknown as Record<string, unknown>;
  for (const line of rows) {
    if (line.length !== 4) bad('Expected four CSV columns.');
    const [section, k, p, v] = line,
      id = JSON.stringify([section, k, p]);
    if (seen.has(id)) bad('Duplicate CSV field: ' + k);
    seen.add(id);
    if (section === 'schema' && k === 'version' && !p && v === '1') continue;
    if (section === 'research' && k === 'worksheets' && !p)
      m.labs = readBook(JSON.parse(v));
    else if (
      section === 'model' &&
      !p &&
      meta.includes(k as (typeof meta)[number])
    )
      raw[k] = ['year', 'horizon'].includes(k)
        ? csvNumber(v)
        : v.replace(/^'(?=['\t\r\n]|\s*[=+\-@])/, '');
    else if (section === 'input' && !p && keys.includes(k as Key))
      m.inputs[k as Key] = v === '' ? null : csvNumber(v);
    else if (section === 'forecast' && drivers.includes(k as Driver)) {
      const i = integer(csvNumber(p), 1, 10) - 1;
      while (m.overrides.length <= i) m.overrides.push({});
      if (v !== '') m.overrides[i][k as Driver] = csvNumber(v);
    } else if (
      section === 'history' &&
      ['sales', 'ebit', 'capex'].includes(k)
    ) {
      const y = integer(csvNumber(p), 1900, 2200);
      const h = hs.get(y) || { year: y, capex: null };
      hs.set(y, { ...h, [k]: v === '' ? null : csvNumber(v) });
    } else bad('Unrecognized CSV row: ' + k);
  }
  if (!seen.has(JSON.stringify(['schema', 'version', ''])))
    bad('Missing schema version.');
  for (const k of [...meta, ...keys])
    if (
      !seen.has(
        JSON.stringify([keys.includes(k as Key) ? 'input' : 'model', k, '']),
      )
    )
      bad('Missing CSV field: ' + k);
  return parseModel({ ...m, history: [...hs.values()] });
}
export type CsvUpload =
  | { kind: 'model'; model: Model }
  | {
      kind: 'history';
      rows: Historical[];
      currency?: Model['currency'];
      unit?: HistoryUnit;
      company?: string;
    };
const historyColumns = {
  year: ['year', 'fy', 'fiscal year', 'financial year'],
  sales: ['revenue', 'sales', 'total revenue', 'net sales'],
  ebit: ['ebit', 'operating income', 'operating profit'],
  capex: ['capex', 'cash capex', 'capital expenditure', 'capital expenditures'],
};
export const historyUnits = {
  units: ['Whole currency units', 0.000001],
  thousands: ['Thousands', 0.001],
  millions: ['Millions', 1],
  crores: ['Crores', 10],
} as const;
export type HistoryUnit = keyof typeof historyUnits;
export function readUploadCsv(s: string): CsvUpload {
  const all = readCsv(s);
  if (all[0]?.[0] === 'section')
    return { kind: 'model', model: worksheetRows(all) };
  const [header = [], ...body] = all;
  const names = header.map((h) =>
    h.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' '),
  );
  if (names.includes('pv fcff') && names.includes('discount factor'))
    throw Error(
      'This file is a forecast export. Use an Atlas input worksheet or actual historical financials.',
    );
  const index = (k: keyof typeof historyColumns) => {
    const hits = names.flatMap((v, i) =>
      historyColumns[k].includes(v) ? [i] : [],
    );
    if (hits.length > 1)
      throw Error(
        'More than one column matches ' +
          k +
          '. Keep one column for each figure.',
      );
    return hits[0] ?? -1;
  };
  const year = index('year'),
    sales = index('sales'),
    ebit = index('ebit'),
    capex = index('capex');
  if (year < 0 || sales < 0 || ebit < 0)
    throw Error(
      'Use an Atlas input worksheet or a history CSV with fiscal year, revenue and EBIT columns. Capex is optional.',
    );
  if (!body.length || body.length > 30)
    throw Error('Include between 1 and 30 annual rows.');
  // If a file declares its identity or scale, do not silently combine different companies or currencies.
  const columnValue = (aliases: string[], what: string) => {
    const indexes = names.flatMap((h, i) => (aliases.includes(h) ? [i] : []));
    let first = '';
    for (const cells of body)
      for (const i of indexes) {
        const val = cells[i]?.trim();
        if (!val) continue;
        if (first && first.toLowerCase() !== val.toLowerCase())
          throw Error(
            'Mixed ' +
              what +
              ' in this file. Use one company, currency and unit per CSV.',
          );
        first = val;
      }
    return first;
  };
  const company = columnValue(['company', 'company name'], 'company names');
  columnValue(['ticker', 'symbol'], 'tickers');
  const declaredCurrency = columnValue(
    ['currency', 'reporting currency'],
    'currencies',
  ).toUpperCase();
  const currency = declaredCurrency
    ? choice(declaredCurrency, ['USD', 'EUR', 'INR', 'GBP'] as const)
    : undefined;
  const declaredUnit = columnValue(
    ['unit', 'units', 'scale'],
    'units',
  ).toLowerCase();
  const scales: Record<string, HistoryUnit> = {
    units: 'units',
    unit: 'units',
    'whole currency units': 'units',
    thousand: 'thousands',
    thousands: 'thousands',
    million: 'millions',
    millions: 'millions',
    crore: 'crores',
    crores: 'crores',
  };
  if (declaredUnit && !Object.hasOwn(scales, declaredUnit))
    throw Error(
      'Use units, thousands, millions or crores for the file’s scale.',
    );
  const unit = declaredUnit ? scales[declaredUnit] : undefined;
  const seen = new Set<number>();
  const rows = body.map((cells, i) => {
    const fail = (msg: string): never => {
      throw Error('Row ' + (i + 2) + ': ' + msg);
    };
    if (cells.length !== header.length)
      fail('column count does not match the header.');
    const fy = /^(?:FY\s*)?(\d{4})$/i.exec(cells[year].trim());
    const y = fy ? Number(fy[1]) : NaN;
    if (!Number.isInteger(y) || y < 1900 || y > 2200)
      fail('use a four-digit fiscal year.');
    if (seen.has(y)) fail('duplicate fiscal year ' + y + '.');
    seen.add(y);
    const amount = (column: number, label: string, signed = false) => {
      let v = cells[column].trim();
      if (/^\([\d.,]+\)$/.test(v)) v = '-' + v.slice(1, -1);
      if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(v))
        v = v.replace(/,/g, '');
      let num: number;
      try {
        num = csvNumber(v);
      } catch {
        return fail(label + ' must be a number, using a period for decimals.');
      }
      if (!signed && num < 0)
        fail(
          label === 'Capex'
            ? 'enter capex as a positive cash outflow.'
            : 'revenue cannot be negative.',
        );
      return num;
    };
    return {
      year: y,
      sales: amount(sales, 'Revenue'),
      ebit: amount(ebit, 'EBIT', true),
      capex: capex < 0 || !cells[capex].trim() ? null : amount(capex, 'Capex'),
    };
  });
  return {
    kind: 'history',
    rows: rows.sort((a, b) => a.year - b.year),
    currency,
    unit,
    company: company || undefined,
  };
}
export function modelFromHistory(
  rows: Historical[],
  name: string,
  currency: Model['currency'],
  unit: HistoryUnit,
  source: string,
): Model {
  const factor = historyUnits[unit][1],
    m = blank(name.trim());
  m.currency = currency;
  m.history = rows
    .map((h) => ({
      year: h.year,
      sales: h.sales * factor,
      ebit: h.ebit * factor,
      capex: h.capex === null ? null : h.capex * factor,
    }))
    .sort((a, b) => a.year - b.year);
  const last = m.history.at(-1);
  if (!last) throw Error('Include at least one historical fiscal year.');
  m.year = last.year;
  // A zero-sales period is valid history, but is not a positive FCFF revenue base.
  m.inputs.revenue = last.sales >= fields.revenue[3] ? last.sales : null;
  m.source = 'User-provided annual history: ' + source.slice(0, 255);
  return parseModel(m);
}
export function forecastCsv(m: Model, r: Result) {
  return csv([
    [
      'Fiscal year',
      'Revenue',
      'EBIT',
      'Cash tax',
      'NOPAT',
      'D&A',
      'Capex',
      'Change in operating NWC',
      'FCFF',
      'Discount factor',
      'PV FCFF',
      'Currency',
      'Scale',
    ],
    ...r.rows.map((x) => [
      x.year,
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
      m.currency,
      'millions',
    ]),
  ]);
}
export function snapshot(m: Model) {
  return JSON.stringify(
    { format: 'fundlenz.atlas', version: 1, model: parseModel(m) },
    null,
    2,
  );
}
export function importJson(s: string) {
  if (s.length > 2_000_000) bad('Snapshot exceeds 2 MB.');
  const raw = object(JSON.parse(s));
  if (raw.format !== 'fundlenz.atlas' || raw.version !== 1)
    bad('Not a version 1 FundLenz Atlas snapshot.');
  return parseModel(raw.model);
}
export function downloadInputTemplate() {
  download('atlas-input-template.csv', modelCsv(blank()), 'text/csv');
}

export function download(
  name: string,
  body: string | Blob,
  mime = 'text/plain',
) {
  const url = URL.createObjectURL(
    body instanceof Blob ? body : new Blob([body], { type: mime }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export const filename = (m: Model) =>
  (m.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'company') + '-atlas';
