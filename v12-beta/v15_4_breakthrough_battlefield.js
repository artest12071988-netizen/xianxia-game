(()=>{
'use strict';

const BUILD='V15.4-PHASE3-STAGE3-FIX2-INDEPENDENT-EXIT-20260724';
const ROOT_ID='v154BreakthroughBattlefield';
const FAILURE_ID='v154BreakthroughFailureFx';
const state={
  eventId:null,role:null,data:null,timer:null,busy:false,selected:null,
  lastResult:null,lastLogKey:null,speechTimer:null,ownerEntry:false,resultDialogue:null,
  dismissedEvents:new Set()
};
const DISMISS_KEY='v154_breakthrough_dismissed_events';
function loadDismissed(){
  try{
    const rows=JSON.parse(sessionStorage.getItem(DISMISS_KEY)||'[]');
    if(Array.isArray(rows))rows.forEach(x=>state.dismissedEvents.add(String(x)));
  }catch(_){ }
}
function persistDismissed(){
  try{sessionStorage.setItem(DISMISS_KEY,JSON.stringify([...state.dismissedEvents].slice(-40)))}catch(_){ }
}
loadDismissed();

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const root=()=>document.getElementById(ROOT_ID);
const pct=(n,d)=>`${clamp(d?Number(n)/Number(d)*100:0,0,100)}%`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function client(){return window.cloudState?.client||null}
function enabled(){return !!(window.cloudState?.enabled&&client()&&window.cloudState?.user)}
function roleText(role){return ({owner:'突破者',guardian:'護法陣營',attacker:'襲擊陣營',neutral:'中立',spectator:'觀戰'})[role]||role||'觀戰'}
function factionText(f){return ({guardian:'護法',attacker:'襲擊',neutral:'中立'})[f]||f||'未知'}
function combatText(p){return p.combat_state==='dead'?'死亡':p.combat_state==='fled'?'已遁走':p.last_action==='wait'?'靜觀':p.last_action==='attack'?'交戰中':'待命'}
function portraitFor(p){
  if(p?.type==='monster')return 'assets/monsters/monster_9001_v153_fix7.webp';
  if(p?.type==='ai')return 'assets/ai_cultivator.svg';
  return 'assets/player_cultivator.svg';
}
function ownerPortrait(){return 'assets/player_cultivator.svg'}
function activeMembers(faction){return (state.data?.participants||[]).filter(p=>p.faction===faction&&p.alive&&p.combat_state==='active')}
function guardiansAlive(){return activeMembers('guardian').length}
function targetAllowed(key){
  const role=state.role;
  if(!key||role==='spectator'||role==='neutral')return false;
  if(key==='owner')return role==='attacker'&&guardiansAlive()===0&&['locked','active'].includes(state.data?.owner?.combat_state);
  const p=(state.data?.participants||[]).find(x=>x.key===key);
  if(!p||!p.alive||p.combat_state!=='active')return false;
  if(role==='owner'||role==='guardian')return p.faction==='attacker';
  if(role==='attacker')return p.faction==='guardian';
  return false;
}
function myCanAct(){
  const e=state.data?.event||{};
  if(e.battle_status!=='active')return false;
  if(state.role==='owner')return !!e.owner_can_act&&state.data?.owner?.combat_state==='active';
  if(!['guardian','attacker'].includes(state.role))return false;
  return state.data?.my_combat_state==='active';
}
function secondsLeft(){
  const e=state.data?.event||{};
  if(e.breakthrough_result)return 0;
  return Math.max(0,(Date.parse(e.ends_at||0)-Date.now())/1000);
}
function stageInfo(){
  const e=state.data?.event||{};
  if(e.breakthrough_result==='success')return {index:4,label:'天門大開',copy:'突破完成，靈壓席捲孤島'};
  if(e.breakthrough_result==='failure')return {index:4,label:'靈氣崩散',copy:'經脈逆行，走火入魔'};
  const start=Date.parse(e.started_at||e.created_at||0),end=Date.parse(e.ends_at||0),now=Date.now();
  const total=Math.max(1,end-start),ratio=clamp((now-start)/total,0,1);
  if(ratio<.24)return {index:0,label:'引氣入體',copy:'八方靈氣正向島心聚集'};
  if(ratio<.52)return {index:1,label:'靈海凝聚',copy:'靈海翻湧，護法陣線承壓'};
  if(ratio<.80)return {index:2,label:'道基共鳴',copy:'天地法則開始震動'};
  return {index:3,label:'天門將開',copy:'最後關頭，天象已至極限'};
}
function stageDots(info){
  return `<div class="v154-stage-dots">${[0,1,2,3].map(i=>`<i class="${i<=info.index?'on':''}"></i>`).join('')}</div>`;
}
function columnsFor(count){return count<=3?1:count<=8?2:3}
function anomalyMarkup(info){
  const colors=['#72e7ff','#8fffd1','#ffe28a','#c09bff','#7eb8ff','#ff9aa6'];
  const qi=Array.from({length:16},(_,i)=>{const side=i%2===0?'left':'right',y=17+(i*7)%66,width=26+(i*9)%25,tilt=side==='left'?(4+(i%4)*4):(176-(i%4)*4);return `<i class="v154-qi-stream ${side}" style="--y:${y}%;--w:${width}vw;--tilt:${tilt}deg;--delay:${-(i*.31).toFixed(2)}s;--dur:${(2.4+(i%5)*.24).toFixed(2)}s;--qi:${colors[i%colors.length]}"></i>`}).join('');
  const bolts=Array.from({length:7},(_,i)=>`<i class="v154-lightning b${i+1}" style="--bolt-delay:${-(i*.83).toFixed(2)}s"></i>`).join('');
  return `<div class="v154-anomaly-field stage-${Math.min(3,info.index)}" aria-hidden="true"><div class="v154-sky-vortex"></div><div class="v154-thunder-flash"></div>${bolts}<div class="v154-qi-streams">${qi}</div><div class="v154-island-pulse"></div></div>`;
}
function aerialFormation(faction){
  const count=Math.min(8,activeMembers(faction).length),slots=faction==='guardian'?[[12,20],[23,31],[8,43],[25,52],[14,64],[31,70],[5,78],[22,84]]:[[88,19],[76,30],[92,42],[74,52],[86,63],[69,70],[95,77],[78,84]];
  return `<div class="v154-air-formation ${faction}" aria-hidden="true">${slots.slice(0,count).map((p,i)=>`<i class="v154-air-unit" style="--ax:${p[0]}%;--ay:${p[1]}%;--ad:${-(i*.37).toFixed(2)}s;--as:${(.72+(i%4)*.1).toFixed(2)}"></i>`).join('')}</div>`;
}
function logKey(x){return `${x?.at||''}|${x?.actor||''}|${x?.action||''}|${x?.target||''}|${x?.amount||0}`}

function personCard(p){
  const selectable=targetAllowed(p.key),selected=state.selected===p.key;
  const hpNow=Math.max(0,Math.round(p.hp||0)),hpMax=Math.max(1,Math.round(p.hp_max||1));
  return `<article class="v154-person ${esc(p.combat_state||'active')} ${selectable?'targetable':''} ${selected?'selected':''}" data-target="${esc(p.key)}">
    <div class="v154-person-top">
      <div class="v154-avatar-wrap"><img class="v154-avatar" src="${esc(portraitFor(p))}" alt="${esc(p.name)}"><span>${p.type==='monster'?'獸':p.type==='ai'?'靈':'修'}</span></div>
      <div class="v154-person-name"><b>${esc(p.name)}</b><small>${esc(p.type==='player'?'真人修士':p.type==='ai'?'世界修士':'妖獸')}</small></div>
      <em class="v154-state-chip">${esc(combatText(p))}</em>
    </div>
    <div class="v154-hp"><i style="--hp:${pct(p.hp,p.hp_max)}"></i></div>
    <div class="v154-person-meta"><span>${hpNow}/${hpMax}</span><span>${esc(factionText(p.faction))}</span></div>
  </article>`;
}
function roster(faction){
  const list=(state.data?.participants||[]).filter(p=>p.faction===faction&&p.faction!=='neutral');
  const alive=list.filter(p=>p.alive&&p.combat_state==='active').length;
  return `<section class="v154-side ${faction}">
    <div class="v154-side-head"><div><small>${faction==='guardian'?'GUARDIAN':'RAIDER'}</small><b>${faction==='guardian'?'護法陣營':'襲擊陣營'}</b></div><span>存活 <strong>${alive}</strong> / ${list.length}</span></div>
    <div class="v154-roster" style="--cols:${columnsFor(list.length)}">${list.length?list.map(personCard).join(''):`<div class="v154-empty-roster">目前無人</div>`}</div>
    <div class="v154-side-foot">${faction==='guardian'?'護法之力，庇佑道心':'群魔來襲，意圖阻斷天命'}</div>
  </section>`;
}
function ownerCard(){
  const o=state.data?.owner||{};
  const e=state.data?.event||{};
  const result=e.breakthrough_result||null;

  /*
   * 突破倒數期間不顯示突破者姓名與人物卡。
   * 中央完整保留孤島、天象、光柱與護法屏障。
   * 成功／失敗結果確認後，才由島心飛出並顯示人物卡。
   */
  if(!state.ownerEntry){
    return `<div class="v154-island-core awaiting-owner">
      ${guardiansAlive()>0?'<div class="v154-shield"></div>':'<div class="v154-shield broken"></div>'}
      <div class="v154-hidden-breaker" aria-label="突破者仍在島心閉關">
        <i></i><i></i><i></i>
      </div>
    </div>`;
  }

  const targetable=targetAllowed('owner');
  const selected=state.selected==='owner';
  const resultText=result==='success'?'突破成功':result==='failure'?'走火入魔':'突破中';
  return `<div class="v154-island-core owner-revealed">
    ${guardiansAlive()>0?'<div class="v154-shield"></div>':'<div class="v154-shield broken"></div>'}
    <article class="v154-owner ${o.combat_state||''} flying ${targetable?'targetable':''} ${selected?'selected':''}" data-target="owner">
      <div class="v154-owner-orbit"></div><img src="${ownerPortrait()}" alt="${esc(o.name)}"><b>${esc(o.name||'突破者')}</b>
      <small>${esc(resultText)} · ${esc(e.target_realm||'未知境界')}</small>
      <div class="v154-hp"><i style="--hp:${pct(o.hp,o.hp_max)}"></i></div>
      <small>體力 ${Math.max(0,Math.round(o.hp||0))}/${Math.max(1,Math.round(o.hp_max||1))}</small>
    </article>
  </div>`;
}
function logHtml(){
  const logs=Array.isArray(state.data?.event?.battle_log)?state.data.event.battle_log:[];
  return logs.slice(-8).reverse().map(x=>{
    const action=x.action==='attack'?`攻擊 ${esc(x.target||'目標')}，造成 ${Number(x.amount||0)} 點傷害`:x.action==='wait'?'靜觀其變':x.action==='flee'?'成功遁走':x.action==='flee_failed'?'遁走失敗':x.action==='join'?esc(x.detail||'加入戰場'):x.action==='breakthrough_result'?(x.detail==='success'?'突破成功':'突破失敗'):esc(x.detail||x.action||'戰況變化');
    return `<p><b>${esc(x.actor||'戰場')}</b>：${action}</p>`;
  }).join('')||'<p>雙方氣機交纏，戰事一觸即發。</p>';
}
const RESULT_DIALOGUES={
  success:[
    '道心不滅……我終於踏過此關！',
    '天門既開，前路再無桎梏！',
    '萬法歸一，此境今日終成！',
    '此身承天命，從此再進一重天！',
    '靈海圓滿，天地皆為我證道！',
    '多年苦修，今日終不負道心！'
  ],
  failure:[
    '靈氣逆行……我絕不會在此倒下！',
    '此劫雖敗，道心未碎！',
    '天道阻我一次，阻不了我第二次！',
    '經脈受創……但我的路還沒有結束！',
    '今日之敗，我必百倍討回！',
    '靈海崩散又如何，我仍會重登此關！'
  ]
};
function chooseResultDialogue(result){
  const lines=RESULT_DIALOGUES[result]||[];
  if(!lines.length)return '';
  const seed=String(state.eventId||'').split('').reduce((n,c)=>n+c.charCodeAt(0),0)+Date.now();
  return lines[Math.abs(seed)%lines.length];
}
function currentSpeech(){
  const logs=Array.isArray(state.data?.event?.battle_log)?state.data.event.battle_log:[];
  const last=logs[logs.length-1];
  const owner=state.data?.owner?.name;
  if(last&&last.action==='attack'&&last.target===owner)return '無恥小人！待我出關，必將此仇百倍奉還！';
  const result=state.data?.event?.breakthrough_result;
  if(result)return state.resultDialogue||(state.resultDialogue=chooseResultDialogue(result));
  const lines=['我命由我不由天！','天地靈機，盡歸我身！','今日若不破境，誓不罷休！','此關一破，我道自成！'];
  return lines[Math.floor(Date.now()/6500)%lines.length];
}
function render(){
  const el=root();if(!el||!state.data)return;
  const e=state.data.event||{},sec=secondsLeft(),ended=e.battle_status==='ended',info=stageInfo();
  el.dataset.stage=String(Math.min(4,info.index));
  el.classList.toggle('v154-anomaly-peak',!e.breakthrough_result&&info.index>=3);
  el.classList.toggle('outcome-success',e.breakthrough_result==='success');
  el.classList.toggle('outcome-failure',e.breakthrough_result==='failure');
  if(state.selected&&!targetAllowed(state.selected))state.selected=null;
  const targetName=state.selected==='owner'?state.data.owner?.name:(state.data.participants||[]).find(p=>p.key===state.selected)?.name;
  const act=myCanAct(),phase=e.breakthrough_result?(ended?'戰場結束':'突破者已出關'):'天象異變同步中';
  const exitButton=`<button class="wait independent-exit" data-close><span class="v154-action-icon">門</span><b>離開戰場</b><small>只關閉自己的畫面</small></button>`;
  const actionHtml=ended?exitButton:`
    <button class="attack" data-action="attack" ${!act||!state.selected?'disabled':''}><span class="v154-action-icon">⚔</span><b>攻擊</b><small>全力出擊</small></button>
    <button class="wait" data-action="wait" ${!act?'disabled':''}><span class="v154-action-icon">◉</span><b>靜觀其變</b><small>等待時機</small></button>
    <button class="flee" data-action="flee" ${!act?'disabled':''}><span class="v154-action-icon">➜</span><b>遁走</b><small>退出戰鬥狀態</small></button>
    ${exitButton}
    <div class="v154-target-note">${act?(targetName?`已鎖定：${esc(targetName)}`:'點選敵方修士作為攻擊目標'):(state.role==='owner'&&!e.breakthrough_result?'突破尚未結束；你仍可自行離開畫面':'目前無法行動；仍可自行離開畫面')}</div>`;
  el.innerHTML=`
    <div class="v154-btf-bg"></div><div class="v154-btf-qi"></div>${anomalyMarkup(info)}
    <header class="v154-btf-top">
      <div class="v154-btf-title"><div class="v154-title-seal">異</div><div><h2>孤島天象異變</h2><p>天地異變，群雄爭鋒；護法或襲擊，皆為天道一戰。</p></div></div>
      <div class="v154-btf-clock"><small>${e.breakthrough_result?'突破結果':'剩餘時間'}</small><strong>${e.breakthrough_result?(e.breakthrough_result==='success'?'成功':'失敗'):sec.toFixed(sec<10?1:0)}</strong><span>${esc(info.label)}</span></div>
      <div class="v154-btf-status"><b>${esc(roleText(state.role))}</b><small>${esc(phase)}</small></div>
    </header>
    <main class="v154-btf-arena">
      ${roster('guardian')}
      <section class="v154-center">${aerialFormation('guardian')}${aerialFormation('attacker')}${ownerCard()}<div class="v154-speech">${esc(currentSpeech())}</div></section>
      ${roster('attacker')}
    </main>
    <div class="v154-result-fx">
      <i class="v154-fx-core"></i>
      <i class="v154-fx-ring ring-a"></i>
      <i class="v154-fx-ring ring-b"></i>
      <i class="v154-fx-ring ring-c"></i>
      <i class="v154-fx-rift rift-a"></i>
      <i class="v154-fx-rift rift-b"></i>
      <i class="v154-fx-rift rift-c"></i>
      <i class="v154-fx-shards"></i>
      <i class="v154-fx-mist"></i>
    </div>
    <div class="v154-result-banner"><small>${e.breakthrough_result==='success'?'BREAKTHROUGH COMPLETE':'BREAKTHROUGH FAILED'}</small><b>${e.breakthrough_result==='success'?'天門大開':e.breakthrough_result==='failure'?'靈氣崩散':''}</b><span>${e.breakthrough_result==='success'?`已晉升 ${esc(e.target_realm||'新境界')}`:e.breakthrough_result==='failure'?'突破失敗，陷入走火入魔':''}</span><em>${e.breakthrough_result?`「${esc(currentSpeech())}」`:''}</em></div>
    <footer class="v154-bottom">
      <div class="v154-log-head"><b>戰況日誌</b><button data-log-toggle>戰況詳情</button></div>
      <div class="v154-log">${logHtml()}</div>
      <div class="v154-actions">${actionHtml}</div>
    </footer>`;
  bind();
}
function bind(){
  const el=root();if(!el)return;
  el.querySelectorAll('[data-target]').forEach(node=>node.addEventListener('click',()=>{
    const key=node.dataset.target;if(!targetAllowed(key)){
      if(key==='owner'&&state.role==='attacker'&&guardiansAlive()>0)window.toast?.('護法尚存，無法直接攻擊突破者');
      return;
    }
    state.selected=state.selected===key?null:key;render();
  }));
  el.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.action)));
  el.querySelector('[data-close]')?.addEventListener('click',dismissAndClose);
  el.querySelector('[data-log-toggle]')?.addEventListener('click',()=>el.classList.toggle('log-open'));
}
function resultTransition(result){
  const el=root();if(!el||!result)return;
  state.resultDialogue=chooseResultDialogue(result);
  el.classList.remove('result-success','result-failure','v154-result-flash');
  void el.offsetWidth;
  el.classList.add('v154-result-flash',result==='success'?'result-success':'result-failure');
  try{navigator.vibrate?.(result==='success'?[55,30,100,40,130]:[80,35,90,35,110])}catch(_){ }
  setTimeout(()=>{state.ownerEntry=true;render();const r=root();r?.classList.add(result==='success'?'result-success':'result-failure','v154-result-flash')},900);
  setTimeout(()=>root()?.classList.remove('result-success','result-failure','v154-result-flash'),3100);
}
async function load(options={}){
  if(!state.eventId||state.busy||!enabled())return false;
  state.busy=true;
  try{
    const {data,error}=await client().rpc('get_breakthrough_battlefield_v154',{p_event_id:state.eventId});
    if(error)throw error;
    state.loadErrors=0;
    const oldResult=state.data?.event?.breakthrough_result||state.lastResult;
    state.data=data;state.role=data?.my_role||state.role||'spectator';
    if(!root())createRoot();
    const newResult=data?.event?.breakthrough_result||null;
    if(newResult&&newResult===oldResult&&!state.ownerEntry)state.ownerEntry=true;
    render();
    if(newResult&&newResult!==oldResult){state.lastResult=newResult;resultTransition(newResult)}
    if(data?.event?.battle_status==='ended'){clearInterval(state.timer);clearDismissed(state.eventId)}
    return true;
  }catch(err){
    console.warn('[V15.4 battlefield load]',err);
    state.loadErrors=Number(state.loadErrors||0)+1;
    const message=String(err?.message||err);
    const fatal=message.includes('BREAKTHROUGH_NOT_FOUND')||message.includes('23514')||message.includes('owner_hp_check')||message.includes('400')||state.loadErrors>=3;
    if(fatal||options.initial){
      clearInterval(state.timer);state.timer=null;
      close();
      window.toast?.('戰場資料異常，已停止輪詢並安全返回遊戲');
    }
    return false;
  }finally{state.busy=false}
}
async function act(action){
  if(state.busy||!myCanAct())return;
  if(action==='attack'&&!state.selected){window.toast?.('請先點選敵方目標');return}
  state.busy=true;
  try{
    const {data,error}=await client().rpc('breakthrough_battle_action_v154',{
      p_event_id:state.eventId,p_action:action,p_target_key:action==='attack'?state.selected:null
    });
    if(error)throw error;
    state.data=data;state.role=data?.my_role||state.role;state.selected=null;
    if(action==='flee'&&data?.my_combat_state==='fled'){
      window.toast?.('遁走成功，已離開突破護法戰場');
      close();return;
    }
    render();
  }catch(err){
    const m=String(err?.message||err);
    const friendly=m.includes('GUARDIANS_STILL_ALIVE')?'護法尚存，無法直接攻擊突破者':m.includes('OWNER_STILL_BREAKING_THROUGH')?'突破尚未完成，現在無法行動':m.includes('ACTION_COOLDOWN')?'氣機尚未平復，請稍候再出手':m.includes('TARGET_NOT_ACTIVE')?'目標已經離開戰場':m.includes('BATTLE_NOT_ACTIVE')?'戰場已經結束':'戰場操作失敗：'+m;
    window.toast?.(friendly);
  }finally{state.busy=false;setTimeout(load,120)}
}
function createRoot(){
  let el=root();if(el)return el;
  el=document.createElement('section');el.id=ROOT_ID;el.className='v154-btf';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','突破護法戰場');document.body.appendChild(el);document.body.classList.add('v154-battlefield-locked');return el;
}
async function open(eventId,options={}){
  if(!eventId)return false;
  const normalizedEventId=String(eventId);
  if(state.dismissedEvents.has(normalizedEventId)&&!options.force)return false;
  state.eventId=normalizedEventId;state.role=options.role||state.role;state.selected=null;state.data=null;state.lastResult=options.lastResult||null;state.ownerEntry=!!options.ownerEntry;state.resultDialogue=null;
  clearInterval(state.timer);state.timer=null;
  const loaded=await load({initial:true});
  if(!loaded)return false;
  clearInterval(state.timer);state.timer=setInterval(()=>load(),900);
  return true;
}
function close(){
  clearInterval(state.timer);state.timer=null;root()?.remove();document.body.classList.remove('v154-battlefield-locked');state.eventId=null;state.data=null;state.selected=null;state.ownerEntry=false;state.resultDialogue=null;
}
function dismissAndClose(){
  const eventId=state.eventId;
  if(eventId){
    state.dismissedEvents.add(String(eventId));
    persistDismissed();
  }
  close();
  window.toast?.('已離開戰場畫面；本場事件不會再自動開啟');
}
function clearDismissed(eventId){
  if(eventId){
    state.dismissedEvents.delete(String(eventId));
    persistDismissed();
  }
}
function failureScene(options={}){
  document.getElementById(FAILURE_ID)?.remove();
  const el=document.createElement('section');el.id=FAILURE_ID;el.className='v154-failure-overlay';
  el.innerHTML=`<div class="v154-failure-vortex"><i></i><i></i><i></i><b></b></div><div class="v154-failure-fragments"></div><div class="v154-failure-copy"><small>天道反噬</small><h2>靈氣崩散</h2><p>靈脈寸斷，萬千靈光逆流四散，你已陷入走火入魔。</p><button type="button">強行出關</button></div>`;
  document.body.appendChild(el);
  try{navigator.vibrate?.([75,30,90,35,110])}catch(_){ }
  return new Promise(resolve=>el.querySelector('button').addEventListener('click',()=>{el.remove();resolve()}, {once:true}));
}
async function playOutcomeAndEnterBattle(options={}){
  const result=options.status||options.result;
  if(result==='success'&&typeof window.playBreakthroughSuccessFxV153==='function'){
    await window.playBreakthroughSuccessFxV153({targetRealm:options.targetRealm});
  }else if(result==='failure'||result==='interrupted'){
    await failureScene(options);
  }
  await open(options.eventId,{role:'owner',ownerEntry:false,lastResult:null});
}
function restoreJoined(rows){
  if(root()||state.eventId||!Array.isArray(rows))return;
  const active=rows.find(x=>x?.battle_status==='active'&&['guardian','attacker'].includes(x?.faction)&&!state.dismissedEvents.has(String(x.event_id)));
  if(active)setTimeout(()=>open(active.event_id,{role:active.faction}),80);
}
function openJoined(eventId,role,options={}){
  // 背景輪詢只能嘗試開啟，不得解除玩家已離場的紀錄。
  // 只有玩家明確點擊「重新進入戰場」時，才可傳入 {userInitiated:true}。
  if(options?.userInitiated===true){
    clearDismissed(eventId);
    return open(eventId,{role,force:true});
  }
  return open(eventId,{role,force:false});
}
function reenterJoined(eventId,role){
  return openJoined(eventId,role,{userInitiated:true});
}

window.openBreakthroughBattlefieldV154=open;
window.closeBreakthroughBattlefieldV154=close;
window.dismissBreakthroughBattlefieldV154=dismissAndClose;
window.openJoinedBreakthroughBattlefieldV154=openJoined;
window.reenterJoinedBreakthroughBattlefieldV154=reenterJoined;
window.restoreJoinedBattlefieldV154=restoreJoined;
window.playBreakthroughOutcomeAndEnterBattleV154=playOutcomeAndEnterBattle;
window.V154_BREAKTHROUGH_BATTLEFIELD={build:BUILD,open,close,dismiss:dismissAndClose,reenter:reenterJoined,load,act,playOutcomeAndEnterBattle};
})();
