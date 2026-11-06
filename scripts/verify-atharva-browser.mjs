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
  await shot("desktop-hero.png");
  await js('document.getElementById("story-shyam").scrollIntoView({block:"start",behavior:"instant"})');
  await sleep(500);
  await shot("desktop-shyam.png");
  await js('document.querySelector("#story-shyam button[aria-expanded]").click()');
  assert.equal(await js('document.querySelector("#full-shyam")?.textContent.includes("80 lakh")'),true);
  assert.ok(await js('document.querySelectorAll("#full-shyam article").length')>=3);
  await js('document.getElementById("story-fundlenz").scrollIntoView({block:"start",behavior:"instant"})');
  await js('document.querySelector("#story-fundlenz button[aria-expanded]").click()');
  await until(()=>js('Boolean(document.querySelector("#full-fundlenz input[type=range]"))'));
  assert.ok(await js('document.getElementById("full-fundlenz").textContent.includes("ALPHA")'),"Fund mini tool populated");
  await shot("desktop-fund-mini.png");
  await js('document.getElementById("story-dcf").scrollIntoView({block:"start",behavior:"instant"})');
  await js('document.querySelector("#story-dcf button[aria-expanded]").click()');
  await until(()=>js('Boolean(document.querySelector("#full-dcf input[type=number]"))'));
  assert.ok(await js('document.getElementById("full-dcf").textContent.includes("ENTERPRISE VALUE")'));
  await shot("desktop-dcf-mini.png");
  await js('document.getElementById("story-study").scrollIntoView({block:"start",behavior:"instant"})');
  await js('document.querySelector("#story-study button[aria-expanded]").click()');
  await until(()=>js('Boolean(document.querySelector("#full-study input[aria-label=\"New study task\"]"))'));
  assert.ok(await js('document.querySelectorAll("#full-study input[type=checkbox]").length')>=3);
  await cmd("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await js('window.scrollTo({top:0,behavior:"instant"})');await sleep(700);
  await shot("mobile-hero.png");
  let dims=await js('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})');
  assert.ok(dims.scroll<=dims.client+2,"Mobile overflow "+JSON.stringify(dims));
  await js('document.querySelector(\'[aria-label="Open navigation"]\').click()');
  assert.equal(await js('document.querySelector(\'[aria-label="Close navigation"]\').getAttribute("aria-expanded")'),"true");
  await js('document.querySelector(\'[aria-label="Close navigation"]\').click()');
  await js('document.getElementById("story-crowd").scrollIntoView({block:"start",behavior:"instant"})');await sleep(600);
  await shot("mobile-crowd.png");
  dims=await js('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})');
  assert.ok(dims.scroll<=dims.client+2,"Mobile story overflow "+JSON.stringify(dims));
  console.log("Portfolio browser checks PASSED: 9 full-screen scenes; mini tools and disclosures; no CGPA; mobile responsive.");
} finally {
  socket?.close();
  if(chrome && chrome.exitCode===null)chrome.kill();
  await server.close();
  await rm(temp,{recursive:true,force:true});
}
