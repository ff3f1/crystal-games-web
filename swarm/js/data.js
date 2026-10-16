"use strict";
/* ===== Данные игры: биомы, виды роя, мутации, улучшения, галактика ===== */

const BIOMES = {
  forest: { i: 0, name: "Изумрудный лес", desc: "Светящиеся цветы рассыпают свет", hue: 150, mote: 75, edge: [0.35, 1, 0.6],
    A: [0.01, 0.05, 0.04], B: [0.03, 0.16, 0.11], G: [0.1, 0.9, 0.55], neb: [150, 200] },
  ice: { i: 1, name: "Ледяной мир", desc: "Скользко! Сжатый рой разбивает кристаллы", hue: 195, mote: 190, edge: [0.5, 0.85, 1],
    A: [0.02, 0.05, 0.09], B: [0.08, 0.18, 0.28], G: [0.5, 0.9, 1], neb: [190, 230] },
  volcano: { i: 2, name: "Вулкан", desc: "Гейзеры жгут рой, огонь ускоряет", hue: 18, mote: 38, edge: [1, 0.45, 0.15],
    A: [0.05, 0.01, 0.01], B: [0.16, 0.04, 0.03], G: [1, 0.42, 0.08], neb: [0, 30] },
  ocean: { i: 3, name: "Океан-туманность", desc: "Течения несут всех по кругу", hue: 225, mote: 175, edge: [0.3, 0.5, 1],
    A: [0.01, 0.02, 0.07], B: [0.03, 0.07, 0.22], G: [0.25, 0.55, 1], neb: [215, 260] },
  desert: { i: 4, name: "Пустыня бурь", desc: "Бури разносят раскрытый рой — сжимайся", hue: 40, mote: 48, edge: [1, 0.8, 0.35],
    A: [0.05, 0.03, 0.01], B: [0.18, 0.11, 0.04], G: [1, 0.75, 0.3], neb: [25, 50] },
  dark: { i: 5, name: "Планета тьмы", desc: "Видно только то, что освещает рой", hue: 275, mote: 285, edge: [0.7, 0.4, 1],
    A: [0.02, 0.01, 0.04], B: [0.06, 0.03, 0.1], G: [0.65, 0.35, 1], neb: [260, 300] },
  gas: { i: 6, name: "Газовый гигант", desc: "Гравитационные колодцы: еда и опасность", hue: 320, mote: 330, edge: [1, 0.45, 0.85],
    A: [0.05, 0.01, 0.04], B: [0.18, 0.05, 0.15], G: [1, 0.4, 0.8], neb: [300, 345] },
  core: { i: 7, name: "Сердце галактики", desc: "Финальная битва", hue: 50, mote: 50, edge: [1, 0.95, 0.75],
    A: [0.04, 0.03, 0.05], B: [0.12, 0.09, 0.14], G: [1, 0.9, 0.6], neb: [0, 360] }
};
const BIOME_KEYS = ["forest", "ice", "volcano", "ocean", "desert", "dark", "gas", "core"];

const SPECIES = [
  { name: "Светлячки", hue: 58, spread: 18, bonus: "без особенностей", eff: {} },
  { name: "Искры", hue: 22, spread: 14, bonus: "+12% к силе в бою", eff: { dmg: 0.12 } },
  { name: "Медузы", hue: 188, spread: 20, bonus: "+25% к радиусу притяжения", eff: { magnet: 0.25 } },
  { name: "Пыльца", hue: 95, spread: 20, bonus: "+12% к ценности света", eff: { value: 0.12 } },
  { name: "Северное сияние", hue: 150, spread: 70, bonus: "+20% выносливости", eff: { stamina: 0.2 } },
  { name: "Пламя", hue: 4, spread: 16, bonus: "+10% к скорости", eff: { speed: 0.1 } },
  { name: "Кристальный", hue: 212, spread: 12, bonus: "−20% урона от опасностей", eff: { armor: 0.2 } },
  { name: "Тёмная материя", hue: 278, spread: 22, bonus: "+20% света за победы", eff: { kill: 0.2 } },
  { name: "Созвездие", hue: 0, spread: 360, bonus: "+6% ко всему", eff: { dmg: 0.06, magnet: 0.06, value: 0.06, stamina: 0.06, speed: 0.06, armor: 0.06, kill: 0.06 } }
];

const MUTATIONS = [
  { id: "dmg", name: "Искры", icon: "✦", max: 3, desc: "Сила в столкновениях +35%" },
  { id: "magnet", name: "Магнит", icon: "◎", max: 3, desc: "Свет притягивается издалека" },
  { id: "speed", name: "Стремительность", icon: "➶", max: 3, desc: "Скорость роя +18%" },
  { id: "stamina", name: "Выносливость", icon: "◐", max: 3, desc: "Сжатие расходует на 35% меньше сил" },
  { id: "armor", name: "Броня света", icon: "⬡", max: 3, desc: "Урон от опасностей −35%" },
  { id: "kill", name: "Поглотитель", icon: "◉", max: 3, desc: "Больше светлячков за победы над роями" },
  { id: "value", name: "Плодовитость", icon: "❀", max: 3, desc: "Каждая искра света ценнее на 30%" },
  { id: "comet", name: "Хвост кометы", icon: "☄", max: 2, desc: "За роем остаётся жгучий след" },
  { id: "nova", name: "Сверхновая", icon: "✺", max: 2, desc: "Сжатие с полной силой бьёт волной" },
  { id: "ghost", name: "Призрак", icon: "◌", max: 2, desc: "Первые секунды сжатия — неуязвимость" }
];

const UPGRADES = [
  { id: "start", name: "Стартовый рой", desc: lv => `${startSize(lv)} → ${startSize(lv + 1)} светлячков на старте`, base: 40, k: 1.5 },
  { id: "speed", name: "Скорость", desc: lv => `Скорость +${lv * 6}% → +${(lv + 1) * 6}%`, base: 50, k: 1.55 },
  { id: "magnet", name: "Притяжение", desc: lv => `Радиус сбора +${lv * 6}% → +${(lv + 1) * 6}%`, base: 50, k: 1.55 },
  { id: "power", name: "Сила", desc: lv => `Сила в бою +${lv * 8}% → +${(lv + 1) * 8}%`, base: 60, k: 1.58 },
  { id: "stamina", name: "Выносливость", desc: lv => `Запас сжатия +${lv * 10}% → +${(lv + 1) * 10}%`, base: 50, k: 1.55 }
];
const UPG_MAX = 15;
function startSize(lv) { return Math.round(30 * (1 + lv * 0.28)); }
function upgCost(u, lv) { return Math.round(u.base * Math.pow(u.k, lv) / 5) * 5; }

const STATIONS = [
  { id: "collector", name: "Сборщики", desc: lv => `Энергия в час +${lv * 25}% → +${(lv + 1) * 25}%`, base: 150, k: 1.7 },
  { id: "storage", name: "Хранилище", desc: lv => `Запас на ${4 + lv * 2} ч → ${6 + lv * 2} ч`, base: 120, k: 1.8 }
];

/* Галактика: 8 систем по 5 планет; 5-я — босс */
const SYSTEMS = [
  { name: "Колыбель", biome: "forest" },
  { name: "Иней", biome: "ice" },
  { name: "Горнило", biome: "volcano" },
  { name: "Бездна вод", biome: "ocean" },
  { name: "Песчаный венец", biome: "desert" },
  { name: "Затмение", biome: "dark" },
  { name: "Розовый гигант", biome: "gas" },
  { name: "Сердце", biome: "core" }
];
const PLANETS_PER_SYS = 5;
const PLANET_SYL = ["ка", "ро", "ли", "на", "ве", "ди", "то", "мо", "эй", "ра", "ни", "су", "ла", "ор", "эл", "ми", "та", "зо", "ри", "ан"];

function planetInfo(gseed, s, p) {
  const r = mulberry32(gseed * 31 + s * 977 + p * 131 + 7);
  const L = s * PLANETS_PER_SYS + p;
  const boss = p === PLANETS_PER_SYS - 1;
  const main = SYSTEMS[s].biome;
  let biome = main;
  if (!boss && s > 0 && (p === 1 || p === 3) && main !== "core") biome = BIOME_KEYS[Math.floor(r() * s)];
  if (main === "core" && !boss) biome = BIOME_KEYS[Math.floor(r() * 7)];
  let nm = ""; const k = 2 + Math.floor(r() * 2);
  for (let i = 0; i < k; i++) nm += PLANET_SYL[Math.floor(r() * PLANET_SYL.length)];
  nm = nm[0].toUpperCase() + nm.slice(1) + (r() < 0.4 ? "-" + (1 + Math.floor(r() * 9)) : "");
  const req = reqForLevel(L);
  return { s, p, L, boss, biome, name: boss ? "Владыка " + SYSTEMS[s].name.split(" ").pop().replace(/^./, c => c.toUpperCase()) : nm,
    req, seed: Math.floor(r() * 1e9), size: 0.75 + r() * 0.5, hueShift: (r() - 0.5) * 30, rings: r() < 0.3 };
}
function reqForLevel(L) {
  const b = 70 * Math.pow(1 + L * 0.42, 1.55);
  return [Math.round(b * 0.7 / 5) * 5, Math.round(b / 5) * 5, Math.round(b * 1.35 / 5) * 5];
}
function planetIncome(L) { return Math.round(25 * (1 + L * 0.3)); }   // света в час
