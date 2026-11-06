"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
 const composition=useMemo(()=>{
   const bag:Record<string,number>={};
   toyFunds.forEach((fund,i)=>Object.entries(fund.holdings).forEach(([name,fraction])=>bag[name]=(bag[name]||0)+fraction*weights[i]));
   return Object.entries(bag).sort((a,b)=>b[1]-a[1]);
 },[weights]);
 const hhi=composition.reduce((v,[,w])=>v+w*w,0);
 const effective=hhi?1/hhi:0,top=composition[0];
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
 let balance=p;
 const schedule=Array.from({length:Math.min(n,72)},(_,idx)=>{
  balance=Math.max(0,balance*(1+r)-emi);
  return {month:idx+1,balance};
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
/* NEXT */


