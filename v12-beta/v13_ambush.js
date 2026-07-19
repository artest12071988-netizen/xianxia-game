'use strict';
(() => {
  const VERSION = 'V13.2-FIX4';
  let timer = null;
  let lastCoord = '';
  let busy = false;
  let lastCheck = 0;

  function getGame() {
    try {
      if (typeof g !== 'undefined' && g) return g;
    } catch (_) {}
    return window.g || null;
  }

  function getPlayerCoord() {
    const game = getGame();
    const r = Number(game?.pos?.r);
    const c = Number(game?.pos?.c);

    if (
      Number.isInteger(r) &&
      Number.isInteger(c) &&
      r >= 0 && r <= 9 &&
      c >= 0 && c <= 9
    ) {
      return String.fromCharCode(65 + r) + '-' + (c + 1);
    }

    return String(game?.coord || game?.zone || '');
  }

  function getPlayerDefense(game = getGame()) {
    const uiValue = Number(document.getElementById('def')?.textContent);
    if (Number.isFinite(uiValue)) return Math.max(0, uiValue);

    const gameValue = Number(game?.def ?? game?.defense ?? 0);
    return Number.isFinite(gameValue) ? Math.max(0, gameValue) : 0;
  }

  async function check() {
    const cs = window.cloudState;
    const game = getGame();

    if (busy || !cs?.enabled || !cs?.user || !cs?.client || !game) return;

    const coord = getPlayerCoord();
    const now = Date.now();

    if (!coord || now - lastCheck < 12000) return;
    if (coord === lastCoord && now - lastCheck < 30000) return;

    lastCoord = coord;
    lastCheck = now;
    busy = true;

    try {
      const batchResult = await cs.client.rpc('process_ai_ambush_batch', {
        p_limit: 6
      });
      if (batchResult.error) throw batchResult.error;

      const hp = Math.max(1, Number(game.hp || 1));
      const defense = getPlayerDefense(game);

      const { data, error } = await cs.client.rpc('check_player_ambush', {
        p_coord: coord,
        p_player_hp: hp,
        p_player_defense: defense
      });

      if (error) throw error;
      if (!data?.ambushed) return;

      if (data.detected) {
        window.toast?.(`你察覺 ${data.attacker} 的殺意，及時識破伏擊。`);
        return;
      }

      const damage = Math.max(0, Number(data.damage || 0));
      game.hp = Math.max(0, hp - damage);

      window.toast?.(`${data.attacker} 自暗處暴起，你受到 ${damage} 點先手傷害！`);
      window.render?.();
      window.flushCloudSave?.(true);
    } catch (error) {
      console.warn('[V13.2 Ambush FIX4]', error?.message || error);
    } finally {
      busy = false;
    }
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    window.removeEventListener('xianxia:ai-brain-tick', check);
  }

  function start() {
    stop();
    timer = setInterval(check, 8000);
    window.addEventListener('xianxia:ai-brain-tick', check);
  }

  if (!window.XIANXIA_V13_EXTERNAL_SCHEDULER) start();

  window.V13_AMBUSH = {
    version: VERSION,
    check,
    start,
    stop,
    getGame,
    getPlayerCoord,
    getPlayerDefense,
    state: () => ({ busy, lastCoord, lastCheck, timerActive: !!timer })
  };
})();
