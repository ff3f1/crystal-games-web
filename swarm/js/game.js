"use strict";
/* ===== Игра: сохранение, экраны, управление, HUD, награды ===== */

const $ = id => document.getElementById(id);

/* ---------- Интерфейс ---------- */
const UI = {
  toast(t, ms) { const e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(this._tt); this._tt = setTimeout(() => e.classList.remove("on"), ms || 2200); },
  open(id) { $(id).classList.add("on"); },
  close(id) { $(id).classList.remove("on"); },
  banner(t, col) { const b = $("banner"); b.textContent = t; b.style.color = col || "#fff"; b.classList.remove("on"); void b.offsetWidth; b.classList.add("on"); },
  float(x, y, t, col) {
    const e = document.createElement("div"); e.className = "float"; e.textContent = t; e.style.left = x + "px"; e.style.top = y + "px"; e.style.color = col || "#fff";
    document.body.appendChild(e); setTimeout(() => e.remove(), 1150);
  },
  msg(html, buttons) {
    const c = $("msgCard"); c.innerHTML = html + '<div class="col" id="msgBtns"></div>';
    const bx = $("msgBtns");
    (buttons || [{ t: "Отлично", cls: "" }]).forEach(b => {
      const el = document.createElement("button"); el.className = "btn " + (b.cls || ""); el.textContent = b.t;
      el.onclick = () => { Sound.click(); UI.close("ovMsg"); b.fn && b.fn(); }; bx.appendChild(el);
    });
    UI.open("ovMsg");
  }
};
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => { Sound.click(); b.closest(".ov").classList.remove("on"); Game.refreshMenu(); });

/* ---------- Сохранение ---------- */
const LOGIN = [{ l: 100 }, { l: 150 }, { sh: 3 }, { l: 250 }, { l: 300 }, { sh: 5 }, { l: 500, sh: 5 }];
const QUESTS = [
  { id: "motes", t: g => `Собери ${fmt(g)} света`, goal: p => Math.round(1500 * (1 + p * 0.25) / 100) * 100, r: 80 },
  { id: "kills", t: g => `Победи ${g} ${plural(g, "рой", "роя", "роёв")}`, goal: () => 8, r: 90 },
  { id: "compkills", t: g => `Победи ${g} ${plural(g, "рой", "роя", "роёв")} в сжатии`, goal: () => 3, r: 110 },
  { id: "capture", t: () => "Захвати планету", goal: () => 1, r: 120 },
  { id: "peak", t: g => `Вырасти до ${fmt(g)} светлячков`, goal: p => reqForLevel(Math.max(0, p - 1))[2] * 2, r: 100 },
  { id: "daily", t: () => "Сыграй планету дня", goal: () => 1, r: 90 },
  { id: "endless", t: () => "Сыграй бесконечный режим", goal: () => 1, r: 80 },
  { id: "beacons", t: g => `Зажги ${g} ${plural(g, "маяк", "маяка", "маяков")}`, goal: () => 6, r: 90 }
];

const Save = {
  d: null,
  defaults() {
    return {
      v: 1, gseed: Math.floor(Math.random() * 1e9), light: 0, upg: { start: 0, speed: 0, magnet: 0, power: 0, stamina: 0 },
      st: { collector: 0, storage: 0 }, captured: {}, prog: 0, species: [0], cur: 0, shards: 0, energyT: Date.now(),
      bestEndless: 0, daily: { day: 0, best: 0 }, quests: { day: 0, list: [] }, login: { day: 0, streak: 0, claimed: 0 }, chest: { day: 0, n: 0 },
      stats: { runs: 0, kills: 0, time: 0 }, tut: 0, set: { sound: true, music: true, vibro: true, q: -1 }, invited: false
    };
  },
  load() {
    const d = Store.get("save", null);
    this.d = Object.assign(this.defaults(), d || {});
    for (const k of ["upg", "st", "set", "daily", "quests", "login", "chest", "stats"]) this.d[k] = Object.assign(this.defaults()[k], (d || {})[k] || {});
  },
  merge(cloud) { // облако VK: берём то, где больше прогресса
    if (!cloud || !cloud.v) return;
    const score = s => (s.prog || 0) * 1e6 + (s.light || 0);
    if (score(cloud) > score(this.d)) { this.d = Object.assign(this.defaults(), cloud); this.save(true); }
  },
  save(noCloud) {
    Store.set("save", this.d);
    if (!noCloud) { clearTimeout(this._ct); this._ct = setTimeout(() => Platform.cloudSave(this.d), 1500); }
  }
};

/* ---------- Игра ---------- */
const Game = (function () {
  let state = "boot", world = null, menuWorld = null, run = null, last = 0, fpsAcc = [], hudT = 0;
  const input = { dx: 0, dy: 0, mag: 0, compress: false };
  const ptr = { steer: null, sx: 0, sy: 0, comp: new Set(), mouse: false, mx: 0, my: 0, keys: {} };
  const S = () => Save.d;

  /* --- качество графики --- */
  function guessQuality() {
    const q = S().set.q; if (q >= 0) return q;
    const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4, mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (mem <= 2 || cores <= 4) return 0;
    if (mobile) return 1;
    return 2;
  }

  /* --- параметры игрока --- */
  function playerCfg() {
    const d = S(), sp = SPECIES[d.cur] || SPECIES[0];
    return {
      startN: startSize(d.upg.start), hue: sp.hue, spread: sp.spread, mods: {}, eff: sp.eff,
      speedUp: d.upg.speed * 0.06, powerUp: d.upg.power * 0.08, magnetUp: d.upg.magnet * 0.06, staminaUp: d.upg.stamina * 0.1, valueMul: 1
    };
  }

  /* --- энергия галактики --- */
  function energyRate() { let r = 0; for (const L in S().captured) r += planetIncome(+L); return r * (1 + S().st.collector * 0.25); }
  function energyCap() { return energyRate() * (4 + S().st.storage * 2); }
  function energyNow() { const r = energyRate(); if (!r) return 0; return Math.min(energyCap(), r * (Date.now() - S().energyT) / 3600e3); }

  /* --- ежедневное --- */
  function dailyRefresh() {
    const d = S(), today = todayKey();
    if (d.quests.day !== today) {
      const pool = QUESTS.slice(), list = [];
      while (list.length < 3) { const q = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; list.push({ id: q.id, goal: q.goal(d.prog), p: 0, claimed: false }); }
      d.quests = { day: today, list };
    }
    if (d.login.day !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yk = y.getFullYear() * 10000 + (y.getMonth() + 1) * 100 + y.getDate();
      d.login.streak = d.login.day === yk ? d.login.streak + 1 : 1; d.login.day = today; d.login.claimed = 0;
    }
    if (d.chest.day !== today) d.chest = { day: today, n: 0 };
    Save.save();
  }
  function questAdd(id, v, abs) {
    for (const q of S().quests.list) if (q.id === id && !q.claimed) { q.p = abs ? Math.max(q.p, v) : q.p + v; }
  }
  function grantLogin() {
    const d = S(); if (d.login.claimed) return;
    const r = LOGIN[(d.login.streak - 1) % 7]; d.login.claimed = 1;
    if (r.l) d.light += r.l; if (r.sh) addShards(r.sh, true);
    Save.save();
    UI.msg(`<h2>День ${((d.login.streak - 1) % 7) + 1}</h2><p>Награда за вход</p><div class="big">${r.l ? "✦ " + r.l : ""}${r.l && r.sh ? " · " : ""}${r.sh ? "◆ " + r.sh : ""}</div><p>${r.sh ? "Осколки открывают новые виды роя" : "Заходи завтра — награда больше"}</p>`);
  }
  function addShards(n, silent) {
    const d = S(); d.shards += n; let unlocked = null;
    while (d.shards >= 10) {
      const nx = SPECIES.findIndex((_, i) => !d.species.includes(i));
      if (nx < 0) { d.shards = 10; break; }
      d.shards -= 10; d.species.push(nx); unlocked = nx;
    }
    Save.save();
    if (unlocked != null && !silent) UI.toast("Новый вид роя: " + SPECIES[unlocked].name + "!", 3000);
    return unlocked;
  }

  /* --- меню --- */
  function refreshMenu() {
    const d = S();
    document.querySelectorAll(".lightv").forEach(e => e.textContent = fmt(d.light));
    const q = d.quests.list.some(q => q.p >= q.goal && !q.claimed) || d.chest.n === 0;
    $("qBadge").style.display = q ? "block" : "none";
    $("dailyBadge").style.display = d.daily.day !== todayKey() ? "block" : "none";
    const canBuy = UPGRADES.some(u => d.upg[u.id] < UPG_MAX && d.light >= upgCost(u, d.upg[u.id]));
    $("shopBadge").style.display = canBuy ? "block" : "none";
    $("socialRow").style.display = Platform.social ? "flex" : (navigator.share ? "flex" : "none");
    $("bInvite").style.display = Platform.social ? "" : "none";
    updateEnergyBox();
  }
  function updateEnergyBox() {
    const r = energyRate(), now = energyNow(), cap = energyCap();
    $("energyBox").style.display = r > 0 ? "flex" : "none";
    if (r > 0) { $("enBar").style.width = (now / cap * 100).toFixed(1) + "%"; $("enTxt").textContent = `${fmt(now)} / ${fmt(cap)} · ${fmt(r)}/ч`; $("bCollect").disabled = now < 1; }
  }
  function show(id) { document.querySelectorAll(".scr").forEach(s => s.classList.toggle("on", s.id === id)); }

  function makeMenuWorld() {
    const bk = BIOME_KEYS[Math.floor(Math.random() * 7)];
    const tex = genPlanetTextures(bk, 4242 + Math.floor(Math.random() * 1000), 2400, [384, 512, 640][Render.quality]);
    Render.setTextures(tex.floor, tex.neb);
    menuWorld = new World({ mode: "menu", biome: bk, seed: 77 + Math.floor(Math.random() * 999), R: 2400, level: 3, bots: 9, onEvent: () => { } });
    for (let i = 0; i < 120; i++) menuWorld.update(1 / 30, input);
    Sound.setMood(BIOMES[bk].i);
  }
  function goMenu() {
    state = "menu"; world = null; Galaxy.hide(); show("menu"); refreshMenu(); Platform.gameplay(false);
    if (!menuWorld) makeMenuWorld();
    else { const tex = genPlanetTextures(menuWorld.bkey, 4242, 2400, [384, 512, 640][Render.quality]); Render.setTextures(tex.floor, tex.neb); }
    dailyRefresh();
    if (!S().login.claimed && S().tut >= 1) setTimeout(grantLogin, 400);
  }

  function goGalaxy() {
    state = "galaxy"; show("galaxy"); refreshMenu();
    Galaxy.show(S(), openPlanet, (v, s) => {
      if (v === "galaxy") { $("gName").textContent = "Твоя галактика"; $("gSub").textContent = "Каждая галактика уникальна"; }
      else { $("gName").textContent = "Система «" + SYSTEMS[s].name + "»"; $("gSub").textContent = BIOMES[SYSTEMS[s].biome].name; }
    });
  }

  function openPlanet(info, st) {
    const B = BIOMES[info.biome], spr = Galaxy.planetSprite(info, 256), req = info.req;
    const income = planetIncome(info.L);
    $("planetCard").innerHTML = `<canvas class="pcv" id="pcv" width="256" height="256"></canvas>
      <h2>${info.name}</h2><p>${B.name}. ${B.desc}</p>
      <div class="tags">${info.boss ? `<span class="tag">Цель: <b>победить владыку системы</b></span>` : `<span class="tag">Маяки: <b>${req.map(fmt).join(" · ")}</b> светлячков</span>`}
      <span class="tag">Доход: <b>✦ ${income}/ч</b></span>${st === "done" ? '<span class="tag"><b>✓ захвачена</b></span>' : ""}</div>
      ${info.boss ? `<p>Награда: новый вид роя «${SPECIES[Math.min(8, info.s + 1)].name}»</p>` : ""}
      <div class="col"><button class="btn" id="bLand">${st === "done" ? "Высадиться снова" : "Высадка"}</button><button class="btn ghost small" data-close>Назад</button></div>`;
    $("pcv").getContext("2d").drawImage(spr, 0, 0);
    $("planetCard").querySelector("[data-close]").onclick = () => UI.close("ovPlanet");
    $("bLand").onclick = () => { Sound.click(); UI.close("ovPlanet"); startRun({ mode: info.boss ? "boss" : "campaign", info }); };
    UI.open("ovPlanet");
  }

  /* --- забег --- */
  function startRun(o) {
    Sound.ensure();
    $("loadTxt").textContent = o.mode === "endless" ? "Открываем бесконечный простор…" : o.mode === "daily" ? "Летим к планете дня…" : "Высадка на планету…";
    $("loading").classList.add("on");
    setTimeout(() => buildRun(o), 60);
  }
  function buildRun(o) {
    const d = S(); let biome, seed, L, R, req, hazards = null, bots = null;
    if (o.mode === "campaign" || o.mode === "boss") { biome = o.info.biome; seed = o.info.seed; L = o.info.L; R = o.info.boss ? 2300 : 2200 + Math.min(1000, L * 30); req = o.info.req; }
    else if (o.mode === "daily") {
      const k = todayKey(), r = mulberry32(k); biome = BIOME_KEYS[Math.floor(r() * 7)]; seed = k; L = clamp(d.prog, 2, 30); R = 2900;
      hazards = [biome, BIOME_KEYS[Math.floor(r() * 7)]]; bots = 8; req = reqForLevel(L);
    } else {
      const open = Math.max(1, Math.min(7, Math.floor(d.prog / PLANETS_PER_SYS) + 1));
      biome = BIOME_KEYS[Math.floor(Math.random() * open)]; seed = Math.floor(Math.random() * 1e9); L = Math.max(3, d.prog); R = 3600;
      hazards = [biome, BIOME_KEYS[Math.floor(Math.random() * open)]]; bots = 9; req = reqForLevel(L);
    }
    const size = Math.min(1280, Math.round([512, 704, 960][Render.quality] * clamp(R / 2400, 1, 1.5) / 32) * 32);
    const tex = genPlanetTextures(biome, seed, R, size);
    Render.setTextures(tex.floor, tex.neb);
    Sound.setMood(BIOMES[biome].i);
    world = new World({ mode: o.mode, biome, seed, R, level: L, req, hazards, bots, player: playerCfg(), onEvent: onEvent });
    run = { o, L, biome, t: 0, revived: false, doubled: false, ended: false, tut: d.tut < 1, hurtT: 0, lastAbsorb: 0, timer: o.mode === "daily" ? 180 : 0, fps: [] };
    menuWorld = menuWorld; // меню-мир сохраняем
    buildHud();
    show("hud"); Galaxy.hide();
    state = "run"; $("loading").classList.remove("on");
    Platform.gameplay(true);
    if (run.tut) hint(/Android|iPhone|iPad|Mobi/i.test(navigator.userAgent) ? "Веди пальцем — рой летит следом" : "Веди мышью — рой летит следом", 4000);
    else if (o.mode === "boss") UI.banner("Победи владыку!", "#ff8fa8");
    else if (o.mode === "campaign") UI.banner(o.info.name, "#c8ffe8");
    else if (o.mode === "daily") UI.banner("Планета дня · 3:00", "#ffd76a");
    else UI.banner("Бесконечный рой", "#c8ffe8");
  }

  let hintT = null;
  function hint(t, ms) { const h = $("hint"); h.textContent = t; h.classList.add("on"); clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove("on"), ms || 3000); }

  function buildHud() {
    const g = $("hGoals"); g.innerHTML = "";
    if (world.beacons.length) world.beacons.forEach((b, i) => {
      const el = document.createElement("div"); el.className = "bc"; el.id = "bc" + i;
      el.innerHTML = `<svg viewBox="0 0 38 38"><circle cx="19" cy="19" r="16" fill="rgba(10,8,25,.6)" stroke="rgba(255,255,255,.15)" stroke-width="3"/><circle class="pr" cx="19" cy="19" r="16" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="100.5" stroke-dashoffset="100.5"/></svg><span>${fmtShort(b.req)}</span>`;
      g.appendChild(el);
    });
    $("hBoss").style.display = world.mode === "boss" ? "block" : "none";
    $("hTimer").style.display = world.mode === "daily" ? "block" : "none";
    $("hMuts").innerHTML = "";
    const ar = $("arrows"); ar.innerHTML = "";
    for (let i = 0; i < 4; i++) { const a = document.createElement("div"); a.className = "arrow"; a.textContent = "➤"; ar.appendChild(a); }
    const lb = $("labels"); lb.innerHTML = "";
    for (let i = 0; i < 10; i++) { const a = document.createElement("div"); a.className = "blabel"; lb.appendChild(a); }
  }
  function fmtShort(n) { return n >= 10000 ? Math.round(n / 1000) + "к" : n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "").replace(".", ",") + "к" : String(n); }
  function updateMuts() {
    const h = $("hMuts"); h.innerHTML = "";
    for (const m of MUTATIONS) { const lv = world.mutLevels[m.id]; if (!lv) continue; const e = document.createElement("div"); e.className = "mut"; e.innerHTML = m.icon + (lv > 1 ? `<sup>${lv}</sup>` : ""); h.appendChild(e); }
  }

  function screenOf(x, y) { const c = Render.cam; return [(x - c.x) * c.scale + window.innerWidth / 2, (y - c.y) * c.scale + window.innerHeight / 2]; }

  function updateHud(dt) {
    hudT -= dt; if (hudT > 0) return; hudT = 0.05;
    const P = world.player; if (!P) return;
    const cnt = $("hCount"), v = fmt(P.n); if (cnt.textContent !== v) cnt.textContent = v;
    $("stRing").style.strokeDashoffset = (295.3 * (1 - P.stamina)).toFixed(1);
    $("stRing").style.stroke = P.stamina < 0.2 ? "#ff6b8a" : "#7dffc8";
    world.beacons.forEach((b, i) => {
      const el = $("bc" + i); if (!el) return; const pr = el.querySelector(".pr");
      pr.style.strokeDashoffset = (100.5 * (1 - b.p)).toFixed(1); pr.style.stroke = rgbStr(world.B.edge, 1);
      el.classList.toggle("lit", b.lit); el.style.background = b.lit ? rgbStr(world.B.edge, 1) : ""; el.style.color = b.lit ? "#06121a" : P.n >= b.req ? "#fff" : "";
      if (b.lit) el.querySelector("span").textContent = "✓";
    });
    if (world.mode === "boss") { const B = world.boss; $("hBossBar").style.width = (B ? clamp(B.n / B.maxN, 0, 1) * 100 : 0) + "%"; }
    if (run.timer) { const s = Math.max(0, Math.ceil(run.timer)); $("hTimer").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
    // стрелки к целям
    const W = window.innerWidth, H = window.innerHeight, arrows = $("arrows").children;
    const targets = world.beacons.filter(b => !b.lit).map(b => ({ x: b.x, y: b.y, col: rgbStr(world.B.edge, 1) }));
    if (world.boss) targets.push({ x: world.boss.x, y: world.boss.y, col: "#ff6b8a" });
    for (let i = 0; i < arrows.length; i++) {
      const a = arrows[i], t = targets[i];
      if (!t) { a.style.display = "none"; continue; }
      const [sx, sy] = screenOf(t.x, t.y), m = 40;
      if (sx > m && sx < W - m && sy > m + 60 && sy < H - m) { a.style.display = "none"; continue; }
      const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy, k = Math.min((W / 2 - m) / Math.abs(dx || 1), (H / 2 - m - 30) / Math.abs(dy || 1));
      a.style.display = "flex"; a.style.left = (cx + dx * k) + "px"; a.style.top = (cy + dy * k + 15) + "px";
      a.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`; a.style.color = t.col;
    }
    // числа над роями
    const labels = $("labels").children; let li = 0;
    const PS = Math.sqrt(P.n) * world.dmgMul(P);
    for (const s of world.swarms) {
      if (s.player || !s.alive || li >= labels.length) continue;
      const [sx, sy] = screenOf(s.x, s.y - s.r * 1.1);
      if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) continue;
      if (world.bkey === "dark" && dist2(s.x, s.y, P.x, P.y) > (P.r * 2.8 + 520) ** 2) continue;
      const e = labels[li++], ratio = s.S / Math.max(1, PS);
      e.style.display = "block"; e.style.left = sx + "px"; e.style.top = sy + "px";
      e.textContent = (s.boss ? "👑 " : "") + fmtShort(Math.round(s.n));
      e.style.color = ratio > 1.1 ? "#ff8fa8" : ratio < 0.7 ? "#8dffc0" : "#fff";
    }
    for (; li < labels.length; li++) labels[li].style.display = "none";
    // подсказки по маякам
    for (const b of world.beacons) if (b.inZone && !b.lit) {
      if (b.tooSmall) hint(`Маяку нужно ${fmt(b.req)} светлячков`, 600);
      else if (b.contested) hint("Вытесни врагов с маяка!", 600);
    }
    run.hurtT = Math.max(0, run.hurtT - 0.05);
    $("vign").style.boxShadow = `inset 0 0 ${80 + run.hurtT * 120}px rgba(255,40,80,${(run.hurtT * 0.55).toFixed(2)})`;
  }

  /* --- события мира --- */
  function onEvent(type, data) {
    if (!run) return;
    const P = world.player;
    switch (type) {
      case "absorb": Sound.chime(); questAdd("motes", data.v); break;
      case "fight": Sound.crackle(Math.min(0.5, data * 0.05)); break;
      case "kill": {
        Sound.pop(data.n > 200 || data.boss);
        if (S().set.vibro) Platform.vibrate(data.boss ? [60, 40, 120] : 25);
        const [sx, sy] = screenOf(P.x, P.y - P.r);
        UI.float(sx, sy, (data.comp ? "Копьём! " : "") + "+" + fmtShort(Math.round(data.n * 0.6)), data.comp ? "#ffd76a" : "#8dffc0");
        questAdd("kills", 1); if (data.comp) questAdd("compkills", 1);
        if (data.boss) UI.banner("Владыка повержен!", "#ffd76a");
        break;
      }
      case "hurt": run.hurtT = Math.min(1, run.hurtT + 0.08); break;
      case "dead": onDead(); break;
      case "beaconTick": Sound.beacon(data); break;
      case "beaconLit": Sound.beaconLit(); questAdd("beacons", 1); UI.banner(data < 3 ? `Маяк зажжён · ${data}/3` : "Все маяки горят!", rgbStr(world.B.edge, 1)); if (S().set.vibro) Platform.vibrate(40); break;
      case "win": Sound.win(); setTimeout(() => endRun(true), 1900); break;
      case "mutation": showMutation(data); break;
      case "compress": Sound.compressOn(data); $("compBtn").classList.toggle("on", data); if (data && run.tut && run.tutStep === 1) { run.tutStep = 2; hint("Отлично! Красные рои сильнее, зелёные — добыча", 4000); } break;
      case "nova": Sound.pop(true); break;
      case "geyserWarn": Sound.warn(); break;
      case "crystal": Sound.pop(false); hint("Кристалл разбит!", 1200); break;
      case "eelStun": UI.toast("Пожиратель оглушён!"); break;
      case "warn": UI.banner(data, "#ff8fa8"); Sound.warn(); break;
    }
  }

  function showMutation(opts) {
    if (!run || run.ended || state !== "run" || !opts.length) return;
    state = "mut"; Sound.mutation(); Sound.compressOn(false); input.compress = false;
    const box = $("mOpts"); box.innerHTML = "";
    opts.forEach(m => {
      const lv = (world.mutLevels[m.id] || 0) + 1;
      const e = document.createElement("div"); e.className = "mopt";
      e.innerHTML = `<div class="ic">${m.icon}</div><div><b>${m.name} <em>${lv > 1 ? "ур. " + lv : "новое"}</em></b><span>${m.desc}</span></div>`;
      e.onclick = () => { Sound.click(); world.applyMutation(m.id); updateMuts(); UI.close("ovMut"); state = "run"; last = performance.now(); };
      box.appendChild(e);
    });
    $("mReroll").style.display = run.rerolled ? "none" : "";
    $("mReroll").onclick = async () => { const ok = await Platform.rewarded(); if (ok) { run.rerolled = true; showMutation(world.mutOptions()); } else UI.toast("Реклама сейчас недоступна"); };
    UI.open("ovMut");
  }

  function onDead() {
    Sound.compressOn(false); Sound.lose();
    if (S().set.vibro) Platform.vibrate([80, 60, 80]);
    if (!run.revived && world.peak > 40) {
      setTimeout(() => { if (!run || run.ended) return; state = "revive"; UI.open("ovRevive"); }, 900);
    } else setTimeout(() => endRun(false), 1200);
  }
  $("rvAd").onclick = async () => {
    const ok = await Platform.rewarded();
    UI.close("ovRevive");
    if (ok) { run.revived = true; world.revive(); state = "run"; last = performance.now(); UI.banner("Рой возрождён!", "#8dffc0"); }
    else { UI.toast("Реклама сейчас недоступна"); endRun(false); }
  };
  $("rvNo").onclick = () => { UI.close("ovRevive"); endRun(false); };

  function endRun(win) {
    if (!run || run.ended) return; run.ended = true; state = "result"; Platform.gameplay(false);
    Sound.compressOn(false);
    const d = S(), o = run.o, peak = Math.round(world.peak), kills = world.statKills;
    let light = Math.round(peak * 0.09 + kills * 4), extra = "", title = win ? "Планета захвачена!" : "Рой погас";
    d.stats.runs++; d.stats.kills += kills; d.stats.time += run.t;
    questAdd("peak", peak, true);
    if (o.mode === "campaign" || o.mode === "boss") {
      const L = o.info.L, first = !d.captured[L];
      if (win) {
        light += Math.round((first ? 70 : 25) * (1 + L * 0.35));
        if (first) {
          d.captured[L] = true; d.prog = Math.max(d.prog, L + 1); questAdd("capture", 1);
          extra += `<p>Планета приносит <b>✦ ${planetIncome(L)}/ч</b>, пока тебя нет</p>`;
          if (Object.keys(d.captured).length === 1) d.energyT = Date.now();
          if (o.mode === "boss") {
            const sp = Math.min(8, o.info.s + 1);
            if (!d.species.includes(sp)) { d.species.push(sp); extra += `<p>Открыт новый вид роя: <b>${SPECIES[sp].name}</b> — ${SPECIES[sp].bonus}</p>`; }
            if (o.info.s + 1 < SYSTEMS.length) extra += `<p>Открыта система <b>«${SYSTEMS[o.info.s + 1].name}»</b></p>`;
          }
        }
        if (o.mode === "boss") title = "Система освобождена!";
      }
    } else if (o.mode === "endless") {
      title = "Рой погас"; questAdd("endless", 1);
      if (peak > d.bestEndless) { d.bestEndless = peak; extra += "<p><b>Новый рекорд!</b></p>"; }
      extra += `<p>Рекорд: <b>${fmt(d.bestEndless)}</b></p>`;
    } else if (o.mode === "daily") {
      title = win ? "Время вышло!" : "Рой погас"; questAdd("daily", 1);
      if (d.daily.day !== todayKey()) d.daily = { day: todayKey(), best: 0 };
      if (peak > d.daily.best) { d.daily.best = peak; extra += "<p><b>Лучший результат дня!</b></p>"; }
      light += 60;
    }
    d.light += light; Save.save();
    const share = (o.mode !== "campaign" || win);
    $("resultCard").innerHTML = `<h2>${title}</h2>
      <div class="big">✦ ${fmt(light)}</div><p>света получено</p>
      <div class="stats"><div><b>${fmt(peak)}</b><span>макс. размер роя</span></div><div><b>${kills}</b><span>${plural(kills, "рой побеждён", "роя побеждено", "роёв побеждено")}</span></div>
      <div><b>${fmt(world.statMotes)}</b><span>света собрано</span></div><div><b>${Math.floor(run.t / 60)}:${String(Math.floor(run.t % 60)).padStart(2, "0")}</b><span>время</span></div></div>
      ${extra}
      <div class="col"><button class="btn gold ad" id="rDouble">Удвоить награду</button>
      <div class="row"><button class="btn" id="rNext">${win && o.info && !o.info.boss ? "Дальше" : "Продолжить"}</button>${share ? '<button class="btn ghost small" id="rShare">Похвастаться</button>' : ""}</div></div>`;
    $("rDouble").onclick = async () => {
      const ok = await Platform.rewarded();
      if (ok) { d.light += light; Save.save(); $("rDouble").disabled = true; $("rDouble").textContent = "Награда удвоена!"; refreshMenu(); Sound.win(); }
      else UI.toast("Реклама сейчас недоступна");
    };
    $("rNext").onclick = async () => {
      Sound.click(); UI.close("ovResult");
      await Platform.interstitial();
      d.tut = Math.max(d.tut, 1); Save.save();
      run = null; world = null;
      if (o.mode === "campaign" || o.mode === "boss") { goGalaxy(); if (menuWorld) { } }
      else goMenu();
    };
    if ($("rShare")) $("rShare").onclick = async () => {
      const txt = o.mode === "endless" ? `Мой рой вырос до ${fmt(peak)} светлячков в «Звёздном рое»! Сможешь больше?`
        : o.mode === "daily" ? `Планета дня в «Звёздном рое»: ${fmt(peak)} светлячков. Попробуй обогнать!`
          : `Я захватил планету ${o.info.name} в «Звёздном рое» — мой рой: ${fmt(peak)} светлячков!`;
      const r = await Platform.share(txt); if (r === "copied") UI.toast("Ссылка скопирована");
    };
    const thisRun = run; UI.close("ovMut"); UI.close("ovRevive");
    setTimeout(() => { if (run === thisRun) UI.open("ovResult"); }, win ? 200 : 600);
  }

  /* --- управление --- */
  const glc = $("gl");
  function isUi(e) { return e.target && e.target.closest && e.target.closest(".ov,.ibtn,#compBtn,.btn,.topbar"); }
  window.addEventListener("pointerdown", e => {
    Sound.ensure();
    if (state !== "run" || isUi(e)) return;
    if (e.pointerType === "mouse") { if (e.button === 0) ptr.comp.add("mouse"); return; }
    if (ptr.steer == null) { ptr.steer = e.pointerId; ptr.sx = e.clientX; ptr.sy = e.clientY; }
    else ptr.comp.add(e.pointerId);
  });
  window.addEventListener("pointermove", e => {
    if (e.pointerType === "mouse") { ptr.mouse = true; ptr.mx = e.clientX; ptr.my = e.clientY; return; }
    if (e.pointerId === ptr.steer) { ptr.sx = e.clientX; ptr.sy = e.clientY; }
  });
  const up = e => { if (e.pointerType === "mouse") { ptr.comp.delete("mouse"); return; } if (e.pointerId === ptr.steer) ptr.steer = null; ptr.comp.delete(e.pointerId); };
  window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  const cb = $("compBtn");
  cb.addEventListener("pointerdown", e => { e.stopPropagation(); ptr.comp.add("btn" + e.pointerId); cb.setPointerCapture && cb.setPointerCapture(e.pointerId); if (run && run.tut && !run.tutStep) run.tutStep = 1; });
  const cbUp = e => ptr.comp.delete("btn" + e.pointerId);
  cb.addEventListener("pointerup", cbUp); cb.addEventListener("pointercancel", cbUp); cb.addEventListener("lostpointercapture", cbUp);
  window.addEventListener("keydown", e => { ptr.keys[e.code] = true; if (e.code === "Escape" && state === "run") pause(); });
  window.addEventListener("keyup", e => { ptr.keys[e.code] = false; });
  window.addEventListener("contextmenu", e => e.preventDefault());

  function readInput(dt) {
    const P = world.player, k = ptr.keys;
    let dx = 0, dy = 0, mag = 0;
    const kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), ky = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    const [px, py] = P ? screenOf(P.x, P.y) : [window.innerWidth / 2, window.innerHeight / 2];
    if (window.__autopilot) { const a = window.__autopilot(world); input.dx = a.dx; input.dy = a.dy; input.mag = a.mag; input.compress = !!a.compress; return; }
    if (kx || ky) { const l = Math.hypot(kx, ky); dx = kx / l; dy = ky / l; mag = 1; }
    else if (ptr.steer != null) { const vx = ptr.sx - px, vy = ptr.sy - py, l = Math.hypot(vx, vy); if (l > 4) { dx = vx / l; dy = vy / l; mag = clamp(l / 70, 0, 1); } }
    else if (ptr.mouse) { const vx = ptr.mx - px, vy = ptr.my - py, l = Math.hypot(vx, vy); if (l > 6) { dx = vx / l; dy = vy / l; mag = clamp((l - 6) / 90, 0, 1); } }
    if (mag === 0 && input.mag > 0) { mag = Math.max(0, input.mag - dt * 2.5); dx = input.dx; dy = input.dy; }
    input.dx = dx; input.dy = dy; input.mag = mag;
    input.compress = ptr.comp.size > 0 || !!k.Space || !!k.ShiftLeft || !!k.ShiftRight;
  }

  /* --- пауза --- */
  function pause() { if (state !== "run") return; state = "paused"; Sound.compressOn(false); UI.open("ovPause"); }
  $("bPause").onclick = () => { Sound.click(); pause(); };
  $("pResume").onclick = () => { Sound.click(); UI.close("ovPause"); state = "run"; last = performance.now(); };
  $("pSettings").onclick = () => { Sound.click(); openSettings(); };
  $("pQuit").onclick = () => { Sound.click(); UI.close("ovPause"); state = "run"; world.over = true; endRun(false); };

  /* --- главный цикл --- */
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    if (state === "run" && world) {
      readInput(dt);
      world.update(dt, input);
      run.t += dt;
      if (run.timer) { run.timer -= dt; if (run.timer <= 0 && !run.ended) { run.timer = 0.0001; world.won = true; Sound.win(); endRun(true); } }
      if (run.tut) tutorial();
      world.draw(); updateHud(dt);
      perf(dt);
    } else if ((state === "result" || state === "revive" || state === "mut" || state === "paused") && world) {
      if (state === "result" || state === "revive") { world.update(dt * 0.3, { dx: 0, dy: 0, mag: 0, compress: false }); }
      world.draw();
    } else if (state === "menu" && menuWorld) {
      menuWorld.update(dt, input); menuWorld.draw();
    }
    requestAnimationFrame(frame);
  }
  function tutorial() {
    const t = run.t;
    if (t > 4.5 && !run.tutStep) { run.tutStep = 0.5; hint("Зажми «СЖАТЬ» или второй палец: рой станет копьём — быстрее и сильнее", 5000); }
    if (t > 12 && run.tutStep !== 3 && world.beacons.length) { run.tutStep = 3; hint("Зажги 3 маяка, чтобы захватить планету. Стрелки укажут путь", 5000); }
  }
  function perf(dt) {
    if (S().set.q >= 0) return;
    run.fps.push(dt);
    if (run.fps.length === 150) {
      const avg = run.fps.reduce((a, b) => a + b, 0) / run.fps.length;
      if (avg > 1 / 38 && Render.quality > 0) { Render.setQuality(Render.quality - 1); Store.set("autoq", Render.quality); }
      run.fps = [];
    }
  }

  /* --- магазин --- */
  let shopTab = "upg";
  function openShop() { renderShop(); UI.open("ovShop"); }
  document.querySelectorAll("#ovShop .tabs button").forEach(b => b.onclick = () => { Sound.click(); shopTab = b.dataset.t; document.querySelectorAll("#ovShop .tabs button").forEach(x => x.classList.toggle("on", x === b)); renderShop(); });
  function renderShop() {
    const d = S(), L = $("shopList"); L.innerHTML = "";
    document.querySelectorAll(".lightv").forEach(e => e.textContent = fmt(d.light));
    if (shopTab === "upg") UPGRADES.forEach(u => {
      const lv = d.upg[u.id], cost = upgCost(u, lv), max = lv >= UPG_MAX;
      const e = document.createElement("div"); e.className = "item";
      e.innerHTML = `<div class="info"><b>${u.name}</b><span>${u.desc(lv)}</span><div class="lv">${Array.from({ length: UPG_MAX }, (_, i) => `<i class="${i < lv ? "f" : ""}"></i>`).join("")}</div></div>
        <button class="btn small ${max ? "ghost" : ""}" ${max || d.light < cost ? "disabled" : ""}>${max ? "Макс." : "✦ " + fmt(cost)}</button>`;
      e.querySelector("button").onclick = () => { if (d.light < cost) return; d.light -= cost; d.upg[u.id]++; Save.save(); Sound.mutation(); renderShop(); };
      L.appendChild(e);
    });
    else if (shopTab === "sp") {
      const h = document.createElement("p"); h.innerHTML = `Осколки: <b>◆ ${d.shards}/10</b> — 10 осколков открывают новый вид`; L.appendChild(h);
      SPECIES.forEach((sp, i) => {
        const own = d.species.includes(i), e = document.createElement("div"); e.className = "item" + (d.cur === i ? " sel" : "") + (own ? "" : " locked");
        const c1 = hsl(sp.hue, 95, 62), c2 = hsl(sp.spread >= 360 ? sp.hue + 180 : sp.hue + sp.spread / 2, 95, 70);
        const how = i === 8 ? "Позови друга или собери осколки" : i > 0 ? `Победи владыку системы «${SYSTEMS[i - 1].name}» или собери осколки` : "";
        e.innerHTML = `<div class="sw" style="background:radial-gradient(circle at 40% 35%,#fff,${rgbStr(c2)} 30%,${rgbStr(c1)} 60%,transparent 72%);box-shadow:0 0 20px ${rgbStr(c1, 0.6)}"></div>
          <div class="info"><b>${sp.name}</b><span>${own ? sp.bonus : how}</span></div>
          ${own ? `<button class="btn small ${d.cur === i ? "ghost" : ""}">${d.cur === i ? "Выбран" : "Выбрать"}</button>` : "<span>🔒</span>"}`;
        if (own) e.querySelector("button").onclick = () => { d.cur = i; Save.save(); Sound.click(); renderShop(); };
        L.appendChild(e);
      });
    } else {
      const r = energyRate();
      const h = document.createElement("p"); h.innerHTML = r ? `Захваченные планеты дают <b>✦ ${fmt(r)}/ч</b>` : "Захвати первую планету, чтобы станции заработали"; L.appendChild(h);
      STATIONS.forEach(s => {
        const lv = d.st[s.id], cost = upgCost(s, lv), max = lv >= 10;
        const e = document.createElement("div"); e.className = "item";
        e.innerHTML = `<div class="info"><b>${s.name}</b><span>${s.desc(lv)}</span><div class="lv">${Array.from({ length: 10 }, (_, i) => `<i class="${i < lv ? "f" : ""}"></i>`).join("")}</div></div>
          <button class="btn small" ${max || d.light < cost ? "disabled" : ""}>${max ? "Макс." : "✦ " + fmt(cost)}</button>`;
        e.querySelector("button").onclick = () => { if (d.light < cost) return; d.light -= cost; d.st[s.id]++; Save.save(); Sound.mutation(); renderShop(); };
        L.appendChild(e);
      });
    }
  }

  /* --- задания --- */
  function openQuests() { dailyRefresh(); renderQuests(); UI.open("ovQuests"); }
  function renderQuests() {
    const d = S();
    $("days").innerHTML = LOGIN.map((r, i) => {
      const day = (d.login.streak - 1) % 7, got = i < day || (i === day && d.login.claimed);
      return `<div class="${got ? "got" : ""} ${i === day ? "now" : ""}">День ${i + 1}<b>${r.l ? "✦" + r.l : ""}${r.sh ? (r.l ? "<br>" : "") + "◆" + r.sh : ""}</b></div>`;
    }).join("");
    const L = $("qList"); L.innerHTML = "";
    d.quests.list.forEach(q => {
      const def = QUESTS.find(x => x.id === q.id), done = q.p >= q.goal, rw = Math.round(def.r * (1 + d.prog * 0.15));
      const e = document.createElement("div"); e.className = "item";
      e.innerHTML = `<div class="info"><b>${def.t(q.goal)}</b><span>${fmt(Math.min(q.p, q.goal))} / ${fmt(q.goal)} · награда ✦ ${rw} + ◆ 1</span><div class="qbar"><div style="width:${Math.min(100, q.p / q.goal * 100)}%"></div></div></div>
        <button class="btn small ${q.claimed ? "ghost" : "gold"}" ${!done || q.claimed ? "disabled" : ""}>${q.claimed ? "✓" : "Забрать"}</button>`;
      e.querySelector("button").onclick = () => { if (!done || q.claimed) return; q.claimed = true; d.light += rw; addShards(1); Save.save(); Sound.win(); renderQuests(); refreshMenu(); };
      L.appendChild(e);
    });
    const c = $("bChest");
    if (d.chest.n === 0) { c.classList.remove("ad"); c.textContent = "Бесплатный контейнер"; c.disabled = false; }
    else if (d.chest.n < 6) { c.classList.add("ad"); c.textContent = `Контейнер с осколками (${6 - d.chest.n})`; c.disabled = false; }
    else { c.classList.remove("ad"); c.textContent = "Контейнеры кончились до завтра"; c.disabled = true; }
  }
  $("bChest").onclick = async () => {
    const d = S(); if (d.chest.n >= 6) return;
    if (d.chest.n > 0) { const ok = await Platform.rewarded(); if (!ok) { UI.toast("Реклама сейчас недоступна"); return; } }
    d.chest.n++; const sh = 2 + Math.floor(Math.random() * 2), l = 40 + Math.floor(Math.random() * 40) + d.prog * 5;
    d.light += l; const un = addShards(sh, true); Save.save(); Sound.win();
    UI.toast(`Контейнер: ✦ ${l} и ◆ ${sh}` + (un != null ? ` · Новый вид: ${SPECIES[un].name}!` : ""), 3200);
    renderQuests(); refreshMenu();
  };

  /* --- настройки --- */
  function openSettings() {
    const s = S().set;
    document.querySelectorAll("#ovSettings .tgl").forEach(t => { t.classList.toggle("on", !!s[t.dataset.s]); });
    $("bQual").textContent = ["Авто", "Низкое", "Среднее", "Высокое"][s.q + 1];
    UI.open("ovSettings");
  }
  document.querySelectorAll("#ovSettings .tgl").forEach(t => t.onclick = () => {
    const s = S().set; s[t.dataset.s] = !s[t.dataset.s]; t.classList.toggle("on", s[t.dataset.s]); applySettings(); Save.save(); Sound.click();
  });
  $("bQual").onclick = () => {
    const s = S().set; s.q = s.q >= 2 ? -1 : s.q + 1; $("bQual").textContent = ["Авто", "Низкое", "Среднее", "Высокое"][s.q + 1];
    Render.setQuality(s.q >= 0 ? s.q : guessQuality()); Save.save(); Sound.click();
  };
  function applySettings() { const s = S().set; Sound.setSfx(s.sound); Sound.setMusic(s.music); }

  /* --- кнопки меню --- */
  $("bPlay").onclick = () => {
    Sound.ensure(); Sound.click();
    if (S().tut < 1) { startRun({ mode: "campaign", info: planetInfo(S().gseed, 0, 0) }); return; }
    goGalaxy();
  };
  $("bEndless").onclick = () => { Sound.ensure(); Sound.click(); if (S().prog < 2) { UI.toast("Откроется после захвата 2 планет"); return; } startRun({ mode: "endless" }); };
  $("bDaily").onclick = () => {
    Sound.ensure(); Sound.click();
    if (S().prog < 1) { UI.toast("Откроется после захвата первой планеты"); return; }
    const d = S(), k = todayKey(), r = mulberry32(k), bk = BIOME_KEYS[Math.floor(r() * 7)];
    UI.msg(`<h2>Планета дня</h2><p>Одинаковая для всех игроков. 3 минуты, чтобы вырастить самый большой рой.</p>
      <div class="tags"><span class="tag">Биом: <b>${BIOMES[bk].name}</b></span>${d.daily.day === k ? `<span class="tag">Твой лучший: <b>${fmt(d.daily.best)}</b></span>` : ""}</div>`,
      [{ t: "Вперёд!", fn: () => startRun({ mode: "daily" }) }, { t: "Позже", cls: "ghost small" }]);
  };
  $("bShop").onclick = () => { Sound.ensure(); Sound.click(); shopTab = "upg"; document.querySelectorAll("#ovShop .tabs button").forEach(x => x.classList.toggle("on", x.dataset.t === "upg")); openShop(); };
  $("bQuests").onclick = () => { Sound.ensure(); Sound.click(); openQuests(); };
  $("bSettings").onclick = () => { Sound.ensure(); Sound.click(); openSettings(); };
  $("gBack").onclick = () => { Sound.click(); if (!Galaxy.back()) goMenu(); };
  $("bCollect").onclick = async () => {
    const d = S(), v = Math.floor(energyNow()); if (v < 1) return;
    d.light += v; d.energyT = Date.now(); Save.save(); Sound.win(); refreshMenu();
    UI.msg(`<h2>Энергия собрана</h2><div class="big">✦ ${fmt(v)}</div><p>Планеты продолжают копить свет, пока тебя нет</p>`,
      [{ t: "Удвоить", cls: "gold ad", fn: async () => { const ok = await Platform.rewarded(); if (ok) { d.light += v; Save.save(); refreshMenu(); UI.toast("Удвоено: +✦ " + fmt(v)); } else UI.toast("Реклама сейчас недоступна"); } }, { t: "Забрать", cls: "ghost small" }]);
  };
  $("bInvite").onclick = async () => {
    const ok = await Platform.invite();
    if (ok && !S().invited) { S().invited = true; if (!S().species.includes(8)) S().species.push(8); Save.save(); UI.msg(`<h2>Спасибо!</h2><p>Открыт редкий вид роя <b>«Созвездие»</b> — ${SPECIES[8].bonus}</p>`); }
  };
  $("bShare").onclick = async () => {
    const d = S(), r = await Platform.share(`Я строю свою галактику в «Звёздном рое»: ${Object.keys(d.captured).length} ${plural(Object.keys(d.captured).length, "планета", "планеты", "планет")}, рекорд роя ${fmt(Math.max(d.bestEndless, 0))}. Присоединяйся!`);
    if (r === "copied") UI.toast("Ссылка скопирована");
  };

  setInterval(() => { if (state === "galaxy") updateEnergyBox(); }, 1000);
  document.addEventListener("visibilitychange", () => { if (document.hidden) { pause(); Sound.suspend(); } else Sound.resume(); });
  window.__appPause = () => { pause(); Sound.suspend(); };
  window.__appResume = () => Sound.resume();
  window.addEventListener("resize", () => { Render.resize(); Galaxy.resize(); });

  /* --- запуск --- */
  async function boot() {
    Save.load();
    const autoq = Store.get("autoq", null);
    Render.setQuality(S().set.q >= 0 ? S().set.q : (autoq != null ? autoq : guessQuality()));
    if (!Render.init($("gl"))) { $("nogl").style.display = "flex"; return; }
    Render.setQuality(S().set.q >= 0 ? S().set.q : (autoq != null ? autoq : guessQuality()));
    Galaxy.init($("ui2d"));
    applySettings();
    await Platform.init();
    const cloud = await Platform.cloudLoad(); Save.merge(cloud);
    const src = Platform.seedSource(); if (src && !S().seeded) { S().gseed = hashStr(src) % 1e9; S().seeded = true; Save.save(); }
    applySettings();
    goMenu();
    Platform.ready();
    last = performance.now(); requestAnimationFrame(frame);
  }

  return {
    boot, refreshMenu, goMenu,
    // для автотестов
    get world() { return world; }, get state() { return state; }, startRun, endRun, input, save: () => S(), onEvent
  };
})();

Game.boot();
