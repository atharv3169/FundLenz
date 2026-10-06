import assert from 'node:assert/strict';
import { analyze, overlap, stress, allocationSearch, validateAmounts, validateScenario, DEFAULT_SCENARIO } from '../lib/finance.ts';
import { DEMO, DEMO_AMOUNTS } from '../lib/demo.ts';
import { datasetCSV, importCSV, parseCSV, toCSV } from '../lib/import.ts';
let checks = 0;
function close(actual, expected, tolerance = 1e-10) { checks++; assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`); }
function eq(actual, expected) { checks++; assert.deepEqual(actual, expected); }
function fails(fn, pattern) { checks++; assert.throws(fn, pattern); }
const a = analyze(DEMO.funds, DEMO_AMOUNTS);
close(a.total,100000); close(a.equity,.9); close(a.cash,.1); close(a.missing,0); close(a.other,0);
for (const [id,w] of Object.entries({X:.068,Y:.312,Z:.16,W:.36})) { const s=a.stocks.find(s=>s.id===id); close(s.weight,w); close(s.value,w*100000); }
close(a.hhi,.31749135802469136); close(a.effective,3.149692030112611);
close(stress(a,DEFAULT_SCENARIO).impact,-.076); close(stress(a,DEFAULT_SCENARIO).value,-7600); close(stress(a,DEFAULT_SCENARIO).endValue,92400);
close(stress(a,{...DEFAULT_SCENARIO,stock:'X',stockShock:-50}).impact,-.0964);
close(stress(a,{broad:-100,sector:'',sectorShock:0,stock:'',stockShock:0}).impact,-.9);
close(stress(a,{broad:10,sector:'',sectorShock:0,stock:'',stockShock:0}).impact,.09);
close(overlap(DEMO.funds[0],DEMO.funds[1]),1/3); close(overlap(DEMO.funds[0],DEMO.funds[3]),0);
for (const f of DEMO.funds) { close(overlap(f,f),1); for (const g of DEMO.funds) close(overlap(f,g),overlap(g,f)); }
const scaled=analyze(DEMO.funds,Object.fromEntries(Object.entries(DEMO_AMOUNTS).map(([k,v])=>[k,v*17])));
close(scaled.hhi,a.hhi); close(scaled.effective,a.effective); close(scaled.total,1700000);
const empty=analyze(DEMO.funds,{}); eq(empty.hhi,null); eq(empty.effective,null); eq(empty.stocks,[]); close(stress(empty,DEFAULT_SCENARIO).value,0);
const partial=structuredClone(DEMO.funds[0]); partial.holdings=partial.holdings.filter(h=>h.id!=='Y');
const pa=analyze([partial],{A:1000}); close(pa.missing,.42); close(pa.cash,.1); eq(stress(pa,DEFAULT_SCENARIO).partial,true); close(stress(pa,DEFAULT_SCENARIO).modeled,.58);
const other=structuredClone(DEMO.funds[0]); other.holdings.find(h=>h.id==='Y').type='other'; const oa=analyze([other],{A:1000}); close(oa.other,.42); eq(stress(oa,DEFAULT_SCENARIO).partial,true);
const cash=structuredClone(DEMO.funds[0]); cash.holdings=[{id:'CASH',name:'Cash',sector:'Cash',type:'cash',weight:100}]; const ca=analyze([cash],{A:1000}); eq(ca.hhi,null); eq(overlap(cash,cash),null); close(stress(ca,DEFAULT_SCENARIO).endValue,1000);
const c=allocationSearch(DEMO.funds,DEMO_AMOUNTS,.2), b=analyze(DEMO.funds,c.amounts);
close(b.total,a.total,1e-7); close(b.equity,a.equity); eq(c.turnover<=.2+1e-9,true); eq(b.hhi<a.hhi,true);
for (const category of new Set(DEMO.funds.map(f=>f.category))) { const fs=DEMO.funds.filter(f=>f.category===category); close(fs.reduce((s,f)=>s+b.weights[f.id],0),fs.reduce((s,f)=>s+a.weights[f.id],0)); }
close(c.improvement,a.hhi-b.hhi); eq(Object.values(c.amounts).every(x=>x>=0),true);
close(allocationSearch(DEMO.funds,DEMO_AMOUNTS,0).improvement,0);
const csv=datasetCSV(DEMO); const restored=importCSV(csv); eq(restored.funds,DEMO.funds); close(analyze(restored.funds,DEMO_AMOUNTS).hhi,a.hhi);
eq(parseCSV('a,b\r\n"comma, quote ""x""",2'),[['a','b'],['comma, quote "x"','2']]);
eq(parseCSV(toCSV([['a','b'],['line\none',2]])),[['a','b'],['line\none','2']]);
fails(()=>importCSV(csv+'\r\n'+csv.split('\r\n')[1]),/duplicate security/);
fails(()=>importCSV(csv.replace('2026-08-31','2026-07-31')),/metadata|common portfolio/);
fails(()=>importCSV(csv.replace(',8,',',800,')),/percentage/);
fails(()=>importCSV(csv.replace(',8,',',-8,')),/percentage/);
fails(()=>importCSV(csv.replace(',8,',',18,')),/above 100/);
fails(()=>importCSV(csv.replace('A,A,','A,B,')),/metadata|underlying portfolio/);
fails(()=>importCSV(csv.replace(',equity,',',derivative,')),/unsupported/);
fails(()=>importCSV(csv.replace('Example Bank X','Conflicting Name')),/conflicting/);
fails(()=>importCSV('bad,columns\n1,2'),/column names/);
fails(()=>parseCSV('a,b\n"unclosed,1'),/not closed/);
fails(()=>validateAmounts(DEMO.funds,{A:-1}),/between/); fails(()=>validateAmounts(DEMO.funds,{A:Infinity}),/finite/); fails(()=>validateAmounts(DEMO.funds,{oops:1}),/unknown fund/);
fails(()=>validateScenario({...DEFAULT_SCENARIO,broad:-101},DEMO.funds),/from/); fails(()=>validateScenario({...DEFAULT_SCENARIO,stock:'NO'},DEMO.funds),/Unknown stock/);
eq(validateAmounts(DEMO.funds,DEMO_AMOUNTS),DEMO_AMOUNTS);
console.log(JSON.stringify({status:'passed',checks,reference:{hhi:a.hhi,overlap:overlap(DEMO.funds[0],DEMO.funds[1]),sectorShock:stress(a,DEFAULT_SCENARIO).impact,stockOverride:stress(a,{...DEFAULT_SCENARIO,stock:'X',stockShock:-50}).impact},search:{baseline:a.hhi,candidate:b.hhi,turnover:c.turnover,candidates:c.checked}},null,2));
