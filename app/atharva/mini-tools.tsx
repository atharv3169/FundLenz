"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { Play, Pause, RotateCcw, Plus } from "lucide-react";
import m from "./portfolio-v2.module.css";
const integer=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,Number.isFinite(n)?Math.round(n):min));
const money=(n:number)=>Number.isFinite(n)?new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(n):"—";
const pct=(n:number)=>n.toFixed(1)+"%";
function NumberField({label,value,onChange,min,max,step=1,unit=""}:{label:string;value:number;onChange:(v:number)=>void;min:number;max:number;step?:number;unit?:string}){
 return <label className={m.toolInput}><span>{label}</span><div><input type="number" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/><small>{unit}</small></div></label>;
}
const toyFunds=[
 {name:"Fund A",holdings:{ALPHA:.4,BETA:.3,GAMMA:.2,DELTA:.1}},
 {name:"Fund B",holdings:{ALPHA:.35,BETA:.15,EPSILON:.35,ZETA:.15}},
 {name:"Fund C",holdings:{ALPHA:.2,GAMMA:.35,EPSILON:.25,ETA:.2}}
];

export function FundDemo(){
 const [shares,setShares]=useState([40,30,30]);
 const total=shares.reduce((a,b)=>a+b,0);
 const weights=shares.map(v=>total?v/total:0);
 const composition=(()=>{
   const bag:Record<string,number>={};
   toyFunds.forEach((fund,i)=>Object.entries(fund.holdings).forEach(([name,fraction])=>bag[name]=(bag[name]||0)+fraction*weights[i]));
   return Object.entries(bag).sort((a,b)=>b[1]-a[1]);
 })();
 const hhi=composition.reduce((v,[,w])=>v+w*w,0);
 const effective=hhi?1/hhi:0,top=total?composition[0]:undefined;
 return <div className={m.toolLayout}>
   <div className={m.toolIntro}><span className={m.miniEyebrow}>INTERACTIVE / FUND OVERLAP</span><h4>Three funds.<br/><em>One portfolio.</em></h4><p>Change allocations to see how shared holdings build up. This demo uses entirely <strong>synthetic holdings</strong> with invented names, not live ETF data.</p>
   <div className={m.allocControls}>{toyFunds.map((fund,i)=><label key={fund.name} className={m.rangeRow}><span>{fund.name}<strong>{total?pct(weights[i]*100):"0%"}</strong></span><input type="range" min="0" max="100" step="5" value={shares[i]} onChange={e=>setShares(prev=>prev.map((v,j)=>i===j?+e.target.value:v))}/></label>)}</div>
   <button className={m.ghostAction} onClick={()=>setShares([40,30,30])}><RotateCcw size={14}/> Reset allocations</button></div>
   <div className={m.toolResults}><span className={m.miniEyebrow}>COMBINED EXPOSURE · ILLUSTRATIVE</span><div className={m.metricPair}><div><strong>{effective?effective.toFixed(2):"—"}</strong><small>Effective holdings (1 / HHI)</small></div><div><strong>{composition.filter(x=>x[1]>0).length}</strong><small>Distinct names</small></div></div>
   <div className={m.holdingBars}>{composition.map(([name,value])=><div key={name} className={m.holdingRow}><span>{name}</span><div><i style={{width:(value*100)+"%"}}/></div><strong>{pct(value*100)}</strong></div>)}</div>
   <p className={m.resultFoot}>{top?top[0]+" is the largest combined holding at "+pct(top[1]*100)+".":"Increase an allocation to explore exposure."} Shared names are combined by weight.</p></div>
 </div>;
}

export function FinCalcDemo(){
 const [principal,setPrincipal]=useState(100000),[rate,setRate]=useState(12),[months,setMonths]=useState(12);
 const p=integer(principal,1000,1e9),r=Math.max(0,Math.min(60,rate))/1200,n=integer(months,1,600);
 const emi=r===0?p/n:p*r/(1-Math.pow(1+r,-n));
 const total=emi*n;
 const schedule=Array.from({length:Math.min(n,72)},(_,idx)=>{
  const k=idx+1;
  const balance=r===0?Math.max(0,p-emi*k):Math.max(0,p*Math.pow(1+r,k)-emi*(Math.pow(1+r,k)-1)/r);
  return {month:k,balance};
 });
 return <div className={m.toolLayout}>
  <div className={m.toolIntro}><span className={m.miniEyebrow}>INTERACTIVE / FIXED-RATE EMI</span><h4>Understand<br/><em>the payment.</em></h4><p>Change the loan amount, rate and term. Assumes fixed annual nominal interest compounded monthly, with equal payments.</p>
  <div className={m.numberGrid}>
  <NumberField label="Loan amount" value={principal} onChange={setPrincipal} min={1000} max={1e9} step={1000} unit="₹"/>
  <NumberField label="Annual rate" value={rate} onChange={setRate} min={0} max={60} step={.25} unit="%"/>
  <NumberField label="Term" value={months} onChange={setMonths} min={1} max={600} unit="months"/>
  </div><button className={m.ghostAction} onClick={()=>{setPrincipal(100000);setRate(12);setMonths(12)}}><RotateCcw size={14}/> Reset</button></div>
  <div className={m.toolResults}><span className={m.miniEyebrow}>MONTHLY INSTALMENT</span><div className={m.resultBig}><strong>₹{money(emi)}</strong><small>Monthly EMI</small></div>
  <div className={m.metricPair}><div><strong>₹{money(total)}</strong><small>Total repayment</small></div><div><strong>₹{money(total-p)}</strong><small>Total interest</small></div></div>
  <div className={m.amortization}><div className={m.amortizationBars}>{schedule.map(point=><i key={point.month} title={"Month "+point.month+": "+money(point.balance)} style={{height:Math.max(2,point.balance/p*100)+"%"}}/>)}</div><span>REMAINING BALANCE · FIRST {schedule.length} MONTHS</span></div></div>
 </div>;
}

export function DcfDemo(){
 const [fcf,setFcf]=useState(100),[growth,setGrowth]=useState(8),[wacc,setWacc]=useState(12),[terminal,setTerminal]=useState(3);
 const f=Math.max(.01,fcf),g=growth/100,w=wacc/100,t=terminal/100;
 const valid=w>t&&w>0;
 const forecast=Array.from({length:5},(_,i)=>f*Math.pow(1+g,i+1));
 const present=forecast.map((v,i)=>v/Math.pow(1+w,i+1));
 const pvForecast=present.reduce((a,b)=>a+b,0);
 const pvTerminal=valid?forecast[4]*(1+t)/(w-t)/Math.pow(1+w,5):0;
 const enterprise=pvForecast+pvTerminal;
 return <div className={m.toolLayout}>
   <div className={m.toolIntro}><span className={m.miniEyebrow}>INTERACTIVE / FIVE-YEAR DCF</span><h4>Change a driver.<br/><em>See value move.</em></h4><p>Illustrative five-year free-cash-flow model with perpetual-growth terminal value. All inputs and figures are hypothetical, in ₹ millions.</p>
   <div className={m.numberGrid}>
    <NumberField label="Starting FCF" value={fcf} onChange={setFcf} min={1} max={100000} unit="₹m"/>
    <NumberField label="FCF growth" value={growth} onChange={setGrowth} min={-40} max={50} step={.5} unit="%"/>
    <NumberField label="Discount rate" value={wacc} onChange={setWacc} min={1} max={40} step={.5} unit="%"/>
    <NumberField label="Terminal growth" value={terminal} onChange={setTerminal} min={-2} max={15} step={.5} unit="%"/>
   </div><button className={m.ghostAction} onClick={()=>{setFcf(100);setGrowth(8);setWacc(12);setTerminal(3)}}><RotateCcw size={14}/> Reset assumptions</button></div>
   <div className={m.toolResults}><span className={m.miniEyebrow}>ENTERPRISE VALUE / HYPOTHETICAL</span>
   {valid?<><div className={m.resultBig}><strong>₹{money(enterprise)}m</strong><small>PV of forecast + terminal value</small></div>
   <div className={m.metricPair}><div><strong>{pct(enterprise?pvTerminal/enterprise*100:0)}</strong><small>Terminal contribution</small></div><div><strong>₹{money(pvForecast)}m</strong><small>Five-year PV</small></div></div>
   <div className={m.dcfForecast}>{forecast.map((val,i)=><div key={i} className={m.dcfYear}><span>Y{i+1}</span><div><i style={{height:(val/Math.max(1,...forecast)*100)+"%"}}/></div><strong>{money(val)}</strong></div>)}</div>
   <p className={m.resultFoot}>Enterprise value only; no net-debt or share-count bridge. Not investment advice.</p></>:
   <p role="alert" className={m.invalidModel}>Discount rate must exceed perpetual growth. Change an input to calculate a valid value.</p>}</div>
 </div>;
}

export function StudyDemo(){
 const [tasks,setTasks]=useState([{id:1,text:"Review research notes",done:true},{id:2,text:"Revise financial models",done:false},{id:3,text:"Read for 20 minutes",done:false}]);
 const [entry,setEntry]=useState(""),[note,setNote]=useState("One small task at a time.");
 const [seconds,setSeconds]=useState(300),[running,setRunning]=useState(false);
 useEffect(()=>{if(!running||seconds<=0)return;const id=window.setInterval(()=>setSeconds(v=>Math.max(0,v-1)),1000);return()=>window.clearInterval(id)},[running,seconds]);
 const count=tasks.filter(t=>t.done).length;
 const timer=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
 return <div className={m.toolLayout}>
 <div className={m.toolIntro}><span className={m.miniEyebrow}>INTERACTIVE / STUDY BUDDY RECREATION</span><h4>Make a plan.<br/><em>Find your focus.</em></h4><p>Add a task, mark it done or jot down a note. This is a fresh, session-only demo of the original study idea—nothing is stored or sent anywhere.</p>
 <form className={m.taskAdd} onSubmit={e=>{e.preventDefault();const val=entry.trim();if(!val)return;setTasks(s=>[...s,{id:Date.now(),text:val.slice(0,85),done:false}]);setEntry("")}}><input aria-label="New study task" maxLength={85} value={entry} onChange={e=>setEntry(e.target.value)} placeholder="Add something to study"/><button type="submit" aria-label="Add task"><Plus size={17}/></button></form>
 <div className={m.taskList}>{tasks.map(task=><label key={task.id}><input type="checkbox" checked={task.done} onChange={()=>setTasks(old=>old.map(t=>t.id===task.id?{...t,done:!t.done}:t))}/><span className={task.done?m.completedTask:""}>{task.text}</span></label>)}</div><p className={m.resultFoot}>{count} of {tasks.length} complete</p></div>
 <div className={m.toolResults}><span className={m.miniEyebrow}>FIVE-MINUTE FOCUS MODE</span><div className={m.focusRing} style={{"--focus-progress":(seconds/300*100)+"%"} as CSSProperties}><strong>{timer}</strong><small>FOCUS SESSION</small></div>
 <div className={m.focusControls}><button onClick={()=>{if(seconds<=0){setSeconds(300);setRunning(true);}else{setRunning(v=>!v);}}}>{running?<Pause size={16}/>:<Play size={16}/>} {running?"Pause":"Start"}</button><button onClick={()=>{setSeconds(300);setRunning(false)}}><RotateCcw size={16}/> Reset</button></div>
 <label className={m.noteLabel}>QUICK NOTE<textarea maxLength={600} rows={3} value={note} onChange={e=>setNote(e.target.value)} aria-label="Quick study note"/></label></div>
 </div>;
}
export function MiniTools({id}:{id:string}){
 if(id==="fundlenz")return <FundDemo/>;
 if(id==="fincalc")return <FinCalcDemo/>;
 if(id==="dcf")return <DcfDemo/>;
 if(id==="study")return <StudyDemo/>;
 return null;
}




