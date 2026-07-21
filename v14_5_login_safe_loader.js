'use strict';

(() => {
  const BUILD = 'V14.5A-FIX4-LOGIN-SAFE-20260721';
  if (window.__V145LoginSafeLoader) return;
  window.__V145LoginSafeLoader = BUILD;

  let artifactLoaded = false;
  let uiLoaded = false;
  let timer = null;

  function gameReady() {
    try {
      return Boolean(
        document.getElementById('game')?.classList.contains('on') &&
        typeof g !== 'undefined' && g &&
        typeof IT !== 'undefined' && IT &&
        typeof P !== 'undefined' && P
      );
    } catch (_) {
      return false;
    }
  }

  function mirrorCoreState() {
    // Read-only compatibility mirror for legacy V14 modules.
    // This runs only after a character has been loaded, so it cannot interrupt login.
    try { window.g = g; } catch (_) {}
    try { window.IT = IT; } catch (_) {}
    try { window.P = P; } catch (_) {}
    try { window.C = C; } catch (_) {}
    try { window.ai = ai; } catch (_) {}
  }

  function loadScript(src, id) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    script.onerror = () => console.error('[LOGIN SAFE] failed to load', src);
    document.body.appendChild(script);
  }

  function activateAfterLogin() {
    if (!gameReady()) return false;
    mirrorCoreState();

    if (!artifactLoaded) {
      artifactLoaded = true;
      loadScript('v14_3_artifact_recovery.js?v=20260721-v145a-fix4-login-safe', 'v145SafeArtifact');
    }
    if (!uiLoaded) {
      uiLoaded = true;
      loadScript('v14_5a_compact_ui_recovery.js?v=20260721-v145a-fix4-login-safe', 'v145SafeUi');
    }

    if (artifactLoaded && uiLoaded && timer) {
      clearInterval(timer);
      timer = null;
    }
    return true;
  }

  function start() {
    activateAfterLogin();
    if (!timer) timer = setInterval(activateAfterLogin, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.addEventListener('pageshow', start);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') start();
  });
})();
