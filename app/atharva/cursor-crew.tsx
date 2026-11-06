"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import s from "./cursor-crew.module.css";

export type MorphSignal = {
  sequence: number;
  storyId: string;
  opening: boolean;
  originX: number;
  originY: number;
};

type XY = { x: number; y: number };
type Agent = XY & { vx: number; vy: number };
type Target = "title" | "figure" | "figure-primary" | "figure-secondary" | "metrics" | "heading" | "reader-intro" | "chapter" | "chapter-two";
type Task = {
  target: Target;
  u: number;
  v: number;
  begin: number;
  finish: number;
  shape: "arrow" | "resize" | "text";
  label: string;
};

const COLORS = [
  "#f07a50", "#b090ff", "#41c5ff", "#49cfa4", "#ffc970", "#f295af",
  "#72bde5", "#acdc9c", "#d7a0fb", "#f4b879", "#68d8cc", "#e6a3cd",
  "#80a8fb", "#e9d893", "#a1d6b8", "#f5a8a1", "#a6c4fc", "#b3e4db",
];
const TASKS: Task[] = [
  { target:"title",u:0,v:0,begin:.02,finish:.62,shape:"arrow",label:"MOVE" },
  { target:"title",u:1,v:0,begin:.02,finish:.62,shape:"resize",label:"RESIZE" },
  { target:"title",u:0,v:1,begin:.04,finish:.64,shape:"arrow",label:"ALIGN" },
  { target:"title",u:1,v:1,begin:.04,finish:.64,shape:"resize",label:"FIT" },
  { target:"figure-primary",u:0,v:0,begin:.06,finish:.68,shape:"arrow",label:"DRAG" },
  { target:"figure-primary",u:1,v:0,begin:.07,finish:.68,shape:"resize",label:"SCALE" },
  { target:"figure-secondary",u:1,v:1,begin:.08,finish:.68,shape:"resize",label:"RESIZE" },
  { target:"figure-secondary",u:0,v:1,begin:.09,finish:.68,shape:"resize",label:"PLACE" },
  { target:"metrics",u:.12,v:.25,begin:.1,finish:.64,shape:"arrow",label:"MOVE" },
  { target:"metrics",u:.82,v:.48,begin:.1,finish:.65,shape:"arrow",label:"ALIGN" },
  { target:"heading",u:.04,v:.22,begin:.27,finish:.71,shape:"text",label:"TYPE" },
  { target:"heading",u:.7,v:.54,begin:.28,finish:.71,shape:"text",label:"PLACE" },
  { target:"reader-intro",u:.08,v:.38,begin:.3,finish:.73,shape:"text",label:"WRITE" },
  { target:"reader-intro",u:.85,v:.58,begin:.31,finish:.75,shape:"text",label:"TYPE" },
  { target:"chapter",u:.06,v:.12,begin:.34,finish:.76,shape:"text",label:"PLACE" },
  { target:"chapter",u:.72,v:.3,begin:.35,finish:.77,shape:"text",label:"WRITE" },
  { target:"chapter-two",u:.08,v:.16,begin:.39,finish:.78,shape:"text",label:"TYPE" },
  { target:"chapter-two",u:.85,v:.4,begin:.4,finish:.79,shape:"text",label:"FINISH" },
];

const TOTAL_MS = 2550;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (v: number) => { const p = clamp(v, 0, 1); return p * p * (3 - 2 * p); };
const eligible = () =>
  window.matchMedia("(min-width: 1024px)").matches &&
  !window.matchMedia("(pointer: coarse)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function bounds(section: HTMLElement | null, target: Target): DOMRect | null {
  if (!section) return null;
  const marker=target==="figure-primary"?"[data-crew-object=primary]":
    target==="figure-secondary"?"[data-crew-object=secondary]":
    "[data-crew-target="+target+"]";
  const el=section.querySelector<HTMLElement>(marker)||
    (target.startsWith("figure-")?section.querySelector<HTMLElement>("[data-crew-target=figure]"):null);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return rect.width > 4 && rect.height > 4 ? rect : null;
}
function sample(rect: DOMRect | null, task: Task): XY | null {
  if (!rect) return null;
  return { x: rect.left + rect.width * task.u, y: rect.top + rect.height * task.v };
}
function guide(el: HTMLDivElement | null, rect: DOMRect | null, visible: boolean) {
  if (!el) return;
  if (!visible || !rect) { el.style.opacity = "0"; return; }
  const left = clamp(rect.left, 9, innerWidth - 12);
  const right = clamp(rect.right, 12, innerWidth - 9);
  const top = clamp(rect.top, 79, innerHeight - 13);
  const bottom = clamp(rect.bottom, 83, innerHeight - 9);
  if (right - left < 18 || bottom - top < 18) { el.style.opacity = "0"; return; }
  el.style.transform = "translate3d(" + left + "px," + top + "px,0)";
  el.style.width = (right - left) + "px";
  el.style.height = (bottom - top) + "px";
  el.style.opacity = "1";
  el.dataset.everVisible="true";
  const badge = el.querySelector<HTMLElement>("[data-dim]");
  if (badge) badge.textContent = Math.round(rect.width) + " × " + Math.round(rect.height);
}

/** A temporary, non-blocking swarm. No cursors exist in the page when idle. */
export default function CursorCrew({ signal }: { signal: MorphSignal | null }) {
  const [running, setRunning] = useState(false);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const active = useRef<{ signal: MorphSignal; started: number } | null>(null);
  const agents = useRef<Agent[]>([]);
  const pointer = useRef<XY>({ x: 0, y: 0 });
  const hasPointer = useRef(false);

  useEffect(() => {
    const track = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointer.current = { x: e.clientX, y: e.clientY };
      hasPointer.current = true;
    };
    window.addEventListener("pointermove", track, { passive: true });
    return () => window.removeEventListener("pointermove", track);
  }, []);

  useEffect(() => {
    if (!signal || !eligible()) return;
    const origin = {
      x: clamp(signal.originX, 10, innerWidth - 10),
      y: clamp(signal.originY, 82, innerHeight - 10),
    };
    active.current = { signal: { ...signal, ...{ originX: origin.x, originY: origin.y } }, started: performance.now() };
    if (!hasPointer.current) pointer.current = origin;
    agents.current = TASKS.map((_, i) => ({
      x: origin.x + Math.cos(i * 2.4) * (i % 3),
      y: origin.y + Math.sin(i * 2.4) * (i % 3),
      vx: 0, vy: 0,
    }));
    const frame = requestAnimationFrame(() => setRunning(true));
    return () => cancelAnimationFrame(frame);
  }, [signal]);

  useEffect(() => {
    if (!running || !layerRef.current) return;
    const layer = layerRef.current;
    const nodes = Array.from(layer.querySelectorAll<HTMLElement>("[data-crew-agent]"));
    const titleGuide = layer.querySelector<HTMLDivElement>("[data-crew-guide=title]");
    const artGuide = layer.querySelector<HTMLDivElement>("[data-crew-guide=figure]");
    const textGuide = layer.querySelector<HTMLDivElement>("[data-crew-guide=lead]");
    let frame = 0, last = performance.now();

    const step = (now: number) => {
      const state = active.current;
      if (!state) { setRunning(false); return; }
      if (!eligible()) { active.current = null; setRunning(false); return; }
      if (document.hidden) { frame = requestAnimationFrame(step); return; }
      const dt = clamp((now - last) / 1000, .004, .045);
      last = now;
      const t = clamp((now - state.started) / TOTAL_MS, 0, 1);
      const section = document.getElementById("story-" + state.signal.storyId);
      const title=bounds(section,"title");
      const figure=bounds(section,"figure");
      const primary=bounds(section,"figure-primary");
      const secondary=bounds(section,"figure-secondary");
      const heading=bounds(section,"heading");
      const rects:Record<Target,DOMRect|null>={
        title,figure,"figure-primary":primary,"figure-secondary":secondary,
        metrics:bounds(section,"metrics"),
        heading,
        "reader-intro":bounds(section,"reader-intro"),
        chapter:bounds(section,"chapter"),
        "chapter-two":bounds(section,"chapter-two"),
      };
      const origin = { x: state.signal.originX, y: state.signal.originY };
      const home = hasPointer.current ? pointer.current : origin;
      const returning = t >= .80;
      layer.dataset.phase = t < .085 ? "emerging" : returning ? "returning" : state.signal.opening ? "assembling" : "dismantling";
      if(layer.dataset.phase==="assembling")layer.dataset.didAssemble="true";
      if(layer.dataset.phase==="dismantling")layer.dataset.didDismantle="true";
      layer.dataset.working = returning ? "false" : "true";
      guide(titleGuide,title,state.signal.opening?t>.12&&t<.78:t>.30&&t<.80);
      guide(artGuide,t<.50?primary:secondary,state.signal.opening?t>.16&&t<.79:t>.31&&t<.80);
      guide(textGuide,heading,state.signal.opening?t>.38&&t<.79:t>.09&&t<.38);

      const updated: Agent[] = agents.current;
      nodes.forEach((node, i) => {
        const task = TASKS[i], a = updated[i];
        const angle = (i / TASKS.length) * Math.PI * 2;
        const wave = 6 + (i % 4) * 5;
        const burst = ease(t / .065);
        const spread = {
          x: origin.x + Math.cos(angle * 2.3) * wave * burst,
          y: origin.y + Math.sin(angle * 2.3) * wave * burst,
        };
        const movingTarget = sample(rects[task.target], task) || spread;
        const leftTask=i<10;
        const start=state.signal.opening
          ? (leftTask?.015+(i%4)*.009:.24+(i%4)*.011)
          : (leftTask?.26+(i%4)*.012:.02+(i%4)*.009);
        const stop=state.signal.opening
          ? (leftTask?.67:.79)
          : (leftTask?.79:.38);
        const formation=ease((t-start)/.15);
        let target = {
          x: spread.x + (movingTarget.x - spread.x) * formation,
          y: spread.y + (movingTarget.y - spread.y) * formation,
        };
        // After completing its work each agent gathers behind the real pointer.
        const recall = ease((t - .795) / .19);
        const trail = (1 - recall) * 13;
        const gather = {
          x: home.x + Math.cos(angle + now * .003) * trail,
          y: home.y + Math.sin(angle + now * .003) * trail,
        };
        target = {
          x: target.x + (gather.x - target.x) * recall,
          y: target.y + (gather.y - target.y) * recall,
        };

        // Boids-style collision avoidance + spring steering. The task points
        // themselves follow the moving DOM, so cursors visibly drag real items.
        let avoidX = 0, avoidY = 0;
        for (let j = 0; j < updated.length; j++) {
          if (j === i) continue;
          const other = updated[j], dx = a.x - other.x, dy = a.y - other.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 4 && d2 < 27 * 27) {
            const push = (27 - Math.sqrt(d2)) / 27;
            avoidX += dx * push; avoidY += dy * push;
          }
        }
        const dx = target.x - a.x, dy = target.y - a.y;
        const dist = Math.hypot(dx, dy);
        const speed = Math.min(returning?2600:2300,dist*(returning?9:8.7));
        const desiredX = dist > .01 ? dx / dist * speed : 0;
        const desiredY = dist > .01 ? dy / dist * speed : 0;
        const force=Math.min(1,dt*(returning?22:18));
        a.vx+=(desiredX-a.vx)*force+avoidX*dt*1.4;
        a.vy+=(desiredY-a.vy)*force+avoidY*dt*1.4;
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        node.style.transform = "translate3d(" + a.x.toFixed(1) + "px," + a.y.toFixed(1) + "px,0)";
        // Tool changes are tied to its particular build task.
        const doingTask=t>start+.11&&t<stop&&!returning;
        const role=doingTask?(state.signal.opening?task.shape:leftTask?task.shape:"text"):"arrow";
        if(node.dataset.tool!==role)node.dataset.tool=role;
        const label=state.signal.opening?task.label:(leftTask?"RESTORE":"ERASE");
        if(node.dataset.label!==label){
          node.dataset.label=label;
          const badge=node.querySelector("span");if(badge)badge.textContent=label;
        }
        node.dataset.active=doingTask&&dist<70?"true":"false";
        const opacity=ease((t-i*.0017)/.04)*(1-ease((t-.89)/.105));
        node.style.opacity = opacity.toFixed(2);
        const rotating = clamp(a.vx * .012, -15, 15);
        node.style.setProperty("--turn", rotating.toFixed(1) + "deg");
        node.style.setProperty("--compress", doingTask && dist < 32 ? ".85" : "1");
      });
      if (t >= 1) {
        active.current = null;
        setRunning(false);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  if (!running) return null;
  return <div className={s.layer} ref={layerRef} data-cursor-crew data-phase="emerging" data-working="true" aria-hidden="true">
    <div className={s.selection+" "+s.selectionTitle} data-crew-guide="title"><i/><i/><i/><i/><b data-dim>MOVE</b></div>
    <div className={s.selection+" "+s.selectionFigure} data-crew-guide="figure"><i/><i/><i/><i/><b data-dim>RESIZE</b></div>
    <div className={s.selection+" "+s.selectionText} data-crew-guide="lead"><i/><i/><i/><i/><b data-dim>TYPE</b></div>
    {TASKS.map((task, i) => <div className={s.agent} key={i} data-crew-agent data-tool="arrow" style={{ "--agent-color": COLORS[i] } as CSSProperties}>
      <svg viewBox="0 0 28 28" className={s.cursorShape} aria-hidden="true">
        <path className={s.arrow} d="M4 2.5 L6 23 L11 16 L19.4 15 Z" fill="var(--agent-color)" stroke="#f7f9f6" strokeWidth="1.6" strokeLinejoin="round"/>
        <path className={s.arrow} d="M10.8 16 L14.2 24" fill="none" stroke="#f7f9f6" strokeWidth="2" strokeLinecap="round"/>
        <path className={s.resize} d="M2.5 14 L9 7.5 V11 H19 V7.5 L25.5 14 L19 20.5 V17 H9 V20.5 Z" fill="var(--agent-color)" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round"/>
        <path className={s.textBeam} d="M9 4 H11 L14 7 L17 4 H19 M14 7 V21 M9 24 H11 L14 21 L17 24 H19" fill="none" stroke="var(--agent-color)" strokeWidth="2.1" strokeLinecap="round"/>
      </svg>
      <span>{task.label}</span>
    </div>)}
  </div>;
}
