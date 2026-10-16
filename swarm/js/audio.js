"use strict";
/* ===== Процедурный звук: перезвоны поглощения, гул сжатия, эмбиент ===== */

const Sound = (function () {
  let ac = null, master, sfx, music, comp, hum = null, humGain = null, musicTimer = null, noiseBuf = null;
  let sfxOn = true, musicOn = true, mood = 0, chimeT = 0, chimeStep = 0, lastPop = 0;
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const MOODS = [  // корень и лад для каждого биома
    { root: 57, scale: [0, 2, 4, 7, 9] },      // лес — мажорная пентатоника
    { root: 62, scale: [0, 2, 3, 7, 10] },     // лёд
    { root: 50, scale: [0, 1, 5, 7, 8] },      // вулкан
    { root: 55, scale: [0, 2, 5, 7, 9] },      // океан
    { root: 53, scale: [0, 3, 5, 7, 10] },     // пустыня
    { root: 48, scale: [0, 2, 3, 7, 8] },      // тьма
    { root: 60, scale: [0, 4, 6, 7, 11] },     // газ
    { root: 52, scale: [0, 2, 4, 6, 9] }       // ядро
  ];
  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ac) { if (ac.state === "suspended") ac.resume().catch(() => { }); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ac = new AC();
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
    sfx = ac.createGain(); sfx.gain.value = sfxOn ? 0.55 : 0; sfx.connect(master);
    music = ac.createGain(); music.gain.value = musicOn ? 0.32 : 0; music.connect(master);
    // эхо для музыки
    const dl = ac.createDelay(1); dl.delayTime.value = 0.42; const fb = ac.createGain(); fb.gain.value = 0.38;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
    music.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
    return true;
  }

  function tone(f, t0, dur, vol, type, dest, attack) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + (attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfx); o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  function noise(t0, dur, vol, f, q, dest) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q || 1;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp); bp.connect(g); g.connect(dest || sfx); s.start(t0); s.stop(t0 + dur + 0.05);
    return bp;
  }

  // перезвон поглощения: тон растёт с комбо
  function chime(combo) {
    if (!ac || !sfxOn) return; const t = ac.currentTime;
    if (t - chimeT < 0.045) return;
    chimeStep = t - chimeT > 0.9 ? 0 : Math.min(chimeStep + 1, PENTA.length - 1);
    chimeT = t;
    const m = MOODS[mood], n = m.root + 12 + PENTA[chimeStep];
    tone(freq(n), t, 0.35, 0.07, "sine"); tone(freq(n + 12), t, 0.18, 0.025, "triangle");
  }
  function pop(big) {
    if (!ac || !sfxOn) return; const t = ac.currentTime; if (t - lastPop < 0.06) return; lastPop = t;
    noise(t, big ? 0.5 : 0.18, big ? 0.35 : 0.14, big ? 900 : 2600, 0.8);
    if (big) { const o = tone(160, t, 0.6, 0.25, "sine"); o.frequency.exponentialRampToValueAtTime(40, t + 0.5); }
  }
  function crackle(v) {
    if (!ac || !sfxOn) return; const t = ac.currentTime; if (Math.random() > v) return;
    noise(t, 0.06, 0.05 + Math.random() * 0.05, 3000 + Math.random() * 3000, 3);
  }
  function compressOn(on) {
    if (!ac) return;
    const t = ac.currentTime;
    if (on && !hum) {
      hum = ac.createOscillator(); hum.type = "sawtooth"; hum.frequency.value = 55;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300;
      humGain = ac.createGain(); humGain.gain.value = 0;
      hum.connect(lp); lp.connect(humGain); humGain.connect(sfx); hum.start();
      humGain.gain.linearRampToValueAtTime(sfxOn ? 0.09 : 0, t + 0.15);
      hum.frequency.linearRampToValueAtTime(82, t + 1.2);
      lp.frequency.linearRampToValueAtTime(900, t + 1.2);
    } else if (!on && hum) {
      const h = hum, g = humGain; hum = null; humGain = null;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.2);
      h.stop(t + 0.25);
      noise(t, 0.25, 0.08, 500, 0.7);
    }
  }
  function win() {
    if (!ac || !sfxOn) return; const t = ac.currentTime, m = MOODS[mood];
    [0, 2, 4, 5, 7].forEach((k, i) => { const s = m.scale[k % 5] + (k >= 5 ? 12 : 0); tone(freq(m.root + 12 + s), t + i * 0.11, 1.2, 0.09, "triangle"); });
    tone(freq(m.root), t, 2.2, 0.12, "sine");
  }
  function lose() {
    if (!ac || !sfxOn) return; const t = ac.currentTime, m = MOODS[mood];
    [4, 2, 0].forEach((k, i) => tone(freq(m.root + 12 + m.scale[k]), t + i * 0.18, 0.9, 0.08, "sine"));
  }
  function beacon(p) {
    if (!ac || !sfxOn) return; const t = ac.currentTime, m = MOODS[mood];
    tone(freq(m.root + 24 + m.scale[Math.floor(p * 4.99)]), t, 0.25, 0.05, "sine");
  }
  function beaconLit() {
    if (!ac || !sfxOn) return; const t = ac.currentTime, m = MOODS[mood];
    tone(freq(m.root + 12), t, 1.6, 0.12, "sine"); tone(freq(m.root + 19), t + 0.05, 1.6, 0.08, "sine"); tone(freq(m.root + 24), t + 0.1, 1.8, 0.07, "triangle");
  }
  function click() { if (!ac || !sfxOn) return; tone(1200, ac.currentTime, 0.06, 0.05, "sine"); }
  function mutation() {
    if (!ac || !sfxOn) return; const t = ac.currentTime;
    for (let i = 0; i < 6; i++) tone(freq(72 + PENTA[i]), t + i * 0.05, 0.5, 0.05, "sine");
  }
  function warn() { if (!ac || !sfxOn) return; const t = ac.currentTime; tone(220, t, 0.3, 0.06, "square"); tone(220, t + 0.35, 0.3, 0.06, "square"); }

  // генеративный эмбиент
  function startMusic() {
    if (musicTimer) return;
    let beat = 0;
    musicTimer = setInterval(() => {
      if (!ac || ac.state !== "running" || !musicOn) return;
      const t = ac.currentTime + 0.05, m = MOODS[mood];
      if (beat % 16 === 0) {
        const chord = [0, 2, 4].map(k => m.root - 12 + m.scale[(k + (beat / 16 % 4 === 2 ? 3 : 0)) % 5]);
        chord.forEach(n => { const o = tone(freq(n), t, 7.5, 0.05, "triangle", music, 2.5); o.detune.value = (Math.random() - 0.5) * 12; });
      }
      if (Math.random() < 0.42) {
        const n = m.root + 12 + m.scale[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0);
        tone(freq(n), t, 2.4, 0.045, "sine", music, 0.02);
      }
      beat++;
    }, 460);
  }

  return {
    ensure, chime, pop, crackle, compressOn, win, lose, beacon, beaconLit, click, mutation, warn,
    setMood(i) { mood = clamp(i | 0, 0, MOODS.length - 1); },
    setSfx(on) { sfxOn = on; if (sfx) sfx.gain.value = on ? 0.55 : 0; },
    setMusic(on) { musicOn = on; if (music) music.gain.value = on ? 0.32 : 0; },
    suspend() { if (ac && ac.state === "running") ac.suspend().catch(() => { }); },
    resume() { if (ac && ac.state === "suspended") ac.resume().catch(() => { }); }
  };
})();
