'use strict';

/* ============================================================
   V15.4 Phase 3 Stage 1 — 沉浸式孤島天象立場選擇與戰場主骨架
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
      .bt-scene-bg{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,6,16,.22),rgba(0,0,0,.82)),radial-gradient(circle at 50% 16%,rgba(157,205,255,.18),transparent 26%),url('assets/breakthrough_scene.png') center/cover no-repeat;transform:scale(1.02)}
      .bt-scene::before{content:"";position:absolute;inset:-10%;background:radial-gradient(circle at 50% 24%,rgba(132,210,255,.09),transparent 16%),repeating-conic-gradient(from 0deg at 50% 18%,transparent 0 15deg,rgba(147,206,255,.06) 16deg 18deg,transparent 19deg 28deg);mask:radial-gradient(circle at 50% 18%,transparent 0 5%,#000 9% 40%,transparent 56%);opacity:.75;pointer-events:none}
      .bt-scene.active .bt-scene-bg{animation:btMicroShake .23s steps(2,end) infinite}
      @keyframes btMicroShake{0%{transform:translate(0,0) scale(1.02)}25%{transform:translate(2px,-1px) scale(1.02)}50%{transform:translate(-1px,2px) scale(1.02)}75%{transform:translate(1px,1px) scale(1.02)}100%{transform:translate(-2px,-1px) scale(1.02)}}
      .bt-aura{position:absolute;left:50%;top:47%;width:150vmax;height:150vmax;transform:translate(-50%,-50%);opacity:0;pointer-events:none;background:repeating-conic-gradient(from 0deg,transparent 0 7deg,rgba(109,229,218,.12) 8deg 9deg,transparent 10deg 18deg);mask-image:radial-gradient(circle,transparent 0 7%,#000 12% 45%,transparent 67%)}
      .bt-scene.active .bt-aura{opacity:.85;animation:btAuraFocus 1.8s ease-in-out infinite}
      @keyframes btAuraFocus{0%{transform:translate(-50%,-50%) scale(1.12) rotate(0deg);opacity:.24}65%{transform:translate(-50%,-50%) scale(.64) rotate(3deg);opacity:.88}100%{transform:translate(-50%,-50%) scale(.48) rotate(5deg);opacity:.12}}
      .bt-panel{position:relative;z-index:2;width:min(820px,94vw);margin-top:auto;margin-bottom:2.5vh;padding:20px;border:1px solid rgba(215,185,102,.55);border-radius:20px;background:linear-gradient(180deg,rgba(6,13,22,.42),rgba(3,8,15,.92));box-shadow:0 22px 80px #000b,0 0 40px rgba(86,216,206,.12);backdrop-filter:blur(7px)}
      .bt-panel::before{content:"";position:absolute;inset:8px;border-radius:15px;border:1px solid rgba(236,205,122,.12);pointer-events:none}
      .bt-title{text-align:center;margin:0 0 8px;color:#e7c86b;font-family:"Songti TC",serif;font-size:clamp(24px,5vw,40px);letter-spacing:.18em}
      .bt-sub{text-align:center;color:#d5e0e0;font-size:13px;line-height:1.75;margin:0 0 12px}
      .bt-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:12px 0}.bt-stats div{padding:10px;border:1px solid rgba(255,255,255,.11);border-radius:11px;background:linear-gradient(180deg,rgba(6,16,25,.88),rgba(5,12,19,.68));text-align:center}.bt-stats span{display:block;color:#8ea7b2;font-size:10px}.bt-stats b{display:block;color:#f2d982;margin-top:4px;font-size:14px}
      .bt-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:13px}.bt-actions button{min-height:50px;border-radius:12px;border:1px solid #465468;background:#101b28;color:#eee;cursor:pointer;font-weight:700}.bt-actions .start{border-color:#9b7b3b;color:#f2d982;background:linear-gradient(180deg,rgba(55,42,17,.95),rgba(33,24,10,.95))}.bt-actions button:disabled{opacity:.45}
      .bt-countdown{text-align:center;font-size:clamp(34px,8vw,62px);font-weight:800;color:#f2d982;text-shadow:0 0 22px rgba(242,217,130,.4);font-variant-numeric:tabular-nums}.bt-line{text-align:center;color:#8de2d9;font-size:12px;min-height:20px}
      .bt-choice-shell{position:relative;padding:20px;border:1px solid rgba(219,189,105,.5);border-radius:20px;background:linear-gradient(180deg,rgba(5,12,20,.72),rgba(4,8,14,.94));box-shadow:0 26px 88px #000c,inset 0 0 0 1px rgba(255,255,255,.05);overflow:hidden}
      .bt-choice-shell::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 0%,rgba(115,180,255,.14),transparent 26%),linear-gradient(180deg,rgba(8,18,31,.08),rgba(0,0,0,.2));pointer-events:none}
      .bt-choice-title{margin:0 0 10px;text-align:center;color:#e7c86b;font-family:"Songti TC",serif;font-size:clamp(26px,4.2vw,42px);letter-spacing:.18em}
      .bt-choice-copy{color:#dbe5e6;text-align:center;line-height:1.8;margin-bottom:16px;font-size:14px}
      .bt-choice-copy b{color:#fff3b4}
      .bt-faction-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}
      .bt-faction-grid button{position:relative;overflow:hidden;padding:18px 12px 20px;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(10,20,31,.88),rgba(5,10,17,.92));color:#eee;cursor:pointer;min-height:188px;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;text-align:center;box-shadow:0 16px 42px rgba(0,0,0,.28);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
      .bt-faction-grid button:hover{transform:translateY(-3px);box-shadow:0 22px 48px rgba(0,0,0,.4)}
      .bt-faction-grid button::before{content:"";position:absolute;left:50%;top:14px;transform:translateX(-50%);width:74px;height:74px;border-radius:50%;border:1px solid rgba(255,255,255,.18);box-shadow:inset 0 0 34px rgba(255,255,255,.06),0 0 22px rgba(255,255,255,.05)}
      .bt-faction-grid button b{position:relative;display:block;margin-top:88px;font-size:28px;letter-spacing:.14em;font-family:"Songti TC",serif}
      .bt-faction-grid button small{position:relative;display:block;margin-top:12px;line-height:1.8;font-size:13px;max-width:11em}
      .bt-faction-grid button.guard{color:#78e0ca;border-color:rgba(84,183,156,.55);background:linear-gradient(180deg,rgba(10,33,38,.9),rgba(5,16,20,.95))}
      .bt-faction-grid button.guard::after{content:"✦";position:absolute;top:37px;left:50%;transform:translateX(-50%);font-size:30px;color:#79ebd4;text-shadow:0 0 24px rgba(121,235,212,.55)}
      .bt-faction-grid button.attack{color:#ff8b84;border-color:rgba(197,94,92,.55);background:linear-gradient(180deg,rgba(38,18,20,.92),rgba(22,10,12,.95))}
      .bt-faction-grid button.attack::after{content:"⚔";position:absolute;top:33px;left:50%;transform:translateX(-50%);font-size:30px;color:#ff8f87;text-shadow:0 0 24px rgba(255,112,105,.45)}
      .bt-faction-grid button.neutral{color:#d8e1ea;border-color:rgba(115,132,165,.42);background:linear-gradient(180deg,rgba(18,24,35,.92),rgba(8,13,21,.96))}
      .bt-faction-grid button.neutral::after{content:"☯";position:absolute;top:31px;left:50%;transform:translateX(-50%);font-size:32px;color:#c9d9f1;text-shadow:0 0 24px rgba(201,217,241,.34)}
      .bt-choice-note{margin-top:15px;padding-top:14px;border-top:1px solid rgba(229,197,116,.16);text-align:center;color:#e8d084;font-size:13px}

      .v154-choice{position:fixed;inset:0;z-index:10035;overflow:auto;color:#eef4f4;background:#020710;font-family:"PingFang TC","Noto Sans TC",system-ui,sans-serif;isolation:isolate}
      .v154-choice-bg{position:absolute;inset:0;z-index:-3;background:linear-gradient(180deg,rgba(0,5,12,.05),rgba(0,4,10,.38) 34%,rgba(0,5,12,.92) 72%),url('assets/breakthrough_choice_island_v154_p3.webp') center top/cover no-repeat;filter:saturate(1.08) contrast(1.05)}
      .v154-choice::before{content:"";position:absolute;inset:-12% -30% 36%;z-index:-2;background:repeating-conic-gradient(from 0deg at 50% 18%,transparent 0 13deg,rgba(148,205,255,.08) 14deg 16deg,transparent 17deg 28deg);mask:radial-gradient(circle at 50% 18%,transparent 0 5%,#000 9% 45%,transparent 61%);animation:v154ChoiceVortex 22s linear infinite;pointer-events:none}
      @keyframes v154ChoiceVortex{to{transform:rotate(360deg)}}
      .v154-choice-inner{width:min(1040px,94vw);min-height:100%;margin:0 auto;padding:max(55vh,520px) 0 max(28px,env(safe-area-inset-bottom));display:flex;flex-direction:column;justify-content:flex-end}
      .v154-choice-panel{position:relative;padding:24px 25px 22px;border:1px solid rgba(226,195,107,.62);border-radius:24px;background:linear-gradient(180deg,rgba(4,13,23,.72),rgba(3,8,15,.96));box-shadow:0 28px 95px #000d,0 0 70px rgba(102,201,255,.08);backdrop-filter:blur(12px);overflow:hidden}
      .v154-choice-panel::before{content:"";position:absolute;inset:9px;border:1px solid rgba(255,235,170,.12);border-radius:18px;pointer-events:none}
      .v154-choice-seal{width:62px;height:62px;margin:-57px auto 8px;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(234,205,118,.65);background:#07111bf2;color:#84e6dc;font-size:28px;box-shadow:0 0 34px rgba(91,220,210,.22)}
      .v154-choice-title{text-align:center;margin:0;color:#f0d78a;font-family:"Songti TC",serif;font-size:clamp(28px,5vw,48px);letter-spacing:.2em;text-shadow:0 0 24px rgba(241,213,130,.18)}
      .v154-choice-sub{text-align:center;margin:8px auto 18px;max-width:720px;color:#d2dddd;line-height:1.8;font-size:14px}.v154-choice-sub b{color:#fff0ae}
      .v154-choice-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .v154-choice-card{position:relative;min-height:300px;padding:25px 18px 20px;border:1px solid rgba(255,255,255,.14);border-radius:19px;overflow:hidden;color:#eef4f4;background:#07111b;cursor:pointer;transition:.22s transform,.22s border-color,.22s box-shadow;text-align:center}
      .v154-choice-card:hover{transform:translateY(-5px)}
      .v154-choice-card::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 24%,rgba(255,255,255,.09),transparent 27%),linear-gradient(180deg,transparent,rgba(0,0,0,.48));pointer-events:none}
      .v154-choice-card::after{content:"";position:absolute;inset:8px;border:1px solid rgba(255,255,255,.06);border-radius:13px;pointer-events:none}
      .v154-choice-card.guardian{border-color:rgba(75,208,176,.53);background:linear-gradient(180deg,rgba(9,43,46,.94),rgba(3,17,22,.96));box-shadow:inset 0 0 54px rgba(70,225,187,.07)}
      .v154-choice-card.attacker{border-color:rgba(226,90,89,.52);background:linear-gradient(180deg,rgba(53,17,22,.94),rgba(24,7,11,.97));box-shadow:inset 0 0 54px rgba(255,73,81,.07)}
      .v154-choice-card.neutral{border-color:rgba(126,153,192,.45);background:linear-gradient(180deg,rgba(18,29,45,.95),rgba(7,13,23,.98));box-shadow:inset 0 0 54px rgba(126,160,218,.06)}
      .v154-choice-icon{position:relative;width:92px;height:92px;margin:0 auto 18px;display:grid;place-items:center;border-radius:50%;font-size:38px;border:1px solid currentColor;box-shadow:inset 0 0 30px rgba(255,255,255,.07),0 0 30px rgba(255,255,255,.05)}
      .guardian .v154-choice-icon{color:#78e8d0}.attacker .v154-choice-icon{color:#ff8c85}.neutral .v154-choice-icon{color:#d3e0f2}
      .v154-choice-card b{position:relative;display:block;font-family:"Songti TC",serif;font-size:32px;letter-spacing:.16em}.guardian b{color:#7ce5cf}.attacker b{color:#ff8a82}.neutral b{color:#d8e3f1}
      .v154-choice-card p{position:relative;margin:15px auto 0;max-width:13em;color:#c8d3d5;line-height:1.8;font-size:13px}
      .v154-choice-note{margin-top:17px;padding-top:15px;border-top:1px solid rgba(228,198,112,.17);text-align:center;color:#e5ca7a;font-size:13px}
      body.v154-choice-locked{overflow:hidden}
      @media(max-width:700px){.v154-choice-inner{padding:max(33vh,275px) 10px max(20px,env(safe-area-inset-bottom))}.v154-choice-panel{padding:20px 13px 16px;border-radius:18px}.v154-choice-cards{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.v154-choice-card{min-height:250px;padding:18px 7px 14px;border-radius:14px}.v154-choice-icon{width:62px;height:62px;font-size:27px;margin-bottom:13px}.v154-choice-card b{font-size:22px}.v154-choice-card p{font-size:11px;line-height:1.65}.v154-choice-title{font-size:27px}.v154-choice-sub{font-size:12px}.v154-choice-seal{width:52px;height:52px;margin-top:-47px;font-size:23px}}
      @media(max-width:390px){.v154-choice-card{min-height:225px}.v154-choice-card p{font-size:10px}.v154-choice-card b{font-size:19px}.v154-choice-cards{gap:5px}}

      body.breakthrough-locked{overflow:hidden}
      @media(max-width:650px){.bt-panel{margin-bottom:1.5vh;padding:13px}.bt-stats{grid-template-columns:1fr 1fr}.bt-faction-grid{grid-template-columns:1fr}.bt-actions{grid-template-columns:1fr 1fr}.bt-faction-grid button{min-height:142px;padding-top:15px}.bt-faction-grid button::before{width:60px;height:60px}.bt-faction-grid button b{margin-top:72px;font-size:25px}.bt-choice-shell{padding:16px}}
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
    const eventId=s.eventId?String(s.eventId):null;
    const outcomeOptions={eventId,status,targetRealm:s.targetRealm,sourceLevel:s.sourceLevel,result};
    g.breakthroughHistory=Array.isArray(g.breakthroughHistory)?g.breakthroughHistory:[];if(eventId&&!g.breakthroughHistory.includes(eventId))g.breakthroughHistory.push(eventId);g.breakthroughHistory=g.breakthroughHistory.slice(-30);
    closeBreakthroughScene();
    if(status==='success'){
      clearDeviation();g.lv++;g.big=s.targetRealm;baseOnLevel();
      log('天雷過境，成功突破至 '+s.targetRealm+'！','lg');
      if(eventId&&typeof window.playBreakthroughOutcomeAndEnterBattleV154==='function'){
        setTimeout(()=>window.playBreakthroughOutcomeAndEnterBattleV154(outcomeOptions),0);
      }else if(typeof window.playBreakthroughSuccessFxV153==='function'){
        setTimeout(()=>window.playBreakthroughSuccessFxV153({targetRealm:s.targetRealm,sourceLevel:s.sourceLevel,currentLevel:g.lv}),0);
      }else{
        sheet('<h3>突破成功</h3><p>天地雷雲散去，你已踏入 <b>'+esc(s.targetRealm)+'</b>。</p><button class="btn gold" style="width:100%" onclick="closeOv()">穩固境界</button>');
      }
    }else if(status==='dead'){
      g.breakthroughState=null;saveGame(false);
      if(typeof finalizePermanentDeath==='function')return finalizePermanentDeath('突破期間遭襲擊身亡');
    }else{
      applyDeviation();
      log('突破失敗，氣息紊亂，走火入魔；攻防、體力、精力、修為與恢復效率降低 25%。','ld');
      if(eventId&&typeof window.playBreakthroughOutcomeAndEnterBattleV154==='function'){
        setTimeout(()=>window.playBreakthroughOutcomeAndEnterBattleV154({...outcomeOptions,status:'failure'}),0);
      }else{
        sheet('<h3 style="color:var(--red)">突破失敗</h3><p>靈氣逆行，你陷入走火入魔。</p><div class="notice">攻擊、防禦、最大體力、最大精力、修為取得與打坐恢復效率均降為原本的 '+Math.round(deviationMultiplier()*100)+'%。此狀態不會重複疊扣。</div><button class="btn" style="width:100%;margin-top:10px" onclick="closeOv()">調息療傷</button>');
      }
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
        .select('id,owner_user_id,source_level,target_realm,success_rate,origin_coord,started_at,ends_at,status,result,battle_status,breakthrough_result,owner_can_act')
        .eq('owner_user_id',cloudState.user.id).order('started_at',{ascending:false}).limit(1).maybeSingle();
      if(error)throw error;if(!data)return false;
      g.breakthroughHistory=Array.isArray(g.breakthroughHistory)?g.breakthroughHistory:[];
      if(g.breakthroughHistory.includes(String(data.id)))return false;
      if(data.status==='active'&&!data.breakthrough_result){
        g.meditating=false;g.meditateSec=0;
        g.breakthroughState={active:true,resultApplied:false,eventId:String(data.id),targetRealm:data.target_realm,sourceLevel:Number(data.source_level),rate:Number(data.success_rate),originCoord:data.origin_coord,startedAt:Date.parse(data.started_at)||Date.now(),endsAt:Date.parse(data.ends_at)||Date.now(),guardianCount:0,attackerCount:0,eventLine:'已從伺服器恢復未完成的突破事件'};
        cloudState.playerAction='境界突破';saveGame(false);renderActiveScene();ensureBreakthroughLoops();return true;
      }
      const source=Number(data.source_level||0);
      g.breakthroughState={active:false,resultApplied:false,eventId:String(data.id),targetRealm:data.target_realm,sourceLevel:source,rate:Number(data.success_rate),originCoord:data.origin_coord,startedAt:Date.parse(data.started_at)||Date.now(),endsAt:Date.parse(data.ends_at)||Date.now()};
      if(data.status==='success'&&Number(g.lv)>source){g.breakthroughHistory.push(String(data.id));g.breakthroughState=null;saveGame(false);return false}
      if((data.status==='failure'||data.status==='interrupted')&&qiDeviationActive()){g.breakthroughHistory.push(String(data.id));g.breakthroughState=null;saveGame(false);return false}
      await finishOwnerBreakthrough(data.breakthrough_result||data.status,data.result||{});return true;
    }catch(e){console.warn('restore breakthrough owner state',e);return false}
  }

  async function loadMyBreakthroughParticipation(){
    if(!cloudState.enabled||!cloudState.client||!cloudState.user)return;
    try{
      const {data,error}=await cloudState.client.rpc('list_my_active_breakthroughs');if(error)throw error;
      const rows=data||[];cloudState.breakthroughJoined=new Map(rows.map(x=>[String(x.event_id),x]));
      if(typeof window.restoreJoinedBattlefieldV154==='function')window.restoreJoinedBattlefieldV154(rows);
    }catch(e){console.warn('breakthrough participation',e)}
  }

  async function pollJoinedBreakthroughs(){
    if(ownerBreakthroughActive()||!cloudState.enabled||!cloudState.client||!cloudState.user)return;
    for(const [eventId,row] of cloudState.breakthroughJoined){
      try{
        const {data,error}=await cloudState.client.rpc('poll_breakthrough_event',{p_event_id:eventId});if(error)throw error;
        const dmg=Number(data?.participant_pending_damage||0);
        if(dmg>0){g.hp=Math.max(0,g.hp-dmg);log('你在突破事件中承受 '+dmg+' 點攻擊傷害。','ld');render();saveGame(false)}
        if(g.hp<=0||data?.my_combat_state==='dead'){
          cloudState.breakthroughJoined.delete(eventId);
          if(typeof finalizePermanentDeath==='function')return finalizePermanentDeath('為突破事件護法／襲擊時身亡');
        }
        if(data?.my_combat_state==='fled'){
          cloudState.breakthroughJoined.delete(eventId);
          if(typeof window.closeBreakthroughBattlefieldV154==='function')window.closeBreakthroughBattlefieldV154();
        }else if(data?.battle_status==='ended')cloudState.breakthroughJoined.delete(eventId);
      }catch(e){console.warn('joined breakthrough poll',e)}
    }
  }

  async function loadBreakthroughWorld(){
    if(!g||!cloudState.enabled||!cloudState.client||!cloudState.user)return;
    if(Date.now()-cloudState.breakthroughLastWorldLoad<800)return;
    cloudState.breakthroughLastWorldLoad=Date.now();
    try{
      const {data,error}=await cloudState.client.from('breakthrough_events').select('id,owner_user_id,owner_name,origin_coord,target_realm,ends_at,status,battle_status,breakthrough_result').eq('battle_status','active');
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

  function closeFactionChoice(){
    document.getElementById('v154FactionChoice')?.remove();
    document.body.classList.remove('v154-choice-locked');
  }

  function showFactionChoice(event){
    if(!event||ownerBreakthroughActive()||fight)return;
    injectBreakthroughStyles();
    closeFactionChoice();
    closeOv();
    const el=document.createElement('section');
    el.id='v154FactionChoice';el.className='v154-choice';
    el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','孤島天象異變立場選擇');
    el.innerHTML=`
      <div class="v154-choice-bg"></div>
      <div class="v154-choice-inner">
        <div class="v154-choice-panel">
          <div class="v154-choice-seal">天</div>
          <h2 class="v154-choice-title">孤島天象異變</h2>
          <p class="v154-choice-sub"><b>${esc(event.owner_name)}</b> 正在衝擊 ${esc(event.target_realm)}，孤島上空靈雲倒捲、八方靈氣匯聚。<br>你身處其周圍 3×3 異變區域，這次選擇將決定戰局走向。</p>
          <div class="v154-choice-cards">
            <button class="v154-choice-card guardian" data-faction="guardian"><span class="v154-choice-icon">✦</span><b>護法</b><p>留守孤島，保護正在突破的修士，優先承受襲擊。</p></button>
            <button class="v154-choice-card attacker" data-faction="attacker"><span class="v154-choice-icon">⚔</span><b>襲擊</b><p>加入襲擊陣營，擊潰護法後阻斷突破者的天門。</p></button>
            <button class="v154-choice-card neutral" data-faction="neutral"><span class="v154-choice-icon">☯</span><b>中立</b><p>立即離開異變區域，本次事件期間不能再次進入。</p></button>
          </div>
          <div class="v154-choice-note">本次事件選擇後不可轉換陣營</div>
        </div>
      </div>`;
    document.body.appendChild(el);document.body.classList.add('v154-choice-locked');
    el.querySelectorAll('[data-faction]').forEach(button=>button.addEventListener('click',()=>chooseFaction(event.id,button.dataset.faction)));
  }

  async function chooseFaction(eventId,faction){
    if(!cloudState.enabled||!cloudState.client)return;
    try{
      const {data,error}=await cloudState.client.rpc('choose_breakthrough_faction',{p_event_id:eventId,p_faction:faction});if(error)throw error;
      cloudState.breakthroughPendingChoice=null;closeFactionChoice();cloudState.breakthroughJoined.set(String(eventId),{event_id:eventId,faction,expelled_coord:data?.expelled_coord});
      if(faction==='neutral'&&data?.expelled_coord){const p=coordRC(data.expelled_coord);g.pos={r:p.r,c:p.c};cloudState.playerAction='被天地異變排出';log('你選擇中立，天地異變將你排出至 '+esc(data.expelled_coord)+'。','la')}
      else log('你在本次突破事件選擇「'+factionText(faction)+'」，陣營已鎖定。','la');
      closeOv();saveGame(false);render();if(typeof syncPlayerPresence==='function')syncPlayerPresence(true);
      if(faction!=='neutral'&&typeof window.openJoinedBreakthroughBattlefieldV154==='function')setTimeout(()=>window.openJoinedBreakthroughBattlefieldV154(eventId,faction),80);
    }catch(e){const m=String(e.message||e);if(m.includes('NOT_ACTIVE')){cloudState.breakthroughPendingChoice=null;closeFactionChoice();closeOv();loadBreakthroughWorld()}toast(m.includes('FACTION_LOCKED')?'本次突破期間不可轉換陣營':'選擇失敗：'+m)}
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
