'use strict';
(() => {
  const VERSION = 'V13.3-OBS-SAFE-MISSING-RPC-FIX1';
  const S = { timer: null, busy: false, disabled: false, lastResult: null, lastError: null };

  function cloud() { try { return typeof cloudState !== 'undefined' && cloudState ? cloudState : (window.cloudState || null); } catch (_) { return window.cloudState || null; } }

  async function rpc(name, args = {}) {
    const cs = cloud();
    if (!cs?.enabled || !cs?.user || !cs?.client) throw new Error('CLOUD_NOT_READY');
    const { data, error } = await cs.client.rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function heartbeat() {
    if (S.disabled || S.busy || document.visibilityState === 'hidden') return S.lastResult;
    S.busy = true;
    try {
      S.lastResult = await rpc('run_ai_observatory_cycle');
      S.lastError = null;
      window.dispatchEvent(new CustomEvent('xianxia:observatory-updated', { detail: S.lastResult }));
      return S.lastResult;
    } catch (error) {
      S.lastError = error?.message || String(error);
      const missingRpc = /run_ai_observatory_cycle|PGRST202|404|schema cache|Could not find the function/i.test(S.lastError);
      if (missingRpc) {
        S.disabled = true;
        stop();
        console.warn('[V13.3 Observatory] optional RPC unavailable; observatory disabled without affecting world loop');
      } else if (S.lastError !== 'CLOUD_NOT_READY') {
        console.warn('[V13.3 Observatory]', S.lastError);
      }
      return null;
    } finally {
      S.busy = false;
    }
  }

  async function getOverview() { return rpc('admin_get_ai_observatory'); }
  async function getReplay(id, limit = 200) {
    return rpc('admin_get_ai_replay', {
      p_cultivator_id: Number(id),
      p_limit: Math.max(1, Math.min(Number(limit) || 200, 1000))
    });
  }
  async function refreshSubjects() { return rpc('admin_refresh_ai_observation_subjects'); }
  async function resolveAlert(id) { return rpc('admin_resolve_ai_anomaly', { p_alert_id: Number(id) }); }

  function stop() {
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
  }

  function start() {
    stop();
    S.timer = setInterval(heartbeat, 20000);
    setTimeout(heartbeat, 6000);
  }

  window.V13_AI_OBSERVATORY = {
    version: VERSION,
    heartbeat,
    getOverview,
    getReplay,
    refreshSubjects,
    resolveAlert,
    start,
    stop,
    state: S
  };

  if (!window.XIANXIA_V13_EXTERNAL_SCHEDULER) {
    if (document.readyState === 'loading') {
      window.addEventListener('load', start, { once: true });
    } else {
      start();
    }
  }
})();
