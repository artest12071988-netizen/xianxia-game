'use strict';

(() => {
  const BUILD = 'V14.5D-20260721';
  let ready = false;
  let channel = null;
  let refreshTimer = null;

  const h = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function injectStyle() {
    if (document.getElementById('maintenanceAdminStyle')) return;
    const style = document.createElement('style');
    style.id = 'maintenanceAdminStyle';
    style.textContent = `
      .maintenance-admin-card{border-color:#7a3434;background:linear-gradient(150deg,#201315,#0a111b)}
      .maintenance-admin-card[data-enabled="false"]{border-color:#294b43;background:linear-gradient(150deg,#10201e,#0a111b)}
      .maintenance-admin-state{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#070d15;margin:10px 0}
      .maintenance-admin-state b{color:var(--gold)}
      .maintenance-admin-state .on{color:var(--red)}
      .maintenance-admin-state .off{color:var(--jade)}
      .maintenance-admin-meta{font-size:12px;color:var(--muted);line-height:1.65}
      .maintenance-admin-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      @media(max-width:700px){.maintenance-admin-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function injectCard() {
    if (document.getElementById('maintenanceAdminCard')) return;
    const main = document.getElementById('adminMain');
    if (!main) return;
    injectStyle();
    const card = document.createElement('section');
    card.id = 'maintenanceAdminCard';
    card.className = 'card maintenance-admin-card';
    card.dataset.enabled = 'false';
    card.innerHTML = `
      <div class="head">
        <div>
          <h2 style="margin:0">全服維護與強制離線</h2>
          <small>先存檔，再讓所有已載入監聽器的玩家退出並阻止重新登入</small>
        </div>
        <button class="btn" id="maintenanceAdminRefresh" type="button">重新整理</button>
      </div>
      <div class="notice">首次部署本功能時，已經開著舊版頁面的玩家尚未載入監聽器，無法回溯強制退出；玩家至少載入本次版本一次後，往後更新即可由此按鈕全服強制離線。</div>
      <div class="maintenance-admin-state">
        <span>目前狀態</span>
        <b id="maintenanceAdminStatus">讀取中</b>
      </div>
      <div class="field">
        <label>玩家看到的維護訊息</label>
        <textarea id="maintenanceAdminMessage" maxlength="240">伺服器正在更新，請稍後重新登入。</textarea>
      </div>
      <div class="maintenance-admin-meta" id="maintenanceAdminMeta">版本：${BUILD}</div>
      <div class="maintenance-admin-actions">
        <button class="btn red" id="maintenanceAdminEnable" type="button">強制全服離線並進入維護</button>
        <button class="btn jade" id="maintenanceAdminDisable" type="button">解除維護並要求重新載入</button>
      </div>
    `;
    const firstStatusCard = main.querySelector(':scope > section.card');
    if (firstStatusCard && firstStatusCard.nextSibling) {
      main.insertBefore(card, firstStatusCard.nextSibling);
    } else {
      main.prepend(card);
    }
    document.getElementById('maintenanceAdminRefresh').addEventListener('click', loadState);
    document.getElementById('maintenanceAdminEnable').addEventListener('click', () => setMaintenance(true));
    document.getElementById('maintenanceAdminDisable').addEventListener('click', () => setMaintenance(false));
  }

  function row(data) {
    return Array.isArray(data) ? data[0] : data;
  }

  function render(state) {
    const card = document.getElementById('maintenanceAdminCard');
    if (!card || !state) return;
    const enabled = Boolean(state.enabled);
    card.dataset.enabled = String(enabled);
    const status = document.getElementById('maintenanceAdminStatus');
    status.textContent = enabled ? '維護中｜玩家禁止登入' : '正常開放';
    status.className = enabled ? 'on' : 'off';
    const started = state.started_at ? new Date(state.started_at).toLocaleString('zh-TW') : '—';
    const updated = state.updated_at ? new Date(state.updated_at).toLocaleString('zh-TW') : '—';
    document.getElementById('maintenanceAdminMeta').innerHTML =
      `維護版本：<b>${h(state.revision ?? 0)}</b>｜開始：${h(started)}｜更新：${h(updated)}`;
    if (state.message) document.getElementById('maintenanceAdminMessage').value = state.message;
    document.getElementById('maintenanceAdminEnable').disabled = enabled;
    document.getElementById('maintenanceAdminDisable').disabled = !enabled;
  }

  async function loadState() {
    try {
      const { data, error } = await sb.rpc('maintenance_get_state');
      if (error) throw error;
      render(row(data));
    } catch (error) {
      const status = document.getElementById('maintenanceAdminStatus');
      if (status) status.textContent = '尚未安裝維護 SQL';
      if (typeof toast === 'function') toast('維護狀態讀取失敗：' + (error.message || error));
    }
  }

  async function setMaintenance(enabled) {
    const action = enabled ? '強制所有在線玩家離線並進入維護' : '解除維護並要求玩家重新載入';
    if (!window.confirm(`確定要${action}？`)) return;
    const message = document.getElementById('maintenanceAdminMessage').value.trim();
    const enableButton = document.getElementById('maintenanceAdminEnable');
    const disableButton = document.getElementById('maintenanceAdminDisable');
    enableButton.disabled = true;
    disableButton.disabled = true;
    try {
      const { data, error } = await sb.rpc('admin_set_maintenance', {
        p_enabled: enabled,
        p_message: message || null
      });
      if (error) throw error;
      const state = row(data);
      render(state);
      if (typeof addLog === 'function') {
        addLog(enabled
          ? `已啟動全服維護，版本 ${state.revision}`
          : `已解除全服維護，版本 ${state.revision}`);
      }
      if (typeof toast === 'function') {
        toast(enabled ? '已發出全服強制離線命令' : '維護已解除，玩家端將重新載入');
      }
    } catch (error) {
      if (typeof toast === 'function') toast('維護操作失敗：' + (error.message || error));
      await loadState();
    }
  }

  function subscribe() {
    if (channel || typeof sb === 'undefined') return;
    channel = sb.channel('xianxia-maintenance-admin-v145d')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'world_controls'
      }, payload => {
        if (payload.new && Object.prototype.hasOwnProperty.call(payload.new, 'maintenance_mode')) {
          render({
            enabled: payload.new.maintenance_mode,
            revision: payload.new.maintenance_revision,
            message: payload.new.maintenance_message,
            started_at: payload.new.maintenance_started_at,
            updated_at: payload.new.maintenance_updated_at
          });
        }
      })
      .subscribe();
  }

  function init() {
    if (ready) return;
    if (typeof sb === 'undefined' || !document.getElementById('adminMain')) return;
    ready = true;
    injectCard();
    loadState();
    subscribe();
    refreshTimer = window.setInterval(loadState, 15000);
    window.addEventListener('beforeunload', () => {
      if (refreshTimer) clearInterval(refreshTimer);
      if (channel) sb.removeChannel(channel);
    }, { once: true });
  }

  const wait = window.setInterval(() => {
    if (typeof sb !== 'undefined' && document.getElementById('adminMain')) {
      clearInterval(wait);
      init();
    }
  }, 250);
})();
