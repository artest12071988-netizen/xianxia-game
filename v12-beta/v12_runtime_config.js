'use strict';

/* ============================================================
   V12.9 — 伺服器發布版遊戲設定載入器
   靜態 xianxia_config_V12.json 永遠保留為離線／故障回退。
   ============================================================ */
(() => {
  const CACHE_KEY='xianxia_v129_published_config';
  Object.assign(cloudState,{runtimeConfigVersion:0,runtimeConfigLoadedAt:0,runtimeConfigTimer:null,runtimeConfigError:''});
  const baseAfterCloudLoginV129=afterCloudLogin;
  const baseStartOnlineWorldV129=startOnlineWorld;
  const baseOpenVersionV129=openVersion;

  function validRuntimeConfig(x){
    return !!(x&&typeof x==='object'&&x.params&&Array.isArray(x.realms)&&x.items&&Array.isArray(x.monsters)&&Array.isArray(x.npcShop)&&Array.isArray(x.techniques)&&x.breakthrough);
  }
  async function waitForStaticConfig(){
    for(let i=0;i<100;i++){if(typeof C!=='undefined'&&C&&P&&R&&IT)return true;await new Promise(r=>setTimeout(r,30))}
    return false;
  }
  function applyRuntimeConfig(config,version=0,source='server'){
    if(!validRuntimeConfig(config))throw new Error('發布設定格式不完整');
    C=config;P=C.params;R=C.realms;IT=C.items;
    cloudState.runtimeConfigVersion=Number(version||0);cloudState.runtimeConfigLoadedAt=Date.now();cloudState.runtimeConfigError='';
    if(g){normalizeSave();render();log('遊戲數值設定已切換至 Config '+cloudState.runtimeConfigVersion+'。','la')}
    if(source==='server')localStorage.setItem(CACHE_KEY,JSON.stringify({version:cloudState.runtimeConfigVersion,config,storedAt:Date.now()}));
  }
  function loadCachedRuntimeConfig(){
    try{const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(validRuntimeConfig(x?.config)){applyRuntimeConfig(x.config,x.version,'cache');return true}}catch(e){console.warn('runtime config cache',e)}
    return false;
  }
  async function loadPublishedRuntimeConfig(force=false){
    await waitForStaticConfig();
    if(!cloudState.enabled||!cloudState.client||!cloudState.user){if(!cloudState.runtimeConfigVersion)loadCachedRuntimeConfig();return false}
    try{
      const {data,error}=await cloudState.client.rpc('get_published_game_config');if(error)throw error;
      const version=Number(data?.version||0),config=data?.config;
      if(!config){if(!cloudState.runtimeConfigVersion)loadCachedRuntimeConfig();return false}
      if(force||version!==cloudState.runtimeConfigVersion)applyRuntimeConfig(config,version,'server');
      return true;
    }catch(e){cloudState.runtimeConfigError=String(e.message||e);console.warn('published config fallback',e);if(!cloudState.runtimeConfigVersion)loadCachedRuntimeConfig();return false}
  }
  function ensureRuntimeConfigTimer(){
    clearInterval(cloudState.runtimeConfigTimer);
    cloudState.runtimeConfigTimer=setInterval(()=>loadPublishedRuntimeConfig(false),60000);
  }

  afterCloudLogin=async function(){await loadPublishedRuntimeConfig(true);const r=await baseAfterCloudLoginV129();ensureRuntimeConfigTimer();return r};
  startOnlineWorld=async function(){const r=await baseStartOnlineWorldV129();await loadPublishedRuntimeConfig(false);ensureRuntimeConfigTimer();return r};
  openVersion=function(){
    sheet('<h3>V12.9 遊戲營運後台版</h3><div class="list-row"><div class="grow"><strong>目前數值版本</strong><small>Config '+Number(cloudState.runtimeConfigVersion||0)+'｜伺服器發布版優先，靜態 JSON 作為安全回退。</small></div></div><div class="list-row"><div class="grow"><strong>V12.8 突破事件</strong><small>15／20／30秒停靈、3×3天地異變、護法／襲擊／中立鎖定與走火入魔25%減益。</small></div></div><div class="list-row"><div class="grow"><strong>V12.9 數值管理</strong><small>後台可管理物品、商店、怪物、功法、戰鬥與突破參數，支援草稿、發布、回復及Excel匯入匯出。</small></div></div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">關閉</button>');
  };

  window.loadPublishedRuntimeConfig=loadPublishedRuntimeConfig;
})();
