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
  await until(()=>js('Boolean(document.querySelector("#atharva-portfolio") && document.querySelector("#explore"))'),60000);
  await sleep(1400);
  assert.equal(await js('document.querySelectorAll("[aria-label^=\\\"Explore \\\"]").length'),12,"All 12 map nodes should be present");
  assert.equal(await js('document.querySelectorAll(".masthead").length'),0,"Test fixture should have no production chrome");
  await shot("desktop-hero.png");
  await js('document.getElementById("explore").scrollIntoView({block:"start",behavior:"instant"})');
  await sleep(1000);
  await shot("desktop-network.png");
  await js('document.querySelector(\'[aria-label="Explore Mutual-fund research"]\').click()');
  assert.equal(await js('document.querySelector(\'[aria-label="Selected experience details"]\').textContent.includes("liquidity")'),true);
  await js('document.querySelector(\'[aria-controls="ath-selected-chapter"]\').click()');
  assert.equal(await js('document.querySelector(\'[aria-controls="ath-selected-chapter"]\').getAttribute("aria-expanded")'),"true");
  assert.equal(await js('document.getElementById("ath-selected-chapter").textContent.includes("1,900")'),true);
  await js('Array.from(document.querySelectorAll(\'[aria-label="Filter experiences"] button\')).find(b=>b.textContent==="Research").click()');
  assert.equal(await js('document.querySelector(\'[aria-label="Filter experiences"] button[aria-pressed="true"]\').textContent'),"Research");
  await js('Array.from(document.querySelectorAll(\'[aria-label="Map view mode"] button\')).find(b=>b.textContent.includes("List")).click()');
  assert.equal(await js('document.querySelectorAll(\'[aria-label="Explore Mutual-fund research"]\').length'),0,"Map node hidden in list mode");
  await js('document.querySelector(\'[aria-label="Filter experiences"] button\').click()');
  assert.equal(await js('document.querySelectorAll(\'button[aria-label^="Explore "]\').length'),0,"List mode should replace constellation nodes");
  assert.equal(await js('document.querySelectorAll(\'[aria-label="Selected experience details"]\').length'),1);
  await cmd("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await js('window.scrollTo({top:0,behavior:"instant"})');
  await sleep(800);
  await shot("mobile-hero.png");
  const dims=await js('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})');
  assert.ok(dims.scroll<=dims.client+2, "Mobile horizontal overflow: "+JSON.stringify(dims));
  await js('document.querySelector(\'[aria-label="Open menu"]\').click()');
  assert.equal(await js('document.querySelector(\'[aria-label="Close menu"]\').getAttribute("aria-expanded")'),"true");
  await js('document.querySelector(\'[aria-label="Close menu"]\').click()');
  await js('document.getElementById("explore").scrollIntoView({block:"start",behavior:"instant"})');
  await sleep(650);
  await shot("mobile-network.png");
  console.log("Atharva visual/browser verification PASSED: 12 nodes, research detail, filters, list mode, mobile menu, no horizontal overflow. Screenshots in work/atharva-screenshots.");
} finally {
  socket?.close();
  if(chrome && chrome.exitCode===null)chrome.kill();
  await server.close();
  await rm(temp,{recursive:true,force:true});
}
