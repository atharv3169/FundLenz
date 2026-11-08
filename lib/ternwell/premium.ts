import {CASES,DRIVER_KEYS,DRIVERS,OPEN_KEYS,OPENING,REPORTS,forecast,effective,type Book,type Period,type Scenario,type OpeningKey,type Driver} from './model';
import {buildWorkbook,type Cell,type Sheet,type Chart} from './workbook';

// Dollar names reference annual drivers, @ names reference opening balances;
// ordinary names are other rows in the same forecast column.
const definitions:Record<string,string>={
 revenue:'@revenue*(1+$growth/100)',cogs:'-revenue*(1-$margin/100)',gross:'revenue+cogs',opex:'-revenue*$opex/100',ebitda:'gross+opex',da:'-@ppe*$dep/100',ebit:'ebitda+da',interest:'-(@debt*$interest+@revolver*$revolverRate)/100',pretax:'ebit+interest',tax:'-MAX(0,pretax)*$tax/100',net:'pretax+tax',
 ar:'revenue*$dso/365',inv:'-cogs*$dio/365',ap:'-cogs*$dpo/365',arCash:'@ar-ar',invCash:'@inv-inv',apCash:'ap-@ap',depAdd:'-da',cfo:'net+depAdd+arCash+invCash+apCash',capex:'-revenue*$capex/100',cfi:'capex',borrow:'$newDebt',debtPay:'-MIN($repay,@debt+borrow)',debt:'@debt+borrow+debtPay',dividends:'-MAX(0,net)*$payout/100',equityRaise:'$newEquity',openingCash:'@cash',
 beforeLine:'openingCash+cfo+cfi+borrow+debtPay+dividends+equityRaise',lineFlow:'MIN(MAX(0,$floor-beforeLine),MAX(0,$limit-@revolver))-MIN(@revolver,MAX(0,beforeLine-$floor))',revolver:'@revolver+lineFlow',cff:'borrow+debtPay+lineFlow+equityRaise+dividends',movement:'cfo+cfi+cff',cash:'openingCash+movement',ppe:'@ppe-capex+da',otherAssets:'@otherAssets',otherLiab:'@otherLiab',capital:'@capital+equityRaise',retained:'@retained+net+dividends',assets:'cash+ar+inv+ppe+otherAssets',liabilities:'ap+otherLiab+debt+revolver',equity:'capital+retained',liabilitiesEquity:'liabilities+equity',balanceGap:'assets-liabilitiesEquity',fundingGap:'MAX(0,$floor-cash)',headroom:'MAX(0,$limit-revolver)',limitExcess:'MAX(0,revolver-$limit)',actualBalanceGap:'assets-liabilitiesEquity',cashGap:'cash-beforeLine-lineFlow',retainedGap:'equity-(@capital+@retained+net+equityRaise+dividends)'};
// An overwritten subtotal must not conceal the broken identity in Excel.
const identityKeys='openingCash gross ebitda ebit pretax net arCash invCash apCash depAdd cfo cfi debt revolver cff movement cash ppe capital retained assets liabilities equity liabilitiesEquity balanceGap'.split(' ');
definitions.statementGap='MAX('+identityKeys.map(k=>'ABS('+k+'-('+definitions[k]+'))').join(',')+')';
const labels:Record<string,string>={...Object.fromEntries(Object.values(REPORTS).flat().map(([k,n])=>[k,n])),beforeLine:'Cash before revolver',fundingGap:'Unfunded cash target',headroom:'Available credit',limitExcess:'Credit limit excess',actualBalanceGap:'Independent balance difference',statementGap:'Largest statement identity error',cashGap:'Cash reconciliation',retainedGap:'Equity reconciliation'};
const metrics=['revenue','net','cfo','cash','fundingGap'] as const;
export function premiumWorkbook(b:Book):Uint8Array{
 const years=Array.from({length:b.horizon},(_,i)=>'FY'+(b.year+i+1));const heads=(title:string):Cell[]=>[title,...years];const col=(i:number)=>String.fromCharCode(66+i);
 const rows:Cell[][]=[heads('FundLenz  /  TERNWELL'),[b.name,b.currency+' millions'],['Annual model book','Three cases · signed cash flows'],['How to edit','Open Opening or a case Inputs tab. Edit annual values; statements and charts recalculate.'],['Statement edits','Case calculation tabs include manual statement values as editable numbers. Linked formulas are green.']];
 const dashboard:Sheet={name:'Dashboard',rows,charts:[]};const opening:Sheet={name:'Opening',rows:[['FundLenz  /  Opening position',b.currency+' millions'],...OPEN_KEYS.map(k=>[OPENING[k],b.opening[k]])]};const sheets=[dashboard,opening];const projected=new Map<Scenario,Period[]>();const keys=Object.keys(definitions);const pos=(k:string)=>{const i=keys.indexOf(k);if(i<0)throw Error('Unknown workbook row '+k);return i+2;};
 for(const cs of CASES){const periods=forecast(b,cs);projected.set(cs,periods);const input=cs+' Inputs',calc=cs+' Model';
  sheets.push({name:input,rows:[heads('FundLenz  /  '+cs+' · annual inputs'),...DRIVER_KEYS.map(k=>[DRIVERS[k].label+' · '+DRIVERS[k].unit,...periods.map(p=>effective(b,cs,p.year)[k])])]});
  const calcRows:Cell[][]=[heads('FundLenz  /  '+cs+' · calculation ledger')];
  const overrides=(b.cases[cs] as {lines?:Record<string,Partial<Record<string,number>>>}).lines;
  for(const k of keys){calcRows.push([labels[k]||k,...periods.map((p,i):Cell=>{
   const value=k==='actualBalanceGap'?p.assets-p.liabilitiesEquity:k==='beforeLine'?p.openingCash+p.cfo+p.cfi+p.borrow+p.debtPay+p.dividends+p.equityRaise:Number(p[k as keyof Period]);
   if(overrides?.[p.year]?.[k]!==undefined)return value;
   const formula=definitions[k].replace(/([@$]?)([a-z][a-zA-Z]*)/g,(_,prefix:string,name:string)=>{if(prefix==='$')return "'"+input+"'!"+col(i)+(2+DRIVER_KEYS.indexOf(name as Driver));if(prefix==='@')return i?col(i-1)+pos(name):"'Opening'!$B$"+(2+OPEN_KEYS.indexOf(name as OpeningKey));return col(i)+pos(name);});return {formula,value};
  })]);}
  sheets.push({name:calc,rows:calcRows});
  const statementRows:Cell[][]=[heads('FundLenz  /  '+cs+' · statements')];for(const [section,list] of Object.entries(REPORTS)){statementRows.push([section.toUpperCase()]);for(const [k,title] of list){statementRows.push([title,...periods.map((p,i)=>({formula:"'"+calc+"'!"+col(i)+pos(k),value:Number(p[k])}))]);}}sheets.push({name:cs+' Statements',rows:statementRows});
 }
 for(const k of metrics){rows.push([labels[k].toUpperCase()]);const firstRow=rows.length+1,series:Chart['series']=[];for(const cs of CASES){const values=projected.get(cs)!.map(p=>p[k]);rows.push([cs,...values.map((value,i)=>({formula:"'"+cs+" Model'!"+col(i)+pos(k),value}))]);series.push({label:cs,values});}for(const [j,cs] of (['Upside','Downside'] as const).entries())rows.push([cs+' − Base',...series[0].values.map((v,i)=>({formula:col(i)+(firstRow+j+1)+'-'+col(i)+firstRow,value:series[j+1].values[i]-v}))]);dashboard.charts!.push({title:labels[k]+' · '+b.currency+' m',firstRow,years,series});}
 return buildWorkbook(sheets);
}
