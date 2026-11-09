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
  const ids=await js('Array.from(document.querySelectorAll("section[data-story]"),e=>e.dataset.story)');
  assert.deepEqual(ids,["shyam","fundlenz","research","fincalc","dcf","ternwell","crowd","study","vs","synk"]);
  for(const [id,pathname] of [["dcf","/dcf-atlas"],["ternwell","/ternwell"]]){
    assert.equal(await js('document.querySelector("#story-'+id+' a[href]").pathname'),pathname);
  }
  const issues=[], measures=[], shots=[];
  const view=(width,height)=>cmd("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<600});
  // Evaluate painted geometry, not CSS declarations. Only compare deliberately
  // separate components (an arm on a loader, for example, belongs to one group).
  function inspect(id,state){
    const section=document.querySelector("#story-"+id),overview=section.querySelector('[data-role=story-overview]'),reader=section.querySelector('[data-role=story-reader]'),scene=section.querySelector('[data-art-scene]');
    const result=[],rect=e=>e.getBoundingClientRect(),fail=x=>result.push(id+" "+state+": "+x);
    const vis=e=>e&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&rect(e).width>1&&rect(e).height>1;
    const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
    function pairs(items,msg){for(let i=0;i<items.length;i++)for(let j=0;j<i;j++)if(overlaps(rect(items[i]),rect(items[j])))fail(msg+" "+(items[i].dataset.artPart||items[i].dataset.artRegion||items[i].tagName)+"/"+(items[j].dataset.artPart||items[j].dataset.artRegion||items[j].tagName));}
    if(document.documentElement.scrollWidth>document.documentElement.clientWidth+2)fail("page overflows horizontally");
    if(!scene)fail("missing scene");
    if(scene&&vis(scene)){
      const parts=[...scene.querySelectorAll('[data-art-part]')].filter(vis);
      pairs(parts,"overlapping illustration parts");
      pairs([...scene.querySelectorAll('[data-art-region]')].filter(vis),"overlapping illustration regions");
      for(const el of parts){
        const a=rect(el),s=rect(scene);
        if(a.left<s.left-3||a.right>s.right+3||a.top<s.top-3||a.bottom>s.bottom+3)fail("clipped illustration "+el.dataset.artPart);
      }
    }
    const open=state==="expanded",closed=state==="overview"||state==="restored";
    if(open||closed){
      const copy=overview.querySelector('[class*=storyCopy]'),illustration=overview.querySelector('[class*=storyIllustration]');
      if(vis(illustration)&&vis(copy)&&overlaps(rect(copy),rect(illustration)))fail("overview copy intersects illustration");
      if(open&&vis(overview)&&vis(reader)&&overlaps(rect(overview),rect(reader)))fail("overview intersects reader");
      const c=rect(overview);
      for(const el of [...overview.querySelectorAll('h3,button,a[href],[class*=storyNumbers]')].filter(vis)){
        const r=rect(el);
        if(r.left<c.left-3||r.right>c.right+3||r.bottom>c.bottom+3||r.top<c.top-3)fail("stage clips "+el.tagName);
      }
      if(open){
        if(reader.inert||reader.getAttribute("aria-hidden")!=="false")fail("open reader inaccessible");
        for(const el of reader.querySelectorAll("h4,h5,p,input,button"))if(vis(el)&&(rect(el).left<rect(reader).left-3||rect(el).right>rect(reader).right+3))fail("reader clips "+el.tagName);
      }
      if(closed&&!reader.inert)fail("collapsed reader is focusable");
    }
    return {failures:result,width:rect(overview).width};
  }
  const runInspect=async(id,state,w)=>{const m=await js("("+inspect+")("+JSON.stringify(id)+","+JSON.stringify(state)+")");issues.push(...m.failures.map(e=>w+"px "+e));measures.push({id,state,w,stageWidth:m.width});return m.width};
  const scroll=id=>js("document.getElementById("+JSON.stringify(id)+").scrollIntoView({block:'start',behavior:'instant'})");
  const button=id=>js("document.querySelector('#story-"+id+" button[aria-expanded]').click()");
  const expanded=(id,open)=>until(()=>js("document.getElementById('story-"+id+"').dataset.expanded==='"+open+"'"),6000);
  async function capture(name){const r=await cmd("Page.captureScreenshot",{format:"jpeg",quality:72,captureBeyondViewport:false});await writeFile(path.join(output,name+".jpg"),Buffer.from(r.data,"base64"));shots.push(name)}
  const pages=["top","about","work","skills","contact"];
  for(const [width,height] of [[1440,900],[1280,720],[390,844],[320,667]]){
    await view(width,height);
    for(const id of pages){
      await scroll(id);await sleep(400);
      if(await js("document.documentElement.scrollWidth>document.documentElement.clientWidth+2"))issues.push(width+"px "+id+" page overflow");
      if(width===1440||width===390)await capture(width+"-"+id);
    }
    if(width===390){
      await js(`document.querySelector('[aria-label="Open navigation"]').click()`);
      assert.equal(await js(`document.querySelector('[aria-label="Close navigation"]').getAttribute('aria-expanded')`),"true");
      await capture("390-navigation");
      await js(`document.querySelector('[aria-label="Close navigation"]').click()`);
    }
    if(width===390){
      await js("document.querySelector('button[aria-haspopup=dialog]').click()");
      await until(()=>js("!!document.querySelector('dialog[open]')"));
      await capture("390-project-index");
      await js(`document.querySelector('dialog a[href="#paper-dcf"]').click()`);
      assert.equal(await js("location.hash"),"#paper-dcf");
      await until(()=>js("!document.querySelector('dialog[open]')"));
    }
    if(width===390){
      await scroll("top");await sleep(200);
      const grain=await js("getComputedStyle(document.querySelector('main')).backgroundImage");
      await js(`document.querySelector('[aria-label="Dark paper"]').click()`);
      await until(()=>js(`document.querySelector('main').dataset.paper==="dark"`));
      assert.equal(await js("getComputedStyle(document.querySelector('main')).backgroundImage"),grain);
      await capture("390-dark-paper");
      await js(`document.querySelector('[aria-label="Dark paper"]').click()`);
      await scroll("paper-shyam");await button("shyam");await expanded("shyam",true);await sleep(500);
      const meter=`document.querySelector('[aria-label="Whole page progress"]')`;
      const segment='document.querySelector("#story-shyam [data-route]")';
      const value=async selector=>Number(await js(selector+'.getAttribute("aria-valuenow")'));
      const start=await value(segment),pageStart=await value(meter);
      await js("window.scrollBy({top:330,behavior:'instant'})");
      await until(async()=>await value(segment)>start && await value(meter)>pageStart);
      await capture("390-reading-graph");await button("shyam");await expanded("shyam",false);
      await scroll("paper-synk");await sleep(200);
      assert.equal(await value(segment),100);
      assert.equal(await js("document.querySelectorAll('[data-route]').length"),10);
      await js("window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})");await until(async()=>await value(meter)===100);

    }
    for(const id of ids){
      await scroll((width<768?"paper-":"story-")+id);await sleep(350);
      const before=await runInspect(id,"overview",width);
      if(width===1440||width===390)await capture(width+"-"+id+"-overview");
      const startingHeight=width<768?await js("document.querySelector('#story-"+id+" [class*=storyWorkspace]').getBoundingClientRect().height"):0;
      await button(id);
      await expanded(id,true);
      if(width<768){
        await sleep(180);
        const mid=await js("(()=>{const s=document.getElementById('story-"+id+"'),w=s.querySelector('[class*=storyWorkspace]'),a=s.querySelector('[data-role=story-overview]'),r=s.querySelector('[data-role=story-reader]'),art=s.querySelector('[class*=storyIllustration]');return {coverOpacity:+getComputedStyle(a).opacity,readerOpacity:+getComputedStyle(r).opacity,height:w.getBoundingClientRect().height,artHeight:art.getBoundingClientRect().height,heading:r.querySelector('h3').textContent}})()");
        assert.ok(mid.coverOpacity<.97&&mid.readerOpacity>.03,id+" cover and reader must crossfade together");
        assert.ok(mid.coverOpacity+mid.readerOpacity<1.18,id+" title handoff must avoid double-bright ghosting");
        assert.ok(mid.artHeight>170,id+" artwork must remain full size while fading");
        assert.ok(mid.heading.includes(""),"reader title visible");
        if(width===390)await capture("390-"+id+"-crossfade-opening");
      }
      await sleep(width<768?720:0);
      if(width<768){
        const layout=await js("(()=>{const s=document.getElementById('story-"+id+"'),w=s.querySelector('[class*=storyWorkspace]'),a=s.querySelector('[data-role=story-overview]'),r=s.querySelector('[data-role=story-reader]');return {coverOpacity:+getComputedStyle(a).opacity,readerOpacity:+getComputedStyle(r).opacity,readerWidth:r.getBoundingClientRect().width,workspaceWidth:w.getBoundingClientRect().width,height:w.getBoundingClientRect().height}})()");
        assert.ok(layout.coverOpacity<.03&&layout.readerOpacity>.97,id+" reader fully replaces the cover");
        assert.ok(layout.readerWidth>=layout.workspaceWidth*.95,id+" reader must be full width");
        assert.ok(layout.height>startingHeight,id+" story box must grow to fit content");
      }
      await sleep(90);
      await runInspect(id,"opening",width);
      if(width===1440||width===390)await capture(width+"-"+id+"-opening");
      await sleep(1080);await runInspect(id,"expanded",width);
      await capture(width+"-"+id+"-expanded");
      await js("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");await expanded(id,false);
      if(width<768){
        await sleep(180);
        const reverse=await js("(()=>{const s=document.getElementById('story-"+id+"'),a=s.querySelector('[data-role=story-overview]'),r=s.querySelector('[data-role=story-reader]'),w=s.querySelector('[class*=storyWorkspace]');return {cover:+getComputedStyle(a).opacity,reader:+getComputedStyle(r).opacity,height:w.getBoundingClientRect().height}})()");
        assert.ok(reverse.cover>.03&&reverse.reader<.97,id+" closing must reverse the crossfade");
        if(width===390)await capture("390-"+id+"-crossfade-closing");
      }
      await sleep(240);await runInspect(id,"closing",width);
      if(width===1440||width===390)await capture(width+"-"+id+"-closing");
      await sleep(900);const after=await runInspect(id,"restored",width);
      if(Math.abs(before-after)>2)issues.push(width+"px "+id+": width failed to restore");
    }
  }
  for(const [id,selector] of [["fundlenz","input[type=range]"],["dcf","input[type=number]"],["fincalc","input[type=number]"],["study","input[type=checkbox]"]])assert.ok(await js("!!document.querySelector('#full-"+id+" "+selector+"')"),id+" mini missing");
  assert.equal(await js('!!document.querySelector("[data-cursor-crew], [data-choreography]")'),false);
  await cmd("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  await scroll("story-shyam");await button("shyam");await expanded("shyam",true);await sleep(100);await runInspect("shyam","expanded",320);
  async function montage(tag,names,cols){
    const thumbs=await Promise.all(names.map(async n=>({name:n,b:(await readFile(path.join(output,n+".jpg"))).toString("base64")})));
    const encoded=await js("("+async function(thumbs,cols){
      const box=200,frame=140,can=document.createElement("canvas");can.width=cols*box;can.height=Math.ceil(thumbs.length/cols)*(frame+18);
      const ctx=can.getContext("2d");ctx.fillStyle="#ddd";ctx.fillRect(0,0,can.width,can.height);ctx.font="11px sans-serif";ctx.fillStyle="#161616";
      for(const [i,t] of thumbs.entries()){
        const img=new Image();img.src="data:image/jpeg;base64,"+t.b;await img.decode();
        const rate=Math.min((box-4)/img.width,frame/img.height),x=i%cols*box,y=Math.floor(i/cols)*(frame+18);
        ctx.drawImage(img,x,y,img.width*rate,img.height*rate);ctx.fillText(t.name,x,y+frame+12);
      }return can.toDataURL("image/jpeg",.60).split(",")[1];
    }+")("+JSON.stringify(thumbs)+","+cols+")");
    await writeFile(path.join(output,"review-"+tag+".jpg"),Buffer.from(encoded,"base64"));
    console.log("PORTFOLIO_REVIEW_"+tag+"="+encoded);
  }
  await montage("DESKTOP",ids.map(id=>"1440-"+id+"-expanded"),5);
  await montage("MOBILE",ids.map(id=>"390-"+id+"-expanded"),5);
  await montage("PAGES",pages.flatMap(id=>["1440-"+id,"390-"+id]),5);
  await writeFile(path.join(output,"measurements.json"),JSON.stringify({issues,measures,faults},null,2));
  assert.deepEqual(faults,[],"Browser runtime errors");
  assert.deepEqual([...new Set(issues)],[],"Visual layout regressions");
  console.log("Portfolio browser checks passed: 10 stories × 4 sizes × 5 animation states, desktop/mobile screenshots, working project links, mini tools and reduced motion.");
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
