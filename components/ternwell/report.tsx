import { memo, type ReactNode } from 'react';
import { BALANCE, CASES, CASHFLOW, DRIVERS, DRIVER_KEYS, INCOME, effective, forecast, openingGap, type Book, type Period, type Scenario } from '@/lib/ternwell/model';
import { FinancialFigure } from './charts';
import './report.css';

const amt = new Intl.NumberFormat('en-US', {maximumFractionDigits:2});
const tiny = new Intl.NumberFormat('en-US',{notation:'scientific',maximumFractionDigits:2});
const n=(x:number|null)=>x===null?'—':Math.abs(x)>=1e8 || (x!==0&&Math.abs(x)<.005)?tiny.format(x):amt.format(x);
const range=(ps:Period[])=>ps.length===1?'FY'+ps[0].year:'FY'+ps[0].year+'–'+ps[ps.length-1].year;
const metrics=[['revenue','Revenue'],['ebitda','EBITDA'],['net','Net income'],['cfo','Operating cash flow'],['cash','Closing cash'],['fundingGap','Unfunded cash target']] as const;
const tests=[['actualBalanceGap','Assets less liabilities and equity'],['cashGap','Cash roll-forward difference'],['retainedGap','Equity roll-forward difference'],['statementGap','Largest line reconciliation difference'],['fundingGap','Unfunded cash target'],['limitExcess','Credit limit exceeded']] as const;
const totals=new Set(['gross','ebitda','ebit','net','assets','equity','liabilities','liabilitiesEquity','balanceGap','cfo','cfi','cff','movement','cash']);
type Row={label:string;values:(number|string|null)[];strong?:boolean};
function Table({title,heads,rows}:{title:string;heads:string[];rows:Row[]}){return <table className="tr-table" aria-label={title}><thead><tr><th scope="col">{title}</th>{heads.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.label} className={r.strong?'tr-total':undefined}><th scope="row">{r.label}</th>{r.values.map((x,i)=><td key={i}>{typeof x==='string'?x:n(x)}</td>)}</tr>)}</tbody></table>}
function Paper({b,mark,title,sub,children,part,s,report}:{b:Book;mark:string;title:string;sub:string;children:ReactNode;part?:string;s?:Scenario;report?:string}){
return <article className="tr-paper" data-case={s} data-statement={part} data-report={report}><header className="tr-letter"><b>Fund<span>Lenz</span></b><span>TERNWELL &nbsp; / &nbsp; FINANCIAL MODELLING</span></header><div className="tr-heading"><small>{mark}</small><h2>{title}</h2><p>{sub}</p></div>{children}<footer className="tr-footer"><strong>fundlenz.com/ternwell</strong><span>{b.name} · {b.currency} millions</span></footer></article>
}
export const CaseReport=memo(function CaseReport({b}:{b:Book}){
 const sets={Base:forecast(b,'Base'),Upside:forecast(b,'Upside'),Downside:forecast(b,'Downside')};
 const chunks=Array.from({length:Math.ceil(b.horizon/5)},(_,i)=>i*5);
 const end=sets.Base.at(-1)!,unit=b.currency+' m',years=sets.Base.map(p=>p.year);
 const watch=CASES.flatMap(s=>sets[s].map(p=>({s,p}))).filter(({p})=>p.fundingGap>p.tol||p.limitExcess>p.tol||!p.balanced);
 const scenarioChart=(metric:'cash'|'net'|'revenue',title:string,start=0,count=b.horizon)=><FinancialFigure title={title} unit={unit} years={years.slice(start,start+count)} bars={count===1} series={CASES.map(s=>({label:s,values:sets[s].slice(start,start+count).map(p=>p[metric])}))}/>;
 return <div className="tw-print tw-case-report" aria-label="Ternwell financial report">
 <Paper b={b} report="overview" mark={'01 / EXECUTIVE OVERVIEW   ·   '+range(sets.Base)} title={b.name} sub={'Three-statement forecast · '+b.currency+' millions · opening FY'+b.year}>
 <div className="tr-kpis">{([['Revenue',end.revenue],['Net income',end.net],['Closing cash',end.cash]] as const).map(([label,value])=><div className="tr-kpi" key={label}><small>BASE · FY{end.year}</small><strong>{n(value)}</strong><span>{label} · {unit}</span></div>)}</div>
 <div className="tr-hero-charts">{scenarioChart('net','01   Earnings trajectory')}{scenarioChart('cash','02   Liquidity trajectory')}</div>
 <h3>Where the cases finish</h3><Table title={'FY'+end.year+' · '+unit} heads={['Revenue','EBITDA','Net income','Closing cash']} rows={CASES.map(s=>{const e=sets[s].at(-1)!;return {label:s,values:[e.revenue,e.ebitda,e.net,e.cash]};})}/>
 <div className="tr-insight"><strong>Funding &amp; reconciliation</strong><p>{watch.length?watch.length+' case-period'+(watch.length===1?'':'s')+' require review. First flagged year: FY'+Math.min(...watch.map(({p})=>p.year))+'. See the independent checks on each balance sheet.':'All three cases meet the cash target and credit limit and reconcile throughout the forecast.'}</p></div>
 <p className="tr-note">Reading order: scenario comparisons, then the income statement, balance sheet and cash flows for each case. Expenses and cash outflows are shown as negative amounts.</p></Paper>
 {chunks.map(start=>{const ps=sets.Base.slice(start,start+5);const heads=ps.map(p=>'FY'+p.year);
 return <Paper key={start} b={b} report="comparison" mark={'02 / SCENARIO COMPARISON   ·   '+range(ps)} title="Scenario comparison" sub={b.name+' · '+b.currency+' millions · opening FY'+b.year}>
 {scenarioChart('revenue','Revenue by scenario',start,ps.length)}
 <Table title="Annual comparisons" heads={heads} rows={metrics.flatMap(([key,label])=>CASES.map((s,i)=>({label:label+' · '+(i?s+' Δ vs Base':'Base'),strong:!i,values:ps.map((p,j)=>i?sets[s][start+j][key]-p[key]:p[key])})))}/>
 <p className="tr-note">Δ is the case amount less Base in the same fiscal year. A positive funding gap is cash still required after available financing. Absolute amounts for each case follow.</p></Paper>})}
 {CASES.flatMap(s=>chunks.flatMap(start=>{const ps=sets[s].slice(start,start+5),heads=ps.map(p=>'FY'+p.year),mark=s.toUpperCase()+' CASE  /  '+range(ps),sub=b.name+' · '+b.currency+' millions · expenses and outflows are negative.';
 return ([['income','Income statement',INCOME],['balance','Balance sheet',BALANCE],['cash','Cash-flow statement',CASHFLOW]] as const).map(([part,label,rows])=><Paper key={s+start+part} b={b} s={s} part={part} mark={mark} title={s==='Base'&&start===0?label:s+' · '+label} sub={sub}>
 <FinancialFigure title={part==='income'?'Revenue, operating profit and net income':part==='balance'?'Cash against outstanding debt':'Sources and uses of cash'} unit={unit} years={ps.map(p=>p.year)} bars series={(part==='income'?[['revenue','Revenue'],['ebit','Operating profit'],['net','Net income']] as const:part==='balance'?[['cash','Closing cash'],['debt','Term debt'],['revolver','Revolver']] as const:[['cfo','Operating'],['cfi','Investing'],['cff','Financing']] as const).map(([key,label])=>({label,values:ps.map(p=>p[key])}))}/>
 <Table title="Line item" heads={heads} rows={rows.map(([key,label])=>({label,strong:totals.has(key),values:ps.map(p=>p[key])}))}/>
 {part==='income'&&<><h3>Operating assumptions</h3><Table title="Driver / unit" heads={heads} rows={DRIVER_KEYS.filter(k=>['Operations','Working capital','Tax & distributions'].includes(DRIVERS[k].group)).map(k=>({label:DRIVERS[k].label+' ('+DRIVERS[k].unit+')',values:ps.map(p=>effective(b,s,p.year)[k])}))}/></>}
 {part==='balance'&&<><h3>Independent checks</h3><Table title="Reconciliation / liquidity" heads={heads} rows={[...tests.map(([key,label])=>({label,values:ps.map(p=>Math.abs(p[key])<=p.tol?0:p[key])})),{label:'Assessment',values:ps.map(p=>p.balanced&&p.fundingGap<=p.tol&&p.limitExcess<=p.tol?'Clear':'Review')}]}/><p className="tr-note">Opening balance difference: {n(openingGap(b.opening))}m. Checks use underlying amounts before rounding. A balance sheet can reconcile even when there is a cash shortfall.</p></>}
 {part==='cash'&&<><h3>Financing and investment assumptions</h3><Table title="Driver / unit" heads={heads} rows={DRIVER_KEYS.filter(k=>['Financing','Fixed assets'].includes(DRIVERS[k].group)).map(k=>({label:DRIVERS[k].label+' ('+DRIVERS[k].unit+')',values:ps.map(p=>effective(b,s,p.year)[k])}))}/></>}
 </Paper>) }))}
 </div>;
});
