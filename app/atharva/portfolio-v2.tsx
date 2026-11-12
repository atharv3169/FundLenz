"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, GitBranch, Mail, Menu, Moon, Sun, X } from "lucide-react";
import { stories, learning, interests, type Story, type StoryId } from "./stories-data";
import { EXPLORED_STORIES_CHANGED, readExploredStories } from "./story-views";
import { HeroWave, SceneFigure } from "./scenes";
import { storySpectrum } from "./progress-palette";
import s from "./portfolio-v2.module.css";

const RETURN_KEY="atharva-story-return-v2";
const REVEALS_KEY="atharva-reveals-v2";
type StoredReveals={stories:string[];sections:number[]};
function readReveals():StoredReveals{
 try{
  const saved=JSON.parse(sessionStorage.getItem(REVEALS_KEY)||"{}") as Partial<StoredReveals>;
  return {
   stories:Array.isArray(saved.stories)?saved.stories.filter((v):v is string=>typeof v==="string"):[],
   sections:Array.isArray(saved.sections)?saved.sections.filter((v):v is number=>Number.isInteger(v)&&v>=0):[]
  };
 }catch{return {stories:[],sections:[]};}
}
function rememberPortfolioReturn(id:StoryId){
 try{
  const section=document.getElementById("story-"+id);
  sessionStorage.setItem(RETURN_KEY,JSON.stringify({
   id,top:Math.max(0,window.scrollY),
   offset:section?.getBoundingClientRect().top??0,
   viewport:innerWidth
  }));
 }catch{}
}


function StorySection({story,index,completed}:{story:Story;index:number;completed:boolean}){
 return <section
   id={"story-"+story.id}
   className={s.storySection}
   style={{"--stack":index,"--accent":story.accent,"--previous-accent":stories[index-1]?.accent||story.accent,"--next-accent":stories[index+1]?.accent||story.accent} as CSSProperties}
   data-story={story.id}
   data-expanded="false"
 >
  <div className={s.storyWorkspace} data-entry={index%2?"right":"left"}>
   <div className={s.storyStage} data-role="story-overview">
    {completed&&<span className={s.storyCompletion} data-story-complete={story.id} role="img" aria-label={"Explored: "+story.title} title="Full story explored"><Check size={17} strokeWidth={2.6} aria-hidden="true"/></span>}
    <div className={s.storyCopy}>
     <div className={s.cardFolio}><span>{String(index+1).padStart(2,"0")} / {String(stories.length).padStart(2,"0")}</span><span>{story.year}</span></div>
     <div className={s.storyEyebrow}><span className={s.storyIndex}>{String(index+1).padStart(2,"0")}</span><span>{story.eyebrow}</span></div>
     <p className={s.storyYears}>{story.type}{story.year&&<><i> / </i> {story.year}</>}</p>
     <h3>{story.title}<span>.</span></h3>
     <p className={s.storyHook}>{story.hook}</p>
     <p className={s.storyIntro}>{story.intro}</p>
     <div className={s.paperTags}>{story.tags.slice(0,2).map(tag=><span key={tag}>{tag}</span>)}</div>
     <div className={s.storyActions}>
      <a className={s.storyRead} href={"/atharva/stories/"+story.id} data-story-link={story.id} aria-label={"Read full story: "+story.title} onClick={e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey)rememberPortfolioReturn(story.id);}}>Read full story <ArrowRight size={17}/></a>
      {story.visit&&(story.visit.pending?<span className={s.storyUpcoming} title={"Planned URL: "+story.visit.href}>{story.visit.text} · planned URL</span>:<a className={s.storyVisit} href={story.visit.href} target="_blank" rel="noopener noreferrer">{story.visit.text}<ArrowUpRight size={17}/></a>)}
     </div>
     <div className={s.storyNumbers}>{story.numbers.map((n,i)=><div key={i}><strong>{n.value}</strong><span>{n.label}</span></div>)}</div>
    </div>
    <div className={s.storyIllustration}>
      <SceneFigure id={story.id}/>
      <span className={s.storyFigureWatermark}>{String(index+1).padStart(2,"0")}</span>
    </div>
   </div>

  </div>
 </section>;
}

export default function PortfolioV2(){
 const [navOpen,setNavOpen]=useState(false);
 const [dark,setDark]=useState(false);
 const [exploredStories,setExploredStories]=useState<Set<StoryId>>(()=>new Set());
 useEffect(()=>{
   const refresh=()=>setExploredStories(new Set(readExploredStories()));
   refresh();
   window.addEventListener("pageshow",refresh);
   window.addEventListener("focus",refresh);
   window.addEventListener("storage",refresh);
   window.addEventListener(EXPLORED_STORIES_CHANGED,refresh);
   return()=>{
     window.removeEventListener("pageshow",refresh);
     window.removeEventListener("focus",refresh);
     window.removeEventListener("storage",refresh);
     window.removeEventListener(EXPLORED_STORIES_CHANGED,refresh);
   };
 },[]);
 useEffect(()=>{let frame=0;try{if(localStorage.getItem("atharva-paper")==="dark")frame=requestAnimationFrame(()=>setDark(true));}catch{}return()=>cancelAnimationFrame(frame);},[]);
 const togglePaper=()=>{setDark(!dark);try{localStorage.setItem("atharva-paper",dark?"light":"dark");}catch{}};
 useEffect(()=>{
   let saved:{id:string;top:number;offset:number;viewport:number}|null=null;
   try{
    const raw=sessionStorage.getItem(RETURN_KEY);
    if(raw){const v=JSON.parse(raw);if(v&&typeof v.id==="string"&&Number.isFinite(v.top))saved=v;}
   }catch{}
   const hash=location.hash.startsWith("#paper-")?decodeURIComponent(location.hash.slice(7)):"";
   if(saved&&hash&&saved.id!==hash)saved=null;
   if(!saved&&!hash)return;
   let cancelled=false,first=0,second=0;
   const restore=()=>{
    if(cancelled)return;
    first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
     if(cancelled)return;
     const id=saved?.id||hash,anchor=document.getElementById("paper-"+id);
     if(saved){
      const section=document.getElementById("story-"+id);
      const top=saved.viewport===innerWidth?saved.top:section?
       window.scrollY+section.getBoundingClientRect().top-saved.offset:saved.top;
      window.scrollTo({top:Math.max(0,top),behavior:"instant"});
      try{sessionStorage.removeItem(RETURN_KEY);}catch{}
     }else{
      (anchor||document.getElementById("story-"+id))?.scrollIntoView({behavior:"instant",block:"start"});
     }
    });});
   };
   void document.fonts.ready.then(restore,restore);
   return()=>{cancelled=true;cancelAnimationFrame(first);cancelAnimationFrame(second);};
 },[]);
 const menuRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
   if(!navOpen)return;
   const dismiss=(e:KeyboardEvent)=>{if(e.key==="Escape"){setNavOpen(false);menuRef.current?.focus();}};
   window.addEventListener("keydown",dismiss);return()=>window.removeEventListener("keydown",dismiss);
 },[navOpen]);
 useEffect(()=>{
  const previous=readReveals(),seenStories=new Set(previous.stories),seenSections=new Set(previous.sections);
  const persist=()=>{try{sessionStorage.setItem(REVEALS_KEY,JSON.stringify({stories:[...seenStories],sections:[...seenSections]}));}catch{}};
  const reveals=Array.from(document.querySelectorAll<HTMLElement>("#atharva-portfolio [data-reveal]"));
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{
   if(e.isIntersecting){
    const index=reveals.indexOf(e.target as HTMLElement);
    e.target.setAttribute("data-visible","true");
    observer.unobserve(e.target);
    if(index>=0&&!seenSections.has(index)){seenSections.add(index);persist();}
   }
  }),{rootMargin:"0px 0px -60px 0px",threshold:.06});
  reveals.forEach((node,i)=>{
   if(seenSections.has(i))node.setAttribute("data-visible","true");
   else observer.observe(node);
  });
  const sections=Array.from(document.querySelectorAll<HTMLElement>("#atharva-portfolio [data-story]"));
  const entrants=new IntersectionObserver(entries=>entries.forEach(entry=>{
   if(entry.isIntersecting&&entry.intersectionRatio>=.14){
    entry.target.setAttribute("data-entered","true");
    entrants.unobserve(entry.target);
    const id=entry.target.closest<HTMLElement>("[data-story]")?.dataset.story;
    if(id&&!seenStories.has(id)){seenStories.add(id);persist();}
   }
  }),{threshold:[0,.14]});
  sections.forEach(section=>{
   const pane=section.querySelector<HTMLElement>("[data-entry]"),id=section.dataset.story;
   if(!pane)return;
   if(id&&seenStories.has(id)){
    pane.setAttribute("data-entered","true");
    section.setAttribute("data-revealed-before","true");
   }else{
    if(section.getBoundingClientRect().top>=window.innerHeight)pane.setAttribute("data-pending","true");
    entrants.observe(pane);
   }
  });
  const colors=stories.map(story=>{
    const hex=story.accent.slice(1);
    return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
  });
  const mix=(a:number,b:number,t:number)=>Math.round(a+(b-a)*t);
  const soften=(x:number)=>{const v=Math.max(0,Math.min(1,x));return v*v*(3-2*v);};
  const onScroll=()=>{
    const container=document.getElementById("atharva-portfolio");
    if(!container||!sections.length)return;
    const y=window.scrollY+window.innerHeight*.5;
    const anchors=sections.map(el=>{
      const rect=el.getBoundingClientRect();
      return rect.top+window.scrollY+rect.height*.5;
    });
    let lower=0;
    while(lower<anchors.length-2&&y>anchors[lower+1])lower++;
    const upper=Math.min(lower+1,anchors.length-1);
    const interval=Math.max(1,anchors[upper]-anchors[lower]);
    const t=soften((y-anchors[lower])/interval);
    const color=colors[lower].map((ch,i)=>mix(ch,colors[upper][i],t));
    const start=sections[0].getBoundingClientRect().top+window.scrollY;
    const last=sections[sections.length-1];
    const end=last.getBoundingClientRect().bottom+window.scrollY;
    const alpha=soften((y-start+350)/650)*soften((end-y+350)/650);
    container.style.setProperty("--ambient-rgb",color.join(" "));
    container.style.setProperty("--wash-alpha",alpha.toFixed(3));
  };
  onScroll();window.addEventListener("scroll",onScroll,{passive:true});
  return()=>{observer.disconnect();entrants.disconnect();window.removeEventListener("scroll",onScroll)};
 },[]);
 return <main className={s.portfolioShell} id="atharva-portfolio" data-paper={dark?"dark":"light"}>
  <PaperIntro/>
  <div className={s.ambientWash} aria-hidden="true"/>
  <nav className={s.siteNav} aria-label="Portfolio navigation">
   <a href="#top" className={s.mark} aria-label="Atharva Sahu, back to top">A<span> / </span>S<span>.</span></a>
   <span className={s.navDescriptor}>FINANCE · RESEARCH · MODELLING</span>
   <div className={s.navLinks}><a href="#work">Selected work</a><a href="#skills">Skills & learning</a><a href="#contact">Contact</a><a href="https://fundlenz.com/">Visit FundLenz <ArrowUpRight size={13}/></a></div>
   <a className={s.paperContact} href="#contact">Contact</a>
   <button className={s.paperSwitch} type="button" aria-label="Dark paper" aria-pressed={dark} onClick={togglePaper}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button>
   <ReadingQuote/>
   <button ref={menuRef} className={s.menuToggle} onClick={()=>setNavOpen(v=>!v)} aria-expanded={navOpen} aria-label={navOpen?"Close navigation":"Open navigation"}>{navOpen?<X size={21}/>:<Menu size={21}/>}</button>
   {navOpen&&<div className={s.mobileNav}>{[["Selected work","#work"],["Skills & learning","#skills"],["Contact","#contact"],["Visit FundLenz","https://fundlenz.com/"]].map(([label,href])=><a key={href} href={href} onClick={()=>setNavOpen(false)}>{label}<ArrowUpRight size={17}/></a>)}</div>}
  </nav>
  <section className={s.hero} id="top"><div className={s.heroFigure}><HeroWave/></div><MarketPlate/><div className={s.heroContent}>
    <p className={s.eyebrow}><i/> NAGPUR, INDIA <span>/</span> FINANCE × RESEARCH × TECHNOLOGY</p>
    <h1>Atharva<br/><em>Sahu.</em></h1>
    <p className={s.heroMessage}>I model business decisions and build <em>financial research tools.</em></p>
    <p className={s.heroIntro}>I use the maths and coding I learned in engineering across corporate-finance decisions, investment research and tools I built, including FundLenz, DCF Atlas and Ternwell.</p>
    <svg className={s.paperSignature} data-finance-motif="risk-distribution" viewBox="0 0 300 36" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
     <path d="M15 28H285" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
     <path d="M15 28 C55 28 79 26 100 17 C118 8 132 5 150 5 C168 5 182 8 200 17 C221 26 245 28 285 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
     <path d="M150 6V29" fill="none" stroke="currentColor" strokeOpacity=".33" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke"/>
     <circle cx="150" cy="5" r="2.7" fill="currentColor"/>
    </svg>
    <a className={s.heroLink} href="#work">Explore my work <ArrowRight size={18}/></a>
   </div><div className={s.heroFoot}><span>PORTFOLIO / 2026</span><span>SCROLL DOWN <ArrowDown size={14}/></span></div></section>
   <div className={s.currencyRibbon} aria-hidden="true"><div>{[0,1].map(group=><div className={s.ribbonGroup} key={group}>{[["₹","Cash flow"],["β","Beta"],["$","Markets"],["%","Yield"],["€","Valuation"],["Σ","Research"],["σ","Volatility"],["£","Capital"],["Δ","Change"],["×","Multiples"],["¥","FX"],["ρ","Correlation"],["α","Alpha"],["±","Risk"],["bps","Spreads"],["ƒ","Forecasts"]].map(([symbol,label])=><span key={label}><i>{symbol}</i>{label}</span>)}</div>)}</div></div>
   <section id="about" className={s.about}><div data-reveal><span className={s.sectionTag}>01 / IN SHORT</span><h2>From engineering<br/><em>to finance.</em></h2></div>
    <div className={s.aboutColumns} data-reveal><p>Growing up around a family business, I started putting the maths and coding I learned in engineering to work on financial questions. That interest grew into research, finance internships and building projects of my own, connecting analysis with the tools I enjoy creating.</p><p>Today I study portfolio concentration and build models that others can test. FundLenz, DCF Atlas and Ternwell let a reader change the inputs and see how an investment or financing decision changes.</p></div>
    <div className={s.paperLinks}>
     <a href="https://www.linkedin.com/in/atharvasahu/" target="_blank" rel="noopener noreferrer" aria-label="Connect on LinkedIn"><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.35V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.369-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.12 20.452H3.554V9H7.12v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.978 0 1.778-.773 1.778-1.729V1.729C24 .774 23.2 0 22.222 0z"/></svg><span>Connect on LinkedIn</span></a>
     <a href="https://github.com/atharv3169" target="_blank" rel="noopener noreferrer" aria-label="View my code on GitHub"><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297a12 12 0 0 0-3.793 23.386c.6.111.82-.261.82-.577v-2.234c-3.338.726-4.043-1.416-4.043-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.304-5.467-1.333-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.323 3.301 1.23a11.52 11.52 0 0 1 6.006 0c2.291-1.553 3.297-1.23 3.297-1.23.655 1.652.243 2.873.12 3.176.77.84 1.235 1.91 1.235 3.221 0 4.61-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.216.694.825.576A12.001 12.001 0 0 0 12 .297z"/></svg><span>My code on GitHub</span></a>
    </div>
   </section>
   <section className={s.workIntro} id="work"><span className={s.sectionTag}>02 / THE WORK, UP CLOSE</span><h2>Selected<br/><em>work.</em></h2><p>Explore the decisions, research and models behind each project.</p><div className={s.workCount}>{String(stories.length).padStart(2,"0")} <span>PROJECTS & EXPERIENCES</span></div></section>
   <div className={s.paperDeck} data-paper-deck>{stories.map((story,i)=><div key={story.id} className={s.paperSlot}><span id={"paper-"+story.id} className={s.paperAnchor} style={{"--stack":i} as CSSProperties}/><StorySection story={story} index={i} completed={exploredStories.has(story.id)}/></div>)}</div>
   <PaperIndex exploredStories={exploredStories}/>

   <section id="skills" className={s.skillsSection}><div data-reveal><span className={s.sectionTag}>03 / HOW I WORK</span><h2>Skills &amp;<br/><em>education.</em></h2></div>
    <div className={s.skillsColumns}>{learning.map((group,i)=><div className={s.skillGroup} key={group.title} data-reveal><span>0{i+1}</span><h3>{group.title}</h3><div className={s.skillsText}>{group.skills.map((name,j)=><span key={name}>{name}{j!==group.skills.length-1?<i> / </i>:""}</span>)}</div></div>)}</div>
    <div className={s.educationLine} data-reveal><div><span>EDUCATION</span><strong>B.Tech · Electronics & Telecommunication Engineering</strong><p>St. Vincent Pallotti College of Engineering & Technology, Nagpur · Completed 2026</p></div><div><span>ENGLISH</span><strong>IELTS Academic · 8.0</strong></div></div>
   </section>
   <section className={s.interestsSection}><span className={s.sectionTag}>04 / RESEARCH INTERESTS</span><div>{interests.map((t,i)=><p key={t} data-reveal><span>{String(i+1).padStart(2,"0")}</span>{t}</p>)}</div></section>
   <section id="contact" className={s.contact}><span className={s.sectionTag}>05 / SAY HELLO</span><h2>Get in<br/><em>touch.</em></h2><p>For opportunities in corporate finance, investment research or financial technology, reach me at <strong>atharva@fundlenz.com</strong>.</p><a className={s.emailLink} href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=atharva%40fundlenz.com&amp;su=Hello%20Atharva" target="_blank" rel="noopener noreferrer">Write in Gmail <ArrowUpRight size={24}/></a>
    <div className={s.contactLinks}><a href="mailto:atharva@fundlenz.com?subject=Hello%20Atharva"><Mail size={17}/> Open mail app <ArrowUpRight size={14}/></a><a href="https://www.linkedin.com/in/atharvasahu/" target="_blank" rel="noopener noreferrer">LinkedIn <ArrowUpRight size={14}/></a><a href="https://github.com/atharv3169" target="_blank" rel="noopener noreferrer"><GitBranch size={17}/> GitHub <ArrowUpRight size={14}/></a></div></section>
   <footer className={s.footer}><span>© 2026 ATHARVA SAHU</span><span>NAGPUR, INDIA</span><a href="#top">BACK TO TOP ↑</a></footer>

 </main>;
}


// Illustrative price candles, a moving average and matched trading volume.
function MarketPlate(){
 const closes=[267,252,257,241,228,235,247,223,211,217,193,183,196,174,167,183,158,145,153,128,114,127,109,94];
 const avg=closes.map((_,i)=>closes.slice(Math.max(0,i-4),i+1).reduce((a,b)=>a+b,0)/Math.min(i+1,5)+12);
 const line=avg.map((y,i)=>(i?"L":"M")+(49+i*17.5)+" "+y).join(" ");
 return <svg className={s.marketPlate} viewBox="0 0 500 410" aria-hidden="true" focusable="false">
 {[90,145,200,255,310,354].map(y=><path key={y} d={`M35 ${y}H465`} stroke="#a4c4b6" strokeOpacity=".16" strokeDasharray={y===310?"0":"2 6"}/>)}
 {closes.map((y,i)=>{const x=49+i*17.5,open=(closes[i-1]??280)+(i%3-1)*4,col=y<open?"#aad4bf":"#c8a67b",volume=9+Math.abs(y-open)*.9;return <g key={i} fill={col}><path d={`M${x} ${Math.min(open,y)-7-i%4}V${Math.max(open,y)+6+i%6}`} stroke={col}/><rect x={x-4.3} y={Math.min(y,open)} width="8.6" height={Math.max(2,Math.abs(y-open))} rx=".8"/><rect x={x-4.3} y={354-volume} width="8.6" height={volume} opacity=".42"/></g>})}
 <path className={s.goldTrace} d={line} pathLength="100" fill="none" stroke="#d8b781" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round"/>
 </svg>;
}

function PaperIndex({exploredStories}:{exploredStories:Set<StoryId>}){
 const [active,setActive]=useState(0);
 const box=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  let raf=0;
  const read=()=>{
   raf=0;
   let current=0;
   stories.forEach((story,i)=>{
    const anchor=document.getElementById("paper-"+story.id);
    if(anchor&&anchor.getBoundingClientRect().top<innerHeight*.36)current=i;
   });
   setActive(current);
  };
  const update=()=>{if(!raf)raf=requestAnimationFrame(read);};
  update();window.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update);
  return()=>{window.removeEventListener("scroll",update);window.removeEventListener("resize",update);cancelAnimationFrame(raf);};
 },[]);
 return <div className={s.paperIndex}>
  <button type="button" aria-haspopup="dialog" aria-label="All stories" onClick={()=>box.current?.showModal()}>
   <b>{String(active+1).padStart(2,"0")}</b> All stories
  </button>
  <dialog ref={box} aria-label="All stories" onClick={e=>{if(e.target===box.current)box.current.close();}}>
   <div>
    <header>All stories <button type="button" onClick={()=>box.current?.close()} aria-label="Close story index">×</button></header>
    {stories.map((story,i)=>{
     const explored=exploredStories.has(story.id);
     return <a key={story.id} href={"#paper-"+story.id} data-story-index={story.id} data-index-explored={explored?"true":"false"}
       style={{"--index-accent":story.accent} as CSSProperties}
       aria-label={story.title+(explored?" — explored":"")} aria-current={active===i?"location":undefined}
       onClick={()=>box.current?.close()}>
       <small>{String(i+1).padStart(2,"0")}</small>
       <span className={s.paperIndexTitle}>{story.title}</span>
     </a>;
    })}
   </div>
  </dialog>
 </div>;
}

function PaperIntro(){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
   if(!matchMedia("(max-width:767px) and (prefers-reduced-motion:no-preference)").matches||location.hash)return;
   try{if(sessionStorage.getItem("atharva-paper-intro"))return;sessionStorage.setItem("atharva-paper-intro","1");}catch{}
   const start=requestAnimationFrame(()=>setVisible(true)),end=setTimeout(()=>setVisible(false),1650);
   return()=>{cancelAnimationFrame(start);clearTimeout(end);};
 },[]);
 return visible?<div className={s.paperIntro}><span>ATHARVA SAHU · PORTFOLIO</span>
 <svg viewBox="0 0 240 160" aria-hidden="true">{["#965947","#cd983a","#427667","#466d8a"].map((c,i)=><path key={c} transform={`translate(${i*3},${i*2})`} d="M24 129 Q38 83 68 30 Q78 7 84 38 L109 123 M47 89 Q73 77 96 80 M192 46 C144 18 108 79 156 82 S193 145 127 125" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" pathLength="1"/>)}</svg>
 <button onClick={()=>setVisible(false)}>Skip intro →</button></div>:null;
}

function ReadingQuote(){
 const meter=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=meter.current,root=document.getElementById("atharva-portfolio");if(!el||!root)return;
  const deck=root.querySelector<HTMLElement>("[data-paper-deck]");
  if(!deck)return;
  const segments=stories.map(story=>({story,anchor:document.getElementById("paper-"+story.id)}));
  let frame=0;
  const update=()=>{
   frame=0;
   const clamp=(n:number)=>Math.max(0,Math.min(1,n));
   const page=clamp(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight));
   const stops=segments.map(s=>{
     const card=document.getElementById("story-"+s.story.id);
     const anchor=s.anchor&&getComputedStyle(s.anchor).display!=="none"?s.anchor:card;
     return anchor?.getBoundingClientRect().top??Infinity;
   }),end=deck.getBoundingClientRect().bottom,focus=innerHeight*.56;
   let accent="";
   segments.forEach(({story},i)=>{
    const a=stops[i],b=stops[i+1]??end;
    if(focus>=a&&focus<b)accent=story.accent;
   });
   const topOfDeck=deck.getBoundingClientRect().top,bottomOfDeck=deck.getBoundingClientRect().bottom;
   const activeIndex=segments.findIndex((segment,i)=>focus>=stops[i]&&focus<(stops[i+1]??end));
   const current=activeIndex>=0?stories[activeIndex]:null;
   if(!accent&&topOfDeck<=focus)accent=stories[stories.length-1].accent;
   el.style.setProperty("--page",String(page));
   el.style.setProperty("--page-unread",((1-page)*100).toFixed(3)+"%");
   el.style.setProperty("--story-ink",accent||stories[0].accent);
   el.setAttribute("aria-valuenow",String(Math.round(page*100)));
   el.setAttribute("aria-valuetext",(current?.title||"Portfolio")+" · "+Math.round(page*100)+"%");
   root.dataset.activeStory=current?.id||(topOfDeck>focus?"intro":bottomOfDeck<focus?"complete":"intro");
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const size=new ResizeObserver(schedule);size.observe(root);size.observe(deck);

  window.addEventListener("scroll",schedule,{passive:true});window.addEventListener("resize",schedule);schedule();
  return()=>{size.disconnect();cancelAnimationFrame(frame);window.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);};
 },[]);
 return <div ref={meter} className={s.readingQuote} role="progressbar" aria-label="Whole page progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} style={{"--story-spectrum":storySpectrum} as CSSProperties}><i/><b aria-hidden="true"/></div>;
}
