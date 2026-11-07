'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {X, ArrowUpRight} from 'lucide-react';
import {fmt,type Period,type ReportRow,type RowKey} from '@/lib/ternwell/model';
export function Dialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),id=useId();
 useEffect(()=>{const el=ref.current;const old=document.activeElement as HTMLElement|null;el?.showModal();return()=>{el?.close();old?.focus();};},[]);
 return <dialog ref={ref} className="tw-dialog" aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
  <div className="tw-dhead"><div><span className="tw-over">Ternwell / Model desk</span><h2 id={id}>{title}</h2></div><button className="tw-icon" aria-label="Close dialog" onClick={onClose}><X size={18}/></button></div>{children}</dialog>;
}
export function NumberField({label,unit,value,min,max,optional=false,onChange}:{label:string;unit?:string;value:number|undefined;min:number;max:number;optional?:boolean;onChange:(v:number|undefined)=>void}){
 const [draft,set]=useState<string|null>(null),[err,error]=useState('');const id=useId();const text=draft??(value===undefined?'':String(value));
 const accept=()=>{if(draft===null)return;if(!draft.trim()&&optional){onChange(undefined);set(null);error('');return;}
 const n=Number(draft);if(!draft.trim()||!Number.isFinite(n)||n<min||n>max){error('Enter '+fmt(min)+' to '+fmt(max)+'.');return;}onChange(n);set(null);error('');};
 return <div className="tw-field"><label htmlFor={id}>{label}{unit&&<small>{unit}</small>}</label><input id={id} type="number" inputMode="decimal" step="any" value={text} min={min} max={max} placeholder={optional?'Use case default':'0'} onChange={e=>{set(e.target.value);error('');}} onBlur={accept} aria-invalid={!!err} aria-describedby={err?id+'-err':undefined} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}if(e.key==='Escape'){set(null);error('');}}}/>{err&&<small id={id+'-err'} role="alert">{err} Current model is unchanged.</small>}</div>
}
export const TOTALS=new Set<RowKey>(['gross','ebitda','ebit','net','assets','equity','liabilities','liabilitiesEquity','balanceGap','cfo','cfi','cff','movement','cash','fundingGap']);
export function GridTable({rows,periods,index,onIndex,onTrace,denominator,caption}:{rows:ReportRow[];periods:Period[];index:number;onIndex?:(i:number)=>void;onTrace?:(row:ReportRow)=>void;denominator?:'assets'|'revenue';caption:string}){
 return <div className="tw-table-scroll" tabIndex={0} aria-label={caption+' scroll area'}><table className="tw-grid-table"><caption className="tw-sr">{caption}</caption><thead><tr><th scope="col">Line item</th>{periods.map((r,i)=><th key={r.year} scope="col" data-active={i===index||undefined}>{onIndex?<button aria-label={'Inspect FY'+r.year} aria-pressed={i===index} onClick={()=>onIndex(i)}>FY{r.year}</button>:'FY'+r.year}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row[0]} data-total={TOTALS.has(row[0])||undefined}><th scope="row">{onTrace?<button onClick={()=>onTrace(row)} title={'Trace '+row[1]}>{row[1]} <ArrowUpRight size={12} aria-hidden/></button>:row[1]}</th>{periods.map((p,i)=>{const v=p[row[0]],n=v===null?null:denominator?(p[denominator]>0?100*v/p[denominator]:null):v;return <td key={p.year} data-active={i===index||undefined} className={n!==null&&n<0?'tw-neg':''}>{fmt(n,denominator?1:2)}{denominator&&n!==null?'%':''}</td>})}</tr>)}</tbody></table>{!rows.length&&<p className="tw-empty">No matching line items.</p>}</div>
}
export const PALETTE=['#544068','#16766e','#ae612f','#526e9b'];
export function Section({k,title,note,action}:{k:string;title:string;note?:string;action?:ReactNode}){return <div className="tw-section-head"><div><span className="tw-over">{k}</span><h2>{title}</h2>{note&&<p>{note}</p>}</div>{action}</div>}
