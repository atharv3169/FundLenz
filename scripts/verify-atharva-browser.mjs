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
  const faults=[];
  socket.addEventListener("message",event=>{
    const data=JSON.parse(event.data);
    if(data.method==="Runtime.exceptionThrown")faults.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
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
  await until(()=>js('!!document.querySelector("#story-ternwell")'),60000);
  await js('document.fonts.ready.then(()=>true)');

  const ids=["shyam","fundlenz","research","fincalc","dcf","ternwell","crowd","study","vs","synk"];
  const screens=[];
  const view=(width,height)=>cmd("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<600});
  const base="http://127.0.0.1:41893";
  const navigate=async(route,selector)=>{
    await cmd("Page.navigate",{url:base+route});
    await until(()=>js("location.pathname==="+JSON.stringify(route.split("#")[0])+"&&!!document.querySelector("+JSON.stringify(selector)+")"),30000);
    await js("document.fonts.ready.then(()=>true)");
    await sleep(160);
  };
  async function capture(name){
    const shot=await cmd("Page.captureScreenshot",{format:"jpeg",quality:76,captureBeyondViewport:false});
    await writeFile(path.join(output,name+".jpg"),Buffer.from(shot.data,"base64"));
    screens.push(name);
  }
  const assertNoHorizontal=async(label)=>{
    assert.ok(await js("document.documentElement.scrollWidth<=document.documentElement.clientWidth+2"),label+" horizontal page overflow");
  };
  const counts={homepage:0,stories:0,progress:0,back:0,theme:0,spectrum:0,explored:0};
  for(const [width,height] of [[1440,900],[390,844],[320,667]]){
    await view(width,height);
    await navigate("/atharva","#atharva-portfolio");
    assert.deepEqual(await js('Array.from(document.querySelectorAll("section[data-story]"),e=>e.dataset.story)'),ids);
    assert.equal(await js('document.querySelectorAll("[data-story-link]").length'),10,"ten direct project links");
    assert.equal(await js('document.querySelectorAll("[data-role=story-reader],dialog[data-mobile-story]").length'),0,"no readers or dialogs on the stacked homepage");
    for(const id of ids){
      const link=await js("document.querySelector('[data-story-link="+id+"]').getAttribute('href')");
      assert.equal(link,"/atharva/stories/"+id,"each project routes to its own full story");
      assert.equal(await js("document.getElementById('story-"+id+"').dataset.expanded"),"false","previews never expand");
    }
    const quote='document.querySelector("[aria-label=\\\"Whole page progress\\\"]")';
    assert.ok(await js("!!"+quote),"visible full-page progress");
    const colors=[];
    for(const id of ["fundlenz","research","fincalc","dcf","synk"]){
      await js("document.getElementById('"+(width<768?"paper-":"story-")+id+"').scrollIntoView({block:'start',behavior:'instant'})");
      await sleep(280);
      const progress=await js("(()=>{const meter="+quote+",root=document.getElementById('atharva-portfolio');return {color:meter.style.getPropertyValue('--story-ink'),value:Number(meter.getAttribute('aria-valuenow')),active:root.dataset.activeStory,visible:getComputedStyle(meter).display!=='none',gradient:meter.style.getPropertyValue('--story-spectrum'),transform:getComputedStyle(meter.querySelector('i')).transform,clip:getComputedStyle(meter.querySelector('i')).clipPath}})()");
      assert.ok(progress.visible,"portfolio progress strip visible at "+width+"px");
      assert.ok(progress.value>0&&progress.value<=100,"portfolio fill responds to page scroll");
      assert.equal(progress.transform,"none","rainbow never scales or squashes its color spectrum");
      assert.ok(progress.clip.startsWith("inset("),"rainbow progresses by revealing fixed-width colors");
      const accentList=await js("Array.from(document.querySelectorAll('section[data-story]'),e=>getComputedStyle(e).getPropertyValue('--accent').trim())");
      assert.equal(accentList.length,10,"exactly ten thematic story colors");
      assert.ok(accentList.every(color=>progress.gradient.includes(color)),"spectrum uses every existing project's own color");
      colors.push(progress.color);
      counts.spectrum++;
      counts.progress++;
    }
    assert.ok(new Set(colors).size>=3,"main page progress changes color as the active story changes");
    if(width<768){
      assert.ok(await js('Array.from(document.querySelectorAll("section[data-story]"),s=>getComputedStyle(s).position).every(v=>v==="sticky")'),"all previews stay in stable sticky stack");
    }
    await assertNoHorizontal("homepage "+width);
    await capture(width+"-home-story-stack");
    counts.homepage++;
    if(width===390){
      await js('document.querySelector("[aria-label=\\\"Dark paper\\\"]")?.click()');
      // The selected paper theme must not change href routing.
      assert.equal(await js("document.querySelector('[data-story-link=dcf]').getAttribute('href')"),"/atharva/stories/dcf");
    }
    const storyIds=width===390?ids:width===1440?["shyam","fundlenz","fincalc","dcf"]:["research","synk"];
    for(const id of storyIds){
      await navigate("/atharva/stories/"+id,'main[data-story-page="'+id+'"]');
      const detail=await js("(()=>{const m=document.querySelector('[data-story-page]'),bar=m.querySelector('[aria-label=\\\"Case study reading progress\\\"]'),chapter=m.querySelectorAll('[data-case-chapter]');return {id:m.dataset.storyPage,title:m.querySelector('h1').textContent,chapters:chapter.length,bar:!!bar,color:m.style.getPropertyValue('--case-accent'),rail:!!m.querySelector('aside[aria-label=\\\"Case study sections\\\"]'),goBack:m.querySelector('a[href^=\\\"/atharva#paper-\\\"]')?.getAttribute('href'),next:!!m.querySelector('a[href^=\\\"/atharva/stories/\\\"]')}})()");
      assert.equal(detail.id,id);
      assert.ok(detail.title.length>=3&&detail.chapters>=1, id+" story has its authored chapters");
      assert.ok(detail.bar&&detail.rail, id+" has reading progress rail and top line");
      const accessible=await js("(()=>{const rail=document.querySelector('[aria-label=\\\"Case study sections\\\"]'),progress=rail.querySelector('[role=progressbar]'),links=[...rail.querySelectorAll('a[href^=\\\"#case-\\\"]')];return {hasProgress:!!progress,hasLinks:links.length>0,independent:!!progress&&links.every(link=>!progress.contains(link))}})()");
      assert.ok(accessible.hasProgress&&accessible.hasLinks&&accessible.independent,id+" chapter links must remain accessible outside the progressbar");
      assert.equal(detail.goBack,"/atharva#paper-"+id);
      assert.ok(detail.color.startsWith("#"),"case-study progress inherits its color");
      const ribbon=await js("(()=>{const m=document.querySelector('[data-story-page]'),p=m.querySelector('[aria-label=\\\"Story sequence progress\\\"]'),fill=p.querySelector('[class*=topFill]'),segments=m.querySelectorAll('a[data-story-segment]');return {segments:segments.length,current:m.querySelector('a[data-story-segment][aria-current=page]')?.dataset.storySegment,completed:[...segments].filter(e=>e.dataset.segmentState==='complete').length,upcoming:[...segments].filter(e=>e.dataset.segmentState==='upcoming').length,gradient:m.style.getPropertyValue('--story-spectrum'),clip:getComputedStyle(fill).clipPath,transform:getComputedStyle(fill).transform,value:Number(p.getAttribute('aria-valuenow'))}})()");
      assert.equal(ribbon.segments,10,"the Katerina-style ribbon contains all ten projects");
      assert.equal(ribbon.current,id,"timeline highlights the current story");
      assert.equal(ribbon.completed,ids.indexOf(id),"all previous story nodes are marked complete");
      assert.equal(ribbon.upcoming,ids.length-ids.indexOf(id)-1,"future story nodes remain unfilled");
      assert.ok(ribbon.clip.startsWith("inset(")&&ribbon.transform==="none","timeline reveals the stationary spectrum, without squeezing it");
      assert.equal(ribbon.value,Math.round(ids.indexOf(id)*10),"global story timeline starts at the correct project");
      counts.spectrum++;
      await assertNoHorizontal(id+" detail "+width);
      if(width===390)await capture(width+"-"+id+"-beginning");
      const max=await js("Math.max(0,document.documentElement.scrollHeight-innerHeight)");
      assert.ok(max>height*.6,id+" case-study has independent long-form page height");
      await js("window.scrollTo({top:"+Math.floor(max*.48)+",behavior:'instant'})");
      await until(()=>js("Number(document.querySelector('[aria-label=\\\"Case study reading progress\\\"]').getAttribute('aria-valuenow'))>=32"),4000);
      const middle=await js("Number(document.querySelector('[aria-label=\\\"Case study reading progress\\\"]').getAttribute('aria-valuenow'))");
      assert.ok(middle>=32&&middle<=72,id+" progress advances through middle of page");
      const atMiddle=await js("Number(document.querySelector('[aria-label=\\\"Story sequence progress\\\"]').getAttribute('aria-valuenow'))");
      assert.ok(Math.abs(atMiddle-(ids.indexOf(id)*10+middle/10))<=1.5,id+" global timeline advances only through the active story segment");
      await js("document.querySelector('a[href=\\\"#case-chapter-0\\\"]').click()");
      await until(()=>js("location.hash==='#case-chapter-0'"),2500);
      await until(()=>js("document.querySelector('a[href=\\\"#case-chapter-0\\\"]').getAttribute('aria-current')==='location'"),4000);
      const activeChapter=await js("document.querySelector('a[href=\\\"#case-chapter-0\\\"]').getAttribute('aria-current')");
      assert.equal(activeChapter,"location",id+" vertical progress follows the active chapter");
      if(width===390&&["shyam","research","fincalc","dcf"].includes(id))await capture(width+"-"+id+"-middle");
      await js("window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})");
      await until(()=>js("Number(document.querySelector('[aria-label=\\\"Case study reading progress\\\"]').getAttribute('aria-valuenow'))>=99"),4000);
      const finish=await js("(()=>{const m=document.querySelector('[data-story-page]');return {pct:Number(m.querySelector('[aria-label=\\\"Case study reading progress\\\"]').getAttribute('aria-valuenow')),end:!!m.querySelector('#case-end'),chapters:m.querySelectorAll('[data-case-chapter]').length,footer:!!m.querySelector('footer a[href^=\\\"/atharva/stories/\\\"]')}})()");
      assert.equal(finish.pct,100,id+" progress reaches 100%");
      assert.ok(finish.end&&finish.footer,"page ends with full content and next/previous stories");
      const globalEnd=await js("Number(document.querySelector('[aria-label=\\\"Story sequence progress\\\"]').getAttribute('aria-valuenow'))");
      assert.equal(globalEnd,(ids.indexOf(id)+1)*10,id+" completed story finishes only its own spectrum segment");
      if(width===390)await capture(width+"-"+id+"-end");
      counts.stories++;
      if(width===390&&["research","fincalc","dcf"].includes(id)){
        await js("document.querySelector('a[href^=\\\"/atharva#paper-\\\"]').click()");
        await until(()=>js("location.pathname==='/atharva'&&!!document.getElementById('story-"+id+"')"),30000);
        assert.equal(await js("location.hash"),"#paper-"+id,"back link selects the previous project");
        assert.ok(await js("document.querySelectorAll('[data-story-link]').length===10"),"return to intact project stack");
        counts.back++;
      }
    }
  }
  // Verify that standalone pages have the same paper colors as the main
  // portfolio on mobile, and share a persistent theme choice across routes.
  await view(390,844);
  await navigate("/atharva","#atharva-portfolio");
  await js('localStorage.setItem("atharva-paper","light")');
  await navigate("/atharva","#atharva-portfolio");await sleep(170);
  const lightHome=await js("getComputedStyle(document.getElementById('atharva-portfolio')).backgroundColor");
  await navigate("/atharva/stories/research",'main[data-story-page="research"]');await sleep(170);
  const lightStory=await js("getComputedStyle(document.querySelector('[data-story-page]')).backgroundColor");
  assert.equal(lightStory,lightHome,"story light paper must exactly match portfolio light-paper color");
  assert.equal(await js("document.querySelector('[aria-label=\\\"Dark paper\\\"]').getAttribute('aria-pressed')"),"false","story starts with saved light theme");
  await capture("390-research-matching-light-paper");
  await js("document.querySelector('[aria-label=\\\"Dark paper\\\"]').click()");
  await until(()=>js("document.querySelector('[data-story-page]').dataset.paper==='dark'"));
  const darkStory=await js("getComputedStyle(document.querySelector('[data-story-page]')).backgroundColor");
  assert.notEqual(darkStory,lightStory,"theme control changes the complete story color scheme");
  await capture("390-research-matching-dark-paper");
  await navigate("/atharva","#atharva-portfolio");await sleep(220);
  const darkHome=await js("getComputedStyle(document.getElementById('atharva-portfolio')).backgroundColor");
  assert.equal(darkStory,darkHome,"story dark paper must exactly match portfolio dark-paper color");
  await navigate("/atharva/stories/fincalc",'main[data-story-page="fincalc"]');await sleep(220);
  assert.equal(await js("document.querySelector('[data-story-page]').dataset.paper"),"dark","saved dark mode persists to a different story");
  await capture("390-fincalc-persisted-dark-paper");
  await js("document.querySelector('[aria-label=\\\"Dark paper\\\"]').click()");
  await until(()=>js("document.querySelector('[data-story-page]').dataset.paper==='light'"));
  assert.equal(await js("localStorage.getItem('atharva-paper')"),"light","light mode persists after toggling back");
  counts.theme+=5;
  // A visitor can explore sequential stories, go back, reload, and return later.
  await view(390,844);
  await navigate("/atharva","#atharva-portfolio");
  await js('localStorage.removeItem("atharva-explored-stories-v1")');
  await navigate("/atharva","#atharva-portfolio");
  const badges=()=>js('Array.from(document.querySelectorAll("[data-story-complete]"),el=>el.dataset.storyComplete)');
  const seen=()=>js('JSON.parse(localStorage.getItem("atharva-explored-stories-v1")||"[]")');
  assert.deepEqual(await badges(),[],"unopened stories have no checkmarks");
  await js('document.querySelector("[data-story-link=fundlenz]").click()');
  await until(()=>js('location.pathname==="/atharva/stories/fundlenz"'),30000);
  await until(async()=>(await seen()).includes("fundlenz"),5000);
  for(const nextId of ["research","fincalc","dcf"]){
    const selector='footer a[href="/atharva/stories/'+nextId+'"]';
    await js("document.querySelector("+JSON.stringify(selector)+").click()");
    await until(()=>js("location.pathname==="+JSON.stringify("/atharva/stories/"+nextId)),30000);
    await until(async()=>(await seen()).includes(nextId),5000);
  }
  const previousSelector='footer a[href="/atharva/stories/fincalc"]';
  await js("document.querySelector("+JSON.stringify(previousSelector)+").click()");
  await until(()=>js('location.pathname==="/atharva/stories/fincalc"'),30000);
  assert.deepEqual(await seen(),["fundlenz","research","fincalc","dcf"],"revisiting never duplicates completions");
  const backSelector='a[href^="/atharva#paper-"]';
  await js("document.querySelector("+JSON.stringify(backSelector)+").click()");
  await until(()=>js('location.pathname==="/atharva"'),30000);
  await until(async()=>(await badges()).length===4,5000);
  assert.deepEqual(await badges(),["fundlenz","research","fincalc","dcf"],"only four explored cards are checked");
  await capture("390-four-explored-cards");
  await navigate("/atharva","#atharva-portfolio");
  await until(async()=>(await badges()).length===4,5000);
  assert.deepEqual(await badges(),["fundlenz","research","fincalc","dcf"],"checkmarks survive reloading");
  await navigate("/atharva/stories/synk",'main[data-story-page="synk"]');
  await until(async()=>(await seen()).includes("synk"),5000);
  await js("document.querySelector("+JSON.stringify(backSelector)+").click()");
  await until(()=>js('location.pathname==="/atharva"'),30000);
  await until(async()=>(await badges()).length===5,5000);
  assert.deepEqual(await badges(),["fundlenz","research","fincalc","dcf","synk"],"later story adds to earlier checkmarks");
  await view(1440,900);
  await navigate("/atharva","#atharva-portfolio");
  assert.equal(await js('getComputedStyle(document.querySelector("[data-story-complete=fundlenz]")).display'),"grid","desktop check is visible");
  await view(320,667);
  await navigate("/atharva","#atharva-portfolio");
  await assertNoHorizontal("320px explored cards");
  assert.equal(await js('getComputedStyle(document.querySelector("[data-story-complete=fundlenz]")).display'),"grid","narrow phone check is visible");
  counts.explored+=6;

  // Direct links must work with no earlier visit to the main portfolio.
  await view(390,844);
  await navigate("/atharva/stories/ternwell",'main[data-story-page="ternwell"]');
  assert.equal(await js("document.querySelector('[data-story-page]').dataset.storyPage"),"ternwell");
  await cmd("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  await navigate("/atharva/stories/shyam",'main[data-story-page="shyam"]');
  assert.ok(await js("document.querySelectorAll('[data-case-chapter]').length>=1"),"reduced motion retains all content");
  await writeFile(path.join(output,"measurements.json"),JSON.stringify({counts,faults,screens},null,2));
  assert.deepEqual(faults,[],"No browser runtime errors");
  console.log("Portfolio browser checks passed: "+JSON.stringify(counts)+", all case-study routes, reading progress, color-changing portfolio line, back links and reduced motion.");
} finally {
  socket?.close();
  if(chrome && chrome.exitCode===null){
    const exited=new Promise(resolve=>chrome.once("exit",resolve));
    chrome.kill();
    await Promise.race([exited,sleep(1500)]);
  }
  await server.close();
  // Chromium can still be flushing its profile when the browser process exits.
  await rm(temp,{recursive:true,force:true,maxRetries:12,retryDelay:200});
}
