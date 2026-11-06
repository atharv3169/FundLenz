/*
 * Live DOM adapter for the actual Swarm Rebuild engine.
 * Movement, text typing, cursor sprites, selection renderer and physics come
 * from swarm-upstream-core.js (extracted from DhvanilPatel/swarm-cursors).
 * The extension's page-capture / blank-page mode is intentionally omitted.
 */
import { SwarmMotion, SwarmLiveView, prepText, reveal, clamp } from "./swarm-upstream-core.js";

const LEFT=[
 {selector:"[data-crew-target=title]",u:.05,v:.17},
 {selector:"[data-crew-target=title]",u:.95,v:.88},
 {selector:"[data-crew-object=primary]",u:.07,v:.15,fallback:"[data-crew-target=figure]"},
 {selector:"[data-crew-object=primary]",u:.9,v:.84,fallback:"[data-crew-target=figure]"},
 {selector:"[data-crew-object=secondary]",u:.07,v:.15,fallback:"[data-crew-target=figure]"},
 {selector:"[data-crew-object=secondary]",u:.91,v:.84,fallback:"[data-crew-target=figure]"},
 {selector:"[data-crew-target=metrics]",u:.05,v:.53},
 {selector:"[data-crew-target=metrics]",u:.88,v:.53},
];
const RIGHT=[
 "[data-crew-target=heading]",
 "[data-crew-target=reader-intro]",
 "[data-crew-target=chapter] h5",
 "[data-crew-target=chapter] p",
 "[data-crew-target=chapter-two] h5",
 "[data-crew-target=chapter-two] p",
];
const MOVE_TIME=1.24;
const NORMAL_MIN=2.7;
function rectOf(node){
 if(!node)return null;
 const r=node.getBoundingClientRect();
 return r.width>2&&r.height>2?r:null;
}
function coords(r,u=.08,v=.1){
 return r?{x:r.left+r.width*u,y:r.top+r.height*v}:null;
}
function selectionOf(node){
 const r=rectOf(node);
 if(!r)return [];
 return [{t:"box",b:{x:r.left,y:r.top,w:r.width,h:r.height},handles:true,rulerLines:false,badge:Math.round(r.width)+" × "+Math.round(r.height)}];
}
function browserEligible(){
 return matchMedia("(min-width: 1024px)").matches &&
   !matchMedia("(pointer: coarse)").matches &&
   !matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function waitFor(condition){
 return function*(motion){
  let elapsed=0;
  while(!condition()&&elapsed<3.3){elapsed+=(yield);motion.time+=0;}
 };
}
// Original prepText/reveal work on an actual styled clone. Keep the React DOM
// untouched so links, tools and events remain live throughout the animation.
function stageText(node,history){
 const full=node.cloneNode(true);
 const it={full,v:0,shown:0};
 prepText(it);
 const live=it.live;
 const parent=node.parentElement;
 if(!parent)return null;
 const r=node.getBoundingClientRect(),pr=parent.getBoundingClientRect();
 const previousParent=parent.style.position;
 const parentPosition=getComputedStyle(parent).position;
 if(parentPosition==="static")parent.style.position="relative";
 live.removeAttribute("id");
 live.removeAttribute("data-crew-target");
 live.setAttribute("aria-hidden","true");
 live.style.cssText+=
   ";position:absolute!important;pointer-events:none!important;z-index:6!important"+
   ";left:"+(r.left-pr.left)+"px!important;top:"+(r.top-pr.top)+"px!important"+
   ";width:"+r.width+"px!important;max-width:"+r.width+"px!important"+
   ";height:"+r.height+"px!important;margin:0!important;opacity:1!important";
 const previousOpacity=node.style.opacity;
 node.style.opacity="0";
 parent.appendChild(live);
 const entry={it,node,live,parent,previousParent,previousOpacity,finished:false};
 history.push(entry);
 return entry;
}
function restoreEntry(entry){
 if(entry.finished)return;
 entry.finished=true;
 entry.live.remove();
 entry.node.style.opacity=entry.previousOpacity;
 if(entry.parent.style.position==="relative"&&entry.previousParent!=="relative")
    entry.parent.style.position=entry.previousParent;
}
function caretPoint(it){
 let last=null;
 for(const unit of it.units){
  if(unit.t&&unit.t.data.length)last=unit.t;
 }
 if(!last)return null;
 const range=document.createRange();
 const n=last.data.length;
 range.setStart(last,Math.max(0,n-1));range.setEnd(last,n);
 const r=range.getBoundingClientRect();
 return {x:r.right+1,y:r.top+r.height*.45};
}

/* Advance the upstream generator as a group: same engine stepping model as
 * Swarm Rebuild's Engine.step, but tasks are live portfolio DOM nodes. */
export function startLiveSwarm({signal,hostClass}){
 if(!browserEligible())return {dispose(){}};
 const section=document.getElementById("story-"+signal.storyId);
 if(!section)return {dispose(){signal.apply?.();signal.finish?.();}};
 const host=document.createElement("div");
 host.className=hostClass;
 host.dataset.swarmEngine="upstream";
 host.dataset.phase="departing";
 host.setAttribute("aria-hidden","true");
 document.body.appendChild(host);
 const original=new SwarmMotion();
 original.tempo=1;
 const view=new SwarmLiveView(host);
 const pointer={x:signal.originX,y:signal.originY};
 const origin={x:signal.originX,y:signal.originY};
 let stopped=false, applied=false, leftReady=0, eraseDone=0, finishedCount=0;
 let raf=0, last=performance.now(),start=last;
 const agents=[],entries=[],cleanup=[];
 let lastApplyTime=0;
 let liveTextStarted=false;

 const pointerMove=e=>{
  if(e.pointerType!=="touch"){pointer.x=e.clientX;pointer.y=e.clientY;}
 };
 window.addEventListener("pointermove",pointerMove,{passive:true});
 const get=(selector,fallback)=>section.querySelector(selector)||(fallback?section.querySelector(fallback):null);
 const grip=(def)=>{
  const r=rectOf(get(def.selector,def.fallback));
  return coords(r,def.u,def.v)||origin;
 };
 const apply=()=>{
  if(applied||stopped)return;
  applied=true;
  lastApplyTime=performance.now();
  signal.apply?.();
  host.dataset.committed="true";
 };
 function finalize(){
  if(stopped)return;
  stopped=true;
  for(const entry of entries)restoreEntry(entry);
  for(const fn of cleanup)fn();
  cancelAnimationFrame(raf);
  view.destroy();
  host.remove();
  window.removeEventListener("pointermove",pointerMove);
  signal.finish?.();
 }
 function runCursor(c,task){
  agents.push({cursor:c,gen:task(c),done:false});
 }
 function returnHome(c){
  return function*(){
    c.ov=null;c.shape="arrow";
    yield* original.moveTo(c,()=>pointer,{speed:2.5,bend:0,duration:.48});
  }();
 }
 const workerCount=LEFT.length+RIGHT.length;
 for(let i=0;i<workerCount;i++){
  const c=original.makeCursor(origin.x+(i%3-1)*2,origin.y+(i%4-1)*2,true);
  agents.push({cursor:c,gen:null,done:false});
 }
 const leftTasks=LEFT.map((def,i)=>function*(c){
  const node=get(def.selector,def.fallback);
  c.shape="arrow";
  const target=()=>grip(def);
  yield* original.moveTo(c,target,{speed:1.85});
  c.shape="cross";
  yield* original.click(c);
  c.ov=()=>selectionOf(node);
  leftReady++;
  if(signal.opening&&leftReady>=6)apply();
  // On close, the right-hand story must actually be deleted first.
  let wait=0;
  while(!applied&&wait<3.6)wait+=(yield);
  if(!applied)apply();
  c.press=1;
  c.shape=i%2?"ew":"arrow";
  yield* original.moveTo(c,target,{duration:MOVE_TIME,drag:true,bend:0});
  c.press=0;
  yield* original.wait(.09);
  c.ov=null;c.shape="arrow";
  yield* returnHome(c);
 });
 const rightTasks=RIGHT.map((selector,i)=>function*(c){
  const target=get(selector);
  if(!target){yield* original.wait(.3);yield* returnHome(c);return;}
  const dest=()=>coords(rectOf(target),.05,.25)||{x:innerWidth*.68,y:200+i*50};
  let wait=0;
  if(signal.opening){
    while(!applied&&wait<3.7)wait+=(yield);
    // Wait for the right-hand reading column to have useful width.
    while(wait<4.2){
     const r=rectOf(target);
     if(r&&r.width>150&&getComputedStyle(target).visibility!=="hidden")break;
     wait+=(yield);
    }
    yield* original.wait(i*.12);
  } else {
    // Reverse starts by selecting existing story text.
    yield* original.wait(i*.045);
  }
  yield* original.moveTo(c,dest,{speed:2.5});
  c.shape="cross";
  yield* original.click(c);
  c.ov=()=>selectionOf(target);
  const record=stageText(target,entries);
  if(record){
    if(signal.opening){
      c.shape="ibeam";
      yield* original.type(record.it,c);
    } else {
      const it=record.it;
      it.shown=it.total;
      reveal(it,it.shown);
      c.shape="ibeam";
      let count=0;
      while(count<.4+i*.045){
       count+=(yield);
       it.shown=Math.max(0,Math.round(it.total*(1-count/(.4+i*.045))));
       reveal(it,it.shown);
      }
      it.shown=0;
      reveal(it,0);
    }
    // Restore originals on the next frame; on close the geometry will hide
    // the panel as part of the real React transition.
    restoreEntry(record);
  }
  c.ov=null;c.shape="arrow";
  if(!signal.opening){
    eraseDone++;
    if(eraseDone>=RIGHT.length)apply();
  }
  yield* returnHome(c);
 });
 const tasks=[...leftTasks,...rightTasks];
 for(let i=0;i<agents.length;i++){agents[i].gen=tasks[i](agents[i].cursor);}
 if(signal.opening){
  // Hide right-hand text before React reveals it, not after it flashes.
  for(const selector of RIGHT){
   const node=get(selector);
   if(node){
    const old=node.style.opacity;
    node.style.opacity="0";
    cleanup.push(()=>node.style.opacity=old);
   }
  }
 }

 // The original typed clones need a per-frame reveal, not a CSS clip of
 // already-rendered text. Keep the real content available for screen readers.
 function tick(now){
  if(stopped)return;
  const dt=clamp((now-last)/1000,.002,.05);
  last=now;
  const elapsed=(now-start)/1000;
  for(const agent of agents){
   if(agent.done)continue;
   if(!agent.gen||agent.gen.next(dt).done){agent.done=true;finishedCount++;}
  }
  for(const item of entries){
   if(item.finished)continue;
   if(item.it.rshown!==item.it.shown){
    reveal(item.it,item.it.shown);
    item.it.rshown=item.it.shown;
    const position=caretPoint(item.it);
    if(position&&item.it.cursor){
      item.it.cursor.x=position.x;item.it.cursor.y=position.y;
    }
   }
  }
  host.dataset.phase=signal.opening?"building":"dismantling";
  if(applied)host.dataset.phase=signal.opening?"typing":"restoring";
  const rendered={
   vp:view.vp,
   cursors:agents.map(a=>a.cursor),
   guides:[],editLines:new Set(),rulers:{t:0},
  };
  view.render(rendered);
  // Guard against a missed target when navigating fast or changing viewport.
  if(!applied&&elapsed>2.1)apply();
  if(finishedCount===agents.length||elapsed>5.4){
   if(!applied)apply();
   finalize();
   return;
  }
  raf=requestAnimationFrame(tick);
 }
 raf=requestAnimationFrame(tick);
 return {dispose:finalize};
}
