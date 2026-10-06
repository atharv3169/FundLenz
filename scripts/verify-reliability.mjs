import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fetchJSON } from '../lib/fetch-json.ts';
import { getCatalog, preferredPlan, formatDate } from '../lib/catalog.ts';
import { getGlobalCatalog, getGlobalDetail, searchGlobalFunds, NAME_THEMES } from '../lib/global-catalog.ts';
import { getSecurities, searchSecurities } from '../lib/securities.ts';
import { getUSExample } from '../lib/portfolios.ts';
import { parseCSV, csvCell, importCSV, datasetCSV } from '../lib/import.ts';
import { restoreSession } from '../lib/session.ts';
import { DEMO } from '../lib/demo.ts';
let checks = 0;
const same = (a,b,message) => { assert.deepEqual(a,b,message); checks++; };
const india=JSON.parse(fs.readFileSync('public/data/catalog.json'));
const global=JSON.parse(fs.readFileSync('public/data/global/catalog.json'));
const securities=JSON.parse(fs.readFileSync('public/data/securities/catalog.json'));
// Compare every Indian plan choice against the previously published selection rule.
const originalPlan = (f,plan='',option='') => [...f.plans].filter(p=>(!plan||p.plan.toLowerCase().includes(plan.toLowerCase()))&&(!option||p.option.toLowerCase().includes(option.toLowerCase()))).sort((a,b)=>(b.navDate||'').localeCompare(a.navDate||'')||Number(b.plan.toLowerCase().includes('direct'))-Number(a.plan.toLowerCase().includes('direct'))||Number(b.option.toLowerCase().includes('growth'))-Number(a.option.toLowerCase().includes('growth')))[0];
for(const f of india.funds)for(const plan of ['','Direct','Regular'])for(const option of ['','Growth','IDCW'])same(preferredPlan(f,plan,option),originalPlan(f,plan,option),'Plan selection unchanged');
const originalGlobal=(query,market='',kind='',theme='',coverage='',asset='',product='')=>{
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean), pattern=NAME_THEMES.find(t=>t.value===theme)?.pattern;
 return global.funds.filter(f=>(!market||f.market===market)&&(!kind||(kind==='listed'?f.listed:kind==='registered'?f.kind==='Registered fund series':f.kind==='Issuer share class'))&&(!pattern||pattern.test(f.name))&&(!coverage||(coverage==='issuer'?f.enriched:!f.enriched))&&(!asset||f.categories.some(c=>c.toLowerCase()===asset))&&(!product||f.productTypes.includes(product))&&terms.every(t=>[f.name,f.registrant||'',f.provider||'',...f.tickers,...f.isins,...f.categories].join(' ').toLowerCase().includes(t)));
};
const queries=['','vanguard total','  ISHARES  core ','SPY','IE00BFG1TN78','ZZZmissing','日本'];
for(const q of queries)for(const market of ['','United States','Australia'])for(const kind of ['','listed','registered','issuer'])same(searchGlobalFunds(global.funds,q,market,kind).map(f=>f.id),originalGlobal(q,market,kind).map(f=>f.id),'Global search equivalence');
for(const theme of NAME_THEMES)same(searchGlobalFunds(global.funds,'','','',theme.value),originalGlobal('','','',theme.value),'Name theme equivalence');
for(const q of ['','treasury','united states treasury',' AAPL ','GB00B24CGK77','ZZZmissing'])for(const type of ['','Bond','Stock'])for(const currency of ['','USD','EUR']){
 const terms=q.toLowerCase().trim().split(/\s+/).filter(Boolean);
 const expected=securities.records.filter(r=>(!type||r.type===type)&&(!currency||r.currency===currency)&&terms.every(t=>[r.name,r.symbol,r.isin,r.cusip,r.exchange,r.country,r.sector].filter(Boolean).join(' ').toLowerCase().includes(t)));
 same(searchSecurities(securities.records,q,type,'',currency).map(r=>r.id),expected.map(r=>r.id),'Securities search equivalence');
}
for(const date of [null,'','garbage'])same(formatDate(date),'Not reported','Unavailable date is safe');
for(const date of ['2026-10-02','2024-02-29','2026-10-05T21:00:00Z'])same(formatDate(date),new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date)),'Date output unchanged');
for(const text of ['null','[]','42','"string"']){await assert.rejects(()=>restoreSession(text),/Invalid FundLenz session/);checks++;}
await assert.rejects(()=>restoreSession(' '.repeat(2_000_001)),/smaller/);checks++;
for(const csv of ['"a"junk,b','"a" "b",c','a,"unterminated']){assert.throws(()=>parseCSV(csv),/quoted|quoting/);checks++;}
same(parseCSV('a,"b,b","line1\nline2","a""b"\r\n'),[['a','b,b','line1\nline2','a"b']],'Valid quoted CSV');
same(parseCSV('"a"  ,b\r\n'),[['a','b']],'Whitespace after closing quote');
same(importCSV(datasetCSV(DEMO)).funds,DEMO.funds,'Template round trip');
for(const value of ['=1+1','  =HYPERLINK("x")','\n=cmd','\t+cmd','@SUM(A1)','-cmd']){assert(csvCell(value).replace(/^"/,'').startsWith("'"));checks++;}
same(csvCell(-1.25),'-1.25','Negative numeric exports preserved');
const realFetch=globalThis.fetch;
try {
 for(const status of [404,500]){globalThis.fetch=async()=>new Response('bad',{status});await assert.rejects(()=>fetchJSON('/x','load failed',100),/load failed/);checks++;}
 globalThis.fetch=async()=>new Response('<html>not JSON</html>');await assert.rejects(()=>fetchJSON('/x','bad JSON',100),/bad JSON/);checks++;
 let aborted=false;
 globalThis.fetch=(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));},{once:true}));
 await assert.rejects(()=>fetchJSON('/slow','timed out',10),/timed out/);same(aborted,true,'Stalled request aborted');
 // All promise caches must deduplicate concurrent reads and recover after failure.
 const reads=[getCatalog,getGlobalCatalog,getSecurities,getUSExample,()=>getGlobalDetail(global.funds[0].id)];
 for(const read of reads){
  let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:503});};
  const failure=await Promise.allSettled([read(),read()]);same(calls,1,'Concurrent requests coalesced');same(failure.map(r=>r.status),['rejected','rejected'],'Failure propagated');
  globalThis.fetch=async url=>{calls++;return new Response(fs.readFileSync('public'+url),{headers:{'content-type':'application/json'}});};
  const [first,second]=await Promise.all([read(),read()]);same(calls,2,'Failed cache evicted for retry');same(first,second,'Successful snapshot reused');
 }
} finally {globalThis.fetch=realFetch;}
console.log(JSON.stringify({status:'passed',checks,verified:['all Indian plan choices unchanged','international and securities search equivalence','malformed CSV/session rejection','spreadsheet formula escaping','request timeout','cache retry and concurrent deduplication']},null,2));
