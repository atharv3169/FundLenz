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
  socket.addEventListener("message",(event)=>{
    const data=JSON.parse(event.data);
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
  await sleep(600);
  const swarmIdle=await js('({count:document.querySelectorAll("[data-crew-agent]").length,active:document.querySelector("[data-cursor-crew]")?.dataset.working,styles:getComputedStyle(document.querySelector("#full-shyam")).backgroundColor})');
  assert.equal(swarmIdle.count,12,"Desktop cursor crew should follow the real mouse");
  assert.equal(swarmIdle.active,"false","Idle cursor crew must not block the page");
  const closedBounds=await js('(()=>{const p=document.querySelector("#story-shyam button[aria-expanded]").getBoundingClientRect();const section=document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect();return {buttonBottom:p.bottom,stageBottom:section.bottom}})()');
  assert.ok(closedBounds.buttonBottom < closedBounds.stageBottom - 15,"Shyam action must not be clipped: "+JSON.stringify(closedBounds));
  const beforeMorph=await js('document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect().width');
  assert.ok(beforeMorph>1100,"Overview starts full width");
  await js('document.querySelector("#story-shyam button[aria-expanded]").click()');
  await sleep(340);
  const halfway=await js('document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect().width');
  assert.ok(halfway<beforeMorph && halfway>480,"Overview must smoothly resize through intermediate widths: "+halfway);
  const swarmActive=await js('({active:document.querySelector("[data-cursor-crew]").dataset.working,figureGuide:document.querySelector("[data-crew-figure]").style.opacity,titleGuide:document.querySelector("[data-crew-title]").style.opacity})');
  assert.equal(swarmActive.active,"true","Cursor crew should choreograph the real layout on click");
  assert.equal(swarmActive.titleGuide,"1","Moving headline selection guide should follow target");
  await shot("desktop-shyam-cursor-crew-midway.png");
  await shot("desktop-shyam-morph-midway.png");
  await sleep(1590);
  const morph=await js('({stage:document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect().width,panel:document.querySelector("#story-shyam [data-role=story-reader]").getBoundingClientRect().width,inert:document.querySelector("#full-shyam").inert,hidden:document.querySelector("#full-shyam").getAttribute("aria-hidden")})');
  assert.ok(morph.stage<650&&morph.panel>700,"Story morphs into left overview / right reader: "+JSON.stringify(morph));
  assert.equal(morph.hidden,"false","Reader must be accessible when open");
  assert.equal(morph.inert,false,"Reader controls must work when open");
  const storyReaderBg=await js('getComputedStyle(document.querySelector("#full-shyam")).backgroundColor');
  assert.ok(storyReaderBg==="rgba(0, 0, 0, 0)"||storyReaderBg==="transparent","No solid story box: "+storyReaderBg);
  const overviewIntro=await js('({opacity:getComputedStyle(document.querySelector("#story-shyam [class*=storyIntro]")).opacity,maxHeight:getComputedStyle(document.querySelector("#story-shyam [class*=storyIntro]")).maxHeight})');
  assert.equal(overviewIntro.opacity,"1","Expanded overview should retain larger supporting text");
  await shot("desktop-shyam-expanded.png");
  const startScroll=await js("window.scrollY");
  await cmd("Input.dispatchMouseEvent",{type:"mouseWheel",x:1060,y:510,deltaY:700,deltaX:0});
  await sleep(450);
  const scrolled=await js('({documentTop:window.scrollY,readerTop:document.querySelector("#full-shyam").scrollTop,readerOverflow:getComputedStyle(document.querySelector("#full-shyam")).overflowY,stageTop:document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect().top})');
  assert.ok(scrolled.documentTop>startScroll+130&&scrolled.readerTop===0&&scrolled.readerOverflow!=="auto","Wheel over story must scroll the whole document: "+JSON.stringify(scrolled));
  await shot("desktop-shyam-page-scroll.png");
  assert.equal(await js('document.querySelectorAll("#full-shyam button").length'),1,"No duplicate bottom Back to overview button");
  await js('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
  await sleep(1700);
  const reverseMorph=await js('({stage:document.querySelector("#story-shyam [data-role=story-overview]").getBoundingClientRect().width,hidden:document.querySelector("#full-shyam").getAttribute("aria-hidden"),inert:document.querySelector("#full-shyam").inert})');
  assert.ok(reverseMorph.stage>1100,"Reverse morph must restore full-width overview: "+JSON.stringify(reverseMorph));
  assert.equal(reverseMorph.hidden,"true");
  assert.equal(reverseMorph.inert,true);
  await js('document.querySelector("#story-shyam button[aria-expanded]").click()');
  await sleep(1660);
  assert.equal(await js('document.querySelector("#full-shyam")?.textContent.includes("80 lakh")'),true);
  assert.ok(await js('document.querySelectorAll("#full-shyam article").length')>=3);
  await js('document.getElementById("story-fundlenz").scrollIntoView({block:"start",behavior:"instant"})');
  await js('document.querySelector("#story-fundlenz button[aria-expanded]").click()');
  await until(()=>js('Boolean(document.querySelector("#full-fundlenz input[type=range]"))'));
  assert.ok(await js('document.getElementById("full-fundlenz").textContent.includes("ALPHA")'),"Fund mini tool populated");
  await js('(()=>{const e=document.querySelector("#full-fundlenz input[type=range]");window.scrollBy({top:e.getBoundingClientRect().top-210,behavior:"instant"});})()');
  await js('document.getElementById("story-fundlenz").scrollIntoView({block:"start",behavior:"instant"})');
  await sleep(950);
  await shot("desktop-fund-mini.png");
  await js('document.getElementById("story-dcf").scrollIntoView({block:"start",behavior:"instant"})');
  await js('document.querySelector("#story-dcf button[aria-expanded]").click()');
  await until(()=>js('Boolean(document.querySelector("#full-dcf input[type=number]"))'));
  assert.ok(await js('document.getElementById("full-dcf").textContent.includes("ENTERPRISE VALUE")'));
  await js('(()=>{const e=document.querySelector("#full-dcf input[type=number]");window.scrollBy({top:e.getBoundingClientRect().top-210,behavior:"instant"});})()');
  await js('document.getElementById("story-dcf").scrollIntoView({block:"start",behavior:"instant"})');
  await sleep(950);
  await shot("desktop-dcf-mini.png");
  await js('document.getElementById("story-study").scrollIntoView({block:"start",behavior:"instant"})');
  await js('document.querySelector("#story-study button[aria-expanded]").click()');
  await until(()=>js('Boolean(document.querySelector("#full-study input[aria-label]"))'));
  assert.ok(await js('document.querySelectorAll("#full-study input[type=checkbox]").length')>=3);
  await js('document.getElementById("story-synk").scrollIntoView({block:"start",behavior:"instant"})');
  await sleep(800);
  await shot("desktop-synk-fpa.png");
  assert.ok(await js('document.querySelector("#story-synk").textContent.includes("paywall implementation")'),"SYNK FP&A work is source-correct");
  await js('document.querySelector("#story-synk button[aria-expanded]").click()');
  await sleep(1430);
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
  await js('document.querySelector("#story-crowd [data-role=story-reader] button").click()');
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
