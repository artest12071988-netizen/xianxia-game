'use strict';

/* ============================================================
   V12.8 — 突破、天地異變、三陣營與走火入魔
   獨立補丁：不重寫 V12.7 AI 重生與 V12.6.4 打坐廣告流程。
   ============================================================ */
(() => {
  const DEFAULT_CFG = {
    foundation_seconds:15,
    core_seconds:20,
    nascent_seconds:30,
    event_radius:1,
    qi_deviation_multiplier:0.75,
    rebirth_foundation_rate:1,
    rebirth_core_bonus:0.30,
    rebirth_nascent_bonus:0.05,
    neutral_expel:true,
    faction_locked:true,
    guardian_priority:true,
    battle_tick_seconds:3,
    base_attack_damage:7,
    enabled:true
  };

  Object.assign(cloudState, {
    breakthroughConfig:{...DEFAULT_CFG},
    breakthroughLoop:null,
    breakthroughWorldLoop:null,
    breakthroughPolling:false,
    breakthroughEvents:[],
    breakthroughJoined:new Map(),
    breakthroughPrompted:new Set(),
    breakthroughPendingChoice:null,
    breakthroughLastWorldLoad:0
  });

  const baseNormalizeSave = normalizeSave;
  const baseRender = render;
  const baseStartLoops = startLoops;
  const baseAfterCloudLogin = afterCloudLogin;
  const baseMoveTo = moveTo;
  const baseExplore = explore;
  const baseToggleMeditate = toggleMeditate;
  const baseMeditationButtonClick = typeof meditationButtonClick==='function'?meditationButtonClick:toggleMeditate;
  const baseStartMeditationNormal = typeof startMeditationNormal==='function'?startMeditationNormal:null;
  const baseStartMeditationWithAd = typeof startMeditationWithAdBoost==='function'?startMeditationWithAdBoost:null;
  const baseOpenBag = typeof openBag==='function'?openBag:null;
  const baseOpenShop = typeof openShop==='function'?openShop:null;
  const baseStartFightAi = startFightAi;
  const baseStartFightMonster = startFightMonster;
  const baseOpenWorldMap = openWorldMap;
  const basePAtk = pAtk;
  const basePDef = pDef;
  const baseGainExp = gainExp;
  const baseOnLevel = onLevel;

  function cfg(){ return {...DEFAULT_CFG,...(cloudState.breakthroughConfig||{})}; }
  function currentBreakCoord(){ return g ? coordOf(g.pos.r,g.pos.c) : ''; }
  function breakthroughState(){ return g?.breakthroughState || null; }
  function ownerBreakthroughActive(){ return !!(g?.breakthroughState?.active && !g.breakthroughState.resultApplied); }
  function qiDeviationActive(){ return !!(g?.qiDeviation?.active || g?.status?.includes('走火入魔')); }
  function deviationMultiplier(){ return qiDeviationActive() ? Number(g?.qiDeviation?.multiplier || cfg().qi_deviation_multiplier || .75) : 1; }
  function percent(v){ return Math.round(Number(v||0)*1000)/10+'%'; }
  function targetSeconds(target){
    const c=cfg();
    if(target==='築基期')return Number(c.foundation_seconds||15);
    if(target==='結丹期')return Number(c.core_seconds||20);
    return Number(c.nascent_seconds||30);
  }
  function coordInEvent(origin,coord,radius=cfg().event_radius){
    if(!origin||!coord)return false;
    try{return distanceCoord(origin,coord)<=Number(radius||1)}catch(_){return false}
  }
  function factionText(f){return ({guardian:'護法',attacker:'襲擊',neutral:'中立'})[f]||f||'未選'}

  function injectBreakthroughStyles(){
    if(document.getElementById('v128BreakthroughStyle'))return;
    const s=document.createElement('style');s.id='v128BreakthroughStyle';s.textContent=`
      .bt-scene{position:fixed;inset:0;z-index:9999;background:#02050a;display:grid;place-items:center;overflow:hidden;color:#f2ead8;font-family:"PingFang TC","Noto Sans TC",system-ui,sans-serif}
      .bt-scene-bg{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.78)),url('assets/breakthrough_scene.png') center/cover no-repeat;transform:scale(1.015)}
      .bt-scene.active .bt-scene-bg{animation:btMicroShake .23s steps(2,end) infinite}
      @keyframes btMicroShake{0%{transform:translate(0,0) scale(1.018)}25%{transform:translate(2px,-1px) scale(1.018)}50%{transform:translate(-1px,2px) scale(1.018)}75%{transform:translate(1px,1px) scale(1.018)}100%{transform:translate(-2px,-1px) scale(1.018)}}
      .bt-aura{position:absolute;left:50%;top:47%;width:150vmax;height:150vmax;transform:translate(-50%,-50%);opacity:0;pointer-events:none;background:repeating-conic-gradient(from 0deg,transparent 0 7deg,rgba(109,229,218,.12) 8deg 9deg,transparent 10deg 18deg);mask-image:radial-gradient(circle,transparent 0 7%,#000 12% 45%,transparent 67%)}
      .bt-scene.active .bt-aura{opacity:.8;animation:btAuraFocus 1.8s ease-in-out infinite}
      @keyframes btAuraFocus{0%{transform:translate(-50%,-50%) scale(1.12) rotate(0deg);opacity:.25}65%{transform:translate(-50%,-50%) scale(.64) rotate(3deg);opacity:.86}100%{transform:translate(-50%,-50%) scale(.48) rotate(5deg);opacity:.12}}
      .bt-panel{position:relative;z-index:2;width:min(760px,94vw);margin-top:auto;margin-bottom:3vh;padding:18px;border:1px solid rgba(215,185,102,.55);border-radius:16px;background:linear-gradient(180deg,rgba(5,10,16,.56),rgba(3,7,12,.94));box-shadow:0 22px 80px #000b,0 0 40px rgba(86,216,206,.12);backdrop-filter:blur(6px)}
      .bt-title{text-align:center;margin:0 0 8px;color:#e3c66f;font-family:"Songti TC",serif;font-size:clamp(23px,5vw,38px);letter-spacing:.18em}
      .bt-sub{text-align:center;color:#c7d8d4;font-size:13px;line-height:1.7;margin:0 0 12px}
      .bt-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0}.bt-stats div{padding:9px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#06101ad9;text-align:center}.bt-stats span{display:block;color:#8799a5;font-size:10px}.bt-stats b{display:block;color:#f2d982;margin-top:3px;font-size:14px}
      .bt-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:13px}.bt-actions button{min-height:48px;border-radius:10px;border:1px solid #465468;background:#101b28;color:#eee;cursor:pointer;font-weight:700}.bt-actions .start{border-color:#9b7b3b;color:#f2d982;background:#2a2110db}.bt-actions button:disabled{opacity:.45}
      .bt-countdown{text-align:center;font-size:clamp(34px,8vw,62px);font-weight:800;color:#f2d982;text-shadow:0 0 22px rgba(242,217,130,.4);font-variant-numeric:tabular-nums}.bt-line{text-align:center;color:#8de2d9;font-size:12px;min-height:20px}
      .bt-faction-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:12px}.bt-faction-grid button{padding:13px 8px;border-radius:10px;border:1px solid #39495d;background:#0c1621;color:#eee;cursor:pointer}.bt-faction-grid button.guard{color:#77d89c;border-color:#356b4b}.bt-faction-grid button.attack{color:#ef7c73;border-color:#7b3935}.bt-faction-grid button.neutral{color:#c3cad4}
      body.breakthrough-locked{overflow:hidden}
      @media(max-width:650px){.bt-panel{margin-bottom:1.5vh;padding:13px}.bt-stats{grid-template-columns:1fr 1fr}.bt-faction-grid{grid-template-columns:1fr}.bt-actions{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s);
  }

  function sceneElement(){return document.getElementById('breakthroughScene')}
  function closeBreakthroughScene(){const e=sceneElement();if(e)e.remove();document.body.classList.remove('breakthrough-locked')}
  function buildRateInfo(){
    const r=realmOf(g.lv),bt=C.breakthrough[String(g.lv)],z=zoneAt(g.pos.r,g.pos.c);
    if(!bt)return null;
    const ids={5:['8001'],10:['8002','8003'],15:['8004','8005']}[g.lv]||[];
    let rate=Number(bt.base||0),itemBonus=0,zoneBonus=Number(z?.breakBonus||0),techniqueBonus=0,techniqueRule='';
    const items=[];
    for(const id of ids){const n=Number(g.inv?.[id]||0);if(!n)continue;const add=Number(IT[id]?.val||0)/100*n;itemBonus+=add;items.push({id,n,name:IT[id]?.name||id,add})}
    rate+=itemBonus+zoneBonus;
    if(g.techniques?.includes('rebirth')){
      const c=cfg();
      if(bt.target==='築基期'){rate=Math.max(rate,Number(c.rebirth_foundation_rate||1));techniqueRule='三重轉生訣：築基成功率提升至 100%'}
      else if(bt.target==='結丹期'){techniqueBonus=Number(c.rebirth_core_bonus||.30);rate+=techniqueBonus;techniqueRule='三重轉生訣：結丹 +30 個百分點'}
      else if(bt.target==='元嬰期'){techniqueBonus=Number(c.rebirth_nascent_bonus||.05);rate+=techniqueBonus;techniqueRule='三重轉生訣：元嬰 +5 個百分點'}
    }
    rate=Math.max(0,Math.min(1,rate));
    return {r,bt,z,ids,items,base:Number(bt.base||0),itemBonus,zoneBonus,techniqueBonus,techniqueRule,rate,seconds:targetSeconds(bt.target)};
  }

  function openBreakthroughConfirmation(info){
    injectBreakthroughStyles();closeBreakthroughScene();
    const el=document.createElement('div');el.id='breakthroughScene';el.className='bt-scene';
    const details=[
      '<div><span>基礎成功率</span><b>'+percent(info.base)+'</b></div>',
      '<div><span>丹藥／材料</span><b>+'+percent(info.itemBonus)+'</b></div>',
      '<div><span>地脈加成</span><b>+'+percent(info.zoneBonus)+'</b></div>',
      '<div><span>本次成功率</span><b>'+percent(info.rate)+'</b></div>'
    ].join('');
    const itemText=info.items.length?info.items.map(x=>esc(x.name)+' ×'+x.n).join('、'):'未使用突破物品';
    el.innerHTML='<div class="bt-scene-bg"></div><div class="bt-aura"></div><div class="bt-panel"><h2 class="bt-title">'+esc(info.bt.stage)+'</h2><p class="bt-sub">'+esc(itemText)+(info.techniqueRule?'<br>'+esc(info.techniqueRule):'')+'<br>開始後停靈 '+info.seconds+' 秒，期間無法取消或進行其他行動。</p><div class="bt-stats">'+details+'</div><div class="bt-actions"><button class="start" onclick="startBreakthroughV128()">開始突破</button><button onclick="cancelBreakthroughV128()">再準備一下</button></div></div>';
    document.body.appendChild(el);document.body.classList.add('breakthrough-locked');
    cloudState.breakthroughPrepared=info;
  }

  function renderActiveScene(){
    const s=breakthroughState();if(!s?.active)return;
    injectBreakthroughStyles();let el=sceneElement();
    if(!el){el=document.createElement('div');el.id='breakthroughScene';document.body.appendChild(el)}
    el.className='bt-scene active';document.body.classList.add('breakthrough-locked');
    const remain=Math.max(0,Number(s.endsAt||0)-Date.now());
    const sec=(remain/1000).toFixed(remain<10000?1:0);
    el.innerHTML='<div class="bt-scene-bg"></div><div class="bt-aura"></div><div class="bt-panel"><h2 class="bt-title">正在突破 · '+esc(s.targetRealm)+'</h2><div class="bt-countdown">'+sec+'</div><p class="bt-sub">天地靈氣正在向道體匯聚。停靈期間不能移動、打坐、探索、戰鬥或取消。</p><div class="bt-stats"><div><span>護法人</span><b id="btGuardianCount">'+Number(s.guardianCount||0)+'</b></div><div><span>襲擊者</span><b id="btAttackerCount">'+Number(s.attackerCount||0)+'</b></div><div><span>目前體力</span><b>'+Math.max(0,Math.round(g.hp))+' / '+g.hpMax+'</b></div><div><span>成功率</span><b>'+percent(s.rate)+'</b></div></div><div class="bt-line" id="btEventLine">'+esc(s.eventLine||'天地異變已籠罩周圍 3×3 區域')+'</div></div>';
  }

  function updateActiveScene(state){
    const s=breakthroughState();if(!s)return;
    if(state){s.guardianCount=Number(state.guardian_count||0);s.attackerCount=Number(state.attacker_count||0);s.serverStatus=state.status||s.serverStatus}
    renderActiveScene();
  }

  async function loadBreakthroughConfig(){
    if(!cloudState.enabled||!cloudState.client||!cloudState.user)return cfg();
    try{const {data,error}=await cloudState.client.rpc('get_breakthrough_config');if(error)throw error;if(data)cloudState.breakthroughConfig={...DEFAULT_CFG,...data}}
    catch(e){console.warn('breakthrough config fallback',e)}
    return cfg();
  }

  function consumeBreakthroughItems(info){
    for(const id of info.ids||[]){if(g.inv?.[id])g.inv[id]=0}
  }

  async function startBreakthrough(){
    const info=cloudState.breakthroughPrepared||buildRateInfo();if(!info||ownerBreakthroughActive())return;
    const coord=currentBreakCoord();let eventId=null,endsAt=Date.now()+info.seconds*1000;
    try{
      if(cloudState.enabled&&cloudState.client&&cloudState.user){
        const {data,error}=await cloudState.client.rpc('start_breakthrough_event',{
          p_character_id:g.characterId||'unknown',p_owner_name:g.name,p_origin_coord:coord,
          p_source_level:g.lv,p_target_realm:info.bt.target,p_success_rate:info.rate,
          p_owner_hp:Math.max(1,Math.round(g.hp)),p_owner_hp_max:Math.max(1,Math.round(g.hpMax))
        });
        if(error)throw error;eventId=data?.event_id||null;endsAt=Date.parse(data?.ends_at)||endsAt;
      }
    }catch(e){toast('無法開始突破：'+String(e.message||e));return}

    consumeBreakthroughItems(info);
    g.meditating=false;g.meditateSec=0;
    g.breakthroughState={active:true,resultApplied:false,eventId:eventId||null,targetRealm:info.bt.target,sourceLevel:g.lv,rate:info.rate,originCoord:coord,startedAt:Date.now(),endsAt,guardianCount:0,attackerCount:0,eventLine:'天地異變已籠罩周圍 3×3 區域'};
    cloudState.breakthroughPrepared=null;cloudState.playerAction='境界突破';
    log('你引動 '+info.bt.stage+'，天地靈氣暴動，周圍 3×3 區域皆可感知。','la');
    saveGame(false);renderActiveScene();ensureBreakthroughLoops();
    if(typeof syncPlayerPresence==='function')syncPlayerPresence(true);
  }

  function applyDeviation(){
    const mult=Number(cfg().qi_deviation_multiplier||.75);
    g.qiDeviation={active:true,multiplier:mult,appliedAt:Date.now()};
    g.status=g.status||[];if(!g.status.includes('走火入魔'))g.status.push('走火入魔');
    applyDeviationCaps();
  }
  function clearDeviation(){
    if(!g)return;g.qiDeviation=null;g.status=(g.status||[]).filter(x=>x!=='走火入魔');
    const r=realmOf(g.lv);g.hpMax=r.hp;g.mpMax=Math.max(P.start_stamina,r.mp);g.hp=Math.min(g.hp,g.hpMax);g.mp=Math.min(g.mp,g.mpMax);
  }
  function applyDeviationCaps(){
    if(!g||!qiDeviationActive())return;
    const r=realmOf(g.lv),m=deviationMultiplier();
    g.hpMax=Math.max(1,Math.floor(Number(r.hp||g.hpMax||1)*m));
    g.mpMax=Math.max(1,Math.floor(Math.max(Number(P.start_stamina||0),Number(r.mp||0),1)*m));
    g.hp=Math.min(Number(g.hp||0),g.hpMax);g.mp=Math.min(Number(g.mp||0),g.mpMax);
  }

  async function finishOwnerBreakthrough(status,result={}){
    const s=breakthroughState();if(!s||s.resultApplied)return;s.resultApplied=true;s.active=false;
    g.breakthroughHistory=Array.isArray(g.breakthroughHistory)?g.breakthroughHistory:[];if(s.eventId&&!g.breakthroughHistory.includes(String(s.eventId)))g.breakthroughHistory.push(String(s.eventId));g.breakthroughHistory=g.breakthroughHistory.slice(-30);
    closeBreakthroughScene();
    if(status==='success'){
      clearDeviation();g.lv++;g.big=s.targetRealm;baseOnLevel();
      log('天雷過境，成功突破至 '+s.targetRealm+'！','lg');
      sheet('<h3>突破成功</h3><p>天地雷雲散去，你已踏入 <b>'+esc(s.targetRealm)+'</b>。</p><button class="btn gold" style="width:100%" onclick="closeOv()">穩固境界</button>');
    }else if(status==='dead'){
      g.breakthroughState=null;saveGame(false);
      if(typeof finalizePermanentDeath==='function')return finalizePermanentDeath('突破期間遭襲擊身亡');
    }else{
      applyDeviation();
      log('突破失敗，氣息紊亂，走火入魔；攻防、體力、精力、修為與恢復效率降低 25%。','ld');
      sheet('<h3 style="color:var(--red)">突破失敗</h3><p>靈氣逆行，你陷入走火入魔。</p><div class="notice">攻擊、防禦、最大體力、最大精力、修為取得與打坐恢復效率均降為原本的 '+Math.round(deviationMultiplier()*100)+'%。此狀態不會重複疊扣。</div><button class="btn" style="width:100%;margin-top:10px" onclick="closeOv()">調息療傷</button>');
    }
    g.breakthroughState=null;cloudState.playerAction='突破結束';saveGame(false);render();
    if(typeof syncPlayerPresence==='function')syncPlayerPresence(true);
  }

  async function pollOwnerBreakthrough(){
    const s=breakthroughState();if(!s?.active)return;
    if(!s.eventId){
      if(Date.now()>=Number(s.endsAt||0))return finishOwnerBreakthrough(Math.random()<Number(s.rate||0)?'success':'failure');
      updateActiveScene();return;
    }
    try{
      const {data,error}=await cloudState.client.rpc('poll_breakthrough_event',{p_event_id:s.eventId});if(error)throw error;
      const dmg=Number(data?.owner_pending_damage||0);if(dmg>0){g.hp=Math.max(0,g.hp-dmg);s.eventLine='襲擊者突破護法空隙，你受到 '+dmg+' 點傷害';log('突破期間遭受襲擊，體力 -'+dmg+'。','ld')}
      updateActiveScene(data);
      if(g.hp<=0||data?.status==='dead')return finishOwnerBreakthrough('dead',data?.result);
      if(data?.status==='success'||data?.status==='failure'||data?.status==='interrupted')return finishOwnerBreakthrough(data.status,data?.result);
      saveGame(false);
    }catch(e){console.warn('breakthrough owner poll',e);updateActiveScene()}
  }

  async function restoreOwnerBreakthrough(){
    if(!g||!cloudState.enabled||!cloudState.client||!cloudState.user)return false;
    try{
      const {data,error}=await cloudState.client.from('breakthrough_events')
        .select('id,owner_user_id,source_level,target_realm,success_rate,origin_coord,started_at,ends_at,status,result')
        .eq('owner_user_id',cloudState.user.id).order('started_at',{ascending:false}).limit(1).maybeSingle();
      if(error)throw error;if(!data)return false;
      g.breakthroughHistory=Array.isArray(g.breakthroughHistory)?g.breakthroughHistory:[];
      if(g.breakthroughHistory.includes(String(data.id)))return false;
      if(data.status==='active'){
        g.meditating=false;g.meditateSec=0;
        g.breakthroughState={active:true,resultApplied:false,eventId:String(data.id),targetRealm:data.target_realm,sourceLevel:Number(data.source_level),rate:Number(data.success_rate),originCoord:data.origin_coord,startedAt:Date.parse(data.started_at)||Date.now(),endsAt:Date.parse(data.ends_at)||Date.now(),guardianCount:0,attackerCount:0,eventLine:'已從伺服器恢復未完成的突破事件'};
        cloudState.playerAction='境界突破';saveGame(false);renderActiveScene();ensureBreakthroughLoops();return true;
      }
      const source=Number(data.source_level||0);
      g.breakthroughState={active:false,resultApplied:false,eventId:String(data.id),targetRealm:data.target_realm,sourceLevel:source,rate:Number(data.success_rate),originCoord:data.origin_coord,startedAt:Date.parse(data.started_at)||Date.now(),endsAt:Date.parse(data.ends_at)||Date.now()};
      if(data.status==='success'&&Number(g.lv)>source){g.breakthroughHistory.push(String(data.id));g.breakthroughState=null;saveGame(false);return false}
      if((data.status==='failure'||data.status==='interrupted')&&qiDeviationActive()){g.breakthroughHistory.push(String(data.id));g.breakthroughState=null;saveGame(false);return false}
      await finishOwnerBreakthrough(data.status,data.result||{});return true;
    }catch(e){console.warn('restore breakthrough owner state',e);return false}
  }

  async function loadMyBreakthroughParticipation(){
    if(!cloudState.enabled||!cloudState.client||!cloudState.user)return;
    try{const {data,error}=await cloudState.client.rpc('list_my_active_breakthroughs');if(error)throw error;cloudState.breakthroughJoined=new Map((data||[]).map(x=>[String(x.event_id),x]))}
    catch(e){console.warn('breakthrough participation',e)}
  }

  async function pollJoinedBreakthroughs(){
    if(ownerBreakthroughActive()||!cloudState.enabled||!cloudState.client||!cloudState.user)return;
    for(const [eventId,row] of cloudState.breakthroughJoined){
      try{
        const {data,error}=await cloudState.client.rpc('poll_breakthrough_event',{p_event_id:eventId});if(error)throw error;
        const dmg=Number(data?.participant_pending_damage||0);
        if(dmg>0){g.hp=Math.max(0,g.hp-dmg);log('你在突破事件中承受 '+dmg+' 點攻擊傷害。','ld');render();saveGame(false)}
        if(g.hp<=0||data?.my_participant_alive===false){
          cloudState.breakthroughJoined.delete(eventId);
          if(typeof finalizePermanentDeath==='function')return finalizePermanentDeath('為突破事件護法／襲擊時身亡');
        }
        if(data?.status!=='active')cloudState.breakthroughJoined.delete(eventId);
      }catch(e){console.warn('joined breakthrough poll',e)}
    }
  }

  async function loadBreakthroughWorld(){
    if(!g||!cloudState.enabled||!cloudState.client||!cloudState.user)return;
    if(Date.now()-cloudState.breakthroughLastWorldLoad<800)return;
    cloudState.breakthroughLastWorldLoad=Date.now();
    try{
      const {data,error}=await cloudState.client.from('breakthrough_events').select('id,owner_user_id,owner_name,origin_coord,target_realm,ends_at,status').eq('status','active').gt('ends_at',new Date().toISOString());
      if(error)throw error;cloudState.breakthroughEvents=data||[];
      if(cloudState.breakthroughPendingChoice&&!cloudState.breakthroughEvents.some(x=>String(x.id)===String(cloudState.breakthroughPendingChoice.id)))cloudState.breakthroughPendingChoice=null;
      const {data:near,error:nearError}=await cloudState.client.rpc('list_nearby_breakthrough_events',{p_coord:currentBreakCoord()});if(nearError)throw nearError;
      for(const e of near||[]){
        if(String(e.owner_user_id)===String(cloudState.user.id))continue;
        const id=String(e.id);
        if(!cloudState.breakthroughPrompted.has(id)){
          cloudState.breakthroughPrompted.add(id);
          if(typeof pushSenseEvent==='function')pushSenseEvent('天地靈氣暴動，附近似乎有人正在突破 '+e.target_realm+'。','alert');
          log('天地發生異變，'+esc(e.owner_name)+' 附近雷雲聚集，似乎正在突破。','la');
        }
        if(!e.my_faction){cloudState.breakthroughPendingChoice=e;showFactionChoice(e);break}
      }
    }catch(e){console.warn('breakthrough world load',e)}
  }

  function showFactionChoice(event){
    if(!event||ownerBreakthroughActive()||fight)return;
    sheet('<h3>天地異變 · 必須選擇立場</h3><p><b>'+esc(event.owner_name)+'</b> 正在突破 '+esc(event.target_realm)+'。你身處其周圍 3×3 異變區域，本次事件選擇後不可轉換陣營。</p><div class="bt-faction-grid"><button class="guard" onclick="chooseBreakthroughFactionV128(\''+event.id+'\',\'guardian\')"><b>護法</b><br><small>留在區域，優先承受襲擊</small></button><button class="attack" onclick="chooseBreakthroughFactionV128(\''+event.id+'\',\'attacker\')"><b>襲擊</b><br><small>護法人歸零後才攻擊突破者</small></button><button class="neutral" onclick="chooseBreakthroughFactionV128(\''+event.id+'\',\'neutral\')"><b>中立</b><br><small>立即被排出區域，事件期間禁止重返</small></button></div>');
  }

  async function chooseFaction(eventId,faction){
    if(!cloudState.enabled||!cloudState.client)return;
    try{
      const {data,error}=await cloudState.client.rpc('choose_breakthrough_faction',{p_event_id:eventId,p_faction:faction});if(error)throw error;
      cloudState.breakthroughPendingChoice=null;cloudState.breakthroughJoined.set(String(eventId),{event_id:eventId,faction,expelled_coord:data?.expelled_coord});
      if(faction==='neutral'&&data?.expelled_coord){const p=coordRC(data.expelled_coord);g.pos={r:p.r,c:p.c};cloudState.playerAction='被天地異變排出';log('你選擇中立，天地異變將你排出至 '+esc(data.expelled_coord)+'。','la')}
      else log('你在本次突破事件選擇「'+factionText(faction)+'」，陣營已鎖定。','la');
      closeOv();saveGame(false);render();if(typeof syncPlayerPresence==='function')syncPlayerPresence(true);
    }catch(e){const m=String(e.message||e);if(m.includes('NOT_ACTIVE')){cloudState.breakthroughPendingChoice=null;closeOv();loadBreakthroughWorld()}toast(m.includes('FACTION_LOCKED')?'本次突破期間不可轉換陣營':'選擇失敗：'+m)}
  }

  function operationBlocked(){
    if(ownerBreakthroughActive()){toast('停靈突破中，無法進行其他行動');renderActiveScene();return true}
    if(cloudState.breakthroughPendingChoice){showFactionChoice(cloudState.breakthroughPendingChoice);toast('請先選擇突破事件陣營');return true}
    return false;
  }

  function neutralCannotEnter(dest){
    for(const e of cloudState.breakthroughEvents||[]){
      const joined=cloudState.breakthroughJoined.get(String(e.id));
      if(joined?.faction==='neutral'&&coordInEvent(e.origin_coord,dest,cfg().event_radius))return true;
    }
    return false;
  }

  function ensureBreakthroughLoops(){
    clearInterval(cloudState.breakthroughLoop);clearInterval(cloudState.breakthroughWorldLoop);
    cloudState.breakthroughLoop=setInterval(async()=>{
      if(cloudState.breakthroughPolling)return;cloudState.breakthroughPolling=true;
      try{await pollOwnerBreakthrough();await pollJoinedBreakthroughs()}finally{cloudState.breakthroughPolling=false}
    },1000);
    cloudState.breakthroughWorldLoop=setInterval(async()=>{await loadMyBreakthroughParticipation();await loadBreakthroughWorld()},1500);
    pollOwnerBreakthrough();loadMyBreakthroughParticipation().then(loadBreakthroughWorld);
  }

  normalizeSave=function(){
    baseNormalizeSave();
    g.status=g.status||[];
    if(g.status.includes('走火入魔')&&!g.qiDeviation)g.qiDeviation={active:true,multiplier:cfg().qi_deviation_multiplier||.75};
    if(g.qiDeviation?.active&&!g.status.includes('走火入魔'))g.status.push('走火入魔');
    applyDeviationCaps();
    if(g.breakthroughState?.active&&Number(g.breakthroughState.endsAt||0)<=0)g.breakthroughState=null;
  };

  pAtk=function(){return Math.max(1,Math.round(basePAtk()*deviationMultiplier()))};
  pDef=function(){return Math.max(0,Math.round(basePDef()*deviationMultiplier()))};
  gainExp=function(n,doRender=true){return baseGainExp(Number(n||0)*deviationMultiplier(),doRender)};
  onLevel=function(){baseOnLevel();applyDeviationCaps()};

  // 保留 V12.6.4 單一打坐流程，只把走火入魔的修為與恢復效率套入 75%。
  tickMeditation=function(){
    if(!g||!g.meditating||fight||ownerBreakthroughActive())return;
    const s=typeof getAdMeditationSession==='function'?getAdMeditationSession():null;
    if(s&&Number(s.until||0)<=Date.now()){finishMeditation('廣告加持時間到期');return}
    g.meditateSec++;
    const z=zoneAt(g.pos.r,g.pos.c),novice=!!(z&&z.novice),baseMult=g.techniques.includes('dust')?2:1,dev=deviationMultiplier();
    const expInterval=novice?P.meditate_novice_exp_interval_sec:P.meditate_exp_interval_sec;let changed=false;
    if(g.meditateSec%expInterval===0){const raw=baseMult,actual=raw*dev;baseGainExp(actual,false);if(s&&!s.settled)s.baseExp=Number(s.baseExp||0)+raw;changed=true}
    if(g.meditateSec%P.meditate_hp_interval_sec===0){const before=g.hp;g.hp=clamp(g.hp+P.meditate_hp_gain*baseMult*dev,0,g.hpMax);if(s&&!s.settled)s.baseHp=Number(s.baseHp||0)+Math.max(0,g.hp-before);changed=true}
    if(g.meditateSec%P.meditate_mp_interval_sec===0){const before=g.mp;g.mp=clamp(g.mp+P.meditate_mp_gain*baseMult*dev,0,g.mpMax);if(s&&!s.settled)s.baseMp=Number(s.baseMp||0)+Math.max(0,g.mp-before);changed=true}
    if(changed){saveGame(false);render()}else if(typeof renderMeditationUI==='function')renderMeditationUI();
  };

  render=function(){
    applyDeviationCaps();baseRender();
    if(ownerBreakthroughActive())renderActiveScene();
    const b=$('brkBtn');if(b&&ownerBreakthroughActive())b.disabled=true;
  };

  startLoops=function(){baseStartLoops();ensureBreakthroughLoops();setTimeout(restoreOwnerBreakthrough,0)};
  afterCloudLogin=async function(){await loadBreakthroughConfig();const r=await baseAfterCloudLogin();await loadMyBreakthroughParticipation();await loadBreakthroughWorld();return r};

  openBreak=function(){
    if(operationBlocked())return;
    const r=realmOf(g.lv),bt=C.breakthrough[String(g.lv)],z=zoneAt(g.pos.r,g.pos.c);
    if(!bt||g.exp<r.expCum){toast('尚未達到突破條件');return}
    if(z&&z.novice){sheet('<h3>新手結界禁止突破</h3><p>青牛谷結界會壓制天劫。請先離開新手村。</p><button class="btn jade" onclick="closeOv();openWorldMap()">開啟地圖</button>');return}
    const info=buildRateInfo();openBreakthroughConfirmation(info);
  };

  moveTo=function(r,c){
    if(operationBlocked())return;
    const dest=coordOf(Number(r),Number(c));if(neutralCannotEnter(dest)){toast('你已選擇中立，本次突破期間禁止重返異變區域');return}
    const before=currentBreakCoord();const out=baseMoveTo(r,c);const after=currentBreakCoord();
    if(before!==after&&cloudState.enabled&&cloudState.client&&cloudState.user)cloudState.client.rpc('update_breakthrough_participant_coord',{p_coord:after}).catch(()=>{});
    setTimeout(loadBreakthroughWorld,250);return out;
  };
  explore=function(){if(operationBlocked())return;return baseExplore()};
  toggleMeditate=function(){if(operationBlocked())return;return baseToggleMeditate()};
  meditationButtonClick=function(){if(operationBlocked())return;return baseMeditationButtonClick()};
  window.meditationButtonClick=meditationButtonClick;
  if(baseStartMeditationNormal){startMeditationNormal=function(){if(operationBlocked())return;return baseStartMeditationNormal()};window.startMeditationNormal=startMeditationNormal}
  if(baseStartMeditationWithAd){startMeditationWithAdBoost=function(){if(operationBlocked())return;return baseStartMeditationWithAd()};window.startMeditationWithAdBoost=startMeditationWithAdBoost}
  if(baseOpenBag)openBag=function(...args){if(ownerBreakthroughActive()){toast('停靈突破中無法整理行囊');return}return baseOpenBag(...args)};
  if(baseOpenShop)openShop=function(...args){if(ownerBreakthroughActive()){toast('停靈突破中無法進入坊市');return}return baseOpenShop(...args)};
  startFightAi=function(id){if(operationBlocked())return;return baseStartFightAi(id)};
  startFightMonster=function(m){if(operationBlocked())return;return baseStartFightMonster(m)};
  openWorldMap=function(){if(ownerBreakthroughActive()){toast('停靈突破中無法開啟地圖');return}return baseOpenWorldMap()};

  window.startBreakthroughV128=startBreakthrough;
  window.cancelBreakthroughV128=function(){cloudState.breakthroughPrepared=null;closeBreakthroughScene()};
  window.chooseBreakthroughFactionV128=chooseFaction;
  window.loadBreakthroughConfig=loadBreakthroughConfig;
  window.restoreOwnerBreakthroughV128=restoreOwnerBreakthrough;

  injectBreakthroughStyles();
})();
