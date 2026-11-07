'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export type TernwellSeries = { label: string; values: number[]; color:string };
export type TernwellChartProps = {
  periods:string[]; series:TernwellSeries[]; unit:string; title:string; description?:string;
  activeIndex:number; onSelect:(index:number)=>void; kind?:'line'|'bar';
};

const inks=['#553c57','#287569','#a2522a','#566d91'];
const dashes=[undefined,'7 4','2 4','9 3 2 3'];
const axisFmt=new Intl.NumberFormat('en-US',{maximumSignificantDigits:3});
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumSignificantDigits:3});
const exact=new Intl.NumberFormat('en-US',{maximumFractionDigits:6});
const isNum=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const clamp=(n:number,lo:number,hi:number)=>Math.min(Math.max(n,lo),hi);
const valueText=(n:unknown)=>!isNum(n)?'—':n!==0&&Math.abs(n)<1e-6?n.toExponential(2):exact.format(Object.is(n,-0)?0:n);
const tickText=(n:number)=>n===0?'0':Math.abs(n)<.001||Math.abs(n)>1e15?n.toExponential(1):Math.abs(n)>=1000?compact.format(n):axisFmt.format(n);

export function TernwellMark({size=32,width,height,className}:{size?:number;width?:number;height?:number;className?:string}={}) {
  return <svg width={width??size} height={height??size} viewBox="0 0 36 36" className={className} fill="none" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.7 23.1 14.4 6.7 14.2-6.7M3.7 18.6l14.4 6.7 14.2-6.7"/>
      <path d="m3.7 14.1 14.4-6.6 14.2 6.6-14.2 6.8z" fill="currentColor" fillOpacity=".12"/>
      <path d="m11.7 14.2 5.8-2.7m-2.1 4.5 7.7-3.6"/>
    </g>
  </svg>;
}

function Point({x,y,idx,color,r=3}:{x:number;y:number;idx:number;color:string;r?:number}) {
  const fill='var(--twv-surface,#fffdf8)';
  return idx%3===0?<circle cx={x} cy={y} r={r} stroke={color} strokeWidth="1.7" fill={fill}/>:
    idx%3===1?<path d={'M'+x+' '+(y-r-1)+'l'+(r+1)+' '+(r+1)+'-'+(r+1)+' '+(r+1)+'-'+(r+1)+'-'+(r+1)+'z'} stroke={color} strokeWidth="1.55" fill={fill}/>:
    <rect x={x-r} y={y-r} width={r*2} height={r*2} rx=".6" stroke={color} strokeWidth="1.6" fill={fill}/>;
}

export function TernwellChart({periods,series,unit,title,description,activeIndex,onSelect,kind='line'}:TernwellChartProps) {
  const token=useId().replace(/[^A-Za-z0-9_-]/g,''),stage=useRef<HTMLDivElement>(null),touch=useRef<{x:number;y:number}|null>(null);
  const [width,setWidth]=useState(540),[tip,showTip]=useState(false),[hidden,hide]=useState<string[]>([]);
  useEffect(()=>{
    const el=stage.current;if(!el)return;
    function measure(){if(el){const next=Math.round(el.getBoundingClientRect().width);if(next>0)setWidth(next);}}
    measure();
    if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}
    const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();
  },[]);
  const n=periods.length,active=clamp(Number.isFinite(activeIndex)?Math.round(activeIndex):0,0,Math.max(0,n-1));
  const all=series.map((s,i)=>({...s,i,key:s.label+'|'+i,ink:s.color||inks[i%inks.length]}));
  const shown=all.filter(s=>!hidden.includes(s.key));const visible=shown.length?shown:all.slice(0,1);
  const vals=visible.flatMap(s=>s.values.slice(0,n).filter(isNum));const hasData=n>0&&vals.length>0;
  let min=0,max=0,scale=1;
  if(hasData){
    const rawMin=vals.reduce((a,b)=>Math.min(a,b),Infinity),rawMax=vals.reduce((a,b)=>Math.max(a,b),-Infinity);
    scale=Math.max(Math.abs(rawMin),Math.abs(rawMax))||1;
    min=rawMin/scale;max=rawMax/scale;
    if(kind==='bar'){min=Math.min(0,min);max=Math.max(0,max);}
    if(max===min){if(min===0){max=1;}else{const pad=Math.abs(min)*.15;min-=pad;max+=pad;}}
    else if(kind==='line'){const pad=(max-min)*.07;min=rawMin>=0?Math.max(0,min-pad):min-pad;max=rawMax<=0?Math.min(0,max+pad):max+pad;}
  }else{max=1;}
  const den=max-min||1, left=width<340?39:49,right=width<340?13:17,height=width<360?164:184,top=12,bottom=height-28;
  const plotW=Math.max(1,width-left-right),plotH=bottom-top,groupW=plotW/Math.max(1,n);
  const start=kind==='bar'?left+groupW/2:left,end=kind==='bar'?left+plotW-groupW/2:left+plotW;
  const x=(i:number)=>n<=1?left+plotW/2:start+(end-start)*i/(n-1);
  const y=(v:number)=>bottom-(v/scale-min)/den*plotH;
  const zero=clamp(y(0),top,bottom);
  // Use normalized coordinates to avoid overflowing when values straddle ±Number.MAX_VALUE.
  const unitFromFraction=(f:number)=>Math.max(-Number.MAX_VALUE,Math.min(Number.MAX_VALUE,f*scale));
  const ticks=[0,1,2,3].map(i=>({v:unitFromFraction(max-den*i/3),pos:top+plotH*i/3}));
  const maxLabels=Math.max(2,Math.floor(plotW/64));
  const stride=Math.max(1,Math.ceil((n-1)/Math.max(1,maxLabels-1)));
  const xTicks=Array.from({length:n},(_,i)=>i).filter(i=>i===0||i===n-1||(i%stride===0&&n-1-i>=Math.max(1,Math.ceil(stride/2))));
  function select(i:number){const j=clamp(i,0,n-1);if(j!==active)onSelect(j);showTip(true);}
  function atPointer(e:PointerEvent<HTMLDivElement>){if(!hasData)return;const bounds=e.currentTarget.getBoundingClientRect();if(!bounds.width)return;const l=(e.clientX-bounds.left)*width/bounds.width;select(n<=1?0:Math.round((l-start)/Math.max(1,end-start)*(n-1)));}
  function keyboard(e:KeyboardEvent<HTMLDivElement>){if(!hasData)return;switch(e.key){
    case 'ArrowRight':case 'ArrowUp':e.preventDefault();select(active+1);break;
    case 'ArrowLeft':case 'ArrowDown':e.preventDefault();select(active-1);break;
    case 'Home':e.preventDefault();select(0);break;case 'End':e.preventDefault();select(n-1);break;
    case 'Escape':e.preventDefault();showTip(false);break;
  }}
  function toggle(key:string){const visibleNow=visible.some(s=>s.key===key);if(visibleNow&&visible.length===1)return;hide(prev=>visibleNow?[...new Set([...prev,key])]:prev.filter(k=>k!==key));}
  const selectedText=periods[active]+': '+visible.map(s=>s.label+' '+valueText(s.values[active])+(unit?' '+unit:'')).join('; ');
  const tipWidth=Math.min(222,Math.max(80,width-10)),tipLeft=clamp(x(active)+12+tipWidth<width?x(active)+12:x(active)-tipWidth-12,3,Math.max(3,width-tipWidth-3));
  return <figure className="twv-chart" aria-labelledby={token+'-title'}>
    <figcaption className="twv-caption"><div><h3 id={token+'-title'} className="twv-title">{title}</h3>{description&&<p className="twv-description">{description}</p>}</div>{unit&&<span className="twv-unit">{unit}</span>}</figcaption>
    <div className="twv-legend" aria-label={title+' series'}>{all.map(s=>{
      const sel=visible.some(v=>v.key===s.key);const mark=<><svg width="25" height="14" viewBox="0 0 25 14" aria-hidden><path d="M1 7h23" fill="none" stroke={s.ink} strokeWidth="2" strokeDasharray={dashes[s.i%4]}/><Point x={12.5} y={7} idx={s.i} color={s.ink} r={2.8}/></svg><span>{s.label}</span></>;
      return all.length===1?<span className="twv-key" key={s.key}>{mark}</span>:<button className="twv-key" key={s.key} type="button" aria-pressed={sel} aria-disabled={sel&&visible.length===1} title={sel&&visible.length===1?'One series must stay visible':(sel?'Hide ':'Show ')+s.label} onClick={()=>toggle(s.key)}>{mark}</button>;
    })}</div>
    <p className="twv-sr" id={token+'-help'}>Use arrow keys to inspect years. Home and End jump to the first and last year. Press Escape to dismiss the tooltip. Exact values are in the data table.</p>
    <div className={'twv-stage'+(hasData?'':' twv-stage-empty')} ref={stage} tabIndex={hasData?0:undefined} role={hasData?'slider':undefined} aria-label={hasData?'Inspect fiscal year for '+title:undefined} aria-valuemin={hasData?1:undefined} aria-valuemax={hasData?n:undefined} aria-valuenow={hasData?active+1:undefined} aria-valuetext={hasData?selectedText:undefined} aria-orientation={hasData?'horizontal':undefined} aria-describedby={hasData?token+'-help':undefined}
      onFocus={()=>showTip(true)} onBlur={()=>showTip(false)} onKeyDown={keyboard}
      onPointerMove={e=>{if(e.pointerType!=='touch')atPointer(e);}} onPointerDown={e=>{if(e.pointerType==='touch')touch.current={x:e.clientX,y:e.clientY};}}
      onPointerUp={e=>{const t=touch.current;touch.current=null;if(e.pointerType!=='touch'||!t||Math.abs(t.y-e.clientY)<12||Math.abs(t.x-e.clientX)>Math.abs(t.y-e.clientY))atPointer(e);}}
      onPointerLeave={()=>showTip(false)} onPointerCancel={()=>{touch.current=null;showTip(false);}}>
    {!hasData?<p className="twv-no-data">No forecast values for this selection.</p>:<svg aria-hidden="true" focusable="false" width="100%" height={height} viewBox={'0 0 '+width+' '+height} preserveAspectRatio="none" className="twv-plot">
      <defs><linearGradient id={token+'-wash'} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={visible[0].ink} stopOpacity=".14"/><stop offset="100%" stopColor={visible[0].ink} stopOpacity=".015"/></linearGradient><clipPath id={token+'-clip'}><rect x={left-5} y={top-5} width={plotW+10} height={plotH+10}/></clipPath></defs>
      {ticks.map((t,i)=><g key={i}><line className="twv-gridline" x1={left} x2={width-right} y1={t.pos} y2={t.pos}/><text className="twv-tick" x={left-5} y={t.pos+3} textAnchor="end">{tickText(t.v)}</text></g>)}
      {min<=0&&max>=0&&<line className="twv-zero" x1={left} x2={width-right} y1={zero} y2={zero}/>}
      <g clipPath={'url(#'+token+'-clip)'}>{visible.map((s,si)=>{
        const points=s.values.slice(0,n);
        if(kind==='bar'){const block=Math.min(groupW*.72,68),bw=block/visible.length;return <g key={s.key}>{points.map((v,i)=>{if(!isNum(v))return null;const vy=y(v),px=x(i)-block/2+si*bw;return <rect key={i} x={px} y={Math.min(zero,vy)} width={Math.max(.8,bw*.86)} height={v===0?0:Math.max(.9,Math.abs(vy-zero))} rx={1.5} fill={s.ink} opacity={i===active?1:.76}/>;})}</g>;}
        const groups:number[][]=[];points.forEach((v,i)=>{if(!isNum(v))return;if(!i||!isNum(points[i-1]))groups.push([]);groups[groups.length-1].push(i);});
        return <g key={s.key}>{groups.map(group=>{const path=group.map((i,j)=>(j?'L':'M')+x(i)+' '+y(points[i])).join(' ');return <g key={group[0]}>{si===0&&group.length>1&&<path d={path+' L'+x(group[group.length-1])+' '+bottom+' L'+x(group[0])+' '+bottom+'Z'} fill={'url(#'+token+'-wash)'}/>}<path className="twv-trace" d={path} fill="none" stroke={s.ink} strokeWidth={2.35} strokeDasharray={dashes[s.i%4]} strokeLinejoin="round" strokeLinecap="round"/></g>;})}
        {points.map((v,i)=>isNum(v)?<Point key={i} x={x(i)} y={y(v)} idx={s.i} color={s.ink} r={i===active?3.9:2.5}/>:null)}</g>;
      })}</g>
      <line x1={x(active)} x2={x(active)} y1={top} y2={bottom} className="twv-cursor"/>
      {xTicks.map(i=><text key={i} x={x(i)} y={height-7} textAnchor="middle" className="twv-tick twv-x">{periods[i]}</text>)}
    </svg>}
    {hasData&&tip&&<div className="twv-tip" role="tooltip" style={{left:tipLeft,width:tipWidth}}><strong>{periods[active]}</strong>{visible.map(s=><div key={s.key}><span>{s.label}</span><b>{valueText(s.values[active])}</b></div>)}</div>}</div>
    {hasData&&<div className="twv-readout"><span className="twv-readout-year">{periods[active]}</span>{visible.map(s=><span className="twv-reading" key={s.key}><span>{s.label}</span> <b>{valueText(s.values[active])}</b></span>)}</div>}
    {n>0&&all.length>0&&<details className="twv-table"><summary>Chart data</summary><div className="twv-scroll" tabIndex={0} role="region" aria-label={title+' data table'}><table><caption className="twv-sr">{title}{unit?' in '+unit:''}</caption><thead><tr><th scope="col">Period</th>{all.map(s=><th scope="col" key={s.key}>{s.label}</th>)}</tr></thead><tbody>{periods.map((p,i)=><tr key={i}><th scope="row">{p}</th>{all.map(s=><td key={s.key}>{valueText(s.values[i])}</td>)}</tr>)}</tbody></table></div></details>}
  </figure>;
}
