"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronDown, Code2, Compass, ExternalLink, Github, Mail, Maximize2, Minus, Move, Plus, ScanLine, Sparkles, X } from "lucide-react";
import { connections, items, learning, skillClouds, work, type Category, type PortfolioItem } from "./content";
import s from "./portfolio.module.css";

const filters: { value: "all" | Category; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "finance", label: "Finance" },
  { value: "research", label: "Research" },
  { value: "build", label: "Things I've built" },
  { value: "learning", label: "Learning" }
];

const categoryLabels: Record<Category,string> = {
  finance: "Finance", research: "Research", build: "Building", learning: "Learning"
};

const getItem = (id: string) => items.find((item) => item.id === id);
const clamp = (v:number, min:number,max:number) => Math.max(min,Math.min(max,v));

function LineArtwork({ compact = false }: {compact?: boolean}) {
  return (
    <svg className={compact ? s.artworkSmall : s.artwork} viewBox="0 0 960 280" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={compact ? "ath-line-small" : "ath-line"} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b2c0de" stopOpacity="0" />
          <stop offset=".38" stopColor="#b3f2cf" stopOpacity=".48" />
          <stop offset=".73" stopColor="#e2c48d" stopOpacity=".75" />
          <stop offset="1" stopColor="#b3f2cf" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[40,92,144,196,248].map((y) => <line key={y} x1="0" y1={y} x2="960" y2={y} stroke="#9cbbcb" strokeOpacity=".065" strokeDasharray="3 8"/>)}
      {[80,200,320,440,560,680,800,920].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="280" stroke="#9cbbcb" strokeOpacity=".05"/>)}
      <path d="M0 192 L70 197 L119 181 L175 207 L227 168 L278 173 L322 142 L386 154 L429 115 L478 127 L523 93 L560 105 L618 67 L675 103 L728 75 L772 86 L830 50 L877 72 L960 28"
        stroke={compact ? "url(#ath-line-small)" : "url(#ath-line)"} strokeWidth="2.2" className={s.drawLine}/>
      <path d="M0 224 L81 208 L144 231 L200 203 L250 218 L307 194 L374 206 L432 177 L489 198 L551 158 L600 170 L663 142 L727 153 L782 115 L844 136 L900 102 L960 114"
        stroke="#91b8e9" strokeWidth="1" strokeOpacity=".28" className={s.drawLineDelay}/>
      <circle cx="830" cy="50" r="4" fill="#d7f5d4" className={s.pulsePoint} />
      <circle cx="618" cy="67" r="3" fill="#dcbf96" className={s.pulsePoint} />
    </svg>
  );
}

function AnimatedNumber({ value, suffix = "" }: {value:number;suffix?:string}) {
  const target = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {setN(value);return;}
    let raf=0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      let start=0;
      const step=(t:number)=>{
        if(!start) start=t;
        const p=clamp((t-start)/1600,0,1);
        const eased=1-Math.pow(1-p,4);
        setN(Math.round(value*eased));
        if(p<1) raf=requestAnimationFrame(step);
      };
      raf=requestAnimationFrame(step);
      observer.disconnect();
    },{threshold:.4});
    observer.observe(el);
    return()=>{observer.disconnect();cancelAnimationFrame(raf);};
  },[value]);
  return <span ref={target} className={s.tabular}>{n.toLocaleString("en-IN")}{suffix}</span>;
}

function AmbientOrb({label,secondary,x,y,accent,delay=0}: {label:string;secondary:string;x:string;y:string;accent:string;delay?:number}) {
  return (
    <div className={s.ambientOrb} style={{left:x,top:y,animationDelay:String(delay)+"s","--orb-color":accent} as CSSProperties} aria-hidden="true">
      <span className={s.ambientPoint}/><span className={s.ambientLabel}>{label}</span><span className={s.ambientSecondary}>{secondary}</span>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className={s.heroVisual} aria-hidden="true">
      <div className={s.heroVisualGrid}/>
      <div className={s.heroOrbitLarge}/>
      <div className={s.heroOrbitSmall}/>
      <div className={s.heroRing}/>
      <div className={s.heroCore}>
        <div className={s.heroCoreCircle}>AS<span>∕</span></div>
        <span>CONNECTED BY CURIOSITY</span>
      </div>
      <svg className={s.heroConnections} viewBox="0 0 600 540" preserveAspectRatio="none" fill="none">
        <path d="M310 267 L108 116 M310 267 L469 112 M310 267 L510 350 M310 267 L194 423 M310 267 L394 458" stroke="#accacb" strokeOpacity=".28" strokeDasharray="3 8" className={s.heroDash}/>
        <path d="M108 116 L469 112 M194 423 L394 458" stroke="#accacb" strokeOpacity=".12"/>
      </svg>
      <AmbientOrb label="FINANCE" secondary="Capital / cash flow" x="9%" y="19%" accent="#e3c48e" delay={-.7}/>
      <AmbientOrb label="RESEARCH" secondary="Liquidity / risk" x="72%" y="17%" accent="#b7b9ef" delay={-2}/>
      <AmbientOrb label="BUILD" secondary="Python / products" x="83%" y="63%" accent="#99d8e6" delay={-1.4}/>
      <AmbientOrb label="LEARNING" secondary="Math / systems" x="23%" y="78%" accent="#c7dca9" delay={-2.7}/>
      <AmbientOrb label="IDEAS" secondary="Always evolving" x="61%" y="85%" accent="#f4bcab" delay={-1.9}/>
      <div className={s.heroMiniChart}><span>THINK IN SYSTEMS</span><LineArtwork compact/></div>
    </div>
  );
}

function GraphPanel() {
  const [selectedId, setSelectedId] = useState("fundlenz");
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [mode, setMode] = useState<"map" | "list">("map");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x:0,y:0});
  const drag = useRef<{x:number;y:number;px:number;py:number}|null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const selected = getItem(selectedId) || items[0];
  const filtered = useMemo(()=> items.filter((item)=>filter==="all" || item.category===filter),[filter]);

  useEffect(()=>{
    const el=canvas.current;
    if(!el || mode!=="map") return;
    const onWheel=(e:WheelEvent)=>{
      if (window.matchMedia("(max-width: 720px)").matches) return;
      e.preventDefault();
      setZoom((z)=>clamp(z-e.deltaY*.001, .72, 1.75));
    };
    el.addEventListener("wheel",onWheel,{passive:false});
    return()=>el.removeEventListener("wheel",onWheel);
  },[mode]);
  const onDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
    if ((e.target as HTMLElement).closest("button,a")) return;
    drag.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
    if(!drag.current) return;
    setPan({
      x:clamp(drag.current.px+e.clientX-drag.current.x,-240,240),
      y:clamp(drag.current.py+e.clientY-drag.current.y,-170,170)
    });
  };
  const stopDrag=()=>{drag.current=null;};
  const jump=(id:string)=>{setSelectedId(id);setFilter("all");};
  return (
    <section id="explore" className={s.exploreSection} aria-labelledby="explore-title">
      <div className={s.sectionHeading} data-reveal>
        <div>
          <span className={s.kicker}>02 / THE BIG PICTURE</span>
          <h2 id="explore-title">Nothing happens in <em>isolation.</em></h2>
          <p>Finance led me to research. Research led me to code. Code led me right back to finance. Explore the connections.</p>
        </div>
        <div className={s.headingCounter}>12 <span>connected chapters</span></div>
      </div>
      <div className={s.explorer} data-reveal>
        <div className={s.explorerHeader}>
          <div className={s.explorerHeading}><span className={s.greenDot}/> PERSONAL CONSTELLATION <span className={s.mutedSlash}>/</span> 2022–2026</div>
          <div className={s.modeSwitch} role="group" aria-label="Map view mode">
            <button className={mode==="map"?s.modeActive:""} onClick={()=>setMode("map")} aria-pressed={mode==="map"}><Compass size={13}/> Map</button>
            <button className={mode==="list"?s.modeActive:""} onClick={()=>setMode("list")} aria-pressed={mode==="list"}><ScanLine size={13}/> List</button>
          </div>
        </div>
        <div className={s.filterRail} aria-label="Filter experiences">
          {filters.map(f=><button key={f.value} className={filter===f.value?s.filterActive:""} onClick={()=>setFilter(f.value)} aria-pressed={filter===f.value}>{f.label}</button>)}
        </div>
        <div className={s.explorerBody}>
          <div className={s.graphSurface}>
            {mode==="map" ? <>
              <div className={s.mapHelp}><Move size={14}/> Drag to pan <span>·</span> Scroll to zoom <span>·</span> Select any node</div>
              <div ref={canvas} className={s.graphCanvas} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
                <div className={s.graphTransform} style={{transform:"translate("+pan.x+"px,"+pan.y+"px) scale("+zoom+")"}}>
                  <div className={s.graphGrid}/>
                  <svg className={s.networkLines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs><linearGradient id="ath-network-grad"><stop stopColor="#a2c9bc" stopOpacity=".06"/><stop offset=".5" stopColor="#bcd5ce" stopOpacity=".45"/><stop offset="1" stopColor="#a2c9bc" stopOpacity=".06"/></linearGradient></defs>
                    {connections.map(([a,b],i)=>{
                      const p=getItem(a),q=getItem(b);if(!p||!q)return null;
                      const focused = a===selectedId || b===selectedId;
                      const dimmed = filter!=="all" && !(p.category===filter && q.category===filter);
                      return <line key={a+"-"+b} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={focused?s.edgeFocused:s.edge} style={{opacity:dimmed?.12:1,animationDelay:String(i*.19)+"s"}} stroke={focused?"#c4f5d3":"url(#ath-network-grad)"} strokeWidth={focused?".15":".095"} strokeDasharray={focused?".5 .8":".25 1.2"}/>;
                    })}
                  </svg>
                  {items.map((item,i)=>{
                    const faded = filter!=="all" && item.category!==filter;
                    return <button key={item.id} onClick={()=>jump(item.id)}
                      aria-label={"Explore "+item.label}
                      aria-pressed={selectedId===item.id}
                      className={[s.graphNode,selectedId===item.id?s.nodeSelected:"",item.id==="fundlenz"?s.nodePrimary:"",faded?s.nodeFaded:""].join(" ")}
                      style={{left:item.x+"%",top:item.y+"%","--node-accent":item.color,"--delay":String((i%5)*-.75)+"s"} as CSSProperties}>
                      <span className={s.nodeCircle}><span/></span><span className={s.nodeText}><strong>{item.label}</strong><small>{item.short}</small></span>
                    </button>;
                  })}
                </div>
              </div>
              <div className={s.graphControls}>
                <button onClick={()=>setZoom(z=>clamp(z+.15,.72,1.75))} aria-label="Zoom in"><Plus size={16}/></button>
                <span>{Math.round(zoom*100)}%</span>
                <button onClick={()=>setZoom(z=>clamp(z-.15,.72,1.75))} aria-label="Zoom out"><Minus size={16}/></button>
                <button onClick={()=>{setZoom(1);setPan({x:0,y:0});}} aria-label="Reset map"><Maximize2 size={15}/></button>
              </div>
            </> : <div className={s.graphList}>
              {filtered.map(item=><button key={item.id} className={selectedId===item.id?s.graphListActive:""} onClick={()=>setSelectedId(item.id)}>
                <i style={{background:item.color}}/><span><strong>{item.label}</strong><small>{item.short}</small></span><span className={s.listYear}>{item.year}</span><ArrowUpRight size={15}/></button>)}
            </div>}
          </div>
          <aside className={s.graphDetail} aria-live="polite" aria-label="Selected experience details">
            <div className={s.detailTop}>
              <span className={s.detailCategory}><i style={{background:selected.color}}/>{categoryLabels[selected.category]} <span>·</span> {selected.year}</span>
              <span className={s.detailIndex}>{String(items.findIndex(x=>x.id===selected.id)+1).padStart(2,"0")} / 12</span>
            </div>
            <div className={s.detailSymbol} style={{"--node-accent":selected.color} as CSSProperties}>
              <span>{selected.label.slice(0,2).toUpperCase()}</span><div className={s.detailOrbit}/>
            </div>
            <h3>{selected.headline}</h3>
            <p>{selected.description}</p>
            {selected.metric && <div className={s.detailMetric}><strong>{selected.metric}</strong><span>{selected.metricLabel}</span></div>}
            <div className={s.detailTags}>{selected.tags.slice(0,5).map(t=><span key={t}>{t}</span>)}</div>
            <button className={s.detailRead} onClick={()=>{const target=document.getElementById("case-"+selected.id)||document.getElementById("stories");target?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"center"});}}>
              More about this <ArrowRight size={16}/>
            </button>
          </aside>
        </div>
        <div className={s.explorerFooter}><span><span className={s.tinyDot}/> An evolving map, not a fixed career path.</span><span>BUILT TO EXPLORE, NOT JUST SCROLL</span></div>
      </div>
    </section>
  );
}

function ProjectCard({id,number,wide=false}:{id:string;number:string;wide?:boolean}) {
  const item=getItem(id);
  const [expanded,setExpanded]=useState(false);
  if(!item) return null;
  return <article id={"case-"+id} className={[s.projectCard,wide?s.projectWide:""].join(" ")} data-reveal>
    <div className={s.projectTop}><span>{number} / {categoryLabels[item.category]}</span><span>{item.year}</span></div>
    <div className={s.projectArtwork} style={{"--node-accent":item.color} as CSSProperties}>
      {id==="fundlenz" ? <div className={s.fundArtwork}><div className={s.circleOne}/><div className={s.circleTwo}/><div className={s.circleThree}/><strong>36.44</strong><span>EFFECTIVE HOLDINGS / EXAMPLE</span></div> :
       id==="shyam" ? <div className={s.capexArtwork}><span>INVESTMENT DECISIONS</span><div><b>EMI</b><b>UTILISATION</b><b>OPEX</b><b>RESALE</b></div><LineArtwork compact/></div> :
       id==="research" ? <div className={s.researchArtwork}><span>DATASET / 70 SCHEMES</span><div className={s.researchDots}>{Array.from({length:60},(_,i)=><i key={i} style={{opacity:.17+(i%9)*.085,transform:"translateY("+((i*17)%22-11)+"px)"}}/>)}</div><strong>1,900 <small>observations</small></strong></div> :
       id==="fincalc" ? <div className={s.calcArtwork}><span>PV  ·  EMI  ·  CAGR  ·  FV</span><strong>₹8,884.88</strong><small>MONTHLY EMI / ILLUSTRATIVE LOAN</small><div className={s.calcBars}>{[20,35,42,57,70,86,97].map(v=><i key={v} style={{height:v+"%"}}/>)}</div></div> :
       <div className={s.generalArtwork}><span>{item.label}</span><div className={s.generalPulse}/><LineArtwork compact/></div>}
    </div>
    <div className={s.projectContent}>
      <div className={s.projectTitleRow}><div><span className={s.projectShort}>{item.short}</span><h3>{item.label}</h3></div><span className={s.projectArrow}><ArrowUpRight size={19}/></span></div>
      <p>{item.description}</p>
      <div className={s.cardTags}>{item.tags.slice(0,4).map(t=><span key={t}>{t}</span>)}</div>
      <button className={s.expandButton} onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} aria-controls={"details-"+id}>{expanded?"Close the story":"Explore the story"} <ChevronDown size={15} className={expanded?s.chevronUp:""}/></button>
      {expanded && <div id={"details-"+id} className={s.expandedStory}>{item.details.map((p,i)=><p key={i}>{p}</p>)}{item.link&&<a href={item.link} target="_blank" rel="noreferrer noopener" className={s.inlineLink}>{item.linkLabel||"View project"} <ArrowUpRight size={15}/></a>}</div>}
    </div>
  </article>;
}

function Note({children}:{children:React.ReactNode}) {return <p className={s.smallNote}>{children}</p>;}

export default function PortfolioExperience() {
  const [menuOpen,setMenuOpen]=useState(false);
  useEffect(()=>{
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(e=>{if(e.isIntersecting){e.target.setAttribute("data-visible","true");observer.unobserve(e.target);}});
    },{rootMargin:"0px 0px -50px 0px",threshold:.08});
    document.querySelectorAll("#atharva-portfolio [data-reveal]").forEach(el=>observer.observe(el));
    return()=>observer.disconnect();
  },[]);
  return <main id="atharva-portfolio" className={s.portfolioShell}>
    <div className={s.noise} aria-hidden="true"/>
    <nav className={s.siteNav} aria-label="Personal portfolio navigation">
      <a href="#top" className={s.logo} aria-label="Atharva Sahu, go to top">A<span>/</span>S<span className={s.logoDot}>.</span></a>
      <span className={s.navContext}>A PERSONAL INDEX <span>·</span> 2026</span>
      <div className={s.navLinks}>
        <a href="#explore">Explore</a><a href="#stories">Selected work</a><a href="#journey">Experience</a><a href="#learning">Learning</a><a href="#contact">Contact <ArrowUpRight size={13}/></a>
      </div>
      <button className={s.mobileMenuButton} onClick={()=>setMenuOpen(v=>!v)} aria-label={menuOpen?"Close menu":"Open menu"} aria-expanded={menuOpen}>{menuOpen?<X size={22}/>:<Compass size={22}/>}</button>
      {menuOpen&&<div className={s.mobileNav}>{[["Explore","#explore"],["Selected work","#stories"],["Experience","#journey"],["Learning","#learning"],["Contact","#contact"]].map(([label,url])=><a key={url} href={url} onClick={()=>setMenuOpen(false)}>{label}<ArrowUpRight size={17}/></a>)}</div>}
    </nav>

    <section id="top" className={s.hero}>
      <div className={s.heroBackdrop}/><HeroVisual/>
      <div className={s.heroCopy}>
        <p className={s.heroEyebrow}><span className={s.greenDot}/> NAGPUR, INDIA <span className={s.sep}>/</span> FINANCE × RESEARCH × BUILDING</p>
        <h1>Hey, I&apos;m <span>Atharva.</span></h1>
        <p className={s.heroStatement}>I started with machines.<br/>Then I got curious about <em>the numbers behind them.</em></p>
        <p className={s.heroIntro}>Now I work on financial analysis, research questions, and little pieces of software that make complicated things easier to understand. This is where they all connect.</p>
        <div className={s.heroActions}><a href="#explore" className={s.primaryCta}>Explore my world <ArrowRight size={17}/></a><a href="#stories" className={s.secondaryCta}>See what I&apos;ve built <ArrowDown size={16}/></a></div>
      </div>
      <div className={s.heroBottom}><span>01 — A STORY IN PROGRESS</span><span>SCROLL TO EXPLORE <ArrowDown size={14}/></span></div>
    </section>

    <div className={s.ticker} aria-label="Finance and research themes; decorative, not live market prices"><div className={s.tickerTrack}>
      {[0,1,2].map(i=><span key={i} aria-hidden={i!==0}><b>₹</b> CAPITAL <i/> <b>$</b> MARKETS <i/> <b>€</b> RESEARCH <i/> <b>£</b> RISK <i/> ∑ DATA <i/> ↗ BUILDING <i/></span>)}
    </div></div>

    <section className={s.introSection} aria-label="A little about me">
      <div className={s.introIndex} data-reveal><span>01 / ABOUT ME</span><span className={s.introLine}/><span>ONE THING LED TO ANOTHER</span></div>
      <div className={s.introContent} data-reveal><h2>I didn&apos;t plan a straight line.<br/><em>I followed the interesting problems.</em></h2>
        <p>I studied electronics and telecommunication engineering. Along the way, I started working on financial decisions at a construction business. Looking at loan repayments and machinery costs made me curious about how money moves, how decisions get made, and what happens when the assumptions are wrong.</p>
        <p>That curiosity turned into mutual-fund research, then FundLenz, then more experiments with financial modelling and Python. I&apos;m still learning, still building, and very interested in doing more of this professionally.</p>
      </div>
      <div className={s.metricRow} data-reveal>
        <div><strong><AnimatedNumber value={20} suffix="~"/></strong><span>months in finance & accounts</span></div>
        <div><strong><AnimatedNumber value={70}/></strong><span>mutual fund schemes researched</span></div>
        <div><strong><AnimatedNumber value={30}/></strong><span>automated FinCalc tests</span></div>
        <div><strong><AnimatedNumber value={8} suffix=".0"/></strong><span>IELTS overall band</span></div>
      </div>
    </section>

    <GraphPanel/>

    <section id="stories" className={s.storiesSection}>
      <div className={s.sectionHeading} data-reveal><div><span className={s.kicker}>03 / SELECTED WORK</span><h2>Things I&apos;ve <em>actually done.</em></h2><p>Not just titles on a résumé. The questions, the decisions, the things that worked, and the things I had to figure out.</p></div><span className={s.sideRemark}>OPEN A STORY TO GO DEEPER</span></div>
      <div className={s.projectGrid}>
        <ProjectCard id="shyam" number="01" wide/>
        <ProjectCard id="fundlenz" number="02" wide/>
        <ProjectCard id="research" number="03"/>
        <ProjectCard id="fincalc" number="04"/>
        <ProjectCard id="dcf" number="05"/>
        <ProjectCard id="crowd" number="06"/>
      </div>
      <Note>Research findings are from the co-authored manuscript; the FundLenz portfolio figures reflect an illustrative example and an October 2026 snapshot, not live market quotes. DCF Atlas is still in development.</Note>
    </section>

    <section className={s.quoteBand} aria-label="A lesson from work" data-reveal>
      <span>THE QUESTION I KEEP COMING BACK TO</span>
      <blockquote>“What does the number actually mean — and what happens if our assumptions are wrong?”</blockquote>
      <LineArtwork compact/>
    </section>

    <section id="journey" className={s.journeySection}>
      <div className={s.sectionHeading} data-reveal><div><span className={s.kicker}>04 / EXPERIENCE</span><h2>A little less linear.<br/><em>A lot more interesting.</em></h2><p>The jobs, internships and independent work that shaped how I think.</p></div></div>
      <div className={s.timeline}>
        {work.map((w,i)=><article key={w.id} className={s.timelineEntry} data-reveal><div className={s.timelineYear}><i/>{w.year}</div><div className={s.timelineCard}><span>{w.type}</span><h3>{w.title}</h3><small>{w.sub}</small><p>{w.text}</p><a href={"#case-"+w.id} onClick={e=>{if(!document.getElementById("case-"+w.id)){e.preventDefault();document.getElementById("explore")?.scrollIntoView({behavior:"smooth"});}}}>See connection <ArrowUpRight size={14}/></a></div><span className={s.timelineOrdinal}>0{i+1}</span></article>)}
      </div>
    </section>

    <section className={s.spotlightSection}>
      <div className={s.sectionHeading} data-reveal><div><span className={s.kicker}>05 / A FEW MORE THINGS</span><h2>There&apos;s more to the <em>picture.</em></h2><p>Some of the smaller chapters matter just as much.</p></div></div>
      <div className={s.spotlightGrid}>
        <article data-reveal><span>01 / ENGINEERING & INNOVATION</span><div className={s.spotlightIcon}><Code2 size={27}/></div><h3>Built, tested, tried again.</h3><p>My final-year crowd-monitoring project mixed computer vision, ESP32 and practical feasibility work. It earned a first-place project award and led to a published Indian patent application, 202621086685 A (not a patent grant).</p><div className={s.spotlightFoot}>2025–2026 <ArrowUpRight size={16}/></div></article>
        <article data-reveal><span>02 / TECHNEX HACKATHON</span><div className={s.spotlightIcon}><Sparkles size={27}/></div><h3>Study Buddy, built with a team.</h3><p>We came second in the 2024 interdepartmental TechNex hackathon with an app for notes, study organisation and focus modes. It was a good reminder that useful ideas often start small.</p><div className={s.spotlightFoot}>2ND PLACE · 2024 <ArrowUpRight size={16}/></div></article>
        <article data-reveal><span>03 / MY TECHNICAL SIDE</span><div className={s.spotlightIcon}><ScanLine size={27}/></div><h3>Still an engineer at heart.</h3><p>At V S Informatics I worked on more than 20 embedded and IoT applications. I still enjoy the debugging, the edge cases and the moment an unfamiliar system finally makes sense.</p><div className={s.spotlightFoot}>JAN–MAY 2026 <ArrowUpRight size={16}/></div></article>
      </div>
    </section>

    <section id="learning" className={s.learningSection}>
      <div className={s.sectionHeading} data-reveal><div><span className={s.kicker}>06 / LEARNING & TOOLS</span><h2>What I know.<br/><em>What I&apos;m figuring out.</em></h2><p>I like learning things well enough to use them. Here&apos;s what that has looked like so far.</p></div></div>
      <div className={s.learningLayout}>
        <div className={s.skillsBlock} data-reveal><h3>Skills I use</h3>{skillClouds.map(c=><div key={c.label} className={s.skillCluster}><span>{c.label}</span><div>{c.skills.map(t=><span key={t}>{t}</span>)}</div></div>)}</div>
        <div className={s.courseBlock} data-reveal><h3>Courses & independent learning</h3>{learning.map(l=><div key={l.group} className={s.courseGroup}><span>{l.group}</span>{l.names.map((name,i)=><div key={name}><b>{String(i+1).padStart(2,"0")}</b>{name}</div>)}</div>)}<p>These are learning programmes, simulations and certificates, not professional licences or jobs at the named organisations.</p></div>
      </div>
      <div className={s.educationStrip} data-reveal><div><span>FORMAL EDUCATION</span><strong>B.Tech · Electronics & Telecommunication Engineering</strong><p>St. Vincent Pallotti College of Engineering & Technology, Nagpur · 2021–2026</p></div><div><span>CGPA</span><strong>6.16 / 10</strong></div><div><span>ENGLISH</span><strong>IELTS 8.0</strong></div></div>
    </section>

    <section className={s.interestsSection}><span className={s.kicker}>07 / THINGS THAT KEEP ME CURIOUS</span><div className={s.interestWords}>{["Why markets move","What a model misses","Better financial tools","Mutual-fund risk","Small business decisions","How systems connect"].map((t,i)=><span key={t} data-reveal className={i%2?s.interestDim:""}>{t} <i>↗</i></span>)}</div></section>

    <section id="contact" className={s.contactSection}>
      <div className={s.contactGlow}/>
      <div data-reveal><span className={s.kicker}>08 / LET&apos;S CONNECT</span><h2>Got an interesting<br/><em>problem to work on?</em></h2><p>I&apos;m exploring early-career opportunities in finance, financial analysis, research and the technology around them. I&apos;d be glad to hear from you.</p><a className={s.contactCta} href="mailto:atharva@fundlenz.com?subject=Hello%20Atharva">Let&apos;s talk <ArrowUpRight size={22}/></a></div>
      <div className={s.contactLinks} data-reveal><a href="mailto:atharva@fundlenz.com"><Mail size={17}/> Email <ArrowUpRight size={14}/></a><a href="https://www.linkedin.com/in/atharvasahu/" target="_blank" rel="noreferrer noopener"><ExternalLink size={17}/> LinkedIn <ArrowUpRight size={14}/></a><a href="https://github.com/atharv3169" target="_blank" rel="noreferrer noopener"><Github size={17}/> GitHub <ArrowUpRight size={14}/></a></div>
    </section>
    <footer className={s.footer}><span>© 2026 ATHARVA SAHU</span><span>BUILT WITH CURIOSITY IN NAGPUR.</span><a href="#top">BACK TO TOP ↑</a></footer>
  </main>;
}
