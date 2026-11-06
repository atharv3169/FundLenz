"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./cursor-crew.module.css";

/** Original, non-blocking choreography. This is not extension code. */
export type MorphSignal = {
  sequence: number;
  storyId: string;
  opening: boolean;
  originX: number;
  originY: number;
};
type XY={x:number;y:number};
const PALETTE=["#b2e6d2","#f3c3a0","#c4b8f6","#94cddd","#ebd39b","#dcabc9","#8ac9ba","#b4bbf0","#e9bdb0","#9ccfd8","#c4d7ad","#dbbce5"];
const ROLES=["MOVE","ALIGN","RESIZE","FLOW","PLACE","TYPE","FRAME","TUNE","BUILD","FIT","GUIDE","SET"];
const DURATION=1950;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const smooth=(x:number)=>{const v=clamp(x,0,1);return v*v*(3-2*v);};
const p=(r:DOMRect|undefined,x:number,y:number):XY|null=>r&&r.width>3&&r.height>3?{x:r.left+r.width*x,y:r.top+r.height*y}:null;
function destination(i:number,title:DOMRect|undefined,figure:DOMRect|undefined,lead:DOMRect|undefined,panel:DOMRect|undefined):XY|null{
 if(i===0)return p(title,.02,.13);
 if(i===1)return p(title,.95,.81);
 if(i===2)return p(title,.46,.51);
 if(i===3)return p(figure,.05,.08);
 if(i===4)return p(figure,.94,.07);
 if(i===5)return p(figure,.93,.92);
 if(i===6)return p(figure,.06,.91);
 if(i===7)return p(lead,.05,.12);
 if(i===8)return p(lead,.87,.52);
 if(i===9)return p(lead,.2,.85);
 return p(panel,i===10?.08:.92,.07);
}
function placeGuide(el:HTMLDivElement|null,r:DOMRect|undefined){
 if(!el||!r){if(el)el.style.opacity="0";return;}
 const l=clamp(r.left,9,window.innerWidth-11),t=clamp(r.top,80,window.innerHeight-11);
 const right=clamp(r.right,13,window.innerWidth-9),bottom=clamp(r.bottom,84,window.innerHeight-9);
 if(right-l<14||bottom-t<14){el.style.opacity="0";return;}
 el.style.transform="translate3d("+l+"px,"+t+"px,0)";
 el.style.width=(right-l)+"px";el.style.height=(bottom-t)+"px";
 el.style.opacity="1";
}
export default function CursorCrew({signal}:{signal:MorphSignal|null}){
 const [enabled,setEnabled]=useState(false);
 const layerRef=useRef<HTMLDivElement|null>(null);
 const mouse=useRef<XY>({x:0,y:0});
 const visited=useRef(false);
 const current=useRef<XY[]>([]);
 const choreography=useRef<{signal:MorphSignal;start:number}|null>(null);
 useEffect(()=>{
  const desktop=window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)");
  const measure=()=>setEnabled(desktop.matches&&!reduce.matches);
  measure();desktop.addEventListener("change",measure);reduce.addEventListener("change",measure);
  return()=>{desktop.removeEventListener("change",measure);reduce.removeEventListener("change",measure);};
 },[]);
 useEffect(()=>{if(signal&&enabled)choreography.current={signal,start:performance.now()};},[signal,enabled]);
 useEffect(()=>{
  if(!enabled||!layerRef.current)return;
  const layer=layerRef.current;
  const nodes=Array.from(layer.querySelectorAll<HTMLElement>("[data-crew-agent]"));
  const titleBox=layer.querySelector<HTMLDivElement>("[data-crew-title]");
  const figureBox=layer.querySelector<HTMLDivElement>("[data-crew-figure]");
  if(!visited.current)mouse.current={x:window.innerWidth*.52,y:window.innerHeight*.46};
  if(current.current.length!==ROLES.length){
   current.current=ROLES.map((_,i)=>({x:mouse.current.x+Math.cos(i*.53)*24,y:mouse.current.y+Math.sin(i*.53)*24}));
  }
  const onPointer=(e:PointerEvent)=>{if(e.pointerType==="touch")return;visited.current=true;mouse.current={x:e.clientX,y:e.clientY};};
  window.addEventListener("pointermove",onPointer,{passive:true});
  let frame=0,last=performance.now();
  const update=(now:number)=>{
   const dt=clamp((now-last)/16.67,.4,2.4);last=now;
   if(document.hidden){frame=requestAnimationFrame(update);return;}
   let task=choreography.current;
   if(task&&now-task.start>DURATION){choreography.current=null;task=null;}
   const active=!!task;
   layer.dataset.working=active?"true":"false";
   let title:DOMRect|undefined,figure:DOMRect|undefined,lead:DOMRect|undefined,panel:DOMRect|undefined;
   if(task){
    const scope=document.getElementById("story-"+task.signal.storyId);
    title=scope?.querySelector<HTMLElement>("[data-crew-target=title]")?.getBoundingClientRect();
    figure=scope?.querySelector<HTMLElement>("[data-crew-target=figure]")?.getBoundingClientRect();
    lead=scope?.querySelector<HTMLElement>("[data-crew-target=lead]")?.getBoundingClientRect();
    panel=scope?.querySelector<HTMLElement>("[data-role=story-reader]")?.getBoundingClientRect();
    placeGuide(titleBox,title);placeGuide(figureBox,figure);
   }else{if(titleBox)titleBox.style.opacity="0";if(figureBox)figureBox.style.opacity="0";}
   nodes.forEach((node,i)=>{
    const angle=i*Math.PI*2/ROLES.length;
    const radius=17+(i%4)*7;
    const idle={x:mouse.current.x+Math.cos(angle+now*.00022)*radius,y:mouse.current.y+Math.sin(angle+now*.00022)*radius};
    let target=idle;
    if(task){
     const progress=clamp((now-task.start)/DURATION,0,1);
     const approach=smooth((progress-(.055+(i%4)*.052))/(.58+(i%4)*.052));
     const release=smooth((progress-.79)/.2);
     const goal=destination(i,title,figure,lead,panel)||idle;
     const origin={x:task.signal.originX+Math.cos(angle)*15,y:task.signal.originY+Math.sin(angle)*15};
     target={x:origin.x+(goal.x-origin.x)*approach,y:origin.y+(goal.y-origin.y)*approach};
     target={x:target.x+(idle.x-target.x)*release,y:target.y+(idle.y-target.y)*release};
    }
    const pos=current.current[i];
    const k=1-Math.pow(1-(active?.21:.08+(i%5)*.005),dt);
    pos.x+=(target.x-pos.x)*k;pos.y+=(target.y-pos.y)*k;
    node.style.transform="translate3d("+pos.x.toFixed(1)+"px,"+pos.y.toFixed(1)+"px,0)";
   });
   frame=requestAnimationFrame(update);
  };
  frame=requestAnimationFrame(update);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener("pointermove",onPointer);};
 },[enabled]);
 if(!enabled)return null;
 return <div className={styles.layer} ref={layerRef} aria-hidden="true" data-cursor-crew data-working="false">
  <div className={styles.guide+" "+styles.titleGuide} data-crew-title><i/><i/><i/><i/></div>
  <div className={styles.guide+" "+styles.figureGuide} data-crew-figure><i/><i/><i/><i/></div>
  {ROLES.map((label,i)=><div key={i} className={styles.agent} data-crew-agent style={{"--agent-color":PALETTE[i]} as CSSProperties}>
   <svg viewBox="0 0 24 27" aria-hidden="true"><path d="M3 2 6 22 10 15 18 14Z" fill="var(--agent-color)" stroke="#f5f4eb" strokeWidth="1.4" strokeLinejoin="round"/><path d="m10 15 3.5 7" stroke="#f5f4eb" strokeWidth="2" strokeLinecap="round"/></svg>
   <span>{label}</span>
  </div>)}
 </div>;
}
