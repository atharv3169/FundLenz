"use client";
import type { CSSProperties } from "react";
import type { StoryId } from "./stories-data";
import s from "./portfolio-v2.module.css";

export function HeroWave(){
 return <svg className={s.heroWave} viewBox="0 0 980 570" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
   <defs><linearGradient id="hpath" x1="0" y1="0" x2="900" y2="0"><stop stopColor="#9fb4bf" stopOpacity=".05"/><stop offset=".5" stopColor="#c0e8cb"/><stop offset="1" stopColor="#e0b988"/></linearGradient></defs>
   {Array.from({length:9},(_,i)=><line key={i} x1="0" x2="980" y1={50+i*60} y2={50+i*60} stroke="#a8bdb9" strokeOpacity=".06" strokeDasharray="3 11"/>)}
   {Array.from({length:12},(_,i)=><line key={i} y1="0" y2="570" x1={50+i*80} x2={50+i*80} stroke="#a8bdb9" strokeOpacity=".06"/>)}
   <path className={s.waveDraw} d="M-40 430L40 420L100 445L170 380L250 404L310 318L382 355L470 265L560 294L644 210L710 236L800 122L880 162L1020 65" stroke="url(#hpath)" strokeWidth="3"/>
   <path className={s.waveGhost} d="M-40 470L100 457L180 477L270 414L355 442L470 348L570 374L646 292L720 317L820 215L910 238L1020 170" stroke="#9fd4e2" strokeWidth="1" strokeOpacity=".37"/>
   <circle className={s.wavePoint} cx="800" cy="122" r="6" fill="#dcebbd"/><circle className={s.wavePoint} cx="644" cy="210" r="4" fill="#bfddc5"/>
   <text x="790" y="100" fill="#c7dfcc" fontSize="12" letterSpacing="3">CURIOUSITY ↗</text>
 </svg>;
}
function Machine(){
 return <div className={s.machineScene}><span className={s.figMicro}>CAPEX / UTILISATION / CASH FLOW</span>
 <svg viewBox="0 0 920 540" className={s.sceneSvg} role="img" aria-label="Animated machinery financing illustration: loader, truck and loan curves">
 <defs><linearGradient id="goldline" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e9d0a0"/><stop offset="1" stopColor="#bd946d"/></linearGradient></defs>
 <g className={s.sceneGrid}>{Array.from({length:11},(_,i)=><line key={i} x1={i*90} y1="0" x2={i*90} y2="540" stroke="#e8c58c" strokeOpacity=".07"/>)}{Array.from({length:7},(_,i)=><line key={i} x1="0" y1={i*90} x2="920" y2={i*90} stroke="#e8c58c" strokeOpacity=".07"/>)}</g>
 <path d="M80 423H840" stroke="#b9a68c" strokeWidth="2"/>
 <g className={s.loaderMove}><rect x="130" y="350" width="280" height="53" rx="8" fill="#dfb477"/><rect x="214" y="291" width="118" height="73" rx="10" fill="#dfb477"/><path d="M238 305H312V350H238Z" fill="#2f3d42" stroke="#e6c999" strokeWidth="2"/><path d="M345 354L423 275L477 301L412 362" fill="none" stroke="#e6c18a" strokeWidth="23" strokeLinecap="round"/><path className={s.machineArm} d="M475 297L527 348L505 386L449 378Z" fill="#ae8865"/><circle cx="207" cy="407" r="34" fill="#101a21" stroke="#c7ba9d" strokeWidth="10"/><circle cx="351" cy="407" r="34" fill="#101a21" stroke="#c7ba9d" strokeWidth="10"/></g>
 <g className={s.truckMove}><path d="M575 319H749L793 352V399H549V336Z" fill="#7d9793" stroke="#c3ddcf" strokeWidth="2"/><path d="M746 331V357H782L757 333Z" fill="#182c30"/><rect x="560" y="294" width="181" height="39" fill="#b9c4a7"/><circle cx="604" cy="407" r="30" fill="#101a21" stroke="#b6cec3" strokeWidth="8"/><circle cx="744" cy="407" r="30" fill="#101a21" stroke="#b6cec3" strokeWidth="8"/></g>
 <path d="M110 196L255 170L366 215L505 129L635 176L795 93" fill="none" stroke="#e9c693" strokeWidth="2.6" strokeDasharray="8 10" className={s.flowingLine}/>
 <g fill="#ead5b3" fontSize="14" fontWeight="500"><text x="110" y="169">LOAN COST</text><text x="560" y="81">CASH FLOW</text></g>
 <g stroke="#d8e2d5" strokeOpacity=".5"><line x1="550" y1="250" x2="550" y2="110"/><line x1="550" y1="250" x2="815" y2="250"/></g>
 </svg><div className={s.figStat}><strong>₹80L</strong><span>approx. capex in CV models</span></div></div>;
}
function FundArt(){
 return <div className={s.fundScene}><span className={s.figMicro}>HOLDINGS / UNDER THE SURFACE</span><div className={s.fundSourceRow}><span>FUND A</span><span>FUND B</span><span>FUND C</span></div><div className={s.fundFlows}><i/><i/><i/></div><div className={s.fundHeroNumber}>951<span>distinct underlying equities</span></div><div className={s.fundStacks}>{[68,45,25,19,11,8,6,4].map((v,i)=><div key={i}><b style={{width:v+"%"}}/><small>{String(i+1).padStart(2,"0")}</small></div>)}</div><div className={s.figFooter}>EXAMPLE PORTFOLIO / THREE ETFs</div></div>;
}
function ResearchArt(){
 const points=Array.from({length:72},(_,i)=>({x:80+i*10.1,y:400-((i*73)%250)-i*.65}));
 return <div className={s.researchScene}><span className={s.figMicro}>EMPIRICAL RESEARCH / LIQUIDITY</span>
 <svg className={s.sceneSvg} viewBox="0 0 920 540" aria-label="Illustrative research scatter plot, not study regression output">
  {Array.from({length:7},(_,i)=><line key={i} x1="70" x2="870" y1={85+i*60} y2={85+i*60} stroke="#c1bdf2" strokeOpacity=".12"/>)}
  {Array.from({length:8},(_,i)=><line key={i} y1="80" y2="480" x1={80+i*110} x2={80+i*110} stroke="#c1bdf2" strokeOpacity=".10"/>)}
  {points.map((p,i)=><circle key={i} className={s.scatterPoint} style={{animationDelay:(i%12)*.08+"s"}} cx={p.x} cy={p.y} r={i%5===0?5:3} fill={i%5===0?"#ead3c7":"#bdb5f1"} opacity=".75"/>)}
  <path d="M90 401L830 165" stroke="#e4d0b9" strokeWidth="2" strokeDasharray="10 9" className={s.flowingLine}/>
  <text x="84" y="65" fill="#cbc5ea" fontSize="15">FUND SIZE ↗</text><text x="600" y="500" fill="#9296b8" fontSize="13">ILLUSTRATIVE POINT CLOUD</text>
 </svg><div className={s.researchLabel}>70 SCHEMES <span>/</span> 31 MONTHS</div></div>;
}
function FinArt(){
 return <div className={s.finScene}><span className={s.figMicro}>FINANCIAL MATHEMATICS / REPRODUCIBLE</span><div className={s.finTerminal}><div className={s.terminalBar}><i/><i/><i/> fincalc — loan / emi</div><pre><span>$</span> fincalc loan --principal 100000{"\n"}     --rate 12 --months 12{"\n\n"}<span>monthly payment</span>{"\n"}<strong>₹8,884.88</strong>{"\n\n"}total interest  ₹6,618.55{"\n"}schedule          exported ✓</pre></div><div className={s.figFooter}>PYTHON / DECIMAL / CSV / TESTS</div></div>;
}
/* MORE */
