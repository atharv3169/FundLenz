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
      if(open&&!reader.closest("dialog[open]")&&vis(overview)&&vis(reader)&&overlaps(rect(overview),rect(reader)))fail("overview intersects reader");
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
      await scroll("paper-shyam");await button("shyam");await expanded("shyam",true);
      await until(()=>js("document.querySelector('dialog[data-mobile-story=shyam]').open"));
      await sleep(600);
      const pageBefore=await js("scrollY");
      await js("document.querySelector('dialog[data-mobile-story=shyam]').scrollTop=330");
      await until(()=>js("Number(document.querySelector('dialog[data-mobile-story=shyam]').style.getPropertyValue('--reading-progress'))>.01"));
      assert.ok(Math.abs(await js("scrollY")-pageBefore)<2,"case-study scroll must not move the stacked page");
      await capture("390-reading-graph");
      await js("document.querySelector('dialog[data-mobile-story=shyam] [class*=mobileStoryToolbar] button').click()");
      await expanded("shyam",false);
      await until(()=>js("!document.querySelector('dialog[data-mobile-story=shyam]').open"));
      const meter=`document.querySelector('[aria-label="Whole page progress"]')`;
      const segment='document.querySelector("#story-shyam [data-route]")';
      const value=async selector=>Number(await js(selector+'.getAttribute("aria-valuenow")'));
      await scroll("paper-synk");await sleep(200);
      assert.equal(await value(segment),100);
      assert.equal(await js("document.querySelectorAll('[data-route]').length"),10);
      await js("window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})");await until(async()=>await value(meter)===100);

    }
    if(width===390){
      // The mobile stack is one stable preview surface. Each case study opens
      // in the browser top layer and scrolls independently. A later card can
      // never paint over an unfinished chapter because it is not in that layer.
      const audit=()=>["shyam","fundlenz","research","fincalc","dcf","ternwell","crowd","study","vs","synk"].map(id=>{
        const e=document.getElementById("story-"+id),style=getComputedStyle(e),rect=e.getBoundingClientRect();
        return {id,position:style.position,z:Number(style.zIndex),top:rect.top,height:rect.height,opacity:Number(getComputedStyle(e.querySelector("[data-entry]")).opacity)};
      });
      for(const id of ["research","fincalc","fundlenz","dcf","ternwell","synk"]){
        await scroll("paper-"+id);await sleep(150);
        const bg=await js("scrollY"),before=await js("("+audit+")()");
        await button(id);await expanded(id,true);
        const dialog="document.querySelector('dialog[data-mobile-story="+id+"]')";
        await until(()=>js(dialog+".open"));await sleep(650);
        const opened=await js("("+audit+")()");
        assert.ok(opened.every((s,i)=>s.position==="sticky"&&s.z===i+1),id+" every preview must remain in its original stack");
        assert.ok(opened.every((s,i)=>Math.abs(s.height-before[i].height)<3),id+" reader must not change any card height");
        assert.ok(opened.every(s=>s.opacity>.99),id+" no project may vanish when another is opened");
        assert.equal(await js("document.querySelectorAll('dialog[data-mobile-story][open]').length"),1,"only one case study may take the top layer");
        assert.ok(await js(dialog+".matches(':modal')"),id+" reader must be native modal and inert the background");
        await js(dialog+".scrollTop=500");await sleep(150);
        const middle=await js("(()=>{const d="+dialog+",content=d.querySelector('[data-role=story-reader]');return {scroll:d.scrollTop,progress:Number(d.style.getPropertyValue('--reading-progress')),visible:document.elementFromPoint(innerWidth/2,innerHeight/2).closest('dialog')===d,readerHeight:content.getBoundingClientRect().height}})()");
        assert.ok(middle.scroll>250&&middle.progress>.02,id+" reader must scroll independently");
        assert.ok(middle.visible,id+" full reader must own the visible surface");
        assert.ok(Math.abs((await js("scrollY"))-bg)<2,id+" background must not move while reading");
        if(["research","fincalc","dcf"].includes(id))await capture("390-"+id+"-reading-middle");
        await js(dialog+".scrollTop="+dialog+".scrollHeight");
        await sleep(150);
        const end=await js("(()=>{const d="+dialog+",tags=d.querySelector('[class*=tagsLine]');return {atBottom:d.scrollTop+d.clientHeight>=d.scrollHeight-5,last:tags.getBoundingClientRect().bottom,viewTop:d.getBoundingClientRect().top}})()");
        assert.ok(end.atBottom,id+" reader must reach its actual bottom");
        assert.ok(end.last<height+2,id+" final project tags must be reachable");
        if(["research","fincalc","dcf"].includes(id))await capture("390-"+id+"-reading-final");
        await js(dialog+".querySelector('[class*=mobileStoryToolbar] button').click()");
        await expanded(id,false);await until(()=>js("!"+dialog+".open"));
        await sleep(70);
        assert.ok(Math.abs(await js("scrollY")-bg)<2,id+" close must restore the same stack scroll position");
        assert.ok((await js("("+audit+")()")).every(s=>s.position==="sticky"&&s.opacity>.99),id+" deck must restore with no missing cards");
      }
      await scroll("paper-shyam");await sleep(250);
      await capture("390-stack-after-random-readers");
    }
    for(const id of ids){
      await scroll((width<768?"paper-":"story-")+id);await sleep(350);
      const before=await runInspect(id,"overview",width);
      if(width===1440||width===390)await capture(width+"-"+id+"-overview");
      const startingHeight=width<768?await js("document.querySelector('#story-"+id+" [class*=storyWorkspace]').getBoundingClientRect().height"):0;
      await button(id);await expanded(id,true);
      if(width<768){
        const dialog="document.querySelector('dialog[data-mobile-story="+id+"]')";
        await until(()=>js(dialog+".open"));
        await sleep(280);
        const mid=await js("(()=>{const d="+dialog+",r=d.querySelector('[data-role=story-reader]'),cover=document.getElementById('story-"+id+"');return {opacity:+getComputedStyle(d).opacity,readerWidth:r.getBoundingClientRect().width,coverHeight:cover.querySelector('[class*=storyWorkspace]').getBoundingClientRect().height,heading:r.querySelector('h3').textContent}})()");
        assert.ok(mid.opacity>.02&&mid.opacity<1.01,id+" full-screen reader must fade in");
        assert.ok(mid.readerWidth>=width*.95,id+" reader must occupy full viewport width");
        assert.ok(Math.abs(mid.coverHeight-startingHeight)<2,id+" opening reader must not resize stack cover");
        assert.ok(mid.heading.includes(""),id+" reader title is present");
        if(width===390)await capture("390-"+id+"-crossfade-opening");
        await sleep(450);
        const layout=await js("(()=>{const d="+dialog+",r=d.querySelector('[data-role=story-reader]');return {open:d.open,readerWidth:r.getBoundingClientRect().width,dialogWidth:d.getBoundingClientRect().width}})()");
        assert.ok(layout.open&&layout.readerWidth>=layout.dialogWidth*.95,id+" reader must fill mobile surface");
      }
      await sleep(90);
      await runInspect(id,"opening",width);
      if(width===1440||width===390)await capture(width+"-"+id+"-opening");
      await sleep(1080);await runInspect(id,"expanded",width);
      await capture(width+"-"+id+"-expanded");
      if(width<768){
        const dialog="document.querySelector('dialog[data-mobile-story="+id+"]')";
        await js(dialog+".querySelector('[class*=mobileStoryToolbar] button').click()");
        await sleep(210);
        const reverse=await js("(()=>{const d="+dialog+";return {open:d.open,opacity:+getComputedStyle(d).opacity,phase:d.dataset.phase}})()");
        assert.ok(reverse.open&&reverse.phase==="closing"&&reverse.opacity<.99,id+" reader must reverse-fade before dismissal");
        if(width===390)await capture("390-"+id+"-crossfade-closing");
        await expanded(id,false);
        await until(()=>js("!"+dialog+".open"));
      }else{
        await js("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");await expanded(id,false);
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
