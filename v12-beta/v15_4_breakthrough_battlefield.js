(()=>{
'use strict';

const BUILD='V15.4-PHASE1-BREAKTHROUGH-GUARDIAN-BATTLEFIELD-20260723';
const ROOT_ID='v154BreakthroughBattlefield';
const FAILURE_ID='v154BreakthroughFailureFx';
const state={
  eventId:null,role:null,data:null,timer:null,busy:false,selected:null,
  lastResult:null,lastLogKey:null,speechTimer:null,ownerEntry:false
};

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
function columnsFor(count){return count<=3?1:count<=8?2:3}
function logKey(x){return `${x?.at||''}|${x?.actor||''}|${x?.action||''}|${x?.target||''}|${x?.amount||0}`}

function personCard(p){
  const selectable=targetAllowed(p.key);
  const selected=state.selected===p.key;
  return `<article class="v154-person ${esc(p.combat_state||'active')} ${selectable?'targetable':''} ${selected?'selected':''}" data-target="${esc(p.key)}">
    <div class="v154-person-top">
      <img class="v154-avatar" src="${esc(portraitFor(p))}" alt="${esc(p.name)}">
      <div class="v154-person-name"><b>${esc(p.name)}</b><small>${esc(factionText(p.faction))} · ${esc(p.type==='player'?'真人修士':p.type==='ai'?'世界修士':'妖獸')}</small></div>
    </div>
    <div class="v154-hp"><i style="--hp:${pct(p.hp,p.hp_max)}"></i></div>
    <em>體力 ${Math.max(0,Math.round(p.hp||0))}/${Math.max(1,Math.round(p.hp_max||1))} · ${esc(combatText(p))}</em>
  </article>`;
}
function roster(faction){
  const list=(state.data?.participants||[]).filter(p=>p.faction===faction&&p.faction!=='neutral');
  return `<section class="v154-side ${faction}">
    <div class="v154-side-head"><b>${faction==='guardian'?'護法陣營':'襲擊陣營'}</b><span>存活 ${list.filter(p=>p.alive&&p.combat_state==='active').length} / ${list.length}</span></div>
    <div class="v154-roster" style="--cols:${columnsFor(list.length)}">${list.length?list.map(personCard).join(''):`<p style="color:#7f929b;font-size:11px;text-align:center">目前無人</p>`}</div>
  </section>`;
}
function ownerCard(){
  const o=state.data?.owner||{};
  const e=state.data?.event||{};
  const targetable=targetAllowed('owner');
  const selected=state.selected==='owner';
  const locked=!e.breakthrough_result;
  const resultText=e.breakthrough_result==='success'?'突破成功':e.breakthrough_result==='failure'?'走火入魔':'突破中';
  return `<div class="v154-island-core">
    ${guardiansAlive()>0?'<div class="v154-shield"></div>':'<div class="v154-shield broken"></div>'}
    <article class="v154-owner ${locked?'locked':''} ${o.combat_state||''} ${state.ownerEntry?'flying':''} ${targetable?'targetable':''} ${selected?'selected':''}" data-target="owner">
      <img src="${ownerPortrait()}" alt="${esc(o.name)}"><b>${esc(o.name||'突破者')}</b>
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
function currentSpeech(){
  const logs=Array.isArray(state.data?.event?.battle_log)?state.data.event.battle_log:[];
  const last=logs[logs.length-1];
  const owner=state.data?.owner?.name;
  if(last&&last.action==='attack'&&last.target===owner)return '無恥小人！待我出關，必將此仇百倍奉還！';
  if(state.data?.event?.breakthrough_result==='success')return '天門已開，誰還能阻我！';
  if(state.data?.event?.breakthrough_result==='failure')return '靈氣逆行……我絕不會在此倒下！';
  const lines=['我命由我不由天！','天地靈機，盡歸我身！','今日若不破境，誓不罷休！','此關一破，我道自成！'];
  return lines[Math.floor(Date.now()/6500)%lines.length];
}
function render(){
  const el=root();if(!el||!state.data)return;
  const e=state.data.event||{};
  const sec=secondsLeft();
  const ended=e.battle_status==='ended';
  if(state.selected&&!targetAllowed(state.selected))state.selected=null;
  const targetName=state.selected==='owner'?state.data.owner?.name:(state.data.participants||[]).find(p=>p.key===state.selected)?.name;
  const act=myCanAct();
  const phase=e.breakthrough_result?(ended?'戰場結束':'突破者已出關'):'突破倒數同步中';
  el.innerHTML=`
    <div class="v154-btf-bg"></div><div class="v154-btf-qi"></div>
    <header class="v154-btf-top">
      <div class="v154-btf-title"><h2>突破護法 · 孤島靈陣</h2><p>${esc(e.owner_name||state.data.owner?.name)} 正在衝擊 ${esc(e.target_realm||'新境界')}，全島靈氣向島心匯聚。</p></div>
      <div class="v154-btf-clock"><small>${e.breakthrough_result?'突破結果':'剩餘時間'}</small><strong>${e.breakthrough_result?(e.breakthrough_result==='success'?'成功':'失敗'):sec.toFixed(sec<10?1:0)}</strong></div>
      <div class="v154-btf-status"><b>${esc(roleText(state.role))}</b><small>${esc(phase)}</small></div>
    </header>
    <main class="v154-btf-arena">
      ${roster('guardian')}
      <section class="v154-center">${ownerCard()}<div class="v154-speech">${esc(currentSpeech())}</div></section>
      ${roster('attacker')}
    </main>
    <div class="v154-result-fx"></div>
    <div class="v154-result-banner"><b>${e.breakthrough_result==='success'?'天門大開':e.breakthrough_result==='failure'?'靈氣崩散':''}</b><span>${e.breakthrough_result==='success'?`已晉升 ${esc(e.target_realm||'新境界')}`:e.breakthrough_result==='failure'?'突破失敗，陷入走火入魔':''}</span></div>
    <footer class="v154-bottom">
      <div class="v154-log">${logHtml()}</div>
      <div class="v154-actions">
        ${ended?`<button class="wait" data-close>離開戰場</button>`:`
          <button class="attack" data-action="attack" ${!act||!state.selected?'disabled':''}>攻擊</button>
          <button class="wait" data-action="wait" ${!act?'disabled':''}>靜觀其變</button>
          <button class="flee" data-action="flee" ${!act?'disabled':''}>遁走</button>
          <div class="v154-target-note">${act?(targetName?`已鎖定：${esc(targetName)}`:'點選敵方修士作為攻擊目標'):(state.role==='owner'&&!e.breakthrough_result?'突破尚未結束，暫時無法行動':'目前無法行動')}</div>`}
      </div>
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
  el.querySelector('[data-close]')?.addEventListener('click',close);
}
function resultTransition(result){
  const el=root();if(!el||!result)return;
  el.classList.remove('result-success','result-failure');
  void el.offsetWidth;
  el.classList.add(result==='success'?'result-success':'result-failure');
  try{navigator.vibrate?.(result==='success'?[55,30,100,40,130]:[80,35,90,35,110])}catch(_){ }
  setTimeout(()=>{state.ownerEntry=true;render();root()?.classList.add(result==='success'?'result-success':'result-failure')},1150);
  setTimeout(()=>root()?.classList.remove('result-success','result-failure'),2850);
}
async function load(){
  if(!state.eventId||state.busy||!enabled())return;
  state.busy=true;
  try{
    const {data,error}=await client().rpc('get_breakthrough_battlefield_v154',{p_event_id:state.eventId});
    if(error)throw error;
    const oldResult=state.data?.event?.breakthrough_result||state.lastResult;
    state.data=data;state.role=data?.my_role||state.role||'spectator';
    const newResult=data?.event?.breakthrough_result||null;
    render();
    if(newResult&&newResult!==oldResult){state.lastResult=newResult;resultTransition(newResult)}
    if(data?.event?.battle_status==='ended')clearInterval(state.timer);
  }catch(err){
    console.warn('[V15.4 battlefield load]',err);
    const message=String(err?.message||err);
    if(message.includes('BREAKTHROUGH_NOT_FOUND'))close();
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
function open(eventId,options={}){
  if(!eventId)return Promise.resolve(false);
  state.eventId=String(eventId);state.role=options.role||state.role;state.selected=null;state.data=null;state.lastResult=options.lastResult||null;state.ownerEntry=!!options.ownerEntry;
  createRoot();clearInterval(state.timer);state.timer=setInterval(load,900);load();return Promise.resolve(true);
}
function close(){
  clearInterval(state.timer);state.timer=null;root()?.remove();document.body.classList.remove('v154-battlefield-locked');state.eventId=null;state.data=null;state.selected=null;state.ownerEntry=false;
}
function failureScene(options={}){
  document.getElementById(FAILURE_ID)?.remove();
  const el=document.createElement('section');el.id=FAILURE_ID;el.className='v154-failure-overlay';
  el.innerHTML=`<div class="v154-failure-collapse"></div><div class="v154-failure-copy"><h2>突破失敗</h2><p>靈氣崩散，經脈逆行，你已陷入走火入魔。</p><button type="button">強行出關</button></div>`;
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
  const active=rows.find(x=>x?.battle_status==='active'&&['guardian','attacker'].includes(x?.faction));
  if(active)setTimeout(()=>open(active.event_id,{role:active.faction}),80);
}
function openJoined(eventId,role){return open(eventId,{role})}

window.openBreakthroughBattlefieldV154=open;
window.closeBreakthroughBattlefieldV154=close;
window.openJoinedBreakthroughBattlefieldV154=openJoined;
window.restoreJoinedBattlefieldV154=restoreJoined;
window.playBreakthroughOutcomeAndEnterBattleV154=playOutcomeAndEnterBattle;
window.V154_BREAKTHROUGH_BATTLEFIELD={build:BUILD,open,close,load,act,playOutcomeAndEnterBattle};
})();
