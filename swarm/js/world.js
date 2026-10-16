"use strict";
/* ===== Мир планеты: генерация, рои, свет, опасности, маяки, боты ===== */

/* ---------- Текстуры планеты ---------- */
function genPlanetTextures(bkey, seed, R, size) {
  const B = BIOMES[bkey], nz = makeNoise(seed), nz2 = makeNoise(seed ^ 0x5bd1e995), rnd = mulberry32(seed + 3);
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d"), img = x.createImageData(size, size), d = img.data;
  const A = B.A, Bc = B.B, G = B.G;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const wx = (px / size * 2 - 1) * R, wy = (py / size * 2 - 1) * R;
      const o = (py * size + px) * 4;
      const n = nz.fbm(wx / 900 + 10, wy / 900 + 10, 4);
      const rr = nz2.fbm(wx / 520 + 3, wy / 520 + 3, 3);
      const rid = 1 - Math.abs(2 * rr - 1);
      let veins = Math.pow(rid, 14), t = smooth(clamp((n - 0.25) * 1.9, 0, 1));
      let r = A[0] + (Bc[0] - A[0]) * t, g = A[1] + (Bc[1] - A[1]) * t, b = A[2] + (Bc[2] - A[2]) * t, gl = veins * 0.45;
      if (bkey === "ice") { const cr = Math.pow(1 - Math.abs(2 * nz.n2(wx / 160, wy / 160) - 1), 26); gl = gl * 0.6 + cr * 0.55; }
      else if (bkey === "volcano") { gl = Math.pow(rid, 7) * (0.35 + 0.75 * smooth(clamp((n - 0.36) * 6, 0, 1))); }
      else if (bkey === "ocean") { const w = Math.sin(wy / 70 + n * 14) * 0.5 + 0.5; r += 0.0; g += w * 0.025; b += w * 0.06; gl *= 0.6; }
      else if (bkey === "desert") { const w = Math.pow(Math.sin((wx * 0.55 + wy) / 120 + n * 9) * 0.5 + 0.5, 3); r += w * 0.07; g += w * 0.045; b += w * 0.012; gl *= 0.5; }
      else if (bkey === "dark") { gl *= 0.55; }
      else if (bkey === "gas") { const w = Math.sin(wy / 190 + n * 7) * 0.5 + 0.5; r += w * 0.08; g += w * 0.02; b += w * 0.07; gl *= 0.45; }
      let gr = G[0], gg = G[1], gb = G[2];
      if (bkey === "core") { const h = hsl(Math.atan2(wy, wx) * 57.3 + n * 120, 90, 60); gr = h[0]; gg = h[1]; gb = h[2]; }
      d[o] = clamp((r + gr * gl) * 255, 0, 255); d[o + 1] = clamp((g + gg * gl) * 255, 0, 255); d[o + 2] = clamp((b + gb * gl) * 255, 0, 255); d[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  // светящаяся флора и детали
  x.globalCompositeOperation = "lighter";
  const sc = size / (2 * R), nDecor = Math.round(170 * (R / 2400));
  for (let i = 0; i < nDecor; i++) {
    const a = rnd() * TAU, rr = Math.sqrt(rnd()) * R * 0.98, cx = (Math.cos(a) * rr + R) * sc, cy = (Math.sin(a) * rr + R) * sc;
    const h = bkey === "core" ? rnd() * 360 : B.hue + (rnd() - 0.5) * 50, col = hsl(h, 90, 60);
    const k = 1 + Math.floor(rnd() * 5);
    for (let j = 0; j < k; j++) {
      const ox = cx + (rnd() - 0.5) * 14, oy = cy + (rnd() - 0.5) * 14, rad = (2 + rnd() * 5) * (size / 768);
      const gr = x.createRadialGradient(ox, oy, 0, ox, oy, rad * 3);
      gr.addColorStop(0, rgbStr(col, 0.5)); gr.addColorStop(0.3, rgbStr(col, 0.14)); gr.addColorStop(1, rgbStr(col, 0));
      x.fillStyle = gr; x.beginPath(); x.arc(ox, oy, rad * 3, 0, TAU); x.fill();
    }
  }
  x.globalCompositeOperation = "source-over";

  // туманность (бесшовная, 512)
  const N = 512, nc = document.createElement("canvas"); nc.width = nc.height = N;
  const nx = nc.getContext("2d"), ni = nx.createImageData(N, N), nd = ni.data, nn = makeNoise(seed + 99);
  const h1 = B.neb[0], h2 = B.neb[1], c1 = hsl(h1, 70, 45), c2 = hsl(h2, 70, 40);
  const S = 6;
  const tile = (u, v) => { // бесшовный шум на торе
    const a = u * TAU, b = v * TAU;
    return nn.fbm(Math.cos(a) * S / TAU * 2 + 20, Math.sin(a) * S / TAU * 2 + Math.cos(b) * S / TAU * 2 + 20, 4) * 0.5 +
      nn.fbm(Math.sin(b) * S / TAU * 2 + 40, Math.cos(b) * S / TAU * 2 + Math.sin(a) * 1.3 + 40, 4) * 0.5;
  };
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    const v = tile(px / N, py / N), w = Math.pow(clamp((v - 0.35) * 2.4, 0, 1), 2.2), m = clamp((v - 0.45) * 3, 0, 1);
    const o = (py * N + px) * 4;
    nd[o] = (c1[0] * (1 - m) + c2[0] * m) * w * 70; nd[o + 1] = (c1[1] * (1 - m) + c2[1] * m) * w * 70; nd[o + 2] = (c1[2] * (1 - m) + c2[2] * m) * w * 70 + 6; nd[o + 3] = 255;
  }
  nx.putImageData(ni, 0, 0);
  for (let i = 0; i < 520; i++) {
    const sx = rnd() * N, sy = rnd() * N, br = rnd(), s = br > 0.97 ? 1.6 : 0.7;
    nx.fillStyle = `rgba(255,255,255,${0.15 + br * 0.6})`; nx.fillRect(sx, sy, s, s);
  }
  return { floor: c, neb: nc };
}

/* ---------- Рой ---------- */
class Swarm {
  constructor(o) {
    Object.assign(this, {
      x: 0, y: 0, vx: 0, vy: 0, n: 40, peak: 40, hue: 60, spread: 20, player: false, boss: false, alive: true,
      comp: 0, want: false, stamina: 1, compT: 0, invul: 0, cap: 400, kind: "greedy", name: "",
      tx: 0, ty: 0, think: 0, kills: 0, mods: {}, fire: 0, lastHit: null, spawnT: 0, novaReady: true
    }, o);
    const C = this.cap;
    this.px = new Float32Array(C); this.py = new Float32Array(C);
    this.ang = new Float32Array(C); this.rad = new Float32Array(C); this.w = new Float32Array(C);
    this.f = new Float32Array(C); this.sz = new Float32Array(C); this.ph = new Float32Array(C);
    this.cr = new Float32Array(C); this.cg = new Float32Array(C); this.cb = new Float32Array(C);
    this.vis = 0;
    this.color = hsl(this.hue, 95, 62);
  }
  get r() { return 13 * Math.pow(Math.max(this.n, 1), 0.42); }
  get reff() { return this.r * (1 - 0.48 * this.comp); }
  get S() { return Math.sqrt(Math.max(this.n, 0)) * (1 + 1.5 * this.comp) * (1 + (this.mods.dmg || 0)); }
  targetVis() { return Math.min(this.cap, Math.round(6 + 4.2 * Math.pow(Math.max(this.n, 0), 0.72))); }
  addParticle(x, y) {
    if (this.vis >= this.cap) return;
    const i = this.vis++;
    this.px[i] = x; this.py[i] = y;
    this.ang[i] = Math.random() * TAU; this.rad[i] = Math.pow(Math.random(), 0.62);
    this.w[i] = (0.25 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1) * (1.3 - this.rad[i]);
    this.f[i] = 3.5 + Math.random() * 7; this.sz[i] = 0.7 + Math.random() * 0.6; this.ph[i] = Math.random() * TAU;
    const h = this.spread >= 360 ? Math.random() * 360 : this.hue + (Math.random() - 0.5) * this.spread;
    const c = hsl(h, 90 + Math.random() * 10, 55 + Math.random() * 20);
    this.cr[i] = c[0]; this.cg[i] = c[1]; this.cb[i] = c[2];
  }
  removeParticle(fx) {
    if (this.vis <= 0) return; const i = Math.floor(Math.random() * this.vis), j = --this.vis;
    if (fx) fx(this.px[i], this.py[i], this.cr[i], this.cg[i], this.cb[i]);
    this.px[i] = this.px[j]; this.py[i] = this.py[j]; this.ang[i] = this.ang[j]; this.rad[i] = this.rad[j]; this.w[i] = this.w[j];
    this.f[i] = this.f[j]; this.sz[i] = this.sz[j]; this.ph[i] = this.ph[j]; this.cr[i] = this.cr[j]; this.cg[i] = this.cg[j]; this.cb[i] = this.cb[j];
  }
  updateParticles(dt, t, maxSp) {
    const r = this.r, sp = Math.hypot(this.vx, this.vy), dx = sp > 1 ? this.vx / sp : 1, dy = sp > 1 ? this.vy / sp : 0;
    const spf = clamp(sp / (maxSp || 300), 0, 1.4), c = this.comp, rr = r * (1 - 0.5 * c);
    const tail = 1 + (0.5 + 1.9 * c) * spf, head = 1 + 0.35 * c * spf, side = 1 - 0.4 * c;
    const fm = 1 + c * 1.2, wob = rr * 0.06;
    for (let i = 0; i < this.vis; i++) {
      this.ang[i] += this.w[i] * dt * (1 + c * 2);
      const hr = this.rad[i], hx = Math.cos(this.ang[i]) * hr, hy = Math.sin(this.ang[i]) * hr;
      let a = hx * dx + hy * dy, b = -hx * dy + hy * dx;
      a *= a < 0 ? tail : head; b *= side;
      const tx = this.x + (a * dx - b * dy) * rr + Math.sin(t * 1.7 + this.ph[i]) * wob;
      const ty = this.y + (a * dy + b * dx) * rr + Math.cos(t * 1.3 + this.ph[i] * 1.3) * wob;
      const k = Math.min(1, this.f[i] * fm * dt);
      this.px[i] += (tx - this.px[i]) * k; this.py[i] += (ty - this.py[i]) * k;
    }
  }
}

/* ---------- Мир ---------- */
class World {
  constructor(o) {
    this.o = o;
    this.mode = o.mode;              // campaign | boss | endless | daily | menu
    this.bkey = o.biome; this.B = BIOMES[o.biome];
    this.R = o.R || 2400;
    this.L = o.level || 0;
    this.rng = mulberry32(o.seed || 1);
    this.noise = makeNoise((o.seed || 1) + 5);
    this.t = 0; this.events = o.onEvent || (() => { });
    this.q = Render.quality;
    this.swarms = []; this.player = null; this.boss = null;
    this.beacons = []; this.hazards = []; this.sources = [];
    this.req = o.req || [100, 150, 200];
    this.diff = 0.55 + this.L * 0.025;
    this.capP = [1300, 2400, 3600][this.q]; this.capB = [180, 340, 520][this.q];
    // свет
    this.MM = 3200; this.mn = 0;
    this.mx = new Float32Array(this.MM); this.my = new Float32Array(this.MM); this.mv = new Float32Array(this.MM);
    this.mvx = new Float32Array(this.MM); this.mvy = new Float32Array(this.MM); this.mph = new Float32Array(this.MM); this.mt = new Uint8Array(this.MM);
    this.moteTarget = Math.round(700 * (this.R / 2400) * (this.R / 2400));
    this.moteVal = Math.pow(Math.max(95, this.req[2]) / 95, 0.42);
    // искры-эффекты
    this.FM = 3500; this.fn = 0;
    this.fx_ = new Float32Array(this.FM); this.fy = new Float32Array(this.FM); this.fvx = new Float32Array(this.FM); this.fvy = new Float32Array(this.FM);
    this.fl = new Float32Array(this.FM); this.fml = new Float32Array(this.FM); this.fr = new Float32Array(this.FM); this.fg = new Float32Array(this.FM); this.fb = new Float32Array(this.FM); this.fs = new Float32Array(this.FM);
    this.embers = [];
    this.waves = [];
    this.botTarget = o.bots != null ? o.bots : 5 + Math.min(4, Math.floor(this.L / 6));
    this.respawnT = 0; this.botSeq = 0;
    this.shake = 0; this.slowmo = 0; this.won = false; this.over = false;
    this.mutNext = 0; this.mutCount = 0; this.mutLevels = {};
    this.statKills = 0; this.statCompKills = 0; this.statMotes = 0; this.peak = 0;
    this.cam = { x: 0, y: 0, scale: 0.5 }; this.camOffY = 0; this.streak = 0; this.streakT = 0;
    this.build();
  }

  rand(a, b) { return a + (b - a) * this.rng(); }
  randPos(minR, maxR) { const a = this.rng() * TAU, r = Math.sqrt(this.rand((minR / this.R) ** 2, (maxR / this.R) ** 2)) * this.R; return [Math.cos(a) * r, Math.sin(a) * r]; }

  build() {
    const o = this.o, mode = this.mode;
    // игрок
    if (o.player) {
      const pc = o.player;
      this.player = new Swarm({ player: true, n: pc.startN, peak: pc.startN, hue: pc.hue, spread: pc.spread, cap: this.capP, mods: Object.assign({}, pc.mods), name: "Ты" });
      this.player.base = pc;
      const [px, py] = mode === "boss" ? [0, this.R * 0.75] : this.randPos(0, this.R * 0.15);
      this.player.x = px; this.player.y = py;
      this.swarms.push(this.player);
      for (let i = 0; i < Math.min(this.player.targetVis(), this.player.cap); i++) this.player.addParticle(px + (Math.random() - 0.5) * 60, py + (Math.random() - 0.5) * 60);
      this.mutNext = pc.startN * 2.3; this.mutPrev = pc.startN;
      this.cam.x = px; this.cam.y = py;
      // высадка: камера стартует издалека и пикирует к рою
      this.cam.scale = (Math.min(window.innerWidth, window.innerHeight) / 2) / Math.max(440, this.player.r * 3.6) * 0.22;
    }
    // маяки
    if (mode === "campaign") {
      const a0 = this.rng() * TAU;
      for (let i = 0; i < 3; i++) {
        const a = a0 + i * TAU / 3 + this.rand(-0.3, 0.3), rr = this.R * this.rand(0.5, 0.72);
        this.beacons.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, p: 0, lit: false, req: this.req[i], rad: 230, contested: false, ping: 0 });
      }
    }
    // источники света (цветы)
    const ns = Math.round(10 * (this.R / 2400) ** 2);
    for (let i = 0; i < ns; i++) { const [x, y] = this.randPos(this.R * 0.1, this.R * 0.95); this.sources.push({ x, y, t: this.rng() * 4, ph: this.rng() * TAU }); }
    // опасности по биому
    this.buildHazards();
    // свет
    for (let i = 0; i < this.moteTarget; i++) { const [x, y] = this.randPos(0, this.R * 0.98); this.addMote(x, y, this.moteVal * this.rand(0.8, 1.6), 0); }
    // боты
    if (mode === "boss") this.spawnBoss();
    for (let i = 0; i < this.botTarget; i++) this.spawnBot(true);
  }

  buildHazards() {
    const k = this.bkey, H = this.hazards, L = this.L, area = (this.R / 2400) ** 2, mixed = this.mode === "endless" || this.mode === "daily";
    const kinds = mixed ? [...new Set(this.o.hazards || [])] : [k];
    for (const kk of kinds) {
      if (kk === "ice") for (let i = 0; i < Math.round(16 * area); i++) { const [x, y] = this.randPos(200, this.R * 0.95); H.push({ type: "crystal", x, y, r: this.rand(40, 70), hp: 1, ph: this.rng() * TAU }); }
      if (kk === "volcano") for (let i = 0; i < Math.round(9 * area); i++) { const [x, y] = this.randPos(400, this.R * 0.93); H.push({ type: "geyser", x, y, r: this.rand(150, 210), t: this.rand(2, 8), state: 0 }); }
      if (kk === "desert") for (let i = 0; i < Math.max(1, Math.round(2 * area)); i++) { const [x, y] = this.randPos(400, this.R * 0.7); H.push({ type: "storm", x, y, r: this.rand(380, 520), a: this.rng() * TAU, sp: this.rand(70, 110) }); }
      if (kk === "gas") for (let i = 0; i < Math.round(4 * area); i++) { const [x, y] = this.randPos(600, this.R * 0.85); H.push({ type: "well", x, y, r: 700, core: 90, ph: this.rng() * TAU }); }
      if (kk === "dark") for (let i = 0; i < Math.round(5 * area); i++) { const [x, y] = this.randPos(500, this.R * 0.9); H.push({ type: "void", x, y, r: this.rand(220, 320) }); }
    }
    const eels = this.mode === "menu" ? 0 : mixed ? 1 : (L >= 2 && !BIOMES[k].boss ? (L >= 18 ? 2 : 1) : 0);
    for (let i = 0; i < eels; i++) this.spawnEel();
  }
  spawnEel() {
    const [x, y] = this.randPos(this.R * 0.6, this.R * 0.9), seg = [];
    for (let j = 0; j < 16; j++) seg.push({ x: x + j * 30, y });
    this.hazards.push({ type: "eel", x, y, vx: 0, vy: 0, seg, stun: 0, target: null, r: 55, hue: 340 });
  }

  mval() { // ценность света: в кампании по уровню, в бесконечном — растёт с роем
    const P = this.player;
    if ((this.mode === "endless" || this.mode === "daily") && P) return this.moteVal * (1 + Math.sqrt(P.peak / 400));
    return this.moteVal;
  }
  addMote(x, y, v, type) {
    if (this.mn >= this.MM) return; const i = this.mn++;
    this.mx[i] = x; this.my[i] = y; this.mv[i] = v; this.mvx[i] = 0; this.mvy[i] = 0; this.mph[i] = Math.random() * TAU; this.mt[i] = type || 0;
  }
  removeMote(i) {
    const j = --this.mn;
    this.mx[i] = this.mx[j]; this.my[i] = this.my[j]; this.mv[i] = this.mv[j]; this.mvx[i] = this.mvx[j]; this.mvy[i] = this.mvy[j]; this.mph[i] = this.mph[j]; this.mt[i] = this.mt[j];
  }
  spark(x, y, r, g, b, sp, life, sz) {
    if (this.fn >= this.FM) return; const i = this.fn++, a = Math.random() * TAU, s = (sp || 120) * (0.3 + Math.random());
    this.fx_[i] = x; this.fy[i] = y; this.fvx[i] = Math.cos(a) * s; this.fvy[i] = Math.sin(a) * s;
    this.fl[i] = this.fml[i] = (life || 0.6) * (0.6 + Math.random() * 0.6); this.fr[i] = r; this.fg[i] = g; this.fb[i] = b; this.fs[i] = sz || 10;
  }
  burst(x, y, col, n, sp, life, sz) { for (let i = 0; i < n; i++) this.spark(x, y, col[0], col[1], col[2], sp, life, sz); }

  botName(kind) { return { greedy: "Жадный", hunter: "Охотник", coward: "Трус", strategist: "Стратег" }[kind]; }
  spawnBot(initial) {
    const P = this.player, kinds = ["greedy", "hunter", "coward", "strategist"];
    let kind = kinds[Math.floor(this.rng() * 4)];
    if (this.L < 2 && kind === "hunter") kind = "greedy";
    const ref = P ? Math.max(P.n, this.req[0] * 0.5) : 300;
    const mults = this.L < 1 ? [0.25, 0.4, 0.6, 0.9] : this.L < 4 ? [0.25, 0.45, 0.7, 1.1, 1.4] : [0.3, 0.5, 0.8, 1.2, 1.7, 2.2];
    let m = mults[Math.floor(this.rng() * mults.length)] * (0.75 + this.diff * 0.35);
    if (this.mode === "menu") m = this.rand(0.3, 3);
    let n = Math.max(12, ref * m * this.rand(0.85, 1.15));
    let x, y, tries = 0;
    do { [x, y] = this.randPos(this.R * 0.15, this.R * 0.95); tries++; }
    while (P && tries < 30 && dist2(x, y, P.x, P.y) < (900 + P.r * 3) ** 2);
    const hue = (this.B.hue + 120 + this.rng() * 200) % 360;
    const b = new Swarm({ x, y, n, peak: n, hue, spread: 24, cap: this.capB, kind, name: this.botName(kind), think: this.rng() * 0.3, spawnT: initial ? 0 : 1 });
    for (let i = 0; i < b.targetVis(); i++) b.addParticle(x + (Math.random() - 0.5) * b.r, y + (Math.random() - 0.5) * b.r);
    b.id = ++this.botSeq;
    this.swarms.push(b);
    return b;
  }
  spawnBoss() {
    const n = this.req[2] * 2.2;
    const b = new Swarm({ x: 0, y: -this.R * 0.2, n, peak: n, hue: (this.B.hue + 180) % 360, spread: 40, cap: [600, 1100, 1600][this.q], kind: "boss", boss: true, name: "Владыка" });
    b.maxN = n; b.phaseT = 4; b.minionT = 10;
    for (let i = 0; i < b.targetVis(); i++) b.addParticle(b.x + (Math.random() - 0.5) * b.r, b.y + (Math.random() - 0.5) * b.r);
    this.boss = b; this.swarms.push(b);
    this.botTarget = Math.max(3, this.botTarget - 2);
  }

  // параметры игрока с учётом мутаций и улучшений
  pval(k) { const P = this.player, b = P.base, m = this.mutLevels[k] || 0, s = (b.eff && b.eff[k]) || 0; return { b, m, s }; }
  speedOf(s) {
    const base = 240 * (1 + 0.55 * Math.log10(1 + s.n / 80));
    if (s.player) { const { b, m, s: e } = this.pval("speed"); return base * (1 + b.speedUp + m * 0.18 + e) * (s.fire > 0 ? 1.45 : 1); }
    if (s.boss) return base * 0.78;
    return base * (0.82 + this.diff * 0.12) * (s.kind === "coward" ? 1.08 : 1) * (s.fire > 0 ? 1.4 : 1);
  }
  dmgMul(s) {
    if (s.player) { const { b, m, s: e } = this.pval("dmg"); return 1 + b.powerUp + m * 0.35 + e; }
    return s.boss ? 1.15 : 0.9 + this.diff * 0.1;
  }

  /* ---------- шаг симуляции ---------- */
  update(dt, input) {
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.35; }
    this.t += dt;
    const P = this.player;
    // управление игроком
    if (P && P.alive) this.controlPlayer(P, dt, input);
    // боты
    for (const s of this.swarms) if (!s.player && s.alive) this.botThink(s, dt);
    // движение
    for (const s of this.swarms) {
      if (!s.alive) continue;
      s.x += s.vx * dt; s.y += s.vy * dt;
      const d = Math.hypot(s.x, s.y), lim = this.R - s.reff * 0.85;
      if (d > lim) { s.x *= lim / d; s.y *= lim / d; const nx = s.x / d, ny = s.y / d, vn = s.vx * nx + s.vy * ny; if (vn > 0) { s.vx -= vn * nx * 1.5; s.vy -= vn * ny * 1.5; } }
      s.comp += ((s.want ? 1 : 0) - s.comp) * Math.min(1, dt * 7);
      if (s.invul > 0) s.invul -= dt;
      if (s.fire > 0) s.fire -= dt;
      if (s.spawnT > 0) s.spawnT -= dt * 1.5;
    }
    this.combat(dt);
    this.updateMotes(dt);
    this.updateHazards(dt);
    this.updateBeacons(dt);
    this.updateEffects(dt);
    // визуальные частицы и смерть
    for (const s of this.swarms) {
      if (!s.alive) continue;
      if (s.n > s.peak) s.peak = s.n;
      const tv = s.targetVis();
      let guard = 0;
      while (s.vis < tv && guard++ < 40) { const a = Math.random() * TAU, rr = s.r * 1.6; s.addParticle(s.x + Math.cos(a) * rr * Math.random(), s.y + Math.sin(a) * rr * Math.random()); }
      guard = 0;
      while (s.vis > tv && guard++ < 60) s.removeParticle((x, y, r, g, b) => this.spark(x, y, r, g, b, 90, 0.7, 9));
      s.updateParticles(dt, this.t, this.speedOf(s));
      if (s.n < 3) this.kill(s);
    }
    this.swarms = this.swarms.filter(s => s.alive || s.player);
    // респаун ботов
    if (this.mode !== "boss" || this.boss) {
      const nb = this.swarms.filter(s => !s.player && !s.boss && s.alive).length;
      if (nb < this.botTarget) { this.respawnT -= dt; if (this.respawnT <= 0) { this.spawnBot(false); this.respawnT = this.rand(2.5, 5); } }
    }
    // мутации
    if (P && P.alive && this.mode !== "menu" && this.mutCount < 9 && P.n >= this.mutNext) {
      this.mutCount++; this.mutPrev = P.n; this.mutNext = P.n * 2.2;
      this.events("mutation", this.mutOptions());
    }
    if (P && P.n > this.peak) this.peak = P.n;
    if (this.mode === "menu" && P) { P.invul = 9; if (P.n > 900) P.n = 900; }
    if (this.streakT > 0) { this.streakT -= dt; if (this.streakT <= 0) this.streak = 0; }
    this.updateCamera(dt);
  }

  controlPlayer(P, dt, inp) {
    const sp = this.speedOf(P);
    let dx = inp.dx || 0, dy = inp.dy || 0, mag = clamp(inp.mag || 0, 0, 1);
    const ice = this.bkey === "ice" && this.mode === "campaign" || this.hazardsHas("ice");
    const acc = ice ? 1.6 : 6.5;
    const tvx = dx * sp * mag * (1 + 0.38 * P.comp), tvy = dy * sp * mag * (1 + 0.38 * P.comp);
    P.vx += (tvx - P.vx) * Math.min(1, dt * acc); P.vy += (tvy - P.vy) * Math.min(1, dt * acc);
    // выносливость
    const st = this.pval("stamina"), cap = 1 + st.b.staminaUp + st.s;
    const drain = 0.3 * Math.pow(0.65, st.m) / cap, regen = 0.2 * (1 + st.m * 0.15) / Math.sqrt(cap);
    const wasComp = P.want;
    if (inp.compress && P.stamina > (wasComp ? 0 : 0.08)) {
      P.want = true; P.stamina = Math.max(0, P.stamina - drain * dt); P.compT += dt;
      if (!wasComp) this.onCompressStart(P);
    } else {
      P.want = false; P.compT = 0;
      P.stamina = Math.min(1, P.stamina + regen * dt);
    }
    if (wasComp !== P.want) this.events("compress", P.want);
  }
  hazardsHas(k) { return (this.o.hazards || []).includes(k) && (this.mode === "endless" || this.mode === "daily"); }
  onCompressStart(P) {
    const g = this.mutLevels.ghost || 0; if (g) P.invul = Math.max(P.invul, 0.8 + g * 0.6);
    const nv = this.mutLevels.nova || 0;
    if (nv && P.stamina > 0.85) {
      const R = P.r * (2.6 + nv);
      this.waves.push({ x: P.x, y: P.y, r: 0, max: R, life: 0.6, col: P.color });
      for (const s of this.swarms) {
        if (s === P || !s.alive) continue;
        const d = Math.hypot(s.x - P.x, s.y - P.y);
        if (d < R + s.r) {
          const loss = s.n * (s.boss ? 0.08 : 0.18) * nv; s.n -= loss; P.n += loss * 0.4;
          const k = 600 / Math.max(d, 1); s.vx += (s.x - P.x) * k * 0.6; s.vy += (s.y - P.y) * k * 0.6; s.lastHit = P;
        }
      }
      this.shake = Math.max(this.shake, 0.5); this.events("nova");
    }
  }

  botThink(s, dt) {
    s.think -= dt;
    if (s.think <= 0) {
      s.think = 0.22 + Math.random() * 0.12;
      let fx = 0, fy = 0, best = null, bestScore = 0, threat = 0;
      const myS = s.S, myComp = Math.sqrt(s.n) * (1 + 1.5) * this.dmgMul(s);
      for (const o of this.swarms) {
        if (o === s || !o.alive || o.spawnT > 0) continue;
        const dx = o.x - s.x, dy = o.y - s.y, d = Math.hypot(dx, dy) || 1;
        const oS = Math.sqrt(o.n) * (1 + 1.5 * Math.max(o.comp, o.player ? 0.6 : 0.3)) * this.dmgMul(o);
        const range = 380 + s.r * 3 + o.r * 2;
        if (d < range && oS > myS * (s.kind === "coward" ? 0.85 : 1.15)) {
          const w = (1 - d / range) * (oS / myS); fx -= dx / d * w * 2.2; fy -= dy / d * w * 2.2; threat = Math.max(threat, w);
        } else if (d < 1300 + s.r * 2 && myComp > oS * (s.kind === "hunter" || s.kind === "boss" ? 1.25 : s.kind === "strategist" ? 1.4 : 2.2)) {
          let sc = (o.n / (d + 200)) * (s.kind === "hunter" ? 2 : s.kind === "strategist" ? 1.6 : 0.8);
          if (o.player) sc *= s.boss ? 3 : 1.25;
          if (sc > bestScore) { bestScore = sc; best = o; }
        }
      }
      s.target = best; s.threat = threat;
      // свет: ближайший сгусток
      if (!best || s.kind === "greedy") {
        let bd = 1e12, bx = 0, by = 0;
        for (let k = 0; k < 24; k++) {
          const i = Math.floor(Math.random() * this.mn); if (i >= this.mn) break;
          const d = dist2(s.x, s.y, this.mx[i], this.my[i]);
          if (d < bd) { bd = d; bx = this.mx[i]; by = this.my[i]; }
        }
        if (bd < 1e12) { const d = Math.sqrt(bd) || 1; s.mtx = (bx - s.x) / d; s.mty = (by - s.y) / d; } else { s.mtx = 0; s.mty = 0; }
      }
      // маяки: стратеги и жадные иногда охраняют
      if (this.beacons.length && !best && (s.kind === "strategist" || s.kind === "greedy") && this.player) {
        for (const b of this.beacons) if (!b.lit && b.p > 0.05 && dist2(s.x, s.y, b.x, b.y) < 1400 ** 2 && s.S > this.player.S * 0.6) { s.guard = b; break; }
      }
      // опасности
      for (const h of this.hazards) {
        let rr = 0;
        if (h.type === "eel") rr = 420 + s.r; else if (h.type === "geyser" && h.state > 0) rr = h.r + s.r + 60;
        else if (h.type === "void") rr = h.r + s.r + 40; else if (h.type === "well") rr = h.core + s.r + 160; else if (h.type === "storm" && !s.want) rr = h.r + s.r;
        if (!rr) continue;
        const dx = s.x - h.x, dy = s.y - h.y, d = Math.hypot(dx, dy) || 1;
        if (d < rr) { const w = (1 - d / rr) * 2.5; fx += dx / d * w; fy += dy / d * w; }
      }
      // край
      const dc = Math.hypot(s.x, s.y); if (dc > this.R * 0.85) { fx -= s.x / dc * 1.5; fy -= s.y / dc * 1.5; }
      let gx = fx, gy = fy;
      if (best) { const dx = best.x - s.x, dy = best.y - s.y, d = Math.hypot(dx, dy) || 1; gx += dx / d * 1.6; gy += dy / d * 1.6; s.chaseD = d - best.r - s.r; }
      else if (s.guard && !s.guard.lit) { const dx = s.guard.x - s.x, dy = s.guard.y - s.y, d = Math.hypot(dx, dy) || 1; if (d > 120) { gx += dx / d; gy += dy / d; } }
      else { gx += (s.mtx || 0); gy += (s.mty || 0); }
      if (s.boss) { s.phaseT -= 0.25; }
      const gl = Math.hypot(gx, gy) || 1; s.dirx = gx / gl; s.diry = gy / gl;
      if (Math.hypot(gx, gy) < 0.05) { s.dirx = Math.cos(this.t + s.id); s.diry = Math.sin(this.t * 0.7 + s.id); }
      // решение о сжатии
      const canComp = s.stamina > 0.25;
      let want = false;
      if (best && s.chaseD < 260 && canComp && (s.kind === "strategist" || s.kind === "hunter" || s.boss)) want = true;
      if (threat > 0.6 && s.stamina > 0.5 && s.kind !== "coward") want = true;
      if (threat > 0.3 && s.kind === "coward" && s.stamina > 0.3) want = true;
      if (s.boss && s.phaseT <= 0) { want = true; if (s.phaseT < -2.5) s.phaseT = 5 + Math.random() * 3; }
      s.want = want;
    }
    const sp = this.speedOf(s) * (s.want ? 1.3 : 1) * (s.spawnT > 0 ? 0.3 : 1);
    s.vx += ((s.dirx || 0) * sp - s.vx) * Math.min(1, dt * 3.5); s.vy += ((s.diry || 0) * sp - s.vy) * Math.min(1, dt * 3.5);
    if (s.want) s.stamina = Math.max(0, s.stamina - dt * 0.28); else s.stamina = Math.min(1, s.stamina + dt * 0.16);
    if (s.boss) {
      s.minionT -= dt;
      if (s.minionT <= 0 && s.n < s.maxN * 0.7) { s.minionT = 14; for (let i = 0; i < 2; i++) { const b = this.spawnBot(false); b.x = s.x + this.rand(-200, 200); b.y = s.y + this.rand(-200, 200); b.kind = "hunter"; b.n = Math.max(20, this.player.n * 0.35); } this.events("warn", "Владыка призвал стражей!"); }
    }
  }

  combat(dt) {
    const S = this.swarms, K = 21;
    for (let i = 0; i < S.length; i++) {
      const a = S[i]; if (!a.alive || a.spawnT > 0) continue;
      for (let j = i + 1; j < S.length; j++) {
        const b = S[j]; if (!b.alive || b.spawnT > 0) continue;
        if ((a.boss || b.boss) && !a.player && !b.player) continue;   // свита владыки не дерётся с ним
        const ra = a.reff, rb = b.reff, d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d >= (ra + rb) * 0.92) continue;
        const ov = clamp(((ra + rb) * 0.92 - d) / (2 * Math.min(ra, rb)), 0.15, 1);
        const SA = Math.sqrt(a.n) * (1 + 1.5 * a.comp) * this.dmgMul(a), SB = Math.sqrt(b.n) * (1 + 1.5 * b.comp) * this.dmgMul(b);
        let la = K * ov * SB * SB / (SA + SB) * dt, lb = K * ov * SA * SA / (SA + SB) * dt;
        if (a.invul > 0) la = 0; if (b.invul > 0) lb = 0;
        la = Math.min(la, a.n); lb = Math.min(lb, b.n);
        const ka = a.player ? 1 + this.pval("kill").m * 0.25 + (this.pval("kill").s || 0) : a.boss ? 1 : 0.75;
        const kb = b.player ? 1 + this.pval("kill").m * 0.25 + (this.pval("kill").s || 0) : b.boss ? 1 : 0.75;
        a.n -= la; b.n -= lb; a.n += lb * 0.6 * ka; b.n += la * 0.6 * kb;
        a.lastHit = b; b.lastHit = a; a.fightT = b.fightT = this.t;
        // искры на линии контакта
        const mx = (a.x * rb + b.x * ra) / (ra + rb), my = (a.y * rb + b.y * ra) / (ra + rb);
        const nsp = Math.min(6, (la + lb) * 0.6 + 0.5);
        for (let k = 0; k < nsp; k++) { const c = Math.random() < 0.5 ? a.color : b.color; this.spark(mx + (Math.random() - 0.5) * 30, my + (Math.random() - 0.5) * 30, c[0], c[1], c[2], 220, 0.45, 9); }
        if (a.player || b.player) { this.events("fight", la + lb); this.shake = Math.max(this.shake, Math.min(0.35, (la + lb) * 0.02)); }
      }
    }
  }

  kill(s) {
    if (!s.alive) return;
    if (s.player) {
      s.alive = false; s.n = 0; this.burst([s.x, s.y][0], s.y, s.color, 80, 420, 1.2, 14);
      while (s.vis) s.removeParticle((x, y, r, g, b) => this.spark(x, y, r, g, b, 260, 1, 12));
      this.over = true; this.events("dead"); return;
    }
    s.alive = false;
    while (s.vis) s.removeParticle((x, y, r, g, b) => this.spark(x, y, r, g, b, 300, 0.9, 11));
    // часть света рассыпается
    const drop = Math.min(40, Math.round(s.peak ** 0.5));
    for (let i = 0; i < drop; i++) this.addMote(s.x + this.rand(-1, 1) * s.r, s.y + this.rand(-1, 1) * s.r, Math.max(1, s.peak * 0.15 / drop), 2);
    const byP = s.lastHit && s.lastHit.player;
    if (byP) {
      this.streak = this.streakT > 0 ? this.streak + 1 : 1; this.streakT = 3.5;
      if (this.streak >= 2) this.events("streak", this.streak);
      this.statKills++; if (s.lastHit.comp > 0.5) this.statCompKills++;
      this.events("kill", { name: s.name, comp: s.lastHit.comp > 0.5, n: s.peak, boss: s.boss });
      if (s.peak > this.player.n * 0.5 || s.boss) this.slowmo = s.boss ? 1.4 : 0.5;
      this.shake = Math.max(this.shake, s.boss ? 1 : 0.4);
    }
    if (s.boss) { this.boss = null; this.won = true; this.events("win"); }
  }

  updateMotes(dt) {
    const sw = this.swarms.filter(s => s.alive && s.spawnT <= 0), P = this.player;
    const magP = P ? 1 + P.base.magnetUp + (this.mutLevels.magnet || 0) * 0.6 + ((P.base.eff && P.base.eff.magnet) || 0) : 1;
    const valP = P ? (1 + (this.mutLevels.value || 0) * 0.3 + ((P.base.eff && P.base.eff.value) || 0)) * (P.base.valueMul || 1) : 1;
    let gotP = 0, gotN = 0;
    for (let i = this.mn - 1; i >= 0; i--) {
      let x = this.mx[i], y = this.my[i];
      this.mvx[i] *= 1 - dt * 2.2; this.mvy[i] *= 1 - dt * 2.2;
      let eaten = false;
      for (const s of sw) {
        const pr = s.player ? magP : 1, r = s.reff * 0.95 + 12, rm = (s.r * 1.6 + 60) * pr * (s.player ? 1 : 0.8);
        const dx = s.x - x, dy = s.y - y, d2 = dx * dx + dy * dy;
        if (d2 < r * r * (s.player ? Math.min(1.6, pr) : 1)) {
          let v = this.mv[i] * (s.player ? valP : 0.9);
          if (this.mt[i] === 1) s.fire = 4;
          s.n += v; eaten = true;
          if (s.player) { gotP += v; gotN++; }
          break;
        } else if (d2 < rm * rm) {
          const d = Math.sqrt(d2) || 1, f = (1 - d / rm) * 900 * dt; this.mvx[i] += dx / d * f; this.mvy[i] += dy / d * f;
        }
      }
      if (eaten) {
        if (gotN < 5 || Math.random() < 0.2) { const c = hsl(this.mt[i] === 1 ? 30 : this.B.mote, 90, 70); this.burst(x, y, c, 3, 80, 0.4, 7); }
        this.removeMote(i); continue;
      }
      // течения и колодцы
      x += this.mvx[i] * dt; y += this.mvy[i] * dt; this.mx[i] = x; this.my[i] = y;
    }
    if (gotP > 0) { this.statMotes += gotP; this.events("absorb", { v: gotP, n: gotN }); }
    // пополнение света
    const need = this.moteTarget - this.mn;
    if (need > 0) {
      const k = Math.min(need, Math.ceil(dt * this.moteTarget * 0.05));
      for (let j = 0; j < k; j++) { const [x, y] = this.randPos(0, this.R * 0.97); this.addMote(x, y, this.mval() * this.rand(0.8, 1.6), 0); }
    }
    // цветы-источники
    for (const s of this.sources) {
      s.t -= dt;
      if (s.t <= 0) {
        s.t = this.rand(3, 6);
        const k = 6 + Math.floor(this.rng() * 6);
        for (let j = 0; j < k; j++) {
          const a = this.rng() * TAU, sp = this.rand(60, 220), fire = this.bkey === "volcano" && this.rng() < 0.25;
          this.addMote(s.x, s.y, this.mval() * 1.8, fire ? 1 : 0);
          this.mvx[this.mn - 1] = Math.cos(a) * sp; this.mvy[this.mn - 1] = Math.sin(a) * sp;
        }
      }
    }
  }

  hazardDmg(s, frac, dt) {
    if (s.invul > 0 || s.boss) return;
    let k = 1; if (s.player) { const a = this.pval("armor"); k = Math.pow(0.65, a.m) * (1 - (a.s || 0)); }
    s.n -= s.n * frac * dt * k + (frac > 0.5 ? 2 : 0.4) * dt * k;
    if (Math.random() < 0.3) { const c = s.color; this.spark(s.x + (Math.random() - 0.5) * s.r, s.y + (Math.random() - 0.5) * s.r, c[0], c[1], c[2], 150, 0.5, 9); }
    if (s.player) this.events("hurt");
  }

  updateHazards(dt) {
    const sw = this.swarms.filter(s => s.alive);
    for (const h of this.hazards) {
      if (h.type === "geyser") {
        h.t -= dt;
        if (h.state === 0 && h.t <= 1.4) { h.state = 1; if (this.player && dist2(h.x, h.y, this.player.x, this.player.y) < 1200 ** 2) this.events("geyserWarn"); }
        if (h.state === 1 && h.t <= 0) { h.state = 2; h.t = 0.9; this.burst(h.x, h.y, [1, 0.5, 0.1], 50, 500, 1, 16); this.shake = Math.max(this.shake, this.player && dist2(h.x, h.y, this.player.x, this.player.y) < 900 ** 2 ? 0.4 : 0); }
        else if (h.state === 2) {
          for (const s of sw) if (dist2(s.x, s.y, h.x, h.y) < (h.r + s.reff * 0.5) ** 2) this.hazardDmg(s, 0.55, dt);
          if (Math.random() < 0.7) this.spark(h.x + (Math.random() - 0.5) * h.r, h.y + (Math.random() - 0.5) * h.r, 1, 0.45 + Math.random() * 0.3, 0.1, 260, 0.8, 14);
          if (h.t <= 0) { h.state = 0; h.t = this.rand(6, 10); }
        }
      } else if (h.type === "crystal") {
        if (h.hp <= 0) { h.respawn -= dt; if (h.respawn <= 0) h.hp = 1; continue; }
        for (const s of sw) {
          if (dist2(s.x, s.y, h.x, h.y) < (h.r + s.reff * 0.7) ** 2 && s.comp > 0.6) {
            h.hp = 0; h.respawn = 25;
            const k = 22; for (let j = 0; j < k; j++) { this.addMote(h.x, h.y, this.mval() * 3, 2); const a = j / k * TAU; this.mvx[this.mn - 1] = Math.cos(a) * 260; this.mvy[this.mn - 1] = Math.sin(a) * 260; }
            this.burst(h.x, h.y, [0.7, 0.95, 1], 40, 380, 0.9, 13); if (s.player) this.events("crystal");
            break;
          }
        }
      } else if (h.type === "storm") {
        h.a += dt * 0.15; h.x += Math.cos(h.a) * h.sp * dt; h.y += Math.sin(h.a * 1.3) * h.sp * dt;
        const d = Math.hypot(h.x, h.y); if (d > this.R * 0.75) { h.a += Math.PI * 0.7; h.x *= this.R * 0.74 / d; h.y *= this.R * 0.74 / d; }
        for (const s of sw) {
          const dx = s.x - h.x, dy = s.y - h.y, dd = Math.hypot(dx, dy) || 1;
          if (dd < h.r + s.reff * 0.5) {
            // вихрь: тангенциальный снос
            const k = (1 - s.comp) * 260 * dt; s.vx += (-dy / dd) * k * 2 + dx / dd * k; s.vy += (dx / dd) * k * 2 + dy / dd * k;
            if (s.comp < 0.5) this.hazardDmg(s, 0.12, dt);
          }
        }
        for (let j = 0; j < 4; j++) { const a = Math.random() * TAU, rr = Math.random() * h.r; this.spark(h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr, 1, 0.75, 0.35, 120, 0.9, 7); }
      } else if (h.type === "well") {
        for (const s of sw) {
          const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy) || 1;
          if (d < h.r) { const f = (1 - d / h.r) * 380 * dt; s.vx += dx / d * f; s.vy += dy / d * f; }
          if (d < h.core + s.reff * 0.3) this.hazardDmg(s, 0.3, dt);
        }
        for (let i = 0; i < this.mn; i++) {
          const dx = h.x - this.mx[i], dy = h.y - this.my[i], d2 = dx * dx + dy * dy;
          if (d2 < h.r * h.r && d2 > 100) { const d = Math.sqrt(d2), f = 140 * dt; this.mvx[i] += (dx / d * 0.35 - dy / d) * f; this.mvy[i] += (dy / d * 0.35 + dx / d) * f; }
        }
        if (this.rng() < dt * 1.5 && this.mn < this.moteTarget * 1.3) { const a = this.rng() * TAU; this.addMote(h.x + Math.cos(a) * h.r * 0.8, h.y + Math.sin(a) * h.r * 0.8, this.mval() * 2.2, 2); }
      } else if (h.type === "void") {
        for (const s of sw) if (dist2(s.x, s.y, h.x, h.y) < (h.r + s.reff * 0.4) ** 2) this.hazardDmg(s, 0.09, dt);
      } else if (h.type === "eel") this.updateEel(h, dt, sw);
    }
    // течения океана
    if (this.bkey === "ocean" || this.hazardsHas("ocean")) {
      for (const s of sw) { const a = this.noise.fbm(s.x / 1400 + 5, s.y / 1400 + 5, 2) * TAU * 2; s.vx += Math.cos(a) * 120 * dt * (1 - s.comp * 0.6); s.vy += Math.sin(a) * 120 * dt * (1 - s.comp * 0.6); }
      for (let i = 0; i < this.mn; i += 3) { const a = this.noise.fbm(this.mx[i] / 1400 + 5, this.my[i] / 1400 + 5, 2) * TAU * 2; this.mvx[i] += Math.cos(a) * 30 * dt * 3; this.mvy[i] += Math.sin(a) * 30 * dt * 3; }
    }
    // хвост кометы
    const cm = this.mutLevels.comet || 0, P = this.player;
    if (cm && P && P.alive) {
      P.emberT = (P.emberT || 0) - dt;
      if (P.emberT <= 0 && Math.hypot(P.vx, P.vy) > 60) { P.emberT = 0.09; this.embers.push({ x: P.x - P.vx * 0.15, y: P.y - P.vy * 0.15, life: 1.6 + cm * 0.6, r: Math.max(40, P.r * 0.5) }); }
      for (const e of this.embers) {
        e.life -= dt;
        for (const s of sw) if (!s.player && dist2(s.x, s.y, e.x, e.y) < (e.r + s.reff * 0.6) ** 2) { s.n -= (s.n * 0.06 * cm + 2) * dt; s.lastHit = P; P.n += 1.2 * cm * dt; }
      }
      this.embers = this.embers.filter(e => e.life > 0);
    }
  }

  updateEel(h, dt, sw) {
    if (h.stun > 0) { h.stun -= dt; h.vx *= 1 - dt * 2; h.vy *= 1 - dt * 2; }
    else {
      // цель — крупнейший рой рядом
      let best = null, bs = 0;
      for (const s of sw) { if (s.spawnT > 0 || s.boss) continue; const d = Math.hypot(s.x - h.x, s.y - h.y); if (d < 1500) { const sc = s.n / (d + 300); if (sc > bs) { bs = sc; best = s; } } }
      let tx, ty;
      if (best) { tx = best.x; ty = best.y; }
      else { h.wander = (h.wander || 0) + dt * 0.4; tx = Math.cos(h.wander) * this.R * 0.5; ty = Math.sin(h.wander * 1.3) * this.R * 0.5; }
      const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1, sp = 215 + this.L * 2;
      h.vx += (dx / d * sp - h.vx) * Math.min(1, dt * 1.8); h.vy += (dy / d * sp - h.vy) * Math.min(1, dt * 1.8);
    }
    h.x += h.vx * dt; h.y += h.vy * dt;
    const dc = Math.hypot(h.x, h.y); if (dc > this.R * 0.95) { h.x *= this.R * 0.95 / dc; h.y *= this.R * 0.95 / dc; }
    // сегменты тянутся за головой
    let px = h.x, py = h.y;
    for (const sg of h.seg) { const dx = sg.x - px, dy = sg.y - py, d = Math.hypot(dx, dy) || 1, L = 34; sg.x = px + dx / d * L; sg.y = py + dy / d * L; px = sg.x; py = sg.y; }
    if (h.stun > 0) return;
    for (const s of sw) {
      const d = Math.hypot(s.x - h.x, s.y - h.y);
      if (d < h.r + s.reff * 0.8) {
        if (s.comp > 0.6 && s.S > 22) { h.stun = 3.5; h.vx = (h.x - s.x) / d * 500; h.vy = (h.y - s.y) / d * 500; this.burst(h.x, h.y, [1, 0.3, 0.5], 30, 400, 0.8, 12); if (s.player) this.events("eelStun"); break; }
        this.hazardDmg(s, 0.45, dt);
      }
    }
  }

  updateBeacons(dt) {
    const P = this.player; if (!P || !this.beacons.length) return;
    for (const b of this.beacons) {
      b.ping += dt;
      if (b.lit) continue;
      const inZone = P.alive && dist2(P.x, P.y, b.x, b.y) < (b.rad + P.reff * 0.5) ** 2;
      b.contested = false; b.tooSmall = false;
      if (inZone) {
        for (const s of this.swarms) if (!s.player && s.alive && s.n > P.n * 0.35 && dist2(s.x, s.y, b.x, b.y) < (b.rad + s.reff * 0.5) ** 2) b.contested = true;
        if (P.n < b.req) b.tooSmall = true;
        if (!b.contested && !b.tooSmall) {
          const before = b.p; b.p = Math.min(1, b.p + dt / 4.5);
          if (Math.floor(before * 8) !== Math.floor(b.p * 8)) this.events("beaconTick", b.p);
          if (b.p >= 1) {
            b.lit = true; this.burst(b.x, b.y, this.B.edge, 90, 520, 1.4, 15); this.shake = 0.5;
            this.waves.push({ x: b.x, y: b.y, r: 0, max: 900, life: 1.1, col: this.B.edge });
            this.events("beaconLit", this.beacons.filter(q => q.lit).length);
            if (this.beacons.every(q => q.lit)) {
              this.won = true; this.slowmo = 1.2; this.events("win");
              const P = this.player; this.waves.push({ x: P.x, y: P.y, r: 0, max: this.R * 1.4, life: 1.8, col: this.B.edge });
              for (let k = 0; k < 6; k++) this.burst(P.x, P.y, hsl(this.B.hue + k * 50, 90, 65), 30, 700, 1.6, 16);
            }
          }
        }
      } else b.p = Math.max(0, b.p - dt * 0.04);
      b.inZone = inZone;
    }
  }

  updateEffects(dt) {
    for (let i = this.fn - 1; i >= 0; i--) {
      this.fl[i] -= dt;
      if (this.fl[i] <= 0) {
        const j = --this.fn;
        this.fx_[i] = this.fx_[j]; this.fy[i] = this.fy[j]; this.fvx[i] = this.fvx[j]; this.fvy[i] = this.fvy[j]; this.fl[i] = this.fl[j]; this.fml[i] = this.fml[j];
        this.fr[i] = this.fr[j]; this.fg[i] = this.fg[j]; this.fb[i] = this.fb[j]; this.fs[i] = this.fs[j]; continue;
      }
      this.fx_[i] += this.fvx[i] * dt; this.fy[i] += this.fvy[i] * dt; this.fvx[i] *= 1 - dt * 2.5; this.fvy[i] *= 1 - dt * 2.5;
    }
    for (const w of this.waves) { w.life -= dt; w.r += (w.max - w.r) * Math.min(1, dt * 5); }
    this.waves = this.waves.filter(w => w.life > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.8);
  }

  mutOptions() {
    const pool = MUTATIONS.filter(m => (this.mutLevels[m.id] || 0) < m.max);
    const out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  applyMutation(id) { this.mutLevels[id] = (this.mutLevels[id] || 0) + 1; if (this.player) { this.player.invul = 1; this.burst(this.player.x, this.player.y, [1, 1, 0.8], 50, 300, 0.8, 12); } }

  revive() {
    const P = this.player; P.alive = true; P.n = Math.max(P.base.startN, this.peak * 0.5); P.invul = 2.5; P.stamina = 1; this.over = false;
    // отодвинуть врагов
    for (const s of this.swarms) if (!s.player && s.alive && dist2(s.x, s.y, P.x, P.y) < (P.r * 3 + 600) ** 2) { const d = Math.hypot(s.x - P.x, s.y - P.y) || 1; s.x += (s.x - P.x) / d * 700; s.y += (s.y - P.y) / d * 700; }
    for (let i = 0; i < P.targetVis(); i++) P.addParticle(P.x + (Math.random() - 0.5) * 40, P.y + (Math.random() - 0.5) * 40);
    this.burst(P.x, P.y, P.color, 80, 400, 1, 13);
  }

  updateCamera(dt) {
    const c = this.cam, minD = Math.min(window.innerWidth, window.innerHeight);
    let tx, ty, V;
    if (this.player) {
      const P = this.player;
      tx = P.x + P.vx * 0.25; ty = P.y + P.vy * 0.25; V = Math.max(440, P.r * 3.6);
      ty += this.camOffY / Math.max(0.05, c.scale);
    } else { tx = Math.cos(this.t * 0.05) * this.R * 0.4; ty = Math.sin(this.t * 0.04) * this.R * 0.4; V = 900; }
    if (this.bkey === "dark" || this.hazardsHas("dark")) V *= 0.9;
    c.x += (tx - c.x) * Math.min(1, dt * 3); c.y += (ty - c.y) * Math.min(1, dt * 3);
    const ts = (minD / 2) / V; c.scale += (ts - c.scale) * Math.min(1, dt * 1.5);
  }

  /* ---------- отрисовка ---------- */
  draw() {
    const c = this.cam, t = this.t, Rn = Render, P = this.player;
    let sx = 0, sy = 0; if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake * 26 / c.scale; sy = (Math.random() - 0.5) * this.shake * 26 / c.scale; }
    Rn.cam.x = c.x + sx; Rn.cam.y = c.y + sy; Rn.cam.scale = c.scale;
    Object.assign(Rn.bg, { R: this.R, edge: this.B.edge, t });
    const dark = (this.bkey === "dark" || this.hazardsHas("dark")) && !!P;
    Rn.bg.dark = dark ? 1 : 0;
    if (dark && P) { Rn.bg.lx = P.x; Rn.bg.ly = P.y; Rn.bg.lightR = P.r * 2.8 + 420; }
    Rn.begin();
    const vw = window.innerWidth / c.scale / 2 + 200, vh = window.innerHeight / c.scale / 2 + 200;
    const on = (x, y, m) => Math.abs(x - c.x) < vw + (m || 0) && Math.abs(y - c.y) < vh + (m || 0);
    const lightVis = (x, y) => !dark || !P || dist2(x, y, P.x, P.y) < (P.r * 2.8 + 520) ** 2;
    const zoomK = clamp(0.55 / c.scale, 1, 6);  // мелочь крупнее при отдалении
    // источники
    const mc = hsl(this.B.mote, 90, 65);
    for (const s of this.sources) {
      if (!on(s.x, s.y, 200)) continue;
      const p = 0.6 + 0.4 * Math.sin(t * 2 + s.ph);
      Rn.quad(s.x, s.y, 90 * zoomK, mc[0], mc[1], mc[2], 0.16 * p, 0);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + t * 0.4 + s.ph; Rn.point(s.x + Math.cos(a) * 30, s.y + Math.sin(a) * 30, 22 * zoomK, mc[0], mc[1], mc[2], 0.35); }
      Rn.point(s.x, s.y, 26 * zoomK, 1, 1, 0.9, 0.45);
    }
    // опасности
    for (const h of this.hazards) this.drawHazard(h, on, t, zoomK);
    // маяки
    for (const b of this.beacons) {
      if (!on(b.x, b.y, 600)) continue;
      const e = this.B.edge, pul = 0.5 + 0.5 * Math.sin(t * 3);
      if (b.lit) {
        Rn.quad(b.x, b.y, b.rad * 1.6, e[0], e[1], e[2], 0.35, 0);
        Rn.quad(b.x, b.y, b.rad, e[0], e[1], e[2], 0.8, 1, 0.08);
        for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + t; Rn.point(b.x + Math.cos(a) * b.rad * 0.6, b.y + Math.sin(a) * b.rad * 0.6, 22, e[0], e[1], e[2], 0.9); }
        Rn.point(b.x, b.y, 90, 1, 1, 1, 1);
      } else {
        const col = b.contested ? [1, 0.3, 0.3] : b.tooSmall && b.inZone ? [1, 0.7, 0.3] : e;
        Rn.quad(b.x, b.y, b.rad, col[0], col[1], col[2], 0.35 + pul * 0.15, 2);
        Rn.quad(b.x, b.y, b.rad * 0.55, e[0], e[1], e[2], 0.9, 3, b.p);
        Rn.point(b.x, b.y, 40 + b.p * 50, e[0], e[1], e[2], 0.5 + b.p * 0.5);
        const ps = (b.ping % 2.2) / 2.2; Rn.quad(b.x, b.y, b.rad * (0.3 + ps * 1.2), e[0], e[1], e[2], 0.35 * (1 - ps), 1, 0.05);
      }
    }
    // свет
    for (let i = 0; i < this.mn; i++) {
      const x = this.mx[i], y = this.my[i]; if (!on(x, y) || !lightVis(x, y)) continue;
      const tp = this.mt[i], p = 0.7 + 0.3 * Math.sin(t * 3 + this.mph[i]);
      const s = (tp === 2 ? 15 : 11) * zoomK * (0.8 + Math.min(1.2, this.mv[i] / (this.moteVal * 4)) * 0.3);
      if (tp === 1) Rn.point(x, y, s * 1.3, 1, 0.45, 0.08, p);
      else if (tp === 2) Rn.point(x, y, s, 1, 0.95, 0.75, p);
      else Rn.point(x, y, s, mc[0], mc[1], mc[2], p * 0.9);
    }
    // угли кометы
    for (const e of this.embers) { if (!on(e.x, e.y, 100)) continue; const a = e.life / 2; Rn.quad(e.x, e.y, e.r, 1, 0.5, 0.15, 0.35 * a, 0); Rn.point(e.x, e.y, 24, 1, 0.7, 0.3, a); }
    // рои
    for (const s of this.swarms) {
      if (!s.alive || !on(s.x, s.y, s.r * 2)) continue;
      if (!s.player && !lightVis(s.x, s.y)) { continue; }
      const col = s.color, glow = 0.08 + s.comp * 0.1;
      Rn.quad(s.x, s.y, s.r * 1.5, col[0], col[1], col[2], glow, 0);
      if (!s.player && P && P.alive) {
        const ratio = s.S / Math.max(1, Math.sqrt(P.n) * this.dmgMul(P));
        if (ratio > 1.1) Rn.quad(s.x, s.y, s.reff * 1.25 + 20, 1, 0.2, 0.25, 0.45, 1, 0.05);
        else if (ratio < 0.7) Rn.quad(s.x, s.y, s.reff * 1.25 + 20, 0.3, 1, 0.5, 0.22, 1, 0.05);
      }
      if (s.invul > 0 && this.mode !== "menu") Rn.quad(s.x, s.y, s.r * 1.35, 1, 1, 1, 0.3 + 0.2 * Math.sin(t * 20), 1, 0.06);
      const base = clamp(s.r * 0.13, 10, 34) * (s.player ? 1.15 : 1);
      const sat = s.vis >= s.cap ? Math.min(2.2, Math.pow(s.n / Math.max(1, Math.pow((s.cap - 6) / 4.2, 1 / 0.72)), 0.25)) : 1;
      const sz = base * sat * (1 - 0.15 * s.comp), re = Math.max(10, s.reff);
      const over = s.vis * sz * sz * 0.35 / (re * re);          // сколько точек перекрывается — гасим пересвет
      const a = (0.85 + s.comp * 0.15) * Math.min(1, 1.1 / Math.sqrt(Math.max(1, over))) * (s.spawnT > 0 ? 1 - s.spawnT : 1);
      const tw = t * 6;
      for (let i = 0; i < s.vis; i++) Rn.point(s.px[i], s.py[i], sz * s.sz[i], s.cr[i], s.cg[i], s.cb[i], a * (0.75 + 0.25 * Math.sin(tw + s.ph[i] * 7)));
      Rn.point(s.x, s.y, s.reff * 0.9, col[0], col[1], col[2], 0.1 + s.comp * 0.2);
    }
    // пылинки переднего плана (параллакс — ощущение глубины)
    const T = 1800 / Math.max(0.25, c.scale * 1.6), dc = this.B.edge;
    for (let i = 0; i < 46; i++) {
      const hx = ((i * 7919) % 1000) / 1000, hy = ((i * 104729) % 1000) / 1000, p = 1.35 + (i % 3) * 0.15;
      let px = (hx * T - c.x * (p - 1)) % T, py = (hy * T - c.y * (p - 1)) % T; if (px < 0) px += T; if (py < 0) py += T;
      const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + (i % 5) * 0.2) + i);
      Rn.point(c.x + px - T / 2, c.y + py - T / 2, (5 + (i % 4) * 3) / Math.max(0.3, c.scale) * 0.45, 0.7 + dc[0] * 0.3, 0.7 + dc[1] * 0.3, 0.7 + dc[2] * 0.3, 0.12 + tw * 0.22);
    }
    // волны
    for (const w of this.waves) Rn.quad(w.x, w.y, Math.max(10, w.r), w.col[0], w.col[1], w.col[2], w.life, 1, 0.06);
    // искры
    for (let i = 0; i < this.fn; i++) {
      const k = this.fl[i] / this.fml[i]; if (!on(this.fx_[i], this.fy[i])) continue;
      Rn.point(this.fx_[i], this.fy[i], this.fs[i] * zoomK * (0.5 + k * 0.5), this.fr[i], this.fg[i], this.fb[i], k);
    }
    Rn.end();
  }

  drawHazard(h, on, t, zk) {
    const Rn = Render;
    if (h.type === "geyser") {
      if (!on(h.x, h.y, h.r)) return;
      Rn.quad(h.x, h.y, h.r * 0.35, 1, 0.35, 0.05, 0.35, 0);
      if (h.state === 1) { const k = 1 - h.t / 1.4; Rn.quad(h.x, h.y, h.r, 1, 0.3, 0.05, 0.5 + 0.5 * Math.sin(t * 25), 2); Rn.quad(h.x, h.y, h.r * k, 1, 0.6, 0.1, 0.8, 1, 0.08); }
      if (h.state === 2) Rn.quad(h.x, h.y, h.r * 1.1, 1, 0.45, 0.08, 0.9, 0);
    } else if (h.type === "crystal") {
      if (h.hp <= 0 || !on(h.x, h.y, 80)) return;
      const p = 0.7 + 0.3 * Math.sin(t * 2 + h.ph);
      Rn.quad(h.x, h.y, h.r * 2, 0.5, 0.85, 1, 0.25 * p, 0);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + h.ph; Rn.point(h.x + Math.cos(a) * h.r * 0.5, h.y + Math.sin(a) * h.r * 0.5, h.r * 0.7, 0.6, 0.9, 1, 0.7); }
      Rn.point(h.x, h.y, h.r * 1.2, 0.9, 0.98, 1, 0.9);
    } else if (h.type === "storm") {
      if (!on(h.x, h.y, h.r)) return;
      Rn.quad(h.x, h.y, h.r, 1, 0.7, 0.3, 0.25, 2);
      for (let k = 0; k < 24; k++) { const a = k / 24 * TAU + t * 2.2, rr = h.r * (0.3 + 0.7 * ((k * 37) % 10) / 10); Rn.point(h.x + Math.cos(a + rr / 200) * rr, h.y + Math.sin(a + rr / 200) * rr, 24, 1, 0.75, 0.35, 0.45); }
    } else if (h.type === "well") {
      if (!on(h.x, h.y, h.r)) return;
      Rn.quad(h.x, h.y, h.r, 1, 0.4, 0.85, 0.12, 0);
      Rn.quad(h.x, h.y, h.core * 1.4, 1, 0.3, 0.8, 0.8, 1, 0.15);
      for (let k = 0; k < 30; k++) { const rr = h.r * ((k * 0.618 + t * 0.12) % 1), a = k * 2.4 + t * (900 / (rr + 120)); Rn.point(h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr, 12, 1, 0.5, 0.9, 0.6 * (rr / h.r)); }
    } else if (h.type === "void") {
      if (!on(h.x, h.y, h.r)) return;
      Rn.quad(h.x, h.y, h.r, 0.45, 0.2, 0.75, 0.55, 2);
      for (let k = 0; k < 16; k++) { const a = k / 16 * TAU - t * 0.6, rr = h.r * (1 - ((t * 0.3 + k / 16) % 1)); Rn.point(h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr, 16, 0.6, 0.3, 1, 0.6); }
    } else if (h.type === "eel") {
      if (!on(h.x, h.y, 700)) return;
      const st = h.stun > 0, c = st ? [0.6, 0.6, 0.7] : [1, 0.15, 0.4];
      h.seg.forEach((sg, i) => { const k = 1 - i / h.seg.length; Rn.point(sg.x, sg.y, 70 * (0.35 + k * 0.65), c[0], c[1] * (0.5 + k), c[2], 0.85); });
      Rn.quad(h.x, h.y, 150, c[0], c[1], c[2], 0.35, 0);
      Rn.point(h.x, h.y, 95, 1, 0.5, 0.6, 1);
      const a = Math.atan2(h.vy, h.vx);
      for (const sd of [-1, 1]) Rn.point(h.x + Math.cos(a + sd * 0.6) * 26, h.y + Math.sin(a + sd * 0.6) * 26, 22, 1, 1, st ? 1 : 0.6, 1);
      if (!st) Rn.quad(h.x, h.y, h.r * 1.9, 1, 0.1, 0.3, 0.3 + 0.2 * Math.sin(t * 8), 1, 0.06);
    }
  }
}
