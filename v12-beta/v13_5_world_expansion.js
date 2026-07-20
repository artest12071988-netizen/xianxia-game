'use strict';
(() => {
  const VERSION = 'V13.5-FIX2-WORLD-TREASURE-1';
  const REGION_TO_ITEM = Object.freeze({
    '萬木森域':'9501','赤砂荒漠':'9502','太古戰場':'9503','上古遺跡':'9504','崑崙仙山':'9505',
    '北天宮':'9506','玄霜冰原':'9507','滄溟外海':'9508','冰火島':'9509','陰陽海':'9510'
  });

  function player() { return typeof g !== 'undefined' && g ? g : (window.g || null); }
  function config() { return typeof C !== 'undefined' && C ? C : (window.C || null); }
  function params() { return typeof P !== 'undefined' && P ? P : (window.P || {}); }
  function items() { return typeof IT !== 'undefined' && IT ? IT : (window.IT || {}); }

  function ensureState() {
    const p = player(); if (!p) return null;
    p.worldStats = p.worldStats || {};
    p.worldStats.heavenlyTreasure = p.worldStats.heavenlyTreasure || {
      discoveries: 0, captures: 0, failedCaptures: 0, aiCaptures: 0, byItem: {}
    };
    p.aiTreasures = p.aiTreasures || {};
    return p.worldStats.heavenlyTreasure;
  }

  function rates() {
    const p = params();
    return {
      discovery: Number(p.heavenly_treasure_discovery_rate ?? 0.15),
      capture: Number(p.heavenly_treasure_capture_rate ?? 0.10),
      ai: Number(p.heavenly_treasure_ai_rate ?? 0.0015)
    };
  }

  function currentZone() {
    const p = player();
    if (!p || typeof window.zoneAt !== 'function') return null;
    return zoneAt(p.pos.r, p.pos.c);
  }

  function record(itemId, field) {
    const s = ensureState(); if (!s) return;
    s[field] = (s[field] || 0) + 1;
    s.byItem[itemId] = s.byItem[itemId] || { discoveries: 0, captures: 0, failedCaptures: 0, aiCaptures: 0 };
    s.byItem[itemId][field] = (s.byItem[itemId][field] || 0) + 1;
    window.dispatchEvent(new CustomEvent('xianxia:heavenly-treasure-stat', {
      detail: { version: VERSION, itemId, field, stats: s }
    }));
  }

  function beforeExplore() {
    const z = currentZone();
    const itemId = z && REGION_TO_ITEM[z.name];
    if (!itemId || !items()[itemId]) return false;
    const r = rates();
    if (Math.random() >= r.discovery) return false;

    const item = items()[itemId];
    record(itemId, 'discoveries');
    if (Math.random() < r.capture) {
      g.inv = g.inv || {};
      g.inv[itemId] = (g.inv[itemId] || 0) + 1;
      record(itemId, 'captures');
      log('天地異象驟現，你成功收取 <b>'+item.name+'</b>。','lg');
      sheet('<h3>天地靈物現世</h3><p>你在 <b>'+z.name+'</b> 感應到天地異象，並成功將 <b style="color:var(--gold)">'+item.name+'</b> 收入背包。</p><div class="notice">天地靈物是背包物品，不進入戰鬥、沒有生命值，也不屬於寵物系統。</div><button class="btn gold" style="width:100%;margin-top:12px" onclick="closeOv()">收入囊中</button>');
    } else {
      record(itemId, 'failedCaptures');
      log('你發現 <b>'+item.name+'</b> 的氣息，但天地靈機轉瞬消散。','la');
      sheet('<h3>天地異象消散</h3><p>你已發現 <b style="color:var(--gold)">'+item.name+'</b>，但本次收取失敗。</p><div class="money"><div><span>發現機率</span><b>'+Math.round(r.discovery*100)+'%</b></div><div><span>收取機率</span><b>'+Math.round(r.capture*100)+'%</b></div></div><p class="small">本次探索已結束；不觸發戰鬥，也不產生靈物生命值。</p><button class="btn" style="width:100%" onclick="closeOv()">返回</button>');
    }
    if (typeof window.saveGame === 'function') window.saveGame(false);
    if (typeof window.render === 'function') window.render();
    return true;
  }

  function tickAiTreasures() {
    const c = config();
    if (typeof ai === 'undefined' || !Array.isArray(ai) || !Array.isArray(c?.zones)) return;
    const r = rates();
    for (const cultivator of ai) {
      if (!cultivator?.alive || cultivator.action !== '探索') continue;
      const z = c.zones.find(x => x.coord === cultivator.coord);
      const itemId = z && REGION_TO_ITEM[z.name];
      if (!itemId || Math.random() >= r.ai) continue;
      const p = player(); if (!p) return;
      p.aiTreasures[cultivator.id] = p.aiTreasures[cultivator.id] || {};
      p.aiTreasures[cultivator.id][itemId] = (p.aiTreasures[cultivator.id][itemId] || 0) + 1;
      record(itemId, 'aiCaptures');
    }
  }

  function getStats() { return ensureState(); }

  window.V135_WORLD_EXPANSION = {
    version: VERSION,
    regionToItem: REGION_TO_ITEM,
    beforeExplore,
    tickAiTreasures,
    getStats,
    rates
  };

  window.addEventListener('xianxia:v13-cycle', tickAiTreasures);
})();
