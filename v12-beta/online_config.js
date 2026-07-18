/* 修仙大逃殺 V12.2 聯網封測設定（Publishable key 可放前端；禁止放 Secret/service_role key） */
window.XIANXIA_ONLINE_CONFIG = {
  enabled: true,
  requireCloudForBeta: true,
  supabaseUrl: "https://jbldhalexfrujudljhpf.supabase.co",
  supabasePublishableKey: "sb_publishable_fFAxdaiYEMTSvPpLecoi1A__JsnlfXr",
  build: "V12.6-STABLE-BASELINE",
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
