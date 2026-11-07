import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const root=process.cwd();
const fixture=path.join(root,"scripts/atharva-browser-fixture");
const output=path.join(root,"work/atharva-screenshots");
const temp=await mkdtemp(path.join(tmpdir(),"atharva-browser-"));
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const server=await createServer({
  configFile:false,root:fixture,plugins:[react()],css:{postcss:root},
  server:{host:"127.0.0.1",port:41893,strictPort:true,hmr:false},
  logLevel:"error"
});
let chrome=null,socket=null;
async function until(fn,limit=30000){
  const t=Date.now();let error;
  while(Date.now()-t<limit){
    try{if(await fn())return}catch(e){error=e}
    await sleep(180);
  }
  throw Error("Timed out: "+(error?.message||"condition not met"));
}
try{
  await mkdir(output,{recursive:true});
  await server.listen();
  const bin=process.env.CHROMIUM_PATH || execFileSync("bash",["-lc","command -v google-chrome || command -v google-chrome-stable || command -v chromium"],{encoding:"utf8"}).trim().split("\n")[0];
  assert.ok(bin,"Chromium executable missing");
  chrome=spawn(bin,["--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--no-first-run","--no-default-browser-check","--remote-debugging-port=0","--user-data-dir="+temp,"http://127.0.0.1:41893/"],{stdio:["ignore","ignore","pipe"]});
  let port=0;
  await until(async()=>{
    if(chrome.exitCode!==null)throw Error("Chromium exited with code "+chrome.exitCode);
    try{port=Number((await readFile(path.join(temp,"DevToolsActivePort"),"utf8")).split("\n")[0]);return port>0}catch{return false}
  },20000);
  let page;
  await until(async()=>{const pages=await fetch("http://127.0.0.1:"+port+"/json/list").then(x=>x.json());page=pages.find(x=>x.type==="page"&&x.url.includes("41893"));return !!page;});
  socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true});});
  let index=0;
  const pending=new Map();
  const recording={mode:null,frames:{opening:[],closing:[]}};
  socket.addEventListener("message",(event)=>{
    const data=JSON.parse(event.data);
    if(data.method==="Runtime.exceptionThrown"){
      const e=data.params?.exceptionDetails;
      console.error("BROWSER RUNTIME ERROR:",e?.exception?.description||e?.text||JSON.stringify(e));
    }
    if(data.method==="Runtime.consoleAPICalled"&&data.params?.type==="error"){
      console.error("BROWSER CONSOLE ERROR:",data.params.args?.map(x=>x.value||x.description).join(" ")||"unknown");
    }
    if(data.method==="Page.screencastFrame"){
      const mode=recording.mode;
      if(mode&&recording.frames[mode].length<160)
        recording.frames[mode].push({at:Date.now(),image:data.params.data});
      // Ack with a fresh protocol ID; its response does not need a callback.
      socket.send(JSON.stringify({id:++index,method:"Page.screencastFrameAck",params:{sessionId:data.params.sessionId}}));
      return;
    }
    if(!data.id||!pending.has(data.id))return;
    const handlers=pending.get(data.id);pending.delete(data.id);
    if(data.error)handlers.reject(Error(data.error.message));else handlers.resolve(data.result);
  });
  const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++index;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const js=async(expression)=>{
    const result=await cmd("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const shot=async(filename)=>{
    const data=await cmd("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
    await writeFile(path.join(output,filename),Buffer.from(data.data,"base64"));
  };
  const recordStart=async(mode)=>{
    recording.frames[mode]=[];
    recording.mode=mode;
    await cmd("Page.startScreencast",{format:"jpeg",quality:68,everyNthFrame:1,maxWidth:1440,maxHeight:900});
  };
  const recordStop=async()=>{
    const mode=recording.mode;
    recording.mode=null;
    await cmd("Page.stopScreencast");
    if(!mode)return;
    const frames=recording.frames[mode];
    const dest=path.join(output,"motion-"+mode);
    await mkdir(dest,{recursive:true});
    for(let i=0;i<frames.length;i++)
      await writeFile(path.join(dest,"frame"+String(i).padStart(4,"0")+".jpg"),Buffer.from(frames[i].image,"base64"));
    await writeFile(path.join(dest,"timestamps.csv"),"frame,unix_ms\n"+frames.map((f,i)=>i+","+f.at).join("\n"));
    console.log("Captured "+frames.length+" motion frames for "+mode);
  };

  await cmd("Page.enable");await cmd("Runtime.enable");
  await cmd("Emulation.setDeviceMetricsOverride",{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await until(()=>js('Boolean(document.querySelector("#atharva-portfolio")&&document.querySelector("#story-shyam"))'),60000);
  await sleep(1150);
  assert.equal(await js('document.querySelectorAll("section[data-story]").length'),9,"Nine full-screen stories required");
  assert.equal(await js('document.body.innerText.includes("CGPA")'),false,"No CGPA on portfolio");
  assert.equal(await js('document.getElementById("explore")===null'),true,"Constellation removed");
  assert.equal(await js('document.getElementById("journey")===null'),true,"Timeline removed");
  assert.equal(await js('document.querySelector("#story-shyam a").getAttribute("href")'),"https://shyamconstruction.org/");
  assert.equal(await js('document.querySelector("#story-crowd a")===null'),true,"Crowd has no external arrow");
  assert.equal(await js('document.querySelector("#story-dcf a")===null'),true,"Upcoming DCF route should not be a broken link");
  assert.equal(await js('document.body.innerText.includes("CURIOUSITY")'),false,"No typo in hero");
  assert.equal(await js('document.querySelectorAll("[class*=stageBottom]").length'),0,"Remove redundant per-project bottom legend");
  assert.equal(await js('document.querySelector("#story-crowd").textContent.includes("ESP32")'),false,"Crowd project no longer claims ESP32");
  assert.ok(await js('document.querySelector("#story-synk").textContent.includes("Financial Planning and Analysis Intern")'),"SYNK role reflects LinkedIn");
  assert.ok(await js('document.querySelector("#story-synk").textContent.includes("subscription pricing")'),"SYNK story covers monetisation");
  assert.equal(await js('getComputedStyle(document.querySelector("#story-shyam")).borderBottomStyle'),"none","No hard separator between stories");
  await shot("desktop-hero.png");
  await js('document.getElementById("story-shyam").scrollIntoView({block:"start",behavior:"instant"})');
  await sleep(500);
  await shot("desktop-shyam.png");
  await cmd("Input.dispatchMouseEvent",{type:"mouseMoved",x:670,y:440});
  await sleep(150);
  assert.equal(await js('document.querySelector("[data-cursor-crew]")===null'),true,"No cursor crew should exist until a story action is clicked");
  assert.equal(await js('document.querySelectorAll("[class*=storyPanelHeader]").length'),0,"Remove the entire old dark reader header");
  const closedBounds=await js('(()=>{const p=document.querySelector("#story-shyam button[aria-expanded]").getBoundingClientRect();const section=document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect();return {buttonBottom:p.bottom,stageBottom:section.bottom}})()');
  assert.ok(closedBounds.buttonBottom < closedBounds.stageBottom - 15,"Shyam action must not be clipped: "+JSON.stringify(closedBounds));
  const beforeMorph=await js('document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect().width');
  assert.ok(beforeMorph>1100,"Overview starts full width");
  await js(`(()=>{
    window.__swarmFrameTrace=[];
    const started=performance.now();
    const sample=()=>{
      if(window.__swarmFrameTrace.length>=330)return;
      const scope=document.getElementById("story-shyam");
      const rect=s=>{const r=scope.querySelector(s)?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null;};
      const visible=s=>{const e=scope.querySelector(s);if(!e)return null;const cs=getComputedStyle(e);return {opacity:Number(cs.opacity),visibility:cs.visibility,inline:e.style.opacity,text:e.textContent?.length||0};};
      const crew=document.querySelector("[data-cursor-crew]");
      window.__swarmFrameTrace.push({
        ms:Math.round(performance.now()-started),phase:crew?.dataset.phase||"idle",
        stage:rect("[data-role=story-overview]"),title:rect("[data-crew-target=title]"),
        primary:rect("[data-crew-object=primary]"),secondary:rect("[data-crew-object=secondary]"),
        heading:visible("[data-crew-target=heading]"),
        intro:visible("[data-crew-target=reader-intro]"),
        first:visible("[data-crew-target=chapter] h5"),
        cursors:document.querySelectorAll("[data-crew-agent]").length,
        guides:document.querySelectorAll(".swarm-original-overlay rect").length,
        clones:document.querySelectorAll("[data-cursor-crew] [aria-hidden=true]").length
      });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  })()`);
  await recordStart("opening");
  await js('document.querySelector("#story-shyam button[aria-expanded]").click()');
  await until(()=>js('Boolean(document.querySelector("[data-cursor-crew][data-swarm-engine=upstream]"))'));
  await until(()=>js('document.querySelectorAll("[data-crew-agent]").length===18'));
  const upstream=await js('({engine:document.querySelector("[data-cursor-crew]").dataset.swarmEngine,cursors:document.querySelectorAll("[data-crew-agent]").length,svg:document.querySelectorAll(".swarm-original-cursors .cursor svg").length})');
  assert.equal(upstream.engine,"upstream","Original Swarm Rebuild engine must power the interaction");
  assert.equal(upstream.cursors,18,"Eighteen upstream cursor agents must emerge from the click");
  assert.equal(upstream.svg,18,"Use the original animated cursor SVG renderer");
  await shot("desktop-shyam-agents-select-before-morph.png");
  await until(()=>js('document.querySelector(".swarm-original-overlay rect")!==null'),12000);
  await shot("desktop-shyam-cursor-crew-midway.png");
  await until(()=>js('document.querySelector("#story-shyam").dataset.expanded==="true"'),12000);
  await sleep(310);
  const halfway=await js('document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect().width');
  assert.ok(halfway<beforeMorph&&halfway>400,"Reader must animate through intermediate layout widths: "+halfway);
  await shot("desktop-shyam-morph-midway.png");
  await sleep(650);
  await shot("desktop-shyam-story-typing.png");
  await until(()=>js('document.querySelector("[data-cursor-crew]")===null'),16000);
  const morph=await js('({stage:document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect().width,panel:document.querySelector("#story-shyam [data-role=story-reader]").getBoundingClientRect().width,inert:document.querySelector("#full-shyam").inert,hidden:document.querySelector("#full-shyam").getAttribute("aria-hidden")})');
  assert.ok(morph.stage<650&&morph.panel>700,"Story morphs into left overview / right reader: "+JSON.stringify(morph));
  assert.equal(morph.hidden,"false","Reader must be accessible when open");
  assert.equal(morph.inert,false,"Reader controls must work when open");
  const storyReaderBg=await js('getComputedStyle(document.querySelector("#full-shyam")).backgroundColor');
  assert.ok(storyReaderBg==="rgba(0, 0, 0, 0)"||storyReaderBg==="transparent","No solid story box: "+storyReaderBg);
  const overviewIntro=await js('({opacity:getComputedStyle(document.querySelector("#story-shyam [class*=storyIntro]")).opacity,maxHeight:getComputedStyle(document.querySelector("#story-shyam [class*=storyIntro]")).maxHeight})');
  assert.equal(overviewIntro.opacity,"1","Expanded overview should retain larger supporting text");
  const expandedSeparation=await js('({metricsBottom:document.querySelector("#story-shyam [class*=storyNumbers]").getBoundingClientRect().bottom,artLabelTop:document.querySelector("#story-shyam [class*=figMicro]").getBoundingClientRect().top})');
  assert.ok(expandedSeparation.artLabelTop>expandedSeparation.metricsBottom+8,"Artwork must not overlap enlarged numbers and copy: "+JSON.stringify(expandedSeparation));
  assert.equal(await js('document.querySelector("[class*=storyPanelHeader]")===null'),true,"No rectangular top bar in the story");
  const seamless=await js('({stage:getComputedStyle(document.querySelector("#story-shyam [data-role=story-overview]")).backgroundColor,reader:getComputedStyle(document.querySelector("#full-shyam")).backgroundColor,border:getComputedStyle(document.querySelector("#full-shyam")).borderLeftWidth})');
  assert.equal(seamless.stage,"rgba(0, 0, 0, 0)","Same transparent stage background");
  assert.equal(seamless.reader,"rgba(0, 0, 0, 0)","Same transparent story background");
  assert.equal(seamless.border,"0px","No divider line or reader box border");
  const builtText=await js('({heading:getComputedStyle(document.querySelector("#story-shyam [data-crew-target=heading]")).opacity,intro:getComputedStyle(document.querySelector("#story-shyam [data-crew-target=reader-intro]")).opacity})');
  assert.equal(builtText.heading,"1","Upstream text worker must finish building the story heading");
  assert.equal(builtText.intro,"1","Upstream text worker must finish building the story introduction");
  const state=await js(`(()=>{
    const scope=document.getElementById("story-shyam"),selectors=[
      "[data-crew-target=heading]","[data-crew-target=reader-intro]",
      "[data-crew-target=chapter] h5","[data-crew-target=chapter] p",
      "[data-crew-target=chapter-two] h5","[data-crew-target=chapter-two] p"
    ];
    return {typed:Number(scope.dataset.swarmLastTyped),
      errors:Number(scope.dataset.swarmLastErrors),
      timedOut:scope.dataset.swarmLastTimedOut,
      boxes:Number(scope.dataset.swarmLastMaxBoxes),
      texts:selectors.map(s=>{const e=scope.querySelector(s),v=e&&getComputedStyle(e);
        return {selector:s,opacity:v?.opacity,inline:e?.style.opacity,
          visible:v?.visibility,width:e?.getBoundingClientRect().width,chars:e?.textContent?.length};})};
  })()`);
  assert.equal(state.errors,0,"Swarm must complete without runtime task exceptions: "+JSON.stringify(state));
  assert.equal(state.timedOut,"false","Swarm must finish, not be force-destroyed by watchdog: "+JSON.stringify(state));
  assert.equal(state.typed,6,"All six source-engine typists must complete: "+JSON.stringify(state));
  assert.ok(state.boxes<=9,"Selection outlines should not flood the screen: "+JSON.stringify(state));
  assert.ok(state.texts.every(x=>x.opacity==="1"&&x.visible==="visible"&&x.width>100&&x.chars>0),
     "Every completed text group must remain fully visible: "+JSON.stringify(state.texts));
  await shot("desktop-shyam-expanded.png");
  await sleep(1600);
  const held=await js('Array.from(document.querySelectorAll("#story-shyam [data-crew-target=heading],#story-shyam [data-crew-target=reader-intro],#story-shyam [data-crew-target=chapter] h5,#story-shyam [data-crew-target=chapter-two] h5")).map(e=>getComputedStyle(e).opacity)');
  assert.ok(held.every(v=>v==="1"),"Text must not disappear seconds after the swarm departs: "+held);
  await shot("desktop-shyam-text-still-visible.png");
  await recordStop();
  await writeFile(path.join(output,"swarm-opening-frame-trace.json"),JSON.stringify(await js('window.__swarmFrameTrace'),null,2));
  const startScroll=await js("window.scrollY");
  await cmd("Input.dispatchMouseEvent",{type:"mouseWheel",x:1060,y:510,deltaY:700,deltaX:0});
  await sleep(450);
  const scrolled=await js('({documentTop:window.scrollY,readerTop:document.querySelector("#full-shyam").scrollTop,readerOverflow:getComputedStyle(document.querySelector("#full-shyam")).overflowY,stageTop:document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect().top})');
  assert.ok(scrolled.documentTop>startScroll+130&&scrolled.readerTop===0&&scrolled.readerOverflow!=="auto","Wheel over story must scroll the whole document: "+JSON.stringify(scrolled));
  await shot("desktop-shyam-page-scroll.png");
  assert.equal(await js('document.querySelectorAll("#full-shyam button").length'),0,"No separate close button or dark header");
  await recordStart("closing");
  await js('document.querySelector("#story-shyam button[aria-expanded]").click()');
  await until(()=>js('document.querySelector("[data-cursor-crew]")!==null'));
  assert.equal(await js('document.querySelector("[data-cursor-crew]").dataset.swarmEngine'),"upstream","Reverse uses the same source engine");
  await sleep(350);
  await shot("desktop-shyam-cursors-return.png");
  await until(()=>js('document.querySelector("[data-cursor-crew]")===null'),16000);
  await recordStop();
  const cleanClose=await js('({mode:document.querySelector("#story-shyam").dataset.swarmLastMode,errors:document.querySelector("#story-shyam").dataset.swarmLastErrors,timedOut:document.querySelector("#story-shyam").dataset.swarmLastTimedOut})');
  assert.equal(cleanClose.mode,"close");assert.equal(cleanClose.errors,"0");assert.equal(cleanClose.timedOut,"false");
  const returningTitle=await js('({width:document.querySelector("#story-shyam [data-crew-target=title]").getBoundingClientRect().width,stageWidth:document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect().width})');
  assert.ok(returningTitle.width>240,"The headline must remain readable while cursors undo the layout: "+JSON.stringify(returningTitle));
  const reverseMorph=await js('({stage:document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect().width,hidden:document.querySelector("#full-shyam").getAttribute("aria-hidden"),inert:document.querySelector("#full-shyam").inert})');
  assert.ok(reverseMorph.stage>1100,"Reverse morph must restore full-width overview: "+JSON.stringify(reverseMorph));
  assert.equal(reverseMorph.hidden,"true");
  assert.equal(reverseMorph.inert,true);
  await js('document.querySelector("#story-shyam button[aria-expanded]").click()');
  await until(()=>js('document.querySelector("[data-cursor-crew]")===null'),16000);
  assert.equal(await js('document.querySelector("#full-shyam")?.textContent.includes("80 lakh")'),true);
  assert.ok(await js('document.querySelectorAll("#full-shyam article").length')>=3);
  await js('document.getElementById("story-fundlenz").scrollIntoView({block:"start",behavior:"instant"})');
  await js('document.querySelector("#story-fundlenz button[aria-expanded]").click()');
  await until(()=>js('document.querySelector("#story-fundlenz").dataset.expanded==="true"'));
  await until(()=>js('Boolean(document.querySelector("#full-fundlenz input[type=range]"))'));
  assert.ok(await js('document.getElementById("full-fundlenz").textContent.includes("ALPHA")'),"Fund mini tool populated");
  await js('(()=>{const e=document.querySelector("#full-fundlenz input[type=range]");window.scrollBy({top:e.getBoundingClientRect().top-210,behavior:"instant"});})()');
  await js('document.getElementById("story-fundlenz").scrollIntoView({block:"start",behavior:"instant"})');
  await sleep(950);
  await shot("desktop-fund-mini.png");
  await js('document.getElementById("story-dcf").scrollIntoView({block:"start",behavior:"instant"})');
  await js('document.querySelector("#story-dcf button[aria-expanded]").click()');
  await until(()=>js('document.querySelector("#story-dcf").dataset.expanded==="true"'));
  await until(()=>js('Boolean(document.querySelector("#full-dcf input[type=number]"))'));
  assert.ok(await js('document.getElementById("full-dcf").textContent.includes("ENTERPRISE VALUE")'));
  await js('(()=>{const e=document.querySelector("#full-dcf input[type=number]");window.scrollBy({top:e.getBoundingClientRect().top-210,behavior:"instant"});})()');
  await js('document.getElementById("story-dcf").scrollIntoView({block:"start",behavior:"instant"})');
  await sleep(950);
  await shot("desktop-dcf-mini.png");
  await js('document.getElementById("story-study").scrollIntoView({block:"start",behavior:"instant"})');
  await js('document.querySelector("#story-study button[aria-expanded]").click()');
  await until(()=>js('document.querySelector("#story-study").dataset.expanded==="true"'));
  await until(()=>js('Boolean(document.querySelector("#full-study input[aria-label]"))'));
  assert.ok(await js('document.querySelectorAll("#full-study input[type=checkbox]").length')>=3);
  await js('document.getElementById("story-synk").scrollIntoView({block:"start",behavior:"instant"})');
  await sleep(800);
  await shot("desktop-synk-fpa.png");
  assert.ok(await js('document.querySelector("#story-synk").textContent.includes("paywall implementation")'),"SYNK FP&A work is source-correct");
  await js('document.querySelector("#story-synk button[aria-expanded]").click()');
  await sleep(1780);
  const synkEntry=await js('({sectionTop:document.getElementById("story-synk").getBoundingClientRect().top,headingTop:document.querySelector("#full-synk [class*=longStoryLead]").getBoundingClientRect().top,readerTop:document.querySelector("#full-synk").getBoundingClientRect().top})');
  assert.ok(synkEntry.sectionTop>30&&synkEntry.sectionTop<125&&synkEntry.headingTop>140,"Opening a later story must start its reader from the top: "+JSON.stringify(synkEntry));
  await shot("desktop-synk-fpa-expanded.png");
  assert.ok(await js('document.querySelector("#full-synk").textContent.includes("potential M&A")'),"SYNK long story contains strategy and M&A work");
  await cmd("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await js('window.scrollTo({top:0,behavior:"instant"})');await sleep(700);
  await shot("mobile-hero.png");
  assert.equal(await js('document.querySelector("[data-cursor-crew]")===null'),true,"Cursor crew must not render on mobile");
  let dims=await js('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})');
  assert.ok(dims.scroll<=dims.client+2,"Mobile overflow "+JSON.stringify(dims));
  await js('document.querySelector(\'[aria-label="Open navigation"]\').click()');
  assert.equal(await js('document.querySelector(\'[aria-label="Close navigation"]\').getAttribute("aria-expanded")'),"true");
  await js('document.querySelector(\'[aria-label="Close navigation"]\').click()');
  await js('document.getElementById("story-crowd").scrollIntoView({block:"start",behavior:"instant"})');await sleep(950);
  await shot("mobile-crowd.png");
  await js('document.querySelector("#story-crowd button[aria-expanded]").click()');
  await sleep(950);
  const mobileStory=await js('({stageHeight:document.querySelector("#story-crowd [data-role=story-overview]").getBoundingClientRect().height,readerWidth:document.querySelector("#story-crowd [data-role=story-reader]").getBoundingClientRect().width,hidden:document.querySelector("#full-crowd").getAttribute("aria-hidden")})');
  assert.ok(mobileStory.stageHeight<340&&mobileStory.readerWidth>340&&mobileStory.hidden==="false","Mobile morph must compress the overview and open the reader: "+JSON.stringify(mobileStory));
  await shot("mobile-crowd-expanded.png");
  await js('document.querySelector("#story-crowd button[aria-expanded]").click()');
  await sleep(900);
  assert.equal(await js('document.querySelector("#full-crowd").getAttribute("aria-hidden")'),"true","Close restores mobile overview");
  dims=await js('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})');
  assert.ok(dims.scroll<=dims.client+2,"Mobile story overflow "+JSON.stringify(dims));
  console.log("Portfolio browser checks PASSED: 9 full-screen scenes; mini tools and disclosures; no CGPA; mobile responsive.");
} finally {
  socket?.close();
  if(chrome && chrome.exitCode===null)chrome.kill();
  await server.close();
  await rm(temp,{recursive:true,force:true});
}
