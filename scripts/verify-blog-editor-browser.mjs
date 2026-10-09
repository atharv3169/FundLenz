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
  const binary = process.env.CHROMIUM_PATH || execFileSync("bash", ["-lc",
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
  const typing = await js('(() => ({focused:document.activeElement?.getAttribute("role"),'+
    'selection:window.getSelection()?.toString(), inserted:document.execCommand("insertText",false," freshly typed")}))()');
  assert.equal(typing.inserted,true,"Chrome should insert text into focused editable field");
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
  // Large, mostly unbroken text reproduces the owner's font-duplication screenshot.
  const longOriginal = (await state()).blocks[2].runs.map(run=>run.text).join("");
  const selectionLong = await js('(() => {const editor=document.querySelectorAll(\'[role="textbox"]\')[2];'+
    'editor.focus();const node=editor.querySelector("span").firstChild;'+
    'const r=document.createRange();r.setStart(node,705);r.setEnd(node,1305);'+
    'const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);'+
    'editor.dispatchEvent(new MouseEvent("mouseup",{bubbles:true}));return sel.toString().length;})()');
  assert.equal(selectionLong,600);
  await js('(() => {const menu=document.querySelector(\'select[aria-label="Font family"]\');'+
    'menu.focus();menu.value="garamond";menu.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await until(async () => (await state()).blocks[2].runs.some(run =>
    run.font==="garamond" && run.text.length===600));
  const longResult=(await state()).blocks[2].runs;
  assert.equal(longResult.map(run=>run.text).join(""),longOriginal,
    "Long paragraph must never duplicate, drop or transpose text");
  assert.equal(longResult.filter(run=>run.font==="garamond").length,1);
  assert.equal(longResult.filter(run=>run.font==="garamond")[0].text,longOriginal.slice(705,1305));
  // Every typed/pasted byte must reach the model before blur or preview.
  await js(`(() => {
    const editor=document.querySelector('[role="textbox"]'); editor.focus();
    editor.innerHTML='One<div>Two<br>Three</div>';
    editor.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await until(async () => (await state()).blocks[0].runs.map(r=>r.text).join('') === 'One\nTwo\nThree');
  await js(`(() => {
    const editor=document.querySelector('[role="textbox"]');
    const node=editor.querySelector('div').lastChild;
    const r=document.createRange();r.setStart(node,0);r.setEnd(node,5);
    const s=window.getSelection();s.removeAllRanges();s.addRange(r);
    editor.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    document.querySelector('[aria-label="Bold selected text"]').click();
  })()`);
  await until(async () => (await state()).blocks[0].runs.some(r=>r.text==='Three'&&r.bold));
  assert.equal((await state()).blocks[0].runs.map(r=>r.text).join(''),'One\nTwo\nThree');
  const clickText = async text => js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)}).click()`);
  await clickText('Clear formatting');
  await until(async () => !(await state()).blocks[0].runs.some(r=>r.bold));
  await clickText('Undo');
  await until(async () => (await state()).blocks[0].runs.some(r=>r.bold));
  await clickText('Redo');
  await until(async () => !(await state()).blocks[0].runs.some(r=>r.bold));
  await js(`(() => {
    const editor=document.querySelector('[role="textbox"]');editor.focus();
    const r=document.createRange();r.selectNodeContents(editor);
    const s=window.getSelection();s.removeAllRanges();s.addRange(r);
    const data=new DataTransfer();data.setData('text/plain','Pasted immediately\\nWith a second line');
    editor.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:data}));
  })()`);
  await until(async () => (await state()).blocks[0].runs.map(r=>r.text).join('')==='Pasted immediately\nWith a second line');
  // Prior implementation silently stopped reading at 281 differently formatted runs.
  await js(`(() => {
    const editor=document.querySelector('[role="textbox"]');
    editor.innerHTML=Array.from({length:300},(_,i)=>'<span style="font-weight:'+(i%2?'bold':'normal')+'">x</span>').join('');
    editor.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await until(async () => (await state()).blocks[0].runs.map(r=>r.text).join('').length===300);
  assert.equal((await state()).blocks[0].runs.length,300);
  await js(`(() => {
    const editor=document.querySelector('[role="textbox"]');
    editor.innerHTML += '<span>OVER LIMIT</span>';
    editor.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await until(() => js('document.getElementById("status").dataset.valid === "false"'));
  await js(`document.querySelectorAll('[role="textbox"]')[1].dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await js('document.getElementById("status").dataset.valid'),'false',
    'A valid second paragraph must not clear another paragraph’s error');
  assert.equal((await state()).blocks[0].runs.map(r=>r.text).join('').length,300,
    'Oversized DOM must not overwrite the last valid stored text');
  await js(`(() => {const e=document.querySelector('[role="textbox"]');e.textContent='Repaired';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until(() => js('document.getElementById("status").dataset.valid === "true"'));

  // Dashboard lifecycle uses only fixture responses, never the owner's private drafts.
  await js('location.href="/?mode=dashboard"');
  await until(() => js('Boolean(document.querySelector("input[type=search]"))'));
  await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('Understanding a portfolio')).click()`);
  await until(() => js('Boolean(document.querySelector("form textarea"))'));
  const inputValue = async (selector,value) => {
    await js(`(() => {const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(100);
  };
  await inputValue('form input','Edited title survives tabs');
  await clickText('Homepage wording');
  await clickText('Article drafts');
  assert.equal(await js('document.querySelector("form input").value'),'Edited title survives tabs');
  await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true}))`);
  await until(() => js(`document.body.textContent.includes('Private draft saved. Public article remains unchanged')`));
  await inputValue('form input','Simulate conflict');
  await clickText('Save private draft');
  await until(() => js(`Boolean(document.querySelector('[role="alert"]'))`));
  assert.equal(await js('document.querySelector("form input").value'),'Simulate conflict',
    'Version conflict must retain unsaved content');
  await js('window.confirm=()=>false');
  await clickText('Reload drafts');
  assert.equal(await js('document.querySelector("form input").value'),'Simulate conflict');
  await clickText('Homepage wording');
  await inputValue('#blog-homepage-copy-form input','Changed homepage title');
  await clickText('Article drafts');
  assert.ok(await js('Boolean(document.getElementById("blog-homepage-copy-form"))'),
    'Cancelling the discard prompt must preserve homepage edits');
  await js('window.confirm=()=>true');
  await clickText('Article drafts');
  await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('Damaged draft fixture')).click()`);
  await until(() => js(`document.body.textContent.includes('Rich draft is damaged')`));
  assert.equal(await js('document.querySelector("form input").value'),'Simulate conflict',
    'Failed decoding must leave both the existing title and body intact');
  assert.ok(await js(`document.querySelector('[role="textbox"]').textContent.includes('Start with the right question')`));
  await clickText('Preview article →');
  assert.ok(await js(`Boolean(document.querySelector('nav[aria-label="In this article"]'))`));

  // Responsive overflow checks plus optional screenshots for visual review.
  const {writeFile,mkdir} = await import('node:fs/promises');
  for (const mode of ['dashboard','paper']) {
    await js(`location.href='/?mode=${mode}'`);
    await until(() => js(mode==='paper' ? 'Boolean(document.querySelector("article"))' : 'Boolean(document.querySelector("input[type=search]"))'));
    if (mode==='dashboard') {
      await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('Understanding a portfolio')).click()`);
      await until(() => js('Boolean(document.querySelector("form textarea"))'));
    }
    for (const width of [1440,768,390,320]) {
      await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      await sleep(120);
      const dimensions=await js('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
      assert.ok(dimensions.scroll<=dimensions.width+1,`${mode} overflows at ${width}px: ${JSON.stringify(dimensions)}`);
      if (process.env.BLOG_QA_SCREENSHOTS) {
        await mkdir(process.env.BLOG_QA_SCREENSHOTS,{recursive:true});
        const shot=await command('Page.captureScreenshot',{format:'png'});
        await writeFile(path.join(process.env.BLOG_QA_SCREENSHOTS,`${mode}-${width}.png`),Buffer.from(shot.data,'base64'));
      }
    }
  }
  console.log('PASS: immediate typing/paste, newline selections, 300-run preservation, invalid-block isolation, undo/redo, draft save/conflict/navigation and responsive layouts');

  console.log("PASS: Chromium font/size, typing, cross-paragraph safety and long 5,600-character selection preservation");
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
