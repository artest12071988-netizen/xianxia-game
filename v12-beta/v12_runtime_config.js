'use strict';

/* ============================================================
   V12.9 / V13.5 FIX2 — 伺服器發布版遊戲設定載入器
   伺服器設定優先；靜態 JSON 只補入伺服器尚未包含的新欄位與新資料。
   ============================================================ */
(() => {
  const CACHE_KEY='xianxia_v129_published_config';
  Object.assign(cloudState,{runtimeConfigVersion:0,runtimeConfigLoadedAt:0,runtimeConfigTimer:null,runtimeConfigError:''});
  const baseAfterCloudLoginV129=afterCloudLogin;
  const baseStartOnlineWorldV129=startOnlineWorld;
  const baseOpenVersionV129=openVersion;
  let staticBaseConfig=null;

  function validRuntimeConfig(x){
    return !!(x&&typeof x==='object'&&x.params&&Array.isArray(x.realms)&&x.items&&Array.isArray(x.monsters)&&Array.isArray(x.npcShop)&&Array.isArray(x.techniques)&&x.breakthrough);
  }
  function plainObject(x){return !!x&&typeof x==='object'&&!Array.isArray(x)}
  function clone(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x))}
  function deepServerPriority(base,server){
    if(server===undefined)return clone(base);
    if(!plainObject(base)||!plainObject(server))return clone(server);
    const out={};
    for(const k of new Set([...Object.keys(base),...Object.keys(server)]))out[k]=deepServerPriority(base[k],server[k]);
    return out;
  }
  function mergeKeyed(base,server,keyOf){
    if(!Array.isArray(server))return clone(Array.isArray(base)?base:[]);
    if(!Array.isArray(base))return clone(server);
    const baseMap=new Map();
    for(const row of base){const key=keyOf(row);if(key!==null&&key!==undefined&&key!=='')baseMap.set(String(key),row)}
    const seen=new Set(),out=[];
    for(const row of server){
      const key=keyOf(row),normalized=key===null||key===undefined||key===''?null:String(key);
      out.push(normalized!==null&&baseMap.has(normalized)?deepServerPriority(baseMap.get(normalized),row):clone(row));
      if(normalized!==null)seen.add(normalized);
    }
    for(const row of base){
      const key=keyOf(row),normalized=key===null||key===undefined||key===''?null:String(key);
      if(normalized===null||!seen.has(normalized))out.push(clone(row));
    }
    return out;
  }
  function mergeRuntimeConfig(server,base=staticBaseConfig){
    if(!validRuntimeConfig(server))throw new Error('發布設定格式不完整');
    if(!validRuntimeConfig(base))return clone(server);
    const out=deepServerPriority(base,server);
    const specs={
      realms:x=>x?.lv,
      monsters:x=>x?.id,
      zones:x=>x?.coord,
      shop:x=>x?.id,
      npcShop:x=>x?.id,
      paymentPackages:x=>x?.id,
      techniques:x=>x?.id,
      aiCultivators:x=>x?.id,
      heavenlyTreasures:x=>x?.itemId,
      craftingRecipes:x=>x?.id
    };
    for(const [field,keyOf] of Object.entries(specs))out[field]=mergeKeyed(base[field],server[field],keyOf);
    return out;
  }
  function captureStaticConfig(){
    if(!staticBaseConfig&&typeof C!=='undefined'&&validRuntimeConfig(C))staticBaseConfig=clone(C);
    return !!staticBaseConfig;
  }
  async function waitForStaticConfig(){
    for(let i=0;i<100;i++){
      if(typeof C!=='undefined'&&C&&typeof P!=='undefined'&&P&&typeof R!=='undefined'&&R&&typeof IT!=='undefined'&&IT){captureStaticConfig();return true}
      await new Promise(r=>setTimeout(r,30));
    }
    return false;
  }
  function applyRuntimeConfig(config,version=0,source='server'){
    captureStaticConfig();
    const merged=mergeRuntimeConfig(config);
    if(!validRuntimeConfig(merged))throw new Error('發布設定格式不完整');
    C=merged;P=C.params;R=C.realms;IT=C.items;
    cloudState.runtimeConfigVersion=Number(version||0);cloudState.runtimeConfigLoadedAt=Date.now();cloudState.runtimeConfigError='';
    if(typeof g!=='undefined'&&g){normalizeSave();render();log('遊戲數值設定已切換至 Config '+cloudState.runtimeConfigVersion+'。','la')}
    if(source==='server')localStorage.setItem(CACHE_KEY,JSON.stringify({version:cloudState.runtimeConfigVersion,config:merged,storedAt:Date.now()}));
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
    sheet('<h3>V13.5 FIX2 相容修正版</h3><div class="list-row"><div class="grow"><strong>目前數值版本</strong><small>Config '+Number(cloudState.runtimeConfigVersion||0)+'｜伺服器發布版優先，靜態 V13.5 設定只補齊缺少欄位。</small></div></div><div class="list-row"><div class="grow"><strong>V13.5 萬法煉造</strong><small>修正外部模組讀不到 C、P、IT、g 與舊 Config 覆蓋新配方的問題。</small></div></div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">關閉</button>');
  };

  window.loadPublishedRuntimeConfig=loadPublishedRuntimeConfig;
  window.V135_CONFIG_COMPAT={mergeRuntimeConfig,validRuntimeConfig,getStaticBase:()=>clone(staticBaseConfig)};
})();
