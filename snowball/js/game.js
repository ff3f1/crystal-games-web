"use strict";
/* ===== «Снежный ком»: катишь ком с горы, растёшь, сносишь всё, что меньше тебя ===== */

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const fmt = n => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const meters = r => { const d = r * 2; return (d < 10 ? d.toFixed(1).replace(".", ",") : Math.round(d)) + " м"; };

/* ---------- Сохранение ---------- */
const Save = {
  d: null,
  load() {
    let s = null; try { s = JSON.parse(localStorage.getItem("sb_save")); } catch (e) { }
    this.d = Object.assign({ level: 1, coins: 0, up: { size: 0, grow: 0, coin: 0 }, skin: 0, skins: [0], set: { sound: true, music: true, vibro: true }, tut: 0 }, s || {});
    this.d.up = Object.assign({ size: 0, grow: 0, coin: 0 }, this.d.up); this.d.set = Object.assign({ sound: true, music: true, vibro: true }, this.d.set);
  },
  save() { try { localStorage.setItem("sb_save", JSON.stringify(this.d)); } catch (e) { } }
};
const UPG = [
  { id: "size", em: "⚪", name: "Размер", desc: "старт больше" },
  { id: "grow", em: "❄️", name: "Липкость", desc: "растёт быстрее" },
  { id: "coin", em: "💰", name: "Доход", desc: "+15% монет" }
];
const upCost = lv => Math.round(60 * Math.pow(1.45, lv) / 10) * 10;
const SKINS = [
  { name: "Снежок", cost: 0, base: "#ffffff", shade: "#c9dcef", spot: "#d9e7f5" },
  { name: "Мандарин", cost: 300, base: "#ffb347", shade: "#e07a12", spot: "#ffd08a" },
  { name: "Арбуз", cost: 600, base: "#5fd068", shade: "#2c8f3a", spot: "#1f6b2a", stripes: true },
  { name: "Пончик", cost: 1000, base: "#ff9ec7", shade: "#d65c94", spot: "#fff", sprinkles: true },
  { name: "Лёд", cost: 1500, base: "#bdf0ff", shade: "#5cbbe6", spot: "#ffffff" },
  { name: "Мяч", cost: 2200, base: "#ffffff", shade: "#c9c9d6", spot: "#1d2b4f", ballspots: true },
  { name: "Золото", cost: 4000, base: "#ffd84a", shade: "#c99400", spot: "#fff4b0" },
  { name: "Планета", cost: 6000, base: "#6fa8ff", shade: "#2b5fc4", spot: "#5fd068", planet: true }
];

/* ---------- Звук ---------- */
const Sound = (function () {
  let ac, master, sfx, mus, roll, rollG, rollF, nb, on = true, musicOn = true, mt = null;
  function ensure() {
    if (ac) { if (ac.state === "suspended") ac.resume().catch(() => { }); return; }
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    ac = new A(); master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
    sfx = ac.createGain(); sfx.gain.value = on ? 1 : 0; sfx.connect(master);
    mus = ac.createGain(); mus.gain.value = musicOn ? 0.22 : 0; mus.connect(master);
    nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // хруст снега под комом
    roll = ac.createBufferSource(); roll.buffer = nb; roll.loop = true;
    rollF = ac.createBiquadFilter(); rollF.type = "lowpass"; rollF.frequency.value = 600;
    rollG = ac.createGain(); rollG.gain.value = 0;
    roll.connect(rollF); rollF.connect(rollG); rollG.connect(sfx); roll.start();
    startMusic();
  }
  function tone(f, t0, d, v, type, dest) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type || "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(dest || sfx); o.start(t0); o.stop(t0 + d + 0.05); return o;
  }
  function noise(t0, d, v, f, q) {
    const s = ac.createBufferSource(); s.buffer = nb; const b = ac.createBiquadFilter(); b.type = "bandpass"; b.frequency.value = f; b.Q.value = q || 1;
    const g = ac.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); s.connect(b); b.connect(g); g.connect(sfx); s.start(t0, Math.random()); s.stop(t0 + d + 0.05);
  }
  let lastPop = 0, popN = 0;
  function startMusic() {
    if (mt) return; const sc = [0, 2, 4, 7, 9, 12, 14, 16], root = 62; let i = 0;
    const bass = [0, 0, 5, 5, 7, 7, 4, 4];
    mt = setInterval(() => {
      if (!ac || ac.state !== "running" || !musicOn) return; const t = ac.currentTime + 0.05;
      if (i % 2 === 0) tone(440 * Math.pow(2, (root - 24 + bass[(i / 2 | 0) % 8] - 69) / 12), t, 0.35, 0.09, "triangle", mus);
      if (Math.random() < 0.55) tone(440 * Math.pow(2, (root + sc[Math.floor(Math.random() * sc.length)] - 69) / 12), t, 0.25, 0.05, "square", mus);
      i++;
    }, 200);
  }
  return {
    ensure,
    roll(speed, r, air) { if (!ac) return; const t = ac.currentTime; rollG.gain.setTargetAtTime(air ? 0 : clamp(speed / 40, 0, 0.35), t, 0.08); rollF.frequency.setTargetAtTime(300 + 900 / (1 + r * 0.5), t, 0.1); },
    stopRoll() { if (ac) rollG.gain.setTargetAtTime(0, ac.currentTime, 0.05); },
    pop(sizeRel) {
      if (!ac || !on) return; const t = ac.currentTime; if (t - lastPop < 0.04) return;
      popN = t - lastPop < 0.5 ? Math.min(popN + 1, 10) : 0; lastPop = t;
      const f = 300 + 70 * popN + 400 * (1 - clamp(sizeRel, 0, 1));
      const o = tone(f, t, 0.15, 0.18, "sine"); o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.08);
      noise(t, 0.08, 0.15, 2500, 1);
    },
    crash() { if (!ac || !on) return; const t = ac.currentTime; noise(t, 0.5, 0.6, 400, 0.6); const o = tone(120, t, 0.5, 0.5, "sine"); o.frequency.exponentialRampToValueAtTime(40, t + 0.4); },
    smash() { if (!ac || !on) return; const t = ac.currentTime; noise(t, 0.7, 0.5, 1200, 0.5); noise(t + 0.05, 0.4, 0.3, 3500, 1); tone(90, t, 0.6, 0.4, "sine"); },
    coin() { if (!ac || !on) return; const t = ac.currentTime; tone(1320, t, 0.12, 0.08, "square"); tone(1760, t + 0.06, 0.18, 0.08, "square"); },
    jump() { if (!ac || !on) return; const t = ac.currentTime; const o = tone(300, t, 0.35, 0.12, "triangle"); o.frequency.exponentialRampToValueAtTime(900, t + 0.3); },
    land() { if (!ac || !on) return; noise(ac.currentTime, 0.25, 0.35, 700, 0.8); },
    win() { if (!ac || !on) return; const t = ac.currentTime; [0, 4, 7, 12, 16].forEach((k, i) => tone(523 * Math.pow(2, k / 12), t + i * 0.09, 0.5, 0.12, "square")); },
    lose() { if (!ac || !on) return; const t = ac.currentTime; [7, 4, 0].forEach((k, i) => tone(392 * Math.pow(2, k / 12), t + i * 0.16, 0.4, 0.1, "triangle")); },
    click() { if (!ac || !on) return; tone(900, ac.currentTime, 0.06, 0.08, "sine"); },
    setSfx(v) { on = v; if (sfx) sfx.gain.value = v ? 1 : 0; },
    setMusic(v) { musicOn = v; if (mus) mus.gain.value = v ? 0.22 : 0; },
    suspend() { if (ac && ac.state === "running") ac.suspend().catch(() => { }); },
    resume() { if (ac && ac.state === "suspended") ac.resume().catch(() => { }); }
  };
})();

/* ---------- Реклама и платформы ---------- */
const Ads = (function () {
  const kind = window.AndroidAds ? "android" : /vk_app_id=/.test(location.search) ? "vk" : "web";
  let bridge = null, busy = false, seq = 0, lastInter = Date.now(); const boot = Date.now(), pending = {};
  window.__adResult = (id, ok) => { if (pending[id]) { pending[id](!!ok); delete pending[id]; } };
  async function show(type) {
    if (busy) return false; busy = true; Sound.suspend(); let ok = false;
    try {
      if (kind === "vk" && bridge) { const r = await bridge.send("VKWebAppShowNativeAds", { ad_format: type === "reward" ? "reward" : "interstitial" }); ok = !!(r && r.result); }
      else if (kind === "android") ok = await new Promise(res => { const id = ++seq; pending[id] = res; type === "reward" ? window.AndroidAds.showRewarded(id) : window.AndroidAds.showInterstitial(id); setTimeout(() => { if (pending[id]) { pending[id](false); delete pending[id]; } }, 60e3); });
      else { $("adov").classList.add("on"); await new Promise(r => setTimeout(r, 1100)); $("adov").classList.remove("on"); ok = true; }
    } catch (e) { ok = false; }
    busy = false; Sound.resume(); return ok;
  }
  return {
    kind,
    init() {
      if (kind !== "vk") return;
      const s = document.createElement("script"); s.src = "vk-bridge.min.js";
      s.onerror = () => { const c = document.createElement("script"); c.src = "https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"; c.onload = s.onload; document.head.appendChild(c); };
      s.onload = () => { bridge = window.vkBridge; try { bridge.send("VKWebAppInit"); } catch (e) { } }; document.head.appendChild(s);
    },
    rewarded: () => show("reward"),
    async interstitial() { if (Date.now() - lastInter < 150e3 || Date.now() - boot < 240e3) return false; const ok = await show("inter"); if (ok) lastInter = Date.now(); return ok; },
    vibrate(ms) { try { if (Save.d.set.vibro && navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }
  };
})();

/* ---------- Каталог предметов ---------- */
// s — «размер» для правила «меньше кома — сношу», h — высота рисунка, w — полуширина
const T = {
  cone: { s: 0.5, h: 0.6, w: 0.25 }, gift: { s: 0.55, h: 0.55, w: 0.3 }, penguin: { s: 0.7, h: 0.8, w: 0.3 }, bush: { s: 0.8, h: 0.75, w: 0.55 },
  bench: { s: 0.9, h: 0.8, w: 0.9 }, fence: { s: 1.0, h: 0.9, w: 1.3 }, mailbox: { s: 1.0, h: 1.1, w: 0.25 }, snowman: { s: 1.5, h: 1.7, w: 0.5 },
  person: { s: 1.6, h: 1.7, w: 0.3 }, deer: { s: 1.9, h: 1.7, w: 0.7 }, sled: { s: 1.3, h: 0.6, w: 0.6 }, car: { s: 2.4, h: 1.5, w: 1.1 },
  lamp: { s: 2.6, h: 3.2, w: 0.25 }, kiosk: { s: 3.2, h: 2.6, w: 1.2 }, pine: { s: 4.0, h: 4.4, w: 1.3 }, bus: { s: 4.6, h: 3.0, w: 1.4 },
  house: { s: 6.0, h: 5.0, w: 2.6 }, tower: { s: 10, h: 10, w: 2.4 }, church: { s: 14, h: 14, w: 4 }, castle: { s: 22, h: 18, w: 7 }
};
const TYPES = Object.keys(T).sort((a, b) => T[a].s - T[b].s);
const THEMES = [
  { name: "Деревня", types: ["cone", "gift", "bush", "fence", "mailbox", "snowman", "person", "sled", "car", "pine", "house", "tower", "church", "castle"] },
  { name: "Лес", types: ["bush", "penguin", "gift", "snowman", "deer", "sled", "pine", "kiosk", "house", "tower", "church", "castle"] },
  { name: "Город", types: ["cone", "bench", "mailbox", "person", "car", "lamp", "kiosk", "bus", "house", "tower", "church", "castle"] },
  { name: "Курорт", types: ["gift", "penguin", "person", "sled", "snowman", "car", "kiosk", "pine", "house", "tower", "church", "castle"] }
];
const CAR_COL = ["#ff4d5e", "#3fa9f5", "#ffc42e", "#3fd9a8", "#9b6bff", "#ff8a3d"];

/* ---------- Рисование предметов (Canvas 2D, мультяшный стиль с обводкой) ---------- */
const INK = "#1d2b4f";
function shapeStyle(x, k, fill) { x.fillStyle = fill; x.strokeStyle = INK; x.lineWidth = Math.max(1, k * 0.06); x.lineJoin = "round"; }
function rr(x, l, t, w, h, r) { x.beginPath(); x.roundRect ? x.roundRect(l, t, w, h, r) : x.rect(l, t, w, h); }
function fs(x) { x.fill(); x.stroke(); }
function snowCap(x, l, t, w, k) { x.fillStyle = "#fff"; x.beginPath(); x.ellipse(l + w / 2, t, w * 0.55, k * 0.16, 0, 0, TAU); x.fill(); x.stroke(); }
function drawThing(x, type, bx, by, k, o) {
  // bx, by — середина основания на экране, k — пикселей на единицу
  const v = o.v || 0, col = o.col || CAR_COL[v % CAR_COL.length];
  x.save(); x.translate(bx, by);
  switch (type) {
    case "cone": shapeStyle(x, k, "#ff7a2e"); x.beginPath(); x.moveTo(-0.25 * k, 0); x.lineTo(0, -0.6 * k); x.lineTo(0.25 * k, 0); x.closePath(); fs(x); x.fillStyle = "#fff"; x.fillRect(-0.13 * k, -0.35 * k, 0.26 * k, 0.09 * k); break;
    case "gift": shapeStyle(x, k, col); rr(x, -0.3 * k, -0.5 * k, 0.6 * k, 0.5 * k, 0.05 * k); fs(x); x.fillStyle = "#fff"; x.fillRect(-0.05 * k, -0.5 * k, 0.1 * k, 0.5 * k); x.beginPath(); x.ellipse(-0.1 * k, -0.55 * k, 0.1 * k, 0.06 * k, -0.5, 0, TAU); x.ellipse(0.1 * k, -0.55 * k, 0.1 * k, 0.06 * k, 0.5, 0, TAU); fs(x); break;
    case "penguin": shapeStyle(x, k, "#2b3a5c"); x.beginPath(); x.ellipse(0, -0.4 * k, 0.28 * k, 0.4 * k, 0, 0, TAU); fs(x); x.fillStyle = "#fff"; x.beginPath(); x.ellipse(0, -0.35 * k, 0.17 * k, 0.28 * k, 0, 0, TAU); x.fill(); x.fillStyle = "#ffb020"; x.beginPath(); x.moveTo(-0.06 * k, -0.6 * k); x.lineTo(0.06 * k, -0.6 * k); x.lineTo(0, -0.52 * k); x.fill(); x.fillStyle = INK; x.fillRect(-0.1 * k, -0.7 * k, 0.05 * k, 0.05 * k); x.fillRect(0.05 * k, -0.7 * k, 0.05 * k, 0.05 * k); break;
    case "bush": shapeStyle(x, k, "#3c9e5a"); x.beginPath(); x.arc(-0.25 * k, -0.3 * k, 0.3 * k, 0, TAU); x.arc(0.22 * k, -0.32 * k, 0.32 * k, 0, TAU); x.arc(0, -0.5 * k, 0.3 * k, 0, TAU); fs(x); x.fillStyle = "#fff"; x.beginPath(); x.ellipse(0, -0.75 * k, 0.32 * k, 0.1 * k, 0, 0, TAU); x.fill(); break;
    case "bench": shapeStyle(x, k, "#b06a3b"); rr(x, -0.9 * k, -0.45 * k, 1.8 * k, 0.15 * k, 0.03 * k); fs(x); rr(x, -0.9 * k, -0.8 * k, 1.8 * k, 0.15 * k, 0.03 * k); fs(x); x.fillStyle = INK; x.fillRect(-0.8 * k, -0.45 * k, 0.08 * k, 0.45 * k); x.fillRect(0.72 * k, -0.45 * k, 0.08 * k, 0.45 * k); snowCap(x, -0.9 * k, -0.8 * k, 1.8 * k, k * 0.6); break;
    case "fence": shapeStyle(x, k, "#c98a52"); for (let i = -2; i <= 2; i++) { rr(x, i * 0.55 * k - 0.07 * k, -0.9 * k, 0.14 * k, 0.9 * k, 0.03 * k); fs(x); } rr(x, -1.3 * k, -0.7 * k, 2.6 * k, 0.12 * k, 0.03 * k); fs(x); rr(x, -1.3 * k, -0.35 * k, 2.6 * k, 0.12 * k, 0.03 * k); fs(x); break;
    case "mailbox": shapeStyle(x, k, "#6b7a99"); x.fillRect(-0.05 * k, -0.8 * k, 0.1 * k, 0.8 * k); x.strokeRect(-0.05 * k, -0.8 * k, 0.1 * k, 0.8 * k); shapeStyle(x, k, "#3fa9f5"); rr(x, -0.25 * k, -1.1 * k, 0.5 * k, 0.32 * k, 0.12 * k); fs(x); x.fillStyle = "#ff4d5e"; x.fillRect(0.18 * k, -1.2 * k, 0.05 * k, 0.2 * k); break;
    case "snowman": shapeStyle(x, k, "#fff"); x.beginPath(); x.arc(0, -0.4 * k, 0.42 * k, 0, TAU); fs(x); x.beginPath(); x.arc(0, -1.0 * k, 0.32 * k, 0, TAU); fs(x); x.beginPath(); x.arc(0, -1.45 * k, 0.24 * k, 0, TAU); fs(x);
      x.fillStyle = "#ff7a2e"; x.beginPath(); x.moveTo(0, -1.47 * k); x.lineTo(0.28 * k, -1.42 * k); x.lineTo(0, -1.39 * k); x.fill(); x.fillStyle = INK; x.fillRect(-0.1 * k, -1.56 * k, 0.05 * k, 0.05 * k); x.fillRect(0.05 * k, -1.56 * k, 0.05 * k, 0.05 * k);
      shapeStyle(x, k, "#ff4d5e"); rr(x, -0.3 * k, -1.26 * k, 0.6 * k, 0.1 * k, 0.04 * k); fs(x); shapeStyle(x, k, INK); rr(x, -0.2 * k, -1.85 * k, 0.4 * k, 0.25 * k, 0.03 * k); x.fill(); x.fillRect(-0.3 * k, -1.62 * k, 0.6 * k, 0.05 * k); break;
    case "person": { const c = col; shapeStyle(x, k, "#3a4a6b"); rr(x, -0.18 * k, -0.7 * k, 0.15 * k, 0.7 * k, 0.05 * k); fs(x); rr(x, 0.03 * k, -0.7 * k, 0.15 * k, 0.7 * k, 0.05 * k); fs(x);
      shapeStyle(x, k, c); rr(x, -0.3 * k, -1.35 * k, 0.6 * k, 0.7 * k, 0.15 * k); fs(x); shapeStyle(x, k, "#ffd9b8"); x.beginPath(); x.arc(0, -1.5 * k, 0.17 * k, 0, TAU); fs(x);
      shapeStyle(x, k, "#ff4d5e"); x.beginPath(); x.arc(0, -1.58 * k, 0.17 * k, Math.PI, 0); fs(x); x.fillStyle = "#fff"; x.beginPath(); x.arc(0, -1.78 * k, 0.07 * k, 0, TAU); x.fill(); break; }
    case "deer": shapeStyle(x, k, "#b77a45"); rr(x, -0.6 * k, -1.1 * k, 1.1 * k, 0.45 * k, 0.2 * k); fs(x); for (const lx of [-0.5, -0.3, 0.2, 0.4]) { x.fillStyle = "#8d5a30"; x.fillRect(lx * k, -0.7 * k, 0.09 * k, 0.7 * k); }
      rr(x, 0.35 * k, -1.6 * k, 0.3 * k, 0.6 * k, 0.12 * k); fs(x); x.strokeStyle = "#7a4a22"; x.lineWidth = Math.max(1, k * 0.06); x.beginPath(); x.moveTo(0.45 * k, -1.6 * k); x.lineTo(0.3 * k, -1.95 * k); x.lineTo(0.15 * k, -2.0 * k); x.moveTo(0.55 * k, -1.6 * k); x.lineTo(0.7 * k, -1.95 * k); x.lineTo(0.85 * k, -2.0 * k); x.stroke();
      x.fillStyle = "#ff4d5e"; x.beginPath(); x.arc(0.65 * k, -1.35 * k, 0.07 * k, 0, TAU); x.fill(); break;
    case "sled": shapeStyle(x, k, "#ff4d5e"); rr(x, -0.6 * k, -0.45 * k, 1.2 * k, 0.25 * k, 0.08 * k); fs(x); x.strokeStyle = INK; x.lineWidth = Math.max(1, k * 0.07); x.beginPath(); x.moveTo(-0.6 * k, -0.08 * k); x.lineTo(0.6 * k, -0.08 * k); x.quadraticCurveTo(0.8 * k, -0.08 * k, 0.75 * k, -0.3 * k); x.stroke(); break;
    case "car": { shapeStyle(x, k, col); rr(x, -1.1 * k, -0.95 * k, 2.2 * k, 0.6 * k, 0.2 * k); fs(x); rr(x, -0.7 * k, -1.45 * k, 1.4 * k, 0.6 * k, 0.25 * k); fs(x);
      x.fillStyle = "#bfe6ff"; rr(x, -0.58 * k, -1.35 * k, 0.5 * k, 0.4 * k, 0.1 * k); x.fill(); rr(x, 0.08 * k, -1.35 * k, 0.5 * k, 0.4 * k, 0.1 * k); x.fill();
      shapeStyle(x, k, INK); x.beginPath(); x.arc(-0.65 * k, -0.33 * k, 0.28 * k, 0, TAU); x.arc(0.65 * k, -0.33 * k, 0.28 * k, 0, TAU); x.fill(); x.fillStyle = "#ffe48a"; x.fillRect(0.9 * k, -0.85 * k, 0.15 * k, 0.12 * k); snowCap(x, -0.7 * k, -1.45 * k, 1.4 * k, k * 0.6); break; }
    case "lamp": shapeStyle(x, k, "#3a4a6b"); x.fillRect(-0.07 * k, -3 * k, 0.14 * k, 3 * k); x.strokeRect(-0.07 * k, -3 * k, 0.14 * k, 3 * k); shapeStyle(x, k, "#ffe48a"); rr(x, -0.22 * k, -3.25 * k, 0.44 * k, 0.32 * k, 0.1 * k); fs(x);
      x.fillStyle = "rgba(255,228,138,.25)"; x.beginPath(); x.arc(0, -3.1 * k, 0.6 * k, 0, TAU); x.fill(); break;
    case "kiosk": shapeStyle(x, k, "#ffc42e"); rr(x, -1.1 * k, -1.9 * k, 2.2 * k, 1.9 * k, 0.1 * k); fs(x); x.fillStyle = "#bfe6ff"; rr(x, -0.85 * k, -1.6 * k, 1.7 * k, 0.8 * k, 0.08 * k); x.fill(); x.stroke();
      for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? "#fff" : "#ff4d5e"; x.beginPath(); x.moveTo((-1.2 + i * 0.6) * k, -1.9 * k); x.lineTo((-0.6 + i * 0.6) * k, -1.9 * k); x.lineTo((-0.6 + i * 0.6) * k, -2.3 * k); x.lineTo((-1.2 + i * 0.6) * k, -2.3 * k); x.fill(); } x.strokeRect(-1.2 * k, -2.3 * k, 2.4 * k, 0.4 * k); snowCap(x, -1.2 * k, -2.3 * k, 2.4 * k, k); break;
    case "pine": shapeStyle(x, k, "#7a4a22"); x.fillRect(-0.18 * k, -0.7 * k, 0.36 * k, 0.7 * k); for (let i = 0; i < 3; i++) { const w = (1.3 - i * 0.32) * k, y0 = -(0.5 + i * 1.15) * k; shapeStyle(x, k, i % 2 ? "#2f8a55" : "#277a4a"); x.beginPath(); x.moveTo(-w, y0); x.lineTo(0, y0 - 1.8 * k); x.lineTo(w, y0); x.closePath(); fs(x); x.fillStyle = "#fff"; x.beginPath(); x.moveTo(-w * 0.45, y0 - 1.0 * k); x.lineTo(0, y0 - 1.8 * k); x.lineTo(w * 0.45, y0 - 1.0 * k); x.quadraticCurveTo(0, y0 - 0.8 * k, -w * 0.45, y0 - 1.0 * k); x.fill(); } break;
    case "bus": { shapeStyle(x, k, col); rr(x, -1.4 * k, -2.8 * k, 2.8 * k, 2.4 * k, 0.3 * k); fs(x); x.fillStyle = "#bfe6ff"; for (let i = 0; i < 3; i++) { rr(x, (-1.2 + i * 0.85) * k, -2.5 * k, 0.7 * k, 0.8 * k, 0.1 * k); x.fill(); }
      shapeStyle(x, k, INK); x.beginPath(); x.arc(-0.85 * k, -0.35 * k, 0.35 * k, 0, TAU); x.arc(0.85 * k, -0.35 * k, 0.35 * k, 0, TAU); x.fill(); snowCap(x, -1.4 * k, -2.8 * k, 2.8 * k, k); break; }
    case "house": { shapeStyle(x, k, v % 2 ? "#ffe0b8" : "#c9e6ff"); rr(x, -2.4 * k, -3 * k, 4.8 * k, 3 * k, 0.1 * k); fs(x);
      shapeStyle(x, k, v % 3 ? "#d9534f" : "#5b6fa8"); x.beginPath(); x.moveTo(-2.7 * k, -3 * k); x.lineTo(0, -5 * k); x.lineTo(2.7 * k, -3 * k); x.closePath(); fs(x);
      x.fillStyle = "#fff"; x.beginPath(); x.moveTo(-2.2 * k, -3.3 * k); x.lineTo(0, -5 * k); x.lineTo(2.2 * k, -3.3 * k); x.quadraticCurveTo(0, -3.9 * k, -2.2 * k, -3.3 * k); x.fill();
      x.fillStyle = "#ffe48a"; for (const wx of [-1.6, 0.8]) { rr(x, wx * k, -2.3 * k, 0.8 * k, 0.8 * k, 0.08 * k); x.fill(); x.stroke(); }
      shapeStyle(x, k, "#8d5a30"); rr(x, -0.4 * k, -1.5 * k, 0.8 * k, 1.5 * k, 0.1 * k); fs(x); break; }
    case "tower": shapeStyle(x, k, "#d9dde8"); rr(x, -2 * k, -8 * k, 4 * k, 8 * k, 0.1 * k); fs(x); x.fillStyle = "#ffe48a"; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) { rr(x, (-1.6 + c * 1.2) * k, (-7.4 + r * 1.4) * k, 0.8 * k, 0.8 * k, 0.06 * k); x.fill(); }
      shapeStyle(x, k, "#5b6fa8"); x.beginPath(); x.moveTo(-2.3 * k, -8 * k); x.lineTo(0, -10 * k); x.lineTo(2.3 * k, -8 * k); x.closePath(); fs(x); break;
    case "church": shapeStyle(x, k, "#fff3dc"); rr(x, -3.6 * k, -7 * k, 7.2 * k, 7 * k, 0.1 * k); fs(x); rr(x, -1.2 * k, -11 * k, 2.4 * k, 4.5 * k, 0.1 * k); fs(x);
      shapeStyle(x, k, "#3fd9a8"); x.beginPath(); x.moveTo(-1.5 * k, -11 * k); x.quadraticCurveTo(0, -15 * k, 1.5 * k, -11 * k); x.closePath(); fs(x); shapeStyle(x, k, "#d9534f"); x.beginPath(); x.moveTo(-4 * k, -7 * k); x.lineTo(0, -9.5 * k); x.lineTo(4 * k, -7 * k); x.closePath(); fs(x);
      x.fillStyle = "#ffe48a"; rr(x, -0.6 * k, -10 * k, 1.2 * k, 1.6 * k, 0.6 * k); x.fill(); x.stroke(); shapeStyle(x, k, "#8d5a30"); rr(x, -0.9 * k, -2.6 * k, 1.8 * k, 2.6 * k, 0.9 * k); fs(x); break;
    case "castle": shapeStyle(x, k, "#c7cfe2"); rr(x, -6 * k, -9 * k, 12 * k, 9 * k, 0.1 * k); fs(x); for (const tx of [-6.5, 4.5]) { rr(x, tx * k, -14 * k, 2 * k, 14 * k, 0.1 * k); fs(x); shapeStyle(x, k, "#5b6fa8"); x.beginPath(); x.moveTo((tx - 0.3) * k, -14 * k); x.lineTo((tx + 1) * k, -18 * k); x.lineTo((tx + 2.3) * k, -14 * k); x.closePath(); fs(x); shapeStyle(x, k, "#c7cfe2"); }
      for (let i = 0; i < 6; i++) { x.fillStyle = "#c7cfe2"; rr(x, (-5.5 + i * 2) * k, -10 * k, 1 * k, 1 * k, 0.05 * k); x.fill(); x.stroke(); } shapeStyle(x, k, "#8d5a30"); rr(x, -1.5 * k, -4.5 * k, 3 * k, 4.5 * k, 1.5 * k); fs(x);
      x.fillStyle = "#ff4d5e"; x.beginPath(); x.moveTo(1 * k, -18 * k); x.lineTo(1 * k, -20 * k); x.lineTo(2.4 * k, -19.4 * k); x.lineTo(1 * k, -18.8 * k); x.fill(); break;
  }
  x.restore();
}

/* ---------- Мир ---------- */
const RW = 7;           // полуширина трассы
const G = {
  cv: null, x: null, W: 0, H: 0, dpr: 1,
  state: "start", t: 0, lvl: 1,
  ball: null, cam: { x: 0, z: -8, h: 3 }, objs: [], parts: [], stuck: [], trail: [],
  shake: 0, slow: 0, coinsRun: 0, len: 900, walls: [], mult: 0, finishing: false, revived: false
};

function resize() {
  G.dpr = Math.min(window.devicePixelRatio || 1, 2);
  G.W = innerWidth; G.H = innerHeight;
  G.cv.width = Math.round(G.W * G.dpr); G.cv.height = Math.round(G.H * G.dpr);
}

function startR() { return 0.45 * (1 + Save.d.up.size * 0.15); }

/* Генерация уровня: ряды предметов создаются на ходу под ТЕКУЩИЙ размер кома — так всегда честно */
function buildLevel(n) {
  G.R = rng(n * 7919 + 13); const R = G.R, th = THEMES[(n - 1) % THEMES.length];
  G.theme = th; G.n = n; G.len = Math.min(1400, 620 + n * 40);
  G.objs = []; G.genZ = 26; G.walls = [];
  G.side = [];
  for (let zz = -10; zz < G.len + 140; zz += 4 + R() * 4) for (const sd of [-1, 1]) G.side.push({ x: sd * (RW + 2 + R() * 9), z: zz + R() * 3, sc: 0.8 + R() * 0.9, type: R() < 0.85 ? "pine" : "house", v: Math.floor(R() * 9) });
}
function pickType(sz) {
  let best = G.theme.types[0], bd = 1e9;
  for (const ty of G.theme.types) { const d = Math.abs(Math.log(T[ty].s / sz)); if (d < bd) { bd = d; best = ty; } }
  return best;
}
function genRows(r) {
  const R = G.R, n = G.n, b = G.ball, objs = G.objs;
  const add = (type, x, z, sc) => objs.push({ type, x: clamp(x, -RW + 0.3, RW - 0.3), z, sc: sc || 1, s: T[type].s * (sc || 1), w: T[type].w * (sc || 1), v: Math.floor(R() * 12), alive: true, wob: 0 });
  const food = (d, z, k) => { for (let i = 0; i < k; i++) { const sz = d * (0.15 + R() * 0.5), ty = pickType(sz); add(ty, (R() * 2 - 1) * (RW - 0.8), z + R() * 7, clamp(sz / T[ty].s, 0.6, 1.5)); } };
  while (G.genZ < b.z + 130 && G.genZ < G.len - 20) {
    const z = G.genZ, er = r * (1 + (z - b.z) * 0.003), d = er * 2, roll = R(), hard = Math.min(1, (n - 1) / 6);
    if (roll < 0.45 - hard * 0.08) food(d, z, 4 + Math.floor(R() * 4));
    else if (roll < 0.66) {                            // одна преграда, рядом еда
      const big = d * (1.4 + R() * (0.8 + hard)), ty = pickType(big), side = R() < 0.5 ? -1 : 1, sc = clamp(big / T[ty].s, 0.8, 1.5);
      add(ty, side * (1.5 + R() * (RW - 3)), z, sc); food(d, z + 2, 3);
    } else if (roll < 0.8) {                           // монетки змейкой
      const x0 = (R() * 2 - 1) * (RW - 2), a = R() * TAU;
      for (let i = 0; i < 7; i++) objs.push({ type: "coin", x: x0 + Math.sin(a + i * 0.6) * 1.8, z: z + i * 2.2, s: 0, w: 0.4, alive: true });
      food(d, z, 2);
    } else if (roll < 0.88 && z > 80) {                // трамплин и монетки в воздухе
      const rx = (R() * 2 - 1) * (RW - 3);
      objs.push({ type: "ramp", x: rx, z, s: 0, w: 1.6, alive: true });
      for (let i = 0; i < 6; i++) objs.push({ type: "coin", x: rx, z: z + 8 + i * 3, y: 1.5 + Math.sin(i / 5 * Math.PI) * 3, s: 0, w: 0.4, alive: true });
    } else if (n >= 3 && R() < hard) {                 // «щель» между двумя большими
      const big = d * (1.4 + R() * 0.6), ty = pickType(big), sc = clamp(big / T[ty].s, 0.8, 1.4), wv = T[ty].w * sc, gap = (R() * 2 - 1) * (RW - 4), half = er + wv + 1.6;
      add(ty, gap - half, z, sc); add(ty, gap + half, z, sc);
    } else food(d, z, 5);
    G.genZ += 8 + R() * 6 + er * 0.9;
  }
  objs.sort((a, c) => a.z - c.z);
  // убираем пройденное
  let k = 0; while (k < objs.length && objs[k].z < b.z - 25) k++; if (k > 40) objs.splice(0, k);
  // крепость строится под тот ком, с которым ты к ней подъедешь
  if (!G.walls.length && b.z > G.len - 170) {
    const fr = b.r * 2 * 1.2;
    for (let i = 0; i < 10; i++) G.walls.push({ z: G.len + 30 + i * 9, s: fr * (0.3 + i * 0.16), mult: i + 1, broken: false });
  }
}

function newBall() {
  const r = startR();
  G.ball = { x: 0, z: 0, y: 0, vy: 0, r, speed: 0, roll: 0, inv: 0, tx: 0, air: false, rDisp: r };
  G.stuck = []; G.trail = []; G.parts = []; G.crashes = 0; G.peak = r; G.power = null; G.coinsRun = 0; G.mult = 0; G.finishing = false; G.revived = false; G.t = 0;
  G.cam = { x: 0, z: -9, h: 3.5 };
  if (G.objs) { G.objs.length = 0; G.genZ = 26; G.walls = []; genRows(r); }
}

/* ---------- Частицы ---------- */
function puff(sx, sy, n, col, sp, sz) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = (sp || 200) * (0.3 + Math.random()); G.parts.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.6 + Math.random() * 0.5, max: 1, sz: (sz || 6) * (0.6 + Math.random()), col: col || "#fff" }); }
}
function popText(sx, sy, t, col) { const e = document.createElement("div"); e.className = "pop"; e.textContent = t; e.style.left = sx + "px"; e.style.top = sy + "px"; if (col) e.style.color = col; document.body.appendChild(e); setTimeout(() => e.remove(), 950); }
function big(t, sub, pw) { const b = $("big"); b.innerHTML = (sub ? `<small>${sub}</small>` : "") + t; b.classList.toggle("pw", !!pw); b.classList.remove("on"); void b.offsetWidth; b.classList.add("on"); }
let hintT; function hint(t, ms) { const h = $("hint"); h.textContent = t; h.classList.add("on"); clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove("on"), ms || 2500); }
function toast(t) { const e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("on"), 2200); }

/* ---------- Проекция ---------- */
function proj(x, y, z) {
  const c = G.cam, dz = z - c.z; if (dz < 0.4) return null;
  const f = G.H * 0.95, s = f / dz;
  return [G.W / 2 + (x - c.x) * s, G.H * 0.3 + (c.h - y) * s, s];
}

/* ---------- Ввод ---------- */
const inp = { down: false, id: null, lx: 0, keys: {} };
function onDown(e) {
  if (e.target.closest && e.target.closest(".btn,.sticker,.ov,.up")) return;
  Sound.ensure();
  if (G.state === "start") { play(); }
  if (G.state !== "run") return;
  inp.down = true; inp.id = e.pointerId; inp.lx = e.clientX;
}
function onMove(e) {
  if (G.state !== "run") return;
  if (e.pointerType === "mouse" && !inp.down) { G.ball.tx = clamp((e.clientX / G.W * 2 - 1) * RW * 1.05, -RW, RW); return; }
  if (!inp.down || e.pointerId !== inp.id) return;
  const dx = e.clientX - inp.lx; inp.lx = e.clientX;
  G.ball.tx = clamp(G.ball.tx + dx / G.W * RW * 2.6, -RW, RW);
}
function onUp(e) { if (e.pointerId === inp.id) inp.down = false; }

/* ---------- Игровой цикл ---------- */
function update(dt) {
  const b = G.ball;
  if (G.slow > 0) { G.slow -= dt; dt *= 0.3; }
  G.t += dt;
  // управление с клавиатуры
  const kx = (inp.keys.ArrowRight || inp.keys.KeyD ? 1 : 0) - (inp.keys.ArrowLeft || inp.keys.KeyA ? 1 : 0);
  if (kx) b.tx = clamp(b.tx + kx * dt * 14, -RW, RW);
  if (window.__auto) window.__auto(G);
  // скорость
  const vmax = Math.min(32, 15 + b.r * 1.6);
  b.speed = G.finishing ? Math.max(b.speed - dt * 2, 9) : lerp(b.speed, vmax, Math.min(1, dt * 1.2));
  b.z += b.speed * dt;
  const lim = RW + 2 - b.r * 0.5;
  b.tx = clamp(b.tx, -lim, lim);
  b.x = lerp(b.x, b.tx, Math.min(1, dt * 10));
  // прыжок
  if (b.air) { b.vy -= 26 * dt; b.y += b.vy * dt; if (b.y <= 0) { b.y = 0; b.air = false; b.vy = 0; G.shake = Math.max(G.shake, 0.35); Sound.land(); const p = proj(b.x, 0, b.z); if (p) puff(p[0], p[1], 22, "#fff", 260, 9); } }
  // рост от катания
  if (!b.air && !G.finishing) b.r += dt * b.speed * 0.0036 * (1 + Save.d.up.grow * 0.12) / (1 + b.r * 0.08);
  b.roll += b.speed * dt / Math.max(0.2, b.r);
  if (b.inv > 0) b.inv -= dt;
  b.rDisp = lerp(b.rDisp, b.r, Math.min(1, dt * 8)); if (b.r > (G.peak || 0)) G.peak = b.r;
  if (Math.floor(G.t * 4) !== Math.floor((G.t - dt) * 4)) checkPower();
  // след
  if (!b.air && (!G.trail.length || b.z - G.trail[G.trail.length - 1].z > 0.8)) { G.trail.push({ x: b.x, z: b.z, r: b.r }); if (G.trail.length > 90) G.trail.shift(); }
  Sound.roll(b.speed, b.r, b.air);
  genRows(b.r);
  // столкновения
  for (const o of G.objs) {
    if (o.z > b.z + 3 + b.r) break;
    if (!o.alive || o.z < b.z - 3 - b.r) continue;
    if (o.type === "coin") {
      const oy = o.y || 0.6;
      if (Math.abs(o.z - b.z) < b.r + 0.4 && Math.abs(o.x - b.x) < b.r + 0.4 && Math.abs(oy - (b.y + b.r)) < b.r + 0.8) { o.alive = false; G.coinsRun++; Sound.coin(); $("coinV").textContent = fmt(Save.d.coins + G.coinsRun); const p = proj(o.x, oy, o.z); if (p) puff(p[0], p[1], 5, "#ffc42e", 150, 6); }
      continue;
    }
    if (o.type === "ramp") {
      if (!b.air && Math.abs(o.z - b.z) < 1 && Math.abs(o.x - b.x) < o.w + b.r * 0.3) { b.air = true; b.vy = 10 + b.speed * 0.25; o.alive = false; Sound.jump(); hint("Вжух!", 700); }
      continue;
    }
    if (Math.abs(o.z - b.z) > b.r * 0.7 + 0.3) continue;
    if (Math.abs(o.x - b.x) > b.r * 0.85 + o.w * 0.8) continue;
    if (b.y > T[o.type].h * o.sc * 0.8) continue;   // перелетел
    if (o.s <= b.r * 2 * 0.9) absorb(o);
    else if (b.inv <= 0) crash(o);
  }
  // финиш
  if (!G.finishing && b.z > G.len + 10) { G.finishing = true; big("Снеси крепость!"); }
  if (G.finishing) {
    for (const w of G.walls) {
      if (w.broken || b.z < w.z - b.r * 0.5) continue;
      if (b.r * 2 >= w.s * 0.8) {
        w.broken = true; G.mult = w.mult; b.r *= 0.93; G.shake = 0.7; G.slow = 0.25; Sound.smash(); Ads.vibrate(30);
        const p = proj(b.x, b.r, w.z); if (p) { puff(p[0], p[1], 40, "#bfe6ff", 520, 12); popText(p[0], p[1] - 40, "×" + w.mult, "#ffc42e"); }
        if (w.mult === 10) { finish(); return; }
      } else { b.z = w.z - b.r * 0.5; b.speed = 0; G.shake = 0.6; Sound.crash(); finish(); return; }
      break;
    }
  }
  // частицы
  for (const p of G.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.vx *= 1 - dt * 1.5; }
  G.parts = G.parts.filter(p => p.life > 0);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 2);
  // камера
  const back = 7.5 + b.rDisp * 4.6, hh = 3.2 + b.rDisp * 2.9 + b.y * 0.5;
  G.cam.z = b.z - back; G.cam.h = lerp(G.cam.h, hh, Math.min(1, dt * 3)); G.cam.x = lerp(G.cam.x, b.x * 0.65, Math.min(1, dt * 4));
  // HUD
  $("progFill").style.width = clamp(b.z / G.len * 100, 0, 100) + "%";
  const sv = meters(b.r); if ($("sizeV").textContent !== sv) $("sizeV").textContent = sv;
}

function absorb(o) {
  const b = G.ball; o.alive = false;
  const add = 0.55 * Math.pow(o.s * 0.5, 3), oldR = b.r;
  b.r = Math.cbrt(b.r * b.r * b.r + add);
  const p = proj(o.x, T[o.type].h * o.sc * 0.5, o.z);
  if (p) { puff(p[0], p[1], 10, "#fff", 220, 8); const dd = (b.r - oldR) * 2; if (dd >= 0.05) popText(p[0], p[1] - 20, "+" + (dd < 10 ? dd.toFixed(1).replace(".", ",") : Math.round(dd)) + " м", "#fff"); }
  checkPower();
  Sound.pop(o.s / (b.r * 2));
  // прилипает к кому
  G.stuck.push({ type: o.type, v: o.v, lat: (Math.random() - 0.5) * 2.4, lon: (Math.random() - 0.5) * 2.6, rel: clamp(o.s / (b.r * 2), 0.1, 0.35), a0: b.roll });
  if (G.stuck.length > 30) G.stuck.shift();
  const sb = $("sizeV"); sb.classList.remove("bump"); void sb.offsetWidth; sb.classList.add("bump");
  if (o.s > oldR * 1.3) { G.shake = Math.max(G.shake, 0.25); Ads.vibrate(15); }
}
const NAMES = { cone: "конусы", gift: "подарки", penguin: "пингвинов", bush: "кусты", bench: "скамейки", fence: "заборы", mailbox: "почтовые ящики", snowman: "снеговиков", person: "людей", deer: "оленей", sled: "санки",
  car: "машины", lamp: "фонари", kiosk: "ларьки", pine: "ёлки", bus: "автобусы", house: "дома", tower: "башни", church: "соборы", castle: "замки" };
function checkPower() {
  const b = G.ball; let top = null;
  for (const ty of TYPES) if (T[ty].s <= b.r * 2 * 0.9) top = ty;
  if (top && top !== G.power) {
    const had = G.power; G.power = top;
    if (had && T[top].s > T[had].s && T[top].s >= 1 && G.t - (G.powT || -9) > 5 && G.theme.types.includes(top)) { G.powT = G.t; big(NAMES[top] + "!", "теперь сносишь", true); Ads.vibrate(20); }
  }
}
function crash(o) {
  const b = G.ball; G.crashes = (G.crashes || 0) + 1;
  b.r *= 0.8; b.speed *= 0.35; b.z -= 1.2; b.inv = 1.2; G.shake = 1; Sound.crash(); Ads.vibrate([40, 30, 60]);
  o.wob = 1;
  const p = proj(b.x, b.r, b.z + b.r); if (p) puff(p[0], p[1], 30, "#fff", 400, 11);
  G.stuck.splice(0, Math.ceil(G.stuck.length * 0.4));
  hint("Ой! Это было больше тебя", 1400);
  if (b.r < startR() * 0.55) fail();
}

/* ---------- Отрисовка ---------- */
let mtn = null;
function drawSky(x) {
  const W = G.W, H = G.H, hy = H * 0.3;
  const g = x.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, "#6fb2ec"); g.addColorStop(1, "#cfe8fb"); x.fillStyle = g; x.fillRect(0, 0, W, hy + 2);
  x.fillStyle = "rgba(255,255,255,.8)"; x.beginPath(); x.arc(W * 0.82, hy * 0.35, 26, 0, TAU); x.fill();
  if (!mtn) { const R = rng(5); mtn = [[], []]; for (let l = 0; l < 2; l++) for (let i = 0; i <= 24; i++) mtn[l].push(R()); }
  const off = -G.cam.x * 4;
  [["#b8d4ee", 0.55, 1], ["#9fc0e3", 0.35, 0.6]].forEach(([c, hgt, par], l) => {
    x.fillStyle = c; x.beginPath(); x.moveTo(0, hy + 2);
    for (let i = 0; i <= 24; i++) { const px = (i / 24) * (W + 200) - 100 + off * par; x.lineTo(px, hy - (0.3 + mtn[l][i] * 0.7) * hy * hgt); }
    x.lineTo(W, hy + 2); x.closePath(); x.fill();
    // снежные шапки
    if (l === 0) { x.fillStyle = "#fff"; for (let i = 1; i < 24; i += 2) { const px = (i / 24) * (W + 200) - 100 + off * par, py = hy - (0.3 + mtn[l][i] * 0.7) * hy * hgt; x.beginPath(); x.moveTo(px - 14, py + 12); x.lineTo(px, py); x.lineTo(px + 14, py + 12); x.fill(); } }
  });
}
function drawGround(x) {
  const W = G.W, H = G.H, c = G.cam;
  x.fillStyle = "#e8f2fb"; x.fillRect(0, H * 0.3, W, H);
  const zFar = c.z + 160, step = 3;
  let z0 = Math.floor(zFar / step) * step;
  for (let z = z0; z > c.z + 0.6; z -= step) {
    const a = proj(-RW, 0, z), b2 = proj(RW, 0, z), a2 = proj(-RW, 0, z - step < c.z + 0.6 ? c.z + 0.6 : z - step), b3 = proj(RW, 0, z - step < c.z + 0.6 ? c.z + 0.6 : z - step);
    if (!a || !a2) continue;
    const band = Math.floor(z / step) % 2 === 0;
    x.fillStyle = band ? "#ffffff" : "#f1f7fd";
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b2[0], b2[1]); x.lineTo(b3[0], b3[1]); x.lineTo(a2[0], a2[1]); x.closePath(); x.fill();
    // флажки по краям трассы
    if (Math.floor(z / step) % 4 === 0) for (const sd of [-1, 1]) { const p = proj(sd * (RW + 0.3), 0, z); if (p && p[2] > 2) { x.strokeStyle = INK; x.lineWidth = Math.max(1, p[2] * 0.06); x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0], p[1] - p[2] * 1.2); x.stroke(); x.fillStyle = sd < 0 ? "#ff4d5e" : "#3fa9f5"; x.beginPath(); x.moveTo(p[0], p[1] - p[2] * 1.2); x.lineTo(p[0] + sd * p[2] * 0.5, p[1] - p[2] * 1.05); x.lineTo(p[0], p[1] - p[2] * 0.9); x.fill(); } }
  }
  // след кома: одна полупрозрачная лента
  if (G.trail.length > 1) {
    const L = [], Rr = [];
    for (const t of G.trail) { const a = proj(t.x - t.r * 0.75, 0, t.z), b = proj(t.x + t.r * 0.75, 0, t.z); if (a && b) { L.push(a); Rr.push(b); } }
    const bb = G.ball, a = proj(bb.x - bb.r * 0.75, 0, bb.z), b2 = proj(bb.x + bb.r * 0.75, 0, bb.z); if (a && b2 && !bb.air) { L.push(a); Rr.push(b2); }
    if (L.length > 1) { x.fillStyle = "rgba(170,200,232,.45)"; x.beginPath(); x.moveTo(L[0][0], L[0][1]); for (const p of L) x.lineTo(p[0], p[1]); for (let i = Rr.length - 1; i >= 0; i--) x.lineTo(Rr[i][0], Rr[i][1]); x.closePath(); x.fill(); }
  }
}
function drawCoin(x, sx, sy, s) {
  const r = Math.max(2, s * 0.35), sq = Math.abs(Math.cos(G.t * 4));
  x.fillStyle = "#ffc42e"; x.strokeStyle = INK; x.lineWidth = Math.max(1, s * 0.07);
  x.beginPath(); x.ellipse(sx, sy, r * (0.3 + 0.7 * sq), r, 0, 0, TAU); x.fill(); x.stroke();
}
function drawRamp(x, o) {
  const a = proj(o.x - o.w, 0, o.z - 1.5), b = proj(o.x + o.w, 0, o.z - 1.5), c = proj(o.x + o.w, 1.0, o.z + 1), d = proj(o.x - o.w, 1.0, o.z + 1);
  if (!a || !c) return;
  x.fillStyle = "#7fd0ff"; x.strokeStyle = INK; x.lineWidth = Math.max(1, a[2] * 0.06);
  x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.lineTo(d[0], d[1]); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = "#fff"; x.font = `900 ${Math.max(8, a[2] * 0.8)}px Nunito`; x.textAlign = "center"; x.fillText("⇧", (a[0] + c[0]) / 2, (a[1] + c[1]) / 2 + a[2] * 0.3);
}
function drawWall(x, w) {
  const b = G.ball, h = w.s, p0 = proj(-RW - 1, 0, w.z), p1 = proj(RW + 1, h, w.z);
  if (!p0) return;
  const ok = b.r * 2 >= w.s * 0.8;
  const l = p0[0], r = p1[0], top = p1[1], bot = p0[1], k = p0[2];
  // ледяные блоки
  x.fillStyle = ok ? "#c4ecff" : "#ffd0d6"; x.strokeStyle = INK; x.lineWidth = Math.max(1, k * 0.07);
  x.fillRect(l, top, r - l, bot - top); x.strokeRect(l, top, r - l, bot - top);
  const rows = 3, cols = 6;
  x.strokeStyle = "rgba(29,43,79,.35)";
  for (let i = 1; i < rows; i++) { x.beginPath(); x.moveTo(l, top + (bot - top) * i / rows); x.lineTo(r, top + (bot - top) * i / rows); x.stroke(); }
  for (let i = 0; i < rows; i++) for (let j = 1; j < cols; j++) { const xx = l + (r - l) * (j + (i % 2) * 0.5) / cols; x.beginPath(); x.moveTo(xx, top + (bot - top) * i / rows); x.lineTo(xx, top + (bot - top) * (i + 1) / rows); x.stroke(); }
  x.font = `900 ${Math.max(12, Math.min((bot - top) * 0.55, k * 3))}px Nunito`; x.textAlign = "center"; x.textBaseline = "middle";
  x.lineWidth = Math.max(3, k * 0.25); x.strokeStyle = INK; x.strokeText("×" + w.mult, (l + r) / 2, (top + bot) / 2); x.fillStyle = w.mult >= 8 ? "#ffc42e" : "#fff"; x.fillText("×" + w.mult, (l + r) / 2, (top + bot) / 2);
  x.textBaseline = "alphabetic";
}
function drawBall(x) {
  const b = G.ball, p = proj(b.x, b.y + b.rDisp, b.z), sh = proj(b.x, 0, b.z);
  if (!p) return;
  const R = b.rDisp * p[2], sk = SKINS[Save.d.skin] || SKINS[0];
  // тень
  if (sh) { x.fillStyle = "rgba(60,90,140,.22)"; x.beginPath(); x.ellipse(sh[0], sh[1], R * 1.05 / (1 + b.y * 0.15), R * 0.28 / (1 + b.y * 0.15), 0, 0, TAU); x.fill(); }
  if (b.inv > 0 && Math.floor(b.inv * 12) % 2) x.globalAlpha = 0.55;
  const g = x.createRadialGradient(p[0] - R * 0.35, p[1] - R * 0.4, R * 0.1, p[0], p[1], R);
  g.addColorStop(0, "#fff"); g.addColorStop(0.35, sk.base); g.addColorStop(1, sk.shade);
  x.fillStyle = g; x.strokeStyle = INK; x.lineWidth = Math.max(2, R * 0.06);
  x.beginPath(); x.arc(p[0], p[1], R, 0, TAU); x.fill();
  // узор, который крутится вместе с комом
  x.save(); x.beginPath(); x.arc(p[0], p[1], R, 0, TAU); x.clip();
  const roll = b.roll;
  if (sk.stripes) { x.strokeStyle = sk.spot; x.lineWidth = R * 0.12; for (let i = -3; i <= 3; i++) { x.beginPath(); x.ellipse(p[0] + i * R * 0.3, p[1], R * 0.12, R, 0, 0, TAU); x.stroke(); } }
  for (let i = 0; i < 9; i++) {
    const lat = (i / 9 - 0.5) * 2.6, lon = (i * 2.399) % TAU - Math.PI;
    let sx = Math.sin(lon) * Math.cos(lat), sy = Math.sin(lat), sz = Math.cos(lon) * Math.cos(lat);
    const yy = sy * Math.cos(roll) - sz * Math.sin(roll), zz = sy * Math.sin(roll) + sz * Math.cos(roll);
    if (zz > 0.1) continue;
    const d = sk.sprinkles ? 0.06 : sk.ballspots ? 0.22 : 0.1;
    x.fillStyle = sk.sprinkles ? CAR_COL[i % 6] : sk.spot;
    x.beginPath(); x.ellipse(p[0] + sx * R * 0.92, p[1] - yy * R * 0.92, R * d * Math.max(0.3, -zz), R * d, 0, 0, TAU); x.fill();
  }
  // прилипшие предметы
  for (const s of G.stuck) {
    const roll2 = roll - s.a0 + 1.2;
    const sx = Math.sin(s.lon) * Math.cos(s.lat), sy = Math.sin(s.lat), sz = Math.cos(s.lon) * Math.cos(s.lat);
    const yy = sy * Math.cos(roll2) - sz * Math.sin(roll2), zz = sy * Math.sin(roll2) + sz * Math.cos(roll2);
    if (zz > 0) continue;
    const k = R * s.rel / T[s.type].s * 1.3 * (0.4 + 0.6 * -zz);
    drawThing(x, s.type, p[0] + sx * R * 0.85, p[1] - yy * R * 0.85 + T[s.type].h * k * 0.5, k, { v: s.v });
  }
  x.restore();
  x.beginPath(); x.arc(p[0], p[1], R, 0, TAU); x.stroke();
  x.fillStyle = "rgba(255,255,255,.7)"; x.beginPath(); x.ellipse(p[0] - R * 0.38, p[1] - R * 0.45, R * 0.18, R * 0.1, -0.6, 0, TAU); x.fill();
  x.globalAlpha = 1;
  G.ballScreen = [p[0], p[1], R];
}
function draw() {
  const x = G.x, b = G.ball;
  x.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  let sx = 0, sy = 0; if (G.shake > 0) { sx = (Math.random() - 0.5) * G.shake * 16; sy = (Math.random() - 0.5) * G.shake * 16; }
  x.translate(sx, sy);
  drawSky(x); drawGround(x);
  // сортировка: дальние первыми
  const c = G.cam, list = [];
  for (const s of G.side) if (s.z > c.z + 0.6 && s.z < c.z + 160) list.push({ z: s.z, kind: "side", o: s });
  for (const o of G.objs) { if (o.z < c.z + 0.6) continue; if (o.z > c.z + 160) break; if (o.alive) list.push({ z: o.z, kind: o.type === "coin" ? "coin" : o.type === "ramp" ? "ramp" : "obj", o }); }
  for (const w of G.walls) if (!w.broken && w.z > c.z + 0.6 && w.z < c.z + 200) list.push({ z: w.z, kind: "wall", o: w });
  list.push({ z: b.z + 0.01, kind: "ball" });
  list.sort((a, b2) => b2.z - a.z);
  const br = b.r * 2;
  for (const it of list) {
    const o = it.o;
    if (it.kind === "ball") { drawBall(x); continue; }
    if (it.kind === "wall") { drawWall(x, o); continue; }
    if (it.kind === "ramp") { drawRamp(x, o); continue; }
    if (it.kind === "coin") { const p = proj(o.x, o.y || 0.6, o.z); if (p) drawCoin(x, p[0], p[1], p[2]); continue; }
    const p = proj(o.x, 0, o.z); if (!p) continue;
    const k = p[2] * (o.sc || 1);
    if (p[0] < -T[o.type].w * k * 2 || p[0] > G.W + T[o.type].w * k * 2) continue;
    if (it.kind === "obj") {
      const danger = o.s > br * 0.9;
      // тень и метка опасности
      x.fillStyle = danger ? `rgba(255,60,80,${0.28 + 0.15 * Math.sin(G.t * 8)})` : "rgba(60,90,140,.18)";
      x.beginPath(); x.ellipse(p[0], p[1], T[o.type].w * k * 1.1 + 4, T[o.type].w * k * 0.3 + 2, 0, 0, TAU); x.fill();
      if (o.wob > 0) { o.wob -= 0.03; x.save(); x.translate(p[0], p[1]); x.rotate(Math.sin(o.wob * 30) * o.wob * 0.15); x.translate(-p[0], -p[1]); }
      drawThing(x, o.type, p[0], p[1], k, o);
      if (o.wob > 0) x.restore();
      if (danger && p[2] > 3 && o.z - b.z < 45) { const hy = p[1] - T[o.type].h * k - 18; x.font = `900 ${clamp(p[2] * 0.9, 14, 30)}px Nunito`; x.textAlign = "center"; x.lineWidth = 5; x.strokeStyle = INK; x.strokeText("!", p[0], hy); x.fillStyle = "#ff4d5e"; x.fillText("!", p[0], hy); }
    } else drawThing(x, o.type, p[0], p[1], k, o);
  }
  // снежные частицы
  for (const pt of G.parts) { x.globalAlpha = clamp(pt.life * 1.6, 0, 1); x.fillStyle = pt.col; x.beginPath(); x.arc(pt.x, pt.y, pt.sz, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
  // снег из-под кома
  if (G.state === "run" && !b.air && G.ballScreen && Math.random() < 0.8) { const [bx, by, R] = G.ballScreen; G.parts.push({ x: bx + (Math.random() - 0.5) * R, y: by + R * 0.9, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 100, life: 0.4, sz: 2 + Math.random() * 4 * Math.min(2, R / 40), col: "#fff" }); }
  // летящие снежинки
  x.fillStyle = "rgba(255,255,255,.8)";
  for (let i = 0; i < 40; i++) { const fx = ((i * 97.3 + G.t * 20 * (1 + i % 3)) % (G.W + 40)) - 20, fy = ((i * 53.7 + G.t * (60 + i % 5 * 20)) % (G.H + 20)) - 10; x.beginPath(); x.arc(fx, fy, 1.5 + i % 3, 0, TAU); x.fill(); }
}

/* ---------- Состояния ---------- */
function setHud(on) { ["bPause", "prog", "sizeBox"].forEach(id => $(id).style.display = on ? "" : "none"); }
function showStart() {
  G.state = "start"; buildLevel(Save.d.level); newBall(); setHud(false);
  $("start").classList.add("on"); $("lvlV").textContent = `Уровень ${Save.d.level} · ${G.theme.name}`;
  renderUpg(); $("coinV").textContent = fmt(Save.d.coins);
}
function renderUpg() {
  const box = $("upg"); box.innerHTML = "";
  for (const u of UPG) {
    const lv = Save.d.up[u.id], cost = upCost(lv), can = Save.d.coins >= cost;
    const e = document.createElement("div"); e.className = "sticker up" + (can ? "" : " no");
    e.innerHTML = `<div class="em">${u.em}</div><b>${u.name} ${lv + 1}</b><small>${u.desc}</small><span class="cost"><span class="coin"></span>${fmt(cost)}</span>`;
    e.onclick = () => { Sound.ensure(); if (Save.d.coins < cost) { toast("Не хватает монет — катайся ещё!"); return; } Save.d.coins -= cost; Save.d.up[u.id]++; Save.save(); Sound.coin(); renderUpg(); $("coinV").textContent = fmt(Save.d.coins); newBall(); };
    box.appendChild(e);
  }
}
function play() {
  $("start").classList.remove("on"); G.state = "run"; setHud(true);
  if (Save.d.tut < 1) setTimeout(() => hint("Веди пальцем влево-вправо", 3000), 300), setTimeout(() => hint("Сноси всё, что меньше кома. Красное — обходи!", 3500), 3800);
}
function fail() {
  if (G.state !== "run") return;
  G.state = "fail"; Sound.stopRoll(); Sound.lose();
  $("bRevive").style.display = G.revived ? "none" : "";
  setTimeout(() => $("ovFail").classList.add("on"), 500);
}
function finish() {
  if (G.state !== "run") return;
  G.state = "end"; Sound.stopRoll(); Sound.win();
  const d = Save.d, mult = Math.max(1, G.mult), base = 20 + d.level * 6 + G.coinsRun * 2;
  const gain = Math.round(base * mult * (1 + d.up.coin * 0.15));
  d.coins += gain; d.level++; d.tut = 1; Save.save();
  $("endCard").innerHTML = `<h2>${mult >= 10 ? "Крепость снесена!" : "Уровень пройден!"}</h2><div class="mult">×${mult}</div><p>Ком: ${meters(G.ball.r)} · монеток по пути: ${G.coinsRun}</p>
    <div class="gain"><span class="coin"></span><span id="gainV">0</span></div>
    <div class="col"><button class="btn gold" id="bX3">▶ Забрать ×3</button><button class="btn white small" id="bNext">Дальше</button></div>`;
  const gv = $("gainV"), t0 = performance.now(); (function cu(now) { const k = Math.min(1, (now - t0) / 800); gv.textContent = fmt(gain * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(cu); })(t0);
  $("coinV").textContent = fmt(d.coins);
  $("bX3").onclick = async () => { const ok = await Ads.rewarded(); if (ok) { d.coins += gain * 2; Save.save(); $("bX3").disabled = true; gv.textContent = fmt(gain * 3); $("coinV").textContent = fmt(d.coins); Sound.coin(); } else toast("Реклама сейчас недоступна"); };
  $("bNext").onclick = async () => { Sound.click(); $("ovEnd").classList.remove("on"); await Ads.interstitial(); showStart(); };
  setTimeout(() => $("ovEnd").classList.add("on"), 900);
}
$("bRevive").onclick = async () => {
  const ok = await Ads.rewarded(); $("ovFail").classList.remove("on");
  if (ok) { G.revived = true; G.ball.r = Math.max(G.ball.r, startR() * 1.3); G.ball.inv = 2; G.state = "run"; last = performance.now(); }
  else { toast("Реклама сейчас недоступна"); showStart(); }
};
$("bRetry").onclick = () => { Sound.click(); $("ovFail").classList.remove("on"); showStart(); };
$("bPause").onclick = () => { if (G.state !== "run") return; G.state = "pause"; Sound.stopRoll(); $("ovPause").classList.add("on"); };
$("bResume").onclick = () => { $("ovPause").classList.remove("on"); G.state = "run"; last = performance.now(); };
$("bHome").onclick = () => { $("ovPause").classList.remove("on"); showStart(); };
$("bPlay").onclick = () => { Sound.ensure(); Sound.click(); play(); };
$("bSet").onclick = () => { Sound.ensure(); document.querySelectorAll(".tgl").forEach(t => t.classList.toggle("on", !!Save.d.set[t.dataset.s])); $("ovSet").classList.add("on"); };
document.querySelectorAll(".tgl").forEach(t => t.onclick = () => { const s = Save.d.set; s[t.dataset.s] = !s[t.dataset.s]; t.classList.toggle("on", s[t.dataset.s]); applySet(); Save.save(); });
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => { b.closest(".ov").classList.remove("on"); });
function applySet() { Sound.setSfx(Save.d.set.sound); Sound.setMusic(Save.d.set.music); }
$("bSkins").onclick = () => { Sound.ensure(); renderSkins(); $("ovSkins").classList.add("on"); };
function renderSkins() {
  const box = $("skins"); box.innerHTML = "";
  SKINS.forEach((sk, i) => {
    const own = Save.d.skins.includes(i), e = document.createElement("div");
    e.className = "sticker sk" + (Save.d.skin === i ? " sel" : "") + (own ? "" : " lock");
    const c = document.createElement("canvas"); c.width = c.height = 92; const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 30, 4, 46, 46, 40); g.addColorStop(0, "#fff"); g.addColorStop(0.35, sk.base); g.addColorStop(1, sk.shade);
    x.fillStyle = g; x.strokeStyle = INK; x.lineWidth = 4; x.beginPath(); x.arc(46, 46, 40, 0, TAU); x.fill(); x.stroke();
    x.fillStyle = sk.spot; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(30 + (k * 23) % 40, 30 + (k * 17) % 36, sk.ballspots ? 8 : 4, 0, TAU); x.fill(); }
    e.appendChild(c); const l = document.createElement("div"); l.innerHTML = own ? sk.name : `<span class="coin" style="width:12px;height:12px;border-width:2px"></span> ${fmt(sk.cost)}`; e.appendChild(l);
    e.onclick = () => {
      if (own) { Save.d.skin = i; Save.save(); renderSkins(); return; }
      if (Save.d.coins < sk.cost) { toast("Не хватает монет"); return; }
      Save.d.coins -= sk.cost; Save.d.skins.push(i); Save.d.skin = i; Save.save(); Sound.coin(); $("coinV").textContent = fmt(Save.d.coins); renderSkins(); renderUpg();
    };
    box.appendChild(e);
  });
}

/* ---------- Запуск ---------- */
let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  if (G.state === "run") update(dt);
  else if (G.state === "start") { G.t += dt; G.ball.roll += dt * 0.6; G.cam.h = lerp(G.cam.h, 3.2 + G.ball.r * 2.9, 0.1); G.cam.z = G.ball.z - 7.5 - G.ball.r * 4.6; }
  else if (G.state === "end" || G.state === "fail") { G.t += dt; for (const p of G.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; } G.parts = G.parts.filter(p => p.life > 0); if (G.shake > 0) G.shake -= dt * 2; }
  draw();
  requestAnimationFrame(frame);
}
function boot() {
  G.cv = $("c"); G.x = G.cv.getContext("2d");
  Save.load(); applySet(); Ads.init(); resize();
  addEventListener("resize", resize);
  addEventListener("pointerdown", onDown); addEventListener("pointermove", onMove); addEventListener("pointerup", onUp); addEventListener("pointercancel", onUp);
  addEventListener("keydown", e => { inp.keys[e.code] = true; if (G.state === "start" && (e.code === "Space" || e.code === "Enter")) { Sound.ensure(); play(); } });
  addEventListener("keyup", e => { inp.keys[e.code] = false; });
  addEventListener("contextmenu", e => e.preventDefault());
  document.addEventListener("visibilitychange", () => { if (document.hidden) { if (G.state === "run") $("bPause").onclick(); Sound.suspend(); } else Sound.resume(); });
  window.__appPause = () => { if (G.state === "run") $("bPause").onclick(); Sound.suspend(); };
  window.__appResume = () => Sound.resume();
  showStart();
  if (!/Android|iPhone|iPad|Mobi/i.test(navigator.userAgent)) $("tapTxt").textContent = "Мышь или стрелки — влево-вправо";
  last = performance.now(); requestAnimationFrame(frame);
}
window.Game = G;
boot();
