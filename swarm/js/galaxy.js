"use strict";
/* ===== Экран галактики и звёздной системы (Canvas 2D) ===== */

const Galaxy = (function () {
  let cv, cx, W = 0, H = 0, dpr = 1, img = null, imgSeed = -1, stars = null;
  let visible = false, view = "galaxy", sys = 0, t = 0, last = 0, raf = 0;
  let save = null, onPlanet = null, onView = null, nodes = [], sprites = {};
  let trans = 1;

  function init(canvas) {
    cv = canvas; cx = cv.getContext("2d");
    cv.addEventListener("pointerup", tap);
    window.addEventListener("resize", resize);
  }
  function resize() {
    if (!cv) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  /* --- спиральная галактика из семени игрока --- */
  function armParams(seed) { const r = mulberry32(seed); return { arms: 2 + Math.floor(r() * 3), twist: 3.6 + r() * 2.4, rot: r() * TAU, hue: r() * 360 }; }
  function armPoint(p, k, tt) { const a = p.rot + k * TAU / p.arms + tt * p.twist; return [Math.cos(a) * tt, Math.sin(a) * tt]; }
  function buildImage(seed) {
    const S = 1024, c = document.createElement("canvas"); c.width = c.height = S;
    const x = c.getContext("2d"), r = mulberry32(seed + 1), p = armParams(seed), R = S * 0.47;
    x.fillStyle = "#000"; x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = "lighter";
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, R * 0.55);
    g.addColorStop(0, "rgba(255,240,210,0.9)"); g.addColorStop(0.15, "rgba(255,200,150,0.45)"); g.addColorStop(0.5, "rgba(140,90,200,0.12)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.beginPath(); x.arc(S / 2, S / 2, R * 0.55, 0, TAU); x.fill();
    const gauss = () => (r() + r() + r() - 1.5) / 1.5;
    const N = 11000;
    for (let i = 0; i < N; i++) {
      const k = Math.floor(r() * p.arms), tt = Math.pow(r(), 0.75);
      const [ax, ay] = armPoint(p, k, tt);
      const sp = (0.05 + 0.16 * tt) * (r() < 0.15 ? 2.5 : 1);
      const px = S / 2 + (ax + gauss() * sp) * R, py = S / 2 + (ay + gauss() * sp) * R;
      const core = 1 - tt, h = core > 0.7 ? 40 : (p.hue + 180 + (r() - 0.5) * 80 + tt * 60);
      const col = hsl(h, core > 0.7 ? 60 : 70, 70 + r() * 25), a = 0.25 + r() * 0.6, s = r() < 0.03 ? 2.4 : 0.6 + r() * 0.9;
      x.fillStyle = rgbStr(col, a); x.fillRect(px, py, s, s);
    }
    // розовые облака звездообразования
    for (let i = 0; i < 160; i++) {
      const k = Math.floor(r() * p.arms), tt = 0.25 + r() * 0.7, [ax, ay] = armPoint(p, k, tt);
      const px = S / 2 + (ax + gauss() * 0.05) * R, py = S / 2 + (ay + gauss() * 0.05) * R, rad = 6 + r() * 22;
      const col = hsl(r() < 0.6 ? 320 + r() * 30 : p.hue + 180, 80, 60), gg = x.createRadialGradient(px, py, 0, px, py, rad);
      gg.addColorStop(0, rgbStr(col, 0.22)); gg.addColorStop(1, rgbStr(col, 0));
      x.fillStyle = gg; x.beginPath(); x.arc(px, py, rad, 0, TAU); x.fill();
    }
    x.globalCompositeOperation = "source-over";
    img = c; imgSeed = seed;
    stars = []; for (let i = 0; i < 260; i++) stars.push([r(), r(), r()]);
  }

  /* --- планета-сфера --- */
  function planetSprite(info, size) {
    const key = info.s + "-" + info.p + "-" + size; if (sprites[key]) return sprites[key];
    const c = document.createElement("canvas"); c.width = c.height = size;
    const x = c.getContext("2d"), id = x.createImageData(size, size), d = id.data, nz = makeNoise(info.seed), B = BIOMES[info.biome];
    const rr = size * 0.42, cxp = size / 2, Lx = -0.55, Ly = -0.45, Lz = 0.7;
    const base = hsl(B.hue + info.hueShift, 55, 30), hi = hsl(B.hue + info.hueShift + 25, 80, 62);
    for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
      const dx = (px - cxp) / rr, dy = (py - cxp) / rr, q = dx * dx + dy * dy, o = (py * size + px) * 4;
      if (q > 1) { d[o + 3] = 0; continue; }
      const dz = Math.sqrt(1 - q), lon = Math.atan2(dx, dz), lat = Math.asin(dy);
      let n = nz.fbm(lon * 1.6 + 5, lat * 2.2 + 5, 5);
      if (info.biome === "gas" || info.biome === "ocean") n = n * 0.4 + (Math.sin(lat * 9 + n * 4) * 0.5 + 0.5) * 0.6;
      const lit = clamp(dx * Lx + dy * Ly + dz * Lz, 0, 1) * 0.9 + 0.1;
      const m = smooth(clamp((n - 0.35) * 2.2, 0, 1)), glow = Math.pow(1 - Math.abs(2 * nz.fbm(lon * 3 + 9, lat * 3 + 9, 3) - 1), 10);
      let r = (base[0] * (1 - m) + hi[0] * m) * lit + B.G[0] * glow * 0.6, g = (base[1] * (1 - m) + hi[1] * m) * lit + B.G[1] * glow * 0.6, b = (base[2] * (1 - m) + hi[2] * m) * lit + B.G[2] * glow * 0.6;
      const rim = Math.pow(1 - dz, 3) * 0.8; r += B.edge[0] * rim; g += B.edge[1] * rim; b += B.edge[2] * rim;
      d[o] = clamp(r * 255, 0, 255); d[o + 1] = clamp(g * 255, 0, 255); d[o + 2] = clamp(b * 255, 0, 255); d[o + 3] = 255 * clamp((1 - q) * 30, 0, 1);
    }
    x.putImageData(id, 0, 0);
    const at = x.createRadialGradient(cxp, cxp, rr * 0.95, cxp, cxp, rr * 1.18);
    at.addColorStop(0, rgbStr(B.edge, 0.5)); at.addColorStop(1, rgbStr(B.edge, 0));
    x.globalCompositeOperation = "lighter"; x.fillStyle = at; x.beginPath(); x.arc(cxp, cxp, rr * 1.2, 0, TAU); x.fill();
    if (info.rings) {
      x.globalCompositeOperation = "source-over"; x.strokeStyle = rgbStr(hi, 0.55); x.lineWidth = size * 0.025;
      x.beginPath(); x.ellipse(cxp, cxp, rr * 1.45, rr * 0.32, -0.35, 0.05 * Math.PI, 0.95 * Math.PI, true); x.stroke();
    }
    sprites[key] = c; return c;
  }

  /* --- состояние --- */
  function sysState(s) {
    const L0 = s * PLANETS_PER_SYS;
    if (save.prog < L0) return "locked";
    if (save.prog >= L0 + PLANETS_PER_SYS) return "done";
    return "open";
  }
  function planetState(L) { return save.captured[L] ? "done" : L <= save.prog ? "open" : "locked"; }

  function show(sv, cb, viewCb) {
    save = sv; onPlanet = cb; onView = viewCb; visible = true; cv.style.display = "block"; resize();
    if (imgSeed !== save.gseed) { buildImage(save.gseed); sprites = {}; }
    // открыть систему, где продолжается прогресс
    sys = Math.min(SYSTEMS.length - 1, Math.floor(save.prog / PLANETS_PER_SYS));
    setView(save.prog > 0 ? "system" : "system");
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function hide() { visible = false; cv.style.display = "none"; cancelAnimationFrame(raf); }
  function setView(v, s) { view = v; if (s != null) sys = s; trans = 0; if (onView) onView(view, sys); }
  function back() { if (view === "system") { setView("galaxy"); return true; } return false; }

  function loop(now) {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; trans = Math.min(1, trans + dt * 2.5);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function draw() {
    const x = cx; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = "#04030b"; x.fillRect(0, 0, W, H);
    nodes = [];
    const e = smooth(trans);
    if (view === "galaxy") drawGalaxy(x, e); else drawSystem(x, e);
  }

  function drawGalaxy(x, e) {
    const S = Math.min(W * 1.15, H * 0.72), cxg = W / 2, cyg = H * 0.5, rot = t * 0.015;
    for (const s of stars) { x.fillStyle = `rgba(255,255,255,${0.2 + s[2] * 0.5})`; x.fillRect(s[0] * W, s[1] * H, 1.2, 1.2); }
    x.save(); x.translate(cxg, cyg); x.rotate(rot); x.scale(0.8 + 0.2 * e, (0.8 + 0.2 * e) * 0.92); x.globalAlpha = e;
    x.globalCompositeOperation = "lighter"; x.drawImage(img, -S / 2, -S / 2, S, S); x.restore();
    x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
    const p = armParams(save.gseed), R = S * 0.47;
    for (let s = 0; s < SYSTEMS.length; s++) {
      const tt = 0.2 + s * 0.098, [ax, ay] = armPoint(p, s % p.arms, tt);
      const c = Math.cos(rot), sn = Math.sin(rot);
      const px = cxg + (ax * c - ay * sn) * R, py = cyg + (ax * sn + ay * c) * R * 0.92;
      const st = sysState(s), B = BIOMES[SYSTEMS[s].biome], col = B.edge;
      const pul = st === "open" ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
      const rad = st === "locked" ? 7 : 11 + pul * 3;
      const g = x.createRadialGradient(px, py, 0, px, py, rad * 4);
      g.addColorStop(0, rgbStr(col, st === "locked" ? 0.25 : 0.9)); g.addColorStop(0.3, rgbStr(col, st === "locked" ? 0.08 : 0.35)); g.addColorStop(1, rgbStr(col, 0));
      x.fillStyle = g; x.beginPath(); x.arc(px, py, rad * 4, 0, TAU); x.fill();
      x.fillStyle = st === "locked" ? "rgba(255,255,255,.35)" : "#fff"; x.beginPath(); x.arc(px, py, rad * 0.45, 0, TAU); x.fill();
      if (st === "done") { x.strokeStyle = rgbStr(col, 0.9); x.lineWidth = 2; x.beginPath(); x.arc(px, py, rad + 6, 0, TAU); x.stroke(); }
      x.font = "900 14px Nunito,sans-serif"; x.textAlign = "center"; x.fillStyle = st === "locked" ? "rgba(255,255,255,.4)" : "#fff";
      x.shadowColor = "#000"; x.shadowBlur = 6; x.fillText((st === "locked" ? "🔒 " : "") + SYSTEMS[s].name, px, py + rad + 22); x.shadowBlur = 0;
      if (st !== "locked") {
        const got = countCaptured(s); x.font = "12px Nunito,sans-serif"; x.fillStyle = "rgba(255,255,255,.7)"; x.fillText(got + "/" + PLANETS_PER_SYS, px, py + rad + 38);
      }
      nodes.push({ x: px, y: py, r: 34, kind: "sys", s, st });
    }
  }
  function countCaptured(s) { let n = 0; for (let p = 0; p < PLANETS_PER_SYS; p++) if (save.captured[s * PLANETS_PER_SYS + p]) n++; return n; }

  function drawSystem(x, e) {
    for (const s of stars) { x.fillStyle = `rgba(255,255,255,${0.15 + s[2] * 0.6})`; x.fillRect(s[0] * W, s[1] * H, 1.3, 1.3); }
    const B = BIOMES[SYSTEMS[sys].biome], portrait = H > W * 1.15;
    const cxs = W / 2, cys = portrait ? H * 0.52 : H * 0.5;
    const major = (portrait ? Math.min(H * 0.33, W * 1.05) : Math.min(W * 0.46, H * 0.9)) * (0.85 + 0.15 * e);
    const minor = portrait ? Math.min(W * 0.44, major * 0.6) : major * 0.42;
    const sc = Math.min(major, minor * 1.8);
    x.globalAlpha = e;
    // светило
    const sg = x.createRadialGradient(cxs, cys, 0, cxs, cys, sc * 0.42);
    sg.addColorStop(0, "rgba(255,255,240,1)"); sg.addColorStop(0.08, rgbStr(B.edge, 0.9)); sg.addColorStop(0.3, rgbStr(B.edge, 0.25)); sg.addColorStop(1, rgbStr(B.edge, 0));
    x.globalCompositeOperation = "lighter"; x.fillStyle = sg; x.beginPath(); x.arc(cxs, cys, sc * 0.42, 0, TAU); x.fill();
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + t * 0.1; x.strokeStyle = rgbStr(B.edge, 0.08); x.lineWidth = 3; x.beginPath(); x.moveTo(cxs + Math.cos(a) * sc * 0.06, cys + Math.sin(a) * sc * 0.06); x.lineTo(cxs + Math.cos(a) * sc * (0.2 + 0.05 * Math.sin(t + k)), cys + Math.sin(a) * sc * (0.2 + 0.05 * Math.sin(t + k))); x.stroke(); }
    x.globalCompositeOperation = "source-over";
    const items = [], ps = clamp(Math.min(W, H) / 430, 0.6, 1.3);
    for (let p = 0; p < PLANETS_PER_SYS; p++) {
      const L = sys * PLANETS_PER_SYS + p, info = planetInfo(save.gseed, sys, p), st = planetState(L);
      const k = 0.28 + p * 0.18, rx = (portrait ? minor : major) * k, ry = (portrait ? major : minor) * k;
      x.strokeStyle = st === "locked" ? "rgba(255,255,255,.07)" : rgbStr(B.edge, 0.2); x.lineWidth = 1.2;
      x.beginPath(); x.ellipse(cxs, cys, rx, ry, 0, 0, TAU); x.stroke();
      const a = -Math.PI / 2 + p * 2.4 + t * (0.05 / (1 + p * 0.4)) + (save.gseed % 7) * 0.3;
      items.push({ x: cxs + Math.cos(a) * rx, y: cys + Math.sin(a) * ry, z: Math.sin(a), info, st, L, p, ps });
    }
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      const size = Math.round((it.info.boss ? 40 : 24 + it.info.size * 9) * it.ps * (0.88 + 0.12 * (it.z + 1) / 2));
      const spr = planetSprite(it.info, 128);
      x.globalAlpha = e * (it.st === "locked" ? 0.35 : 1);
      if (it.st === "open") {
        const pul = 0.5 + 0.5 * Math.sin(t * 4);
        const g = x.createRadialGradient(it.x, it.y, size * 0.3, it.x, it.y, size * (1.1 + pul * 0.2));
        g.addColorStop(0, rgbStr([1, 1, 1], 0.25)); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.beginPath(); x.arc(it.x, it.y, size * 1.3, 0, TAU); x.fill();
      }
      x.drawImage(spr, it.x - size, it.y - size, size * 2, size * 2);
      if (it.st === "done") {
        x.globalCompositeOperation = "lighter";
        for (let k = 0; k < 9; k++) { const a = k / 9 * TAU + t * 1.5, rr = size * 0.95; x.fillStyle = "rgba(255,240,140,.85)"; x.beginPath(); x.arc(it.x + Math.cos(a) * rr, it.y + Math.sin(a) * rr * 0.5, 2, 0, TAU); x.fill(); }
        x.globalCompositeOperation = "source-over";
      }
      x.globalAlpha = e;
      x.font = "900 14px Nunito,sans-serif"; x.textAlign = "center"; x.shadowColor = "#000"; x.shadowBlur = 6;
      x.fillStyle = it.st === "locked" ? "rgba(255,255,255,.45)" : "#fff";
      x.fillText((it.st === "locked" ? "🔒 " : it.st === "done" ? "✓ " : "") + it.info.name, it.x, it.y + size * 0.62 + 18);
      if (it.st === "open") { x.fillStyle = "#ffd76a"; x.font = "900 12px Nunito,sans-serif"; x.fillText(it.info.boss ? "БОСС" : "ВЫСАДКА ▶", it.x, it.y + size * 0.62 + 34); }
      x.shadowBlur = 0;
      nodes.push({ x: it.x, y: it.y, r: size * 0.9 + 10, kind: "planet", info: it.info, st: it.st, L: it.L });
    }
    x.globalAlpha = 1;
  }

  function tap(ev) {
    if (!visible) return;
    const r = cv.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
    let best = null, bd = 1e9;
    for (const n of nodes) { const d = Math.hypot(n.x - px, n.y - py); if (d < n.r && d < bd) { bd = d; best = n; } }
    if (!best) return;
    Sound.click();
    if (best.kind === "sys") {
      if (best.st === "locked") { UI.toast("Сначала победи владыку предыдущей системы"); return; }
      setView("system", best.s);
    } else if (best.kind === "planet") {
      if (best.st === "locked") { UI.toast("Сначала захвати предыдущую планету"); return; }
      onPlanet && onPlanet(best.info, best.st);
    }
  }

  return { init, show, hide, back, resize, planetSprite, get view() { return view; }, get sys() { return sys; }, setView };
})();
