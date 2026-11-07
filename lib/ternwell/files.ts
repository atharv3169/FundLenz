import {csv, readCsv} from '../atlas/files';
import {LINE_KEYS,isLineValue,BALANCE,CASES,CASHFLOW,CURRENCIES,DRIVERS,DRIVER_KEYS,INCOME,OPENING,OPEN_KEYS,SCHEDULES,example,forecast,type Book,type Currency,type Driver,type Inputs,type OpeningKey,type Period,type ReportRow,type Scenario} from './model';
import {buildWorkbook,type Sheet,type Cell} from './workbook';
const fail=(m:string):never=>{throw new Error(m)};
const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail('Expected a record.');
function keys(v:unknown,allowed:readonly string[],required=true) {
  const x=obj(v);if(Object.keys(x).some(k=>!allowed.includes(k))||(required&&allowed.some(k=>!Object.hasOwn(x,k))))fail('Missing or unrecognised worksheet fields. Use a Ternwell input file.');return x;
}
function finite(v:unknown,min:number,max:number,name:string,integer=false):number{
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))return fail(name+' must be '+(integer?'a whole number ':'a number ')+'between '+min+' and '+max+'.');return v;
}
export function validate(v:unknown):Book{
  const a=keys(v,['schema','name','currency','year','horizon','opening','cases']);
  if(a.schema!=='ternwell/1')fail('Unrecognised Ternwell version.');
  if(typeof a.name!=='string'||!a.name.trim()||a.name.length>100||/[\u0000-\u001f]/.test(a.name))fail('Enter a company name of 1–100 characters.');
  if(!CURRENCIES.includes(a.currency as Currency))fail('Unsupported reporting currency.');
  const b=example();b.name=(a.name as string).trim();b.currency=a.currency as Currency;
  b.year=finite(a.year,1900,2150,'Opening fiscal year',true);b.horizon=finite(a.horizon,1,10,'Forecast horizon',true);
  const o=keys(a.opening,OPEN_KEYS);for(const k of OPEN_KEYS)b.opening[k]=finite(o[k],k==='retained'?-1e9:0,1e9,OPENING[k]);
  const cs=keys(a.cases,CASES);
  for(const s of CASES){
    const c=keys(cs[s],['drivers','overrides','lines'],false);const dv=keys(c.drivers,DRIVER_KEYS);
    for(const k of DRIVER_KEYS){const f=DRIVERS[k];b.cases[s].drivers[k]=finite(dv[k],f.min,f.max,f.label);}
    if(c.lines!==undefined){for(const [y,vs] of Object.entries(obj(c.lines))){
      if(!/^\d{4}$/.test(y)||+y<=b.year||+y>b.year+10)fail('Statement edit outside the ten-year modelling window.');
      for(const [key,value] of Object.entries(keys(vs,LINE_KEYS,false))){if(!isLineValue(value))throw Error('Invalid statement amount for '+key);
        (((b.cases[s].lines??={})[y])??={})[key]=value;}
    }}
    const ov=obj(c.overrides);b.cases[s].overrides={};
    for(const [y,vs] of Object.entries(ov)){
      if(!/^\d{4}$/.test(y)||+y<=b.year||+y>b.year+10)fail('Override year must be within the ten-year modelling window.');
      const row=keys(vs,DRIVER_KEYS,false);const out:Partial<Inputs>={};
      for(const k of DRIVER_KEYS)if(Object.hasOwn(row,k)){const f=DRIVERS[k];out[k]=finite(row[k],f.min,f.max,f.label);}
      if(Object.keys(out).length)b.cases[s].overrides[y]=out;
    }
  }return b;
}
export function inputCsv(b:Book){
  const rows:(string|number)[][]=[['section','case','year','field','value'],['model','','','schema',b.schema],['model','','','name',b.name],['model','','','currency',b.currency],['model','','','year',b.year],['model','','','horizon',b.horizon]];
  for(const k of OPEN_KEYS)rows.push(['opening','','',k,b.opening[k]]);
  for(const s of CASES){for(const k of DRIVER_KEYS)rows.push(['driver',s,'',k,b.cases[s].drivers[k]]);
    for(const [y,line] of Object.entries(b.cases[s].lines??{}))for(const k of LINE_KEYS)if(line[k]!==undefined)rows.push(['statement',s,y,k,line[k]!]);
    for(const [y,ov] of Object.entries(b.cases[s].overrides))for(const k of DRIVER_KEYS)if(ov[k]!==undefined)rows.push(['override',s,y,k,ov[k]!]);}
  return csv(rows);
}
function numberCell(s:string){if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s.trim())||!Number.isFinite(Number(s)))fail('A numeric cell is empty or invalid. Use plain numbers without currency signs.');return Number(s);}
export function importFile(text:string):Book{
  if(text.length>1_000_000)fail('File exceeds the 1 MB input limit.');
  text=text.replace(/^\uFEFF/,'');if(text.trimStart().startsWith('{'))return validate(JSON.parse(text));
  const [header,...records]=readCsv(text);if(!header||header.join(',')!=='section,case,year,field,value')fail('Use the editable Ternwell input CSV, not a statement export.');
  const raw:Record<string,unknown>={};const opening:Partial<Record<OpeningKey,number>>={};
  const cases=Object.fromEntries(CASES.map(s=>[s,{drivers:{} as Partial<Inputs>,overrides:{} as Record<string,Partial<Inputs>>}])) as Book['cases'];
  const seen=new Set<string>();
  for(const row of records){
    if(row.length!==5)fail('Each input row needs exactly five columns.');
    const [kind,cs,y,k,value]=row;const id=JSON.stringify(row.slice(0,4));if(seen.has(id))fail('Duplicate input: '+k);seen.add(id);
    if(kind==='model'&&!cs&&!y&&['schema','name','currency','year','horizon'].includes(k)){
      raw[k]=['year','horizon'].includes(k)?numberCell(value):k==='name'&&/^'(?:['\t\r\n]|\s*[=+\-@])/.test(value)?value.slice(1):value;
    }else if(kind==='opening'&&!cs&&!y&&OPEN_KEYS.includes(k as OpeningKey))opening[k as OpeningKey]=numberCell(value);
    else if(kind==='statement'&&CASES.includes(cs as Scenario)&&/^\d{4}$/.test(y)&&LINE_KEYS.includes(k)){const c=cases[cs as Scenario];((c.lines??={})[y]??={})[k]=numberCell(value);}
    else if((kind==='driver'||kind==='override')&&CASES.includes(cs as Scenario)&&DRIVER_KEYS.includes(k as Driver)){
      const c=cases[cs as Scenario];if(kind==='driver'&&!y)c.drivers[k as Driver]=numberCell(value);
      else if(kind==='override'&&/^\d{4}$/.test(y))(c.overrides[y]??={})[k as Driver]=numberCell(value);
      else fail('Invalid driver/override year.');
    }else fail('Unknown input row: '+kind+' / '+k);
  }
  return validate({...raw,opening,cases});
}
export function shiftYear(b:Book,to:number){const from=b.year;b.year=to;for(const s of CASES){const c=b.cases[s];if(c.lines)c.lines=Object.fromEntries(Object.entries(c.lines).map(([y,v])=>[+y+to-from,v]));c.overrides=Object.fromEntries(Object.entries(b.cases[s].overrides).map(([y,v])=>[+y+to-from,v]));}}
const panels:[string,ReportRow[]][]=[['Income statement',INCOME],['Balance sheet',BALANCE],['Cash flow',CASHFLOW]];
export function statementCsv(b:Book,s:Scenario){
  const p=forecast(b,s), baseline=Object.fromEntries(p.map(x=>[x.year,Object.fromEntries(panels.flatMap(([,rows])=>rows.map(([k])=>[k,x[k]])))]));
  return csv([['Case',s,'Company',b.name,'Currency / units',b.currency+' millions'],['Statement','Line item',...p.map(x=>'FY'+x.year)],...panels.flatMap(([name,rows])=>rows.map(([k,label])=>[name,label,...p.map(x=>x[k])])),['Ternwell baseline','Leave unchanged',JSON.stringify(baseline)]]);
}
export function importStatements(text:string,b:Book,s:Scenario):Book{
  if(text.length>1_000_000)fail('Statement CSV exceeds 1 MB.');
  const [meta,header,...rows]=readCsv(text.replace(/^\uFEFF/,''));
  if(meta?.[0]!=='Case'||meta[1]!==s||meta[2]!=='Company'||meta[4]!=='Currency / units'||meta[5]!==b.currency+' millions')fail('Use the active case and currency in millions shown on the statement template.');
  if(header?.[0]!=='Statement'||header[1]!=='Line item'||header.length<=2)fail('Missing statement header. Use the statement template.');
  const years=header.slice(2).map(y=>/^FY\d{4}$/.test(y)?Number(y.slice(2)):NaN);
  if(new Set(years).size!==years.length||years.some(y=>!Number.isFinite(y)||y<=b.year||y>b.year+b.horizon))fail('Fiscal years must be unique and inside this forecast.');
  const p=forecast(b,s),out=structuredClone(b),seen=new Set<string>(),edits=new Map<string,number>();
  const baselineRow=rows.at(-1)?.[0]==='Ternwell baseline'?rows.pop():undefined;
  const baseline=baselineRow?obj(JSON.parse(baselineRow[2])):undefined;
  for(const row of rows){
    const [group,label,...cells]=row;
    if(cells.length!==years.length)fail('Unexpected column count for '+label);
    const key=panels.find(([name])=>name===group)?.[1].find(([,l])=>l===label)?.[0];
    if(!key)throw Error('Unknown statement line: '+group+' / '+label);
    const id=group+'/'+label;if(seen.has(id))fail('Duplicate statement row: '+id);seen.add(id);
    cells.forEach((cell,i)=>{if(!cell.trim())return;const n=numberCell(cell),year=years[i],ref=baseline?obj(baseline[year])[key]:p[year-b.year-1][key];
      if(typeof ref!=='number'||!Number.isFinite(ref))throw Error('Damaged baseline for '+label);
      if(n===ref||Math.abs(n-ref)<=8*Number.EPSILON*Math.abs(ref))return;
      if(!isLineValue(n))fail('Statement amount outside supported range.');
      const address=year+'/'+key;if(edits.has(address)&&edits.get(address)!==n)fail('Conflicting edits to linked line '+label+' in FY'+year);
      edits.set(address,n);((out.cases[s].lines??={})[year]??={})[key]=n;
    });
  }
  if(!seen.size)fail('Add at least one recognised statement row.');return validate(out);
}
const form=(formula:string,value:number):Cell=>({formula,value});
export function resultsWorkbook(b:Book,s:Scenario){
  const p=forecast(b,s), yrs=p.map(x=>'FY'+x.year), data:Sheet[]=[{name:'Read me',rows:[['FundLenz · Ternwell | Financial model','Workbook guide'],['Company',b.name],['Scenario',s],['Units',b.currency+' millions'],['Opening year',b.year],['Model','Statement schedules are exported results. Totals and inter-statement links are Excel formulas.'],['To edit projections','Change drivers in Ternwell or load the accompanying editable input CSV/JSON.'],['Sign convention','Expenses, investments and dividends are negative.'],['Funding gaps','Negative cash records an unfunded projection; it is not an available balance.']]}];
  for(const [name,rows] of panels){
    data.push({name,rows:[['Line item · '+b.currency+' m',...yrs],...rows.map(([key,label])=>[label,...p.map((v,i):Cell=>{
      const col=String.fromCharCode(66+i), cell=(n:number)=>col+n,ref=(sheet:string,n:number)=>"'"+sheet+"'!"+cell(n);
      const formulas:Record<string,Record<string,string>>={
        'Income statement':{gross:cell(2)+'+'+cell(3),ebitda:cell(4)+'+'+cell(5),ebit:cell(6)+'+'+cell(7),pretax:cell(8)+'+'+cell(9),net:cell(10)+'+'+cell(11)},
        'Balance sheet':{cash:ref('Cash flow',18),assets:'SUM('+cell(2)+':'+cell(6)+')',liabilities:'SUM('+cell(8)+':'+cell(11)+')',equity:cell(13)+'+'+cell(14),liabilitiesEquity:cell(12)+'+'+cell(15),balanceGap:cell(7)+'-'+cell(16)},
        'Cash flow':{net:ref('Income statement',12),depAdd:'-'+ref('Income statement',7),cfo:'SUM('+cell(2)+':'+cell(6)+')',cfi:cell(8),cff:'SUM('+cell(10)+':'+cell(14)+')',movement:cell(7)+'+'+cell(9)+'+'+cell(15),cash:cell(16)+'+'+cell(17)}};
      const fx=formulas[name]?.[key];return fx&&b.cases[s].lines?.[v.year]?.[key]===undefined?form(fx,v[key] as number):v[key];
    })]) ]});
  }
  data.push({name:'Schedules',rows:[['Schedule / line',...yrs],...Object.entries(SCHEDULES).flatMap(([title,rows])=>rows.map(([key,label])=>[title+' / '+label,...p.map(r=>r[key])]))]});
  data.push({name:'Drivers',rows:[['Annual effective driver',...yrs],...DRIVER_KEYS.map(k=>[DRIVERS[k].label+' ('+DRIVERS[k].unit+')',...p.map(r=>b.cases[s].overrides[r.year]?.[k]??b.cases[s].drivers[k])])]});
  data.push({name:'Opening position',rows:[['Opening balances',b.currency+' m'],...OPEN_KEYS.map(k=>[OPENING[k],b.opening[k]])]});
  data.push({name:'Scenario comparison',rows:[['Scenario / metric',...yrs],...CASES.flatMap(cs=>{const values=forecast(b,cs);return (['revenue','net','cash','fundingGap'] as const).map(k=>[cs+' / '+k,...values.map(v=>v[k])])})]});
  data.push({name:'Checks',rows:[['Check · zero is clear',...yrs],...(['actualBalanceGap','statementGap','cashGap','retainedGap','fundingGap','limitExcess'] as const).map(k=>[k,...p.map(v=>v[k])])]});
  return buildWorkbook([...data.slice(1),data[0]]);
}
export function baseName(b:Book){return (b.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'company')+'-ternwell';}
export const endOf=(p:Period[])=>p[p.length-1];
