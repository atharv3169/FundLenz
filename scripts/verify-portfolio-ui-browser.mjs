import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const lab = readFileSync("components/fundlens.tsx", "utf8");
const sector = readFileSync("components/sector-exposure-group.tsx", "utf8");
const drawer = readFileSync("components/projects-drawer.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");
assert.match(lab, /<SectorExposureGroup key=\{s\.name\}/);
assert.match(lab, /value=\{sectorFilter\}/);
assert.match(lab, /value=\{query\}/);
assert.doesNotMatch(sector, /setSectorFilter|setQuery/);
assert.match(sector, /expanded \? stocks\.filter/);
assert.match(sector, /matches\.slice\(0, visibleCount\)/);
assert.match(sector, /aria-expanded=\{expanded\}/);
assert.match(drawer, /closingRef\.current/);
assert.match(drawer, /setEntered\(true\)/);
assert.match(drawer, /data-state=\{closing \? "closing" : entered \? "open" : "entering"\}/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.projects-drawer-layer\[data-state=closing\]/);

const desktopStart = css.indexOf("/* Desktop projects drawer: explicit painted entry state; mobile keyframes remain unchanged. */");
const desktopEnd = css.indexOf("/* End desktop projects drawer. */");
assert.ok(desktopStart !== -1 && desktopEnd > desktopStart, "Desktop transition CSS required");
const reducedMotion = css.match(/@media\(prefers-reduced-motion:reduce\) \{ \*,\*::before,\*::after \{[^}]+\} \}/);
assert.ok(reducedMotion, "Global reduced-motion safeguard required");
const animationFixtureCss = css.slice(desktopStart, desktopEnd + 34) + "\n" + reducedMotion[0];

const root = process.cwd();
const fixture = path.join(root, "scripts/portfolio-ui-browser-fixture");
const mock = path.join(fixture, "next-mocks.tsx");
const server = await createServer({
  configFile: false, root: fixture, plugins: [react()],
  resolve: { alias: [
    { find: /^next\/link$/, replacement: mock },
    { find: /^next\/navigation$/, replacement: mock },
    { find: "@", replacement: root },
  ] },
  server: { host: "127.0.0.1", port: 41885, strictPort: true, hmr: false },
  logLevel: "error",
});
const directory = await mkdtemp(path.join(tmpdir(), "fundlenz-ui-"));
let chrome = null, socket = null;
let phase = "initialization";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(probe, timeout = 15000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    try { if (await probe()) return; } catch (e) { last = e; }
    await sleep(100);
  }
  throw Error("UI check timed out during " + phase + ": " + (last?.message || "condition not met"));
}
try {
  await server.listen();
  const binary = process.env.CHROMIUM_PATH || execFileSync("bash",
    ["-lc", "command -v google-chrome || command -v google-chrome-stable || command -v chromium"],
    { encoding: "utf8" }).trim().split("\n")[0];
  assert.ok(binary, "Chromium is required");
  let port = 0;
  for (let attempt = 0; attempt < 2 && !port; attempt++) {
    const profile = attempt ? path.join(directory, "retry") : directory;
    let startupError = "";
    chrome = spawn(binary, [
      "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
      "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0",
      "--user-data-dir=" + profile, "http://127.0.0.1:41885/",
    ], { stdio: ["ignore", "ignore", "pipe"] });
    chrome.stderr?.on("data", chunk => {
      startupError = (startupError + String(chunk)).slice(-2000);
    });
    try {
      await until(async () => {
        if (chrome.exitCode !== null || chrome.signalCode !== null) {
          throw Error("Chromium exited: " + chrome.exitCode + "/" + chrome.signalCode);
        }
        const value = await readFile(path.join(profile, "DevToolsActivePort"), "utf8");
        port = Number(value.split("\n")[0]);
        return port > 0;
      }, attempt ? 20000 : 10000);
    } catch (error) {
      console.error("Chromium startup attempt", attempt + 1,
        "exit", chrome.exitCode, chrome.signalCode, startupError, String(error));
      if (chrome.exitCode === null && chrome.signalCode === null) {
        const gone = new Promise(resolve => chrome.once("exit", resolve));
        chrome.kill();
        await Promise.race([gone, sleep(1000)]);
      }
      if (attempt === 1) throw error;
    }
  }
  let page;
  await until(async () => {
    const pages = await fetch("http://127.0.0.1:" + port + "/json/list").then(r => r.json());
    page = pages.find(p => p.type === "page" && p.url.includes("41885"));
    return !!page;
  });
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", e => {
    const message = JSON.parse(e.data);
    if (!message.id || !pending.has(message.id)) return;
    const p = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) p.reject(Error(message.error.message));
    else p.resolve(message.result);
  });
  function cmd(method, params = {}) {
    return new Promise((resolve, reject) => {
      const key = ++id;
      pending.set(key, {resolve, reject});
      socket.send(JSON.stringify({ id: key, method, params }));
    });
  }
  async function js(expression) {
    const result = await cmd("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  // Exercise actual production desktop-motion rules in Chromium.
  await js('(() => { const style = document.createElement("style"); style.textContent = ' +
    JSON.stringify(animationFixtureCss) + '; document.head.appendChild(style); })()');
  const count = () => js('document.querySelectorAll(".sector-stocks li").length');
  phase = "fixture mounting";
  try {
    await until(() => js('document.querySelectorAll(".sector-group").length === 2'));
  } catch (error) {
    const diagnostic = await js(`({
      body: document.body.innerText.slice(0, 1200),
      root: document.getElementById("root")?.innerHTML.slice(0, 1200),
      overlay: document.querySelector("vite-error-overlay")?.shadowRoot?.textContent.slice(0, 2400)
    })`);
    console.error("FundLenz browser fixture diagnostic:", diagnostic);
    throw error;
  }
  assert.equal(await count(), 0, "Collapsed sectors must not render stock rows");
  await js(`(() => {
    const select = document.querySelector("#filter"); select.value = "Healthcare";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const input = document.querySelector("#search");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "needle");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  phase = "independent table state";
  await until(() => js('document.querySelector("#table-state").textContent === "Healthcare:needle"'));
  const summary = 'document.querySelector(\'details[data-sector="Technology"] summary\')';
  phase = "sector expansion";
  await js(summary + '.click()');
  await until(async () => await count() === 60);
  assert.equal(await js(summary + '.getAttribute("aria-expanded")'), "true");
  assert.equal(await js('document.querySelector("#table-state").textContent'), "Healthcare:needle");
  assert.equal(await js('document.querySelector(".sector-show-more").textContent.includes("60 of 1100")'), true);
  await js('document.querySelector(".sector-show-more").click()');
  await until(async () => await count() === 120);
  await js(summary + '.click()');
  await until(async () => await count() === 0);
  await js(summary + '.focus()');
  assert.equal(await js('document.activeElement === ' + summary), true,
    "Native summary must be keyboard-focusable");
  // A focused native summary activates through its click event, including keyboard activation.
  await js(summary + '.click()');
  await until(async () => await count() === 60);
  await js(summary + '.click()');
  await until(async () => await count() === 0);

  async function open(selector) {
    await until(() => js('Boolean(document.querySelector(' + JSON.stringify(selector) + '))'));
    await js('document.querySelector(' + JSON.stringify(selector) + ').click()');
    await until(() => js('Boolean(document.querySelector(\'[role="dialog"]\'))'));
    assert.equal(await js('document.body.style.overflow'), "hidden");
    await until(() => js('document.activeElement?.hasAttribute("data-close-projects")'));
  }
  async function closed(triggerClass, expectReturnFocus = true) {
    await until(() => js('!document.querySelector(\'[role="dialog"]\')'));
    assert.equal(await js('document.body.style.overflow'), "");
    if (expectReturnFocus) assert.equal(await js('document.activeElement?.classList.contains(' + JSON.stringify(triggerClass) + ')'), true);
  }
  phase = "desktop drawer";
  await cmd("Emulation.setDeviceMetricsOverride",{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await open(".projects-desktop-trigger");
  await until(() => js('document.querySelector(".projects-drawer-layer")?.dataset.state === "open"'));
  const desktopMotion = await js(`(() => {
    const panel = document.querySelector(".projects-drawer-panel");
    const styles = getComputedStyle(panel);
    return {duration: styles.transitionDuration, property: styles.transitionProperty,
      active: panel.getAnimations().some(a => a.playState === "running")};
  })()`);
  assert.ok(desktopMotion.duration.includes("0.42s"), "Desktop open slide must last 420ms");
  assert.ok(desktopMotion.property.includes("transform"), "Desktop drawer must transition its position");
  assert.equal(desktopMotion.active, true, "Desktop drawer must visibly animate on opening");
  const focusTrap = await js(`(() => {
    const dialog=document.querySelector('[role="dialog"]');
    const controls=[...dialog.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')];
    const first=controls[0], last=controls[controls.length-1];
    last.focus();
    const before=document.activeElement===last;
    const event=new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true});
    document.dispatchEvent(event);
    return {before,prevented:event.defaultPrevented,focusedFirst:document.activeElement===first,
      first:first?.outerHTML.slice(0,120),last:last?.outerHTML.slice(0,120),
      active:document.activeElement?.outerHTML.slice(0,120)};
  })()`);
  assert.equal(focusTrap.before,true,"Last navigation control must be focusable");
  assert.equal(focusTrap.focusedFirst,true,"Tab at last navigation control must wrap to first");
  await js('document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}))');
  assert.equal(await js('document.querySelector(".projects-drawer-layer")?.dataset.state'), "closing");
  assert.ok((await js('getComputedStyle(document.querySelector(".projects-drawer-panel")).transitionDuration')).includes("0.36s"),
    "Desktop closing slide must last 360ms");
  await closed("projects-desktop-trigger");
  await open(".projects-desktop-trigger");
  await js('document.querySelector(\'[aria-label="Close projects menu"]\').click()');
  await closed("projects-desktop-trigger");

  phase = "mobile drawer";
  await cmd("Emulation.setDeviceMetricsOverride",{width:375,height:760,deviceScaleFactor:1,mobile:true});
  await open(".fundlenz-mobile-menu-trigger");
  await js('document.querySelector(".projects-drawer-backdrop").click()');
  await closed("fundlenz-mobile-menu-trigger");
  phase = "reduced motion";
  await cmd("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  assert.equal(await js('matchMedia("(prefers-reduced-motion: reduce)").matches'), true);
  await open(".fundlenz-mobile-menu-trigger");
  assert.equal(await js('getComputedStyle(document.querySelector(".projects-drawer-panel")).transitionDuration'),
    "0s", "Reduced-motion setting must disable the desktop transition");
  await js('document.querySelector(\'[aria-label="Close projects menu"]\').click()');
  await closed("fundlenz-mobile-menu-trigger");
  // Navigation may change the URL/page; verify it last rather than interrupting mobile QA.
  phase = "navigation link close";
  await cmd("Emulation.setDeviceMetricsOverride",{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await open(".projects-desktop-trigger");
  await js('document.querySelector(\'[role="dialog"] a[href="/fincalc"]\').click()');
  await closed("projects-desktop-trigger", false);
  console.log("PASS: sector lazy/paged rows, filters, keyboard, drawer close/focus, Escape, backdrop, links, reduced motion");
} finally {
  socket?.close();
  if (chrome) {
    const exited = chrome.exitCode !== null || chrome.signalCode !== null;
    if (!exited) {
      const exit = new Promise(resolve => chrome.once("exit", resolve));
      chrome.kill();
      await Promise.race([exit, sleep(1500)]);
    }
  }
  await server.close();
  await rm(directory, {recursive:true,force:true,maxRetries:10,retryDelay:200});
}
