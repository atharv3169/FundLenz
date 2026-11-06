"use client";
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
   <text x="790" y="100" fill="#c7dfcc" fontSize="12" letterSpacing="3">CURIOSITY ↗</text>
 </svg>;
}
function Machine(){
 return <div className={s.machineScene}><span className={s.figMicro}>CAPEX / UTILISATION / CASH FLOW</span>
 <svg viewBox="0 0 920 540" className={s.sceneSvg} role="img" aria-label="Animated machinery financing illustration: loader, truck and loan curves">
 <defs><linearGradient id="goldline" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e9d0a0"/><stop offset="1" stopColor="#bd946d"/></linearGradient></defs>
 <g className={s.sceneGrid}>{Array.from({length:11},(_,i)=><line key={i} x1={i*90} y1="0" x2={i*90} y2="540" stroke="#e8c58c" strokeOpacity=".07"/>)}{Array.from({length:7},(_,i)=><line key={i} x1="0" y1={i*90} x2="920" y2={i*90} stroke="#e8c58c" strokeOpacity=".07"/>)}</g>
 <path d="M80 423H840" stroke="#b9a68c" strokeWidth="2"/>
 <g className={s.loaderMove} data-crew-object="primary"><rect x="130" y="350" width="280" height="53" rx="8" fill="#dfb477"/><rect x="214" y="291" width="118" height="73" rx="10" fill="#dfb477"/><path d="M238 305H312V350H238Z" fill="#2f3d42" stroke="#e6c999" strokeWidth="2"/><path d="M345 354L423 275L477 301L412 362" fill="none" stroke="#e6c18a" strokeWidth="23" strokeLinecap="round"/><path className={s.machineArm} d="M475 297L527 348L505 386L449 378Z" fill="#ae8865"/><circle cx="207" cy="407" r="34" fill="#101a21" stroke="#c7ba9d" strokeWidth="10"/><circle cx="351" cy="407" r="34" fill="#101a21" stroke="#c7ba9d" strokeWidth="10"/></g>
 <g className={s.truckMove} data-crew-object="secondary"><path d="M575 319H749L793 352V399H549V336Z" fill="#7d9793" stroke="#c3ddcf" strokeWidth="2"/><path d="M746 331V357H782L757 333Z" fill="#182c30"/><rect x="560" y="294" width="181" height="39" fill="#b9c4a7"/><circle cx="604" cy="407" r="30" fill="#101a21" stroke="#b6cec3" strokeWidth="8"/><circle cx="744" cy="407" r="30" fill="#101a21" stroke="#b6cec3" strokeWidth="8"/></g>
 <path d="M110 196L255 170L366 215L505 129L635 176L795 93" fill="none" stroke="#e9c693" strokeWidth="2.6" strokeDasharray="8 10" className={s.flowingLine}/>
 <g fill="#ead5b3" fontSize="14" fontWeight="500"><text x="110" y="169">LOAN COST</text><text x="560" y="81">CASH FLOW</text></g>
 <g stroke="#d8e2d5" strokeOpacity=".5"><line x1="550" y1="250" x2="550" y2="110"/><line x1="550" y1="250" x2="815" y2="250"/></g>
 </svg><div className={s.figStat}><strong>₹80L</strong><span>approx. capex in CV models</span></div></div>;
}
function FundArt(){
 return <div className={s.fundScene}><span className={s.figMicro}>HOLDINGS / UNDER THE SURFACE</span><div className={s.fundSourceRow}><span>FUND A</span><span>FUND B</span><span>FUND C</span></div><div className={s.fundFlows}><i/><i/><i/></div><div className={s.fundHeroNumber} data-crew-object="primary">951<span>distinct underlying equities</span></div><div className={s.fundStacks} data-crew-object="secondary">{[68,45,25,19,11,8,6,4].map((v,i)=><div key={i}><b style={{width:v+"%"}}/><small>{String(i+1).padStart(2,"0")}</small></div>)}</div><div className={s.figFooter}>EXAMPLE PORTFOLIO / THREE ETFs</div></div>;
}
function ResearchArt(){
 const points=Array.from({length:72},(_,i)=>({x:80+i*10.1,y:400-((i*73)%250)-i*.65}));
 return <div className={s.researchScene}><span className={s.figMicro}>EMPIRICAL RESEARCH / LIQUIDITY</span>
 <svg className={s.sceneSvg} data-crew-object="primary" viewBox="0 0 920 540" aria-label="Illustrative research scatter plot, not study regression output">
  {Array.from({length:7},(_,i)=><line key={i} x1="70" x2="870" y1={85+i*60} y2={85+i*60} stroke="#c1bdf2" strokeOpacity=".12"/>)}
  {Array.from({length:8},(_,i)=><line key={i} y1="80" y2="480" x1={80+i*110} x2={80+i*110} stroke="#c1bdf2" strokeOpacity=".10"/>)}
  {points.map((p,i)=><circle key={i} className={s.scatterPoint} style={{animationDelay:(i%12)*.08+"s"}} cx={p.x} cy={p.y} r={i%5===0?5:3} fill={i%5===0?"#ead3c7":"#bdb5f1"} opacity=".75"/>)}
  <path d="M90 401L830 165" stroke="#e4d0b9" strokeWidth="2" strokeDasharray="10 9" className={s.flowingLine}/>
  <text x="84" y="65" fill="#cbc5ea" fontSize="15">FUND SIZE ↗</text><text x="600" y="500" fill="#9296b8" fontSize="13">ILLUSTRATIVE POINT CLOUD</text>
 </svg><div className={s.researchLabel} data-crew-object="secondary">70 SCHEMES <span>/</span> 31 MONTHS</div></div>;
}
function FinArt(){
 return <div className={s.finScene}><span className={s.figMicro}>FINANCIAL MATHEMATICS / REPRODUCIBLE</span><div className={s.finTerminal} data-crew-object="primary"><div className={s.terminalBar} data-crew-object="secondary"><i/><i/><i/> fincalc — loan / emi</div><pre><span>$</span> fincalc loan --principal 100000{"\n"}     --rate 12 --months 12{"\n\n"}<span>monthly payment</span>{"\n"}<strong>₹8,884.88</strong>{"\n\n"}total interest  ₹6,618.55{"\n"}schedule          exported ✓</pre></div><div className={s.figFooter}>PYTHON / DECIMAL / CSV / TESTS</div></div>;
}

function DcfArt(){
 const values=[94,122,154,190,231,287];
 return <div className={s.dcfScene}><span className={s.figMicro}>DCF / FREE CASH FLOW FORECAST</span>
 <div className={s.dcfModelVisual} data-crew-object="primary">
  <div className={s.dcfStepLabel}>VALUATION MODEL <strong>FORECAST Y1—Y5</strong></div>
  <div className={s.dcfModelBars} data-crew-object="secondary">{values.map((v,i)=><div key={i}><span>Y{i+1}</span><i style={{height:(v/287*100)+"%"}}/><b>{v}</b></div>)}</div>
  <div className={s.dcfCalcRow}><span>PV OF FUTURE CASH FLOWS</span><strong>∑ FCF / (1 + r)<sup>t</sup></strong></div>
  <div className={s.dcfValueLine}><span>ENTERPRISE VALUE</span><b>EV = PV + TV</b></div>
 </div><div className={s.figFooter}>MODEL INPUTS / ASSUMPTIONS / SCENARIOS</div></div>;
}
function CrowdArt(){
 const people=Array.from({length:12},(_,i)=>({x:170+(i%4)*154,y:125+Math.floor(i/4)*125}));
 return <div className={s.crowdScene}><span className={s.figMicro}>COMPUTER VISION / ML ALERT SYSTEM</span>
 <svg className={s.sceneSvg} data-crew-object="primary" viewBox="0 0 920 540" role="img" aria-label="Conceptual camera field, detected people, machine-learning model and alerts">
 <defs><pattern id="camgrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#c0a7cc" strokeOpacity=".1"/></pattern></defs>
 <rect x="82" y="70" width="660" height="390" rx="14" fill="#121b26" stroke="#cfa5dd" strokeOpacity=".55" strokeWidth="2"/>
 <rect x="82" y="70" width="660" height="390" rx="14" fill="url(#camgrid)"/>
 {people.map((p,i)=><g key={i} className={s.personGlow} style={{animationDelay:(i%5)*.35+"s"}}><circle cx={p.x} cy={p.y} r="17" fill="#caafcf" opacity=".75"/><path d={"M"+(p.x-24)+" "+(p.y+50)+"Q"+(p.x-23)+" "+(p.y+18)+" "+p.x+" "+(p.y+23)+"Q"+(p.x+23)+" "+(p.y+18)+" "+(p.x+24)+" "+(p.y+50)} stroke="#f1cee8" fill="#7f669d" fillOpacity=".25" strokeWidth="2"/><rect x={p.x-36} y={p.y-25} width="72" height="86" rx="4" fill="none" stroke="#e4c3df" strokeOpacity=".53" strokeDasharray="5 7"/></g>)}
 <path className={s.scanBeam} d="M105 145H717" stroke="#e4a8b5" strokeWidth="3"/>
 <path d="M758 157H835V229H759M758 311H835V384H759" stroke="#b4d4df" strokeWidth="3" strokeDasharray="7 6" className={s.flowingLine}/>
 <rect data-crew-object="secondary" x="764" y="235" width="110" height="75" rx="6" fill="#1e2a36" stroke="#b3d4db"/><text x="782" y="264" fill="#bfe6e4" fontSize="15">ML MODEL</text><text x="778" y="289" fill="#a9b6c1" fontSize="11">ALERT LOGIC</text>
 </svg><div className={s.crowdStatus}><i/> CAMERA FEED / CONCEPTUAL SCENE</div></div>;
}
function StudyArt(){
 return <div className={s.studyScene}><span className={s.figMicro}>PLANNING / NOTES / FOCUS</span>
 <div className={s.studySheet} data-crew-object="primary"><header><span>study buddy</span><i>● ● ●</i></header><h3>Today&apos;s plan.</h3><div className={s.studyTaskChecked}>✓ Review notes</div><div className={s.studyTaskUnchecked}>○ Finish assignment</div><div className={s.studyTaskUnchecked}>○ Read a chapter</div><div className={s.studyTimer} data-crew-object="secondary">25:00<small>FOCUS SESSION</small></div></div><div className={s.studyPencil}>✎</div></div>;
}
function VsArt(){
 return <div className={s.vsScene}><span className={s.figMicro}>ARDUINO / ESP32 / SENSOR SYSTEMS</span>
 <svg viewBox="0 0 920 540" className={s.sceneSvg} data-crew-object="primary" role="img" aria-label="Animated ESP32 development board and connected sensor traces">
 <defs><pattern id="pcbgrid" width="44" height="44" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="#91d6cc" opacity=".15"/></pattern></defs><rect x="0" y="0" width="920" height="540" fill="url(#pcbgrid)"/>
 <path d="M180 160H290V225H370M180 335H290V290H370M550 225H675V145H785M550 290H675V390H785M550 255H790" stroke="#88d5c5" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="7 8" className={s.flowingLine}/>
 <rect data-crew-object="secondary" x="367" y="159" width="190" height="209" rx="15" fill="#1a3943" stroke="#9bd4d0" strokeWidth="3"/><rect x="401" y="200" width="123" height="110" rx="6" fill="#0b1a23" stroke="#bbdfd0"/><text x="418" y="246" fill="#b4e4d2" fontSize="19">ESP32</text><text x="418" y="270" fill="#82aabb" fontSize="11">SYSTEM READY</text>
 {Array.from({length:8},(_,i)=><g key={i}><rect x={352+i*24} y="145" width="11" height="16" fill="#bbc8bc"/><rect x={352+i*24} y="367" width="11" height="16" fill="#bbc8bc"/></g>)}
 <circle className={s.iotBeacon} cx="167" cy="160" r="23" stroke="#a9e1bb" strokeWidth="4" fill="#315c59"/><circle className={s.iotBeacon} cx="169" cy="335" r="23" stroke="#dbda9e" strokeWidth="4" fill="#546554"/><circle className={s.iotBeacon} cx="800" cy="145" r="23" stroke="#94e7e6" strokeWidth="4" fill="#315c59"/><circle className={s.iotBeacon} cx="800" cy="389" r="23" stroke="#c6b4e7" strokeWidth="4" fill="#515169"/>
 </svg><div className={s.figFooter}>SENSOR INPUT → PROCESSING → OUTPUT</div></div>;
}
function SynkArt(){
 return <div className={s.synkFinanceScene}>
  <span className={s.figMicro}>FP&amp;A / SUBSCRIPTIONS / PRICING / STRATEGY</span>
  <div className={s.synkFinanceBoard} data-crew-object="primary">
    <div className={s.synkFinanceTop}><span>MONETISATION WORKSPACE</span><span className={s.synkFinanceLive}><i/> SCENARIO LAB</span></div>
    <div className={s.synkPricing}>
      <div className={s.synkPricingLever}><span>01 / PRICING</span><strong>Subscription</strong><div><b className={s.synkPriceDot}/><i/><i/></div></div>
      <div className={s.synkPricingLever}><span>02 / PAYWALL</span><strong>Conversion</strong><div><b className={s.synkPriceDot}/><i/><i/></div></div>
      <div className={s.synkPricingLever}><span>03 / PROJECTIONS</span><strong>Growth cases</strong><div><b className={s.synkPriceDot}/><i/><i/></div></div>
    </div>
    <svg className={s.synkForecastSvg} data-crew-object="secondary" viewBox="0 0 740 205" role="img" aria-label="Conceptual revenue scenario curves for upside, base and downside cases, not actual SYNK forecasts">
      {Array.from({length:5},(_,i)=><line key={i} x1="28" x2="714" y1={20+i*41} y2={20+i*41} stroke="#bdc8f0" strokeOpacity=".13" strokeDasharray="3 8"/>)}
      <path className={s.synkScenarioTop} d="M30 173 C150 170 216 138 313 108 S525 56 714 21" stroke="#c4ecdd" fill="none" strokeWidth="3.2" strokeLinecap="round"/>
      <path className={s.synkScenarioMid} d="M30 173 C150 167 219 152 312 132 S524 111 714 85" stroke="#b7bdf6" fill="none" strokeWidth="3.2" strokeLinecap="round"/>
      <path className={s.synkScenarioLow} d="M30 173 C130 176 222 175 313 164 S525 151 714 146" stroke="#d7bca5" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="7 9"/>
      <circle className={s.synkScenarioPulse} cx="714" cy="21" r="5" fill="#c4ecdd"/>
      <circle className={s.synkScenarioPulse} cx="714" cy="85" r="5" fill="#b7bdf6"/>
    </svg>
    <div className={s.synkForecastLegend}><span><i/> UPSIDE</span><span><i/> BASE</span><span><i/> DOWNSIDE</span></div>
    <div className={s.synkStrategyFooter}><span>REVENUE PLANNING</span><span>LONG-TERM STRATEGY</span><span>M&amp;A OPTIONS</span></div>
  </div>
  <div className={s.figFooter}>ORIGINAL SCENARIO ILLUSTRATION / NOT INTERNAL COMPANY DATA</div>
 </div>;
}
export function SceneFigure({id}:{id:StoryId}){
 switch(id){
 case "shyam":return <Machine/>;
 case "fundlenz":return <FundArt/>;
 case "research":return <ResearchArt/>;
 case "fincalc":return <FinArt/>;
 case "dcf":return <DcfArt/>;
 case "crowd":return <CrowdArt/>;
 case "study":return <StudyArt/>;
 case "vs":return <VsArt/>;
 case "synk":return <SynkArt/>;
 default:return null;
 }
}

