"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { stories, type Story } from "./stories-data";
import { SceneFigure } from "./scenes";
import { MiniTools } from "./mini-tools";
import s from "./story-detail.module.css";

const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const two=(n:number)=>String(n).padStart(2,"0");

export default function StoryDetail({story}:{story:Story}){
 const index=stories.findIndex(item=>item.id===story.id);
 const previous=stories[(index-1+stories.length)%stories.length];
 const next=stories[(index+1)%stories.length];
 const root=useRef<HTMLElement>(null);
 const [progress,setProgress]=useState(0);
 const [chapter,setChapter]=useState(-1);
 const [paper,setPaper]=useState(false);
 const hasDemo=["fundlenz","fincalc","dcf","study"].includes(story.id);

 useEffect(()=>{
   try{setPaper(localStorage.getItem("atharva-paper")==="dark");}catch{}
 },[]);
 useEffect(()=>{
   let raf=0;
   const update=()=>{
     raf=0;
     const scrollMax=Math.max(1,document.documentElement.scrollHeight-innerHeight);
     setProgress(clamp(scrollY/scrollMax));
     const nodes=[...document.querySelectorAll<HTMLElement>("[data-case-chapter]")];
     let active=-1;
     for(let i=0;i<nodes.length;i++){
       if(nodes[i].getBoundingClientRect().top<=innerHeight*.45)active=i;
     }
     setChapter(active);
   };
   const schedule=()=>{if(!raf)raf=requestAnimationFrame(update);};
   const resize=new ResizeObserver(schedule);
   if(root.current)resize.observe(root.current);
   window.addEventListener("scroll",schedule,{passive:true});
   window.addEventListener("resize",schedule);
   schedule();
   return()=>{window.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);resize.disconnect();cancelAnimationFrame(raf);};
 },[story.id]);

 const style={"--case-accent":story.accent,"--case-progress":String(progress)} as CSSProperties;
 const back="/atharva#paper-"+story.id;
 return <main ref={root} id="atharva-story" className={s.page} data-story-page={story.id} data-paper={paper?"dark":"light"} style={style}>
   <div className={s.grain} aria-hidden="true"/>
   <nav className={s.topbar} aria-label="Case study navigation">
     <a className={s.back} href={back}><ArrowLeft size={16}/> All projects</a>
     <a className={s.brand} href="/atharva" aria-label="Portfolio home">A<span> / </span>S.</a>
     <span className={s.pageCount}>CASE STUDY {two(index+1)} / {two(stories.length)}</span>
   </nav>
   <div className={s.topProgress} role="progressbar" aria-label="Case study reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}>
     <div className={s.topFill}/>
   </div>
   <aside className={s.progressRail} aria-label="Case study sections">
     <span className={s.railLabel}>READING / {two(index+1)}</span>
     <div className={s.railTrack}>
       <div className={s.railFill}/>
       <a href="#case-intro" className={chapter<0?s.railActive:""} aria-label="Go to introduction" title="Introduction"><i/></a>
       {story.chapters.map((item,i)=><a href={"#case-chapter-"+i} key={item.title} aria-label={"Go to "+item.title} aria-current={chapter===i?"location":undefined} className={chapter===i?s.railActive:""} title={item.title}><i/></a>)}
       {hasDemo&&<a href="#case-demo" aria-label="Go to interactive demo" title="Interactive demo"><i/></a>}
       <a href="#case-end" aria-label="Go to end" title="End"><i/></a>
     </div>
     <span className={s.percent}>{Math.round(progress*100)}%</span>
   </aside>
   <section className={s.hero} id="case-intro">
     <div className={s.heroCopy}>
       <div className={s.kicker}><span>{story.eyebrow}</span><span>{story.year}</span></div>
       <div className={s.sequence}>PROJECT JOURNAL <span>—</span> {two(index+1)} OF {two(stories.length)}</div>
       <h1>{story.title}<span>.</span></h1>
       <p className={s.hook}>{story.hook}</p>
       <p className={s.intro}>{story.intro}</p>
       <div className={s.heroActions}>
         <a href="#case-chapter-0" className={s.start}>Explore the story <ChevronDown size={18}/></a>
         {story.visit&&!story.visit.pending&&<a className={s.visit} href={story.visit.href} target="_blank" rel="noopener noreferrer">{story.visit.text} <ArrowUpRight size={17}/></a>}
       </div>
     </div>
     <div className={s.artFrame}><SceneFigure id={story.id}/><span className={s.artNumber}>{two(index+1)}</span></div>
     <div className={s.metricStrip}>{story.numbers.map(item=><div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>
   </section>
   <div className={s.paperBody}>
     <section className={s.overview}>
       <div className={s.sectionLabel}><span>00</span> THE CONTEXT</div>
       <div><h2>The work behind<br/><em>the numbers.</em></h2><p>{story.intro}</p></div>
     </section>
     <div className={s.chapters}>
       {story.chapters.map((item,i)=><section id={"case-chapter-"+i} data-case-chapter key={item.title} className={s.chapter}>
         <div className={s.sectionLabel}><span>{two(i+1)}</span> CHAPTER</div>
         <div className={s.chapterText}>
           <h2>{item.title}<span>.</span></h2>
           {item.paragraphs.map((paragraph,j)=><p key={j}>{paragraph}</p>)}
           <div className={s.chapterRule}><span>{two(i+1)} / {two(story.chapters.length)}</span><i/></div>
         </div>
       </section>)}
     </div>
     {hasDemo&&<section className={s.demo} id="case-demo">
       <div className={s.sectionLabel}><span>{two(story.chapters.length+1)}</span> INTERACTIVE</div>
       <div className={s.demoContent}><div className={s.demoHeading}><h2>Test the idea<span>.</span></h2><p>{story.id==="study"?"A small recreation of the study companion.":"Adjust the numbers and explore a working miniature of this project. Illustrative inputs, not financial advice."}</p></div><MiniTools id={story.id}/></div>
     </section>}
     <section className={s.closing} id="case-end">
       <div className={s.sectionLabel}><span>END</span> THE TAKEAWAY</div>
       <div><h2>Work in<br/><em>progress.</em></h2><p>{story.hook}</p>
         <div className={s.tags}>{story.tags.map(tag=><span key={tag}>{tag}</span>)}</div>
         {story.visit&&!story.visit.pending&&<a href={story.visit.href} target="_blank" rel="noopener noreferrer" className={s.visitEnd}>{story.visit.text}<ArrowUpRight size={17}/></a>}
       </div>
     </section>
   </div>
   <footer className={s.footer}>
     <a href={"/atharva/stories/"+previous.id} className={s.neighbor}><span><ArrowLeft size={16}/> PREVIOUS STORY</span><strong>{previous.title}</strong></a>
     <a href={"/atharva/stories/"+next.id} className={s.neighbor}><span>NEXT STORY <ArrowRight size={16}/></span><strong>{next.title}</strong></a>
     <a href={back} className={s.returnLink}>Back to all projects <ArrowUpRight size={17}/></a>
     <span>ATHARVA SAHU / PORTFOLIO 2026</span>
   </footer>
 </main>;
}
