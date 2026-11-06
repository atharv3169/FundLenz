/*
 * Adapted directly from DhvanilPatel/swarm-cursors, swarm-rebuild/swarm.js
 * Upstream source commit blob 626e40b8e7cb5eea3544d814af585ad9b39453dc
 * Source methods preserved: cursorSVG, makeCursor, moveTo, follow, click,
 * type, prepText, reveal, renderCursors and renderOverlay.
 * The page-snapshot/blank/rebuild shell is intentionally excluded.
 */


  const NAMES = [
    "Ada", "Linus", "Grace", "Alan", "Margaret", "Ken", "Barbara", "Dennis",
    "Radia", "Guido", "Frances", "Bjarne", "Hedy", "Tim", "Katherine", "Edsger",
    "Joan", "Donald", "Sophie", "Niklaus", "Anita", "Brian", "Mary", "Rob",
    "Ida", "Yukihiro", "Shafi", "Leslie", "Jean", "Vint", "Lynn", "Bram",
  ];
  const COLORS = [
    "#F24E1E", "#A259FF", "#1ABCFE", "#0ACF83", "#FF7262", "#FFC700",
    "#9747FF", "#E8467C", "#14AE5C", "#0D99FF", "#FF8A00", "#00B5CE",
  ];
  const BLUE = "#0D99FF";
  const RED = "#F24822";
  const RULER = 20;








  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const bump = (it) => { it.v++; };
  const f1 = (n) => Math.round(n * 10) / 10;

  function alphaOf(c) {
    if (!c || c === "transparent") return 0;
    const slash = c.match(/\/\s*([\d.]+%?)\s*\)/);
    if (slash) return slash[1].endsWith("%") ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
    const m = c.match(/^rgba\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(",");
      return p.length >= 4 ? parseFloat(p[3]) : 1;
    }
    return 1;
  }


  const ARROW_D =
    "M4.6 3.9 C4.2 3.1 4.9 2.4 5.7 2.8 L20.6 9.4 C21.5 9.8 21.4 11.1 20.4 11.3 L13.9 12.9 C13.4 13 13 13.4 12.9 13.9 L11.3 20.4 C11.1 21.4 9.8 21.5 9.4 20.6 Z";
  const HOT = {
    arrow: [5, 3.5],
    dup: [5, 3.5],
    pen: [3, 3],
    "pen-add": [3, 3],
    "pen-close": [3, 3],
    cross: [12, 12],
    ibeam: [12, 12],
    ew: [12, 12],
    ns: [12, 12],
  };

  function cursorSVG(shape, c) {
    const st = 'stroke="#fff" stroke-width="1.5" stroke-linejoin="round"';
    switch (shape) {
      case "arrow":
        return `<path d="${ARROW_D}" fill="${c}" ${st}/>`;
      case "dup":
        return (
          `<path d="${ARROW_D}" transform="translate(4 3.5)" fill="#fff" stroke="${c}" stroke-width="1.3" stroke-linejoin="round"/>` +
          `<path d="${ARROW_D}" fill="${c}" ${st}/>`
        );
      case "pen":
      case "pen-add":
      case "pen-close": {
        let s =
          `<path d="M17.4 10.6 L20.6 13.8 L13.8 20.6 L10.6 17.4 Z" fill="${c}" ${st}/>` +
          `<path d="M3 3 L13.1 6.3 L17.4 10.6 L10.6 17.4 L6.3 13.1 Z" fill="${c}" ${st}/>` +
          `<path d="M3.6 3.6 L8.9 8.9" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>` +
          `<circle cx="10.2" cy="10.2" r="1.75" fill="none" stroke="#fff" stroke-width="1.2"/>`;
        if (shape === "pen-add")
          s +=
            `<g stroke-linecap="round"><path d="M23 19.5 V26.5 M19.5 23 H26.5" stroke="#fff" stroke-width="3.4"/>` +
            `<path d="M23 19.5 V26.5 M19.5 23 H26.5" stroke="#1E1E1E" stroke-width="1.3"/></g>`;
        if (shape === "pen-close")
          s +=
            `<circle cx="23" cy="23" r="2.8" fill="none" stroke="#fff" stroke-width="3.2"/>` +
            `<circle cx="23" cy="23" r="2.8" fill="none" stroke="#1E1E1E" stroke-width="1.2"/>`;
        return s;
      }
      case "cross":
        return (
          `<g stroke-linecap="round"><path d="M12 3.5 V20.5 M3.5 12 H20.5" stroke="#fff" stroke-width="3.6"/>` +
          `<path d="M12 3.5 V20.5 M3.5 12 H20.5" stroke="${c}" stroke-width="1.5"/></g>`
        );
      case "ibeam": {
        const d =
          "M8.5 4.5 H10.5 Q12 4.5 12 6 Q12 4.5 13.5 4.5 H15.5 M12 6 V18 M8.5 19.5 H10.5 Q12 19.5 12 18 Q12 19.5 13.5 19.5 H15.5";
        return (
          `<g fill="none" stroke-linecap="round"><path d="${d}" stroke="#fff" stroke-width="3.6"/>` +
          `<path d="${d}" stroke="${c}" stroke-width="1.5"/></g>`
        );
      }
      case "ew":
      case "ns":
        return `<path d="M2.5 12 L7 7.5 V10.4 H17 V7.5 L21.5 12 L17 16.5 V13.6 H7 V16.5 Z"${
          shape === "ns" ? ' transform="rotate(90 12 12)"' : ""
        } fill="${c}" ${st}/>`;
    }
    return "";
  }

  const ATOMIC = new Set(["img", "svg", "video", "canvas", "input", "select", "textarea", "iframe", "picture", "button"]);

  function boxyStyle(st) {
    if (alphaOf(st.backgroundColor) > 0.02) return true;
    if (st.backgroundImage && st.backgroundImage !== "none") return true;
    if (st.boxShadow && st.boxShadow !== "none") return true;
    for (const s of ["Top", "Right", "Bottom", "Left"]) {
      if (parseFloat(st["border" + s + "Width"]) > 0 && st["border" + s + "Style"] !== "none" && alphaOf(st["border" + s + "Color"]) > 0.02) return true;
    }
    return false;
  }


  function wsOf(n, root) {
    for (let e = n; e && e !== root.parentNode; e = e.parentNode) {
      const w = e.style && e.style.whiteSpace;
      if (w) return w;
    }
    return "normal";
  }

  function prepText(it) {
    const live = it.full.cloneNode(true);
    const units = [];
    let seq = "";
    const boxes = [];
    (function rec(n, box) {
      for (const c of [...n.childNodes]) {
        if (c.nodeType === 3) {
          let s = c.data;
          const ws = wsOf(n, live);
          if (!/^pre|break-spaces/.test(ws)) s = s.replace(/[\t\n\r ]+/g, " ");
          if (!s.length) {
            c.remove();
            continue;
          }
          units.push({ t: c, s, len: s.length, box });
          seq += s;
        } else if (c.nodeType === 1) {
          // media, and empty styled boxes (mask icons, dots, swatches) appear in one keystroke
          if (ATOMIC.has(c.localName) || c instanceof SVGElement || (!/\S/.test(c.textContent) && c.style && boxyStyle(c.style))) {
            units.push({ e: c, len: 1, box, on: true });
            seq += "□";
          } else {
            const b = c.style && boxyStyle(c.style) ? c : box;
            if (b === c) boxes.push(c);
            rec(c, b);
          }
        }
      }
    })(live, null);
    for (const u of units) {
      if (u.t) u.t.data = "";
      else {
        u.e.style.visibility = "hidden";
        u.on = false;
      }
    }
    for (const b of boxes) {
      b.style.visibility = "hidden";
      b.__on = false;
    }
    it.live = live;
    it.units = units;
    it.seq = seq;
    it.total = seq.length;
    it.shown = 0;
    it.rshown = 0;
  }

  function reveal(it, n) {
    let left = n;
    let last = null;
    for (const u of it.units) {
      const k = left <= 0 ? 0 : left >= u.len ? u.len : left;
      left -= k;
      if (u.t) {
        const want = k === u.len ? u.s : u.s.slice(0, k);
        if (u.t.data !== want) u.t.data = want;
        if (k) last = u.t;
      } else {
        const on = k > 0;
        if (u.on !== on) {
          u.e.style.visibility = on ? "" : "hidden";
          u.on = on;
        }
        if (on) last = u.e;
      }
      if (k && u.box && u.box.__on === false) {
        for (let b = u.box; b && b !== it.live; b = b.parentNode)
          if (b.__on === false) {
            b.style.visibility = "";
            b.__on = true;
          }
      }
    }
    return last;
  }

export class SwarmMotion {
 constructor(){this.tempo=1;this.sfx=null;this.vp={sx:0,sy:0,ox:0,oy:0,vw:innerWidth,vh:innerHeight};this.time=0;this.mouse=null;this.tv={x:0,y:0};this.lastT=null;}
 get viewTop(){return 0;}
 get viewBot(){return innerHeight;}
 fromViewport(x,y){return {x,y};}
 flockTarget(){return this.mouse||{x:innerWidth/2,y:innerHeight/2};}
 scr(c){return {x:c.x,y:c.y};}


    makeCursor(x, y, home = false) {
      const id = this.nextId++;
      const fast = Math.random() < 0.25;
      return {
        id, x, y, home,
        name: NAMES[id % NAMES.length],
        color: COLORS[id % COLORS.length],
        shape: "arrow", press: 0, task: null, gen: null, ov: null,
        idleFor: 0, leaving: false, worked: false, sticky: false,
        vx: 0, vy: 0, angle: 0,
        speed: fast ? rand(1000, 1500) : rand(300, 750),
        force: fast ? rand(3500, 6000) : rand(700, 1800),
        spin: fast ? rand(2.2, 3.4) : rand(0.8, 1.8),
        curl: rand(-1, 1), orbit: rand(70, 170), follow: false,
      };
    }

    bounds(it) {
      if (it.kind === "text") {
        let h = it.tb.h;
        if (it.editing && !it.selAll && it.total) {
          const lines = Math.max(1, Math.round(it.tb.h / it.lh));
          h = Math.min(it.tb.h, Math.max(it.lh, Math.ceil((it.shown / it.total) * lines) * it.lh));
        }
        const s = it.scale;
        const ax = it.align === "center" ? it.tb.w * (1 - s) / 2 : it.align === "right" || it.align === "end" ? it.tb.w * (1 - s) : 0;
        return { x: it.tb.x + it.dx + ax, y: it.tb.y + it.dy, w: it.tb.w * s, h: h * s };
      }
      if (it.kind === "line") {
        return { x: it.x + it.dx, y: it.y + it.dy, w: it.w, h: it.h };
      }
      return {
        x: it.x + it.dx,
        y: it.y + it.dy,
        w: it.draw ? it.draw.w : it.w,
        h: it.draw ? it.draw.h : it.h,
      };
    }


    selection(it, extra) {
      const b = this.bounds(it);
      return Object.assign(
        {
          t: "box",
          b,
          handles: true,
          badge: `${Math.round(b.w)} × ${Math.round(b.h)}`,
          rulerLines: true,
          underline: it.kind === "text" ? this.underline(it, b) : undefined,
        },
        extra,
      );
    }

    // Boids-ish orbit around a target, ported from the original.
    follow(dt, list, target, scale = 1) {
      const m = this.mouse ? this.fromViewport(this.mouse.x, this.mouse.y) : null;
      const o = target || this.flockTarget();
      const time = this.time;
      if (m && this.lastT && dt > 0) {
        const k = Math.min(1, dt * 18);
        this.tv.x += ((m.x - this.lastT.x) / dt - this.tv.x) * k;
        this.tv.y += ((m.y - this.lastT.y) / dt - this.tv.y) * k;
      }
      this.lastT = m;
      const R = 135 * scale * (1 + 0.18 * Math.sin(time * 0.55));
      const swirl = Math.tanh(Math.cos(time * 0.11) * 3);
      const want = [];
      for (const c of list) {
        const vx = c.x - o.x;
        const vy = c.y - o.y;
        const d = Math.hypot(vx, vy) || 0.01;
        const nx = vx / d;
        const ny = vy / d;
        const ang = Math.atan2(vy, vx);
        const off = (c.orbit - 120) * 0.55 * scale;
        const rr = R * (1 + 0.3 * Math.sin(3 * ang + time * 0.7)) + off;
        const tang = 300 * (0.7 + c.spin * 0.2) * swirl;
        const rad = clamp((rr - d) * 4, -2600, 1400);
        const far = Math.min(1, Math.max(0, (d - rr) / 600));
        want.push([-ny * tang + nx * rad - ny * c.curl * 400 * far, nx * tang + ny * rad + nx * c.curl * 400 * far]);
      }
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        let ax = 0;
        let ay = 0;
        let wsum = 0;
        for (let j = 0; j < list.length; j++) {
          if (j === i) continue;
          const q = list[j];
          const d = Math.hypot(q.x - c.x, q.y - c.y);
          if (d > 90) continue;
          const w = 1 - d / 90;
          ax += q.vx * w;
          ay += q.vy * w;
          wsum += w;
        }
        let [fx, fy] = want[i];
        if (wsum > 0) {
          fx = fx * 0.7 + (ax / wsum) * 0.3;
          fy = fy * 0.7 + (ay / wsum) * 0.3;
        }
        const dist = Math.max(0, Math.hypot(c.x - o.x, c.y - o.y) - 180 * scale);
        const maxV = c.speed * (1.3 + Math.min(3.2, dist / 90));
        const L = Math.hypot(fx, fy);
        if (L > maxV) {
          fx *= maxV / L;
          fy *= maxV / L;
        }
        let gx = (fx - c.vx) * 6;
        let gy = (fy - c.vy) * 6;
        const maxF = c.force * (1.4 + Math.min(5, dist / 50));
        const G = Math.hypot(gx, gy);
        if (G > maxF) {
          gx *= maxF / G;
          gy *= maxF / G;
        }
        c.vx += gx * dt;
        c.vy += gy * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      }
      const R0 = 48;
      let touched = false;
      if (m)
        for (const c of list) {
          const vx = c.x - m.x;
          const vy = c.y - m.y;
          const d = Math.hypot(vx, vy) || 0.01;
          if (d >= R0) continue;
          touched = true;
          const nx = vx / d;
          const ny = vy / d;
          c.x = m.x + nx * R0;
          c.y = m.y + ny * R0;
          const rel = (c.vx - this.tv.x) * nx + (c.vy - this.tv.y) * ny;
          if (rel < 0) {
            c.vx -= nx * rel * 1.6;
            c.vy -= ny * rel * 1.6;
          }
          c.vx += nx * 260;
          c.vy += ny * 260;
        }
      for (const c of list) {
        if (Math.hypot(c.vx, c.vy) < 30) continue;
        const d = ((((Math.atan2(c.vy, c.vx) * 180) / Math.PI + 128 - c.angle + 540) % 360) + 360) % 360 - 180;
        c.angle += d * Math.min(1, dt * 8);
        c.press = Math.max(0, c.press - dt * 6);
      }
      return touched;
    }

    *wait(t) {
      let n = 0;
      while (n < t) n += (yield) * this.tempo;
    }

    *moveTo(c, target, o = {}) {
      const get = typeof target === "function" ? target : () => target;
      const x0 = c.x;
      const y0 = c.y;
      const p0 = get();
      const dist = Math.hypot(p0.x - x0, p0.y - y0);
      if (dist < 0.5 && !o.duration) {
        c.x = p0.x;
        c.y = p0.y;
        if (o.onStep) o.onStep();
        return;
      }
      const dur = o.duration || clamp(0.12 + Math.sqrt(dist) * 0.021, 0.14, 0.9) / (o.speed || 1);
      const bend = (o.bend != null ? o.bend : (Math.random() < 0.5 ? -1 : 1) * rand(0.04, 0.14)) * Math.min(dist, 600);
      let t = 0;
      while (t < dur) {
        t += (yield) * this.tempo;
        const k = Math.min(1, t / dur);
        const e = o.drag || k < 0.15 ? easeInOut(k) : easeOut(k);
        const p = get();
        const dx = p.x - x0;
        const dy = p.y - y0;
        const L = Math.hypot(dx, dy) || 1;
        const off = Math.sin(Math.PI * e) * bend;
        c.x = x0 + dx * e + (-dy / L) * off;
        c.y = y0 + dy * e + (dx / L) * off;
        if (o.onStep) o.onStep();
      }
      const p = get();
      c.x = p.x;
      c.y = p.y;
      if (o.onStep) o.onStep();
    }

    *click(c) {
      c.press = 1;
      if (this.sfx) this.sfx.press(this.scr(c).x, this.vp.vw);
      yield* this.wait(0.07);
    }

    *type(it, c) {
      const N = it.total;
      const k = clamp(70 / Math.max(1, N), 0.06, 1);
      let budget = 0;
      let i = it.shown;
      while (i < N) {
        budget += (yield) * this.tempo;
        while (i < N && budget > 0) {
          const ch = it.seq[i];
          let d = rand(0.012, 0.04);
          if (ch === " ") d += rand(0, 0.03);
          if (ch === "\n") d += 0.1;
          if (Math.random() < 0.025) d += rand(0.08, 0.2);
          budget -= d * k;
          i++;
        }
        if (c && this.sfx && i > it.shown) this.sfx.key(this.scr(c).x, this.vp.vw, c.id, i - it.shown, /\s/.test(it.seq.slice(it.shown, i)) ? 1 : 0);
        it.shown = i;
        bump(it);
      }
    }

}

export class SwarmLiveView {
 constructor(host){
  this.host=host;this.W=innerWidth;this.H=innerHeight;
  this.vp={sx:0,sy:0,ox:0,oy:0,vw:this.W,vh:this.H};
  this.cursorEls=new Map();this._ovS="";this._ovB="";
  const ov=document.createElementNS("http://www.w3.org/2000/svg","svg");
  ov.setAttribute("class","swarm-original-overlay");
  ov.setAttribute("width",this.W);ov.setAttribute("height",this.H);
  ov.style.cssText="position:absolute;inset:0;pointer-events:none;overflow:visible";
  const badges=document.createElement("div");
  badges.className="swarm-original-badges";
  const cursors=document.createElement("div");
  cursors.className="swarm-original-cursors";
  host.append(ov,badges,cursors);
  this.ov=ov;this.badges=badges;this.cursorsEl=cursors;
 }


    renderCursors(E) {
      const vp = E.vp;
      const seen = new Set();
      for (const c of E.cursors) {
        let el = this.cursorEls.get(c.id);
        if (!el) {
          el = document.createElement("div");
          el.className = "cursor";
          el.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"></svg>';
          this.cursorsEl.appendChild(el);
          this.cursorEls.set(c.id, el);
          el._shape = "";
        }
        seen.add(c.id);
        const X = c.sticky ? c.x : c.x - vp.sx + vp.ox;
        const Y = c.sticky ? c.y : c.y - vp.sy + vp.oy;
        el.style.transform = `translate(${f1(X)}px,${f1(Y)}px)`;
        const svg = el.firstChild;
        if (el._shape !== c.shape) {
          svg.innerHTML = cursorSVG(c.shape, c.color);
          el._shape = c.shape;
          const [hx, hy] = HOT[c.shape];
          el._hx = hx;
          el._hy = hy;
          svg.style.transformOrigin = `${hx}px ${hy}px`;
        }
        const s = 1 - c.press * 0.12;
        svg.style.transform = `translate(${-el._hx}px,${-el._hy}px) rotate(${f1(c.angle)}deg) scale(${s})`;
      }
      for (const [id, el] of this.cursorEls)
        if (!seen.has(id)) {
          el.remove();
          this.cursorEls.delete(id);
        }
    }

    renderOverlay(E) {
      const vp = E.vp;
      const W = this.W;
      const H = this.H;
      const X = (x, st) => f1(st ? x : x - vp.sx + vp.ox);
      const Y = (y, st) => f1(st ? y : y - vp.sy + vp.oy);
      let s = "";
      let b = "";
      for (const g of E.guides) {
        if (!g.vis || g.op <= 0) continue;
        const sw = 1 + g.flash;
        const flt = g.flash > 0 ? ` style="filter:drop-shadow(0 0 ${f1(2 + g.flash * 3)}px ${RED})"` : "";
        if (g.axis === "x") {
          const x = X(g.cur);
          s += `<line x1="${x}" x2="${x}" y1="0" y2="${H}" stroke="${RED}" stroke-width="${sw}" opacity="${f1(g.op)}"${flt}/>`;
        } else {
          const y = Y(g.cur);
          s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="${RED}" stroke-width="${sw}" opacity="${f1(g.op)}"${flt}/>`;
        }
      }
      for (const it of E.editLines) {
        const st = it.layer !== "world";
        const pts = it.pts.slice(0, it.placed).map((p) => [X(p.x + it.dx, st), Y(p.y + it.dy, st)]);
        const o = it.owner;
        const all = o ? [...pts, [X(o.x, o.sticky), Y(o.y, o.sticky)]] : pts;
        s += `<polyline points="${all.map((p) => p.join(",")).join(" ")}${it.shut && pts[0] ? " " + pts[0].join(",") : ""}" fill="none" stroke="${BLUE}" stroke-width="1.5"/>`;
        for (const p of pts) s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.6" fill="#fff" stroke="${BLUE}" stroke-width="1.5"/>`;
      }
      const rt = E.rulers.t;
      for (const c of E.cursors) {
        if (!c.ov) continue;
        const st = c.sticky;
        for (const v of c.ov()) {
          if (v.t === "box") {
            const x = X(v.b.x, st);
            const y = Y(v.b.y, st);
            const w = f1(v.b.w);
            const h = f1(v.b.h);
            const col = v.color === "red" ? RED : BLUE;
            s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${col}" stroke-width="1"/>`;
            if (v.underline && v.underline.w > 0) {
              const u = v.underline;
              s += `<line x1="${X(u.x, st)}" x2="${X(u.x + u.w, st)}" y1="${Y(u.y, st)}" y2="${Y(u.y, st)}" stroke="${BLUE}" stroke-width="1.5"/>`;
            }
            if (v.rulerLines && rt > 0.05)
              s += `<g stroke="${BLUE}" stroke-width="1" stroke-dasharray="2 2" opacity="${f1(rt)}"><line x1="${RULER}" x2="${x}" y1="${f1(y + h / 2)}" y2="${f1(y + h / 2)}"/><line x1="${f1(x + w / 2)}" x2="${f1(x + w / 2)}" y1="${RULER}" y2="${y}"/></g>`;
            if (v.handles)
              for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]])
                s += `<rect x="${f1(hx - 3.5)}" y="${f1(hy - 3.5)}" width="7" height="7" fill="#fff" stroke="${col}" stroke-width="1"/>`;
            if (v.badge && w > 0) b += `<div class="badge" style="left:${f1(x + w / 2)}px;top:${f1(y + h + 8)}px;background:${col}">${v.badge}</div>`;
          } else if (v.t === "measure") {
            const a = { x: X(v.a.x, st), y: Y(v.a.y, st) };
            const z = { x: X(v.b.x, st), y: Y(v.b.y, st) };
            s += `<line x1="${a.x}" y1="${a.y}" x2="${z.x}" y2="${z.y}" stroke="${RED}" stroke-width="1"/>`;
            const horiz = a.y === z.y;
            b += `<div class="badge" style="left:${f1(horiz ? (a.x + z.x) / 2 : a.x + 18)}px;top:${f1(horiz ? a.y + 8 : (a.y + z.y) / 2 - 9)}px;background:${RED}">${v.label}</div>`;
          }
        }
      }
      if (s !== this._ovS) {
        this.ov.innerHTML = s;
        this._ovS = s;
      }
      if (b !== this._ovB) {
        this.badges.innerHTML = b;
        this._ovB = b;
      }
    }

 render(E){this.W=innerWidth;this.H=innerHeight;this.vp={sx:0,sy:0,ox:0,oy:0,vw:this.W,vh:this.H};this.ov.setAttribute("width",this.W);this.ov.setAttribute("height",this.H);this.renderOverlay(E);this.renderCursors(E);}
 destroy(){this.ov.remove();this.badges.remove();this.cursorsEl.remove();}
}

export { cursorSVG, HOT, COLORS, NAMES, prepText, reveal, clamp, easeInOut, easeOut, rand };