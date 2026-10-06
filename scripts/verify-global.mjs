import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { searchGlobalFunds, globalMoney, getGlobalCatalog, getGlobalDetail, NAME_THEMES } from '../lib/global-catalog.ts';

const catalog=JSON.parse(fs.readFileSync('public/data/global/catalog.json','utf8'));
const byId=new Map(), sourceIds=new Set(catalog.sources.map(s=>s.id));
const allClasses=new Set(), usTickers=new Set(), listedTickers=new Set();
let registry=0, classes=0, issuerClasses=0;
for(const file of fs.readdirSync('public/data/global/details')){
 const bucket=JSON.parse(fs.readFileSync(`public/data/global/details/${file}`,'utf8'));
 for(const [id,f] of Object.entries(bucket)){
  assert.match(id,/^g-[a-f0-9]{16}$/);assert.equal(file,id.slice(2,4)+'.json');assert(!byId.has(id));byId.set(id,f);
  assert.equal(f.classCount,f.classes.length);assert.equal(f.listed,f.listings.length>0);
  assert(f.sourceIds.length>0 && f.sourceIds.every(s=>sourceIds.has(s)));
  if(f.kind==='Registered fund series'){registry++;classes+=f.classes.length;assert(f.secSeriesId && f.cik);assert.equal(f.asOf,'2026-06-01');}
  if(f.enriched)issuerClasses+=f.classes.filter(c=>c.sourceIds.some(s=>s.includes('screener')||s==='vanguard-au-funds')).length;
  assert(!f.portfolioId && !f.holdings); // Directory records cannot be mistaken for lab portfolios.
  for(const c of f.classes){
   assert(!allClasses.has(c.id));allClasses.add(c.id);assert(c.sourceIds.every(s=>sourceIds.has(s)));
   if(c.nav!=null){assert(Number.isFinite(c.nav)&&c.nav>=0);assert.match(c.currency,/^[A-Z]{3}$/);assert.match(c.navDate,/^\d{4}-\d{2}-\d{2}$/);}
   if(c.feePct!=null)assert(Number.isFinite(c.feePct)&&c.feePct>=0&&c.feePct<100);
   if(c.aum!=null)assert(c.aumCurrency && c.aumDate);
   for(const url of [c.url,c.factsheet].filter(Boolean))assert(['http:','https:'].includes(new URL(url).protocol));
  }
  if(f.market==='United States')for(const t of f.tickers){assert(!usTickers.has(t),`US ticker reused: ${t}`);usTickers.add(t);}
  for(const l of f.listings){assert(!listedTickers.has(l.ticker));listedTickers.add(l.ticker);assert(f.tickers.includes(l.ticker));assert(sourceIds.has(l.sourceId));assert.equal(l.date,'2026-10-05');}
 }
}
assert.equal(catalog.funds.length,byId.size);assert.equal(catalog.stats.records,byId.size);
for(const f of catalog.funds){const d=byId.get(f.id);assert(d);for(const [k,v] of Object.entries(f))assert.deepEqual(v,d[k]);}
assert.equal(registry,18653);assert.equal(classes,39138);assert.equal(listedTickers.size,5755);assert.equal(issuerClasses,1497);
assert.equal(catalog.stats.registeredSeries,registry);assert.equal(catalog.stats.shareClasses,classes);assert.equal(catalog.stats.etfListings,listedTickers.size);assert.equal(catalog.stats.issuerClasses,issuerClasses);
const exact=t=>catalog.funds.filter(f=>f.tickers.includes(t));
for(const t of ['VOO','VTI','SPY','IVV','QQQ','SCHD','VT','BND','FXAIX','CSPX','SWDA'])assert(exact(t).length>0,`Missing familiar fund ${t}`);
const vti=exact('VTI')[0];assert(vti.tickers.includes('VTSAX'));assert.equal(byId.get(vti.id).listings.length,1);
assert(exact('LEND').every(f=>/SEI/i.test(f.name)), 'Do not attach a recycled historical ticker to an old registry name');
assert(searchGlobalFunds(catalog.funds,'CSPX').some(f=>f.tickers.includes('CSPX')));
assert(searchGlobalFunds(catalog.funds,'IE00BFG1TN78')[0].isins.includes('IE00BFG1TN78'));
assert.equal(searchGlobalFunds(catalog.funds,'','','listed').length,5755);
assert(searchGlobalFunds(catalog.funds,'','Australia').length===80);
assert(searchGlobalFunds(catalog.funds,'','','','','','fixed income').every(f=>f.categories.some(c=>c.toLowerCase()==='fixed income')));
assert(searchGlobalFunds(catalog.funds,'','','','','','','ETC').every(f=>f.productTypes.includes('ETC')));
for(const t of NAME_THEMES)assert(searchGlobalFunds(catalog.funds,'','','',t.value).length>0,`${t.label} theme has records`);
assert.equal(globalMoney(10,null),'Not supplied');assert.equal(globalMoney(null,'USD'),'Not supplied');assert(globalMoney(10,'GBP').startsWith('GBP '));
const rawFiles={'nasdaq-listed':'us/nasdaqlisted.txt','nasdaq-other-listed':'us/otherlisted.txt','sec-mutualfund-tickers':'us/sec-mutualfund-tickers.json','sec-series-classes-june-2026':'us/sec-series-classes-2026.csv','ishares-uk-screener':'issuer/ishares-uk-screener.json','vanguard-au-funds':'issuer/vanguard-au-funds.json'};
for(const s of catalog.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(`data/sources/global/${rawFiles[s.id]}`)).digest('hex'),s.sha256);
globalThis.fetch=async url=>{const file='public'+url;return new Response(fs.existsSync(file)?fs.readFileSync(file):'',{status:fs.existsSync(file)?200:404,headers:{'content-type':'application/json'}});};
assert.equal((await getGlobalCatalog()).stats.records,21389);
assert.equal((await getGlobalDetail(vti.id)).name,vti.name);
await assert.rejects(()=>getGlobalDetail('../../bad'));
await assert.rejects(()=>getGlobalDetail('g-0000000000000000'));
console.log(JSON.stringify({status:'passed',records:byId.size,registeredSeries:registry,registeredClasses:classes,etfListings:listedTickers.size,issuerClasses,markets:catalog.stats.markets,verified:['identity joins','source checksums','currencies and dated NAVs','search and filters','lazy detail loading','reused-ticker separation']},null,2));
