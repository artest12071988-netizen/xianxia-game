'use strict';

/* ============================================================
   V15.4 CLOUD SAVE GUARD FIX1
   目標：
   1) 正式雲端模式不再從 emergency cache 回灌角色資料。
   2) 雲端尚未完成載入前，所有自動存檔均封鎖。
   3) 每次正式存檔帶入 clientBuildGuard，交由 SQL 端拒絕舊客戶端。
   4) revision 衝突時採伺服器資料，不允許本機覆蓋。
   ============================================================ */

const V154_RUNTIME_BUILD = 'V15.4-ASSET-INTEGRITY-FIX1-20260724';
const V154_CLOUD_REQUIRED_BUILD = 'V15.4-PHASE3-STAGE3-FIX2-CLOUD-GUARD-20260724';
const V154_CLOUD_GUARD_CACHE_KEY = 'xianxia_v154_asset_integrity_fix1';
const V154_ASSET_SAFETY_KEY = 'xianxia_v154_asset_safety_snapshot';

Object.assign(cloudState, {
  cloudReady: false,
  writeEnabled: false,
  clientBuildGuard: V154_CLOUD_REQUIRED_BUILD,
  staleClientBlocked: false,
  conflictRetryCount: 0,
  conflictRetryTimer: null
});

function v154PurgeLegacyLocalSave() {
  try {
    localStorage.removeItem(V12_LOCAL_CACHE);
    localStorage.removeItem(V12_RECOVERY_CONFLICT);
    localStorage.setItem(V154_CLOUD_GUARD_CACHE_KEY, V154_RUNTIME_BUILD);
  } catch (error) {
    console.warn('[V15.4 CLOUD GUARD] local cache purge failed', error);
  }
}

async function v154PurgeBrowserCaches() {
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.unregister()));
    }
  } catch (error) {
    console.warn('[V15.4 CLOUD GUARD] browser cache purge failed', error);
  }
}



function v154Clone(value) {
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  } catch (_) {
    return null;
  }
}

function v154CaptureAssetSafety(sourceG = g) {
  if (!sourceG || !cloudState.user) return;
  try {
    const snapshot = {
      userId: cloudState.user.id,
      characterId: sourceG.characterId || null,
      savedAt: Date.now(),
      inv: v154Clone(sourceG.inv || {}),
      techniques: Array.isArray(sourceG.techniques) ? [...sourceG.techniques] : [],
      equipment: Array.isArray(sourceG.equipment) ? v154Clone(sourceG.equipment) : [],
      weaponUid: sourceG.weaponUid || null,
      armorUid: sourceG.armorUid || null,
      lingshi: Number(sourceG.lingshi || 0),
      boundStone: Number(sourceG.boundStone || 0)
    };
    localStorage.setItem(V154_ASSET_SAFETY_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('[V15.4 ASSET INTEGRITY] safety snapshot failed', error);
  }
}

function v154ReadAssetSafety(targetG) {
  try {
    const raw = localStorage.getItem(V154_ASSET_SAFETY_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (!snapshot || snapshot.userId !== cloudState.user?.id) return null;
    if (snapshot.characterId && targetG?.characterId && snapshot.characterId !== targetG.characterId) return null;
    return snapshot;
  } catch (_) {
    return null;
  }
}

function v154RestoreMissingAssets(payload) {
  if (!payload?.g) return payload;
  const target = payload.g;
  const backup = v154ReadAssetSafety(target);
  if (!backup) return payload;

  const invMissing = !target.inv || typeof target.inv !== 'object' || Object.keys(target.inv).length === 0;
  const techniquesMissing = !Array.isArray(target.techniques) || target.techniques.length === 0;
  const equipmentMissing = !Array.isArray(target.equipment) || target.equipment.length === 0;

  if (invMissing && backup.inv && Object.keys(backup.inv).length) target.inv = v154Clone(backup.inv);
  if (techniquesMissing && backup.techniques?.length) target.techniques = [...backup.techniques];
  if (equipmentMissing && backup.equipment?.length) {
    target.equipment = v154Clone(backup.equipment);
    target.weaponUid = target.weaponUid || backup.weaponUid || null;
    target.armorUid = target.armorUid || backup.armorUid || null;
  }
  if (target.lingshi == null && Number.isFinite(backup.lingshi)) target.lingshi = backup.lingshi;
  if (target.boundStone == null && Number.isFinite(backup.boundStone)) target.boundStone = backup.boundStone;
  return payload;
}

function v154BuildPayload() {
  v154CaptureAssetSafety(g);
  let payload;
  if (typeof buildSavePayload === 'function') {
    payload = buildSavePayload();
  } else {
    const cleanG = typeof structuredClone === 'function'
      ? structuredClone(g)
      : JSON.parse(JSON.stringify(g));
    payload = {
      savedAt: Date.now(),
      build: V12_BUILD,
      userId: cloudState.user?.id || null,
      clientRevision: cloudState.revision,
      g: cleanG,
      ai
    };
  }
  payload.clientBuildGuard = V154_CLOUD_REQUIRED_BUILD;
  payload.build = V154_CLOUD_REQUIRED_BUILD;
  payload.clientRevision = Number(cloudState.revision || 0);
  payload.savedAt = Date.now();
  if (payload.g) {
    payload.g.build = V154_CLOUD_REQUIRED_BUILD;
    payload.g.lastSavedAt = payload.savedAt;
  }
  return payload;
}

// 正式雲端模式：永遠禁止 emergency cache 回灌。
recoverEmergencyCache = async function () {
  v154PurgeLegacyLocalSave();
  return false;
};

// 登入順序：先鎖寫入 → 讀雲端 → 清本機舊資料 → 才開放寫入。
afterCloudLogin = async function () {
  cloudState.lastError = '';
  cloudState.cloudReady = false;
  cloudState.writeEnabled = false;
  cloudState.staleClientBlocked = false;

  await loadCloudSave();
  if (typeof loadAccountWallet === 'function') await loadAccountWallet();
  cloudState.remoteSave = v154RestoreMissingAssets(cloudState.remoteSave);
  v154PurgeLegacyLocalSave();
  await v154PurgeBrowserCaches();

  cloudState.cloudReady = true;
  cloudState.writeEnabled = true;

  await initRealtime();
  const continueButton = $('continueBtn');
  if (continueButton) continueButton.style.display = cloudState.remoteSave ? 'block' : 'none';
  updateCloudBadge();
  console.info('[V15.4 CLOUD GUARD] cloud-first login ready', {
    build: V154_RUNTIME_BUILD,
    requiredBuild: V154_CLOUD_REQUIRED_BUILD,
    revision: cloudState.revision,
    hasRemoteSave: !!cloudState.remoteSave
  });
};

continueGame = async function () {
  try {
    if (cloudState.enabled) {
      if (!cloudState.user) {
        show('auth');
        return;
      }
      cloudState.cloudReady = false;
      cloudState.writeEnabled = false;
      await loadCloudSave();
      if (typeof loadAccountWallet === 'function') await loadAccountWallet();
      cloudState.remoteSave = v154RestoreMissingAssets(cloudState.remoteSave);
      if (!cloudState.remoteSave) {
        toast('雲端尚無角色');
        show('create');
        return;
      }
      applySavePayload(cloudState.remoteSave);
      if (typeof setWallet === 'function') setWallet(cloudState.walletBalance, cloudState.walletRevision, cloudState.walletUpdatedAt);
      v154CaptureAssetSafety(g);
      v154PurgeLegacyLocalSave();
      cloudState.cloudReady = true;
      cloudState.writeEnabled = true;
    } else if (cloudState.preview) {
      const raw = localStorage.getItem(V12_LOCAL_CACHE);
      if (!raw) throw new Error('沒有離線預覽存檔');
      applySavePayload(JSON.parse(raw));
    } else {
      openServerSetup();
      return;
    }
    show('game');
    startLoops();
    render();
    log('神識歸位，已載入伺服器最新存檔。', 'lg');
  } catch (error) {
    toast('存檔載入失敗：' + (error?.message || String(error)));
  }
};

saveGame = function (showToast = false) {
  if (!g) return;
  const payload = v154BuildPayload();

  // 預覽模式仍可本機暫存；正式雲端模式不保存可回灌的角色快取。
  if (cloudState.preview) {
    localStorage.setItem(V12_LOCAL_CACHE, JSON.stringify(payload));
  } else {
    v154PurgeLegacyLocalSave();
  }

  if (
    cloudState.enabled &&
    cloudState.user &&
    cloudState.cloudReady &&
    cloudState.writeEnabled
  ) {
    scheduleCloudSave();
  }

  if (showToast) {
    toast(
      cloudState.enabled
        ? (cloudState.cloudReady ? '已排入雲端同步' : '雲端載入中，暫停寫入')
        : '僅為離線預覽暫存'
    );
  }
};

scheduleCloudSave = function (force = false) {
  if (!cloudState.cloudReady || !cloudState.writeEnabled || cloudState.staleClientBlocked) {
    console.warn('[V15.4 CLOUD GUARD] save blocked before cloud ready');
    return;
  }
  clearTimeout(cloudState.saveTimer);
  cloudState.saveTimer = setTimeout(
    () => flushCloudSave(force),
    force ? 0 : (P?.autosave_debounce_ms || 450)
  );
};

flushCloudSave = async function (force = false) {
  if (
    !g || g.dead || !cloudState.enabled || !cloudState.user ||
    !cloudState.cloudReady || !cloudState.writeEnabled || cloudState.staleClientBlocked
  ) return;

  if (!navigator.onLine) {
    updateCloudBadge();
    return;
  }
  if (cloudState.saving) {
    cloudState.pending = true;
    return;
  }

  cloudState.saving = true;
  cloudState.pending = false;
  updateCloudBadge();

  // 每次送出前都重新建立最新執行中狀態，避免舊 payload 回滾玩家動作。
  let payload = v154BuildPayload();

  async function sendOnce(revision) {
    const { data, error } = await cloudState.client.rpc('save_game_state', {
      p_save: payload,
      p_client_revision: Number(revision || 0)
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('伺服器未回傳存檔結果');
    return row;
  }

  try {
    let row = await sendOnce(cloudState.revision);

    // revision 衝突不再把伺服器舊畫面直接套回目前遊戲。
    // 先採用伺服器 revision，再用玩家目前最新狀態安全重試一次。
    if (!row.accepted) {
      cloudState.revision = Number(row.server_revision || cloudState.revision || 0);
      payload = v154BuildPayload();
      row = await sendOnce(cloudState.revision);
    }

    if (!row.accepted) {
      cloudState.revision = Number(row.server_revision || cloudState.revision || 0);
      cloudState.remoteSave = row.server_save || cloudState.remoteSave || null;
      cloudState.lastError = 'SAVE_CONFLICT_RETRY_REQUIRED';
      cloudState.pending = false;
      cloudState.conflictRetryCount = Math.min(Number(cloudState.conflictRetryCount || 0) + 1, 6);
      const retryDelay = Math.min(1000 * Math.pow(2, cloudState.conflictRetryCount - 1), 30000);
      if (cloudState.conflictRetryTimer) clearTimeout(cloudState.conflictRetryTimer);
      cloudState.conflictRetryTimer = setTimeout(() => {
        cloudState.conflictRetryTimer = null;
        if (cloudState.writeEnabled && cloudState.cloudReady && !cloudState.saving) scheduleCloudSave(true);
      }, retryDelay);
      if (cloudState.conflictRetryCount <= 2 || cloudState.conflictRetryCount === 6) {
        console.warn('[V15.4 WORLD SAVE RECOVERY] revision conflict; retry scheduled', {
          revision: cloudState.revision,
          retryInMs: retryDelay,
          attempt: cloudState.conflictRetryCount
        });
      }
      return;
    }

    cloudState.revision = Number(row.server_revision || cloudState.revision + 1);
    cloudState.lastSyncedAt = row.server_updated_at
      ? Date.parse(row.server_updated_at)
      : Date.now();
    cloudState.remoteSave = payload;
    cloudState.lastError = '';
    v154CaptureAssetSafety(g);
    cloudState.conflictRetryCount = 0;
    if (cloudState.conflictRetryTimer) { clearTimeout(cloudState.conflictRetryTimer); cloudState.conflictRetryTimer = null; }
    v154PurgeLegacyLocalSave();
  } catch (error) {
    const message = error?.message || String(error);
    cloudState.lastError = message;
    if (message.includes('STALE_CLIENT_BUILD')) {
      cloudState.staleClientBlocked = true;
      cloudState.writeEnabled = false;
      toast('目前頁面版本已失效，雲端已拒絕舊版存檔');
    }
    console.error('[V15.4 WORLD SAVE RECOVERY] cloud save failed', error);
  } finally {
    cloudState.saving = false;
    updateCloudBadge();
    if (cloudState.pending && cloudState.writeEnabled) {
      cloudState.pending = false;
      setTimeout(() => scheduleCloudSave(true), 250);
    }
  }
};

flushOnUnload = function () {
  if (
    !g || g.dead || !cloudState.enabled || !cloudState.user || !navigator.onLine ||
    !cloudState.cloudReady || !cloudState.writeEnabled || cloudState.staleClientBlocked
  ) return;

  const payload = v154BuildPayload();
  cloudState.client.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token;
    if (!token) return;
    fetch(V12_ONLINE.supabaseUrl + '/rest/v1/rpc/save_game_state', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: V12_ONLINE.supabasePublishableKey,
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        p_save: payload,
        p_client_revision: Number(cloudState.revision || 0)
      })
    }).catch(() => {});
  }).catch(() => {});
};

// 將舊查詢參數換成目前版本標記；不更換路徑，不破壞 GitHub Pages。
try {
  const url = new URL(location.href);
  if (url.searchParams.get('update') !== '15430302') {
    url.searchParams.set('update', '15430302');
    history.replaceState(null, '', url.toString());
  }
} catch (_) {}

console.info('[V15.4 ASSET INTEGRITY FIX1] installed', { runtime: V154_RUNTIME_BUILD, requiredBuild: V154_CLOUD_REQUIRED_BUILD });
