/** Annual management forecasts, in millions of the selected reporting currency.
 * Costs and cash outflows in the projected statements are signed. Inputs use positive rates/amounts. */
export const CASES = ['Base', 'Upside', 'Downside'] as const;
export type Scenario = typeof CASES[number];
export const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD'] as const;
export type Currency = typeof CURRENCIES[number];
type Spec = { label: string; unit: string; min: number; max: number; group: string; note: string };
const f = (label: string, unit: string, min: number, max: number, group: string, note: string): Spec => ({label, unit, min, max, group, note});
export const DRIVERS = {
  growth: f('Revenue growth','%',-100,200,'Operations','Applied to the preceding year’s revenue.'),
  margin: f('Gross margin','%',-100,100,'Operations','Gross profit as a percentage of revenue.'),
  opex: f('Cash operating expenses','% of sales',0,300,'Operations','Cash operating costs before depreciation and interest.'),
  dso: f('Collection days','days',0,730,'Working capital','Receivables = revenue × days ÷ 365.'),
  dio: f('Inventory days','days',0,730,'Working capital','Inventory = cost of sales × days ÷ 365.'),
  dpo: f('Supplier payment days','days',0,730,'Working capital','Payables = cost of sales × days ÷ 365.'),
  capex: f('Capital expenditure','% of sales',0,200,'Fixed assets','Cash investment in property, plant and equipment.'),
  dep: f('Depreciation rate','% of opening PP&E',0,100,'Fixed assets','Straight-line assumption on opening net PP&E; new capex starts depreciating next year.'),
  interest: f('Term debt interest','%',0,100,'Financing','Applied to opening term debt, avoiding a circular cash calculation.'),
  revolverRate: f('Revolver interest','%',0,100,'Financing','Applied to opening facility drawings.'),
  newDebt: f('New term borrowing','m',0,1e9,'Financing','Annual new term debt, before scheduled repayments.'),
  repay: f('Term debt repayment','m',0,1e9,'Financing','Limited to opening debt plus new term borrowing.'),
  newEquity: f('Equity raised','m',0,1e9,'Financing','Cash proceeds increase contributed capital.'),
  floor: f('Minimum cash target','m',0,1e9,'Financing','The revolver draws or repays to target this closing cash level.'),
  limit: f('Revolver facility limit','m',0,1e9,'Financing','Maximum outstanding revolving credit, not a new allowance each year.'),
  tax: f('Cash tax rate','%',0,100,'Tax & distributions','Paid on positive pretax profit. No tax refunds, deferred tax or loss carryforwards.'),
  payout: f('Dividend payout','% of profit',0,100,'Tax & distributions','Applied to positive net income only.')
} as const;
export type Driver = keyof typeof DRIVERS;
export const DRIVER_KEYS = Object.keys(DRIVERS) as Driver[];
export const OPENING = {
  revenue:'Last annual revenue', cash:'Cash and equivalents', ar:'Trade receivables', inv:'Inventory', ppe:'Net PP&E',
  otherAssets:'Other non-current assets', ap:'Trade payables', otherLiab:'Other non-current liabilities',
  debt:'Term debt', revolver:'Revolver drawn', capital:'Contributed capital', retained:'Retained earnings'
} as const;
export type OpeningKey = keyof typeof OPENING;
export const OPEN_KEYS = Object.keys(OPENING) as OpeningKey[];
export type Inputs = Record<Driver, number>;
export type Opening = Record<OpeningKey, number>;
export type Overrides = Record<string, Partial<Inputs>>;
export type Book = {schema:'ternwell/1'; name:string; currency:Currency; year:number; horizon:number; opening:Opening;
  cases: Record<Scenario,{drivers:Inputs; overrides:Overrides}> };
export const initialDrivers:Inputs = {growth:8, margin:43, opex:23, dso:48, dio:65, dpo:44, capex:6, dep:11, interest:6.5, revolverRate:8, newDebt:0, repay:7, newEquity:0, floor:16, limit:50, tax:24, payout:22};
export function example():Book {
  const base={...initialDrivers};
  return {schema:'ternwell/1',name:'Alderwick Industrial',currency:'USD',year:2025,horizon:5,
    opening:{revenue:365,cash:32,ar:44,inv:36,ppe:155,otherAssets:13,ap:30,otherLiab:12,debt:68,revolver:0,capital:100,retained:70},
    cases:{Base:{drivers:base,overrides:{}},Upside:{drivers:{...base,growth:12,margin:46,dso:42},overrides:{}},
      Downside:{drivers:{...base,growth:-3,margin:36,opex:27,dso:64,dio:80},overrides:{}}}};
}
export function emptyBook():Book {
  const b=example();b.name='Untitled company';b.opening=Object.fromEntries(OPEN_KEYS.map(k=>[k,0])) as Opening;
  for(const s of CASES)b.cases[s]={drivers:Object.fromEntries(DRIVER_KEYS.map(k=>[k,0])) as Inputs,overrides:{}};
  return b;
}
export function openingGap(o:Opening) {return o.cash+o.ar+o.inv+o.ppe+o.otherAssets-o.ap-o.otherLiab-o.debt-o.revolver-o.capital-o.retained;}
export const ratio=(a:number,b:number)=>b>0?a/b:null;
export function effective(b:Book,scenario:Scenario,year:number):Inputs {
  return {...b.cases[scenario].drivers,...b.cases[scenario].overrides[String(year)]};
}
function period(p:Opening,d:Inputs,year:number) {
  const revenue=p.revenue*(1+d.growth/100), cogs=-revenue*(1-d.margin/100), gross=revenue+cogs;
  const opex=-revenue*d.opex/100, ebitda=gross+opex;
  const da=-p.ppe*d.dep/100, ebit=ebitda+da;
  const interest=-(p.debt*d.interest+p.revolver*d.revolverRate)/100, pretax=ebit+interest;
  const tax=-Math.max(0,pretax)*d.tax/100, net=pretax+tax;
  const ar=revenue*d.dso/365, inv=-cogs*d.dio/365, ap=-cogs*d.dpo/365;
  const arCash=p.ar-ar, invCash=p.inv-inv, apCash=ap-p.ap, wcCash=arCash+invCash+apCash;
  const depAdd=-da, cfo=net+depAdd+wcCash, capex=-revenue*d.capex/100, cfi=capex, fcf=cfo+cfi;
  const borrow=d.newDebt, debtPay=-Math.min(d.repay,p.debt+borrow), debt=p.debt+borrow+debtPay;
  const dividends=-Math.max(0,net)*d.payout/100, equityRaise=d.newEquity;
  const beforeLine=p.cash+cfo+cfi+borrow+debtPay+dividends+equityRaise;
  // An exhausted line cannot manufacture cash. Negative cash is a diagnostic funding deficit.
  const draw=Math.min(Math.max(0,d.floor-beforeLine),Math.max(0,d.limit-p.revolver));
  const sweep=-Math.min(p.revolver,Math.max(0,beforeLine-d.floor));
  const lineFlow=draw+sweep, revolver=p.revolver+lineFlow;
  const cff=borrow+debtPay+lineFlow+equityRaise+dividends, movement=cfo+cfi+cff, cash=p.cash+movement;
  const ppe=p.ppe-capex+da, capital=p.capital+equityRaise, retained=p.retained+net+dividends;
  const assets=cash+ar+inv+ppe+p.otherAssets, liabilities=ap+p.otherLiab+debt+revolver;
  const equity=capital+retained, liabilitiesEquity=liabilities+equity;
  const totalDebt=debt+revolver, netDebt=totalDebt-cash, workingCapital=ar+inv-ap;
  const balanceGap=assets-liabilitiesEquity, cashGap=cash-beforeLine-lineFlow;
  const retainedGap=equity-(p.capital+p.retained+net+equityRaise+dividends);
  const fundingGap=Math.max(0,d.floor-cash), limitExcess=Math.max(0,revolver-d.limit), headroom=Math.max(0,d.limit-revolver);
  const tol=1e-8+1e-12*Math.max(Math.abs(assets),Math.abs(liabilitiesEquity),Math.abs(cfo),Math.abs(cff),1);
  const balanced=Math.abs(balanceGap)<=tol && Math.abs(cashGap)<=tol && Math.abs(retainedGap)<=tol;
  const cashCycle=(revenue>0&&-cogs>0)?d.dso+d.dio-d.dpo:null;
  return {year,revenue,cogs,gross,opex,ebitda,da,ebit,interest,pretax,tax,net,ar,inv,ap,arCash,invCash,apCash,wcCash,depAdd,cfo,capex,cfi,fcf,borrow,debtPay,dividends,equityRaise,draw,sweep,lineFlow,cff,movement,cash,openingCash:p.cash,ppe,capital,retained,assets,liabilities,equity,liabilitiesEquity,totalDebt,netDebt,workingCapital,debt,revolver,otherAssets:p.otherAssets,otherLiab:p.otherLiab,openingPpe:p.ppe,openingDebt:p.debt,openingLine:p.revolver,openingRetained:p.retained,cashFloor:d.floor,facilityLimit:d.limit,balanceGap,cashGap,retainedGap,fundingGap,limitExcess,headroom,tol,balanced,cashCycle,
    ebitdaMargin:ratio(ebitda*100,revenue),netMargin:ratio(net*100,revenue),interestCover:ratio(ebit,-interest),debtMultiple:ratio(totalDebt,ebitda)};
}
export type Period=ReturnType<typeof period>;
export function forecast(b:Book,s:Scenario,shock:Partial<Inputs>={}):Period[]{
  const result:Period[]=[];let p=b.opening;
  for(let i=1;i<=b.horizon;i++){
    const year=b.year+i,d=effective(b,s,year);
    for(const key of DRIVER_KEYS){if(shock[key]!==undefined)d[key]=Math.min(DRIVERS[key].max,Math.max(DRIVERS[key].min,d[key]+shock[key]!));}
    const r=period(p,d,year); result.push(r);p=r;
  }return result;
}
export type RowKey = Exclude<keyof Period,'balanced'|'tol'|'year'>;
export type ReportRow = readonly [RowKey, string, string];
export const INCOME:ReportRow[]=[
  ['revenue','Revenue','Prior-year revenue × (1 + revenue growth).'],['cogs','Cost of sales','Revenue × (1 − gross margin), shown as an expense.'],
  ['gross','Gross profit','Revenue + signed cost of sales.'],['opex','Cash operating expenses','Revenue × cash operating expense ratio, shown as an expense.'],
  ['ebitda','EBITDA','Gross profit + signed cash operating expenses.'],['da','Depreciation','Opening net PP&E × depreciation rate, shown as an expense.'],
  ['ebit','Operating profit (EBIT)','EBITDA + signed depreciation.'],['interest','Interest expense','Opening term debt and revolver multiplied by their respective interest rates.'],
  ['pretax','Profit before tax','Operating profit + signed interest.'],['tax','Income tax','Positive profit before tax × the cash tax rate; no tax benefit on losses.'],['net','Net income','Profit before tax + signed income tax.']];
export const BALANCE:ReportRow[]=[
  ['cash','Cash and equivalents','Opening cash + operating + investing + financing cash flow. A negative result indicates missing funding.'],['ar','Trade receivables','Revenue × collection days ÷ 365.'],['inv','Inventory','Cost of sales × inventory days ÷ 365.'],['ppe','Net PP&E','Opening PP&E + capital expenditure − depreciation.'],['otherAssets','Other non-current assets','Carried at the entered opening balance.'],['assets','Total assets','Cash + receivables + inventory + PP&E + other assets.'],['ap','Trade payables','Cost of sales × payment days ÷ 365.'],['debt','Term debt','Opening term debt + borrowing − principal repayments.'],['revolver','Revolving credit drawn','Opening drawings + new draw − sweep.'],['otherLiab','Other non-current liabilities','Carried at the entered opening balance.'],['liabilities','Total liabilities','Payables + term debt + revolving credit + other liabilities.'],['capital','Contributed capital','Opening contributed capital + new equity raised.'],['retained','Retained earnings','Opening retained earnings + net income − dividends.'],['equity','Total equity','Contributed capital + retained earnings.'],['liabilitiesEquity','Liabilities + equity','Total liabilities + total equity.'],['balanceGap','Balance difference','Total assets − liabilities − equity. There is no balancing plug.']];
export const CASHFLOW:ReportRow[]=[
  ['net','Net income','From the income statement.'],['depAdd','Depreciation add-back','Reverses noncash depreciation.'],['arCash','Change in receivables','Opening receivables minus closing receivables.'],['invCash','Change in inventory','Opening inventory minus closing inventory.'],['apCash','Change in payables','Closing payables minus opening payables.'],['cfo','Cash from operations','Net income + depreciation + changes in operating working capital.'],['capex','Capital expenditure','Cash spent on PP&E; shown as a negative cash flow.'],['cfi','Cash from investing','Capital expenditure; no acquisitions or disposals assumed.'],['borrow','New term borrowing','Assumed new term borrowing.'],['debtPay','Term debt repayments','Principal repaid, capped at available term debt.'],['lineFlow','Net revolver movement','New drawings minus surplus-cash repayments.'],['equityRaise','Equity proceeds','Cash raised from shareholders.'],['dividends','Dividends paid','Positive net income × the payout ratio; shown as an outflow.'],['cff','Cash from financing','Net debt movements + equity raised − dividends.'],['movement','Net change in cash','Operating + investing + financing cash flow.'],['openingCash','Opening cash','Prior-year closing cash (or opening position in year one).'],['cash','Closing cash','Opening cash + net change in cash.']];
export const SCHEDULES:Record<string,ReportRow[]>={
  'Working capital':[['ar','Receivables','Driven by collection days.'],['inv','Inventory','Driven by inventory days.'],['ap','Payables','Driven by payment days.'],['workingCapital','Net operating working capital','Receivables + inventory − payables.'],['wcCash','Cash released / (absorbed)','Negative of the change in net operating working capital.']],
  'Fixed assets':[['openingPpe','Opening net PP&E','Last year’s closing net PP&E.'],['capex','Cash capex','Outflow to buy fixed assets.'],['da','Depreciation expense','Opening net PP&E × depreciation rate.'],['ppe','Closing net PP&E','Opening PP&E − signed cash capex + signed depreciation.']],
  'Debt & liquidity':[['openingDebt','Opening term debt','Last year’s term debt.'],['borrow','Term debt issued','New financing.'],['debtPay','Term debt repaid','Principal cash outflow.'],['debt','Closing term debt','Opening debt plus net issuance.'],['openingLine','Opening revolver','Drawings entering the year.'],['draw','New revolver draw','Draw up to the remaining facility.'],['sweep','Revolver repayment','Use cash above the minimum target, up to outstanding drawings.'],['revolver','Closing revolver','Opening revolver + draw + signed repayment.'],['headroom','Undrawn facility','Non-negative remaining capacity.'],['fundingGap','Funding gap to cash target','Unfunded amount after available facility.']],
  'Equity':[['openingRetained','Opening retained earnings','Last year’s accumulated earnings.'],['net','Net income','From the income statement.'],['dividends','Dividends paid','Distribution to shareholders.'],['retained','Closing retained earnings','Opening retained earnings + net income + signed dividends.'],['capital','Contributed capital','Opening paid-in capital plus new equity.'],['equity','Total equity','Contributed capital + retained earnings.']]
};
export const REPORTS={Income:INCOME,Balance:BALANCE,'Cash flow':CASHFLOW};
export const fmt=(n:number|null, digits=1)=>n===null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:digits,minimumFractionDigits:0}).format(Math.abs(n)<1e-8?0:n);
