"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronDown, GitBranch, Mail, Menu, X, ArrowUp } from "lucide-react";
import { stories, learning, interests, type Story } from "./stories-data";
import { HeroWave, SceneFigure } from "./scenes";
import { MiniTools } from "./mini-tools";
import s from "./portfolio-v2.module.css";

function StorySection({story,index}:{story:Story;index:number}){
 const [open,setOpen]=useState(false);
 const hasDemo=["fundlenz","fincalc","dcf","study"].includes(story.id);
 return <section id={"story-"+story.id} className={s.storySection} style={{"--accent":story.accent} as CSSProperties} data-story={story.id}>
  <div className={s.storyStage} data-reveal>
   <div className={s.storyCopy}>
    <div className={s.storyEyebrow}><span className={s.storyIndex}>{String(index+1).padStart(2,"0")}</span><span>{story.eyebrow}</span></div>
    <p className={s.storyYears}>{story.type} <i> / </i> {story.year}</p>
    <h3>{story.title}<span>.</span></h3>
    <p className={s.storyHook}>{story.hook}</p>
    <p className={s.storyIntro}>{story.intro}</p>
    <div className={s.storyActions}>
      <button className={s.storyRead} aria-expanded={open} aria-controls={"full-"+story.id} onClick={()=>setOpen(v=>!v)}>{open?"Close the story":"Read full story"}<ChevronDown size={17} className={open?s.chevronOpen:""}/></button>
      {story.visit&&<a className={s.storyVisit} href={story.visit.href} target="_blank" rel="noopener noreferrer" title={story.visit.pending?"Upcoming FundLenz route":story.visit.text}>{story.visit.text}<ArrowUpRight size={17}/></a>}
    </div>
    <div className={s.storyNumbers}>{story.numbers.map((n,i)=><div key={i}><strong>{n.value}</strong><span>{n.label}</span></div>)}</div>
   </div>
   <div className={s.storyIllustration}><SceneFigure id={story.id}/><span className={s.storyFigureWatermark}>{String(index+1).padStart(2,"0")}</span></div>
   <div className={s.stageBottom}><span>{String(index+1).padStart(2,"0")} / {String(stories.length).padStart(2,"0")} — EXPERIENCE</span><span>SCROLL TO EXPLORE <ArrowDown size={14}/></span></div>
  </div>
  {open&&<div id={"full-"+story.id} className={s.longStory} aria-label={story.title+" full story"}>
    <div className={s.longStoryLead}><span className={s.sectionTag}>DEEPER / {String(index+1).padStart(2,"0")}</span><h4>The story <em>behind the work.</em></h4><p>What I did, what I found and what I took away.</p></div>
    <div className={s.storyChapterList}>{story.chapters.map((chapter,i)=><article key={chapter.title} className={s.chapter}><span>{String(i+1).padStart(2,"0")}</span><div><h5>{chapter.title}</h5>{chapter.paragraphs.map((p,j)=><p key={j}>{p}</p>)}</div></article>)}</div>
    {hasDemo&&<div className={s.miniStage}><div className={s.miniHead}><span className={s.sectionTag}>TRY IT YOURSELF / INTERACTIVE</span><p>{story.id==="study"?"A little piece of the idea, rebuilt to play with.":"A working miniature experiment. Change the inputs to see what happens."}</p></div><MiniTools id={story.id}/></div>}
    <div className={s.tagsLine}><span>WHAT IT INVOLVED</span><div>{story.tags.map(tag=><span key={tag}>{tag}</span>)}</div></div>
    <button className={s.storyClose} onClick={()=>{setOpen(false);document.getElementById("story-"+story.id)?.scrollIntoView({behavior:"smooth",block:"start"})}}>Close chapter <ArrowUp size={16}/></button>
  </div>}
 </section>;
}


export default function PortfolioV2(){
 const [navOpen,setNavOpen]=useState(false);
 const [progress,setProgress]=useState(0);
 useEffect(()=>{
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.setAttribute("data-visible","true");observer.unobserve(e.target)}}),{rootMargin:"0px 0px -60px 0px",threshold:.06});
  document.querySelectorAll("#atharva-portfolio [data-reveal]").forEach(el=>observer.observe(el));
  const onScroll=()=>{const max=document.documentElement.scrollHeight-window.innerHeight;setProgress(max>0?window.scrollY/max*100:0)};
  onScroll();window.addEventListener("scroll",onScroll,{passive:true});
  return()=>{observer.disconnect();window.removeEventListener("scroll",onScroll)};
 },[]);
 return <main className={s.portfolioShell} id="atharva-portfolio">
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
    <p className={s.heroIntro}>Now I research investments, build financial tools and try to make the difficult parts of finance easier to explore. This is what I've been working on.</p>
    <a className={s.heroLink} href="#work">Explore my work <ArrowRight size={18}/></a>
   </div><div className={s.heroFoot}><span>PORTFOLIO / 2026</span><span>SCROLL DOWN <ArrowDown size={14}/></span></div></section>
   <div className={s.currencyRibbon} aria-label="Decorative financial themes, not market data"><div>{[0,1].map(i=><span key={i} aria-hidden={i===1}>₹ CASH FLOW <b>↗</b> $ MARKETS <b>↗</b> € VALUATION <b>↗</b> ∑ RESEARCH <b>↗</b> £ RISK <b>↗</b> ∆ BUILDING <b>↗</b></span>)}</div></div>
   <section id="about" className={s.about}><div data-reveal><span className={s.sectionTag}>01 / IN SHORT</span><h2>I didn't plan a straight line.<br/><em>I followed the interesting questions.</em></h2></div>
    <div className={s.aboutColumns} data-reveal><p>Engineering gave me a way of thinking. Working on accounts and machinery-financing decisions at Shyam Construction gave me a reason to use it. I wanted to understand why a business makes one investment instead of another, and what happens when the numbers stop cooperating.</p><p>That curiosity took me into mutual-fund liquidity research, FundLenz, FinCalc and now DCF modelling. I'm interested in corporate finance, investment research and technology that makes complex decisions clearer. There's still a lot I want to learn.</p></div>
   </section>
   <section className={s.workIntro} id="work"><span className={s.sectionTag}>02 / THE WORK, UP CLOSE</span><h2>Things I've<br/><em>actually done.</em></h2><p>Every section is a chapter, not a card. Open any story to go deeper—and try the small working demos built into a few of them.</p><div className={s.workCount}>{String(stories.length).padStart(2,"0")} <span>PROJECTS & EXPERIENCES</span></div></section>
   {stories.map((story,i)=><StorySection key={story.id} story={story} index={i}/>)}
   /* FOOTERSECTIONS */
 </main>;
}

