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

/* MAIN */
