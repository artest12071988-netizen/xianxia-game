'use strict';

/* ============================================================
   V15.4 CLOUD GUARD FIX2 — RUNTIME VITALS AUTHORITY
   修復：game_saves 已是滿血滿魔，但登入後畫面/執行中 g.hp、g.mp 被其他模組改寫。
   原則：登入與進入遊戲完成後，再向 Supabase 取得權威 HP/MP，校正一次執行中狀態。
   ============================================================ */

const V154_VITALS_FIX_BUILD = 'V15.4-CLOUD-GUARD-FIX2-RUNTIME-VITALS-20260724';
let v154VitalsSyncing = false;
let v154VitalsWindowUntil = 0;

function v154Number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function v154ApplyAuthoritativeVitals(row, reason = 'login') {
  if (!g || !row) return false;

  const hpMax = Math.max(1, v154Number(row.hp_max, v154Number(g.hpMax, 1)));
  const mpMax = Math.max(1, v154Number(row.mp_max, v154Number(g.mpMax, 1)));
  const hp = Math.max(0, Math.min(v154Number(row.hp, hpMax), hpMax));
  const mp = Math.max(0, Math.min(v154Number(row.mp, mpMax), mpMax));

  const changed =
    v154Number(g.hp) !== hp ||
    v154Number(g.hpMax) !== hpMax ||
    v154Number(g.mp) !== mp ||
    v154Number(g.mpMax) !== mpMax;

  g.hpMax = hpMax;
  g.mpMax = mpMax;
  g.hp = hp;
  g.mp = mp;

  if (cloudState?.remoteSave?.g) {
    cloudState.remoteSave.g.hp = hp;
    cloudState.remoteSave.g.hpMax = hpMax;
    cloudState.remoteSave.g.mp = mp;
    cloudState.remoteSave.g.mpMax = mpMax;
  }

  if (typeof render === 'function') render();

  if (changed) {
    console.warn('[V15.4 VITALS FIX] runtime vitals corrected', {
      reason, hp, hpMax, mp, mpMax
    });
  }
  return changed;
}

async function v154FetchAndApplyVitals(reason = 'login') {
  if (
    v154VitalsSyncing || !g || !cloudState?.enabled || !cloudState?.user ||
    !cloudState?.client || !navigator.onLine
  ) return false;

  // 戰鬥中不回補，避免真正戰鬥傷害被登入校正覆蓋。
  if (typeof fight !== 'undefined' && fight) return false;

  v154VitalsSyncing = true;
  try {
    const { data, error } = await cloudState.client.rpc('get_authoritative_player_vitals');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return false;
    return v154ApplyAuthoritativeVitals(row, reason);
  } catch (error) {
    console.error('[V15.4 VITALS FIX] authoritative vitals read failed', error);
    return false;
  } finally {
    v154VitalsSyncing = false;
  }
}

function v154StartLoginVitalsWindow() {
  v154VitalsWindowUntil = Date.now() + 12000;
  const checkpoints = [0, 400, 1200, 3000, 6000, 10000];
  checkpoints.forEach((delay) => {
    setTimeout(() => {
      if (Date.now() <= v154VitalsWindowUntil) {
        v154FetchAndApplyVitals('post-login-' + delay);
      }
    }, delay);
  });
}

// 包住正式的 continueGame：原流程全部完成後，再做權威校正。
const v154OriginalContinueGame = typeof continueGame === 'function' ? continueGame : null;
if (v154OriginalContinueGame) {
  continueGame = async function (...args) {
    const result = await v154OriginalContinueGame.apply(this, args);
    v154StartLoginVitalsWindow();
    return result;
  };
}

// 若其他模組在登入後直接 show('game')，仍於畫面切換時啟動校正窗。
if (typeof show === 'function') {
  const v154OriginalShow = show;
  show = function (id, ...args) {
    const result = v154OriginalShow.call(this, id, ...args);
    if (id === 'game' && cloudState?.user) v154StartLoginVitalsWindow();
    return result;
  };
}

// 第一次載入完成後，若角色已存在，也校正一次。
window.addEventListener('load', () => {
  setTimeout(() => {
    if (g && cloudState?.user) v154StartLoginVitalsWindow();
  }, 800);
});

console.info('[V15.4 RUNTIME VITALS FIX] installed', V154_VITALS_FIX_BUILD);
