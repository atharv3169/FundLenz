"use client";
import type { ReactNode } from "react";
import art from "./scene-figures.module.css";
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
// The scene has three non-overlapping tracks. Everything that moves lives in
// one SVG coordinate system, so resizing a reader scales its parts together.
function Frame({id,heading,caption,children}:{id:StoryId;heading:string;caption:string;children:ReactNode}){
 return <figure className={art.sceneFrame} data-art-scene={id}>
  <span data-art-part="heading" className={s.figMicro+" "+art.heading}>{heading}</span>
  <div data-art-part="artwork" className={art.canvas}>{children}</div>
  <figcaption data-art-part="caption" className={art.caption}>{caption}</figcaption>
 </figure>;
}
function Plate({label,children}:{label:string;children:ReactNode}){
 return <svg role="img" aria-label={label} viewBox="0 0 680 370" className={art.plate}>{children}</svg>;
}
function Machine(){
 return <Frame id="shyam" heading="CAPEX / UTILISATION / CASH FLOW" caption="Machinery financing · approximately ₹80 lakh in planned capex">
 <svg viewBox="0 0 920 540" className={s.sceneSvg} role="img" aria-label="Animated machinery financing illustration: loader, truck and loan curves">
 <defs><linearGradient id="goldline" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e9d0a0"/><stop offset="1" stopColor="#bd946d"/></linearGradient></defs>
 <g className={s.sceneGrid}>{Array.from({length:11},(_,i)=><line key={i} x1={i*90} y1="0" x2={i*90} y2="540" stroke="#e8c58c" strokeOpacity=".07"/>)}{Array.from({length:7},(_,i)=><line key={i} x1="0" y1={i*90} x2="920" y2={i*90} stroke="#e8c58c" strokeOpacity=".07"/>)}</g>
 <path d="M80 423H840" stroke="#b9a68c" strokeWidth="2"/>
 <g data-art-region="loader" className={s.loaderMove}><rect x="130" y="350" width="280" height="53" rx="8" fill="#dfb477"/><rect x="214" y="291" width="118" height="73" rx="10" fill="#dfb477"/><path d="M238 305H312V350H238Z" fill="#2f3d42" stroke="#e6c999" strokeWidth="2"/><path d="M345 354L423 275L477 301L412 362" fill="none" stroke="#e6c18a" strokeWidth="23" strokeLinecap="round"/><path className={s.machineArm} d="M475 297L527 348L505 386L449 378Z" fill="#ae8865"/><circle cx="207" cy="407" r="34" fill="#101a21" stroke="#c7ba9d" strokeWidth="10"/><circle cx="351" cy="407" r="34" fill="#101a21" stroke="#c7ba9d" strokeWidth="10"/></g>
 <g data-art-region="truck" className={s.truckMove}><path d="M575 319H749L793 352V399H549V336Z" fill="#7d9793" stroke="#c3ddcf" strokeWidth="2"/><path d="M746 331V357H782L757 333Z" fill="#182c30"/><rect x="560" y="294" width="181" height="39" fill="#b9c4a7"/><circle cx="604" cy="407" r="30" fill="#101a21" stroke="#b6cec3" strokeWidth="8"/><circle cx="744" cy="407" r="30" fill="#101a21" stroke="#b6cec3" strokeWidth="8"/></g>
 <path d="M110 196L255 170L366 215L505 129L635 176L795 93" fill="none" stroke="#e9c693" strokeWidth="2.6" strokeDasharray="8 10" className={s.flowingLine}/>
 <g fill="#ead5b3" fontSize="14" fontWeight="500"><text x="110" y="169">LOAN COST</text><text x="560" y="81">CASH FLOW</text></g>
 <g stroke="#d8e2d5" strokeOpacity=".5"><line x1="550" y1="250" x2="550" y2="110"/><line x1="550" y1="250" x2="815" y2="250"/></g>
 </svg></Frame>;
}
function FundArt(){
 return <Frame id="fundlenz" heading="FUNDLENZ / LOOK-THROUGH ANALYSIS" caption="Worked portfolio · three ETFs"><Plate label="Three funds feed one combined portfolio of 951 distinct equities">
 <g data-art-region="sources">{['IVV','IWB','IWF'].map((v,i)=><g key={v} transform={'translate('+(90+i*160)+' 32)'}><rect width="134" height="44" rx="7" fill="#1c322d" stroke="#709a86"/><text x="67" y="29" textAnchor="middle" fill="#c2e9d2" fontSize="18">{v}</text></g>)}</g>
 <g stroke="#91ba9f" opacity=".6" fill="none" strokeDasharray="7 5" className={s.flowingLine}>{[157,317,477].map(x=><path key={x} d={'M'+x+' 79 Q'+x+' 110 317 132'}/>)}</g>
 <g data-art-region="count"><text x="90" y="245" fill="#d2ead9" fontSize="88" letterSpacing="-6">951</text><text x="92" y="273" fill="#afcab9" fontSize="17">DISTINCT EQUITIES</text></g>
 <g data-art-region="weights">{[177,128,99,65,47,29].map((w,i)=><g key={i}><path d={'M365 '+(165+i*22)+'h190'} stroke="#31433d" strokeWidth="6"/><path d={'M365 '+(165+i*22)+'h'+w} stroke="#92c8a5" strokeWidth="7" className={art.bar}/></g>)}</g>
 </Plate></Frame>;
}
function DhanInfoArt(){
 return <Frame id="dhaninfo" heading="DHANINFO / OPERATIONS + LENDING" caption="Illustrative data flow · no company or client records">
  <Plate label="Animated illustrative international client analysis: validated records feed mortgage and lending checks and risk review">
   <defs>
    <linearGradient id="dhanFlow" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#e97968"/><stop offset="1" stopColor="#f2b18a"/></linearGradient>
   </defs>
   <g data-art-region="brand">
    <rect x="215" y="15" width="250" height="64" rx="12" fill="#3b2932" stroke="#df8979" strokeWidth="1.5"/>
    <text x="340" y="52" textAnchor="middle" fontSize="27" fontWeight="700" fill="#ffe1d7" letterSpacing="-.7">DhanInfo</text>
    <path d="M274 63H407" stroke="#ec8878" strokeWidth="2" strokeLinecap="round" className={art.draw}/>
   </g>
   <g data-art-region="cards">
    <rect x="24" y="123" width="182" height="168" rx="12" fill="#302b35" stroke="#96636a"/>
    <rect x="248" y="123" width="184" height="168" rx="12" fill="#302b35" stroke="#96636a"/>
    <rect x="474" y="123" width="182" height="168" rx="12" fill="#302b35" stroke="#96636a"/>
    <g fontSize="14" fill="#efb1a6" fontWeight="600" letterSpacing=".5">
     <text x="43" y="149">OPERATIONAL DATA</text>
     <text x="267" y="149">LOAN / MORTGAGE</text>
     <text x="491" y="149">RISK REVIEW</text>
    </g>
    <g stroke="#aa7777" strokeOpacity=".24">
     {[0,1,2,3].map(i=><g key={i}><path d={`M44 ${174+i*25}H182`}/><path d={`M266 ${174+i*25}H413`}/><path d={`M490 ${174+i*25}H632`}/></g>)}
    </g>
    <g fill="#ed8c78">{[106,87,117,68].map((v,i)=><rect key={i} x="44" y={170+i*25} width={v} height="6" rx="3" className={art.bar}/>)}</g>
    <g fill="#f0b08b">{[109,66,119,83].map((v,i)=><rect key={i} x="267" y={170+i*25} width={v} height="6" rx="3" className={art.bar}/>)}</g>
    <path d="M492 257L523 237L552 242L582 193L616 201L631 178" stroke="url(#dhanFlow)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" className={art.draw}/>
    <g fontSize="11" fill="#d99b91"><text x="44" y="275">CHECK / VALIDATE</text><text x="267" y="275">REVIEW / ANALYSE</text><text x="491" y="275">COMPARE / FLAG</text></g>
   </g>
   <g data-art-region="transfer" stroke="#e97968" strokeWidth="2" fill="none" strokeDasharray="4 6" className={s.flowingLine}>
    <path d="M206 204H248"/><path d="M432 204H474"/><path d="M340 79V117"/>
   </g>
   <g fill="#ffd0bf"><circle cx="227" cy="204" r="4" className={art.blink}/><circle cx="453" cy="204" r="4" className={art.blink}/></g>
   <text x="340" y="327" textAnchor="middle" fill="#e8b9a9" fontSize="13">INTERNATIONAL CLIENT WORK · ILLUSTRATIVE ONLY</text>
  </Plate>
 </Frame>;
}
function ResearchArt(){
 const points=Array.from({length:72},(_,i)=>({x:80+i*10.1,y:400-((i*73)%250)-i*.65}));
 return <Frame id="research" heading="EMPIRICAL RESEARCH / LIQUIDITY" caption="70 schemes · 31 months · illustrative data">
 <svg className={s.sceneSvg} viewBox="0 0 920 540" aria-label="Illustrative research scatter plot, not study regression output">
  {Array.from({length:7},(_,i)=><line key={i} x1="70" x2="870" y1={85+i*60} y2={85+i*60} stroke="#c1bdf2" strokeOpacity=".12"/>)}
  {Array.from({length:8},(_,i)=><line key={i} y1="80" y2="480" x1={80+i*110} x2={80+i*110} stroke="#c1bdf2" strokeOpacity=".10"/>)}
  {points.map((p,i)=><circle key={i} className={s.scatterPoint} style={{animationDelay:(i%12)*.08+"s"}} cx={p.x} cy={p.y} r={i%5===0?5:3} fill={i%5===0?"#ead3c7":"#bdb5f1"} opacity=".75"/>)}
  <path d="M90 401L830 165" stroke="#e4d0b9" strokeWidth="2" strokeDasharray="10 9" className={s.flowingLine}/>
  <text x="84" y="65" fill="#cbc5ea" fontSize="15">FUND SIZE ↗</text><text x="600" y="500" fill="#9296b8" fontSize="13">ILLUSTRATIVE POINT CLOUD</text>
 </svg></Frame>;
}
function FinArt(){
 return <Frame id="fincalc" heading="FINCALC / REPRODUCIBLE FINANCE" caption="Fixed-rate loan · 12 monthly instalments"><Plate label="Example: a one lakh rupee loan at 12% annual interest gives a monthly payment of ₹8,884.88">
 <rect x="72" y="27" width="536" height="309" rx="14" fill="#101f29" stroke="#526b75"/><path d="M72 87h536" stroke="#415d6a"/>
 <g data-art-region="terminal-title"><circle cx="100" cy="57" r="5" fill="#d5b295"/><circle cx="117" cy="57" r="5" fill="#9bbda5"/><text x="142" y="63" fill="#abc5ce" fontSize="17">fincalc · loan / emi</text></g>
 <g data-art-region="command" fontSize="17" fill="#a1b8bf"><text x="101" y="136">$ fincalc loan --principal 100000</text><text x="121" y="164">--rate 12 --months 12</text></g>
 <g data-art-region="result"><text x="101" y="224" fill="#b1c4c8" fontSize="15">MONTHLY PAYMENT</text><text x="97" y="289" fontSize="54" fill="#c6e9dc">₹8,884.88</text><rect x="425" y="256" width="4" height="33" fill="#a8d4c0" className={art.blink}/></g>
 </Plate></Frame>;
}
function DcfArt(){
 const values=[94,122,154,190,231];
 return <Frame id="dcf" heading="DCF ATLAS / FORECAST STUDIO" caption="Illustrative cash flows · forecast years 1–5"><Plate label="Five projected free cash flow bars lead into a discounted enterprise value">
 <g data-art-region="forecast">{values.map((v,i)=><g key={v}><text x={117+i*106} y={239-v*.76} textAnchor="middle" fill="#efd0b9" fontSize="17">{v}</text><rect x={92+i*106} y={250-v*.76} width="50" height={v*.76} fill={i===4?'#e4bb9d':'#ab8479'} className={art.bar}/><text x={117+i*106} y="275" textAnchor="middle" fill="#c5bcb7" fontSize="17">Y{i+1}</text></g>)}</g>
 <path d="M77 250h520M77 292h520" stroke="#9a827a" opacity=".65"/><g data-art-region="valuation"><text x="78" y="329" fontSize="16" fill="#c9ae9e">ENTERPRISE VALUE</text><text x="595" y="330" fontSize="19" textAnchor="end" fill="#f0d3c2">PV(FCF) + PV(terminal value)</text></g>
 </Plate></Frame>;
}
function TernwellArt(){
 return <Frame id="ternwell" heading="TERNWELL / LINKED FINANCIAL STATEMENTS" caption="One operating forecast · three linked statements"><Plate label="Income, balance sheet and cash flow are linked in one model">
 {['Income statement','Balance sheet','Cash flow'].map((t,i)=><g key={t} data-art-region={'statement-'+i} transform={'translate(67 '+(30+i*97)+')'}><rect width="545" height="72" rx="8" fill={['#2a2434','#252e32','#2a2b34'][i]} stroke={['#8d7096','#628e83','#9d806e'][i]}/><text x="20" y="46" fontSize="19" fill="#baa9c0">0{i+1}</text><text x="76" y="46" fontSize="26" fill="#ece5ef">{t}</text><path d={['M353 48l32 -15 28 7 30 -18 35 4 31 -11','M353 47l37 -4 32 -12 28 5 29 -15 30 2','M353 50l34 -21 28 13 33 -18 30 4 31 -12'][i]} stroke={['#d5b0d8','#92c7b6','#ddba9e'][i]} fill="none" strokeWidth="3" className={art.draw}/></g>)}
 <path d="M99 102v22m0 76v22" stroke="#a790b0" strokeWidth="2" strokeDasharray="4 4" className={s.flowingLine}/></Plate></Frame>;
}
function CrowdArt(){
 const people=Array.from({length:12},(_,i)=>({x:170+(i%4)*154,y:125+Math.floor(i/4)*125}));
 return <Frame id="crowd" heading="COMPUTER VISION / DETECTION" caption="Conceptual camera field and alert logic">
 <svg className={s.sceneSvg} viewBox="0 0 920 540" role="img" aria-label="Conceptual camera field, detected people, machine-learning model and alerts">
 <defs><pattern id="camgrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#c0a7cc" strokeOpacity=".1"/></pattern></defs>
 <rect x="82" y="70" width="660" height="390" rx="14" fill="#121b26" stroke="#cfa5dd" strokeOpacity=".55" strokeWidth="2"/>
 <rect x="82" y="70" width="660" height="390" rx="14" fill="url(#camgrid)"/>
 {people.map((p,i)=><g key={i} className={s.personGlow} style={{animationDelay:(i%5)*.35+"s"}}><circle cx={p.x} cy={p.y} r="17" fill="#caafcf" opacity=".75"/><path d={"M"+(p.x-24)+" "+(p.y+50)+"Q"+(p.x-23)+" "+(p.y+18)+" "+p.x+" "+(p.y+23)+"Q"+(p.x+23)+" "+(p.y+18)+" "+(p.x+24)+" "+(p.y+50)} stroke="#f1cee8" fill="#7f669d" fillOpacity=".25" strokeWidth="2"/><rect x={p.x-36} y={p.y-25} width="72" height="86" rx="4" fill="none" stroke="#e4c3df" strokeOpacity=".53" strokeDasharray="5 7"/></g>)}
 <path className={s.scanBeam} d="M105 145H717" stroke="#e4a8b5" strokeWidth="3"/>
 <path d="M758 157H835V229H759M758 311H835V384H759" stroke="#b4d4df" strokeWidth="3" strokeDasharray="7 6" className={s.flowingLine}/>
 <rect x="764" y="235" width="110" height="75" rx="6" fill="#1e2a36" stroke="#b3d4db"/><text x="782" y="264" fill="#bfe6e4" fontSize="15">ML MODEL</text><text x="778" y="289" fill="#a9b6c1" fontSize="11">ALERT LOGIC</text>
 </svg></Frame>;
}
function StudyArt(){
 return <Frame id="study" heading="STUDY BUDDY / FOCUS SESSION" caption="Task planning and a focus timer"><Plate label="A study planner and a separate 25-minute focus timer">
 <rect x="67" y="34" width="550" height="288" rx="12" fill="#dbe6da"/><g data-art-region="planner"><text x="94" y="83" fill="#274134" fontSize="27">Today’s plan</text>{['Review notes','Finish assignment','Read a chapter'].map((t,i)=><g key={t}><rect x="96" y={118+i*59} width="16" height="16" rx="3" fill={i===0?'#769581':'none'} stroke="#64836c"/><text x="126" y={132+i*59} fill="#344c3e" fontSize="19">{t}</text></g>)}</g>
 <g data-art-region="timer"><circle cx="477" cy="173" r="72" fill="none" stroke="#afc4b3" strokeWidth="3"/><circle cx="477" cy="173" r="72" fill="none" stroke="#658872" strokeWidth="4" strokeDasharray="280 500" transform="rotate(-90 477 173)"/><text x="477" y="178" textAnchor="middle" fill="#345541" fontSize="37">25:00</text><text x="477" y="203" textAnchor="middle" fill="#506757" fontSize="13">FOCUS TIMER</text></g></Plate></Frame>;
}
function VsArt(){
 return <Frame id="vs" heading="EMBEDDED SYSTEMS / SENSOR NETWORK" caption="Sensor input → processing → output">
 <svg viewBox="0 0 920 540" className={s.sceneSvg} role="img" aria-label="Animated ESP32 development board and connected sensor traces">
 <defs><pattern id="pcbgrid" width="44" height="44" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="#91d6cc" opacity=".15"/></pattern></defs><rect x="0" y="0" width="920" height="540" fill="url(#pcbgrid)"/>
 <path d="M180 160H290V225H370M180 335H290V290H370M550 225H675V145H785M550 290H675V390H785M550 255H790" stroke="#88d5c5" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="7 8" className={s.flowingLine}/>
 <rect x="367" y="159" width="190" height="209" rx="15" fill="#1a3943" stroke="#9bd4d0" strokeWidth="3"/><rect x="401" y="200" width="123" height="110" rx="6" fill="#0b1a23" stroke="#bbdfd0"/><text x="418" y="246" fill="#b4e4d2" fontSize="19">ESP32</text><text x="418" y="270" fill="#82aabb" fontSize="11">SYSTEM READY</text>
 {Array.from({length:8},(_,i)=><g key={i}><rect x={352+i*24} y="145" width="11" height="16" fill="#bbc8bc"/><rect x={352+i*24} y="367" width="11" height="16" fill="#bbc8bc"/></g>)}
 <circle className={s.iotBeacon} cx="167" cy="160" r="23" stroke="#a9e1bb" strokeWidth="4" fill="#315c59"/><circle className={s.iotBeacon} cx="169" cy="335" r="23" stroke="#dbda9e" strokeWidth="4" fill="#546554"/><circle className={s.iotBeacon} cx="800" cy="145" r="23" stroke="#94e7e6" strokeWidth="4" fill="#315c59"/><circle className={s.iotBeacon} cx="800" cy="389" r="23" stroke="#c6b4e7" strokeWidth="4" fill="#515169"/>
 </svg></Frame>;
}
function SynkArt(){
 return <Frame id="synk" heading="FP&A / SUBSCRIPTION ECONOMICS" caption="Illustrative scenarios · not company forecasts"><Plate label="Conceptual upside, base and downside subscription revenue paths">
 <g data-art-region="levers">{['PRICING','CONVERSION','RETENTION'].map((t,i)=><g key={t}><rect x={69+i*183} y="29" width="168" height="47" rx="7" fill="#252b40" stroke="#647186"/><text x={153+i*183} y="58" fill="#c0cee7" fontSize="15" textAnchor="middle">{t}</text></g>)}</g>
 <g data-art-region="scenarios">{[110,164,218,272].map(y=><path key={y} d={'M77 '+y+'H580'} stroke="#9ba8c5" opacity=".16"/>)}{[['M78 264 C276 253 322 167 580 103','#b6e4c9'],['M78 264 C273 248 396 218 580 190','#b4bcef'],['M78 264 C249 267 391 259 580 248','#dbb8a4']].map(([d,color])=><path key={d} d={d} stroke={color} fill="none" strokeWidth="3" className={art.draw}/>)}</g>
 <g data-art-region="legend">{['UPSIDE','BASE','DOWNSIDE'].map((t,i)=><g key={t}><circle cx={90+i*168} cy="318" r="5" fill={['#b6e4c9','#b4bcef','#dbb8a4'][i]}/><text x={103+i*168} y="324" fontSize="16" fill="#c4cad9">{t}</text></g>)}</g></Plate></Frame>;
}
export function SceneFigure({id}:{id:StoryId}){
 switch(id){
 case "shyam":return <Machine/>;
 case "fundlenz":return <FundArt/>;
 case "dhaninfo":return <DhanInfoArt/>;
 case "research":return <ResearchArt/>;
 case "fincalc":return <FinArt/>;
 case "dcf":return <DcfArt/>;
 case "ternwell":return <TernwellArt/>;
 case "crowd":return <CrowdArt/>;
 case "study":return <StudyArt/>;
 case "vs":return <VsArt/>;
 case "synk":return <SynkArt/>;
 default:return null;
 }
}

