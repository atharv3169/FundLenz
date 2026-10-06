import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DEMO, DEMO_AMOUNTS } from '../lib/demo.ts';
import { DEFAULT_SCENARIO, analyze, overlap, stress } from '../lib/finance.ts';
import { datasetCSV, importCSV, parseCSV, toCSV } from '../lib/import.ts';
import { createSession, restoreSession } from '../lib/session.ts';
import { getUSExample, loadOfficialDataset } from '../lib/portfolios.ts';
import { routeQuery } from '../lib/routes.ts';
import { getSecurities, searchSecurities } from '../lib/securities.ts';
let checks=0; const check=(x,m)=>{checks++;assert(x,m);};
globalThis.fetch=async url=>{const p='public'+url;return new Response(fs.existsSync(p)?fs.readFileSync(p):'',{status:fs.existsSync(p)?200:404});};
const us=await getUSExample();check(us.currency==='USD'&&us.region==='US'&&us.mode==='official','US currency and provenance');check(new Set(us.funds.map(f=>f.date)).size===1,'Common date');check(typeof us.note==='string'&&us.note.includes('rounding'),'Rounding limitations');
const identities=new Map();
for(const f of us.funds){
 const raw=fs.readFileSync(`data/sources/us-example/${f.id.slice(3)}-holdings.csv`);
 check(crypto.createHash('sha256').update(raw).digest('hex')===f.sourceSha256,'US checksum');
 check(Math.abs(f.holdings.reduce((s,h)=>s+h.weight,0)-100)<=.1000001,'Rounding reconciliation');
 check(new Set(f.holdings.map(h=>h.id)).size===f.holdings.length,'Unique positions');
 for(const h of f.holdings){check(Number.isFinite(h.weight),'Finite weight');if(h.type==='equity'){check(h.weight>=0,'Long-only equities');const label=JSON.stringify([h.name,h.sector]);check(!identities.has(h.id)||identities.get(h.id)===label,'Consistent cross-fund identity');identities.set(h.id,label);}}
}
const amounts=Object.fromEntries(us.funds.map((f,i)=>[f.id,i?30000:40000]));const scenario={broad:-10,sector:'',sectorShock:-20,stock:'',stockShock:-30};
const a=analyze(us.funds,amounts);check(a.total===100000,'USD example total');check(a.partialModel&&Math.abs(stress(a,scenario).impact+.1*a.equity)<1e-10,'US scenario partial and exact');check(Math.abs(overlap(us.funds[0],us.funds[0])-1)<1e-10,'Identity overlap');
const saved=createSession(us,amounts,scenario,true);const restored=await restoreSession(JSON.stringify(saved));assert.deepEqual(restored.amounts,amounts);check(restored.data.currency==='USD'&&restored.exampleAmounts,'Session currency and example label');
await assert.rejects(()=>restoreSession(JSON.stringify({...saved,currency:'INR'})),/currency/);
await assert.rejects(()=>restoreSession(JSON.stringify({...saved,funds:saved.funds.map((f,i)=>i?f:{...f,sourceSha256:'bad'})})),/snapshot/);
await assert.rejects(()=>loadOfficialDataset(['us-IVV','f-0000000000000000']),/one supported market/);
await assert.rejects(()=>loadOfficialDataset(['us-NOTREAL']),/not available/);
await assert.rejects(()=>loadOfficialDataset(['us-IVV','us-IVV']),/distinct/);
const template=datasetCSV({...DEMO,currency:'USD'});check(importCSV(template).currency==='USD','USD template roundtrip');check(importCSV(datasetCSV(DEMO)).currency==='INR','INR template');
const rows=parseCSV(template);const old=toCSV(rows.map(r=>r.slice(0,-1)));check(importCSV(old).currency==='INR','Legacy CSV INR default');
const mixed=rows.map(r=>[...r]);mixed[2][mixed[2].length-1]='INR';assert.throws(()=>importCSV(toCSV(mixed)),/mixed currencies/);
assert.throws(()=>importCSV(template.replaceAll(',USD',',EUR')),/USD or INR/);
const v1=await restoreSession(JSON.stringify({version:1,mode:'demo',csv:old,amounts:DEMO_AMOUNTS,scenario:DEFAULT_SCENARIO}));check(v1.data.mode==='demo','Legacy v1 demo restores');
const india=JSON.parse(fs.readFileSync('public/data/catalog.json'));const id=india.funds.find(f=>f.portfolioId).id;const indian=await loadOfficialDataset([id]);const oldOfficial={...createSession(indian,{[id]:1000},scenario,false),version:2};delete oldOfficial.currency;check((await restoreSession(JSON.stringify(oldOfficial))).data.currency==='INR','Legacy official INR session');
check(routeQuery({q:'S&P 500',fund:['a','b'],none:undefined})==='?q=S%26P+500&fund=a&fund=b','Redirect preserves query');
const sec=await getSecurities();check(sec.records.length>30000,'Broad securities coverage');const ids=new Set(),bondIsins=new Set(),bondCusips=new Set();
for(const s of sec.sources){check(crypto.createHash('sha256').update(fs.readFileSync('data/sources/securities/raw/'+s.path)).digest('hex')===s.sha256,'Security source checksum');}
for(const r of sec.records){check(!ids.has(r.id),'Unique security record');ids.add(r.id);check(r.sourceIds.length>0&&r.sourceIds.every(id=>sec.sources.some(s=>s.id===id)),'Source evidence');check(/^\d{4}-\d{2}-\d{2}$/.test(r.asOf),'Record date');check(!('price'in r)&&!('yield'in r)&&!('weight'in r),'No holdings weight masquerading as quote');if(r.type==='Bond'){check(!!r.isin||!!r.cusip,'Bond identity');if(r.isin){check(!bondIsins.has(r.isin),'Unique bond ISIN');bondIsins.add(r.isin);}if(r.cusip){check(!bondCusips.has(r.cusip),'Unique bond CUSIP');bondCusips.add(r.cusip);}check(r.coupon==null||Number.isFinite(r.coupon)&&r.coupon>=0,'Coupon numeric');if(r.maturity)check(new Date(r.maturity).toISOString().slice(0,10)===r.maturity,'Maturity valid');}}
check(searchSecurities(sec.records,'AAPL').some(r=>r.symbol==='AAPL'),'Ticker search');check(searchSecurities(sec.records,'','','Japan').length>0,'International bond coverage');check(searchSecurities(sec.records,'','Bond','','EUR').length>1000,'Currency filter');check(searchSecurities(sec.records,'nonexistentzzzz').length===0,'Empty search');
const bond=sec.records.find(r=>r.type==='Bond'&&r.isin);check(searchSecurities(sec.records,bond.isin).length===1,'ISIN lookup');
console.log(JSON.stringify({status:'passed',checks,usFunds:us.funds.length,usSnapshot:us.funds[0].date,securities:sec.records.length,usdSession:true,legacySessions:true,csvCurrencies:true,redirectQueries:true},null,2));
