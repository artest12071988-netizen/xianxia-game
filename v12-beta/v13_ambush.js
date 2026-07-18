'use strict';
(() => {
  let lastCoord = '';
  let busy = false;
  let lastCheck = 0;

  async function check() {
    const cs = window.cloudState;
    const game = window.g;
    const now = Date.now();

    if (busy || !cs?.enabled || !cs?.user || !cs?.client || !game) return;

    const coord = String(game.coord || game.zone || '').trim();
    if (!coord || now - lastCheck < 12000) return;
    if (coord === lastCoord && now - lastCheck < 30000) return;

    busy = true;
    try {
      const batch = await cs.client.rpc('process_ai_ambush_batch', { p_limit: 6 });
      if (batch.error) throw batch.error;

      const hp = Math.max(1, Number(game.hp || 1));
      const defense = Math.max(0, Number(game.def || game.defense || 0));
      const { data, error } = await cs.client.rpc('check_player_ambush', {
        p_coord: coord,
        p_player_hp: hp,
        p_player_defense: defense
      });
      if (error) throw error;

      lastCoord = coord;
      lastCheck = Date.now();

      if (!data?.ambushed) return;

      if (data.detected) {
        window.toast?.(`你察覺 ${data.attacker} 的殺意，及時識破伏擊。`);
        return;
      }

      const damage = Math.max(0, Number(data.damage || 0));
      game.hp = Math.max(0, hp - damage);
      window.toast?.(`${data.attacker} 自暗處暴起，你受到 ${damage} 點先手傷害！`);
      window.render?.();
      await window.flushCloudSave?.(true);
    } catch (error) {
      lastCheck = Date.now();
      console.warn('[V13.2 Ambush]', error?.message || error);
    } finally {
      busy = false;
    }
  }

  window.setInterval(check, 8000);
  window.addEventListener('xianxia:ai-brain-tick', check);
  window.V13_AMBUSH = { check };
})();
