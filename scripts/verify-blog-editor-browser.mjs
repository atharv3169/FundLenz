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
  // Reproduce the user's real sequence: type into formatted content, then blur.
  await js('(() => {const editor=document.querySelector(\'[role="textbox"]\');editor.focus();'+
    'const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let text;'+
    'while(walker.nextNode())text=walker.currentNode;'+
    'const range=document.createRange();range.setStart(text,text.textContent.length);'+
    'range.collapse(true);const s=window.getSelection();s.removeAllRanges();s.addRange(range);})()');
  await command("Input.insertText",{text:" freshly typed"});
  await js('document.querySelector(\'select[aria-label="Font family"]\').focus()');
  await sleep(350);
  const afterTyping = (await state()).blocks[0].runs.map(run=>run.text).join("");
  assert.ok(afterTyping.endsWith(" delta freshly typed"),
    "New typing did not persist on blur: " + JSON.stringify({
      text: afterTyping,
      dom: await js('document.querySelector(\'[role="textbox"]\')?.textContent'),
      html: await js('document.querySelector(\'[role="textbox"]\')?.innerHTML'),
    }));
  assert.equal((await state()).blocks[0].runs.map(run=>run.text).join(""),
    "Alpha beta gamma delta freshly typed");
  assert.equal((await state()).blocks[0].runs.find(run=>run.text==="beta")?.sizePx,30);
  assert.equal(await js('document.getElementById("status").dataset.valid'),"true");
  // Cross-paragraph selections must fail visibly, never style the wrong block.
  await js('(() => {const editors=document.querySelectorAll(\'[role="textbox"]\');editors[0].focus();'+
    'const first=editors[0].querySelector("span").firstChild;'+
    'const last=editors[1].querySelector("span").firstChild;'+
    'const range=document.createRange();range.setStart(first,0);range.setEnd(last,6);'+
    'const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);'+
    'editors[0].dispatchEvent(new MouseEvent("mouseup",{bubbles:true}));})()');
  await js('(() => {const menu=document.querySelector(\'select[aria-label="Font family"]\');'+
    'menu.focus();menu.value="cambria";menu.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await sleep(150);
  assert.ok(!(await state()).blocks[0].runs.some(run=>run.font==="cambria"),
    "Cross-block selection must not restyle the first block");
  assert.ok(!(await state()).blocks[1].runs.some(run=>run.font==="cambria"),
    "Cross-block selection must not restyle the second block");
  assert.equal((await state()).blocks[1].runs.map(run=>run.text).join(""),"Second paragraph remains separate");
  console.log("PASS: Chromium selected font/bold/size, typing preservation and cross-paragraph protection");
} finally {
  if (socket) socket.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve => chrome.once("exit", resolve)),
      sleep(2500),
    ]);
  }
  await server.close();
  await rm(directory,{recursive:true,force:true,maxRetries:12,retryDelay:150});
}
