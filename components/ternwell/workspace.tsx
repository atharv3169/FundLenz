'use client';
import {useEffect,useReducer,useRef,useState} from 'react';
import {Activity, ArrowLeft, ArrowRight, BookOpen, CalendarDays, ChartNoAxesCombined, CircleAlert, Download, FileSpreadsheet, FolderOpen, GitBranch, History, Layers3, Plus, Printer, Redo2, Save, Settings2, SlidersHorizontal, Undo2, Upload} from 'lucide-react';
import {CASES, REPORTS, emptyBook, example, fmt, forecast, openingGap, type Book, type Driver, type ReportRow, type Scenario} from '@/lib/ternwell/model';
import {baseName, importFile, inputCsv, resultsWorkbook, statementCsv, validate} from '@/lib/ternwell/files';
import {download} from '@/lib/atlas/files';
import {Drivers, HealthPanel, Overview, Scenarios, Schedules, Statements, type Tab} from './panels';
import {Dialog, GridTable, PALETTE, Section} from './ui';
import {TernwellChart, TernwellMark} from './visual';
import {Setup} from './setup';
const TABS:Tab[]=['Overview','Statements','Drivers','Schedules','Scenarios','Checks & files'];
const icons=[Activity,BookOpen,SlidersHorizontal,Layers3,GitBranch,FolderOpen];
const DRAFT='fundlenz.ternwell.v1.draft',VAULT='fundlenz.ternwell.v1.versions';
type Timeline={now:Book;past:Book[];future:Book[]};
type Action={t:'edit'|'restore';b:Book}|{t:'undo'|'redo'};
function history(x:Timeline,a:Action):Timeline{
 if(a.t==='restore')return {now:a.b,past:[],future:[]};
 if(a.t==='edit')return {now:a.b,past:[...x.past.slice(-29),x.now],future:[]};
 if(a.t==='undo'&&x.past.length)return {now:x.past[x.past.length-1],past:x.past.slice(0,-1),future:[x.now,...x.future]};
 if(a.t==='redo'&&x.future.length)return {now:x.future[0],past:[...x.past,x.now],future:x.future.slice(1)};
 return x;
}
type Version={id:string;at:string;b:Book};
type Modal='company'|'new'|'import'|'version'|'method'|null;
type ExportType='input'|'json'|'statements'|'xlsx'|'template';
function Folios(){return <svg className="tw-folios" viewBox="0 0 460 160" aria-hidden="true" focusable="false">
 <defs><pattern id="tw-rules" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M14 0H0V14" fill="none" stroke="#b797aa" strokeOpacity=".26" strokeWidth=".7"/></pattern></defs>
 <g transform="translate(32 10)"><path d="M35 104 173 29 383 60 246 139Z" fill="#463547" stroke="#a77b78"/><path d="M35 91 173 16 383 47 246 126Z" fill="#4c334c" stroke="#b98b87"/><path d="M35 78 173 3 383 34 246 113Z" fill="#614661" stroke="#dcbaa6"/><path d="M35 78 173 3 383 34 246 113Z" fill="url(#tw-rules)"/>
 {[0,1,2,3,4,5].map(i=><path key={i} d={'M'+(87+i*13)+' '+(71-i*7)+'l124 19'} stroke="#ddd0af" strokeOpacity=".6" fill="none"/>)}<path d="m203 59 23-8 13 5 24-13 17 3 31-18" fill="none" stroke="#e8c39d" strokeWidth="2"/><g fill="#dfc3a8">{[[203,59],[226,51],[239,56],[263,43],[280,46],[311,28]].map(([x,y])=><circle key={x} cx={x} cy={y} r="2.1"/>)}</g></g></svg>}
export function TernwellWorkspace(){
 const [state,dispatch]=useReducer(history,undefined,()=>({now:example(),past:[],future:[]})),b=state.now;
 const [s,caseTo]=useState<Scenario>('Base'),[view,go]=useState<Tab>('Overview'),[pos,select]=useState(0),[ready,setReady]=useState(false);
 const [storage,setStorage]=useState('Opening local desk…'),[modal,open]=useState<Modal>(null),[trace,setTrace]=useState<ReportRow|null>(null);
 const [message,say]=useState(''),[err,setErr]=useState(''),[pending,setPending]=useState<{book:Book;name:string}|null>(null),[versions,setVersions]=useState<Version[]>([]);
 const picker=useRef<HTMLInputElement>(null),token=useRef(0),lock=useRef(false);
 useEffect(()=>{let mounted=true;queueMicrotask(()=>{if(!mounted)return;try{
   const raw=window.localStorage.getItem(DRAFT);if(raw)dispatch({t:'restore',b:validate(JSON.parse(raw))});setStorage('Saved on this device');
 }catch{lock.current=true;setStorage('Stored draft unavailable · export a backup');}
 try{const a=JSON.parse(localStorage.getItem(VAULT)||'[]');if(Array.isArray(a)&&a.length<=12)setVersions(a.map(v=>{if(typeof v.id!=='string'||typeof v.at!=='string'||!Number.isFinite(Date.parse(v.at)))throw Error();return {id:v.id,at:v.at,b:validate(v.b)}}));}catch{/* A damaged snapshot does not prevent opening the main model. */}
 setReady(true);});return()=>{mounted=false;};},[]);
 useEffect(()=>{if(!ready||lock.current)return;let alive=true;try{localStorage.setItem(DRAFT,JSON.stringify(b));queueMicrotask(()=>{if(alive)setStorage('Saved on this device');});}catch{queueMicrotask(()=>{if(alive)setStorage('Local storage unavailable · export a backup');});}return()=>{alive=false;};},[b,ready]);
 useEffect(()=>{if(!message)return;const id=setTimeout(()=>say(''),4400);return()=>clearTimeout(id);},[message]);
 const periods=forecast(b,s),index=Math.min(pos,periods.length-1),r=periods[index];
 const next=(book:Book)=>{lock.current=false;dispatch({t:'edit',b:book});};
 const close=()=>{token.current++;open(null);setErr('');setPending(null);};
 const show=(m:Modal)=>{token.current++;setPending(null);setErr('');open(m);};
 const edit=(k:Driver,v:number|undefined,y?:number)=>{const copy=structuredClone(b),c=copy.cases[s];if(y!==undefined){const row=c.overrides[y]??{};if(v===undefined)delete row[k];else row[k]=v;if(Object.keys(row).length)c.overrides[y]=row;else delete c.overrides[y];}else if(v!==undefined)c.drivers[k]=v;next(copy);};
 async function readFile(f:File|undefined){if(!f)return;const n=++token.current;setErr('');setPending(null);try{if(f.size>1_000_000)throw Error('Choose a CSV or JSON under 1 MB.');const book=importFile(await f.text());if(n===token.current)setPending({book,name:f.name});}catch(e){if(n===token.current)setErr((e as Error).message);}}
 const exp=(type:ExportType)=>{try{const file=baseName(b);
   if(type==='xlsx'){const bytes=resultsWorkbook(b,s);download(file+'-'+s.toLowerCase()+'.xlsx',new Blob([new Uint8Array(bytes).buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));}
   else if(type==='json')download(file+'.json',JSON.stringify(b,null,2),'application/json');
   else if(type==='statements')download(file+'-'+s.toLowerCase()+'-statements.csv',statementCsv(b,s),'text/csv');
   else if(type==='template')download('ternwell-input-template.csv',inputCsv(example()),'text/csv');
   else download(file+'-inputs.csv',inputCsv(b),'text/csv');
   say('Download prepared.');
 }catch(e){say('Download failed: '+(e as Error).message);}};
 const pp={b,s,periods,index,onIndex:select,onTrace:setTrace,go};
 const clean=periods.every(x=>x.balanced&&x.fundingGap<=x.tol&&x.limitExcess<=x.tol)&&Math.abs(openingGap(b.opening))<=periods[0].tol;
 function saveVersion(){const entry={id:crypto.randomUUID(),at:new Date().toISOString(),b};const arr=[entry,...versions].slice(0,12);try{localStorage.setItem(VAULT,JSON.stringify(arr));setVersions(arr);say('Version saved on this device.');}catch{say('Version could not be saved. Download the JSON backup instead.');}}
 const exports=[
  {title:'Editable input CSV',desc:'All three scenarios, opening accounts and annual overrides.',label:'Download inputs',fn:()=>exp('input'),Icon:SlidersHorizontal},
  {title:'Excel results workbook',desc:'Nine sheets with statement totals, cross-links, schedules and checks.',label:'Download Excel',fn:()=>exp('xlsx'),Icon:FileSpreadsheet},
  {title:'Statement CSV',desc:'All three statements for the active case.',label:'Export statements',fn:()=>exp('statements'),Icon:ChartNoAxesCombined},
  {title:'Portable model',desc:'A lossless JSON backup you can reopen in another browser.',label:'Download JSON',fn:()=>exp('json'),Icon:Save},
  {title:'Print report',desc:'The three statements, funding checks and case details in a print layout.',label:'Print / save PDF',fn:()=>window.print(),Icon:Printer},
  {title:'Start from a template',desc:'Edit the example worksheet, then import it to build your model.',label:'Download template',fn:()=>exp('template'),Icon:Download}
 ];
 return <main className="ternwell"><div className="tw-shell"><header className="tw-cover"><div className="tw-cover-copy"><span className="tw-kicker"><TernwellMark size={20}/> FUNDLENZ <i/> MODELLING TOOLS</span><h1>Ternwell<span>.</span></h1><p>Three-statement modelling studio</p></div><div className="tw-cover-art"><Folios/><span>INCOME <i/> BALANCE <i/> CASH</span></div></header>
 <div className="tw-modelbar"><div className="tw-identity"><span className="tw-seal"><TernwellMark size={26}/></span><div><strong>{b.name}</strong><small>{b.name==='Alderwick Industrial'?'Illustrative company · ':''}{b.currency} millions · FY{b.year} opening · {b.horizon} forecast {b.horizon===1?'year':'years'}</small></div></div><div className="tw-actions"><button className="tw-btn" disabled={!ready} onClick={()=>show('new')}><Plus size={15}/> New model</button><button className="tw-btn" disabled={!ready} onClick={()=>show('import')}><Upload size={15}/> Import</button><button className="tw-solid" disabled={!ready} onClick={()=>show('company')}><Settings2 size={15}/> Model setup</button></div></div>
 <nav className="tw-nav" aria-label="Ternwell tools">{TABS.map((t,i)=>{const Icon=icons[i];return <button key={t} aria-current={view===t?'page':undefined} onClick={()=>go(t)}><Icon size={16}/>{t}</button>})}</nav>
 <div className="tw-context"><div className="tw-case"><span className="tw-over">Scenario</span><div className="tw-seg" role="group" aria-label="Active scenario">{CASES.map(cs=><button key={cs} aria-pressed={s===cs} onClick={()=>caseTo(cs)}>{cs}</button>)}</div></div><div className="tw-period"><CalendarDays size={15}/><label className="tw-sr" htmlFor="tw-year">Inspect fiscal year</label><select id="tw-year" value={index} onChange={e=>select(+e.target.value)}>{periods.map((v,i)=><option key={v.year} value={i}>FY{v.year}</option>)}</select><button className="tw-icon" aria-label="Previous fiscal year" disabled={index===0} onClick={()=>select(index-1)}><ArrowLeft size={15}/></button><button className="tw-icon" aria-label="Next fiscal year" disabled={index+1>=periods.length} onClick={()=>select(index+1)}><ArrowRight size={15}/></button></div><div className="tw-history"><button className="tw-icon" aria-label="Undo change" title="Undo" disabled={!state.past.length} onClick={()=>dispatch({t:'undo'})}><Undo2 size={16}/></button><button className="tw-icon" aria-label="Redo change" title="Redo" disabled={!state.future.length} onClick={()=>dispatch({t:'redo'})}><Redo2 size={16}/></button><button className="tw-icon" aria-label="Saved versions" title="Saved versions" onClick={()=>show('version')}><History size={16}/></button></div></div>
 {!clean&&view!=='Checks & files'&&<div className="tw-warning"><CircleAlert size={16}/><span>{periods.some(x=>!x.balanced)?'The balance sheet does not reconcile.':'The forecast has a funding shortfall or exceeds the credit limit.'}</span><button onClick={()=>go('Checks & files')}>See checks →</button></div>}
 <section className="tw-view" key={view}>{view==='Overview'?<Overview {...pp}/>:view==='Statements'?<Statements {...pp}/>:view==='Drivers'?<Drivers {...pp} edit={edit}/>:view==='Schedules'?<Schedules {...pp}/>:view==='Scenarios'?<Scenarios {...pp}/>:<><Section k="06 / Checks & files" title="Review & export" note="Inspect model integrity, save a version, or take your work into Excel."/><HealthPanel {...pp}/><div className="tw-file-grid">{exports.map(({title,desc,label,fn,Icon})=><div className="tw-card tw-pad tw-file" key={title}><Icon size={19}/><h3>{title}</h3><p>{desc}</p><button className="tw-btn" onClick={fn}>{label}<ArrowRight size={14}/></button></div>)}</div><div className="tw-actions"><button className="tw-btn" onClick={()=>show('version')}><History size={15}/> Local versions</button><button className="tw-btn" onClick={()=>show('method')}><BookOpen size={15}/> Modelling policy</button></div></>}</section>
 <footer className="tw-footer"><span><i className="tw-dot"/> {storage}</span><button onClick={()=>show('method')}>Model conventions ↗</button></footer></div>
 {message&&<div className="tw-toast" role="status">{message}</div>}
 {(modal==='company'||modal==='new')&&<Setup base={modal==='new'?emptyBook():b} creating={modal==='new'} onClose={close} onSave={newBook=>{next(newBook);if(modal==='new'){caseTo('Base');select(0);go('Drivers');}close();say('Model updated.');}}/>}
 {modal==='import'&&<Dialog title="Import a Ternwell model" onClose={close}><p className="tw-meta">Use an editable input CSV or JSON backup. Files stay in your browser. Review the model before replacing the current draft.</p><div className="tw-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void readFile(e.dataTransfer.files[0]);}}><Upload size={25}/><strong>Choose a file or drop it here</strong><span>CSV or JSON · up to 1 MB</span><button className="tw-solid" onClick={()=>picker.current?.click()}>Choose model file</button><input hidden ref={picker} type="file" accept=".csv,.json" aria-label="Upload Ternwell file" onChange={e=>{const f=e.target.files?.[0];e.target.value='';void readFile(f);}}/></div><button className="tw-link" onClick={()=>exp('template')}><Download size={14}/> Download input template</button>
 {err&&<p role="alert" className="tw-warning">{err}</p>}{pending&&<div className="tw-preview"><span className="tw-over">Import preview</span><h3>{pending.book.name}</h3><p>{pending.name} · {pending.book.currency} millions · opening FY{pending.book.year} · {pending.book.horizon} forecast years · 3 scenarios</p><p>Opening balance difference: {fmt(openingGap(pending.book.opening),3)}m</p></div>}
 <div className="tw-actions"><button className="tw-btn" onClick={close}>Cancel</button><button className="tw-solid" disabled={!pending} onClick={()=>{if(!pending)return;next(pending.book);select(0);caseTo('Base');go('Overview');close();say('Model imported. Undo is available.');}}>Apply import</button></div></Dialog>}
 {modal==='version'&&<Dialog title="Saved versions" onClose={close}><p className="tw-meta">Keep up to 12 snapshots in this browser. A JSON download is the portable backup.</p><button className="tw-solid" onClick={saveVersion}><Save size={15}/> Save current version</button><div className="tw-version-list">{versions.length?versions.map(v=><div key={v.id}><span><strong>{v.b.name}</strong><small>{new Date(v.at).toLocaleString()} · {v.b.currency} · FY{v.b.year}</small></span><button className="tw-btn" onClick={()=>{next(v.b);select(0);close();say('Version restored. Undo is available.');}}>Restore</button></div>):<p className="tw-meta">No snapshots saved on this device yet.</p>}</div></Dialog>}
 {modal==='method'&&<Dialog title="How the statements link" onClose={close}><div className="tw-prose"><h3>From earnings to cash</h3><p>Net income flows to retained earnings and starts the indirect cash-flow statement. Depreciation is added back. Receivables and inventory use cash when they grow; payables release it.</p><h3>Timing and funding</h3><p>Annual periods use 365 days. Interest and depreciation use opening balances. Interest and cash taxes are operating flows; capex is investing, and borrowing, issuance and dividends are financing. The revolver draws up to its limit and sweeps surplus cash. A negative projected cash balance is an unfunded requirement.</p><h3>Scope</h3><p>This management forecast suits a non-financial operating company. It assumes no deferred tax or loss carryforwards, asset disposals, acquisitions, FX translation or lease schedules. Other non-current balances carry forward unchanged. All examples are fictional.</p><a href="https://www.sec.gov/investor/pubs/begfinstmtguide.htm" target="_blank" rel="noreferrer">SEC guide to financial statements ↗</a></div></Dialog>}
 {trace&&<Dialog title={trace[1]} onClose={()=>setTrace(null)}><p className="tw-formula">{trace[2]}</p><p className="tw-meta">{s} · FY{r.year} · {b.currency} {fmt(r[trace[0]],2)} million</p><TernwellChart title={trace[1]+' by year'} periods={periods.map(p=>'FY'+p.year)} series={[{label:trace[1],values:periods.map(p=>p[trace[0]]??0),color:PALETTE[0]}]} unit={b.currency+' m'} activeIndex={index} onSelect={select}/></Dialog>}
 <div className="tw-print"><h1>Ternwell | {b.name}</h1><p>{s} case · {b.currency} millions · FY{periods[0].year}–{periods[periods.length-1].year}</p><p>Opening balance difference: {fmt(openingGap(b.opening),3)}m. {clean?'All model checks clear.':'Review the reconciliation and funding checks below.'}</p>{Object.entries(REPORTS).map(([title,rows])=><section key={title}><h2>{title==='Income'?'Income statement':title==='Balance'?'Balance sheet':'Cash-flow statement'}</h2><GridTable rows={rows} periods={periods} index={-1} caption={title}/></section>)}<section><h2>Funding & reconciliation</h2><GridTable periods={periods} index={-1} rows={[[ 'balanceGap','Balance difference',''],['fundingGap','Unfunded cash target',''],['limitExcess','Facility limit breach','']]} caption="Funding & reconciliation"/></section></div>
 </main>;
}
