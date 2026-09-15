// Tono Bagno v3 — one ticker, one scroll engine, the sample-tray mechanic, loader, seamless page transitions,
// menu, and the motion texture. Every interaction is written to survive fast pointers and fast scrolling:
// GSAP tweens carry overwrite, positions are set before reveals, reveals fire once, pinned content uses its own trigger.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText, Draggable, InertiaPlugin);

const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const materials = ["porcelanico", "ceramico", "hidraulico", "piedra", "mosaico", "terracota", "parque"];
const names = { porcelanico: "Porcelánico", ceramico: "Cerámico", hidraulico: "Hidráulico", piedra: "Piedra natural", mosaico: "Mosaico", terracota: "Terracota", parque: "Parqué" };

/* ---------- The mechanic: pick a material, the page takes it ---------- */
const themeMeta = document.querySelector('meta[name="theme-color"]');
function setMaterial(id, { persist = true } = {}) {
  if (!materials.includes(id)) return;
  root.dataset.material = id;
  document.querySelectorAll(".sample").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.material === id)));
  document.querySelectorAll(".veil-tray img").forEach((im) => im.toggleAttribute("data-on", im.dataset.material === id));
  document.querySelectorAll("[data-chosen]").forEach((el) => (el.textContent = names[id]));
  if (persist) { try { localStorage.setItem("tb-material", id); } catch {} }
  requestAnimationFrame(() => { if (themeMeta) themeMeta.content = getComputedStyle(document.body).backgroundColor; });
}
let stored = null;
try { stored = localStorage.getItem("tb-material"); } catch {}
setMaterial(stored || "porcelanico", { persist: false });
const grounds = { porcelanico: "oklch(92% 0.006 85)", ceramico: "oklch(50% 0.09 200)", hidraulico: "oklch(86% 0.035 130)", piedra: "oklch(80% 0.035 80)", mosaico: "oklch(36% 0.035 45)", terracota: "oklch(64% 0.10 55)", parque: "oklch(61% 0.07 60)" };
const tintLayer = document.querySelector(".tint");
let switching = false;
function pickMaterial(id, x, y) {
  if (!materials.includes(id) || id === root.dataset.material || switching) return;
  if (reduce || document.getElementById("menu")?.open) return setMaterial(id);
  if (document.startViewTransition) {
    switching = true;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
    root.style.setProperty("--vt-x", x + "px"); root.style.setProperty("--vt-y", y + "px"); root.style.setProperty("--vt-r", r + "px");
    root.style.setProperty("--t-tint", "0ms");
    const vt = document.startViewTransition(() => setMaterial(id));
    vt.finished.finally(() => { root.style.removeProperty("--t-tint"); switching = false; });
    return;
  }
  if (!tintLayer) return setMaterial(id);
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
  tintLayer.style.background = grounds[id]; tintLayer.style.visibility = "visible";
  gsap.fromTo(tintLayer, { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)`, duration: 1.1, ease: "power3.inOut", overwrite: true,
    onComplete: () => { root.style.setProperty("--t-tint", "0ms"); setMaterial(id); requestAnimationFrame(() => requestAnimationFrame(() => { tintLayer.style.visibility = "hidden"; root.style.removeProperty("--t-tint"); })); } });
  // the samples and the footer line react at once; the ground follows under the circle
  document.querySelectorAll(".sample").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.material === id)));
  document.querySelectorAll("[data-chosen]").forEach((el) => (el.textContent = names[id]));
}
document.addEventListener("click", (e) => { const s = e.target.closest(".sample"); if (!s) return; const b = s.getBoundingClientRect(); pickMaterial(s.dataset.material, b.left + b.width / 2, b.top + b.height * 0.6); });

/* ---------- Scroll engine (exactly one) ---------- */
const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, anchors: true });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

/* ---------- Frame reveal helper: the newest image covers the previous through a clip, never a fade ---------- */
function frameSwapper(frame) {
  const imgs = [...frame.querySelectorAll("img")];
  let z = 1, current = null;
  return (id) => {
    const im = imgs.find((i) => i.dataset.for === id);
    if (!im || id === current) return;
    current = id;
    im.style.zIndex = ++z;
    gsap.killTweensOf(im);
    gsap.fromTo(im, { clipPath: "inset(100% 0 0 0)", scale: 1.08 }, { clipPath: "inset(0% 0 0 0)", scale: 1, duration: 0.6, ease: "expo.out", overwrite: true });
  };
}

/* The cursor element must sit inside whichever dialog is open (the top layer covers everything else) */
function parkCursor(host) { const el = document.querySelector(".cursor"); if (!el) return; (host || document.body).appendChild(el); }

/* ---------- Menu: giant words, siblings dim, a frame that reveals the section, the tray ---------- */
const menu = document.getElementById("menu");
const menuBtn = document.querySelector('[aria-controls="menu"]');
if (menu && menuBtn) {
  const links = menu.querySelectorAll("nav a");
  const show = frameSwapper(menu.querySelector(".menu-peek"));
  links.forEach((a) => { a.addEventListener("pointerenter", () => show(a.dataset.peek)); a.addEventListener("focus", () => show(a.dataset.peek)); });
  const closeBtn = menu.querySelector(".menu-close");
  menuBtn.addEventListener("click", () => {
    menu.showModal(); parkCursor(menu); menuBtn.setAttribute("aria-expanded", "true"); lenis.stop();
    if (closeBtn) { closeBtn.setAttribute("aria-expanded", "false"); requestAnimationFrame(() => requestAnimationFrame(() => closeBtn.setAttribute("aria-expanded", "true"))); }
    show(menu.querySelector('nav a[aria-current="page"]')?.dataset.peek || "showrooms");
    if (!reduce) gsap.fromTo(menu.querySelectorAll("nav a span"), { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.06, delay: 0.2, overwrite: true, clearProps: "transform" });
  });
  menu.addEventListener("close", () => { parkCursor(null); menuBtn.setAttribute("aria-expanded", "false"); lenis.start(); });
  closeBtn?.addEventListener("click", () => { closeBtn.setAttribute("aria-expanded", "false"); setTimeout(() => menu.close(), 120); });
}

/* ---------- Per-page motion (reverted on every transition) ---------- */
let ctx = null;
function initPage(scope) {
  ctx?.revert();
  ctx = gsap.context(() => {
    const mm = gsap.matchMedia();
    mm.add({ desktop: "(min-width: 900px)", phone: "(max-width: 899px)", reduce: "(prefers-reduced-motion: reduce)" }, (c) => {
      const { desktop, reduce } = c.conditions;
      if (reduce) return; // final states are the CSS defaults

      // Text: headings rise through masks, once, when they arrive. Inside a pinned section the pin itself is the trigger.
      scope.querySelectorAll(".reveal-lines").forEach((el) => {
        const atLoad = el.closest(".hero, .page-head");
        const pinned = el.closest(".gal-pin");
        SplitText.create(el, {
          type: "lines", mask: "lines", autoSplit: true, aria: "auto", linesClass: "line",
          onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.15, ease: "expo.out", stagger: 0.085, delay: atLoad ? 0.1 : 0, overwrite: true,
            scrollTrigger: atLoad ? null : { trigger: pinned || el, start: pinned ? "top 90%" : "top 90%", once: true } }),
        });
      });
      // Statements read themselves line by line as you scroll (scrubbed; reversible; nothing to break).
      scope.querySelectorAll(".statement").forEach((el) => {
        SplitText.create(el, { type: "lines", autoSplit: true, aria: "auto",
          onSplit: (self) => gsap.fromTo(self.lines, { opacity: 0.14 }, { opacity: 1, stagger: 0.3, ease: "none", overwrite: true,
            scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: 0.6 } }) });
      });

      // Hero: the samples settle onto the counter; the lead appears after the lines.
      if (scope.querySelector(".hero")) {
        gsap.from(".hero .sample", { y: 28, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.05, delay: 0.35, clearProps: "opacity,transform" });
        gsap.from(".hero .sub", { opacity: 0, y: 12, duration: 0.8, ease: "power2.out", delay: 0.75, clearProps: "all" });
        if (desktop) gsap.to(".hero .display", { yPercent: -12, opacity: 0.35, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 } });
      }
      if (scope.querySelector(".page-head .lead")) gsap.from(".page-head .lead", { opacity: 0, y: 12, duration: 0.8, ease: "power2.out", delay: 0.7, clearProps: "all" });

      // Images: settle (1.06 → 1) and drift 6 % while crossing the viewport; framed images grow out of an inset as they arrive.
      gsap.utils.toArray(".media[data-settle] img").forEach((img) => {
        gsap.fromTo(img, { yPercent: -6, scale: 1.06 }, { yPercent: 6, scale: 1, ease: "none",
          scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: 0.8 } });
      });
      gsap.utils.toArray(".media[data-reveal]").forEach((fig) => {
        gsap.fromTo(fig, { clipPath: "inset(12% 8% 12% 8%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none",
          scrollTrigger: { trigger: fig, start: "top 92%", end: "top 40%", scrub: 0.8 } });
      });

      // Brand bands: two rows drift in opposite directions, forever; the pointer slows them down.
      scope.querySelectorAll(".marquee").forEach((m) => {
        const track = m.querySelector(".track"); if (!track) return;
        const rtl = m.dataset.dir === "rtl"; const half = () => track.scrollWidth / 2;
        const tw = gsap.fromTo(track, { x: rtl ? -half() : 0 }, { x: rtl ? 0 : -half(), ease: "none", duration: half() / 42, repeat: -1 });
        m.addEventListener("pointerenter", () => gsap.to(tw, { timeScale: 0.18, duration: 0.8, ease: "power2.out" }));
        m.addEventListener("pointerleave", () => gsap.to(tw, { timeScale: 1, duration: 0.8, ease: "power2.out" }));
        ScrollTrigger.create({ trigger: m, start: "top bottom", end: "bottom top", onToggle: (st) => (st.isActive ? tw.play() : tw.pause()) });
      });

      // Rows arrive one after another (masked, once). Fast scrolling just plays them faster.
      gsap.utils.toArray(".rows, .index-list, .toc, .people").forEach((list) => {
        const items = list.querySelectorAll(":scope > li");
        gsap.set(items, { y: 18, opacity: 0 });
        ScrollTrigger.batch(items, { start: "top 96%", once: true, batchMax: 10,
          onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.045, overwrite: true, clearProps: "transform,opacity" }) });
      });

      // Pinned galleries (showrooms, process): each scroll step reveals the next photograph and the next beat of text.
      if (desktop) {
        gsap.utils.toArray(".gal").forEach((gal) => {
          const figs = gal.querySelectorAll(".gal-media figure");
          const beats = gal.querySelectorAll(".gal-beats > *");
          const count = gal.querySelector(".count");
          const tl = gsap.timeline({ scrollTrigger: { trigger: gal.querySelector(".gal-pin"), start: "top top", end: () => "+=" + (figs.length * 80) + "%", pin: true, scrub: 1.4, anticipatePin: 1, invalidateOnRefresh: true,
            snap: { snapTo: (v) => Math.round(v * (figs.length - 1)) / (figs.length - 1), duration: { min: 0.6, max: 1.6 }, delay: 0.2, ease: "power2.inOut", inertia: false },
            onUpdate: (self) => { if (count) count.textContent = `${Math.min(figs.length, 1 + Math.floor(self.progress * figs.length + 0.15))} / ${figs.length}`; } } });
          figs.forEach((f, i) => { if (i === 0) return;
            tl.fromTo(f, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", ease: "none", duration: 1 }, i - 0.5)
              .fromTo(f.querySelector("img"), { scale: 1.08 }, { scale: 1, ease: "none", duration: 1 }, "<");
            if (beats[i]) tl.to(beats[i - 1], { opacity: 0, y: -10, duration: 0.3 }, i - 0.5).fromTo(beats[i], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3 }, i - 0.3);
          });
        });
      }
    });
  }, scope);

  /* Pointer-follow preview for rows (desktop only): placed at the pointer before it reveals, never travelling from a corner */
  const peek = document.querySelector(".peek");
  if (peek && fine && !reduce) {
    const imgs = peek.querySelectorAll("img"); let flip = 0;
    const cur = { x: 0, y: 0, r: 0 }, target = { x: 0, y: 0 };
    let on = false, hideTimer = null, live = false;
    const setXY = gsap.quickSetter(peek, "css");
    gsap.set(peek, { clipPath: "inset(100% 0 0 0)", scale: 1 });
    const pos = (e) => { const w = peek.offsetWidth, h = peek.offsetHeight; const x = e.clientX + 32 + w > innerWidth ? e.clientX - 32 - w : e.clientX + 32; return [x, Math.min(Math.max(e.clientY - h * 0.45, 12), innerHeight - h - 12)]; };
    const tick = () => { if (!live) return; const dx = target.x - cur.x; cur.x += dx * 0.075; cur.y += (target.y - cur.y) * 0.075; cur.r += ((dx * 0.02) - cur.r) * 0.1; setXY({ x: cur.x, y: cur.y, rotation: cur.r }); };
    gsap.ticker.add(tick);
    ctx.add(() => () => gsap.ticker.remove(tick));
    const swap = (src) => { const next = imgs[flip ^= 1], prev = imgs[flip ^ 1]; next.src = src; next.style.zIndex = 2; prev.style.zIndex = 1;
      gsap.fromTo(next, { clipPath: "inset(100% 0 0 0)", scale: 1.06 }, { clipPath: "inset(0% 0 0 0)", scale: 1, duration: 0.7, ease: "expo.out", overwrite: true }); };
    const hide = (now) => { clearTimeout(hideTimer); const run = () => { on = false; gsap.to(peek, { clipPath: "inset(100% 0 0 0)", scale: 0.96, duration: 0.6, ease: "power3.inOut", overwrite: true, onComplete: () => { if (!on) live = false; } }); };
      now ? run() : (hideTimer = setTimeout(run, 60)); };
    ctx.add(() => () => { if (on) hide(true); });
    scope.querySelectorAll("[data-peek-src]").forEach((row) => {
      const open = () => row.getAttribute("aria-expanded") === "true";
      row.addEventListener("pointerenter", (e) => {
        if (row.dataset.quiet || open()) return;
        clearTimeout(hideTimer);
        const [x, y] = pos(e); [target.x, target.y] = [x, y];
        if (!on) { cur.x = x; cur.y = y + 24; cur.r = 0; setXY({ x: cur.x, y: cur.y, rotation: 0 }); on = true; live = true; imgs.forEach((i) => (i.src = row.dataset.peekSrc));
          gsap.fromTo(peek, { clipPath: "inset(100% 0 0 0)", scale: 1.04 }, { clipPath: "inset(0% 0 0 0)", scale: 1, duration: 0.8, ease: "expo.out", overwrite: true }); }
        else swap(row.dataset.peekSrc);
      });
      row.addEventListener("pointermove", (e) => { if (!row.dataset.quiet && on) [target.x, target.y] = pos(e); });
      row.addEventListener("pointerleave", () => { delete row.dataset.quiet; hide(false); });
      row.addEventListener("click", () => { row.dataset.quiet = "1"; hide(true); });
    });
  }

  /* Materials / audiences: table of contents; opening a family picks it (if it is one of the seven) */
  scope.querySelectorAll(".toc .head").forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      setTimeout(() => ScrollTrigger.refresh(), 950);
    });
  });

  /* Project index: hover a row, the fixed frame reveals its photo (GSAP, overwrite-safe) */
  scope.querySelectorAll(".pindex").forEach((sec) => {
    const pv = sec.querySelector(".preview"); if (!pv) return;
    const show = frameSwapper(pv);
    const first = pv.querySelector("img.on");
    if (first) { first.style.zIndex = 1; first.classList.remove("on"); gsap.set(first, { clipPath: "inset(0% 0 0 0)" }); }
    sec.querySelectorAll(".index-list a").forEach((a) => { a.addEventListener("pointerenter", () => show(a.dataset.project)); a.addEventListener("focus", () => show(a.dataset.project)); });
  });

  /* Profesionales: the process is a strip you drag; a label follows the pointer over it */
  const strip = scope.querySelector(".strip");
  if (strip && fine && !reduce) {
    const track = strip.querySelector(".track"); const items = [...track.children]; const prog = scope.querySelector(".strip-bar .prog i");
    const label = document.querySelector(".cursor-label");
    const step = () => items[0].offsetWidth + parseFloat(getComputedStyle(track).gap);
    let maxX = 0; const bounds = () => { maxX = track.scrollWidth - strip.clientWidth + parseFloat(getComputedStyle(strip).paddingLeft) * 2; return { minX: -maxX, maxX: 0 }; };
    const onMove = () => { if (prog) gsap.set(prog, { scaleX: gsap.utils.clamp(0, 1, (1 / items.length) + (-drag.x / maxX) * (1 - 1 / items.length)) }); };
    const drag = Draggable.create(track, { type: "x", bounds: bounds(), inertia: true, throwResistance: 2500, maxDuration: 1.1, edgeResistance: 0.85, cursor: "none", activeCursor: "none",
      snap: { x: (v) => { const s = step(); const start = drag ? drag.startX : 0; const delta = v - start; const n = Math.abs(delta) / s; const idx = Math.round(start / s) + Math.sign(delta) * (n >= 0.12 ? 1 : 0); return gsap.utils.clamp(-maxX, 0, idx * s); } }, onDrag: onMove, onThrowUpdate: onMove, dragClickables: false })[0];
    ctx.add(() => () => drag.kill());
    addEventListener("resize", () => drag.applyBounds(bounds()));
    const to = (i) => { const x = gsap.utils.clamp(-maxX, 0, -i * step()); gsap.to(track, { x, duration: 0.9, ease: "power3.out", onUpdate: () => { drag.update(); onMove(); } }); };
    scope.querySelector(".strip-bar .prev")?.addEventListener("click", () => to(Math.round(-drag.x / step()) - 1));
    scope.querySelector(".strip-bar .next")?.addEventListener("click", () => to(Math.round(-drag.x / step()) + 1));
    strip.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") to(Math.round(-drag.x / step()) + 1); if (e.key === "ArrowLeft") to(Math.round(-drag.x / step()) - 1); });
    if (label) {
      const c = { x: 0, y: 0 }, tg = { x: 0, y: 0 }; let over = false;
      const set = gsap.quickSetter(label, "css");
      const tick = () => { c.x += (tg.x - c.x) * 0.12; c.y += (tg.y - c.y) * 0.12; set({ x: c.x, y: c.y }); };
      gsap.ticker.add(tick); ctx.add(() => () => gsap.ticker.remove(tick));
      let shown = false, pressed = false;
      const inside = (e) => { const r = strip.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
      const show = (e) => { over = true; tg.x = e.clientX + 20; tg.y = e.clientY + 20; if (!shown) { c.x = tg.x; c.y = tg.y + 14; set({ x: c.x, y: c.y }); shown = true;
        gsap.fromTo(label, { clipPath: "inset(50% 0 50% 0 round 999px)" }, { clipPath: "inset(0% 0 0% 0 round 999px)", duration: 0.55, ease: "expo.out", overwrite: true });
        gsap.fromTo(label.firstElementChild, { yPercent: 110 }, { yPercent: 0, duration: 0.6, ease: "expo.out", overwrite: true, delay: 0.05 }); } };
      const hideL = () => { over = false; if (pressed || drag.isDragging) return; shown = false;
        gsap.to(label, { clipPath: "inset(50% 0 50% 0 round 999px)", duration: 0.45, ease: "power3.inOut", overwrite: true });
        gsap.to(label.firstElementChild, { yPercent: -110, duration: 0.4, ease: "power3.in", overwrite: true }); };
      strip.addEventListener("pointerenter", show);
      strip.addEventListener("pointerdown", () => { pressed = true; });
      strip.addEventListener("pointermove", (e) => { tg.x = e.clientX + 20; tg.y = e.clientY + 20; if (!shown) show(e); });
      strip.addEventListener("pointerleave", (e) => { if (!pressed) hideL(); });
      addEventListener("pointerup", (e) => { pressed = false; if (inside(e)) { over = true; if (!shown) show(e); } else hideL(); });
      addEventListener("pointermove", (e) => { if (pressed || drag.isDragging) { tg.x = e.clientX + 20; tg.y = e.clientY + 20; } });
      ctx.add(() => () => { shown = false; gsap.set(label, { clipPath: "inset(50% 0 50% 0 round 999px)" }); });
    }
    onMove();
  }
  /* Profesionales: giant words; the pointed one opens its detail, lines rising through masks */
  /* Projects: a row opens its photograph and its facts in a lightbox */
  const lb = scope.querySelector(".lightbox");
  if (lb) {
    const lbImg = lb.querySelector("img"), lbT = lb.querySelector(".cap .h2"), lbM = lb.querySelector(".cap p");
    const openLb = (a) => {
      const src = scope.querySelector(`.pindex .preview img[data-for="${a.dataset.project}"]`)?.getAttribute("src") || a.querySelector(".thumb")?.getAttribute("src");
      lbImg.src = src; lbImg.alt = a.querySelector(".t").textContent; lbT.textContent = a.querySelector(".t").textContent; lbM.textContent = a.querySelector(".m").textContent;
      lb.showModal(); parkCursor(lb); lenis.stop();
      gsap.fromTo(lb, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 0.8, ease: "expo.inOut", overwrite: true });
      gsap.fromTo([lb.querySelector(".media"), ...lb.querySelectorAll(".cap > *")], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.06, delay: 0.35, overwrite: true, clearProps: "transform,opacity" });
    };
    const closeLb = () => gsap.to(lb, { clipPath: "inset(100% 0 0 0)", duration: 0.6, ease: "expo.inOut", overwrite: true, onComplete: () => { lb.close(); parkCursor(null); lenis.start(); } });
    scope.querySelectorAll(".pindex .index-list a").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openLb(a); }));
    lb.querySelector(".lb-close").addEventListener("click", closeLb);
    lb.addEventListener("cancel", (e) => { e.preventDefault(); closeLb(); });
  }
  /* Contact: a subject can arrive in the URL (from the audience rows) */
  const asunto = new URLSearchParams(location.search).get("asunto");
  if (asunto && scope.querySelector('input[name="asunto"]')) scope.querySelector('input[name="asunto"]').value = asunto;

  const tabs = scope.querySelector(".tabs");
  if (tabs) {
    const btns = [...tabs.querySelectorAll("button")]; const ind = tabs.querySelector(".ind"); const body = scope.querySelector(".tab-body");
    const data = JSON.parse(tabs.dataset.who || "[]");
    let current = -1;
    const moveInd = (b, instant) => gsap.to(ind, { x: b.offsetLeft, width: b.offsetWidth, duration: instant ? 0 : 0.7, ease: "expo.out", overwrite: true });
    const render = (i, instant) => {
      if (i === current) return; current = i;
      btns.forEach((b, k) => b.setAttribute("aria-selected", String(k === i)));
      moveInd(btns[i], instant);
      const d = data[i]; if (!d) return;
      const parts = [body.querySelector(".say"), ...body.querySelectorAll("li")];
      const tl = gsap.timeline();
      tl.to(parts, { opacity: 0, y: -8, duration: instant ? 0 : 0.22, ease: "power2.in", stagger: 0.02, overwrite: true })
        .add(() => { body.querySelector(".say .h2").textContent = d.say; body.querySelector(".say .who").textContent = d.w; body.querySelector("ul").innerHTML = d.items.map((x) => `<li>${x}</li>`).join(""); })
        .fromTo([body.querySelector(".say"), ...body.querySelectorAll("li")], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: instant ? 0 : 0.7, ease: "expo.out", stagger: 0.05, overwrite: true });
    };
    btns.forEach((b, i) => b.addEventListener("click", () => render(i)));
    tabs.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") btns[(current + 1) % btns.length].focus(), render((current + 1) % btns.length); if (e.key === "ArrowLeft") btns[(current - 1 + btns.length) % btns.length].focus(), render((current - 1 + btns.length) % btns.length); });
    document.fonts.ready.then(() => moveInd(btns[Math.max(current, 0)], true));
    addEventListener("resize", () => moveInd(btns[Math.max(current, 0)], true));
    render(0, true);
  }

  /* Contact form: composes the message for the showroom inbox (no backend here) */
  const form = scope.querySelector("form.form");
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const subject = encodeURIComponent(`${f.get("asunto") || "Consulta"} — ${f.get("nombre")}`);
    const body = encodeURIComponent(`${f.get("mensaje")}\n\n${f.get("nombre")}\n${f.get("email")}\n${f.get("telefono") || ""}`);
    location.href = `mailto:info@tonobagno.com?subject=${subject}&body=${body}`;
    form.querySelector(".fields").hidden = true; form.querySelector(".done").hidden = false;
  });

  ScrollTrigger.refresh();
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/* ---------- Loader: the samples are placed on the counter, the light sweeps left to right (fast to slow) and rests on yours ---------- */
const veil = document.querySelector(".veil");
const veilImgs = veil ? [...veil.querySelectorAll(".veil-tray img")] : [];
const echo = document.querySelector(".veil-echo");
const CL = { full: "inset(0% 0% 0% 0%)", top: "inset(0% 0% 100% 0%)", bottom: "inset(100% 0% 0% 0%)" };
function lift(done) {
  const tl = gsap.timeline({ onComplete: () => { root.classList.remove("veiled"); done && done(); } });
  if (echo) tl.set(echo, { clipPath: CL.full }, 0).to(echo, { clipPath: CL.top, duration: 0.9, ease: "expo.inOut" }, 0.12);
  tl.to(veil, { clipPath: CL.top, duration: 0.85, ease: "expo.inOut", overwrite: true }, 0);
  return tl;
}
function cover(tl, at = 0) {
  root.classList.add("veiled");
  gsap.set(veil, { clipPath: CL.bottom }); if (echo) gsap.set(echo, { clipPath: CL.bottom });
  if (echo) tl.to(echo, { clipPath: CL.full, duration: 0.85, ease: "expo.inOut" }, at);
  tl.to(veil, { clipPath: CL.full, duration: 0.9, ease: "expo.inOut", overwrite: true }, at + 0.1);
  return at + 1.0;
}
const veilWord = veil?.querySelector(".veil-word");
// The domino, choreographed as one timeline: the big slot travels tile to tile. Each tile shrinks with the same duration
// and ease as its neighbour grows, so the row's total width never changes and nothing jitters; only the slot moves.
let vSmall = 0, vBig = 0;
function measureVeil() {
  if (!veilImgs.length) return;
  veilImgs.forEach((im) => { im.style.transition = "none"; im.style.width = ""; im.removeAttribute("data-on"); });
  vSmall = veilImgs[0].offsetWidth; veilImgs[0].setAttribute("data-on", ""); vBig = veilImgs[0].offsetWidth; veilImgs[0].removeAttribute("data-on");
}
// The arpeggio: one wave rolls over the row at constant speed. Each tile's width follows a raised-cosine bump around the
// wave's position, so tiles rise and settle one after another, several in motion at once, never fighting each other.
// The wave runs to the end of the row, turns and comes back to yours while it narrows to a single tile, so the row
// ends exactly as the hero starts: yours big, the rest small. One value, one paint per frame.
const bump = (d, w) => (d < w ? 0.5 * (1 + Math.cos(Math.PI * d / w)) : 0);
function journey(tl, at, chosen, { speed = 10, wave = 1.7 } = {}) {
  const n = veilImgs.length, c = Math.max(0, veilImgs.indexOf(chosen)), span = vBig - vSmall;
  const s = { p: -wave, w: wave };
  const paint = () => { for (let i = 0; i < n; i++) veilImgs[i].style.width = (vSmall + span * bump(Math.abs(i - s.p), s.w)).toFixed(2) + "px"; };
  const go = (n - 1 + wave) / speed;
  tl.to(s, { p: n - 1, duration: go, ease: "none", onUpdate: paint }, at);
  const back = Math.max(0.32, (n - 1 - c) / speed * 1.5);
  tl.to(s, { p: c, w: 1, duration: back, ease: "sine.out", onUpdate: paint }, at + go);
  return at + go + back;
}
function prepVeil() { measureVeil(); gsap.set(veilImgs, { width: vSmall, clearProps: "transform", opacity: 1 }); }
function restVeil() { setMaterial(root.dataset.material, { persist: false }); gsap.set(veilImgs, { clearProps: "transform,opacity,width" }); requestAnimationFrame(() => veilImgs.forEach((im) => (im.style.transition = ""))); }
if (veil && !reduce) {
  root.classList.remove("loaded"); root.classList.add("veiled");
  gsap.set(veil, { clipPath: CL.full });
  prepVeil(); gsap.set(veilImgs, { y: 30, opacity: 0 });
  const chosen = veilImgs.find((im) => im.dataset.material === root.dataset.material) || veilImgs[0];
  const tl = gsap.timeline({ onComplete: () => root.classList.add("loaded") });
  tl.to(veilImgs, { y: 0, opacity: 1, duration: 0.7, ease: "expo.out", stagger: 0.05 }, 0.05);
  const line = veil.querySelector(".veil-line"); if (line) tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: "expo.inOut" }, 0.25);
  if (veilWord) tl.fromTo(veilWord.querySelectorAll("span > span"), { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.08 }, 0.45);
  const end = journey(tl, 0.5, chosen);
  tl.add(() => lift(() => restVeil()), end + 0.22)
    .add(() => initPage(document), end + 0.42);
} else {
  root.classList.add("loaded");
  if (veil) gsap.set(veil, { clipPath: CL.top });
  initPage(document);
}

/* ---------- Seamless page transitions: the ink field covers, the page swaps, the field lifts. Lenis and the tint persist ---------- */
const parser = new DOMParser();
let navigating = false;
async function go(url, push = true) {
  if (navigating) return; navigating = true;
  try {
    if (menu?.open) menu.close();
    prepVeil(); gsap.set(veilImgs, { y: 24, opacity: 0 });
    const line = veil.querySelector(".veil-line"); if (line) gsap.set(line, { scaleX: 0 });
    if (veilWord) gsap.set(veilWord.querySelectorAll("span > span"), { yPercent: 110 });
    const tlc = gsap.timeline();
    const arrived = cover(tlc, 0);
    tlc.to(veilImgs, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out", stagger: 0.04 }, arrived - 0.45);
    if (line) tlc.to(line, { scaleX: 1, duration: 0.9, ease: "expo.inOut" }, arrived - 0.35);
    if (veilWord) tlc.to(veilWord.querySelectorAll("span > span"), { yPercent: 0, duration: 0.8, ease: "expo.out", stagger: 0.07 }, arrived - 0.3);
    const chosen = veilImgs.find((im) => im.dataset.material === root.dataset.material) || veilImgs[0];
    const end = journey(tlc, arrived - 0.2, chosen, { speed: 12 });
    tlc.to({}, { duration: 0.25 }, end);
    const [html] = await Promise.all([
      fetch(url, { headers: { "X-Requested-With": "swap" } }).then((r) => r.text()),
      new Promise((r) => tlc.eventCallback("onComplete", r)),
    ]);
    const doc = parser.parseFromString(html, "text/html");
    document.title = doc.title;
    document.querySelector("main").replaceWith(doc.querySelector("main"));
    document.querySelector("footer.end")?.replaceWith(doc.querySelector("footer.end"));
    document.querySelectorAll("#menu nav a").forEach((a) => { const cur = doc.querySelector(`#menu nav a[href="${a.getAttribute("href")}"]`); if (cur?.hasAttribute("aria-current")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    setMaterial(root.dataset.material, { persist: false });
    if (push) history.pushState({ url }, "", url);
    ScrollTrigger.getAll().forEach((t) => t.kill());
    lenis.scrollTo(0, { immediate: true, force: true });
    const hash = new URL(url, location.href).hash;
    const main = document.querySelector("main");
    await new Promise((r) => requestAnimationFrame(r));
    lift(() => restVeil()); initPage(main);
    if (hash) setTimeout(() => lenis.scrollTo(hash, { offset: -80 }), 900);
  } finally { navigating = false; }
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || reduce) return;
  if (e.defaultPrevented) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
  if (url.pathname === location.pathname && url.hash) return; // in-page anchor: Lenis handles it
  e.preventDefault();
  go(url.href).catch(() => (location.href = url.href));
});
addEventListener("popstate", () => { if (!reduce) go(location.href, false).catch(() => location.reload()); });
history.replaceState({ url: location.href }, "", location.href);
addEventListener("load", () => ScrollTrigger.refresh());

/* ---------- Cookie notice: once, after the page has arrived ---------- */
const cookies = document.querySelector(".cookies");
if (cookies) {
  let ok = null; try { ok = localStorage.getItem("tb-cookies"); } catch {}
  const close = (v) => { try { localStorage.setItem("tb-cookies", v); } catch {}
    gsap.to(cookies, { clipPath: "inset(100% 0 0 0)", duration: 0.6, ease: "expo.inOut", overwrite: true, onComplete: () => cookies.remove() }); };
  if (ok) cookies.remove();
  else {
    cookies.querySelectorAll("[data-consent]").forEach((b) => b.addEventListener("click", () => close(b.dataset.consent)));
    const showC = () => { gsap.fromTo(cookies, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 0.9, ease: "expo.out", delay: 0.2 });
      gsap.fromTo(cookies.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "expo.out", stagger: 0.08, delay: 0.5, clearProps: "transform,opacity" }); };
    if (root.classList.contains("loaded")) showC();
    else new MutationObserver((m, o) => { if (root.classList.contains("loaded")) { o.disconnect(); setTimeout(showC, 700); } }).observe(root, { attributes: true, attributeFilter: ["class"] });
  }
}


/* ---------- Cursor ---------- */
const cursorEl = document.querySelector(".cursor");
if (cursorEl && fine && !reduce) {
  root.classList.add("cc");
  const c = { x: -100, y: -100 }, tg = { x: -100, y: -100 }; let seen = false, pressed = false;
  const setC = gsap.quickSetter(cursorEl, "css");
  gsap.ticker.add(() => { c.x += (tg.x - c.x) * 0.5; c.y += (tg.y - c.y) * 0.5; setC({ x: c.x, y: c.y }); });
  const stateFor = (el) => {
    if (!el || !el.closest) return "arrow";
    if (el.closest("input, textarea")) return "text";
    if (el.closest(".strip")) return pressed ? "grabbing" : "grab";
    if (el.closest("a, button, [role='tab'], summary, label, .sample")) return "hand";
    return "arrow";
  };
  cursorEl.dataset.state = "arrow";
  addEventListener("pointermove", (e) => { tg.x = e.clientX; tg.y = e.clientY; if (!seen) { seen = true; c.x = tg.x; c.y = tg.y; } cursorEl.removeAttribute("data-hidden"); cursorEl.dataset.state = stateFor(e.target); }, { passive: true });
  addEventListener("pointerover", (e) => { cursorEl.dataset.state = stateFor(e.target); });
  addEventListener("pointerdown", (e) => { pressed = true; cursorEl.setAttribute("data-press", ""); cursorEl.dataset.state = stateFor(e.target); });
  addEventListener("pointerup", (e) => { pressed = false; cursorEl.removeAttribute("data-press"); cursorEl.dataset.state = stateFor(e.target); });
  document.documentElement.addEventListener("mouseleave", () => cursorEl.setAttribute("data-hidden", ""));
  document.documentElement.addEventListener("mouseenter", () => cursorEl.removeAttribute("data-hidden"));
  addEventListener("blur", () => cursorEl.setAttribute("data-hidden", ""));
}
