"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, GitBranch, Mail, Menu, X } from "lucide-react";
import { stories, learning, interests, type Story } from "./stories-data";
import { HeroWave, SceneFigure } from "./scenes";
import { MiniTools } from "./mini-tools";
import s from "./portfolio-v2.module.css";

function StorySection({story,index}:{story:Story;index:number}){
 const [open,setOpen]=useState(false);
 const sectionRef=useRef<HTMLElement>(null);
 const toggleRef=useRef<HTMLButtonElement>(null);
 const scrollRaf=useRef<number|null>(null);
 const hasDemo=["fundlenz","fincalc","dcf","study"].includes(story.id);
 const changeMode=(next:boolean)=>{
   if(scrollRaf.current!==null){
     cancelAnimationFrame(scrollRaf.current);
     scrollRaf.current=null;
   }
   if(window.matchMedia("(max-width:767px)").matches){
     setOpen(next);
     scrollRaf.current=requestAnimationFrame(()=>{
       scrollRaf.current=null;
       (next?sectionRef.current:document.getElementById("paper-"+story.id))?.scrollIntoView({behavior:"instant",block:"start"});
       if(!next)toggleRef.current?.focus({preventScroll:true});
     });
     return;
   }
   if(next){
     sectionRef.current?.scrollIntoView({behavior:"instant",block:"start"});
     setOpen(true);
     return;
   }
   const top=sectionRef.current?.getBoundingClientRect().top??0;
   const close=()=>{
     scrollRaf.current=null;
     setOpen(false);
     toggleRef.current?.focus({preventScroll:true});
   };
   if(Math.abs(top-76)<80||window.matchMedia("(prefers-reduced-motion: reduce)").matches){
     close();
     return;
   }
   sectionRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
   let previous=Number.NaN,steady=0;
   const started=performance.now();
   const check=()=>{
     const current=sectionRef.current?.getBoundingClientRect().top??0;
     steady=Number.isFinite(previous)&&Math.abs(current-previous)<.7?steady+1:0;
     previous=current;
     if(steady>=5||performance.now()-started>1800)close();
     else scrollRaf.current=requestAnimationFrame(check);
   };
   scrollRaf.current=requestAnimationFrame(check);
 };
 useEffect(()=>()=>{if(scrollRaf.current!==null)cancelAnimationFrame(scrollRaf.current);},[]);
 useEffect(()=>{
   if(!open)return;
   const onKey=(event:KeyboardEvent)=>{
     if(event.key!=="Escape")return;
     event.preventDefault();
     changeMode(false);
   };
   window.addEventListener("keydown",onKey);
   return()=>window.removeEventListener("keydown",onKey);
 },[open]);
 return <section
   ref={sectionRef}
   id={"story-"+story.id}
   className={s.storySection+(open?" "+s.storyIsOpen:"")}
   style={{"--stack":Math.min(index,4),"--accent":story.accent,"--previous-accent":stories[index-1]?.accent||story.accent,"--next-accent":stories[index+1]?.accent||story.accent} as CSSProperties}
   data-story={story.id}
   data-expanded={open}
 >
  <div className={s.storyWorkspace} data-entry={index%2?"right":"left"}>
   <div className={s.storyStage} data-role="story-overview">
    <div className={s.storyCopy}>
     <div className={s.cardFolio}><span>{String(index+1).padStart(2,"0")} / {String(stories.length).padStart(2,"0")}</span><span>{story.year}</span></div>
     <div className={s.storyEyebrow}><span className={s.storyIndex}>{String(index+1).padStart(2,"0")}</span><span>{story.eyebrow}</span></div>
     <p className={s.storyYears}>{story.type}{story.year&&<><i> / </i> {story.year}</>}</p>
     <h3>{story.title}<span>.</span></h3>
     <p className={s.storyHook}>{story.hook}</p>
     <p className={s.storyIntro}>{story.intro}</p>
     <div className={s.paperTags}>{story.tags.slice(0,2).map(tag=><span key={tag}>{tag}</span>)}</div>
     <div className={s.storyActions}>
      <button
       ref={toggleRef}
       type="button"
       className={s.storyRead}
       aria-expanded={open}
       aria-controls={"full-"+story.id}
       onClick={()=>changeMode(!open)}
      >
       {open?"Back to overview":"Read full story"}
       {open?<ArrowLeft size={17}/>:<ArrowRight size={17}/>}
      </button>
      {story.visit&&(story.visit.pending?<span className={s.storyUpcoming} title={"Planned URL: "+story.visit.href}>{story.visit.text} · planned URL</span>:<a className={s.storyVisit} href={story.visit.href} target="_blank" rel="noopener noreferrer">{story.visit.text}<ArrowUpRight size={17}/></a>)}
     </div>
     <div className={s.storyNumbers}>{story.numbers.map((n,i)=><div key={i}><strong>{n.value}</strong><span>{n.label}</span></div>)}</div>
    </div>
    <div className={s.storyIllustration}>
      <SceneFigure id={story.id}/>
      <span className={s.storyFigureWatermark}>{String(index+1).padStart(2,"0")}</span>
    </div>
   </div>

   <div
     id={"full-"+story.id}
     className={s.longStory}
     data-role="story-reader"
     role="region"
     aria-label={story.title+" full story"}
     aria-hidden={!open}
     inert={!open}
   >
    <div className={s.storyPanelBody}>
     <div className={s.longStoryLead}>
      <span className={s.sectionTag}>CASE NOTES / {String(index+1).padStart(2,"0")}</span>
      <h4>Project <em>brief.</em></h4>
      <dl className={s.paperMetrics}>{story.numbers.map(n=><div key={n.label}><dt>{n.label}</dt><dd>{n.value}</dd></div>)}</dl>
      <p>{story.intro}</p>
     </div>
     <div className={s.storyChapterList}>
      {story.chapters.map((chapter,i)=><article key={chapter.title} className={s.chapter}>
       <span>{String(i+1).padStart(2,"0")}</span>
       <div><h5>{chapter.title}</h5>{chapter.paragraphs.map((p,j)=><p key={j}>{p}</p>)}</div>
      </article>)}
     </div>
     {hasDemo&&<div className={s.miniStage}>
      <div className={s.miniHead}><span className={s.sectionTag}>TRY IT YOURSELF / INTERACTIVE</span><p>{story.id==="study"?"A small recreation of the study companion.":"Change the inputs and explore a working miniature of the idea."}</p></div>
      <MiniTools id={story.id}/>
     </div>}
     <div className={s.tagsLine}><span>WHAT IT INVOLVED</span><div>{story.tags.map(tag=><span key={tag}>{tag}</span>)}</div></div>
     {story.visit&&!story.visit.pending&&<div className={s.readerFooter}>
      <a href={story.visit.href} target="_blank" rel="noopener noreferrer">Visit {story.title} <ArrowUpRight size={17}/></a>
     </div>}
    </div>
   </div>
  </div>
 </section>;
}

export default function PortfolioV2(){
 const [navOpen,setNavOpen]=useState(false);
 const menuRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
   if(!navOpen)return;
   const dismiss=(e:KeyboardEvent)=>{if(e.key==="Escape"){setNavOpen(false);menuRef.current?.focus();}};
   window.addEventListener("keydown",dismiss);return()=>window.removeEventListener("keydown",dismiss);
 },[navOpen]);
 const [progress,setProgress]=useState(0);
 useEffect(()=>{
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.setAttribute("data-visible","true");observer.unobserve(e.target)}}),{rootMargin:"0px 0px -60px 0px",threshold:.06});
  document.querySelectorAll("#atharva-portfolio [data-reveal]").forEach(el=>observer.observe(el));
  const sections=Array.from(document.querySelectorAll<HTMLElement>("#atharva-portfolio [data-story]"));
  const entrants=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.setAttribute("data-entered","true");entrants.unobserve(entry.target);}
  }),{threshold:0});
  sections.forEach(section=>{const pane=section.querySelector("[data-entry]");if(pane){if(section.getBoundingClientRect().top>=window.innerHeight)pane.setAttribute("data-pending","true");entrants.observe(pane);}});
  const colors=stories.map(story=>{
    const hex=story.accent.slice(1);
    return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
  });
  const mix=(a:number,b:number,t:number)=>Math.round(a+(b-a)*t);
  const soften=(x:number)=>{const v=Math.max(0,Math.min(1,x));return v*v*(3-2*v);};
  const onScroll=()=>{
    const max=document.documentElement.scrollHeight-window.innerHeight;
    setProgress(max>0?window.scrollY/max*100:0);
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
 return <main className={s.portfolioShell} id="atharva-portfolio">
  <PaperIntro/>
  <div className={s.ambientWash} aria-hidden="true"/>
  <div className={s.progressBar} style={{transform:"scaleX("+progress/100+")"}} aria-hidden="true"/>
  <nav className={s.siteNav} aria-label="Portfolio navigation">
   <a href="#top" className={s.mark} aria-label="Atharva Sahu, back to top">A<span> / </span>S<span>.</span></a>
   <span className={s.navDescriptor}>FINANCE · RESEARCH · MODELLING</span>
   <div className={s.navLinks}><a href="#work">Selected work</a><a href="#skills">Skills & learning</a><a href="#contact">Contact</a><a href="https://fundlenz.com/">Visit FundLenz <ArrowUpRight size={13}/></a></div>
   <a className={s.paperContact} href="#contact">Contact</a>
   <button ref={menuRef} className={s.menuToggle} onClick={()=>setNavOpen(v=>!v)} aria-expanded={navOpen} aria-label={navOpen?"Close navigation":"Open navigation"}>{navOpen?<X size={21}/>:<Menu size={21}/>}</button>
   {navOpen&&<div className={s.mobileNav}>{[["Selected work","#work"],["Skills & learning","#skills"],["Contact","#contact"],["Visit FundLenz","https://fundlenz.com/"]].map(([label,href])=><a key={href} href={href} onClick={()=>setNavOpen(false)}>{label}<ArrowUpRight size={17}/></a>)}</div>}
  </nav>
  <section className={s.hero} id="top"><div className={s.heroFigure}><HeroWave/></div><MarketPlate/><div className={s.heroContent}>
    <p className={s.eyebrow}><i/> NAGPUR, INDIA <span>/</span> FINANCE × RESEARCH × TECHNOLOGY</p>
    <h1>Atharva<br/><em>Sahu.</em></h1>
    <p className={s.heroMessage}>I model business decisions and build <em>financial research tools.</em></p>
    <p className={s.heroIntro}>My work spans equipment financing at Shyam Construction, mutual-fund liquidity research and the FundLenz platform.</p>
    <a className={s.heroLink} href="#work">Explore my work <ArrowRight size={18}/></a>
   </div><div className={s.heroFoot}><span>PORTFOLIO / 2026</span><span>SCROLL DOWN <ArrowDown size={14}/></span></div></section>
   <div className={s.currencyRibbon} aria-hidden="true"><div>{[0,1].map(group=><div className={s.ribbonGroup} key={group}>{[["₹","Cash flow"],["β","Beta"],["$","Markets"],["%","Yield"],["€","Valuation"],["Σ","Research"],["σ","Volatility"],["£","Capital"],["Δ","Change"],["×","Multiples"],["¥","FX"],["ρ","Correlation"],["α","Alpha"],["±","Risk"],["bps","Spreads"],["ƒ","Forecasts"]].map(([symbol,label])=><span key={label}><i>{symbol}</i>{label}</span>)}</div>)}</div></div>
   <section id="about" className={s.about}><div data-reveal><span className={s.sectionTag}>01 / IN SHORT</span><h2>From engineering<br/><em>to finance.</em></h2></div>
    <div className={s.aboutColumns} data-reveal><p>At Shyam Construction, I assessed whether equipment would earn enough to cover its loan repayments. That question drew me from engineering into capital budgeting and cash-flow analysis.</p><p>Today I study portfolio concentration and build models that others can test. FundLenz, DCF Atlas and Ternwell let a reader change the inputs and see how an investment or financing decision changes.</p></div>
    <div className={s.paperLinks}><a href="https://www.linkedin.com/in/atharvasahu/">Connect on LinkedIn ↗</a><a href="https://github.com/atharv3169">My code on GitHub ↗</a><a href="#work" aria-label="Scroll to projects">↓</a></div>
   </section>
   <section className={s.workIntro} id="work"><span className={s.sectionTag}>02 / THE WORK, UP CLOSE</span><h2>Selected<br/><em>work.</em></h2><p>Explore the decisions, research and models behind each project.</p><div className={s.workCount}>{String(stories.length).padStart(2,"0")} <span>PROJECTS & EXPERIENCES</span></div></section>
   <div className={s.paperDeck}>{stories.map((story,i)=><div key={story.id} className={s.paperSlot}><span id={"paper-"+story.id} className={s.paperAnchor} style={{"--stack":Math.min(i,4)} as CSSProperties}/><StorySection story={story} index={i}/></div>)}</div>
   <PaperIndex/>

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

function PaperIndex(){
 const [active,setActive]=useState(0);
 const box=useRef<HTMLDialogElement>(null);
 const items=[{id:"top",title:"Introduction"},{id:"work",title:"Selected work"},...stories.map(v=>({id:"paper-"+v.id,title:v.title})),{id:"skills",title:"Skills & education"},{id:"contact",title:"Contact"}];
 useEffect(()=>{
  const mq=matchMedia("(max-width:767px)");
  let raf=0;
  const read=()=>{raf=0;if(!mq.matches){box.current?.close();return;}const anchors=["top","work",...stories.map(s=>"paper-"+s.id),"skills","contact"];let current=0;anchors.forEach((id,i)=>{const node=document.getElementById(id);if(node&&node.getBoundingClientRect().top<innerHeight*.36)current=i;});setActive(current);};
  const update=()=>{if(!raf)raf=requestAnimationFrame(read);};update();window.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update);
  return()=>{window.removeEventListener("scroll",update);window.removeEventListener("resize",update);cancelAnimationFrame(raf);};
 },[]);
 return <div className={s.paperIndex}><button type="button" aria-haspopup="dialog" onClick={()=>box.current?.showModal()}><b>{String(active+1).padStart(2,"0")}</b> All projects</button><dialog ref={box} aria-label="Portfolio index" onClick={e=>{if(e.target===box.current)box.current.close();}}><div><header>Portfolio index <button type="button" onClick={()=>box.current?.close()} aria-label="Close index">×</button></header>{items.map((it,i)=><a key={it.id} href={"#"+it.id} aria-current={active===i?"location":undefined} onClick={()=>box.current?.close()}><small>{String(i+1).padStart(2,"0")}</small>{it.title}</a>)}</div></dialog></div>;
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
