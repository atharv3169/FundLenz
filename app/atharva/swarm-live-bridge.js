/*
 * FundLenz live-document adapter for the upstream Swarm Rebuild engine.
 * Cursor sprites, moveTo flight paths, crosshair text drawing, typing,
 * selection handles and rendering are provided by swarm-upstream-core.js.
 * This bridge only schedules *actual* DOM transformations and owns cleanup.
 */
import {SwarmMotion,SwarmLiveView,prepText,reveal,clamp} from "./swarm-upstream-core.js";

const LEFT=[
 ["[data-crew-target=title]",.03,.19],
 ["[data-crew-target=title]",.94,.83],
 ["[data-crew-object=primary]",.08,.2,"[data-crew-target=figure]"],
 ["[data-crew-object=primary]",.92,.8,"[data-crew-target=figure]"],
 ["[data-crew-object=secondary]",.09,.2,"[data-crew-target=figure]"],
 ["[data-crew-object=secondary]",.9,.8,"[data-crew-target=figure]"],
 ["[data-crew-target=metrics]",.1,.45],
 ["[data-crew-target=metrics]",.85,.45],
 ["[data-crew-target=copy] [class*=storyEyebrow]",.5,.5],
 ["[data-crew-target=copy] [class*=storyHook]",.43,.5],
 ["[data-crew-target=copy] [class*=storyIntro]",.5,.5],
 ["[data-crew-target=copy] [class*=storyActions]",.48,.5],
];
const RIGHT=[
 "[data-crew-target=heading]",
 "[data-crew-target=reader-intro]",
 "[data-crew-target=chapter] h5",
 "[data-crew-target=chapter] p",
 "[data-crew-target=chapter-two] h5",
 "[data-crew-target=chapter-two] p",
];
const leftLeaders=new Set([0,2,4]);
const enabled=()=>matchMedia("(min-width:1024px)").matches
 && !matchMedia("(pointer:coarse)").matches
 && !matchMedia("(prefers-reduced-motion:reduce)").matches;
const rectOf=node=>{
 if(!node||!node.isConnected)return null;
 const r=node.getBoundingClientRect();
 return r.width>3&&r.height>3?r:null;
};
const at=(r,u=.05,v=.15)=>r?{x:r.left+r.width*u,y:r.top+r.height*v}:null;
function outline(node){
 const r=rectOf(node);
 if(!r||r.bottom<80||r.top>innerHeight||r.right<0||r.left>innerWidth)return [];
 return [{t:"box",b:{x:r.left,y:r.top,w:r.width,h:r.height},
    handles:true,rulerLines:false,badge:null}];
}
function textClone(node,entries,originalStyles,parents){
 const parent=node.parentElement,r=rectOf(node);
 if(!parent||!r)return null;
 if(!originalStyles.has(node))originalStyles.set(node,node.style.opacity);
 if(!parents.has(parent))parents.set(parent,parent.style.position);
 if(getComputedStyle(parent).position==="static")parent.style.position="relative";
 const full=node.cloneNode(true),it={full,v:0,shown:0};
 prepText(it);
 const live=it.live;
 live.removeAttribute("id");
 live.removeAttribute("data-crew-target");
 live.setAttribute("aria-hidden","true");
 const sr=getComputedStyle(node),pr=parent.getBoundingClientRect();
 const css=[
  "position:absolute!important","pointer-events:none!important","z-index:6!important",
  "left:"+(r.left-pr.left)+"px!important","top:"+(r.top-pr.top)+"px!important",
  "width:"+r.width+"px!important","height:"+r.height+"px!important",
  "max-width:"+r.width+"px!important","margin:0!important","opacity:1!important"
 ].join(";");
 live.style.cssText+=";"+css;
 const size=parseFloat(sr.fontSize)||14;
 Object.assign(it,{
  kind:"text",tb:{x:r.left,y:r.top,w:r.width,h:r.height},
  x:r.left,y:r.top,dx:0,dy:0,scale:1,align:sr.textAlign||"left",
  fs:size,lh:parseFloat(sr.lineHeight)||size*1.4,
  vis:false,done:false,editing:false,selAll:false,
 });
 node.style.opacity="0";
 parent.append(live);
 const entry={node,parent,live,it,removed:false};
 entries.push(entry);
 return entry;
}
function removeText(entry){
 if(entry?.removed)return;
 entry.removed=true;
 entry.live.remove();
}
function followText(entry){
 if(!entry||entry.removed)return;
 const r=rectOf(entry.node);
 if(!r)return;
 const pr=entry.parent.getBoundingClientRect();
 entry.live.style.setProperty("left",(r.left-pr.left)+"px","important");
 entry.live.style.setProperty("top",(r.top-pr.top)+"px","important");
 entry.live.style.setProperty("width",r.width+"px","important");
 entry.live.style.setProperty("max-width",r.width+"px","important");
 entry.it.tb.x=r.left;entry.it.tb.y=r.top;
 entry.it.tb.w=r.width;entry.it.tb.h=r.height;
}
function caret(it){
 let last=null;
 for(const u of it.units)if(u.t?.data.length)last=u.t;
 if(!last)return null;
 try{
  const range=document.createRange();
  range.setStart(last,Math.max(0,last.data.length-1));
  range.setEnd(last,last.data.length);
  const r=range.getBoundingClientRect();
  return {x:r.right+1,y:r.top+r.height*.45};
 }catch{return null;}
}

/** Start original Swarm engine with real page nodes as task targets.
 *  All state is scoped to one transition; nothing is left on the page at rest.
 */
export function startLiveSwarm({signal,hostClass}){
 if(!enabled()){signal.apply?.();signal.finish?.();return {dispose(){}};}
 const section=document.getElementById("story-"+signal.storyId);
 if(!section){signal.apply?.();signal.finish?.();return {dispose(){}};}
 const host=document.createElement("div");
 host.className=hostClass;
 host.setAttribute("data-cursor-crew","true");
 host.setAttribute("aria-hidden","true");
 host.dataset.swarmEngine="upstream";
 host.dataset.phase="selecting";
 section.dataset.swarmRunning="true";
 document.body.append(host);
 const upstream=new SwarmMotion();
 upstream.tempo=1.5;
 const view=new SwarmLiveView(host);
 const origin={x:clamp(signal.originX,10,innerWidth-10),y:clamp(signal.originY,82,innerHeight-10)};
 const pointer={...origin};
 const get=(sel,alt)=>section.querySelector(sel)||(alt?section.querySelector(alt):null);
 const leftNodes=LEFT.map(([sel,, ,alt])=>get(sel,alt));
 const rightNodes=RIGHT.map(sel=>get(sel));
 const agents=Array.from({length:LEFT.length+RIGHT.length},(_,i)=>{
   const c=upstream.makeCursor(origin.x+(i%3-1)*2,origin.y+(i%4-1)*2,true);
   return {cursor:c,gen:null,done:false};
 });
 const originals=new Map(),parents=new Map(),entries=[];
 let applied=false,stopped=false,readyLeft=0,erasedRight=0,worked=0,done=0;
 let raf=0,start=performance.now(),last=start;
 let phase="selecting",transitionTime=0,completed=false,taskErrors=0,maxSimultaneousBoxes=0;
 const onPointer=e=>{if(e.pointerType!=="touch"){pointer.x=e.clientX;pointer.y=e.clientY;}};
 const onResize=()=>{if(!enabled())finish();};
 window.addEventListener("pointermove",onPointer,{passive:true});
 window.addEventListener("resize",onResize);
 const media=[
  matchMedia("(min-width:1024px)"),
  matchMedia("(pointer:coarse)"),
  matchMedia("(prefers-reduced-motion:reduce)")
 ];
 media.forEach(m=>m.addEventListener("change",onResize));
 function apply(){
  if(applied||stopped)return;
  applied=true;
  transitionTime=performance.now();
  phase=signal.opening?"moving":"restoring";
  host.dataset.committed="true";
  signal.apply?.();
 }
 function finish(){
  if(stopped)return;
  if(!applied)apply();
  stopped=true;
  for(const entry of entries)removeText(entry);
  for(const [node,value] of originals){
   if(node.isConnected)node.style.opacity=value;
  }
  for(const [parent,value] of parents){
   if(parent.isConnected)parent.style.position=value;
  }
  cancelAnimationFrame(raf);
  section.dataset.swarmLastTyped=host.dataset.typedCount||"0";
  section.dataset.swarmLastErrors=String(taskErrors);
  section.dataset.swarmLastTimedOut=host.dataset.timedOut||"false";
  section.dataset.swarmLastMaxBoxes=String(maxSimultaneousBoxes);
  section.dataset.swarmLastMode=signal.opening?"open":"close";
  view.destroy();host.remove();
  section.removeAttribute("data-swarm-running");
  window.removeEventListener("pointermove",onPointer);
  window.removeEventListener("resize",onResize);
  media.forEach(m=>m.removeEventListener("change",onResize));
  signal.finish?.();
 }
 function track(node,u,v){
  return ()=>at(rectOf(node),u,v)||origin;
 }
 function* goHome(c){
  c.ov=null;c.press=0;c.shape="arrow";
  yield* upstream.moveTo(c,()=>pointer,{duration:.48,speed:2.6,bend:0});
 }
 function* waitFor(test,limit=2.9){
  let waited=0;
  while(!stopped&&!test()&&waited<limit)waited+=(yield);
 }
 function* waitLayoutStable(){
  const panel=get("[data-role=story-reader]");
  let prev=-1,stable=0,elapsed=0;
  while(!stopped&&elapsed<2.2){
   const r=rectOf(panel),w=r?.width||0;
   const dt=yield;
   elapsed+=dt;
   if(w>Math.max(350,innerWidth*.35)&&Math.abs(w-prev)<1)stable+=dt;
   else stable=0;
   prev=w;
   if(stable>.12)break;
  }
 }
 function* barrier(){
  worked++;
  const startWait=performance.now();
  while(!stopped&&worked<agents.length&&performance.now()-startWait<2600)yield;
 }
 function* leftWork(c,i){
  const node=leftNodes[i];
  const d=LEFT[i],point=track(node,d[1],d[2]);
  yield* upstream.moveTo(c,point,{speed:2.4});
  c.shape="cross";
  yield* upstream.click(c);
  // Only 4 real handles; the earlier version drew 12 overlapping boxes.
  if(leftLeaders.has(i))c.ov=()=>outline(node);
  readyLeft++;
  if(signal.opening&&readyLeft>=10)apply();
  yield* waitFor(()=>applied,3);
  // Real resize: a cursor remains attached to the DOM grip for the entire
  // CSS morph, rather than chasing where the element used to be.
  c.press=1;c.shape=i%2?"ew":"arrow";
  let elapsed=0;
  while(!stopped&&elapsed<1.28){
   const p=point();c.x=p.x;c.y=p.y;
   elapsed+=(yield);
  }
  c.press=0;c.ov=null;c.shape="arrow";
  yield* barrier();
  yield* goHome(c);
 }
 function* rightWork(c,i){
  const node=rightNodes[i];
  if(!node){if(!signal.opening){erasedRight++;if(erasedRight===RIGHT.length)apply();}
    yield* barrier();yield* goHome(c);return;}
  const point=track(node,.04,.22);
  if(signal.opening){
   yield* waitFor(()=>applied,3);
   yield* waitLayoutStable();
   yield* upstream.wait(i*.055);
  }else yield* upstream.wait(i*.045);
  if(!signal.opening){
   yield* upstream.moveTo(c,point,{speed:2.8});
   c.ov=()=>outline(node);
   yield* upstream.click(c);
  }
  const entry=textClone(node,entries,originals,parents);
  if(entry){
   if(signal.opening){
    c.shape="cross";
    entry.it.cursor=c;
    // Use the genuine upstream text-box and typing generator.
    yield* upstream.drawText(c,entry.it,null,false);
    removeText(entry);
    node.style.opacity="1";
    host.dataset.typedCount=String((+host.dataset.typedCount||0)+1);
   }else{
    const it=entry.it;
    it.shown=it.total;reveal(it,it.shown);
    let progress=0;
    c.shape="ibeam";
    while(progress<.48){
     progress+=(yield);
     it.shown=Math.max(0,Math.floor(it.total*(1-progress/.48)));
     reveal(it,it.shown);
     const tip=caret(it);
     if(tip){c.x=tip.x;c.y=tip.y;}
    }
    it.shown=0;reveal(it,0);
    removeText(entry);node.style.opacity="0";
   }
  }
  c.ov=null;c.shape="arrow";
  if(!signal.opening){
   erasedRight++;
   if(erasedRight===RIGHT.length)apply();
  }
  yield* barrier();
  yield* goHome(c);
 }
 if(signal.opening){
  // Capture the original style exactly once. It is always restored on end.
  for(const n of rightNodes){
   if(!n||originals.has(n))continue;
   originals.set(n,n.style.opacity);
   n.style.opacity="0";
  }
 }
 for(let i=0;i<agents.length;i++){
  const a=agents[i];
  a.gen=i<LEFT.length?leftWork(a.cursor,i):rightWork(a.cursor,i-LEFT.length);
 }
 function tick(now){
  if(stopped)return;
  const dt=clamp((now-last)/1000,.002,.05);
  last=now;
  upstream.time+=(dt*upstream.tempo);
  const since=(now-start)/1000;
  for(const a of agents){
   if(a.done)continue;
   try{
    if(a.gen.next(dt).done){a.done=true;done++;}
   }catch(error){
    taskErrors++;
    console.error("Swarm animation task error",error);
    a.done=true;done++;
   }
  }
  for(const entry of entries){
   if(entry.removed)continue;
   followText(entry);
   if(entry.it.shown!==entry.it.rshown){
    reveal(entry.it,entry.it.shown);
    entry.it.rshown=entry.it.shown;
    if(entry.it.cursor&&entry.it.editing){
     const tip=caret(entry.it);
     if(tip){entry.it.cursor.x=tip.x;entry.it.cursor.y=tip.y;}
    }
   }
  }
  if(!applied&&since>(signal.opening?1.7:3.2))apply();
  if(applied&&signal.opening&&phase==="moving"&&now-transitionTime>1400)phase="typing";
  if(applied&&!signal.opening)phase="restoring";
  if(worked===agents.length&&done<agents.length)phase="returning";
  host.dataset.phase=phase;
  maxSimultaneousBoxes=Math.max(maxSimultaneousBoxes,agents.filter(a=>!!a.cursor.ov).length);
  const E={vp:view.vp,cursors:agents.map(a=>a.cursor),guides:[],editLines:new Set(),rulers:{t:0}};
  view.render(E);
  for(const el of view.cursorEls.values())el.setAttribute("data-crew-agent","true");
  const expired=since>7.0;
  if(done===agents.length||expired){
   if(expired)host.dataset.timedOut="true";
   completed=!expired;
   host.dataset.completed=String(completed);
   finish();
   return;
  }
  raf=requestAnimationFrame(tick);
 }
 raf=requestAnimationFrame(tick);
 return {dispose:finish};
}
