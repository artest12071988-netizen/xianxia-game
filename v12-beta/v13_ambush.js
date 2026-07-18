'use strict';
(() => {
  let lastCoord = '';
  let busy = false;
  let lastCheck = 0;

  function getPlayerCoord() {
    const game = window.g;
    if (!game) return '';

    const coordFn =
      (typeof coordOf === 'function')
        ? coordOf
        : (typeof window.coordOf === 'function' ? window.coordOf : null);

    if (
      game.pos &&
      Number.isFinite(Number(game.pos.r)) &&
      Number.isFinite(Number(game.pos.c)) &&
      coordFn
    ) {
      return String(coordFn(Number(game.pos.r), Number(game.pos.c)));
    }

    return String(game.coord || game.zone || '');
  }

  async function check() {
    const cs = window.cloudState;
    if (busy || !cs?.enabled || !cs?.user || !cs?.client || !window.g) return;

    const coord = getPlayerCoord();
    if (!coord || Date.now() - lastCheck < 12000) return;
    if (coord === lastCoord && Date.now() - lastCheck < 30000) return;

    lastCoord = coord;
    lastCheck = Date.now();
    busy = true;

    try {
      await cs.client.rpc('process_ai_ambush_batch', { p_limit: 6 });

      const hp = Math.max(1, Number(g.hp || 1));
      const defense = Math.max(0, Number(g.def || g.defense || 0));

      const { data, error } = await cs.client.rpc('check_player_ambush', {
        p_coord: coord,
        p_player_hp: hp,
        p_player_defense: defense
      });

      if (error) throw error;
      if (!data?.ambushed) return;

      if (data.detected) {
        window.toast?.(`你察覺 ${data.attacker} 的殺意，及時識破伏擊。`);
      } else {
        const damage = Math.max(0, Number(data.damage || 0));
        g.hp = Math.max(0, hp - damage);
        window.toast?.(`${data.attacker} 自暗處暴起，你受到 ${damage} 點先手傷害！`);
        window.render?.();
        window.flushCloudSave?.(true);
      }
    } catch (error) {
      console.warn('[V13.2 Ambush]', error?.message || error);
    } finally {
      busy = false;
    }
  }

  setInterval(check, 8000);
  window.addEventListener('xianxia:ai-brain-tick', check);
  window.V13_AMBUSH = { check, getPlayerCoord };
})();
