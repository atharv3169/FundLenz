import { memo, type ReactNode } from 'react';
import { BALANCE, CASES, CASHFLOW, DRIVERS, DRIVER_KEYS, INCOME, effective, forecast, openingGap, type Book, type Period, type Scenario } from '@/lib/ternwell/model';
import './report.css';

const amt = new Intl.NumberFormat('en-US', {maximumFractionDigits:2});
const tiny = new Intl.NumberFormat('en-US',{notation:'scientific',maximumFractionDigits:2});
const n=(x:number|null)=>x===null?'—':Math.abs(x)>=1e8 || (x!==0&&Math.abs(x)<.005)?tiny.format(x):amt.format(x);
const range=(ps:Period[])=>ps.length===1?'FY'+ps[0].year:'FY'+ps[0].year+'–'+ps[ps.length-1].year;
const metrics=[['revenue','Revenue'],['ebitda','EBITDA'],['net','Net income'],['cfo','Operating cash flow'],['cash','Closing cash'],['fundingGap','Unfunded cash target']] as const;
const tests=[['actualBalanceGap','Assets less liabilities and equity'],['cashGap','Cash roll-forward difference'],['retainedGap','Equity roll-forward difference'],['statementGap','Largest line reconciliation difference'],['fundingGap','Unfunded cash target'],['limitExcess','Credit limit exceeded']] as const;
const inks=['#583b55','#157364','#aa572f'];
const totals=new Set(['gross','ebitda','ebit','net','assets','equity','liabilities','liabilitiesEquity','balanceGap','cfo','cfi','cff','movement','cash']);
type Row={label:string;values:(number|string|null)[];strong?:boolean};
function Table({title,heads,rows}:{title:string;heads:string[];rows:Row[]}){return <table className="tr-table" aria-label={title}><thead><tr><th scope="col">{title}</th>{heads.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.label} className={r.strong?'tr-total':undefined}><th scope="row">{r.label}</th>{r.values.map((x,i)=><td key={i}>{typeof x==='string'?x:n(x)}</td>)}</tr>)}</tbody></table>}
type Series=Record<Scenario,Period[]>;
function Plot({sets,metric,title}:{sets:Series;metric:'cash'|'net';title:string}){
 const all=CASES.flatMap(s=>sets[s].map(p=>p[metric])),lo=Math.min(0,...all),hi=Math.max(0,...all),span=hi-lo||1,years=sets.Base;
 const x=(i:number)=>years.length===1?135:12+i*244/(years.length-1),y=(v:number)=>74-(v-lo)/span*62;
 return <figure className="tr-chart"><figcaption>{title}</figcaption><svg viewBox="0 0 270 95" role="img" aria-label={title+' in all three cases'}><line x1="12" x2="256" y1={y(0)} y2={y(0)} stroke="#a4a0a0" strokeDasharray="2 2"/>{CASES.map((s,j)=><g key={s} stroke={inks[j]}><polyline points={sets[s].map((p,i)=>x(i)+','+y(p[metric])).join(' ')} fill="none" strokeWidth="1.8" strokeDasharray={['','6 2','2 2'][j]}/>{sets[s].map((p,i)=><circle key={p.year} cx={x(i)} cy={y(p[metric])} r="2.2" fill={inks[j]}/>)}</g>)}<text x="12" y="91">FY{years[0].year}</text>{years.length>1&&<text x="256" y="91" textAnchor="end">FY{years.at(-1)!.year}</text>}</svg></figure>
}
function Paper({b,mark,title,sub,children,part,s,report}:{b:Book;mark:string;title:string;sub:string;children:ReactNode;part?:string;s?:Scenario;report?:string}){
return <article className="tr-paper" data-case={s} data-statement={part} data-report={report}><header className="tr-letter"><b>Fund<span>Lenz</span></b><span>TERNWELL &nbsp; / &nbsp; FINANCIAL MODELLING</span></header><div className="tr-heading"><small>{mark}</small><h2>{title}</h2><p>{sub}</p></div>{children}<footer className="tr-footer"><strong>fundlenz.com/ternwell</strong><span>{b.name} · {b.currency} millions</span></footer></article>
}
export const CaseReport=memo(function CaseReport({b}:{b:Book}){
 const sets={Base:forecast(b,'Base'),Upside:forecast(b,'Upside'),Downside:forecast(b,'Downside')};
 const chunks=Array.from({length:Math.ceil(b.horizon/5)},(_,i)=>i*5);
 return <div className="tw-print tw-case-report" aria-label="Ternwell financial report">
 {chunks.map(start=>{const ps=sets.Base.slice(start,start+5);const heads=ps.map(p=>'FY'+p.year);
 return <Paper key={start} b={b} report="comparison" mark={'RESEARCH BOOK  /  '+range(ps)} title={b.name} sub={'Scenario comparison · '+b.currency+' millions · opening FY'+b.year}>
 <div className="tr-legend">{CASES.map((s,i)=><span key={s}><i style={{background:inks[i]}}/>{s}</span>)}</div>
 <div className="tr-charts"><Plot sets={sets} metric="net" title="Net income across the forecast"/><Plot sets={sets} metric="cash" title="Closing cash across the forecast"/></div>
 <Table title="Annual comparisons" heads={heads} rows={metrics.flatMap(([key,label])=>CASES.map((s,i)=>({label:label+' · '+(i?s+' Δ vs Base':'Base'),strong:!i,values:ps.map((p,j)=>i?sets[s][start+j][key]-p[key]:p[key])})))}/>
 <p className="tr-note">Δ is the case amount less Base in the same fiscal year. A positive funding gap is cash still required after available financing. Absolute amounts for each case follow.</p></Paper>})}
 {CASES.flatMap(s=>chunks.flatMap(start=>{const ps=sets[s].slice(start,start+5),heads=ps.map(p=>'FY'+p.year),mark=s.toUpperCase()+' CASE  /  '+range(ps),sub=b.name+' · '+b.currency+' millions · expenses and outflows are negative.';
 return ([['income','Income statement',INCOME],['balance','Balance sheet',BALANCE],['cash','Cash-flow statement',CASHFLOW]] as const).map(([part,label,rows])=><Paper key={s+start+part} b={b} s={s} part={part} mark={mark} title={s==='Base'&&start===0?label:s+' · '+label} sub={sub}>
 <Table title="Line item" heads={heads} rows={rows.map(([key,label])=>({label,strong:totals.has(key),values:ps.map(p=>p[key])}))}/>
 {part==='income'&&<><h3>Operating assumptions</h3><Table title="Driver / unit" heads={heads} rows={DRIVER_KEYS.filter(k=>['Operations','Working capital','Tax & distributions'].includes(DRIVERS[k].group)).map(k=>({label:DRIVERS[k].label+' ('+DRIVERS[k].unit+')',values:ps.map(p=>effective(b,s,p.year)[k])}))}/></>}
 {part==='balance'&&<><h3>Independent checks</h3><Table title="Reconciliation / liquidity" heads={heads} rows={[...tests.map(([key,label])=>({label,values:ps.map(p=>Math.abs(p[key])<=p.tol?0:p[key])})),{label:'Assessment',values:ps.map(p=>p.balanced&&p.fundingGap<=p.tol&&p.limitExcess<=p.tol?'Clear':'Review')}]}/><p className="tr-note">Opening balance difference: {n(openingGap(b.opening))}m. Checks use underlying amounts before rounding. A balance sheet can reconcile even when there is a cash shortfall.</p></>}
 {part==='cash'&&<><h3>Financing and investment assumptions</h3><Table title="Driver / unit" heads={heads} rows={DRIVER_KEYS.filter(k=>['Financing','Fixed assets'].includes(DRIVERS[k].group)).map(k=>({label:DRIVERS[k].label+' ('+DRIVERS[k].unit+')',values:ps.map(p=>effective(b,s,p.year)[k])}))}/></>}
 </Paper>) }))}
 </div>;
});
