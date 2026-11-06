import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  demo,
  blank,
  clone,
  calculate,
  evaluate,
  capital,
  shocks,
  reverse,
  simulate,
  defaultSim,
} from '../lib/atlas/model.ts';
import {
  csv,
  modelCsv,
  readCsv,
  importCsv,
  snapshot,
  importJson,
  parseModel,
  forecastCsv,
} from '../lib/atlas/files.ts';
import { filingModel, secFacts } from '../lib/atlas/research.ts';
import { equityMethod, holdingReturn } from '../lib/atlas/equity.ts';
import { workbook } from '../lib/atlas/workbook.ts';
let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log('  ✓ ' + name);
};
const close = (actual, expected) =>
  assert.ok(
    Number.isFinite(actual) &&
      Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)),
    actual + ' != ' + expected,
  );
const m = demo(),
  base = calculate(m),
  stressed = clone(m);
stressed.horizon = 10;
stressed.overrides = [
  { margin: -32, nwc: 23 },
  { margin: -16, capex: 14 },
  { margin: 45, da: 8 },
];
stressed.inputs.nol = 205;
stressed.timing = 'midyear';
const fixtures = [m, stressed];
for (const terminal of ['multiple', 'growth'])
  for (const timing of ['year-end', 'midyear'])
    for (const horizon of [3, 7, 10]) {
      const c = demo(1);
      Object.assign(c, { terminal, timing, horizon, discount: 'direct' });
      Object.assign(c.inputs, { nwc: -12, growthEnd: -4, nol: 88 });
      c.overrides = [{ capex: 8 }, {}, { margin: 7, nwc: 3 }];
      fixtures.push(c);
    }
const proc = spawnSync('python3', ['scripts/atlas-reference.py'], {
  input: JSON.stringify(fixtures),
  encoding: 'utf8',
});
assert.equal(proc.status, 0, proc.stderr);
const refs = JSON.parse(proc.stdout);
test('14 independent Decimal valuations: annual taxes and FCFF, both terminal methods, timing and horizons', () =>
  fixtures.forEach((c, i) => {
    const r = calculate(c),
      ref = refs[i];
    for (const k of ['ev', 'tv', 'terminalPV', 'perShare']) close(r[k], ref[k]);
    r.rows.forEach((x, y) => {
      close(x.fcff, ref.flows[y]);
      close(x.taxes, ref.taxes[y]);
    });
  }));
test('hand-calculated steady enterprise and residual financing bridge', () => {
  const c = demo();
  Object.assign(c, { horizon: 3, discount: 'direct' });
  Object.assign(c.inputs, {
    revenue: 100,
    growth: 0,
    growthEnd: 0,
    margin: 10,
    marginEnd: 10,
    tax: 0,
    da: 0,
    capex: 0,
    nwc: 0,
    wacc: 10,
    terminalG: 0,
    roic: 10,
    cash: 10,
    assets: 0,
    debt: 25,
    claims: 5,
    shares: 4,
    price: 15,
  });
  const r = calculate(c);
  close(r.ev, 100);
  close(r.perShare, 20);
  close(r.safety, 25);
  close(r.gap, 100 / 3);
});
test('NOL carried through losses, early tax relief never becomes a refund', () => {
  const r = calculate(stressed);
  assert(r.rows[1].losses > r.rows[0].losses);
  assert.equal(r.rows[0].taxes, 0);
  assert(r.rows.some((x) => x.taxes > 0));
  assert(r.rows.every((x) => x.taxes >= 0 && x.losses >= 0));
});
test('CAPM/WACC independent weighting and marginal tax shield', () => {
  close(capital(m).ke, 10.05);
  close(capital(m).built, 8.82);
});
test('blank, sector mismatch, false zero, nonfinite, WACC≤g and zero shares are rejected', () => {
  const values = [
    blank(),
    { ...m, sector: 'Bank / insurer' },
    ...['revenue', 'shares'].map((k) => ({
      ...m,
      inputs: { ...m.inputs, [k]: 0 },
    })),
    { ...m, inputs: { ...m.inputs, cash: Infinity } },
    { ...m, inputs: { ...m.inputs, terminalG: 9 } },
  ];
  for (const bad of values) assert.equal(evaluate(bad).r, null);
  const noPrice = { ...m, inputs: { ...m.inputs, price: null } };
  assert.equal(calculate(noPrice).gap, null);
});
test('negative equity is not floored or converted into a margin of safety', () => {
  const r = calculate({ ...m, inputs: { ...m.inputs, debt: 1e8 } });
  assert(r.perShare < 0);
  assert.equal(r.safety, null);
});
test('shocks update overrides and both fade endpoints without modifying the parent', () => {
  const s = shocks(stressed, { growth: 2, margin: -1, capex: 3, wacc: 1 });
  close(s.overrides[0].margin, -33);
  close(s.overrides[1].capex, 17);
  close(s.inputs.growthEnd, 7);
  close(s.inputs.wacc, 9.82);
  assert.equal(stressed.overrides[0].margin, -32);
  assert.equal(stressed.discount, 'built');
});
test('reverse solves price from each driver, flags impossible targets and sector blocks', () => {
  for (const [key, level] of [
    ['growth', 9],
    ['margin', 21],
    ['wacc', 10.5],
  ]) {
    const c = clone(m);
    if (key === 'wacc') {
      c.discount = 'direct';
      c.inputs.wacc = level;
    } else {
      c.inputs[key] = level;
      c.inputs[key === 'growth' ? 'growthEnd' : 'marginEnd'] = level;
    }
    const sol = reverse(m, key, calculate(c).perShare);
    assert(sol.some((x) => Math.abs(x - level) < 1e-6));
  }
  assert.deepEqual(reverse(m, 'margin', 1e9), []);
  assert.deepEqual(reverse(m, 'wacc', -2), []);
});
test('uncertainty: seeded reproduction, zero-volatility oracle, rejected draws, full histogram accounting', () => {
  const a = simulate(m, { ...defaultSim, draws: 120, rate: 20 }),
    b = simulate(m, { ...defaultSim, draws: 120, rate: 20 });
  assert.deepEqual(a, b);
  assert(a.excluded > 0);
  assert.equal(a.valid + a.excluded, 120);
  assert.equal(
    a.bins.reduce((x, y) => x + y),
    a.valid,
  );
  assert(a.p10 <= a.p50 && a.p50 <= a.p90);
  close(
    simulate(m, {
      ...defaultSim,
      draws: 100,
      growth: 0,
      margin: 0,
      rate: 0,
      rho: -1,
    }).p50,
    base.perShare,
  );
  assert.throws(() => simulate(m, { ...defaultSim, rho: 1.1 }));
  assert.throws(() => simulate(m, { ...defaultSim, draws: 5001 }));
});
test('DDM and FCFE agree with a constant-growth perpetuity; REIT and residual income are independently anchored', () => {
  const a = {
    base: 2,
    years: 4,
    growth: 3,
    stable: 3,
    rate: 10,
    payout: 65,
    exit: 12,
    roe: 10,
    stableRoe: 10,
  };
  close(equityMethod('Dividend discount', a).value, (2 * 1.03) / 0.07);
  close(equityMethod('Equity cash flow', a).value, (2 * 1.03) / 0.07);
  close(equityMethod('Residual income', a).value, 2);
  close(
    equityMethod('REIT distributions', { ...a, years: 1 }).value,
    (2 * 1.03 * (0.65 + 12)) / 1.1,
  );
  assert.throws(() => equityMethod('Dividend discount', { ...a, rate: 3 }));
  assert.throws(() => equityMethod('REIT distributions', { ...a, exit: 0 }));
});
test('snapshots and editable CSV preserve periods, currency, nullable inputs and hostile text', () => {
  const c = clone(stressed);
  c.name = '=HYPERLINK(1)';
  c.notes = 'comma, "quote"\nsecond line';
  c.inputs.price = null;
  c.currency = 'INR';
  assert.deepEqual(importCsv(modelCsv(c)), parseModel(c));
  assert.deepEqual(importJson(snapshot(c)), parseModel(c));
  assert.equal(readCsv(csv([['=4+2', -7, "'quoted"]]))[0][0], "'=4+2");
  assert.deepEqual(importCsv(modelCsv(blank())), blank());
  assert.equal(readCsv(forecastCsv(m, base)).length, 6);
});
test('malformed dates, hostile properties, duplicates, truncated/schema-less CSV and bad overrides fail closed', () => {
  assert.throws(() => parseModel({ ...m, asOf: '2025-02-30' }));
  assert.throws(() => parseModel({ ...m, inputs: { ...m.inputs, nwc: '1' } }));
  assert.throws(() => parseModel({ ...m, overrides: [{ price: 1 }] }));
  assert.throws(() => parseModel({ ...m, constructor: 123 }));
  assert.throws(() => importCsv(modelCsv(m) + 'input,growth,,12\r\n'));
  assert.throws(() =>
    importCsv(modelCsv(m).replace('schema,version,,1', 'schema,version,,0')),
  );
  assert.throws(() => readCsv('a,"unclosed'));
  assert.throws(() => importJson('{"format":"fake"}'));
});
test('filing profiles have genuine historic figures and do not produce a guessed valuation', () => {
  assert.equal(filingModel(0).inputs.revenue, 416161);
  assert.equal(filingModel(1).history[2].ebit, 128528);
  for (const i of [0, 1]) {
    const c = filingModel(i);
    assert.equal(c.inputs.price, null);
    assert.equal(c.inputs.wacc, null);
    assert.equal(evaluate(c).r, null);
    assert.match(c.source, /www.sec.gov/);
  }
});
test('SEC file import uses one accession, whole annual periods, USD, and an as-of filing cutoff', () => {
  const f = {
    start: '2024-01-01',
    end: '2024-12-31',
    filed: '2025-02-12',
    fp: 'FY',
    fy: 2024,
    form: '10-K',
    accn: '0000000001-25-000020',
    val: 0,
  };
  const units = (a) => ({ units: { USD: a } });
  const rev = { ...f, val: 412e6 },
    inc = { ...f, val: 65e6 },
    other = { ...f, accn: '0000000001-25-000021', val: 40e6 };
  const facts = {
    cik: 1,
    entityName: 'Test filing',
    facts: {
      'us-gaap': {
        Revenues: units([rev, { ...rev, fp: 'Q3', val: 8e6 }]),
        OperatingIncomeLoss: units([inc]),
        PaymentsToAcquirePropertyPlantAndEquipment: units([other]),
      },
    },
  };
  const c = secFacts(facts, '2025-03-01');
  assert.deepEqual(c.history, [
    { year: 2024, sales: 412, ebit: 65, capex: null },
  ]);
  assert.match(c.source, /not independently verified/);
  assert.throws(() => secFacts(facts, '2025-01-01'));
  assert.throws(() => secFacts(facts, '2025-02-30'));
  facts.facts['us-gaap'].OperatingIncomeLoss = units([other]);
  assert.throws(() => secFacts(facts, '2025-03-01'));
});
test('holding-period IRR accounts for distribution timing and permits losses', () => {
  close(holdingReturn(100, 121, 0, 2), 10);
  close(holdingReturn(100, 100, 7, 10), 7);
  close(holdingReturn(100, 81, 0, 2), -10);
  assert.throws(() => holdingReturn(0, 10, 1, 3));
});
test('research worksheets, peer data and a partially entered alternative method survive JSON and CSV round trips', () => {
  const c = clone(m);
  c.labs = {
    method: 'Dividend discount',
    equity: { 'Dividend discount': { base: null, rate: 8 } },
    scenarios: { spread: 6 },
    risk: { rho: -0.35 },
    peers: [{ name: '=Peer()', ev: 10, ebitda: null }],
    holding: { exit: 70 },
  };
  assert.deepEqual(importCsv(modelCsv(c)), c);
  assert.deepEqual(importJson(snapshot(c)), c);
  assert.throws(() =>
    parseModel({
      ...c,
      labs: { peers: [{ name: 'X', ev: Infinity, ebitda: null }] },
    }),
  );
});
const bytes = Buffer.from(
  await workbook(stressed, calculate(stressed)).arrayBuffer(),
);
const inspect = spawnSync(
  'python3',
  [
    '-c',
    `import sys,io,zipfile,json,xml.etree.ElementTree as E
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert not z.testzip()
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
sheets=E.fromstring(z.read('xl/workbook.xml')).findall('.//s:sheet',ns)
assert [x.get('name') for x in sheets]==['Summary','Inputs','Forecast','History']
s=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
c=s.find(".//s:c[@r='B9']",ns)
print(json.dumps([c.find('s:f',ns).text,float(c.find('s:v',ns).text)]))
`,
  ],
  { input: bytes },
);
assert.equal(inspect.status, 0, inspect.stderr.toString());
const [formula, v] = JSON.parse(inspect.stdout);
test('xlsx ZIP, relationships, sheets and equity/share formula with full precision cached result', () => {
  assert.match(formula, /B8\/Inputs!/);
  close(v, calculate(stressed).perShare);
});
console.log('DCF Atlas: ' + checks + ' verification groups passed.');
