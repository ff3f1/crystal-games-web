"use strict";
/* ===== Платформы: Android (Яндекс Mobile Ads), VK (VK Bridge), Яндекс Игры, обычный веб ===== */

const Platform = (function () {
  const q = location.search;
  const kind = window.AndroidAds ? "android" : /vk_app_id=/.test(q) ? "vk" : (/yandex|playhop/.test(location.hostname) || /[?&]yg=1/.test(q)) ? "yandex" : "web";
  let bridge = null, ysdk = null, busy = false, seq = 0, vkUser = null;
  const pending = {};
  window.__adResult = function (id, ok) { if (pending[id]) { pending[id](!!ok); delete pending[id]; } };

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }

  async function init() {
    if (kind === "vk") {
      try { await loadScript("vk-bridge.min.js"); } catch (e) { try { await loadScript("https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"); } catch (e2) { } }
      bridge = window.vkBridge;
      if (bridge) {
        try { await bridge.send("VKWebAppInit"); } catch (e) { }
        try { vkUser = await bridge.send("VKWebAppGetUserInfo"); } catch (e) { }
      }
    } else if (kind === "yandex") {
      try { await loadScript("/sdk.js"); ysdk = await window.YaGames.init(); } catch (e) { ysdk = null; }
    }
  }
  function ready() { try { if (ysdk && ysdk.features && ysdk.features.LoadingAPI) ysdk.features.LoadingAPI.ready(); } catch (e) { } }
  function gameplay(on) { try { if (ysdk && ysdk.features && ysdk.features.GameplayAPI) on ? ysdk.features.GameplayAPI.start() : ysdk.features.GameplayAPI.stop(); } catch (e) { } }

  async function show(type) {
    if (busy) return false; busy = true; Sound.suspend(); let ok = false;
    try {
      if (kind === "vk" && bridge) {
        const r = await bridge.send("VKWebAppShowNativeAds", { ad_format: type === "reward" ? "reward" : "interstitial" }); ok = !!(r && r.result);
      } else if (kind === "android") {
        ok = await new Promise(res => {
          const id = ++seq; pending[id] = res;
          type === "reward" ? window.AndroidAds.showRewarded(id) : window.AndroidAds.showInterstitial(id);
          setTimeout(() => { if (pending[id]) { pending[id](false); delete pending[id]; } }, 60e3);
        });
      } else if (kind === "yandex" && ysdk) {
        ok = await new Promise(res => {
          if (type === "reward") {
            let got = false;
            ysdk.adv.showRewardedVideo({ callbacks: { onRewarded: () => { got = true; }, onClose: () => res(got), onError: () => res(false) } });
          } else ysdk.adv.showFullscreenAdv({ callbacks: { onClose: (shown) => res(!!shown), onError: () => res(false) } });
        });
      } else {
        const o = document.getElementById("adov"); o.classList.add("on");
        await new Promise(r => setTimeout(r, 1200)); o.classList.remove("on"); ok = true;
      }
    } catch (e) { ok = false; }
    busy = false; Sound.resume(); return ok;
  }

  let lastInter = Date.now();
  const bootT = Date.now();
  return {
    kind, init, ready, gameplay,
    get user() { return vkUser; },
    rewarded() { return show("reward"); },
    async interstitial() {
      if (Date.now() - lastInter < 180e3 || Date.now() - bootT < 300e3) return false;
      const ok = await show("inter"); if (ok) lastInter = Date.now(); return ok;
    },
    vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } },
    get social() { return kind === "vk" && !!bridge; },
    async share(text) {
      const link = kind === "vk" ? "https://vk.com/app" + (q.match(/vk_app_id=(\d+)/) || [])[1] : "https://ff3f1.github.io/crystal-games-web/swarm/";
      if (kind === "vk" && bridge) {
        try { await bridge.send("VKWebAppShowWallPostBox", { message: text + "\n" + link, attachments: link }); return true; } catch (e) { return false; }
      }
      try { if (navigator.share) { await navigator.share({ title: "Звёздный рой", text, url: link }); return true; } } catch (e) { return false; }
      try { await navigator.clipboard.writeText(text + " " + link); return "copied"; } catch (e) { return false; }
    },
    async invite() {
      if (kind === "vk" && bridge) { try { await bridge.send("VKWebAppShowInviteBox"); return true; } catch (e) { return false; } }
      return false;
    },
    // облачное сохранение VK (ключ до 4096 символов)
    async cloudLoad() {
      if (!(kind === "vk" && bridge)) return null;
      try { const r = await bridge.send("VKWebAppStorageGet", { keys: ["save"] }); const v = r && r.keys && r.keys[0] && r.keys[0].value; return v ? JSON.parse(v) : null; } catch (e) { return null; }
    },
    cloudSave(obj) {
      if (!(kind === "vk" && bridge)) return;
      try { const s = JSON.stringify(obj); if (s.length < 4000) bridge.send("VKWebAppStorageSet", { key: "save", value: s }).catch(() => { }); } catch (e) { }
    },
    seedSource() {
      if (vkUser && vkUser.id) return "vk" + vkUser.id;
      return null;
    }
  };
})();
