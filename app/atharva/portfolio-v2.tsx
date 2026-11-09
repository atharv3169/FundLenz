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
   style={{"--accent":story.accent,"--previous-accent":stories[index-1]?.accent||story.accent,"--next-accent":stories[index+1]?.accent||story.accent} as CSSProperties}
   data-story={story.id}
   data-expanded={open}
 >
  <div className={s.storyWorkspace}>
   <div className={s.storyStage} data-reveal data-role="story-overview">
    <div className={s.storyCopy}>
     <div className={s.storyEyebrow}><span className={s.storyIndex}>{String(index+1).padStart(2,"0")}</span><span>{story.eyebrow}</span></div>
     <p className={s.storyYears}>{story.type}{story.year&&<><i> / </i> {story.year}</>}</p>
     <h3>{story.title}<span>.</span></h3>
     <p className={s.storyHook}>{story.hook}</p>
     <p className={s.storyIntro}>{story.intro}</p>
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
  return()=>{observer.disconnect();window.removeEventListener("scroll",onScroll)};
 },[]);
 return <main className={s.portfolioShell} id="atharva-portfolio">
  <div className={s.ambientWash} aria-hidden="true"/>
  <div className={s.progressBar} style={{transform:"scaleX("+progress/100+")"}} aria-hidden="true"/>
  <nav className={s.siteNav} aria-label="Portfolio navigation">
   <a href="#top" className={s.mark} aria-label="Atharva Sahu, back to top">A<span> / </span>S<span>.</span></a>
   <span className={s.navDescriptor}>FINANCE · RESEARCH · MODELLING</span>
   <div className={s.navLinks}><a href="#work">Selected work</a><a href="#skills">Skills & learning</a><a href="#contact">Contact</a><a href="/">Visit FundLenz <ArrowUpRight size={13}/></a></div>
   <button ref={menuRef} className={s.menuToggle} onClick={()=>setNavOpen(v=>!v)} aria-expanded={navOpen} aria-label={navOpen?"Close navigation":"Open navigation"}>{navOpen?<X size={21}/>:<Menu size={21}/>}</button>
   {navOpen&&<div className={s.mobileNav}>{[["Selected work","#work"],["Skills & learning","#skills"],["Contact","#contact"],["Visit FundLenz","/"]].map(([label,href])=><a key={href} href={href} onClick={()=>setNavOpen(false)}>{label}<ArrowUpRight size={17}/></a>)}</div>}
  </nav>
  <section className={s.hero} id="top"><div className={s.heroFigure}><HeroWave/></div><Orrery/><div className={s.heroContent}>
    <p className={s.eyebrow}><i/> NAGPUR, INDIA <span>/</span> FINANCE × RESEARCH × TECHNOLOGY</p>
    <h1>Atharva<br/><em>Sahu.</em></h1>
    <p className={s.heroMessage}>I model business decisions and build <em>financial research tools.</em></p>
    <p className={s.heroIntro}>My work spans equipment financing at Shyam Construction, mutual-fund liquidity research and the FundLenz platform.</p>
    <a className={s.heroLink} href="#work">Explore my work <ArrowRight size={18}/></a>
   </div><div className={s.heroFoot}><span>PORTFOLIO / 2026</span><span>SCROLL DOWN <ArrowDown size={14}/></span></div></section>
   <div className={s.currencyRibbon} aria-hidden="true"><div>{[0,1].map(group=><div className={s.ribbonGroup} key={group}>{["Cash flow","Markets","Valuation","Research","Risk","Building"].map((label,i)=><span key={label}><i>{["₹","$","€","Σ","£","Δ"][i]}</i>{label}</span>)}</div>)}</div></div>
   <section id="about" className={s.about}><div data-reveal><span className={s.sectionTag}>01 / IN SHORT</span><h2>From engineering<br/><em>to finance.</em></h2></div>
    <div className={s.aboutColumns} data-reveal><p>At Shyam Construction, I assessed whether equipment would earn enough to cover its loan repayments. That question drew me from engineering into capital budgeting and cash-flow analysis.</p><p>Today I study portfolio concentration and build models that others can test. FundLenz, DCF Atlas and Ternwell let a reader change the inputs and see how an investment or financing decision changes.</p></div>
   </section>
   <section className={s.workIntro} id="work"><span className={s.sectionTag}>02 / THE WORK, UP CLOSE</span><h2>Selected<br/><em>work.</em></h2><p>Explore the decisions, research and models behind each project.</p><div className={s.workCount}>{String(stories.length).padStart(2,"0")} <span>PROJECTS & EXPERIENCES</span></div></section>
   {stories.map((story,i)=><StorySection key={story.id} story={story} index={i}/>)}

   <section id="skills" className={s.skillsSection}><div data-reveal><span className={s.sectionTag}>03 / HOW I WORK</span><h2>Skills &amp;<br/><em>education.</em></h2></div>
    <div className={s.skillsColumns}>{learning.map((group,i)=><div className={s.skillGroup} key={group.title} data-reveal><span>0{i+1}</span><h3>{group.title}</h3><div className={s.skillsText}>{group.skills.map((name,j)=><span key={name}>{name}{j!==group.skills.length-1?<i> / </i>:""}</span>)}</div></div>)}</div>
    <div className={s.educationLine} data-reveal><div><span>EDUCATION</span><strong>B.Tech · Electronics & Telecommunication Engineering</strong><p>St. Vincent Pallotti College of Engineering & Technology, Nagpur · Completed 2026</p></div><div><span>ENGLISH</span><strong>IELTS Academic · 8.0</strong></div></div>
   </section>
   <section className={s.interestsSection}><span className={s.sectionTag}>04 / RESEARCH INTERESTS</span><div>{interests.map((t,i)=><p key={t} data-reveal><span>{String(i+1).padStart(2,"0")}</span>{t}</p>)}</div></section>
   <section id="contact" className={s.contact}><span className={s.sectionTag}>05 / SAY HELLO</span><h2>Get in<br/><em>touch.</em></h2><p>For opportunities in corporate finance, investment research or financial technology, email me directly.</p><a className={s.emailLink} href="mailto:atharva@fundlenz.com?subject=Hello%20Atharva">Let&apos;s talk <ArrowUpRight size={24}/></a>
    <div className={s.contactLinks}><a href="mailto:atharva@fundlenz.com"><Mail size={17}/> Email <ArrowUpRight size={14}/></a><a href="https://www.linkedin.com/in/atharvasahu/" target="_blank" rel="noopener noreferrer">LinkedIn <ArrowUpRight size={14}/></a><a href="https://github.com/atharv3169" target="_blank" rel="noopener noreferrer"><GitBranch size={17}/> GitHub <ArrowUpRight size={14}/></a></div></section>
   <footer className={s.footer}><span>© 2026 ATHARVA SAHU</span><span>NAGPUR, INDIA</span><a href="#top">BACK TO TOP ↑</a></footer>

 </main>;
}


// An engraved orbital instrument: fixed graduations frame independently moving rings.
function Orrery(){
 return <svg className={s.orrery} viewBox="0 0 500 500" aria-hidden="true" focusable="false">
 <defs><radialGradient id="orreryLight"><stop stopColor="#8dc9af" stopOpacity=".19"/><stop offset="1" stopColor="#8dc9af" stopOpacity="0"/></radialGradient><linearGradient id="orreryMetal" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#527d75"/><stop offset=".5" stopColor="#d5dec3"/><stop offset="1" stopColor="#48615f"/></linearGradient></defs>
 <circle cx="250" cy="250" r="235" fill="url(#orreryLight)"/>
 <g transform="translate(250 250)" fill="none"><circle r="213" stroke="#799b8e" opacity=".32"/><circle r="201" stroke="#657f75" strokeDasharray="1 8"/>
 {Array.from({length:72},(_,i)=><path key={i} transform={`rotate(${i*5})`} d={i%6===0?"M0 -211v-10":"M0 -212v-4"} stroke={i%6===0?"#bba780":"#55706b"}/>)}
 <g className={s.meridians}>{Array.from({length:15},(_,i)=><ellipse key={i} rx="147" ry="52" transform={`rotate(${i*12})`} stroke="url(#orreryMetal)" opacity=".56"/>)}</g>
 <g className={s.orbit}><g transform="rotate(-34)"><ellipse rx="187" ry="87" stroke="#d2b681"/><circle cx="187" r="5" fill="#ead1a5"/><circle cx="-187" r="3" fill="#d2b681"/></g></g>
 <circle r="7" fill="#d0e7d6"/><circle r="15" stroke="#b9d7bd" opacity=".45"/></g></svg>;
}
