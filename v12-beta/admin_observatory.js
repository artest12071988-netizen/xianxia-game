'use strict';
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const fmt = value => value == null || value === '' ? '—' : esc(value);
  let loading = false;

  function ensureUI() {
    if (document.getElementById('aiObservatoryPanel')) return;
    const host = document.querySelector('main') || document.body;
    const section = document.createElement('section');
    section.id = 'aiObservatoryPanel';
    section.innerHTML = `
      <div style="margin-top:24px;padding:18px;border:1px solid #79633f;border-radius:12px;background:#16130f;color:#eee">
        <h2 style="margin:0 0 12px">AI觀測中心 <small id="obsVersion" style="opacity:.65"></small></h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button id="obsRefreshBtn">重新整理</button>
          <button id="obsReselectBtn">重選10位分層樣本</button>
          <span id="obsStatus" style="padding:6px 0;opacity:.8"></span>
        </div>
        <div id="obsSummary" style="margin-bottom:12px;line-height:1.8"></div>
        <div id="obsDistribution" style="margin-bottom:12px;line-height:1.7"></div>
        <div id="obsSubjects" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px"></div>
        <h3>異常警報</h3>
        <div id="obsAlerts"></div>
        <h3>AI人生回放</h3>
        <div id="obsReplay">請點選上方AI。</div>
      </div>`;
    host.appendChild(section);

    section.querySelector('#obsVersion').textContent = window.V13_AI_OBSERVATORY?.version || '';
    section.querySelector('#obsRefreshBtn').onclick = load;
    section.querySelector('#obsReselectBtn').onclick = async () => {
      try {
        setStatus('重選中…');
        await window.V13_AI_OBSERVATORY.refreshSubjects();
        await load();
      } catch (error) { setStatus(error?.message || String(error), true); }
    };
  }

  function setStatus(text, isError = false) {
    const node = document.getElementById('obsStatus');
    if (!node) return;
    node.textContent = text;
    node.style.color = isError ? '#ff8a80' : '';
  }

  function jsonPairs(obj) {
    return Object.entries(obj || {}).map(([k, v]) => `${esc(k)}:${esc(v)}`).join('｜') || '—';
  }

  async function load() {
    ensureUI();
    if (loading) return;
    loading = true;
    setStatus('讀取中…');
    try {
      const o = await window.V13_AI_OBSERVATORY.getOverview();
      const s = o.latest_snapshot || {};
      const p = s.population_metrics || {};
      document.getElementById('obsSummary').innerHTML = `
        總AI：${fmt(s.total_ai)}｜存活：${fmt(s.alive_ai)}｜死亡：${fmt(s.dead_ai)}｜平均等級：${fmt(s.avg_level)}<br>
        平均血量率：${fmt(s.avg_hp_ratio)}｜狩獵AI：${fmt(s.active_hunters)}｜狩獵比率：${fmt(s.hunter_ratio)}<br>
        24h伏擊：${fmt(s.ambush_24h)}｜伏擊命中率：${fmt(s.ambush_hit_rate_24h)}｜24h死亡：${fmt(s.deaths_24h)}｜24h升級：${fmt(s.levelups_24h)}<br>
        怪物表：${p.monster_table_detected ? fmt(p.monster_table) : '未偵測'}｜怪物數：${fmt(p.monster_total)}｜AI/怪物比：${fmt(p.ai_to_monster_ratio)}｜未處理異常：${fmt(s.anomaly_count)}`;

      document.getElementById('obsDistribution').innerHTML = `
        <b>境界：</b>${jsonPairs(s.realm_counts)}<br>
        <b>性格：</b>${jsonPairs(s.archetype_counts)}<br>
        <b>行為：</b>${jsonPairs(s.action_counts)}`;

      document.getElementById('obsSubjects').innerHTML = (o.subjects || []).map(x => `
        <button data-ai-id="${esc(x.id)}" style="text-align:left;padding:10px;background:#211b14;color:#eee;border:1px solid #56452d;border-radius:8px">
          <b>#${esc(x.slot)} ${esc(x.name)}</b><br>
          ${esc(x.realm)} Lv.${esc(x.level)}｜HP ${esc(x.hp)}/${esc(x.hp_max)}｜MP ${esc(x.mp)}/${esc(x.mp_max)}<br>
          攻 ${esc(x.attack_power)}｜防 ${esc(x.defense_power)}｜靈石 ${esc(x.lingshi)}<br>
          ${esc(x.coord)}｜${esc(x.action)}｜${esc(x.archetype)}
        </button>`).join('');
      document.querySelectorAll('[data-ai-id]').forEach(button => {
        button.onclick = () => replay(button.dataset.aiId);
      });

      const alerts = o.open_alerts || [];
      document.getElementById('obsAlerts').innerHTML = alerts.length ? alerts.map(a => `
        <div style="padding:8px 0;border-bottom:1px solid #332a1d">
          [${esc(a.severity)}] ${esc(a.anomaly_code)}｜AI:${fmt(a.cultivator_id)}｜${esc(JSON.stringify(a.detail || {}))}
          <button data-alert-id="${esc(a.id)}" style="margin-left:8px">標記已處理</button>
        </div>`).join('') : '目前無未處理警報';
      document.querySelectorAll('[data-alert-id]').forEach(button => {
        button.onclick = async () => {
          try { await window.V13_AI_OBSERVATORY.resolveAlert(button.dataset.alertId); await load(); }
          catch (error) { setStatus(error?.message || String(error), true); }
        };
      });
      setStatus(`更新：${new Date().toLocaleTimeString()}`);
    } catch (error) {
      setStatus(error?.message || String(error), true);
    } finally {
      loading = false;
    }
  }

  async function replay(id) {
    const host = document.getElementById('obsReplay');
    host.textContent = '讀取回放中…';
    try {
      const rows = await window.V13_AI_OBSERVATORY.getReplay(id, 300);
      host.innerHTML = (rows || []).map(e => `
        <div style="padding:7px 0;border-bottom:1px solid #332a1d">
          ${esc(new Date(e.created_at).toLocaleString())}｜${esc(e.event_type)}｜${esc(e.action)}｜${esc(e.reason)}｜
          ${esc(e.coord)}｜${esc(e.realm)} Lv.${esc(e.level)}｜HP ${esc(e.hp)}/${esc(e.hp_max)}｜MP ${esc(e.mp)}/${esc(e.mp_max)}
        </div>`).join('') || '尚無歷程';
    } catch (error) { host.textContent = error?.message || String(error); }
  }

  function boot() {
    ensureUI();
    const wait = setInterval(() => {
      if (window.V13_AI_OBSERVATORY && window.cloudState?.user) {
        clearInterval(wait);
        setTimeout(load, 500);
      }
    }, 500);
    setTimeout(() => clearInterval(wait), 30000);
  }

  if (document.readyState === 'loading') window.addEventListener('load', boot, { once: true });
  else boot();
  window.addEventListener('xianxia:observatory-updated', () => {
    if (document.visibilityState === 'visible' && document.getElementById('aiObservatoryPanel')) load();
  });
})();
