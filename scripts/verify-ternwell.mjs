import assert from 'node:assert/strict';
import {CASES, emptyBook,example,forecast,openingGap} from '../lib/ternwell/model.ts';
import {importFile,inputCsv,resultsWorkbook,shiftYear,statementCsv,validate} from '../lib/ternwell/files.ts';
import {readCsv} from '../lib/atlas/files.ts';
const near=(a,b)=>assert(Math.abs(a-b)<1e-6, a+' vs '+b);
const ref=example();ref.opening={revenue:365,cash:50,ar:30,inv:20,ppe:100,otherAssets:0,ap:10,otherLiab:0,debt:50,revolver:0,capital:90,retained:50};
Object.assign(ref.cases.Base.drivers,{growth:0,margin:50,opex:20,dep:10,interest:10,revolverRate:10,capex:10,dso:40,dio:50,dpo:30,tax:20,payout:25,repay:10,newDebt:0,newEquity:0,floor:10,limit:100});
const p=forecast(ref,'Base')[0];for(const [k,v] of Object.entries({ebitda:109.5,ebit:99.5,pretax:94.5,tax:-18.9,net:75.6,dividends:-18.9,ar:40,inv:25,ap:15,cfo:75.6,cfi:-36.5,cff:-28.9,cash:60.2,ppe:126.5,debt:40,retained:106.7,assets:251.7,liabilitiesEquity:251.7,balanceGap:0,fundingGap:0}))near(p[k],v);
const shock=structuredClone(ref);shock.cases.Base.drivers.opex=100;
const stressed=forecast(shock,'Base')[0];for(const [k,v] of Object.entries({net:-197.5,cfo:-197.5,tax:0,dividends:0,draw:100,totalDebt:140,cash:-94,fundingGap:104,assets:97.5,balanceGap:0}))near(stressed[k],v);
assert(stressed.balanced);assert.equal(stressed.debtMultiple,null);
const unbalanced=structuredClone(ref);unbalanced.opening.cash+=3;near(openingGap(unbalanced.opening),3);for(const y of forecast(unbalanced,'Base')){near(y.balanceGap,3);assert(!y.balanced);}
const blank=emptyBook();for(const y of forecast(blank,'Base')){assert(y.balanced);assert.equal(y.interestCover,null);assert.equal(y.cashCycle,null);assert.equal(y.netMargin,null);}
const cap=structuredClone(ref);Object.assign(cap.cases.Base.drivers,{repay:500,dep:100,payout:100});const cp=forecast(cap,'Base');near(cp[0].debtPay,-50);assert(cp.every(x=>x.debt>=0&&x.ppe>=0));
const excess=structuredClone(ref);excess.opening.revolver=40;excess.opening.capital-=40;Object.assign(excess.cases.Base.drivers,{limit:10,floor:200});const ex=forecast(excess,'Base')[0];near(ex.draw,0);near(ex.limitExcess,30);
const multi=structuredClone(ref);multi.cases.Base.overrides[2027]={margin:64,newEquity:10};assert.notEqual(forecast(multi,'Base')[1].net,forecast(ref,'Base')[1].net);assert.deepEqual(forecast(multi,'Upside'),forecast(ref,'Upside'));
multi.name='=1+1, "café"';for(const b of [multi,example(),emptyBook()]){assert.deepEqual(importFile(inputCsv(b)),b);assert.deepEqual(importFile(JSON.stringify(b)),b);}
const shifted=structuredClone(multi);shiftYear(shifted,2030);assert.deepEqual(shifted.cases.Base.overrides[2032],multi.cases.Base.overrides[2027]);
const bad=structuredClone(ref);bad.cases.Base.drivers.growth=Infinity;assert.throws(()=>validate(bad));
assert.throws(()=>importFile(inputCsv(ref).replace('opening,,,cash,50','opening,,,cash,50\nopening,,,cash,50')));
assert.throws(()=>importFile(inputCsv(ref).replace('opening,,,cash,50','opening,,,cash,not money')));
assert.throws(()=>importFile(inputCsv(ref).replace('opening,,,ar,30\r\n','')));
assert.throws(()=>importFile(inputCsv(ref).replace('opening,,,ar','opening,,,__proto__')));
assert.throws(()=>importFile(statementCsv(ref,'Base')));assert.throws(()=>importFile('z'.repeat(1000001)));
const out=readCsv(statementCsv(ref,'Base'));near(+out.find(r=>r[0]==='Cash flow'&&r[1]==='Closing cash')[2],60.2);
const bytes=resultsWorkbook(ref,'Base');assert.equal(Buffer.from(bytes).readUInt32LE(0),0x04034b50);const xml=Buffer.from(bytes).toString('utf8');assert(xml.includes('xl/worksheets/sheet9.xml'));assert(xml.includes('<f>SUM(B2:B6)</f>'));
let n=0;
for(const growth of [-80,-15,0,55])for(const margin of [-15,20,92])for(const days of [0,75,360])for(const limit of [0,23])for(const sc of CASES){const b=structuredClone(ref);b.horizon=10;Object.assign(b.cases[sc].drivers,{growth,margin,dso:days,limit});const rows=forecast(b,sc);for(const [i,r] of rows.entries()){assert(r.balanced);assert(r.revolver>=0&&r.revolver<=limit+1e-7);near(r.cash,r.openingCash+r.cfo+r.cfi+r.cff);near(r.retained,(i?rows[i-1].retained:b.opening.retained)+r.net+r.dividends);assert(Number.isFinite(r.assets));n++;}}
console.log('Ternwell: independent profit, loss and liquidity fixtures; CSV/JSON and workbook checks; '+n+' simulated forecast years passed.');

const {importStatements}=await import('../lib/ternwell/files.ts');
const {LINE_KEYS}=await import('../lib/ternwell/model.ts');
for(const key of LINE_KEYS){
  const b=example(), old=forecast(b,'Base')[0];
  b.cases.Base.lines={2026:{[key]:old[key]+7}};
  assert.equal(forecast(b,'Base')[0][key],old[key]+7,key);
  assert.deepEqual(importFile(inputCsv(b)),b);assert.deepEqual(validate(JSON.parse(JSON.stringify(b))),b);
  shiftYear(b,2030);assert.equal(b.cases.Base.lines[2031][key],old[key]+7);
}
const editing=example(),raw=statementCsv(editing,'Base');
assert.deepEqual(importStatements(raw,editing,'Base'),editing);
const changed=raw.replace(/Income statement,Revenue,[^,]+/,'Income statement,Revenue,500');
const patched=importStatements(changed,editing,'Base');
assert.deepEqual(patched.cases.Base.lines,{2026:{revenue:500}});
const [p1,p2]=forecast(patched,'Base');near(p1.revenue,500);near(p2.revenue,540);assert(p1.balanced);
assert.deepEqual(forecast(patched,'Upside'),forecast(editing,'Upside'));
const mismatch=example(); mismatch.opening.cash+=3;mismatch.cases.Base.lines={2026:{balanceGap:0,net:90}};
const mr=forecast(mismatch,'Base')[0];near(mr.balanceGap,0);near(mr.actualBalanceGap,3);assert(!mr.balanced&&mr.lineIssues.length>=2&&mr.statementGap>0);
assert.throws(()=>importStatements(raw,editing,'Upside'));assert.throws(()=>importStatements(raw.replace('USD millions','EUR millions'),editing,'Base'));
const conflicting=raw.replace(/Income statement,Net income,[^,]+/,'Income statement,Net income,9').replace(/Cash flow,Net income,[^,]+/,'Cash flow,Net income,8');assert.throws(()=>importStatements(conflicting,editing,'Base'),/Conflicting/);
assert.deepEqual(importStatements(raw,patched,'Base'),patched);
console.log('Ternwell: all statement lines, linked years, independent diagnostics, case isolation and CSV edits verified.');
