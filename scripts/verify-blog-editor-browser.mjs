import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(probe, timeout = 20000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try { const result = await probe(); if (result) return result; }
    catch (error) { lastError = error; }
    await sleep(150);
  }
  throw new Error("Browser readiness timeout: " + (lastError?.message || "timed out"));
}
const root = process.cwd();
const server = await createServer({
  configFile: false, root: path.join(root, "scripts/blog-editor-browser-fixture"),
  plugins: [react()], resolve: { alias: { "@": root } },
  server: { host: "127.0.0.1", port: 41883, strictPort: true, hmr: false },
  logLevel: "error",
});
const directory = await mkdtemp(path.join(tmpdir(), "fundlenz-editor-qa-"));
let chrome = null, socket = null;
try {
  await server.listen();
  const binary = execFileSync("bash", ["-lc",
    "command -v google-chrome || command -v google-chrome-stable || command -v chromium"],
    { encoding: "utf8" }).trim().split("\n")[0];
  assert.ok(binary, "Real headless Chromium is required for this browser test.");
  chrome = spawn(binary, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0",
    "--user-data-dir=" + directory, "http://127.0.0.1:41883/",
  ], { stdio: "ignore" });
  const port = await until(async () => {
    const raw = await readFile(path.join(directory,"DevToolsActivePort"),"utf8");
    return Number(raw.split("\n")[0]) || null;
  });
  const page = await until(async () => {
    const response = await fetch("http://127.0.0.1:"+port+"/json/list").then(r=>r.json());
    return response.find(item => item.type === "page" &&
      item.url.startsWith("http://127.0.0.1:41883")) || null;
  });
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject) => {
    socket.addEventListener("open", resolve, { once:true });
    socket.addEventListener("error", reject, { once:true });
  });
  let id=0;
  const requests = new Map();
  socket.addEventListener("message", event => {
    const msg = JSON.parse(event.data);
    if (!msg.id) return;
    const request=requests.get(msg.id);
    if (!request) return;
    requests.delete(msg.id);
    msg.error ? request.reject(Error(msg.error.message)) : request.resolve(msg.result);
  });
  function command(method, params={}) {
    return new Promise((resolve,reject) => {
      const key=++id; requests.set(key,{resolve,reject});
      socket.send(JSON.stringify({id:key,method,params}));
    });
  }
  async function js(source) {
    const payload = await command("Runtime.evaluate",
      {expression:source,awaitPromise:true,returnByValue:true});
    if (payload.exceptionDetails) throw Error(JSON.stringify(payload.exceptionDetails));
    return payload.result.value;
  }
  const state = async () => JSON.parse(await js(
    'document.getElementById("serialized")?.textContent || "{}"'));
  await until(() => js('Boolean(document.querySelector(\'[role="textbox"]\'))'));
  assert.equal((await state()).blocks[0].runs.map(run=>run.text).join(""),"Alpha beta gamma delta");
  const selection = await js('(() => { const editor=document.querySelector(\'[role="textbox"]\');'+
    'editor.focus(); const node=editor.querySelector("span").firstChild;'+
    'const range=document.createRange();range.setStart(node,6);range.setEnd(node,10);'+
    'const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);'+
    'editor.dispatchEvent(new MouseEvent("mouseup",{bubbles:true}));return selection.toString();})()');
  assert.equal(selection,"beta","Browser must select only beta");
  await js('(() => {const menu=document.querySelector(\'select[aria-label="Font family"]\');'+
    'menu.focus();menu.value="baskerville";'+
    'menu.dispatchEvent(new Event("change",{bubbles:true}));return menu.value;})()');
  await until(async () => (await state()).blocks[0].runs.some(run =>
    run.text === "beta" && run.font === "baskerville"));
  assert.equal((await state()).blocks[0].runs.map(run=>run.text).join(""),"Alpha beta gamma delta");
  assert.equal((await state()).blocks[0].runs.find(run=>run.text==="Alpha ")?.font,undefined);
  await js('document.querySelector(\'button[aria-label="Bold selected text"]\').click()');
  await until(async () => (await state()).blocks[0].runs.some(run =>
    run.text==="beta" && run.bold===true));
  await js('(() => {const input=document.querySelector(\'input[aria-label="Text size in pixels"]\');'+
    'const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;'+
    'setter.call(input,"30");input.dispatchEvent(new Event("input",{bubbles:true}));'+
    'input.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await sleep(150);
  await js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Apply").click()');
  await until(async () => (await state()).blocks[0].runs.some(run =>
    run.text==="beta" && run.sizePx===30));
  assert.equal((await state()).blocks[0].runs.map(run=>run.text).join(""),"Alpha beta gamma delta");
  assert.equal(await js('document.getElementById("status").dataset.valid'),"true");
  console.log("PASS: Chromium React editor selected-text font change, bold, numeric sizing, no duplicated/dropped text");
} finally {
  if (socket) socket.close();
  chrome?.kill("SIGTERM");
  await server.close();
  await rm(directory,{recursive:true,force:true});
}
