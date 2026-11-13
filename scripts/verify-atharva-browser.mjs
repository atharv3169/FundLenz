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
function accentLab(hex){
  assert.match(hex,/^#[0-9a-f]{6}$/i);
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
  const [r,g,b]=rgb;
  const xyz=[(r*0.4124564+g*0.3575761+b*0.1804375)/0.95047,(r*0.2126729+g*0.7151522+b*0.0721750),(r*0.0193339+g*0.1191920+b*0.9503041)/1.08883].map(v=>v>0.008856?v**(1/3):7.787*v+16/116);
  return [116*xyz[1]-16,500*(xyz[0]-xyz[1]),200*(xyz[1]-xyz[2])];
}
function accentDistance(a,b){const x=accentLab(a),y=accentLab(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);}
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

  const ids=["fundlenz","dhaninfo","research","shyam","dcf","ternwell","fincalc","synk","crowd","vs","study"];
  const storyTitles=["FundLenz","DhanInfo","Mutual-fund research","Shyam Construction","DCF Atlas","Ternwell","FinCalc","SYNK","Crowd-monitoring system","V S Informatics","Study Buddy"];
  const desktopIntro="I use the maths and coding I learned in engineering across corporate-finance decisions, investment research and tools I built, including FundLenz, DCF Atlas and Ternwell.";
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
    assert.deepEqual(await js('Array.from(document.querySelectorAll("section[data-story]"),e=>e.querySelector("h3").textContent.slice(0,-1))'),storyTitles,"mobile and desktop read the same eleven story titles");
    assert.equal(await js('document.querySelector("[class*=heroIntro]")?.textContent'),desktopIntro,"the desktop hero uses the latest engineering-to-finance summary");
    assert.ok(await js('document.querySelector("[class*=aboutColumns]")?.textContent.includes("family business")'),"biography connects engineering skills with family business");
    assert.ok(await js('document.querySelector("[class*=aboutColumns]")?.textContent.includes("finance internships")'),"biography includes research and internships");
    assert.equal(await js('document.querySelectorAll("[class*=skillGroup]").length'),4,"four focused skill groups");
    assert.ok(await js('document.querySelector("[class*=skillsColumns]")?.textContent.includes("UI/UX design")'),"web design skills are present");
    assert.ok(await js('document.querySelector("[class*=skillsColumns]")?.textContent.includes("Risk management")'),"finance and risk management skills are present");
    assert.equal(await js('document.querySelectorAll("[class*=paperLinks] a").length'),2,"social area has two links, no old scroll arrow");
    assert.equal(await js('document.querySelectorAll("[class*=paperLinks] a svg").length'),2,"GitHub and LinkedIn have brand SVG marks");
    assert.equal(await js('document.querySelectorAll("[data-story-link]").length'),ids.length,"all story links");
    const leadCredit=await js("document.querySelector('[data-story=research] [data-story-role=research]')?.textContent");
    assert.equal(leadCredit,"Empirical research paper · Lead author","lead author credit appears in the shared card data");
    const dhanDate=await js("document.querySelector('[data-story=dhaninfo] [class*=cardFolio]')?.textContent");
    assert.ok(dhanDate.includes("November 2026"),"DhanInfo starts in November 2026");
    if(width<768){
      const labels=await js("Array.from(document.querySelectorAll('[data-story-role]'),el=>({text:el.textContent,display:getComputedStyle(el).display}))");
      assert.equal(labels.length,ids.length,"all mobile cards have a short descriptor");
      assert.ok(labels.every(e=>e.display!=="none"&&e.text.length>5),"mobile role descriptors are visible");
    }
    assert.equal(await js('document.querySelectorAll("[data-role=story-reader],dialog[data-mobile-story]").length'),0,"no readers or dialogs on the stacked homepage");
    for(const id of ids){
      const link=await js("document.querySelector('[data-story-link="+id+"]').getAttribute('href')");
      assert.equal(link,"/atharva/stories/"+id,"each project routes to its own full story");
      assert.equal(await js("document.getElementById('story-"+id+"').dataset.expanded"),"false","previews never expand");
    }
    if(width===1440){
      const desktopLayout=await js("(()=>{const nav=document.querySelector('nav[aria-label=\"Portfolio navigation\"]'),hero=document.querySelector('#top'),market=document.querySelector('[class*=marketPlate]'),meter=document.querySelector('[class*=currencyRibbon]'),popup=document.querySelector('[class*=paperIndex]');return {navHeight:Math.round(nav.getBoundingClientRect().height),heroDisplay:getComputedStyle(hero).display,marketDisplay:getComputedStyle(market).display,priceAnimation:getComputedStyle(market.querySelector('[class*=goldTrace]')).animationName,tickerAnimation:getComputedStyle(meter.firstElementChild).animationName,popupDisplay:getComputedStyle(popup).display,navLinks:getComputedStyle(nav.querySelector('[class*=navLinks]')).display,sectionTitles:[...document.querySelectorAll('[id=about],[id=work],[id=skills],[id=contact]')].map(x=>x.id)}})()");
      assert.equal(desktopLayout.navHeight,76,"desktop header retains its 76px layout");
      assert.equal(desktopLayout.heroDisplay,"flex","desktop keeps the original split hero");
      assert.equal(desktopLayout.marketDisplay,"block","desktop keeps its finance-market SVG");
      assert.ok(desktopLayout.priceAnimation.includes("drawPrice"),"desktop market line keeps its original motion");
      assert.ok(desktopLayout.tickerAnimation.includes("ticker"),"desktop finance ticker continues animating");
      assert.equal(desktopLayout.popupDisplay,"block","All stories floats on desktop without altering its navigation");
      assert.equal(desktopLayout.navLinks,"flex","desktop navigation remains unchanged");
      assert.deepEqual(desktopLayout.sectionTitles,["about","work","skills","contact"],"desktop retains original section structure");

      // The figures have one shared SVG source. Verify the mobile versions
      // render at desktop dimensions with the existing desktop animation rules.
      const figures=await js("Array.from(document.querySelectorAll('[data-art-scene]'),f=>{const r=f.getBoundingClientRect();return {id:f.dataset.artScene,width:r.width,height:r.height,heading:f.querySelector('[data-art-part=heading]')?.textContent,caption:f.querySelector('[data-art-part=caption]')?.textContent,hasSvg:!!f.querySelector('svg'),background:getComputedStyle(f).backgroundImage}})");
      assert.deepEqual(figures.map(f=>f.id),ids,"all eleven story illustrations are shared with the desktop");
      assert.ok(figures.every(f=>f.width>250&&f.height>250&&f.hasSvg),"every desktop figure uses a properly sized, responsive SVG");
      assert.ok(figures.every(f=>f.heading?.length>6&&f.caption?.length>6),"desktop illustrations retain project-specific headings and captions");
      const visual=await js("(()=>{const section=document.querySelector('[data-story=fundlenz]'),cover=section.querySelector('[class*=storyIllustration]'),figure=section.querySelector('[data-art-scene]'),rect=figure.getBoundingClientRect(),holder=cover.getBoundingClientRect(),style=getComputedStyle(figure);return {width:rect.width,height:rect.height,holderWidth:holder.width,holderHeight:holder.height,border:style.borderTopWidth,background:style.backgroundImage,mask:style.maskImage}})()");
      assert.ok(visual.width<visual.holderWidth*.88&&visual.height<visual.holderHeight*.85,"desktop art is smaller than the former full-column card");
      assert.equal(visual.border,"0px","desktop scenes have no card border");
      assert.equal(visual.background,"none","desktop scenes show through to the page background");
      assert.ok(visual.mask.includes("radial-gradient"),"desktop scenes fade toward transparent edges");
      assert.ok(figures.every(f=>f.background==="none"),"desktop illustrations have transparent, unboxed surfaces");
      const animations=await js("(()=>{const a=[['shyam','[class*=loaderMove]'],['research','[class*=scatterPoint]'],['dcf','[class*=bar]'],['ternwell','[class*=draw]'],['crowd','[class*=scanBeam]'],['vs','[class*=iotBeacon]']];return a.map(([id,sel])=>{const el=document.querySelector('[data-story='+id+'] '+sel);return {id,animation:el?getComputedStyle(el).animationName:'missing'}})})()");
      assert.ok(animations.every(a=>a.animation!=="none"&&a.animation!=="missing"),"existing desktop animations remain attached to the shared finance figures");
    }
    const quote='document.querySelector("[aria-label=\\\"Whole page progress\\\"]")';
    assert.ok(await js("!!"+quote),"visible full-page progress");
    const colors=[];
    for(const id of ["fundlenz","research","shyam","dcf","synk"]){
      await js("document.getElementById('"+(width<768?"paper-":"story-")+id+"').scrollIntoView({block:'start',behavior:'instant'})");
      await sleep(280);
      const progress=await js("(()=>{const meter="+quote+",root=document.getElementById('atharva-portfolio');return {color:meter.style.getPropertyValue('--story-ink'),value:Number(meter.getAttribute('aria-valuenow')),active:root.dataset.activeStory,visible:getComputedStyle(meter).display!=='none',gradient:meter.style.getPropertyValue('--story-spectrum'),transform:getComputedStyle(meter.querySelector('i')).transform,clip:getComputedStyle(meter.querySelector('i')).clipPath}})()");
      assert.ok(progress.visible,"portfolio progress strip visible at "+width+"px");
      assert.ok(progress.value>0&&progress.value<=100,"portfolio fill responds to page scroll");
      assert.equal(progress.transform,"none","rainbow never scales or squashes its color spectrum");
      assert.ok(progress.clip.startsWith("inset("),"rainbow progresses by revealing fixed-width colors");
      const accentList=await js("Array.from(document.querySelectorAll('section[data-story]'),e=>getComputedStyle(e).getPropertyValue('--accent').trim())");
      assert.equal(accentList.length,ids.length,"thematic color for each story");
      assert.ok(accentList.every(color=>progress.gradient.includes(color)),"spectrum uses every existing project's own color");
       if(width===1440){
         const storyPalette=await js("Array.from(document.querySelectorAll('section[data-story]'),e=>({id:e.dataset.story,color:getComputedStyle(e).getPropertyValue('--accent').trim()}))");
         assert.equal(storyPalette.length,ids.length);
         assert.equal(new Set(storyPalette.map(item=>item.color)).size,ids.length,'every story must have a unique accent');
         assert.equal(storyPalette.find(item=>item.id==='dhaninfo')?.color,'#e97968');
         let nearest=Infinity,nearestPair='';
         for(let i=0;i<storyPalette.length;i++)for(let j=i+1;j<storyPalette.length;j++){const distance=accentDistance(storyPalette[i].color,storyPalette[j].color);if(distance<nearest){nearest=distance;nearestPair=storyPalette[i].id+' / '+storyPalette[j].id;}}
         assert.ok(nearest>=20,'story colors too similar: '+nearestPair+' ('+nearest.toFixed(1)+' Lab units)');
       }
      colors.push(progress.color);
      counts.spectrum++;
      counts.progress++;
    }
    assert.ok(new Set(colors).size>=3,"main page progress changes color as the active story changes");
    const dock=await js("(()=>{const d=document.querySelector('[class*=paperIndex]'),b=d.querySelector('button[aria-label=\"All stories\"]'),r=b.getBoundingClientRect();return {display:getComputedStyle(d).display,position:getComputedStyle(d).position,visible:getComputedStyle(b).display!=='none',right:innerWidth-r.right,bottom:innerHeight-r.bottom}})()");
    assert.equal(dock.display,"block","All stories dock works on desktop and phones");
    assert.equal(dock.position,"fixed","All stories docks to the viewport");
    assert.ok(dock.visible&&dock.right<70&&dock.bottom<90,"All stories floats in the bottom-right corner");
    await js('document.querySelector(\'button[aria-label="All stories"]\').click()');
    await until(()=>js('document.querySelector(\'dialog[aria-label="All stories"]\')?.open'),5000);
    const items=await js("(()=>{const d=document.querySelector('dialog[aria-label=\"All stories\"]');return {ids:[...d.querySelectorAll('[data-story-index]')].map(a=>a.dataset.storyIndex),extra:d.querySelectorAll('a:not([data-story-index])').length,title:d.querySelector('header').textContent}})()");
    assert.deepEqual(items.ids,ids,"the floating index includes the current ten-story order");
    assert.equal(items.extra,0,"stories popup excludes intro, skills and contact");
    assert.ok(items.title.includes("All stories"),"floating index uses the requested title");
    await capture(width+"-all-stories-index");
    await js('document.querySelector(\'dialog[aria-label="All stories"]\').close()');

    if(width<768){
      assert.ok(await js('Array.from(document.querySelectorAll("section[data-story]"),s=>getComputedStyle(s).position).every(v=>v==="sticky")'),"all previews stay in stable sticky stack");
    }
    await assertNoHorizontal("homepage "+width);
    if(width<768){
      const motif=await js("(()=>{const m=document.querySelector('[data-finance-motif=risk-distribution]'),hero=document.querySelector('[class*=heroContent]'),a=m.getBoundingClientRect(),h=hero.getBoundingClientRect();return {visible:getComputedStyle(m).display!=='none',offset:Math.abs(a.left+a.width/2-(h.left+h.width/2)),width:a.width,height:a.height,paths:m.querySelectorAll('path').length,mirrored:m.querySelectorAll('circle[cx=\\\"150\\\"]').length}})()");
      assert.ok(motif.visible&&motif.width>200&&motif.height>=30,"balanced risk motif is visible on mobile");
      assert.ok(motif.offset<=2,"risk-distribution motif is symmetrically centered beneath the hero");
      assert.equal(motif.paths,3,"risk motif includes a bell curve, baseline and center measure");
      assert.equal(motif.mirrored,1,"risk curve has a single centered peak");
      await js('document.querySelector(\'button[aria-label="All stories"]\').click()');
      await until(()=>js('document.querySelector(\'dialog[aria-label="All stories"]\')?.open'),5000);
      const menu=await js("(()=>{const modal=document.querySelector('dialog[aria-label=\\\"All stories\\\"]'),a=[...modal.querySelectorAll('a[data-story-index]')];return {title:modal.querySelector('header').textContent.trim(),ids:a.map(x=>x.dataset.storyIndex),urls:a.map(x=>x.getAttribute('href')),explored:a.filter(x=>x.dataset.indexExplored==='true').map(x=>x.dataset.storyIndex),extra:modal.querySelectorAll('a:not([data-story-index])').length}})()");
      assert.ok(menu.title.startsWith("All stories"),"index heading is All stories");
      assert.deepEqual(menu.ids,ids,"all eleven portfolio stories appear in the popup");
      assert.deepEqual(menu.urls,ids.map(id=>"#paper-"+id),"story index links to all eleven cards");
      assert.equal(menu.extra,0,"no intro, skills, contact or other index items");
      await capture(width+"-stories-only-popup");
      await js('document.querySelector(\'dialog[aria-label="All stories"]\').close()');
    }
    await capture(width+"-home-story-stack");
    counts.homepage++;
    if(width===390){
      await js('document.querySelector("[aria-label=\\\"Dark paper\\\"]")?.click()');
      // The selected paper theme must not change href routing.
      assert.equal(await js("document.querySelector('[data-story-link=dcf]').getAttribute('href')"),"/atharva/stories/dcf");
    }
    const storyIds=width===390?ids:width===1440?["shyam","fundlenz","dhaninfo","fincalc","dcf"]:["research","synk"];
    for(const id of storyIds){
      await navigate("/atharva/stories/"+id,'main[data-story-page="'+id+'"]');
      const detail=await js("(()=>{const m=document.querySelector('[data-story-page]'),bar=m.querySelector('[aria-label=\\\"Case study reading progress\\\"]'),chapter=m.querySelectorAll('[data-case-chapter]');return {id:m.dataset.storyPage,title:m.querySelector('h1').textContent,chapters:chapter.length,bar:!!bar,color:m.style.getPropertyValue('--case-accent'),rail:!!m.querySelector('aside[aria-label=\\\"Case study sections\\\"]'),goBack:m.querySelector('a[href^=\\\"/atharva#paper-\\\"]')?.getAttribute('href'),next:!!m.querySelector('a[href^=\\\"/atharva/stories/\\\"]')}})()");
      assert.equal(detail.id,id);
      if(width===1440&&id==="dhaninfo")await capture("1440-dhaninfo-full-story");
      if(id==="dhaninfo"){
        const figure=await js("(()=>{const frame=document.querySelector('[data-art-scene=dhaninfo]'),svg=frame?.querySelector('svg'),bar=svg?.querySelector('rect[class*=bar]'),draw=svg?.querySelector('path[class*=draw]'),style=frame?getComputedStyle(frame):null,rect=frame?.getBoundingClientRect();return {width:rect?.width||0,height:rect?.height||0,svgWidth:svg?.getBoundingClientRect().width||0,svgHeight:svg?.getBoundingClientRect().height||0,border:style?.borderTopStyle||'',background:style?.backgroundImage||'',mask:style?.maskImage||'',barAnimation:bar?getComputedStyle(bar).animationName:'',drawAnimation:draw?getComputedStyle(draw).animationName:'',alt:svg?.getAttribute('aria-label')||''}})()");
        const dhanSvgPalette=await js("(()=>{const svg=document.querySelector('[data-art-scene=dhaninfo] svg');return {flow:[...svg.querySelectorAll('#dhanFlow stop')].map(n=>n.getAttribute('stop-color')),oldMint:[...svg.querySelectorAll('[fill],[stroke]')].some(n=>['#6cbfa9','#d4e9bc','#94d3bd','#a6d9d0','#8fd2be','#b2e5d5'].some(c=>[n.getAttribute('fill'),n.getAttribute('stroke')].includes(c)))}})()");
        assert.deepEqual(dhanSvgPalette.flow,['#e97968','#f2b18a']);
        assert.equal(dhanSvgPalette.oldMint,false,'DhanInfo artwork should not reuse FundLenz mint tones');
        assert.ok(figure.width>180&&figure.height>130&&figure.svgWidth>150&&figure.svgHeight>100,"DhanInfo illustration has visible responsive dimensions");
        assert.ok(figure.alt.toLowerCase().includes("mortgage")&&figure.alt.toLowerCase().includes("risk"),"DhanInfo illustration describes lending and risk analysis");
        assert.ok(figure.barAnimation.includes("growth")&&figure.drawAnimation.includes("ink"),"DhanInfo illustration retains its bar and line animations");
        if(width>=768){
          assert.equal(figure.border,"none","desktop figure is not enclosed in a visible card");
          assert.ok(figure.mask.includes("radial-gradient"),"desktop figure fades outwards into the background");
        }else{
          assert.equal(figure.border,"solid","mobile figure keeps the rounded story frame");
          assert.ok(figure.background.includes("radial-gradient"),"mobile figure carries its story-accent background");
        }
      }
      const navigation=await js("(()=>{const links=[...document.querySelectorAll('footer a[href^=\"/atharva/stories/\"]')];return links.map(a=>a.getAttribute('href').split('/').pop())})()");
      assert.deepEqual(navigation,[ids[(ids.indexOf(id)-1+ids.length)%ids.length],ids[(ids.indexOf(id)+1)%ids.length]],id+" previous/next follow reordered stories");
      assert.ok(detail.title.length>=3&&detail.chapters>=1, id+" story has its authored chapters");
      assert.ok(detail.bar&&detail.rail, id+" has reading progress rail and top line");
      const accessible=await js("(()=>{const rail=document.querySelector('[aria-label=\\\"Case study sections\\\"]'),progress=rail.querySelector('[role=progressbar]'),links=[...rail.querySelectorAll('a[href^=\\\"#case-\\\"]')];return {hasProgress:!!progress,hasLinks:links.length>0,independent:!!progress&&links.every(link=>!progress.contains(link))}})()");
      assert.ok(accessible.hasProgress&&accessible.hasLinks&&accessible.independent,id+" chapter links must remain accessible outside the progressbar");
      assert.equal(detail.goBack,"/atharva#paper-"+id);
      assert.ok(await js("document.querySelector('nav[aria-label=\\\"Case study navigation\\\"] a[href^=\\\"/atharva#paper-\\\"]')?.textContent.includes('All stories')"),"desktop and mobile story pages use All stories consistently");
      assert.ok(await js("document.querySelector('footer a[href^=\\\"/atharva#paper-\\\"]')?.textContent.includes('Back to all stories')"),"footer keeps the updated story terminology");
      assert.ok(detail.color.startsWith("#"),"case-study progress inherits its color");
      const ribbon=await js("(()=>{const m=document.querySelector('[data-story-page]'),p=m.querySelector('[aria-label=\\\"Story sequence progress\\\"]'),fill=p.querySelector('[class*=topFill]'),segments=m.querySelectorAll('a[data-story-segment]');return {segments:segments.length,current:m.querySelector('a[data-story-segment][aria-current=page]')?.dataset.storySegment,completed:[...segments].filter(e=>e.dataset.segmentState==='complete').length,upcoming:[...segments].filter(e=>e.dataset.segmentState==='upcoming').length,gradient:m.style.getPropertyValue('--story-spectrum'),clip:getComputedStyle(fill).clipPath,transform:getComputedStyle(fill).transform,value:Number(p.getAttribute('aria-valuenow'))}})()");
      assert.equal(ribbon.segments,ids.length,"the Katerina-style ribbon contains all eleven stories");
      assert.equal(ribbon.current,id,"timeline highlights the current story");
      assert.equal(ribbon.completed,ids.indexOf(id),"all previous story nodes are marked complete");
      assert.equal(ribbon.upcoming,ids.length-ids.indexOf(id)-1,"future story nodes remain unfilled");
      assert.ok(ribbon.clip.startsWith("inset(")&&ribbon.transform==="none","timeline reveals the stationary spectrum, without squeezing it");
      assert.equal(ribbon.value,Math.round(ids.indexOf(id)*100/ids.length),"global story timeline starts at the correct project");
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
      assert.ok(Math.abs(atMiddle-((ids.indexOf(id)+middle/100)*100/ids.length))<=1.5,id+" global timeline advances only through the active story segment");
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
      const ending=await js("(()=>{const ending=document.querySelector('#case-end');return {title:ending.querySelector('h2')?.innerText.replace(/\\s+/g,' ').trim(),body:ending.querySelector('p')?.textContent}})()");
      assert.equal(ending.title,id==="dhaninfo"?"The work ahead.":"The result.",id+" has an accurate closing heading");
      assert.ok(ending.body.length>110,id+" has its own substantive takeaway");
      if(id==="dhaninfo"){
        assert.ok(await js('document.querySelector("#case-end [aria-label=\\\"Confidentiality disclosure\\\"]")!==null'),"DhanInfo has a limited confidentiality disclosure");
        assert.ok(ending.body.includes("full scope of the role")&&ending.body.includes("financial analysis"),"DhanInfo conclusion stays prospective and covers its broader analytical scope");
      }
      assert.ok(!/work in progress|under process/i.test(ending.title+" "+ending.body),id+" has no unfinished-project label");
      const globalEnd=await js("Number(document.querySelector('[aria-label=\\\"Story sequence progress\\\"]').getAttribute('aria-valuenow'))");
      assert.equal(globalEnd,Math.round((ids.indexOf(id)+1)*100/ids.length),id+" completed story finishes only its own spectrum segment");
      if(width===390)await capture(width+"-"+id+"-end");
      counts.stories++;
      if(width===390&&["research","fincalc","dcf"].includes(id)){
        await js("document.querySelector('a[href^=\\\"/atharva#paper-\\\"]').click()");
        await until(()=>js("location.pathname==='/atharva'&&!!document.getElementById('story-"+id+"')"),30000);
        assert.equal(await js("location.hash"),"#paper-"+id,"back link selects the previous project");
        assert.ok(await js("document.querySelectorAll('[data-story-link]').length===11"),"return to intact project stack");
        counts.back++;
      }
    }
  }
  // Extra desktop breakpoints validate long-form projects and SVG figures
  // without changing the existing desktop flex/grid layout or animations.
  for(const [width,height] of [[1024,800],[1920,900]]){
    await view(width,height);
    await navigate("/atharva","#atharva-portfolio");
    const desktopArt=await js("(()=>{const figures=[...document.querySelectorAll('[data-art-scene]')],stage=document.querySelector('[data-story=fundlenz] [data-role=story-overview]'),nav=document.querySelector('nav[aria-label=\"Portfolio navigation\"]');return {ids:figures.map(x=>x.dataset.artScene),allSvg:figures.every(x=>!!x.querySelector('svg')),stageDisplay:getComputedStyle(stage).display,navLinks:getComputedStyle(nav.querySelector('[class*=navLinks]')).display,heroIntro:document.querySelector('[class*=heroIntro]')?.textContent}})()");
    assert.deepEqual(desktopArt.ids,ids,width+"px desktop shows all eleven current stories");
    assert.ok(desktopArt.allSvg,width+"px desktop uses shared interactive figures");
    assert.equal(desktopArt.stageDisplay,"grid",width+"px keeps desktop story grid layout");
    assert.equal(desktopArt.navLinks,"flex",width+"px retains original desktop navigation");
    assert.equal(desktopArt.heroIntro,desktopIntro,width+"px shows updated professional context");
    await assertNoHorizontal(width+"px desktop portfolio");
    await js("document.getElementById('story-dcf').scrollIntoView({block:'start',behavior:'instant'})");
    await sleep(320);
    await capture(width+"-desktop-dcf-artwork");
    await navigate("/atharva/stories/ternwell",'main[data-story-page="ternwell"]');
    const full=await js("(()=>{const m=document.querySelector('main[data-story-page]'),f=m.querySelector('[data-art-scene]'),r=f.getBoundingClientRect(),ending=m.querySelector('#case-end');return {figure:f.dataset.artScene,svg:!!f.querySelector('svg'),width:r.width,height:r.height,endTitle:ending.querySelector('h2').innerText.replace(/\\s+/g,' ').trim(),endBody:ending.querySelector('p').textContent,back:m.querySelector('a[href^=\"/atharva#paper-\"]').textContent}})()");
    assert.equal(full.figure,"ternwell","standalone desktop Ternwell shows the shared financial-model figure");
    assert.ok(full.svg&&full.width>200&&full.height>200,"standalone figure fits its desktop frame");
    assert.equal(full.endTitle,"The result.","the completed Ternwell project has its updated conclusion on desktop");
    assert.ok(full.endBody.includes("linked model"),"desktop and mobile show the same completed-project story");
    assert.ok(full.back.includes("All stories"),"desktop case-study return copy is current");
    await assertNoHorizontal(width+"px desktop Ternwell story");
  }


  // Return from a standalone story to the precise overview viewport. Sections
  // seen before leaving must remain revealed, but newer stories may animate.
  for(const [width,height] of [[1440,900],[390,844]]){
    await view(width,height);
    await navigate("/atharva","#atharva-portfolio");
    await js('sessionStorage.removeItem("atharva-reveals-v2");sessionStorage.removeItem("atharva-story-return-v2")');
    await navigate("/atharva","#atharva-portfolio");
    for(const id of ["fundlenz","research"]){
      await js("document.getElementById('story-"+id+"').scrollIntoView({block:'center',behavior:'instant'})");
      await sleep(300);
    }
    await until(async()=>(await js("JSON.parse(sessionStorage.getItem(\"atharva-reveals-v2\")||\"{}\").stories||[]")).includes("research"),5000);
    const from=await js('window.scrollY');
    assert.ok(from>400,width+"px the research overview is below the hero");
    await js('document.querySelector("[data-story-link=research]").click()');
    await until(()=>js('location.pathname==="/atharva/stories/research"'),30000);
    const returnState=await js('JSON.parse(sessionStorage.getItem("atharva-story-return-v2")||"null")');
    assert.equal(returnState?.id,"research",width+"px remembers which overview was opened");
    assert.ok(Math.abs(returnState.top-from)<6,width+"px records the original scroll offset");
    await until(()=>js('!!document.querySelector("main[data-story-page=research] nav a[href^=\\\"/atharva#paper-\\\"]")'),30000);
    await js('document.querySelector("main[data-story-page=research] nav a[href^=\\\"/atharva#paper-\\\"]").click()');
    await until(()=>js('location.pathname==="/atharva"&&!!document.getElementById("story-research")'),30000);
    await until(()=>js('Math.abs(scrollY-'+from+')<35'),9000);
    assert.equal(await js('location.hash'),"#paper-research",width+"px keeps the right anchor");
    assert.equal(await js('document.getElementById("story-research").dataset.revealedBefore'),"true",width+"px does not replay research entry");
    assert.ok((await js("JSON.parse(sessionStorage.getItem(\"atharva-reveals-v2\")||\"{}\").stories||[]")).includes("research"),width+"px keeps the saved reveal history");
    await assertNoHorizontal(width+"px returned research overview");
    await capture(width+"-returned-to-research");

    await js('document.getElementById("story-study").scrollIntoView({block:"center",behavior:"instant"})');
    await until(async()=>(await js("JSON.parse(sessionStorage.getItem(\"atharva-reveals-v2\")||\"{}\").stories||[]")).includes("study"),6000);
    assert.notEqual(await js('document.getElementById("story-study").dataset.revealedBefore'),"true",width+"px newly reached story reveals for the first time");
    for(const id of ids){
      await js("document.getElementById('story-"+id+"').scrollIntoView({block:'center',behavior:'instant'})");
      await sleep(220);
    }
    await until(async()=>(await js("JSON.parse(sessionStorage.getItem(\"atharva-reveals-v2\")||\"{}\").stories||[]")).length===11,6000);
    await js('document.getElementById("story-research").scrollIntoView({block:"center",behavior:"instant"})');
    await sleep(200);
    const fromComplete=await js('window.scrollY');
    await js('document.querySelector("[data-story-link=research]").click()');
    await until(()=>js('location.pathname==="/atharva/stories/research"'),30000);
    await until(()=>js('!!document.querySelector("main[data-story-page=research] footer a[href^=\\\"/atharva#paper-\\\"]")'),30000);
    await js('document.querySelector("main[data-story-page=research] footer a[href^=\\\"/atharva#paper-\\\"]").click()');
    await until(()=>js('location.pathname==="/atharva"&&!!document.getElementById("story-research")'),30000);
    await until(()=>js('Math.abs(scrollY-'+fromComplete+')<35'),9000);
    assert.equal(await js('document.querySelectorAll("[data-story][data-revealed-before=true]").length'),ids.length,width+"px all visited story entrances stay finished");
    const bar=await js('getComputedStyle(document.querySelector("[data-story=dcf] [class*=bar]")).animationName');
    assert.equal(bar,"none",width+"px completed one-shot bar animations do not replay");
    assert.equal(await js('document.querySelector("[data-story-link=research]").getAttribute("href")'),"/atharva/stories/research","story link remains usable after restoration");
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
  // Illustrations and mini-tool surfaces must follow the individual accent in
  // both paper modes without changing the SVG movements or data visualizations.
  for(const theme of ["light","dark"]){
    await view(390,844);
    await navigate("/atharva","#atharva-portfolio");
    await js("localStorage.setItem('atharva-paper',"+JSON.stringify(theme)+")");
    await navigate("/atharva","#atharva-portfolio");
    await until(()=>js("document.getElementById('atharva-portfolio')?.dataset.paper==="+JSON.stringify(theme)),5000);
    const canvases=await js("Array.from(document.querySelectorAll('[data-art-scene]'),figure=>({id:figure.getAttribute('data-art-scene'),background:getComputedStyle(figure).backgroundImage}))");
    assert.equal(canvases.length,ids.length,theme+" contains all eleven illustrations");
    assert.deepEqual(canvases.map(x=>x.id),ids,theme+" artwork order matches story sequence");
    assert.equal(new Set(canvases.map(x=>x.background)).size,ids.length,theme+" gives each illustration a unique accent surface");
    const covers=await js("Array.from(document.querySelectorAll('[data-story]'),s=>getComputedStyle(s.querySelector('[class*=storyIllustration]')).backgroundImage)");
    assert.equal(new Set(covers).size,ids.length,theme+" changes every preview illustration panel");
      await navigate("/atharva/stories/dhaninfo",'main[data-story-page="dhaninfo"]');
      await until(()=>js("document.querySelector('[data-story-page]')?.dataset.paper==="+JSON.stringify(theme)),5000);
      const dhanPage=await js("(()=>{const p=document.querySelector('[data-story-page]'),art=p.querySelector('[data-art-scene=dhaninfo]');return {accent:p.style.getPropertyValue('--case-accent'),background:getComputedStyle(art).backgroundImage}})()");
      assert.equal(dhanPage.accent,"#e97968",theme+" DhanInfo full story keeps its coral accent");
      assert.ok(dhanPage.background.includes("linear-gradient"),theme+" DhanInfo full-story illustration follows its accent");
      await capture("390-dhaninfo-"+theme+"-full-story");
    const miniColors=[];
    for(const id of ["fundlenz","dcf","fincalc","study"]){
      await navigate("/atharva/stories/"+id,'main[data-story-page="'+id+'"]');
      await until(()=>js("document.querySelector('[data-story-page]')?.dataset.paper==="+JSON.stringify(theme)),5000);
      await until(()=>js("!!document.querySelector('[class*=toolResults]')"),5000);
      const palette=await js("(()=>{const frame=document.querySelector('[class*=artFrame]'),figure=document.querySelector('[data-art-scene]'),tool=document.querySelector('[class*=toolResults]');return {frame:getComputedStyle(frame).backgroundImage,art:getComputedStyle(figure).backgroundImage,tool:getComputedStyle(tool).backgroundImage}})()");
      assert.ok(palette.frame.includes("linear-gradient")&&palette.art.includes("linear-gradient"),id+" story artwork is themed");
      miniColors.push(palette.tool);
    }
    assert.equal(new Set(miniColors).size,4,theme+" gives every mini tool a unique story palette");
    await assertNoHorizontal(theme+" themed mobile case studies");
  }

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
  for(const nextId of ["dhaninfo","research","shyam","dcf"]){
    const selector='footer a[href="/atharva/stories/'+nextId+'"]';
    await js("document.querySelector("+JSON.stringify(selector)+").click()");
    await until(()=>js("location.pathname==="+JSON.stringify("/atharva/stories/"+nextId)),30000);
    await until(async()=>(await seen()).includes(nextId),5000);
    await until(()=>js('!!document.querySelector("footer a[href^=\\\"/atharva/stories/\\\"]")'),30000);
  }
  const previousSelector='footer a[href="/atharva/stories/shyam"]';
  await js("document.querySelector("+JSON.stringify(previousSelector)+").click()");
  await until(()=>js('location.pathname==="/atharva/stories/shyam"'),30000);
  await until(()=>js('!!document.querySelector("main[data-story-page=shyam]")'),30000);
  assert.deepEqual(await seen(),["fundlenz","dhaninfo","research","shyam","dcf"],"revisiting never duplicates completions");
  const backSelector='a[href^="/atharva#paper-"]';
  await js("document.querySelector("+JSON.stringify(backSelector)+").click()");
  await until(()=>js('location.pathname==="/atharva"'),30000);
  await until(async()=>(await badges()).length===5,5000);
  assert.deepEqual(await badges(),["fundlenz","dhaninfo","research","shyam","dcf"],"only five explored cards are checked");
  // The popup uses the identical saved explored set as the card badges.
  const popupStatus=()=>js("Array.from(document.querySelectorAll('dialog[aria-label=\\\"All stories\\\"] a[data-story-index]'),a=>({id:a.dataset.storyIndex,explored:a.dataset.indexExplored,strike:getComputedStyle(a.querySelector('span')).textDecorationLine}))");
  const fourIndex=await popupStatus();
  assert.deepEqual(fourIndex.filter(x=>x.explored==="true").map(x=>x.id),["fundlenz","dhaninfo","research","shyam","dcf"],"index crosses out the same five completed story cards");
  assert.ok(fourIndex.filter(x=>x.explored==="true").every(x=>x.strike.includes("line-through")),"all completed story titles have a visible strikethrough");
  assert.ok(fourIndex.filter(x=>x.explored==="false").every(x=>x.strike==="none"),"unexplored story titles are not crossed out");
  await js('document.querySelector(\'button[aria-label="All stories"]\').click()');
  await capture("390-five-completed-stories-index");
  await js('document.querySelector(\'dialog[aria-label="All stories"]\').close()');
  await capture("390-five-explored-cards");
  await navigate("/atharva","#atharva-portfolio");
  await until(async()=>(await badges()).length===5,5000);
  assert.deepEqual(await badges(),["fundlenz","dhaninfo","research","shyam","dcf"],"checkmarks survive reloading");
  await navigate("/atharva/stories/synk",'main[data-story-page="synk"]');
  await until(async()=>(await seen()).includes("synk"),5000);
  await js("document.querySelector("+JSON.stringify(backSelector)+").click()");
  await until(()=>js('location.pathname==="/atharva"'),30000);
  await until(async()=>(await badges()).length===6,5000);
  assert.deepEqual(await badges(),["fundlenz","dhaninfo","research","shyam","dcf","synk"],"later story adds to earlier checkmarks");
  const fiveIndex=await popupStatus();
  assert.deepEqual(fiveIndex.filter(x=>x.explored==="true").map(x=>x.id),["fundlenz","dhaninfo","research","shyam","dcf","synk"],"the story popup preserves earlier marks when a sixth story is explored");
  assert.ok(fiveIndex.filter(x=>x.explored==="true").every(x=>x.strike.includes("line-through")),"cross-outs persist after returning from another story");

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
