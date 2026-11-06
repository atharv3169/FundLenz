"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, GitBranch, Mail, Menu, X } from "lucide-react";
import { stories, learning, interests, type Story } from "./stories-data";
import { HeroWave, SceneFigure } from "./scenes";
import { MiniTools } from "./mini-tools";
import CursorCrew, { type MorphSignal } from "./cursor-crew";
import s from "./portfolio-v2.module.css";

function StorySection({story,index,onMorph}:{story:Story;index:number;onMorph:(change:Omit<MorphSignal,"sequence">)=>void}){
 const [open,setOpen]=useState(false);
 const [choreography,setChoreography]=useState<"idle"|"entering"|"exiting">("idle");
 const phaseRef=useRef<"idle"|"entering"|"exiting">("idle");
 const scheduled=useRef<ReturnType<typeof setTimeout>[]>([]);
 const sectionRef=useRef<HTMLElement>(null);
 const toggleRef=useRef<HTMLButtonElement>(null);
 const hasDemo=["fundlenz","fincalc","dcf","study"].includes(story.id);

 const eligible=()=>window.matchMedia("(min-width: 1024px)").matches&&
   !window.matchMedia("(pointer: coarse)").matches&&
   !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

 const changeMode=(next:boolean,pointer?:{x:number;y:number})=>{
   if(phaseRef.current!=="idle")return;
   // When closing from deeper in a story, move back to its beginning
   // while the cursor crew dismantles the right-hand text. Do not jump.
   sectionRef.current?.scrollIntoView({
     behavior:next||!eligible()?"instant":"smooth",
     block:"start"
   });
   if(!eligible()){
     setOpen(next);
     if(!next)toggleRef.current?.focus({preventScroll:true});
     return;
   }
   const button=toggleRef.current?.getBoundingClientRect();
   phaseRef.current=next?"entering":"exiting";
   setChoreography(phaseRef.current);
   onMorph({
     storyId:story.id,opening:next,
     originX:pointer&&pointer.x>0?pointer.x:button?button.left+button.width/2:window.innerWidth/2,
     originY:pointer&&pointer.y>0?pointer.y:button?button.top+button.height/2:window.innerHeight/2
   });
   // Match the reference's order: agents reach and select elements before
   // their real DOM geometry changes. On close, right-hand text is erased
   // before the overview is restored.
   scheduled.current.push(setTimeout(()=>{
     setOpen(next);
     if(!next)toggleRef.current?.focus({preventScroll:true});
   },next?320:820));
   scheduled.current.push(setTimeout(()=>{
     phaseRef.current="idle";
     setChoreography("idle");
   },2530));
 };

 useEffect(()=>()=>{scheduled.current.forEach(clearTimeout);},[]);
 useEffect(()=>{
   if(!open)return;
   const onKey=(event:KeyboardEvent)=>{
     if(event.key!=="Escape")return;
     event.preventDefault();
     changeMode(false);
   };
   window.addEventListener("keydown",onKey);
   return()=>window.removeEventListener("keydown",onKey);
 // Event handler is intentionally bound per expanded-state change.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open]);
 return <section
   ref={sectionRef}
   id={"story-"+story.id}
   className={s.storySection+(open?" "+s.storyIsOpen:"")}
   style={{"--accent":story.accent,"--previous-accent":stories[index-1]?.accent||story.accent,"--next-accent":stories[index+1]?.accent||story.accent} as CSSProperties}
   data-story={story.id}
   data-expanded={open}
   data-choreography={choreography}
 >
  <div className={s.storyWorkspace}>
   <div className={s.storyStage} data-reveal data-role="story-overview">
    <div className={s.storyCopy} data-crew-target="copy">
     <div className={s.storyEyebrow}><span className={s.storyIndex}>{String(index+1).padStart(2,"0")}</span><span>{story.eyebrow}</span></div>
     <p className={s.storyYears}>{story.type}{story.year&&<><i> / </i> {story.year}</>}</p>
     <h3 data-crew-target="title">{story.title}<span>.</span></h3>
     <p className={s.storyHook}>{story.hook}</p>
     <p className={s.storyIntro}>{story.intro}</p>
     <div className={s.storyActions}>
      <button
       ref={toggleRef}
       type="button"
       className={s.storyRead}
       aria-expanded={open}
       aria-controls={"full-"+story.id}
       onClick={event=>changeMode(!open,{x:event.clientX,y:event.clientY})}
      >
       {open?"Back to overview":"Read full story"}
       {open?<ArrowLeft size={17}/>:<ArrowRight size={17}/>}
      </button>
      {story.visit&&(story.visit.pending?<span className={s.storyUpcoming} title={"Planned URL: "+story.visit.href}>{story.visit.text} · planned URL</span>:<a className={s.storyVisit} href={story.visit.href} target="_blank" rel="noopener noreferrer">{story.visit.text}<ArrowUpRight size={17}/></a>)}
     </div>
     <div className={s.storyNumbers} data-crew-target="metrics">{story.numbers.map((n,i)=><div key={i}><strong>{n.value}</strong><span>{n.label}</span></div>)}</div>
    </div>
    <div className={s.storyIllustration} data-crew-target="figure">
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
     <div className={s.longStoryLead} data-crew-target="lead">
      <span className={s.sectionTag}>THE DEEPER STORY / {String(index+1).padStart(2,"0")}</span>
      <h4 data-crew-target="heading">Behind <em>the work.</em></h4>
      <p data-crew-target="reader-intro">{story.intro}</p>
     </div>
     <div className={s.storyChapterList}>
      {story.chapters.map((chapter,i)=><article key={chapter.title} className={s.chapter} data-crew-target={i===0?"chapter":i===1?"chapter-two":undefined}>
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
 const [progress,setProgress]=useState(0);
 const [morph,setMorph]=useState<MorphSignal|null>(null);
 const count=useRef(0);
 const notifyMorph=(change:Omit<MorphSignal,"sequence">)=>setMorph({...change,sequence:++count.current});
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
  <CursorCrew signal={morph}/>
  <div className={s.progressBar} style={{transform:"scaleX("+progress/100+")"}} aria-hidden="true"/>
  <nav className={s.siteNav} aria-label="Portfolio navigation">
   <a href="#top" className={s.mark} aria-label="Atharva Sahu, back to top">A<span> / </span>S<span>.</span></a>
   <span className={s.navDescriptor}>FINANCE · RESEARCH · THINGS I BUILD</span>
   <div className={s.navLinks}><a href="#about">About</a><a href="#work">Selected work</a><a href="#skills">Skills & learning</a><a href="#contact">Contact <ArrowUpRight size={13}/></a></div>
   <button className={s.menuToggle} onClick={()=>setNavOpen(v=>!v)} aria-expanded={navOpen} aria-label={navOpen?"Close navigation":"Open navigation"}>{navOpen?<X size={21}/>:<Menu size={21}/>}</button>
   {navOpen&&<div className={s.mobileNav}>{[["About","#about"],["Selected work","#work"],["Skills & learning","#skills"],["Contact","#contact"]].map(([label,href])=><a key={href} href={href} onClick={()=>setNavOpen(false)}>{label}<ArrowUpRight size={17}/></a>)}</div>}
  </nav>
  <section className={s.hero} id="top"><div className={s.heroFigure}><HeroWave/></div><div className={s.heroContent}>
    <p className={s.eyebrow}><i/> NAGPUR, INDIA <span>/</span> FINANCE × RESEARCH × TECHNOLOGY</p>
    <h1>Hey, I&apos;m<br/><em>Atharva.</em></h1>
    <p className={s.heroMessage}>I started with machines. Then I got curious about <em>the numbers behind them.</em></p>
    <p className={s.heroIntro}>Now I research investments, build financial tools and try to make the difficult parts of finance easier to explore. This is what I&apos;ve been working on.</p>
    <a className={s.heroLink} href="#work">Explore my work <ArrowRight size={18}/></a>
   </div><div className={s.heroFoot}><span>PORTFOLIO / 2026</span><span>SCROLL DOWN <ArrowDown size={14}/></span></div></section>
   <div className={s.currencyRibbon} aria-label="Decorative financial themes, not market data"><div>{[0,1].map(i=><span key={i} aria-hidden={i===1}>₹ CASH FLOW <b>↗</b> $ MARKETS <b>↗</b> € VALUATION <b>↗</b> ∑ RESEARCH <b>↗</b> £ RISK <b>↗</b> ∆ BUILDING <b>↗</b></span>)}</div></div>
   <section id="about" className={s.about}><div data-reveal><span className={s.sectionTag}>01 / IN SHORT</span><h2>I didn&apos;t plan a straight line.<br/><em>I followed the interesting questions.</em></h2></div>
    <div className={s.aboutColumns} data-reveal><p>Engineering gave me a way of thinking. Working on accounts and machinery-financing decisions at Shyam Construction gave me a reason to use it. I wanted to understand why a business makes one investment instead of another, and what happens when the numbers stop cooperating.</p><p>That curiosity took me into mutual-fund liquidity research, FundLenz, FinCalc and now DCF modelling. I&apos;m interested in corporate finance, investment research and technology that makes complex decisions clearer. There&apos;s still a lot I want to learn.</p></div>
   </section>
   <section className={s.workIntro} id="work"><span className={s.sectionTag}>02 / THE WORK, UP CLOSE</span><h2>Things I&apos;ve<br/><em>actually done.</em></h2><p>Every section is a chapter, not a card. Open any story to go deeper—and try the small working demos built into a few of them.</p><div className={s.workCount}>{String(stories.length).padStart(2,"0")} <span>PROJECTS & EXPERIENCES</span></div></section>
   {stories.map((story,i)=><StorySection key={story.id} story={story} index={i} onMorph={notifyMorph}/>)}

   <section id="skills" className={s.skillsSection}><div data-reveal><span className={s.sectionTag}>03 / HOW I WORK</span><h2>Tools, methods<br/><em>and things I keep learning.</em></h2><p>Subjects I&apos;ve worked with and programmes I&apos;ve completed. They&apos;re presented as plain text, not interactive buttons or professional licences.</p></div>
    <div className={s.skillsColumns}>{learning.map((group,i)=><div className={s.skillGroup} key={group.title} data-reveal><span>0{i+1}</span><h3>{group.title}</h3><div className={s.skillsText}>{group.skills.map((name,j)=><span key={name}>{name}{j!==group.skills.length-1?<i> / </i>:""}</span>)}</div></div>)}</div>
    <div className={s.educationLine} data-reveal><div><span>EDUCATION</span><strong>B.Tech · Electronics & Telecommunication Engineering</strong><p>St. Vincent Pallotti College of Engineering & Technology, Nagpur · 2021–2026</p></div><div><span>ENGLISH</span><strong>IELTS Academic · 8.0</strong></div></div>
   </section>
   <section className={s.interestsSection}><span className={s.sectionTag}>04 / THINGS THAT KEEP ME CURIOUS</span><div>{interests.map((t,i)=><p key={t} data-reveal><span>{String(i+1).padStart(2,"0")}</span>{t}</p>)}</div></section>
   <section id="contact" className={s.contact}><span className={s.sectionTag}>05 / SAY HELLO</span><h2>Got an interesting<br/><em>problem to work on?</em></h2><p>I&apos;m exploring work in finance, research and financial technology. If something here caught your attention, I&apos;d be happy to hear from you.</p><a className={s.emailLink} href="mailto:atharva@fundlenz.com?subject=Hello%20Atharva">Let&apos;s talk <ArrowUpRight size={24}/></a>
    <div className={s.contactLinks}><a href="mailto:atharva@fundlenz.com"><Mail size={17}/> Email <ArrowUpRight size={14}/></a><a href="https://www.linkedin.com/in/atharvasahu/" target="_blank" rel="noopener noreferrer">LinkedIn <ArrowUpRight size={14}/></a><a href="https://github.com/atharv3169" target="_blank" rel="noopener noreferrer"><GitBranch size={17}/> GitHub <ArrowUpRight size={14}/></a></div></section>
   <footer className={s.footer}><span>© 2026 ATHARVA SAHU</span><span>BUILT WITH CURIOSITY IN NAGPUR</span><a href="#top">BACK TO TOP ↑</a></footer>

 </main>;
}

