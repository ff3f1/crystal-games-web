"use strict";
/* ===== Игра: сохранение, экраны, управление, HUD, награды ===== */

const $ = id => document.getElementById(id);
const ic = (name, cls) => `<svg class="ic ${cls || ""}"><use href="#${name}"/></svg>`;

/* Цвета мутаций и улучшений: [яркий, глубокий] */
const MCOL = {
  dmg: ["#ff9f43", "#ff3d6e"], magnet: ["#5ad1ff", "#7b5cff"], speed: ["#4df2d2", "#2b8cff"], stamina: ["#ffd45c", "#ff8a1f"],
  armor: ["#9fd8ff", "#5a7bff"], kill: ["#c77dff", "#ff4fa3"], value: ["#9dff6b", "#20c38a"], comet: ["#ffb347", "#ff5e3a"],
  nova: ["#fff1a8", "#ff9f1c"], ghost: ["#e6e6ff", "#8a7dff"], start: ["#ffd45c", "#ffaa2e"], power: ["#ff9f43", "#ff3d6e"],
  collector: ["#ffd45c", "#ffaa2e"], storage: ["#4df2d2", "#2b8cff"]
};
const UICON = { start: "m-start", speed: "m-speed", magnet: "m-magnet", power: "m-dmg", stamina: "m-stamina", collector: "i-dish", storage: "i-tank" };
const orb = (id, icon, size) => { const c = MCOL[id] || MCOL.start; return `<div class="orb" style="--c1:${c[0]};--c2:${c[1]}${size ? `;width:${size}px;height:${size}px;font-size:${size / 2}px` : ""}">${ic(icon, icon.startsWith("m-") && !["m-magnet", "m-ghost", "m-comet", "m-nova", "m-speed", "m-start"].includes(icon) ? "f" : "")}</div>`; };

/* ---------- Интерфейс ---------- */
const UI = {
  toast(t, ms) { const e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(this._tt); this._tt = setTimeout(() => e.classList.remove("on"), ms || 2200); },
  open(id) { $(id).classList.add("on"); },
  close(id) { $(id).classList.remove("on"); },
  banner(t, col, sub) { const b = $("banner"); b.innerHTML = t + (sub ? `<small>${sub}</small>` : ""); b.style.color = col || "#fff"; b.classList.remove("on"); void b.offsetWidth; b.classList.add("on"); },
  streak(t) { const b = $("streak"); b.textContent = t; b.classList.remove("on"); void b.offsetWidth; b.classList.add("on"); },
  float(x, y, t, col) {
    const e = document.createElement("div"); e.className = "float"; e.textContent = t; e.style.left = x + "px"; e.style.top = y + "px"; e.style.color = col || "#fff";
    document.body.appendChild(e); setTimeout(() => e.remove(), 1150);
  },
  msg(html, buttons) {
    const c = $("msgCard"); c.innerHTML = html + '<div class="col" id="msgBtns"></div>';
    const bx = $("msgBtns");
    (buttons || [{ t: "Отлично", cls: "" }]).forEach(b => {
      const el = document.createElement("button"); el.className = "btn " + (b.cls || ""); el.innerHTML = b.t;
      el.onclick = () => { Sound.click(); UI.close("ovMsg"); b.fn && b.fn(); }; bx.appendChild(el);
    });
    UI.open("ovMsg");
  },
  countUp(el, to, ms) {
    const t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
};
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => { Sound.click(); b.closest(".ov").classList.remove("on"); Game.refreshMenu(); });

/* ---------- Сохранение ---------- */
const LOGIN = [{ l: 100 }, { l: 150 }, { sh: 3 }, { l: 250 }, { l: 300 }, { sh: 5 }, { l: 500, sh: 5 }];
const QUESTS = [
  { id: "motes", icon: "i-light", t: g => `Собери ${fmt(g)} света`, goal: p => Math.round(1500 * (1 + p * 0.25) / 100) * 100, r: 80 },
  { id: "kills", icon: "i-maw", t: g => `Победи ${g} ${plural(g, "рой", "роя", "роёв")}`, goal: () => 8, r: 90 },
  { id: "compkills", icon: "i-comp", t: g => `Победи ${g} ${plural(g, "рой", "роя", "роёв")} в сжатии`, goal: () => 3, r: 110 },
  { id: "capture", icon: "i-beacon", t: () => "Захвати планету", goal: () => 1, r: 120 },
  { id: "peak", icon: "i-swarm", t: g => `Вырасти до ${fmt(g)} светлячков`, goal: p => reqForLevel(Math.max(0, p - 1))[2] * 2, r: 100 },
  { id: "daily", icon: "i-sun", t: () => "Сыграй планету дня", goal: () => 1, r: 90 },
  { id: "endless", icon: "i-inf", t: () => "Сыграй бесконечный режим", goal: () => 1, r: 80 },
  { id: "beacons", icon: "i-beacon", t: g => `Зажги ${g} ${plural(g, "маяк", "маяка", "маяков")}`, goal: () => 6, r: 90 }
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
  let state = "boot", world = null, menuWorld = null, run = null, last = 0, hudT = 0;
  const input = { dx: 0, dy: 0, mag: 0, compress: false };
  const ptr = { steer: null, ax: 0, ay: 0, cx: 0, cy: 0, comp: new Set(), mouse: false, mx: 0, my: 0, keys: {}, touched: false };
  const S = () => Save.d;
  const isTouch = () => matchMedia("(pointer:coarse)").matches || /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);

  /* --- качество графики --- */
  function guessQuality() {
    const q = S().set.q; if (q >= 0) return q;
    const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4, mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (mem <= 2 || cores <= 4) return 0;
    if (mobile) return 1;
    return 2;
  }

  /* --- параметры игрока --- */
  function playerCfg(over) {
    const d = S(), sp = SPECIES[d.cur] || SPECIES[0];
    return Object.assign({
      startN: startSize(d.upg.start), hue: sp.hue, spread: sp.spread, mods: {}, eff: sp.eff,
      speedUp: d.upg.speed * 0.06, powerUp: d.upg.power * 0.08, magnetUp: d.upg.magnet * 0.06, staminaUp: d.upg.stamina * 0.1, valueMul: 1
    }, over || {});
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
  function questAdd(id, v, abs) { for (const q of S().quests.list) if (q.id === id && !q.claimed) q.p = abs ? Math.max(q.p, v) : q.p + v; }
  function grantLogin() {
    const d = S(); if (d.login.claimed) return;
    const r = LOGIN[(d.login.streak - 1) % 7]; d.login.claimed = 1;
    if (r.l) d.light += r.l; if (r.sh) addShards(r.sh, true);
    Save.save(); refreshMenu();
    UI.msg(`${orb("start", "i-light", 76)}<h2 style="margin-top:12px">День ${((d.login.streak - 1) % 7) + 1}</h2><p>Награда за вход</p>
      <div class="reward">${r.l ? ic("i-light", "f") + fmt(r.l) : ""}${r.sh ? `<span style="color:#d7c4ff">${ic("i-shard", "f")}${r.sh}</span>` : ""}</div>
      <p>${r.sh ? "Осколки открывают новые виды роя" : "Заходи завтра — награда будет больше"}</p>`, [{ t: "Забрать" }]);
  }
  function addShards(n, silent) {
    const d = S(); d.shards += n; let unlocked = null;
    while (d.shards >= 10) {
      const nx = SPECIES.findIndex((_, i) => !d.species.includes(i));
      if (nx < 0) { d.shards = 10; break; }
      d.shards -= 10; d.species.push(nx); unlocked = nx;
    }
    Save.save();
    if (unlocked != null && !silent) UI.toast("Новый вид роя: " + SPECIES[unlocked].name, 3000);
    return unlocked;
  }

  /* --- меню --- */
  function nextPlanet() {
    const d = S(), L = Math.min(d.prog, SYSTEMS.length * PLANETS_PER_SYS - 1);
    return planetInfo(d.gseed, Math.floor(L / PLANETS_PER_SYS), L % PLANETS_PER_SYS);
  }
  function refreshMenu() {
    const d = S();
    document.querySelectorAll(".lightv").forEach(e => e.textContent = fmt(d.light));
    document.querySelectorAll(".shardv").forEach(e => e.textContent = d.shards + "/10");
    $("qBadge").style.display = d.quests.list.some(q => q.p >= q.goal && !q.claimed) || d.chest.n === 0 ? "block" : "none";
    $("dailyBadge").style.display = d.prog >= 1 && d.daily.day !== todayKey() ? "block" : "none";
    $("shopBadge").style.display = UPGRADES.some(u => d.upg[u.id] < UPG_MAX && d.light >= upgCost(u, d.upg[u.id])) ? "block" : "none";
    $("socialRow").style.display = Platform.social || navigator.share ? "flex" : "none";
    $("bInvite").style.display = Platform.social ? "" : "none";
    // продолжение кампании
    const info = nextPlanet(), allDone = Object.keys(d.captured).length >= SYSTEMS.length * PLANETS_PER_SYS;
    const cv = $("contPlanet"), cx = cv.getContext("2d"); cx.clearRect(0, 0, 168, 168); cx.drawImage(Galaxy.planetSprite(info, 168), 0, 0);
    $("contSys").textContent = allDone ? "Галактика освобождена" : `Система «${SYSTEMS[info.s].name}»`;
    $("contName").textContent = allDone ? "Все планеты твои" : info.name;
    $("contDots").innerHTML = Array.from({ length: PLANETS_PER_SYS }, (_, p) => { const L = info.s * PLANETS_PER_SYS + p; return `<i class="${d.captured[L] ? "f" : L === info.L ? "c" : ""}"></i>`; }).join("");
    $("bPlay").innerHTML = d.tut < 1 ? "Начать" : allDone ? ic("i-galaxy") + "Галактика" : info.boss ? ic("i-crown") + "К владыке" : "Лететь";
    $("endlessSub").textContent = d.prog < 2 ? "после 2 планет" : d.bestEndless ? "рекорд " + fmt(d.bestEndless) : "расти без предела";
    $("bEndless").classList.toggle("locked", d.prog < 2);
    $("dailySub").textContent = d.prog < 1 ? "после 1 планеты" : d.daily.day === todayKey() ? "лучший " + fmt(d.daily.best) : "одна на всех";
    $("bDaily").classList.toggle("locked", d.prog < 1);
    updateEnergyBox();
  }
  function updateEnergyBox() {
    const r = energyRate(), now = energyNow(), cap = energyCap();
    $("energyBox").style.display = r > 0 ? "flex" : "none";
    if (r > 0) { $("enBar").style.width = (now / cap * 100).toFixed(1) + "%"; $("enTxt").textContent = `${fmt(now)} из ${fmt(cap)}, +${fmt(r)} в час`; $("bCollect").disabled = now < 1; }
  }
  function show(id) { document.querySelectorAll(".scr").forEach(s => s.classList.toggle("on", s.id === id)); }

  function makeMenuWorld() {
    const bk = BIOME_KEYS[Math.floor(Math.random() * 7)];
    const tex = genPlanetTextures(bk, 4242, 2400, [384, 512, 640][Render.quality]);
    Render.setTextures(tex.floor, tex.neb);
    menuWorld = new World({ mode: "menu", biome: bk, seed: 77 + Math.floor(Math.random() * 999), R: 2400, level: 2, bots: 8, player: playerCfg({ startN: 320 }), onEvent: () => { } });
    menuWorld.camOffY = window.innerHeight * 0.16;
    for (let i = 0; i < 90; i++) menuWorld.update(1 / 30, { dx: 0, dy: 0, mag: 0 });
    Sound.setMood(BIOMES[bk].i);
  }
  function goMenu() {
    state = "menu"; world = null; run = null; Galaxy.hide(); show("menu"); refreshMenu(); Platform.gameplay(false);
    hideJoy(); ptr.steer = null;
    if (!menuWorld || menuWorld.player.hue !== (SPECIES[S().cur] || SPECIES[0]).hue) makeMenuWorld();
    else { const tex = genPlanetTextures(menuWorld.bkey, 4242, 2400, [384, 512, 640][Render.quality]); Render.setTextures(tex.floor, tex.neb); Sound.setMood(menuWorld.B.i); }
    dailyRefresh();
    if (!S().login.claimed && S().tut >= 1) setTimeout(grantLogin, 500);
  }

  function goGalaxy() {
    state = "galaxy"; show("galaxy"); refreshMenu(); hideJoy();
    Galaxy.show(S(), openPlanet, (v, s) => {
      if (v === "galaxy") { $("gName").textContent = "Твоя галактика"; $("gSub").textContent = "Она есть только у тебя"; }
      else { $("gName").textContent = "Система «" + SYSTEMS[s].name + "»"; $("gSub").textContent = BIOMES[SYSTEMS[s].biome].name; }
    });
  }

  function openPlanet(info, st) {
    const B = BIOMES[info.biome], req = info.req, income = planetIncome(info.L);
    const goal = info.boss
      ? `<div class="note" style="justify-content:center">${ic("i-crown")}<span>Победи владыку системы. Он в ${Math.round(info.req[2] * 2.2 / startSize(S().upg.start))} раз больше тебя — сначала вырасти</span></div>`
      : `<div class="beacons">${req.map(r => `<div class="bq">${ic("i-beacon")}<b>${fmt(r)}</b><small>светлячков</small></div>`).join("")}</div><p>Зажги три маяка: каждому нужен рой не меньше указанного</p>`;
    $("planetCard").innerHTML = `<canvas class="pcv" id="pcv" width="256" height="256"></canvas>
      <h2>${info.name}</h2><div class="chip">${B.name}</div><p>${B.desc}</p>${goal}
      <div class="inc">${ic("i-light", "f")}<span>${st === "done" ? "Твоя планета" : "После захвата"}: +${income} света в час</span></div>
      ${info.boss ? `<div class="inc">${ic("i-swarm")}<span>Награда: вид роя «${SPECIES[Math.min(8, info.s + 1)].name}»</span></div>` : ""}
      <div class="col"><button class="btn wide" id="bLand">${st === "done" ? "Высадиться снова" : "Высадиться"}</button><button class="btn ghost small" data-close>Назад</button></div>`;
    $("pcv").getContext("2d").drawImage(Galaxy.planetSprite(info, 256), 0, 0);
    $("planetCard").querySelector("[data-close]").onclick = () => { Sound.click(); UI.close("ovPlanet"); };
    $("bLand").onclick = () => { Sound.click(); UI.close("ovPlanet"); startRun({ mode: info.boss ? "boss" : "campaign", info }); };
    UI.open("ovPlanet");
  }

  /* --- забег --- */
  function startRun(o) {
    Sound.ensure();
    $("loadTxt").textContent = o.mode === "endless" ? "Открываем бесконечный простор…" : o.mode === "daily" ? "Летим к планете дня…" : "Высадка на " + o.info.name + "…";
    $("loading").classList.add("on"); hideJoy(); ptr.steer = null; ptr.comp.clear();
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
    run = { o, L, biome, t: 0, revived: false, ended: false, tut: d.tut < 1, hurtT: 0, timer: o.mode === "daily" ? 180 : 0, fps: [], lastN: 0, bumpT: 0, tutStep: 0 };
    buildHud();
    show("hud"); Galaxy.hide();
    state = "run"; $("loading").classList.remove("on");
    Platform.gameplay(true);
    const B = BIOMES[biome];
    if (o.mode === "boss") UI.banner("Владыка ждёт", "#ff8fa8", B.name);
    else if (o.mode === "campaign") UI.banner(o.info.name, "#fff4c8", B.name);
    else if (o.mode === "daily") UI.banner("Планета дня", "#ffd45c", "3 минуты на самый большой рой");
    else UI.banner("Бесконечный рой", "#b9fff0", "расти, пока не погаснешь");
    if (run.tut) setTimeout(() => { if (run && run.tut) hint(isTouch() ? "Проведи пальцем в любом месте — рой полетит туда" : "Веди мышью — рой летит за курсором", 4500); }, 1600);
  }

  let hintT = null;
  function hint(t, ms) { const h = $("hint"); h.textContent = t; h.classList.add("on"); clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove("on"), ms || 3000); }

  function buildHud() {
    const g = $("hGoals"); g.innerHTML = "";
    if (world.beacons.length) world.beacons.forEach((b, i) => {
      const el = document.createElement("div"); el.className = "bc"; el.id = "bc" + i;
      el.innerHTML = `<svg class="ring" viewBox="0 0 42 42"><circle cx="21" cy="21" r="17" fill="rgba(7,10,26,.62)" stroke="rgba(234,242,255,.16)" stroke-width="3"/><circle class="pr" cx="21" cy="21" r="17" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="106.8" stroke-dashoffset="106.8"/></svg><span>${fmtShort(b.req)}</span>`;
      g.appendChild(el);
    });
    $("hBoss").style.display = world.mode === "boss" ? "block" : "none";
    $("hTimer").style.display = world.mode === "daily" ? "block" : "none";
    $("hMuts").innerHTML = "";
    const ar = $("arrows"); ar.innerHTML = ""; arrowState = [];
    for (let i = 0; i < 4; i++) {
      const a = document.createElement("div"); a.className = "arrow";
      a.innerHTML = `<div class="pt"><svg viewBox="0 0 44 44"><path d="M38 22L14 9l5 13-5 13z" fill="currentColor" stroke="rgba(0,0,0,.4)" stroke-width="1.5" stroke-linejoin="round"/></svg></div><div class="d"></div>`;
      ar.appendChild(a); arrowState.push({ x: innerWidth / 2, y: innerHeight / 2, ang: 0, vis: false, init: false });
    }
    const lb = $("labels"); lb.innerHTML = "";
    for (let i = 0; i < 10; i++) { const a = document.createElement("div"); a.className = "blabel"; lb.appendChild(a); }
  }
  function fmtShort(n) { n = Math.round(n); return n >= 10000 ? Math.round(n / 1000) + "к" : n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "").replace(".", ",") + "к" : String(n); }
  function updateMuts() {
    const h = $("hMuts"); h.innerHTML = "";
    for (const m of MUTATIONS) { const lv = world.mutLevels[m.id]; if (!lv) continue; const e = document.createElement("div"); e.className = "mut"; e.style.color = MCOL[m.id][0]; e.style.borderColor = MCOL[m.id][0] + "88"; e.innerHTML = ic("m-" + m.id, ["dmg", "stamina", "armor", "kill", "value"].includes(m.id) ? "f" : "") + (lv > 1 ? `<sup>${lv}</sup>` : ""); h.appendChild(e); }
  }

  function screenOf(x, y) { const c = Render.cam; return [(x - c.x) * c.scale + innerWidth / 2, (y - c.y) * c.scale + innerHeight / 2]; }

  /* стрелки к целям: плавные, без дёрганья */
  let arrowState = [];
  function updateArrows(dt) {
    const P = world.player; if (!P) return;
    const W = innerWidth, H = innerHeight, els = $("arrows").children;
    const targets = world.beacons.filter(b => !b.lit).map(b => ({ x: b.x, y: b.y, col: rgbStr(world.B.edge, 1), r: b.rad }));
    if (world.boss) targets.push({ x: world.boss.x, y: world.boss.y, col: "#ff5e7a", r: world.boss.r });
    const [px, py] = screenOf(P.x, P.y);
    for (let i = 0; i < els.length; i++) {
      const a = els[i], st = arrowState[i], t = targets[i];
      let want = false, tx = st.x, ty = st.y, tang = st.ang;
      if (t) {
        const [sx, sy] = screenOf(t.x, t.y), rr = t.r * Render.cam.scale;
        const inside = sx > -rr * 0.3 && sx < W + rr * 0.3 && sy > -rr * 0.3 && sy < H + rr * 0.3;
        want = st.vis ? !(sx > 30 && sx < W - 30 && sy > 90 && sy < H - 30) : !inside;
        const dx = t.x - P.x, dy = t.y - P.y; tang = Math.atan2(dy, dx);
        const m = 34, top = 120, bot = 40, cx = W / 2, cy = (top + H - bot) / 2;
        const ux = Math.cos(tang), uy = Math.sin(tang);
        const k = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(ux)), ((H - top - bot) / 2) / Math.max(1e-3, Math.abs(uy)));
        tx = cx + ux * k; ty = cy + uy * k;
        a.querySelector(".d").textContent = Math.max(1, Math.round(Math.hypot(dx, dy) / 10)) + " м";
        a.style.color = t.col;
        if (!st.init) { st.x = tx; st.y = ty; st.ang = tang; st.init = true; }
      }
      // сглаживание
      let da = tang - st.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      const k = 1 - Math.exp(-dt * 9);
      st.ang += da * k; st.x += (tx - st.x) * k; st.y += (ty - st.y) * k;
      if (want !== st.vis) { st.vis = want; a.style.opacity = want ? "1" : "0"; }
      a.style.transform = `translate(${st.x.toFixed(1)}px,${st.y.toFixed(1)}px)`;
      a.firstChild.style.transform = `rotate(${st.ang.toFixed(3)}rad)`;
    }
  }
  function updateLabels(slow) {
    const P = world.player; if (!P) return;
    const labels = $("labels").children, W = innerWidth, H = innerHeight; let li = 0;
    const PS = Math.sqrt(P.n) * world.dmgMul(P);
    for (const s of world.swarms) {
      if (s.player || !s.alive || li >= labels.length) continue;
      const [sx, sy] = screenOf(s.x, s.y - s.r * 1.05);
      if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) continue;
      if ((world.bkey === "dark" || world.hazardsHas("dark")) && dist2(s.x, s.y, P.x, P.y) > (P.r * 2.8 + 520) ** 2) continue;
      const e = labels[li++];
      e.style.display = "block"; e.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) translate(-50%,-50%)`;
      if (slow) { const ratio = s.S / Math.max(1, PS); e.textContent = (s.boss ? "♛ " : "") + fmtShort(s.n); e.style.color = ratio > 1.1 ? "#ff8fa8" : ratio < 0.7 ? "#8dffc0" : "#fff"; }
    }
    for (; li < labels.length; li++) labels[li].style.display = "none";
  }

  function updateHud(dt) {
    updateArrows(dt); updateLabels(false);
    hudT -= dt; if (hudT > 0) return; hudT = 0.08;
    updateLabels(true);
    const P = world.player; if (!P) return;
    const v = fmt(P.n), cnt = $("hCount"); if (cnt.textContent !== v) cnt.textContent = v;
    if (P.n > run.lastN * 1.04 && run.t - run.bumpT > 0.25) { const e = $("hNum"); e.classList.remove("bump"); void e.offsetWidth; e.classList.add("bump"); run.bumpT = run.t; run.lastN = P.n; }
    if (P.n < run.lastN) run.lastN = P.n;
    $("hMut").style.width = (world.mutCount >= 9 ? 100 : clamp((P.n - world.mutPrev) / Math.max(1, world.mutNext - world.mutPrev), 0, 1) * 100).toFixed(1) + "%";
    $("stRing").style.strokeDashoffset = (307.9 * (1 - P.stamina)).toFixed(1);
    $("stRing").style.stroke = P.stamina < 0.2 ? "#ff5e7a" : "#ffd45c";
    world.beacons.forEach((b, i) => {
      const el = $("bc" + i); if (!el) return; const pr = el.querySelector(".pr");
      pr.style.strokeDashoffset = (106.8 * (1 - b.p)).toFixed(1); pr.style.stroke = rgbStr(world.B.edge, 1);
      el.classList.toggle("lit", b.lit); el.classList.toggle("ok", !b.lit && P.n >= b.req);
      if (b.lit) { el.querySelector("circle").setAttribute("fill", rgbStr(world.B.edge, 1)); el.querySelector("span").innerHTML = ic("i-beacon"); }
    });
    if (world.mode === "boss") { const B = world.boss; $("hBossBar").style.width = (B ? clamp(B.n / B.maxN, 0, 1) * 100 : 0) + "%"; }
    if (run.timer) { const s = Math.max(0, Math.ceil(run.timer)); $("hTimer").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
    for (const b of world.beacons) if (b.inZone && !b.lit) {
      if (b.tooSmall) hint(`Маяку нужно ${fmt(b.req)} светлячков — подрасти`, 700);
      else if (b.contested) hint("Вытесни чужие рои с маяка!", 700);
    }
    run.hurtT = Math.max(0, run.hurtT - 0.08);
    $("vign").style.boxShadow = run.hurtT > 0.01 ? `inset 0 0 ${80 + run.hurtT * 120}px rgba(255,40,80,${(run.hurtT * 0.55).toFixed(2)})` : "none";
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
        UI.float(sx, sy, (data.comp ? "Копьём! " : "") + "+" + fmtShort(data.n * 0.6), data.comp ? "#ffd45c" : "#8dffc0");
        questAdd("kills", 1); if (data.comp) questAdd("compkills", 1);
        if (data.boss) UI.banner("Владыка повержен!", "#ffd45c");
        break;
      }
      case "streak": UI.streak(data === 2 ? "Двойное поглощение!" : data === 3 ? "Тройное поглощение!" : `Рой неудержим ×${data}`); Sound.mutation(); break;
      case "hurt": run.hurtT = Math.min(1, run.hurtT + 0.08); break;
      case "dead": onDead(); break;
      case "beaconTick": Sound.beacon(data); break;
      case "beaconLit": Sound.beaconLit(); questAdd("beacons", 1); UI.banner(data < 3 ? `Маяк зажжён` : "Все маяки горят!", rgbStr(world.B.edge, 1), data < 3 ? `${data} из 3` : "планета твоя"); if (S().set.vibro) Platform.vibrate(40); break;
      case "win": Sound.win(); setTimeout(() => endRun(true), 1900); break;
      case "mutation": showMutation(data); break;
      case "compress": Sound.compressOn(data); $("compBtn").classList.toggle("on", data); if (data && run.tut && run.tutStep < 2) { run.tutStep = 2; hint("Отлично! Красные рои сильнее тебя, зелёные — добыча", 4000); } break;
      case "nova": Sound.pop(true); break;
      case "geyserWarn": Sound.warn(); break;
      case "crystal": Sound.pop(false); break;
      case "eelStun": UI.toast("Пожиратель оглушён!"); break;
      case "warn": UI.banner(data, "#ff8fa8"); Sound.warn(); break;
    }
  }

  function showMutation(opts) {
    if (!run || run.ended || state !== "run" || !opts.length) return;
    state = "mut"; Sound.mutation(); Sound.compressOn(false); input.compress = false; hideJoy(); ptr.steer = null; ptr.comp.clear();
    const box = $("mOpts"); box.innerHTML = "";
    opts.forEach(m => {
      const cur = world.mutLevels[m.id] || 0, c = MCOL[m.id];
      const e = document.createElement("div"); e.className = "mopt"; e.style.setProperty("--c1", c[0]); e.style.setProperty("--c2", c[1]);
      e.innerHTML = `${orb(m.id, "m-" + m.id)}<b style="${m.name.length > 10 && !m.name.includes(" ") ? "font-size:12.5px" : ""}">${m.name}</b><span>${m.desc}</span><div class="pips">${Array.from({ length: m.max }, (_, i) => `<i class="${i < cur ? "f" : i === cur ? "n" : ""}"></i>`).join("")}</div>`;
      e.onclick = () => {
        if (state !== "mut") return; Sound.click(); e.classList.add("pick");
        setTimeout(() => { world.applyMutation(m.id); updateMuts(); UI.close("ovMut"); state = "run"; last = performance.now(); }, 380);
      };
      box.appendChild(e);
    });
    $("mReroll").style.display = run.rerolled ? "none" : "";
    $("mReroll").onclick = async () => { const ok = await Platform.rewarded(); if (ok) { run.rerolled = true; state = "run"; showMutation(world.mutOptions()); } else UI.toast("Реклама сейчас недоступна"); };
    UI.open("ovMut");
  }

  function onDead() {
    Sound.compressOn(false); Sound.lose(); hideJoy(); ptr.steer = null; ptr.comp.clear();
    if (S().set.vibro) Platform.vibrate([80, 60, 80]);
    if (!run.revived && world.peak > 40) setTimeout(() => { if (!run || run.ended) return; state = "revive"; UI.open("ovRevive"); }, 900);
    else setTimeout(() => endRun(false), 1200);
  }
  $("rvAd").onclick = async () => {
    const ok = await Platform.rewarded();
    UI.close("ovRevive");
    if (ok) { run.revived = true; world.revive(); state = "run"; last = performance.now(); UI.banner("Рой возрождён", "#8dffc0"); }
    else { UI.toast("Реклама сейчас недоступна"); endRun(false); }
  };
  $("rvNo").onclick = () => { UI.close("ovRevive"); endRun(false); };

  function endRun(win) {
    if (!run || run.ended) return; run.ended = true; state = "result"; Platform.gameplay(false);
    Sound.compressOn(false); hideJoy();
    const d = S(), o = run.o, peak = Math.round(world.peak), kills = world.statKills;
    let light = Math.round(peak * 0.09 + kills * 4), title = win ? "Планета захвачена" : "Рой погас";
    const notes = [];
    d.stats.runs++; d.stats.kills += kills; d.stats.time += run.t;
    questAdd("peak", peak, true);
    let heroInfo = null;
    if (o.mode === "campaign" || o.mode === "boss") {
      heroInfo = o.info;
      const L = o.info.L, first = !d.captured[L];
      if (win) {
        light += Math.round((first ? 70 : 25) * (1 + L * 0.35));
        if (first) {
          d.captured[L] = true; d.prog = Math.max(d.prog, L + 1); questAdd("capture", 1);
          notes.push(["i-light", `Планета будет приносить <b>+${planetIncome(L)} света в час</b>, даже когда ты не играешь`]);
          if (Object.keys(d.captured).length === 1) d.energyT = Date.now();
          if (o.mode === "boss") {
            const sp = Math.min(8, o.info.s + 1);
            if (!d.species.includes(sp)) { d.species.push(sp); notes.push(["i-swarm", `Новый вид роя: <b>${SPECIES[sp].name}</b> — ${SPECIES[sp].bonus}`]); }
            if (o.info.s + 1 < SYSTEMS.length) notes.push(["i-galaxy", `Открыта система <b>«${SYSTEMS[o.info.s + 1].name}»</b>`]);
          }
        }
        if (o.mode === "boss") title = "Система свободна";
      } else notes.push(["i-beacon", "Подсказка: собирай свет и сжимайся в бою — сжатый рой сильнее рыхлого"]);
    } else if (o.mode === "endless") {
      questAdd("endless", 1);
      if (peak > d.bestEndless) { d.bestEndless = peak; notes.push(["i-crown", `<b>Новый рекорд!</b>`]); }
      else notes.push(["i-crown", `Рекорд: <b>${fmt(d.bestEndless)}</b>`]);
    } else if (o.mode === "daily") {
      title = win ? "Время вышло" : "Рой погас"; questAdd("daily", 1);
      if (d.daily.day !== todayKey()) d.daily = { day: todayKey(), best: 0 };
      if (peak > d.daily.best) { d.daily.best = peak; notes.push(["i-sun", "<b>Лучший результат дня!</b>"]); }
      light += 60;
    }
    d.light += light; Save.save();
    const share = o.mode !== "campaign" || win;
    $("resultCard").innerHTML = `<div class="hero"><div class="glow" style="${win ? "" : "background:radial-gradient(circle,rgba(255,94,122,.25),transparent 65%)"}"></div>${heroInfo ? '<canvas id="resPlanet" width="256" height="256"></canvas>' : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:96px;color:var(--gold);filter:drop-shadow(0 0 20px var(--gold))">${ic(o.mode === "endless" ? "i-inf" : "i-sun")}</div>`}</div>
      <h2>${title}</h2>${heroInfo ? `<div class="sub">${heroInfo.name}</div>` : ""}
      <div class="reward">${ic("i-light", "f")}<span id="resLight">0</span></div>
      <div class="statrow"><div>${ic("i-swarm")}<b>${fmt(peak)}</b><small>макс. рой</small></div><div>${ic("i-maw")}<b>${kills}</b><small>${plural(kills, "победа", "победы", "побед")}</small></div><div>${ic("i-clock")}<b>${Math.floor(run.t / 60)}:${String(Math.floor(run.t % 60)).padStart(2, "0")}</b><small>время</small></div></div>
      ${notes.map(n => `<div class="note">${ic(n[0], n[0] === "i-light" ? "f" : "")}<span>${n[1]}</span></div>`).join("")}
      <div class="col"><button class="btn wide" id="rDouble">${ic("i-tv", "tv")}Удвоить награду</button>
      <div class="row" style="width:100%"><button class="btn teal" id="rNext" style="flex:1">${win && heroInfo && !heroInfo.boss ? "Дальше" : "Продолжить"}</button>${share ? `<button class="btn ghost" id="rShare" style="min-width:0;padding:15px 18px">${ic("i-share")}</button>` : ""}</div></div>`;
    if (heroInfo) $("resPlanet").getContext("2d").drawImage(Galaxy.planetSprite(heroInfo, 256), 0, 0);
    $("rDouble").onclick = async () => {
      const ok = await Platform.rewarded();
      if (ok) { d.light += light; Save.save(); $("rDouble").disabled = true; $("rDouble").textContent = "Награда удвоена"; UI.countUp($("resLight"), light * 2, 700); Sound.win(); }
      else UI.toast("Реклама сейчас недоступна");
    };
    $("rNext").onclick = async () => {
      Sound.click(); UI.close("ovResult");
      await Platform.interstitial();
      d.tut = Math.max(d.tut, 1); Save.save();
      run = null; world = null;
      if ((o.mode === "campaign" || o.mode === "boss") && win) goGalaxy(); else goMenu();
    };
    if ($("rShare")) $("rShare").onclick = async () => {
      const txt = o.mode === "endless" ? `Мой рой вырос до ${fmt(peak)} светлячков в «Звёздном рое»! Сможешь больше?`
        : o.mode === "daily" ? `Планета дня в «Звёздном рое»: ${fmt(peak)} светлячков. Попробуй обогнать!`
          : `Я захватил планету ${o.info.name} в «Звёздном рое», мой рой — ${fmt(peak)} светлячков!`;
      const r = await Platform.share(txt); if (r === "copied") UI.toast("Ссылка скопирована");
    };
    const thisRun = run; UI.close("ovMut"); UI.close("ovRevive");
    setTimeout(() => { if (run === thisRun) { UI.open("ovResult"); UI.countUp($("resLight"), light, 900); } }, win ? 200 : 600);
  }

  /* --- управление: плавающий джойстик --- */
  const JOY_R = 52;
  function isUi(e) { return e.target && e.target.closest && e.target.closest(".ov,.ibtn,#compBtn,.btn,.topbar,.mstack,.gbottom"); }
  function showJoy() { const j = $("joy"); j.style.display = "block"; j.style.left = ptr.ax + "px"; j.style.top = ptr.ay + "px"; moveKnob(); }
  function moveKnob() { const j = $("joy").firstChild; j.style.transform = `translate(${(ptr.cx - ptr.ax).toFixed(1)}px,${(ptr.cy - ptr.ay).toFixed(1)}px)`; }
  function hideJoy() { $("joy").style.display = "none"; }
  const steerable = () => state === "run" || state === "menu";
  window.addEventListener("pointerdown", e => {
    Sound.ensure();
    if (!steerable() || isUi(e)) return;
    if (state === "menu") { ptr.touched = true; $("touchHint").style.opacity = "0"; }
    if (e.pointerType === "mouse") { if (e.button === 0 && state === "run") ptr.comp.add("mouse"); return; }
    if (ptr.steer == null) { ptr.steer = e.pointerId; ptr.ax = ptr.cx = e.clientX; ptr.ay = ptr.cy = e.clientY; showJoy(); }
    else if (state === "run") ptr.comp.add(e.pointerId);
  });
  window.addEventListener("pointermove", e => {
    if (e.pointerType === "mouse") {
      ptr.mouse = true; ptr.mx = e.clientX; ptr.my = e.clientY;
      if (state === "menu" && !ptr.touched && !isUi(e)) { ptr.touched = true; $("touchHint").style.opacity = "0"; }
      return;
    }
    if (e.pointerId !== ptr.steer) return;
    ptr.cx = e.clientX; ptr.cy = e.clientY;
    const dx = ptr.cx - ptr.ax, dy = ptr.cy - ptr.ay, l = Math.hypot(dx, dy);
    if (l > JOY_R) { ptr.ax = ptr.cx - dx / l * JOY_R; ptr.ay = ptr.cy - dy / l * JOY_R; const j = $("joy"); j.style.left = ptr.ax + "px"; j.style.top = ptr.ay + "px"; }
    moveKnob();
  });
  const up = e => {
    if (e.pointerType === "mouse") { ptr.comp.delete("mouse"); return; }
    if (e.pointerId === ptr.steer) { ptr.steer = null; hideJoy(); }
    ptr.comp.delete(e.pointerId);
  };
  window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  const cb = $("compBtn");
  cb.addEventListener("pointerdown", e => { e.stopPropagation(); ptr.comp.add("btn" + e.pointerId); cb.setPointerCapture && cb.setPointerCapture(e.pointerId); if (run && run.tut && !run.tutStep) run.tutStep = 1; });
  const cbUp = e => ptr.comp.delete("btn" + e.pointerId);
  cb.addEventListener("pointerup", cbUp); cb.addEventListener("pointercancel", cbUp); cb.addEventListener("lostpointercapture", cbUp);
  window.addEventListener("keydown", e => { ptr.keys[e.code] = true; if (e.code === "Escape" && state === "run") pause(); });
  window.addEventListener("keyup", e => { ptr.keys[e.code] = false; });
  window.addEventListener("contextmenu", e => e.preventDefault());

  function readInput(dt, w) {
    const P = w.player, k = ptr.keys;
    if (window.__autopilot && w === world) { const a = window.__autopilot(w); input.dx = a.dx; input.dy = a.dy; input.mag = a.mag; input.compress = !!a.compress; return; }
    let dx = 0, dy = 0, mag = 0;
    const kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), ky = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); dx = kx / l; dy = ky / l; mag = 1; }
    else if (ptr.steer != null) { const vx = ptr.cx - ptr.ax, vy = ptr.cy - ptr.ay, l = Math.hypot(vx, vy); if (l > 5) { dx = vx / l; dy = vy / l; mag = clamp((l - 5) / (JOY_R - 15), 0, 1); } }
    else if (ptr.mouse && P) { const [px, py] = screenOf(P.x, P.y), vx = ptr.mx - px, vy = ptr.my - py, l = Math.hypot(vx, vy); if (l > 10) { dx = vx / l; dy = vy / l; mag = clamp((l - 10) / 110, 0, 1); } }
    if (mag === 0 && input.mag > 0) { mag = Math.max(0, input.mag - dt * 2.2); dx = input.dx; dy = input.dy; }
    input.dx = dx; input.dy = dy; input.mag = mag;
    input.compress = state === "run" && (ptr.comp.size > 0 || !!k.Space || !!k.ShiftLeft || !!k.ShiftRight);
  }
  // в меню рой плавает сам, пока его не трогают
  function menuInput(t) {
    if (ptr.steer != null || (ptr.mouse && ptr.touched)) return null;
    const P = menuWorld.player, a = t * 0.35;
    const tx = Math.cos(a) * 600, ty = Math.sin(a * 1.3) * 420, dx = tx - P.x, dy = ty - P.y, l = Math.hypot(dx, dy) || 1;
    return { dx: dx / l, dy: dy / l, mag: clamp(l / 300, 0.25, 0.7), compress: false };
  }

  /* --- пауза --- */
  function pause() { if (state !== "run") return; state = "paused"; Sound.compressOn(false); hideJoy(); ptr.steer = null; ptr.comp.clear(); UI.open("ovPause"); }
  $("bPause").onclick = () => { Sound.click(); pause(); };
  $("pResume").onclick = () => { Sound.click(); UI.close("ovPause"); state = "run"; last = performance.now(); };
  $("pSettings").onclick = () => { Sound.click(); openSettings(); };
  $("pQuit").onclick = () => { Sound.click(); UI.close("ovPause"); state = "run"; world.over = true; endRun(false); };

  /* --- главный цикл --- */
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    if (state === "run" && world) {
      readInput(dt, world);
      world.update(dt, input);
      run.t += dt;
      if (run.timer) { run.timer -= dt; if (run.timer <= 0 && !run.ended) { run.timer = 0.0001; world.won = true; Sound.win(); endRun(true); } }
      if (run.tut) tutorial();
      world.draw(); updateHud(dt);
      perf(dt);
    } else if ((state === "result" || state === "revive" || state === "mut" || state === "paused") && world) {
      if (state === "result" || state === "revive") world.update(dt * 0.3, { dx: 0, dy: 0, mag: 0, compress: false });
      world.draw();
    } else if (state === "menu" && menuWorld) {
      readInput(dt, menuWorld);
      const auto = menuInput(menuWorld.t);
      menuWorld.update(dt, auto || input); menuWorld.draw();
    }
    requestAnimationFrame(frame);
  }
  function tutorial() {
    const t = run.t;
    if (t > 7 && !run.tutStep) { run.tutStep = 0.5; hint("Зажми кнопку справа: рой сожмётся в копьё — быстрее и сильнее", 5000); }
    if (t > 16 && run.tutStep < 3 && world.beacons.length) { run.tutStep = 3; hint("Зажги 3 маяка, чтобы захватить планету. Стрелки покажут путь", 5000); }
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
  function buyRow(id, icon, name, desc, lv, max, cost, onBuy) {
    const d = S(), e = document.createElement("div"); e.className = "item"; const full = lv >= max;
    e.innerHTML = `${orb(id, icon)}<div class="info"><b>${name}</b><span>${full ? "Максимальный уровень" : desc}</span><div class="lv">${Array.from({ length: max }, (_, i) => `<i class="${i < lv ? "f" : ""}"></i>`).join("")}</div></div>
      <button class="btn small" ${full || d.light < cost ? "disabled" : ""}>${full ? "Макс." : `<span class="price">${ic("i-light", "f")}${fmt(cost)}</span>`}</button>`;
    e.querySelector("button").onclick = () => { if (d.light < cost || full) return; d.light -= cost; onBuy(); Save.save(); Sound.mutation(); renderShop(); refreshMenu(); };
    return e;
  }
  function renderShop() {
    const d = S(), L = $("shopList"); L.innerHTML = "";
    document.querySelectorAll(".lightv").forEach(e => e.textContent = fmt(d.light));
    document.querySelectorAll(".shardv").forEach(e => e.textContent = d.shards + "/10");
    if (shopTab === "upg") UPGRADES.forEach(u => L.appendChild(buyRow(u.id, UICON[u.id], u.name, u.desc(d.upg[u.id]), d.upg[u.id], UPG_MAX, upgCost(u, d.upg[u.id]), () => d.upg[u.id]++)));
    else if (shopTab === "sp") {
      const h = document.createElement("p"); h.innerHTML = `10 осколков открывают следующий вид. У тебя <b>${d.shards}</b>`; L.appendChild(h);
      SPECIES.forEach((sp, i) => {
        const own = d.species.includes(i), e = document.createElement("div"); e.className = "item" + (d.cur === i ? " sel" : "") + (own ? "" : " locked");
        const c1 = rgbStr(hsl(sp.hue, 95, 62)), c2 = rgbStr(hsl(sp.spread >= 360 ? sp.hue + 180 : sp.hue + sp.spread / 2, 95, 45));
        const how = i === 8 ? "Позови друга или собери осколки" : i > 0 ? `Победи владыку «${SYSTEMS[i - 1].name}» или собери осколки` : "";
        e.innerHTML = `<div class="orb" style="--c1:${c1};--c2:${c2}">${ic(own ? "i-swarm" : "i-lock")}</div>
          <div class="info"><b>${sp.name}</b><span>${own ? sp.bonus : how}</span></div>
          ${own ? `<button class="btn small ${d.cur === i ? "ghost" : "teal"}">${d.cur === i ? "Выбран" : "Выбрать"}</button>` : ""}`;
        if (own) e.querySelector("button").onclick = () => { d.cur = i; Save.save(); Sound.click(); renderShop(); };
        L.appendChild(e);
      });
    } else {
      const r = energyRate(), h = document.createElement("p");
      h.innerHTML = r ? `Захваченные планеты дают <b>+${fmt(r)} света в час</b>` : "Станции заработают, когда захватишь первую планету"; L.appendChild(h);
      STATIONS.forEach(s => L.appendChild(buyRow(s.id, UICON[s.id], s.name, s.desc(d.st[s.id]), d.st[s.id], 10, upgCost(s, d.st[s.id]), () => d.st[s.id]++)));
    }
  }

  /* --- задания --- */
  function openQuests() { dailyRefresh(); renderQuests(); UI.open("ovQuests"); }
  function renderQuests() {
    const d = S();
    $("days").innerHTML = LOGIN.map((r, i) => {
      const day = (d.login.streak - 1) % 7, got = i < day || (i === day && d.login.claimed);
      return `<div class="${got ? "got" : ""} ${i === day ? "now" : ""}">${i + 1}${ic(r.sh ? "i-shard" : "i-light", "f")}<b>${r.l ? r.l : ""}${r.sh ? (r.l ? "+" : "") + r.sh : ""}</b></div>`;
    }).join("");
    const L = $("qList"); L.innerHTML = "";
    d.quests.list.forEach(q => {
      const def = QUESTS.find(x => x.id === q.id), done = q.p >= q.goal, rw = Math.round(def.r * (1 + d.prog * 0.15));
      const e = document.createElement("div"); e.className = "item";
      e.innerHTML = `${orb(done ? "value" : "magnet", def.icon)}<div class="info"><b>${def.t(q.goal)}</b><span>${fmt(Math.min(q.p, q.goal))} из ${fmt(q.goal)}</span><div class="qbar"><div style="width:${Math.min(100, q.p / q.goal * 100)}%"></div></div></div>
        <button class="btn small ${q.claimed ? "ghost" : ""}" ${!done || q.claimed ? "disabled" : ""}>${q.claimed ? "Получено" : `<span class="price">${ic("i-light", "f")}${rw}</span>`}</button>`;
      e.querySelector("button").onclick = () => { if (!done || q.claimed) return; q.claimed = true; d.light += rw; addShards(1); Save.save(); Sound.win(); renderQuests(); refreshMenu(); };
      L.appendChild(e);
    });
    const c = $("bChest");
    if (d.chest.n === 0) { c.innerHTML = ic("i-chest") + "Бесплатный контейнер"; c.disabled = false; }
    else if (d.chest.n < 6) { c.innerHTML = ic("i-tv") + `Контейнер за рекламу (${6 - d.chest.n})`; c.disabled = false; }
    else { c.innerHTML = ic("i-chest") + "Новые контейнеры завтра"; c.disabled = true; }
  }
  $("bChest").onclick = async () => {
    const d = S(); if (d.chest.n >= 6) return;
    if (d.chest.n > 0) { const ok = await Platform.rewarded(); if (!ok) { UI.toast("Реклама сейчас недоступна"); return; } }
    d.chest.n++; const sh = 2 + Math.floor(Math.random() * 2), l = 40 + Math.floor(Math.random() * 40) + d.prog * 5;
    d.light += l; const un = addShards(sh, true); Save.save(); Sound.win();
    UI.toast(`В контейнере: ${l} света и ${sh} ${plural(sh, "осколок", "осколка", "осколков")}` + (un != null ? `. Новый вид: ${SPECIES[un].name}!` : ""), 3200);
    renderQuests(); refreshMenu();
  };

  /* --- настройки --- */
  function openSettings() {
    const s = S().set;
    document.querySelectorAll("#ovSettings .tgl").forEach(t => { t.classList.toggle("on", !!s[t.dataset.s]); });
    $("bQual").textContent = ["Авто", "Низкая", "Средняя", "Высокая"][s.q + 1];
    UI.open("ovSettings");
  }
  document.querySelectorAll("#ovSettings .tgl").forEach(t => t.onclick = () => {
    const s = S().set; s[t.dataset.s] = !s[t.dataset.s]; t.classList.toggle("on", s[t.dataset.s]); applySettings(); Save.save(); Sound.click();
  });
  $("bQual").onclick = () => {
    const s = S().set; s.q = s.q >= 2 ? -1 : s.q + 1; $("bQual").textContent = ["Авто", "Низкая", "Средняя", "Высокая"][s.q + 1];
    Render.setQuality(s.q >= 0 ? s.q : guessQuality()); Save.save(); Sound.click();
  };
  function applySettings() { const s = S().set; Sound.setSfx(s.sound); Sound.setMusic(s.music); }

  /* --- кнопки меню --- */
  $("bPlay").onclick = () => {
    Sound.ensure(); Sound.click();
    const d = S();
    if (d.tut < 1) { startRun({ mode: "campaign", info: planetInfo(d.gseed, 0, 0) }); return; }
    if (Object.keys(d.captured).length >= SYSTEMS.length * PLANETS_PER_SYS) { goGalaxy(); return; }
    openPlanet(nextPlanet(), "open");
  };
  $("contCard").onclick = () => { Sound.click(); goGalaxy(); };
  $("bGalaxy").onclick = () => { Sound.ensure(); Sound.click(); if (S().tut < 1) { UI.toast("Сначала захвати первую планету"); return; } goGalaxy(); };
  $("bEndless").onclick = () => { Sound.ensure(); Sound.click(); if (S().prog < 2) { UI.toast("Откроется после захвата двух планет"); return; } startRun({ mode: "endless" }); };
  $("bDaily").onclick = () => {
    Sound.ensure(); Sound.click();
    if (S().prog < 1) { UI.toast("Откроется после захвата первой планеты"); return; }
    const d = S(), k = todayKey(), r = mulberry32(k), bk = BIOME_KEYS[Math.floor(r() * 7)];
    UI.msg(`${orb("stamina", "i-sun", 76)}<h2 style="margin-top:12px">Планета дня</h2><p>Сегодня она одна и та же для всех игроков. У тебя 3 минуты, чтобы вырастить самый большой рой.</p>
      <div class="chip">${BIOMES[bk].name}</div>${d.daily.day === k ? `<p>Твой лучший результат сегодня: <b>${fmt(d.daily.best)}</b></p>` : ""}`,
      [{ t: "Лететь", fn: () => startRun({ mode: "daily" }) }, { t: "Позже", cls: "ghost small" }]);
  };
  $("bShop").onclick = () => { Sound.ensure(); Sound.click(); shopTab = "upg"; document.querySelectorAll("#ovShop .tabs button").forEach(x => x.classList.toggle("on", x.dataset.t === "upg")); openShop(); };
  $("bQuests").onclick = () => { Sound.ensure(); Sound.click(); openQuests(); };
  $("bSettings").onclick = () => { Sound.ensure(); Sound.click(); openSettings(); };
  $("gBack").onclick = () => { Sound.click(); if (!Galaxy.back()) goMenu(); };
  $("bCollect").onclick = async () => {
    const d = S(), v = Math.floor(energyNow()); if (v < 1) return;
    d.light += v; d.energyT = Date.now(); Save.save(); Sound.win(); refreshMenu();
    UI.msg(`${orb("start", "i-light", 76)}<h2 style="margin-top:12px">Энергия собрана</h2><div class="reward">${ic("i-light", "f")}${fmt(v)}</div><p>Планеты продолжают копить свет, пока тебя нет</p>`,
      [{ t: ic("i-tv", "tv") + "Удвоить", fn: async () => { const ok = await Platform.rewarded(); if (ok) { d.light += v; Save.save(); refreshMenu(); UI.toast("Удвоено: ещё " + fmt(v) + " света"); } else UI.toast("Реклама сейчас недоступна"); } }, { t: "Забрать", cls: "ghost small" }]);
  };
  $("bInvite").onclick = async () => {
    const ok = await Platform.invite();
    if (ok && !S().invited) { S().invited = true; if (!S().species.includes(8)) S().species.push(8); Save.save(); UI.msg(`<h2>Спасибо!</h2><p>Открыт редкий вид роя <b>«Созвездие»</b> — ${SPECIES[8].bonus}</p>`); }
  };
  $("bShare").onclick = async () => {
    const d = S(), n = Object.keys(d.captured).length;
    const r = await Platform.share(`Я строю свою галактику в «Звёздном рое»: ${n} ${plural(n, "планета", "планеты", "планет")} уже мои. Присоединяйся!`);
    if (r === "copied") UI.toast("Ссылка скопирована");
  };

  setInterval(() => { if (state === "galaxy") updateEnergyBox(); }, 1000);
  document.addEventListener("visibilitychange", () => { if (document.hidden) { pause(); Sound.suspend(); } else Sound.resume(); });
  window.__appPause = () => { pause(); Sound.suspend(); };
  window.__appResume = () => Sound.resume();
  window.addEventListener("resize", () => { Render.resize(); Galaxy.resize(); if (menuWorld) menuWorld.camOffY = innerHeight * 0.16; });

  /* --- запуск --- */
  async function boot() {
    Save.load();
    const autoq = Store.get("autoq", null), q = S().set.q >= 0 ? S().set.q : (autoq != null ? autoq : guessQuality());
    Render.setQuality(q);
    if (!Render.init($("gl"))) { $("nogl").style.display = "flex"; return; }
    Render.setQuality(q);
    Galaxy.init($("ui2d"));
    applySettings();
    await Platform.init();
    const cloud = await Platform.cloudLoad(); Save.merge(cloud);
    const src = Platform.seedSource(); if (src && !S().seeded) { S().gseed = hashStr(src) % 1e9; S().seeded = true; Save.save(); }
    applySettings();
    if (!isTouch()) $("touchHint").textContent = "Поводи мышью — рой полетит за ней";
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
