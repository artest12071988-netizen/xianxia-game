'use strict';

(() => {
  const cfg = window.XIANXIA_GAM_BRIDGE_CONFIG || {};
  const VERSION = cfg.version || 'V13.3-FIX1';
  const GPT_URL = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';

  let gptPromise = null;
  let active = false;

  function debug(...args) {
    if (cfg.debug) console.info('[V13.3 GAM Bridge]', ...args);
  }

  function ensureGpt() {
    if (window.googletag?.apiReady) return Promise.resolve(window.googletag);
    if (gptPromise) return gptPromise;

    window.googletag = window.googletag || { cmd: [] };

    gptPromise = new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => script.src === GPT_URL);

      const waitUntilReady = () => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
          if (window.googletag?.apiReady) {
            clearInterval(timer);
            resolve(window.googletag);
            return;
          }
          if (Date.now() - startedAt > 15000) {
            clearInterval(timer);
            reject(new Error('Google Publisher Tag 載入逾時'));
          }
        }, 100);
      };

      if (existing) {
        waitUntilReady();
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.src = GPT_URL;
      script.crossOrigin = 'anonymous';
      script.onload = waitUntilReady;
      script.onerror = () => reject(new Error('Google Publisher Tag 載入失敗'));
      document.head.appendChild(script);
    });

    return gptPromise;
  }

  async function show({ adUnitId, sessionId, rewardType } = {}) {
    if (active) throw new Error('已有獎勵廣告正在處理');
    if (!String(adUnitId || '').trim()) throw new Error('廣告單元尚未設定');

    await ensureGpt();
    active = true;

    return new Promise((resolve, reject) => {
      const timeoutMs = Math.max(10000, Number(cfg.timeoutMs || 45000));

      window.googletag.cmd.push(() => {
        const pubads = window.googletag.pubads();
        const slot = window.googletag.defineOutOfPageSlot(
          String(adUnitId),
          window.googletag.enums.OutOfPageFormat.REWARDED
        );

        if (!slot) {
          active = false;
          reject(new Error('目前裝置或頁面不支援獎勵廣告'));
          return;
        }

        slot.addService(pubads);

        let granted = false;
        let settled = false;
        let closed = false;

        const finish = (error = null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);

          if (error) reject(error);
          else resolve({
            granted: true,
            sessionId: String(sessionId || ''),
            rewardType: String(rewardType || ''),
            provider: 'google_ad_manager'
          });
        };

        const cleanup = () => {
          pubads.removeEventListener('rewardedSlotReady', onReady);
          pubads.removeEventListener('rewardedSlotGranted', onGranted);
          pubads.removeEventListener('rewardedSlotClosed', onClosed);
          pubads.removeEventListener('slotRenderEnded', onRenderEnded);
          window.googletag.destroySlots([slot]);
          active = false;
        };

        const onReady = event => {
          if (event.slot !== slot) return;
          debug('rewardedSlotReady', { sessionId, rewardType });
          const shown = event.makeRewardedVisible();
          if (shown === false) {
            cleanup();
            finish(new Error('獎勵廣告無法顯示'));
          }
        };

        const onGranted = event => {
          if (event.slot !== slot) return;
          granted = true;
          debug('rewardedSlotGranted', event.payload || null);
          finish();
        };

        const onClosed = event => {
          if (event.slot !== slot) return;
          closed = true;
          debug('rewardedSlotClosed', { granted });
          cleanup();
          if (!granted) finish(new Error('廣告未完整觀看，因此沒有獎勵'));
        };

        const onRenderEnded = event => {
          if (event.slot !== slot) return;
          if (event.isEmpty) {
            debug('slotRenderEnded: empty');
            cleanup();
            finish(new Error('目前沒有可播放的獎勵廣告'));
          }
        };

        pubads.addEventListener('rewardedSlotReady', onReady);
        pubads.addEventListener('rewardedSlotGranted', onGranted);
        pubads.addEventListener('rewardedSlotClosed', onClosed);
        pubads.addEventListener('slotRenderEnded', onRenderEnded);

        const timeout = setTimeout(() => {
          if (closed) return;
          cleanup();
          finish(new Error('等待獎勵廣告逾時'));
        }, timeoutMs);

        window.googletag.enableServices();
        window.googletag.display(slot);
      });
    });
  }

  window.XIANXIA_REWARDED_AD_PROVIDER = {
    version: VERSION,
    show,
    ensureGpt,
    get active() {
      return active;
    }
  };

  debug('loaded', VERSION);
})();
