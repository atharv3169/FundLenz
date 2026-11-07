import { blank, type Historical, type Model } from './model';
export const filings = [
  {
    name: 'Apple Inc.',
    ticker: 'AAPL',
    date: '2025-09-27',
    url: 'https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm',
    data: [
      [2023, 383285, 114301, 10959],
      [2024, 391035, 123216, 9447],
      [2025, 416161, 133050, 12715],
    ],
  },
  {
    name: 'Microsoft Corporation',
    ticker: 'MSFT',
    date: '2025-06-30',
    url: 'https://www.sec.gov/Archives/edgar/data/789019/000095017025100235/msft-20250630.htm',
    data: [
      [2023, 211915, 88523, 28107],
      [2024, 245122, 109433, 44477],
      [2025, 281724, 128528, 64551],
    ],
  },
] as const;
export function fromHistory(
  name: string,
  ticker: string,
  history: Historical[],
  asOf: string,
  source: string,
): Model {
  if (!history.length) throw Error('No eligible annual periods.');
  const m = blank(name, ticker),
    h = history.at(-1)!;
  m.history = history;
  m.asOf = asOf;
  m.source = source;
  m.basis = 'Filing';
  m.year = h.year;
  m.inputs.revenue = h.sales;
  m.notes =
    'Reported revenue is the forecast starting point. Other valuation inputs require analyst estimates; historical EBIT and capex are available in Research.';
  return m;
}
export function filingModel(i: number) {
  const f = filings[i];
  return fromHistory(
    f.name,
    f.ticker,
    f.data.map(([year, sales, ebit, capex]) => ({ year, sales, ebit, capex })),
    f.date,
    'FY2025 Form 10-K · consolidated operating results and cash capex in USD millions. ' +
      f.url,
  );
}
// Select annual USD facts with the same accession AND exact fiscal dates. Never mix quarters, amendments or tags from another filing.
export function secFacts(raw: unknown, cutoff: string) {
  if (
    !/^\d{4}-\d\d-\d\d$/.test(cutoff) ||
    !Number.isFinite(Date.parse(cutoff)) ||
    new Date(cutoff).toISOString().slice(0, 10) !== cutoff
  )
    throw Error('Choose a valid filing cutoff date.');
  type Fact = {
    start: string;
    end: string;
    filed: string;
    accn: string;
    form: string;
    val: number;
    fy: number;
    fp: string;
  };
  const x = raw as {
    cik?: number;
    entityName?: string;
    facts?: { 'us-gaap'?: Record<string, { units?: { USD?: Fact[] } }> };
  };
  const g = x?.facts?.['us-gaap'];
  if (
    !g ||
    typeof x.entityName !== 'string' ||
    !Number.isInteger(x.cik) ||
    !x.cik ||
    x.cik < 1 ||
    x.cik > 9999999999
  )
    throw Error('Expected SEC Company Facts JSON with US-GAAP USD facts.');
  const dates = (v: unknown) =>
    typeof v === 'string' &&
    /^\d{4}-\d\d-\d\d$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  const facts = (tags: string[]) => {
    const map = new Map<string, Fact>();
    for (const tag of tags) {
      for (const f of g[tag]?.units?.USD || []) {
        if (
          !f ||
          !['10-K', '10-K/A'].includes(f.form) ||
          f.fp !== 'FY' ||
          !dates(f.filed) ||
          !dates(f.start) ||
          !dates(f.end) ||
          f.filed > cutoff ||
          f.end > f.filed ||
          !Number.isFinite(f.val) ||
          !/^\d{10}-\d{2}-\d{6}$/.test(f.accn)
        )
          continue;
        const span = (Date.parse(f.end) - Date.parse(f.start)) / 86400000;
        if (span < 350 || span > 380) continue;
        const key = [f.accn, f.start, f.end].join('|');
        if (!map.has(key)) map.set(key, f);
      }
    }
    return map;
  };
  const sales = facts([
      'RevenueFromContractWithCustomerExcludingAssessedTax',
      'SalesRevenueNet',
      'Revenues',
    ]),
    ebit = facts(['OperatingIncomeLoss']),
    capex = facts(['PaymentsToAcquirePropertyPlantAndEquipment']);
  const complete = [...sales]
    .filter(([key, f]) => ebit.has(key) && f.val > 0)
    .sort(
      (a, b) =>
        b[1].end.localeCompare(a[1].end) ||
        b[1].filed.localeCompare(a[1].filed),
    );
  if (!complete.length)
    throw Error(
      'No aligned annual USD revenue and operating income in a supported 10-K at this cutoff.',
    );
  const latest = complete[0][1],
    history: Historical[] = [];
  const periods = new Set<number>();
  for (const [key, f] of complete) {
    if (f.accn !== latest.accn) continue;
    const year = Number(f.end.slice(0, 4));
    if (periods.has(year)) continue;
    periods.add(year);
    history.push({
      year,
      sales: f.val / 1e6,
      ebit: ebit.get(key)!.val / 1e6,
      capex: capex.has(key) ? Math.abs(capex.get(key)!.val) / 1e6 : null,
    });
  }
  const acc = latest.accn.replaceAll('-', '');
  return fromHistory(
    x.entityName.slice(0, 100),
    '',
    history.sort((a, b) => a.year - b.year),
    latest.end,
    'User-imported SEC Company Facts (not independently verified) · ' +
      latest.accn +
      ' · filed ' +
      latest.filed +
      ' · cutoff ' +
      cutoff +
      ' · FY labels use period-end calendar year · https://www.sec.gov/Archives/edgar/data/' +
      x.cik +
      '/' +
      acc +
      '/' +
      latest.accn +
      '-index.htm',
  );
}
