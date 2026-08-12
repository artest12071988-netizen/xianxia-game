/* 修仙大逃殺 V12.2 聯網封測設定（Publishable key 可放前端；禁止放 Secret/service_role key） */
window.XIANXIA_ONLINE_CONFIG = {
  enabled: true,
  requireCloudForBeta: true,
  supabaseUrl: "https://jbldhalexfrujudljhpf.supabase.co",
  supabasePublishableKey: "sb_publishable_fFAxdaiYEMTSvPpLecoi1A__JsnlfXr",
  build: "V12.9-ADMIN-CONFIG",
  worldChannel: "xianxia-world-v123"
};


/* V12.5 Google Ad Manager 網頁獎勵式廣告提供者
   正式廣告單元路徑由手機後台寫入資料庫，不需改這個檔案。 */
window.XIANXIA_REWARDED_AD_PROVIDER = (() => {
  let active = false;
  function ensureGPT(){
    if(!window.googletag) throw new Error('Google 廣告程式尚未載入');
    window.googletag.cmd = window.googletag.cmd || [];
  }
  function show({adUnitId}){
    if(active) return Promise.reject(new Error('已有廣告正在播放'));
    if(!adUnitId) return Promise.reject(new Error('尚未設定正式廣告單元 ID'));
    ensureGPT(); active = true;
    return new Promise((resolve,reject)=>{
      window.googletag.cmd.push(()=>{
        let slot=null, granted=false, promiseDone=false;
        const cleanup=()=>{ active=false; try{if(slot)window.googletag.destroySlots([slot])}catch(_e){} };
        const fail=(message)=>{ if(!promiseDone){promiseDone=true;reject(message instanceof Error?message:new Error(String(message)))} cleanup(); };
        slot=window.googletag.defineOutOfPageSlot(adUnitId,window.googletag.enums.OutOfPageFormat.REWARDED);
        if(!slot){fail('此頁面或裝置目前不支援獎勵式廣告');return}
        slot.addService(window.googletag.pubads());
        const pubads=window.googletag.pubads();
        pubads.addEventListener('rewardedSlotReady',event=>{if(event.slot===slot){try{event.makeRewardedVisible()}catch(e){fail(e)}}});
        pubads.addEventListener('rewardedSlotGranted',event=>{if(event.slot===slot&&!promiseDone){granted=true;promiseDone=true;resolve({granted:true,reward:event.payload||null})}});
        pubads.addEventListener('rewardedSlotClosed',event=>{if(event.slot===slot){if(!granted&&!promiseDone){promiseDone=true;reject(new Error('廣告未完成，因此不發放獎勵'))}cleanup()}});
        pubads.addEventListener('slotRenderEnded',event=>{if(event.slot===slot&&event.isEmpty)fail('目前沒有可播放的廣告，請稍後再試')});
        window.googletag.enableServices();
        window.googletag.display(slot);
      });
    });
  }
  return {show};
})();

/* 2026-08-12 ADMIN REQUEST GUARD
   僅作用於 admin.html：防止重複 auth/subscription/interval 疊加時，
   player_presence 在線人數查詢與 admin_world_stats 統計 RPC 在短時間內被重複送出。
   不改遊戲頁、不改 presence 寫入、不改任何玩法或資料。 */
(function installAdminRequestGuard(){
  if(!/\/admin\.html$/i.test(location.pathname)) return;
  const nativeFetch=window.fetch.bind(window);
  const slots=new Map();
  const MIN_INTERVAL_MS=10000;
  function guardedKey(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
    if(method==='HEAD'&&url.includes('/rest/v1/player_presence')) return 'player_presence_online_count';
    if(method==='POST'&&url.includes('/rest/v1/rpc/admin_world_stats')) return 'admin_world_stats';
    return '';
  }
  window.fetch=async function(input,init){
    const key=guardedKey(input,init);
    if(!key) return nativeFetch(input,init);
    const now=Date.now();
    const current=slots.get(key);
    if(current&&current.response&&(now-current.at)<MIN_INTERVAL_MS) return current.response.clone();
    if(current&&current.pending) return (await current.pending).clone();
    const pending=nativeFetch(input,init).then(response=>{
      slots.set(key,{at:Date.now(),response:response.clone(),pending:null});
      return response;
    }).catch(error=>{
      slots.delete(key);
      throw error;
    });
    slots.set(key,{at:0,response:null,pending});
    return (await pending).clone();
  };
})();
