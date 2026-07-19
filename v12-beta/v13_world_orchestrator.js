'use strict';
(() => {
  const VERSION = 'V13.5-PHASE2-ORCHESTRATOR-1';
  const CADENCE = Object.freeze({ brain: 15000, ambush: 8000, observatory: 20000 });
  const state = {
    timer: null,
    running: false,
    last: { brain: 0, ambush: 0, observatory: 0 },
    errors: {},
    cycleCount: 0
  };

  function ready() {
    const cs = window.cloudState;
    return !!(cs?.enabled && cs?.user && cs?.client);
  }

  async function run(name, fn, now) {
    if (now - state.last[name] < CADENCE[name]) return;
    state.last[name] = now;
    try {
      await fn();
      delete state.errors[name];
    } catch (error) {
      state.errors[name] = error?.message || String(error);
      console.warn(`[V13.5 Orchestrator:${name}]`, state.errors[name]);
    }
  }

  async function cycle({ force = false } = {}) {
    if (state.running || document.visibilityState === 'hidden') return;
    if (!ready()) return;
    state.running = true;
    state.cycleCount += 1;
    const now = Date.now();
    try {
      if (force) state.last = { brain: 0, ambush: 0, observatory: 0 };
      await run('brain', () => window.V13_AI_BRAIN?.tick?.(), now);
      await run('ambush', () => window.V13_AMBUSH?.check?.(), now);
      await run('observatory', () => window.V13_AI_OBSERVATORY?.heartbeat?.(), now);
      window.dispatchEvent(new CustomEvent('xianxia:v13-cycle', {
        detail: { version: VERSION, at: now, cycleCount: state.cycleCount }
      }));
    } finally {
      state.running = false;
    }
  }

  function stopLegacyTimers() {
    window.V13_AI_BRAIN?.stop?.();
    window.V13_AMBUSH?.stop?.();
    window.V13_AI_OBSERVATORY?.stop?.();
  }

  function stop() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    state.running = false;
  }

  function start() {
    stop();
    stopLegacyTimers();
    state.timer = setInterval(cycle, 5000);
    setTimeout(() => cycle({ force: true }), 2500);
  }

  window.V13_WORLD_ORCHESTRATOR = {
    version: VERSION,
    cadence: CADENCE,
    state,
    cycle,
    start,
    stop,
    ready
  };

  if (document.readyState === 'loading') {
    window.addEventListener('load', start, { once: true });
  } else {
    start();
  }
})();
