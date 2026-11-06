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
/* NEXT */
