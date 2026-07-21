'use strict';

(() => {
  const BUILD = 'V14.5D-20260721';
  const PENDING_KEY = 'xianxia_maintenance_pending';
  const FORCED_KEY = 'xianxia_maintenance_forced_revision';
  const state = {
    client: null,
    ownClient: false,
    revision: -1,
    enabled: false,
    handling: false,
    channel: null,
    pollTimer: null
  };

  function getConfig() {
    return window.XIANXIA_ONLINE_CONFIG || {};
  }

  function getClient() {
    if (state.client) return state.client;
    try {
      if (typeof cloudState !== 'undefined' && cloudState.client) {
        state.client = cloudState.client;
        return state.client;
      }
    } catch (_) {}
    const cfg = getConfig();
    if (window.supabase && cfg.supabaseUrl && cfg.supabasePublishableKey) {
      state.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      state.ownClient = true;
    }
    return state.client;
  }

  function injectGate() {
    let gate = document.getElementById('v145dMaintenanceGate');
    if (gate) return gate;
    gate = document.createElement('div');
    gate.id = 'v145dMaintenanceGate';
    gate.setAttribute('role', 'alertdialog');
    gate.setAttribute('aria-modal', 'true');
    gate.innerHTML = `
      <div class="maintenance-shell">
        <div class="maintenance-seal">維</div>
        <h2>天地暫封・伺服器維護</h2>
        <p id="v145dMaintenanceMessage">伺服器正在更新，請稍後重新登入。</p>
        <div class="maintenance-progress" id="v145dMaintenanceProgress">正在確認世界狀態…</div>
        <div class="maintenance-revision" id="v145dMaintenanceRevision">${BUILD}</div>
      </div>
    `;
    document.body.appendChild(gate);
    return gate;
  }

  function showGate(message, revision, progress) {
    const gate = injectGate();
    gate.classList.add('on');
    document.body.classList.add('v145d-maintenance-locked');
    const msg = document.getElementById('v145dMaintenanceMessage');
    const rev = document.getElementById('v145dMaintenanceRevision');
    const status = document.getElementById('v145dMaintenanceProgress');
    if (msg) msg.textContent = message || '伺服器正在更新，請稍後重新登入。';
    if (rev) rev.textContent = `維護版本 ${revision ?? '—'}｜${BUILD}`;
    if (status) status.textContent = progress || '維護期間禁止登入。';
  }

  function hideGate() {
    const gate = document.getElementById('v145dMaintenanceGate');
    if (gate) gate.classList.remove('on');
    document.body.classList.remove('v145d-maintenance-locked');
  }

  function unpack(data) {
    return Array.isArray(data) ? data[0] : data;
  }

  async function fetchState() {
    const client = getClient();
    if (!client) return null;
    const { data, error } = await client.rpc('maintenance_get_state');
    if (error) throw error;
    return unpack(data);
  }

  function cacheBustUrl(revision) {
    const url = new URL(location.href);
    url.searchParams.set('update', String(revision || Date.now()));
    url.searchParams.delete('maintenance');
    return url.toString();
  }

  async function withTimeout(promise, milliseconds) {
    return Promise.race([
      promise,
      new Promise(resolve => setTimeout(() => resolve(null), milliseconds))
    ]);
  }

  function stopGameLoops() {
    try { if (typeof tickTimer !== 'undefined') clearInterval(tickTimer); } catch (_) {}
    try { if (typeof aiTimer !== 'undefined') clearInterval(aiTimer); } catch (_) {}
  }

  async function saveAndDisconnect(info) {
    if (state.handling) return;
    state.handling = true;
    const revision = Number(info.revision || 0);
    localStorage.setItem(PENDING_KEY, JSON.stringify({
      revision,
      message: info.message || '',
      at: Date.now()
    }));
    showGate(info.message, revision, '正在保存道體並退出世界…');
    stopGameLoops();

    try {
      if (typeof saveGame === 'function') saveGame(false);
      if (typeof flushCloudSave === 'function') {
        await withTimeout(Promise.resolve(flushCloudSave(true)), 6000);
      }
    } catch (error) {
      console.warn('[V14.5D] final save failed', error);
    }

    const client = getClient();
    try {
      if (client) await withTimeout(client.rpc('leave_player_presence'), 1800);
    } catch (_) {}

    try {
      if (client) await withTimeout(client.auth.signOut({ scope: 'local' }), 2500);
    } catch (_) {}

    localStorage.setItem(FORCED_KEY, String(revision));
    showGate(info.message, revision, '已安全離線，等待管理員完成更新。');
    setTimeout(() => location.replace(cacheBustUrl(revision)), 350);
  }

  async function applyState(info, initial = false) {
    if (!info) return;
    const revision = Number(info.revision || 0);
    const enabled = Boolean(info.enabled);
    const previousRevision = state.revision;
    state.revision = revision;
    state.enabled = enabled;

    if (enabled) {
      showGate(info.message, revision, '維護期間禁止登入。');
      const forcedRevision = Number(localStorage.getItem(FORCED_KEY) || -1);
      let hasSession = false;
      try {
        const client = getClient();
        if (client) {
          const { data } = await client.auth.getSession();
          hasSession = Boolean(data?.session);
        }
      } catch (_) {}
      if ((hasSession || (typeof g !== 'undefined' && g)) && forcedRevision !== revision) {
        await saveAndDisconnect(info);
      }
      return;
    }

    const pending = localStorage.getItem(PENDING_KEY);
    if (pending) {
      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(FORCED_KEY);
      showGate(info.message || '更新完成。', revision, '更新完成，正在載入最新版本…');
      setTimeout(() => location.replace(cacheBustUrl(revision)), 450);
      return;
    }

    if (!initial && previousRevision >= 0 && revision !== previousRevision) {
      showGate(info.message || '版本已更新。', revision, '世界版本已變更，正在重新載入…');
      setTimeout(() => location.replace(cacheBustUrl(revision)), 450);
      return;
    }

    hideGate();
  }

  async function check(initial = false) {
    try {
      const info = await fetchState();
      await applyState(info, initial);
    } catch (error) {
      const pending = localStorage.getItem(PENDING_KEY);
      if (pending) {
        let info = {};
        try { info = JSON.parse(pending) || {}; } catch (_) {}
        showGate(info.message, info.revision, '暫時無法確認伺服器狀態，請保持此頁面。');
      }
      console.warn('[V14.5D] maintenance check failed', error);
    }
  }

  function subscribe() {
    const client = getClient();
    if (!client || state.channel) return;
    state.channel = client.channel('xianxia-maintenance-gate-v145d')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'world_controls'
      }, payload => {
        const row = payload.new || {};
        if (!Object.prototype.hasOwnProperty.call(row, 'maintenance_mode')) return;
        applyState({
          enabled: row.maintenance_mode,
          revision: row.maintenance_revision,
          message: row.maintenance_message,
          started_at: row.maintenance_started_at,
          updated_at: row.maintenance_updated_at
        });
      })
      .subscribe();
  }

  function init() {
    const pending = localStorage.getItem(PENDING_KEY);
    if (pending) {
      let info = {};
      try { info = JSON.parse(pending) || {}; } catch (_) {}
      showGate(info.message, info.revision, '正在重新確認維護狀態…');
    }
    check(true);
    subscribe();
    state.pollTimer = setInterval(() => check(false), 8000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check(false);
    });
    window.addEventListener('online', () => check(false));
  }

  const wait = setInterval(() => {
    if (getClient()) {
      clearInterval(wait);
      init();
    }
  }, 250);
  setTimeout(() => {
    if (!state.pollTimer && getClient()) {
      clearInterval(wait);
      init();
    }
  }, 5000);
})();
