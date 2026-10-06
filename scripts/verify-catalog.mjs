import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyze, stress, overlap, allocationSearch } from '../lib/finance.ts';
import { preferredPlan, isOlderNav } from '../lib/catalog.ts';

const catalog = JSON.parse(fs.readFileSync('public/data/catalog.json', 'utf8'));
let checks = 0;
const ok = (v, message) => { checks++; assert.ok(v, message); };
const close = (a, b, tolerance = 1e-8) => ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
const planCodes = new Set(), allIds = new Set(), portfolios = [];
ok(catalog.funds.length === catalog.stats.fundRecords, 'Fund record count');
for (const fund of catalog.funds) {
  ok(!allIds.has(fund.id), 'Unique fund identity'); allIds.add(fund.id);
  ok(fund.plans.length > 0 && !!preferredPlan(fund), 'At least one plan');
  const best = preferredPlan(fund);
  ok(fund.plans.every(p => (p.navDate || '') <= (best.navDate || '')), 'Preferred plan uses newest available date');
  for (const p of fund.plans) {
    ok(!planCodes.has(p.code), 'Each AMFI code occurs once'); planCodes.add(p.code);
    ok(p.nav === null || Number.isFinite(p.nav) && p.nav >= 0, 'Reported NAV is numeric or missing');
  }
  for (const url of Object.values(fund.links).filter(Boolean)) ok(/^https?:\/\//.test(url), 'Document URLs use HTTP(S)');
  if (!fund.portfolioId) { ok(!fund.portfolioSummary, 'Unavailable holdings have no stale summary'); continue; }
  const p = JSON.parse(fs.readFileSync(`public/data/holdings/${fund.id}.json`, 'utf8'));
  portfolios.push(p);
  ok(p.id === fund.id && p.name === fund.name && p.amc === fund.amc, 'Portfolio matches catalogue identity');
  ok(p.date === catalog.stats.holdingsDate && p.scenarioScope === 'disclosed_equities_only', 'Consistent snapshot and model scope');
  ok(p.aumINR > 0 && p.holdings.length > 0 && /^[a-f0-9]{64}$/.test(p.sourceSha256), 'Net assets and source provenance');
  const ids = new Set();
  for (const h of p.holdings) {
    ok(!ids.has(h.id + ':' + h.type), 'No duplicated classified position'); ids.add(h.id + ':' + h.type);
    close(h.weight, h.marketValueINR / p.aumINR * 100, 1e-7);
    ok(['equity', 'cash', 'other'].includes(h.type), 'Supported accounting classification');
    ok(h.type === 'other' || h.weight >= 0, 'Signed balances excluded from long-only equity and cash');
    if (h.type === 'equity') ok(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(h.id) && !h.id.startsWith('INF'), 'Equities identified by ISIN, not fund units');
  }
  const total = p.holdings.reduce((s, h) => s + h.weight, 0);
  close(100 - total, p.reconciliationDifferencePct, 1e-7);
  ok(Math.abs(total - 100) <= .1 + 1e-7, 'Leaf rows reconcile to NAV within declared tolerance');
  for (const [key, type] of [['equityPct','equity'], ['cashPct','cash'], ['otherPct','other']]) close(p[key], p.holdings.filter(h => h.type === type).reduce((s, h) => s + h.weight, 0));
  const a = analyze([p], { [p.id]: 100000 });
  close(a.equity * 100, fund.portfolioSummary.equityPct);
  const scenario = stress(a, { broad: -10, sector: '', sectorShock: 0, stock: '', stockShock: 0 });
  close(scenario.impact, -.1 * a.equity);
  ok(scenario.partial, 'Official statements always have a partial equity scenario');
  if (a.equity > 0) { close(overlap(p, p), 1); ok(a.hhi > 0 && a.hhi <= 1 + 1e-9, 'HHI bounds'); }
}
ok(planCodes.size === catalog.stats.planRecords, 'All AMFI codes counted');
ok(portfolios.length === catalog.stats.holdingsFunds, 'Portfolio coverage count');
ok(new Set(portfolios.map(p => p.amc)).size === catalog.stats.holdingsFundHouses, 'Fund house coverage count');
ok(isOlderNav('2020-01-01', catalog.stats.latestNavDate), 'Old NAV labelled');
ok(!isOlderNav(catalog.stats.latestNavDate, catalog.stats.latestNavDate), 'Latest NAV labelled');
const signed = { id:'signed', holdings:[{ id:'X',name:'X',sector:'X',type:'equity',weight:100 },{ id:'P',name:'P',sector:'Other',type:'other',weight:5 },{ id:'N',name:'N',sector:'Other',type:'other',weight:-5 }] };
const sa = analyze([signed], { signed: 100 });
close(sa.other, 0); close(sa.otherGross, .1); ok(stress(sa, { broad:0,sector:'',sectorShock:0,stock:'',stockShock:0 }).partial, 'Offsetting unmodeled balances cannot cancel the partial flag');
const mid = portfolios.filter(p => p.category === 'Equity Scheme - Mid Cap Fund' && p.equityPct > 50).slice(0, 5);
ok(mid.length >= 3, 'Multiple real funds for allocation invariant check');
const amounts = Object.fromEntries(mid.map((p, i) => [p.id, i < 2 ? 50000 : 0]));
const a = analyze(mid, amounts), result = allocationSearch(mid, amounts, .2), b = analyze(mid, result.amounts);
close(a.total, b.total, 1e-6); close(a.equity, b.equity); ok(b.hhi <= a.hhi + 1e-9 && result.turnover <= .2 + 1e-9, 'Real allocation search improves or preserves HHI within turnover cap');
ok(Object.values(result.amounts).every(v => v >= -1e-7), 'Long-only fund allocation');
console.log(JSON.stringify({status:'passed', checks, fundRecords:allIds.size, plans:planCodes.size, portfolios:portfolios.length, holdings:portfolios.reduce((s,p)=>s+p.holdings.length,0), realSearch:{baselineHHI:a.hhi,candidateHHI:b.hhi,turnover:result.turnover}}, null, 2));
