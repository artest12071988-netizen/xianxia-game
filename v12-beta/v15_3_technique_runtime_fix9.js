(()=>{
'use strict';
if(window.__V153TechniqueFix9Loaded)return;
window.__V153TechniqueFix9Loaded=true;

const BUILD='V15.3-PHASE2-FIX9-TECHNIQUE-RUNTIME';
const state={
 installed:false,
 attackContext:null,
 fightRef:null,
 fightRuntime:null,
 raidLastHp:null,
 raidAdjusting:false,
 timers:[],
 patches:{}
};
const get=name=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
const set=(name,value)=>{try{return Function('value',name+'=value;try{window["'+name+'"]='+name+'}catch(_){};return '+name)(value)}catch(_){try{window[name]=value}catch(__){}return value}};
const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const game=()=>get('g')||window.g||null;
const fight=()=>get('fight')||window.fight||null;
const config=()=>get('C')||window.C||null;
const learned=id=>Array.isArray(game()?.techniques)&&game().techniques.includes(id);
const save=()=>{try{get('saveGame')?.(false)}catch(_){}};
const redraw=()=>{try{get('render')?.()}catch(_){}};
const toast=msg=>{try{get('toast')?.(msg)}catch(_){console.info('['+BUILD+']',msg)}};

const VERIFIED={
 rebirth:{name:'三重轉生訣',effect:'全修為取得 ×0.30；築基成功率 100%；結丹 +30 個百分點；元嬰 +5 個百分點。'},
 green_sword:{name:'綠元劍訣',effect:'裝備飛劍時，第一重最終攻擊提高 10%。'},
 gentleman:{name:'君子功',effect:'第一重防禦提高 10%；戰鬥中實際承受傷害再降低 50%。'},
 golden_dragon:{name:'金龍火體訣',effect:'第一重最大體力提高 15%；沿用現行攻擊 +2%、防禦 +5%。'},
 big_eye:{name:'大眼訣',effect:'神識距離提高 100%（最低 1 格）；攔截 AI 修士時增加 10% 伏擊機會，成功伏擊有 50% 機率首擊 ×2。'},
 descent:{name:'降靈術',effect:'每場戰鬥可啟動一次；5 次出手攻擊 ×2，每次有 20% 機率再觸發 ×1.8 特殊暴擊；結束後 3 回合無法行動。'},
 dust:{name:'望塵訣',effect:'在線打坐、離線打坐的修為、體力與精力收益全部 ×2。'},
 lightning_breath:{name:'電之呼吸',effect:'第一重暴擊率 +10%；暴擊實際傷害再提高 50%，不再使用固定 +50 傷害。'}
};

function updateTechniqueDescriptions(){
 const C=config();if(!Array.isArray(C?.techniques))return;
 for(const t of C.techniques){
  const v=VERIFIED[t.id];if(!v)continue;
  t.details=v.effect;t.desc=v.effect;
 }
}
function newFightRuntime(f){
 return {
  ref:f,
  descent:{active:false,attacksLeft:0,backlashLeft:0,used:false,special:false,lockUntil:0},
  bigEye:{ambush:false,doubleReady:false,consumed:false}
 };
}
function runtime(){
 const f=fight();
 if(f!==state.fightRef){
  state.fightRef=f;
  state.fightRuntime=f?newFightRuntime(f):null;
 }
 return state.fightRuntime;
}
function inRaid(){return !!window.V152_RAID?.active?.()||fight()?.kind==='divine_beast'}
function attackState(){return runtime()?.descent||null}
function isBacklash(){
 const s=attackState();
 return !!(s&&(s.backlashLeft>0||num(s.lockUntil)>Date.now()));
}

function syncGoldenDragonHp(){
 const g=game();if(!g)return;
 const has=learned('golden_dragon');
 const mark=g.v153GoldenDragonHp&&typeof g.v153GoldenDragonHp==='object'?g.v153GoldenDragonHp:null;
 if(has){
  if(mark&&mark.characterId===String(g.characterId||'')&&mark.level===num(g.lv)&&Math.abs(num(g.hpMax)-num(mark.appliedMax))<1)return;
  let base=num(g.hpMax,1);
  if(mark&&Math.abs(num(g.hpMax)-num(mark.appliedMax))<1)base=num(mark.baseMax,base);
  const applied=Math.max(1,Math.round(base*1.15));
  const gain=Math.max(0,applied-base);
  g.hpMax=applied;
  g.hp=Math.min(applied,num(g.hp)+gain);
  g.v153GoldenDragonHp={characterId:String(g.characterId||''),level:num(g.lv),baseMax:base,appliedMax:applied};
  save();
 }else if(mark){
  if(Math.abs(num(g.hpMax)-num(mark.appliedMax))<1){
   g.hpMax=Math.max(1,num(mark.baseMax,1));g.hp=Math.min(num(g.hp),num(g.hpMax));
  }
  delete g.v153GoldenDragonHp;save();
 }
}

function appendCombatNote(text,cls='good'){
 const ov=document.getElementById('ov');
 const line=ov?.querySelector('.fight-line')||[...ov?.querySelectorAll('p.small')||[]].at(-1);
 if(line)line.insertAdjacentHTML('beforeend',`<span class="v153-tech-note ${cls}">${esc(text)}</span>`);
}
function techniqueStatusHtml(){
 const g=game(),rt=runtime();
 if(!g)return '<p>角色資料尚未載入。</p>';
 const rows=(g.techniques||[]).map(id=>{
  const v=VERIFIED[id];if(!v)return '';
  let status='常駐生效';
  if(id==='descent'){
   const d=rt?.descent;
   status=d?.active?`爆發中｜剩餘 ${d.attacksLeft} 次出手`:d?.backlashLeft>0?`靈衰反噬｜剩餘 ${d.backlashLeft} 回合`:d?.used?'本場已使用':'本場可啟動';
  }
  return `<div class="v153-tech-row"><div><b>${esc(v.name)}</b><small>${esc(v.effect)}</small></div><span>${esc(status)}</span></div>`;
 }).join('');
 return rows||'<p class="small">目前沒有研習功法。</p>';
}
function openTechniqueStatus(){
 const sheet=get('sheet');if(typeof sheet!=='function')return;
 sheet(`<h3>功法狀態・實效驗證</h3><div class="v153-tech-list">${techniqueStatusHtml()}</div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">返回戰鬥</button>`);
}
function descentButtonHtml(){
 if(!learned('descent'))return '';
 const d=runtime()?.descent;
 if(!d)return '';
 if(d.active)return `<button class="btn v153-descent active" disabled>降靈術｜剩餘 ${d.attacksLeft} 擊</button>`;
 if(d.backlashLeft>0||num(d.lockUntil)>Date.now())return `<button class="btn v153-descent backlash" disabled>降靈反噬｜無法行動</button>`;
 if(d.used)return '<button class="btn v153-descent" disabled>降靈術｜本場已使用</button>';
 return '<button class="btn v153-descent" onclick="V153_TECHNIQUES.activateDescent()">啟動降靈術</button>';
}
function augmentGeneralFight(){
 const f=fight(),ov=document.getElementById('ov');if(!f||!ov?.classList.contains('on'))return;
 const row=ov.querySelector('.row');if(!row)return;
 let bar=ov.querySelector('.v153-tech-combat-bar');
 if(!bar){bar=document.createElement('div');bar.className='v153-tech-combat-bar';row.parentElement.insertBefore(bar,row)}
 const rt=runtime();
 const big=rt?.bigEye?.doubleReady&&!rt.bigEye.consumed?'<span class="v153-tech-chip">大眼訣｜首擊破綻</span>':'';
 const descent=descentButtonHtml();
 bar.innerHTML=`<div class="v153-tech-chips">${big}${learned('gentleman')?'<span class="v153-tech-chip">君子功護體</span>':''}${learned('lightning_breath')?'<span class="v153-tech-chip">電之呼吸</span>':''}</div><div class="v153-tech-buttons">${descent}<button class="btn" onclick="V153_TECHNIQUES.openStatus()">功法狀態</button></div>`;
 if(isBacklash())row.querySelectorAll('button').forEach(b=>b.disabled=true);
 ov.querySelector('.fight-stage')?.classList.toggle('v153-descent-aura',!!rt?.descent?.active);
}
function augmentRaid(){
 const root=document.querySelector('.v152-raid-root');if(!root)return;
 const actions=root.querySelector('.v152-raid-actions');if(!actions)return;
 let b=actions.querySelector('[data-v153-descent]');
 if(learned('descent')){
  if(!b){b=document.createElement('button');b.className='v152-raid-action v153-raid-descent';b.dataset.v153Descent='1';actions.insertBefore(b,actions.querySelector('[data-retreat]'));b.onclick=activateDescent}
  const d=runtime()?.descent;
  b.disabled=!!(d?.active||d?.used||isBacklash());
  b.textContent=d?.active?`降靈 ${d.attacksLeft}擊`:isBacklash()?'降靈反噬':d?.used?'降靈已用':'啟動降靈術';
 }
 const tech=actions.querySelector('[data-tech]');if(tech)tech.onclick=openTechniqueStatus;
 root.classList.toggle('v153-descent-aura',!!runtime()?.descent?.active);
}
function refreshCombatUi(){augmentGeneralFight();augmentRaid()}

function activateDescent(){
 const f=fight(),rt=runtime();
 if(!f||!rt||!learned('descent')){toast('目前不在可施展降靈術的戰鬥中');return}
 const d=rt.descent;
 if(d.active||d.used||isBacklash())return;
 d.active=true;d.attacksLeft=5;d.backlashLeft=0;d.used=true;d.special=false;
 toast('降靈術啟動：五次出手攻擊翻倍');
 try{get('renderFight')?.('你引動降靈術，靈壓暴漲；五次出手後將承受三回合反噬。')}catch(_){window.V152_RAID?.setLine?.('降靈術啟動：五次出手攻擊翻倍。')}
 refreshCombatUi();
}
function scheduleBacklash(fRef){
 const rt=runtime();if(!rt||rt.ref!==fRef)return;
 rt.descent.active=false;rt.descent.backlashLeft=3;
 toast('降靈術耗盡，進入三回合靈衰反噬');
 refreshCombatUi();
 if(fRef?.kind==='divine_beast'){
  rt.descent.lockUntil=Date.now()+6000;
  const t=setTimeout(()=>{if(runtime()?.ref===fRef){rt.descent.backlashLeft=0;rt.descent.lockUntil=0;window.V152_RAID?.setLine?.('降靈反噬已退去，你重新掌控靈力。');refreshCombatUi()}},6100);state.timers.push(t);return;
 }
 const step=()=>{
  const current=runtime(),g=game();
  if(!current||current.ref!==fRef||!fight()||num(g?.hp)<=0||current.descent.backlashLeft<=0)return;
  const left=current.descent.backlashLeft--;
  try{get('renderFight')?.(`降靈反噬壓制經脈，你無法行動（${left}/3）。`)}catch(_){ }
  refreshCombatUi();
  const t=setTimeout(()=>{
   if(runtime()?.ref!==fRef||!fight())return;
   try{get('enemyTurn')?.()}catch(_){ }
   if(runtime()?.descent.backlashLeft>0){const t2=setTimeout(step,900);state.timers.push(t2)}
   else{toast('降靈反噬結束');refreshCombatUi()}
  },360);state.timers.push(t);
 };
 const t=setTimeout(step,1300);state.timers.push(t);
}
function afterPlayerAttack(fRef,beforeMp,ctx){
 const g=game(),rt=runtime();if(!rt||rt.ref!==fRef)return;
 const spent=num(g?.mp)<num(beforeMp);
 if(!spent)return;
 if(ctx.bigEye){rt.bigEye.consumed=true;rt.bigEye.doubleReady=false;toast('大眼訣捕捉破綻，首擊威力倍增')}
 if(ctx.descent){
  rt.descent.attacksLeft=Math.max(0,rt.descent.attacksLeft-1);
  if(ctx.special)toast('降靈術觸發 180% 特殊暴擊');
  if(rt.descent.attacksLeft<=0)scheduleBacklash(fRef);
 }
 refreshCombatUi();
}

function patchCoreStats(){
 const oldGain=get('gainExp');
 if(typeof oldGain==='function'&&!oldGain.__v153TechniqueFix9){
  const fn=function(n,doRender=true){const amount=num(n)*(learned('rebirth')?.30:1);return oldGain(amount,doRender)};
  fn.__v153TechniqueFix9=true;fn.__base=oldGain;set('gainExp',fn);state.patches.gainExp=fn;
 }
 const oldAtk=get('pAtk');
 if(typeof oldAtk==='function'&&!oldAtk.__v153TechniqueFix9){
  const fn=function(){let v=num(oldAtk.apply(this,arguments));const c=state.attackContext;if(c?.descent)v*=2;if(c?.descentSpecial)v*=1.8;if(c?.bigEye)v*=2;return Math.max(1,Math.round(v))};
  fn.__v153TechniqueFix9=true;fn.__base=oldAtk;set('pAtk',fn);state.patches.pAtk=fn;
 }
 const oldDef=get('pDef');
 if(typeof oldDef==='function'&&!oldDef.__v153TechniqueFix9){
  const fn=function(){let v=num(oldDef.apply(this,arguments));if(learned('gentleman'))v*=1.10;return Math.max(0,Math.round(v))};
  fn.__v153TechniqueFix9=true;fn.__base=oldDef;set('pDef',fn);state.patches.pDef=fn;
 }
 const oldSense=get('senseRange');
 if(typeof oldSense==='function'&&!oldSense.__v153TechniqueFix9){
  const fn=function(){const base=num(oldSense.apply(this,arguments));return learned('big_eye')?Math.max(1,Math.round(base*2)):base};
  fn.__v153TechniqueFix9=true;fn.__base=oldSense;set('senseRange',fn);state.patches.senseRange=fn;
 }
 const oldCalc=get('calcDmg');
 if(typeof oldCalc==='function'&&!oldCalc.__v153TechniqueFix9){
  const fn=function(atk,def,mult=1){let v=num(oldCalc.apply(this,arguments));const c=state.attackContext;if(c?.lightning&&num(mult)>1){v=Math.round(v*1.5);if(c.legacyFlatLightning)v=Math.max(1,v-50)}return Math.max(1,v)};
  fn.__v153TechniqueFix9=true;fn.__base=oldCalc;set('calcDmg',fn);state.patches.calcDmg=fn;
 }
}
function patchMeditation(){
 const old=get('tickMeditation');if(typeof old!=='function'||old.__v153TechniqueFix9)return;
 const fn=function(){
  if(!learned('dust'))return old.apply(this,arguments);
  const g=game(),beforeHp=num(g?.hp),beforeMp=num(g?.mp),currentGain=get('gainExp');
  if(typeof currentGain==='function')set('gainExp',function(n,r){return currentGain(num(n)*2,r)});
  let out;
  try{out=old.apply(this,arguments)}finally{if(typeof currentGain==='function')set('gainExp',currentGain)}
  if(g){
   const hpDelta=Math.max(0,num(g.hp)-beforeHp),mpDelta=Math.max(0,num(g.mp)-beforeMp);
   if(hpDelta)g.hp=Math.min(num(g.hpMax),num(g.hp)+hpDelta);
   if(mpDelta)g.mp=Math.min(num(g.mpMax),num(g.mp)+mpDelta);
   if(hpDelta||mpDelta){redraw();save()}
  }
  return out;
 };
 fn.__v153TechniqueFix9=true;fn.__base=old;set('tickMeditation',fn);state.patches.tickMeditation=fn;
}
function applyGentlemanReduction(before){
 const g=game();if(!g||!learned('gentleman'))return;
 const after=num(g.hp);if(after>=num(before))return;
 const raw=Math.max(0,num(before)-after),prevented=Math.floor(raw*.5);
 if(prevented<=0)return;
 g.hp=Math.min(num(g.hpMax),after+prevented);save();redraw();appendCombatNote(`君子功化解 ${prevented} 點傷害。`,'guard');
}
function patchCombat(){
 const oldRender=get('renderFight');
 if(typeof oldRender==='function'&&!oldRender.__v153TechniqueFix9){
  const fn=function(){const r=oldRender.apply(this,arguments);setTimeout(refreshCombatUi,0);return r};fn.__v153TechniqueFix9=true;fn.__base=oldRender;set('renderFight',fn);state.patches.renderFight=fn;
 }
 const oldAttack=get('attackTurn');
 if(typeof oldAttack==='function'&&!oldAttack.__v153TechniqueFix9){
  const fn=function(){
   const f=fight(),g=game(),rt=runtime();if(!f||!g)return oldAttack.apply(this,arguments);
   if(isBacklash()){toast('降靈反噬中，暫時無法行動');return}
   const d=rt?.descent,ctx={
    descent:!!d?.active,
    descentSpecial:!!d?.active&&Math.random()<.20,
    bigEye:!!rt?.bigEye?.doubleReady&&!rt.bigEye.consumed,
    lightning:learned('lightning_breath'),
    legacyFlatLightning:f.kind==='monster'
   };
   const beforeMp=num(g.mp);state.attackContext=ctx;
   let out;try{out=oldAttack.apply(this,arguments)}finally{state.attackContext=null}
   afterPlayerAttack(f,beforeMp,ctx);return out;
  };
  fn.__v153TechniqueFix9=true;fn.__base=oldAttack;set('attackTurn',fn);state.patches.attackTurn=fn;
 }
 const oldEnemy=get('enemyTurn');
 if(typeof oldEnemy==='function'&&!oldEnemy.__v153TechniqueFix9){
  const fn=function(){const before=num(game()?.hp);const r=oldEnemy.apply(this,arguments);applyGentlemanReduction(before);return r};fn.__v153TechniqueFix9=true;fn.__base=oldEnemy;set('enemyTurn',fn);state.patches.enemyTurn=fn;
 }
 const oldLose=get('loseFight');
 if(typeof oldLose==='function'&&!oldLose.__v153TechniqueFix9){
  const fn=function(){if(num(game()?.hp)>0)return;return oldLose.apply(this,arguments)};fn.__v153TechniqueFix9=true;fn.__base=oldLose;set('loseFight',fn);state.patches.loseFight=fn;
 }
 for(const name of ['openCombatItems','fleeTurn']){
  const old=get(name);if(typeof old!=='function'||old.__v153TechniqueFix9)continue;
  const fn=function(){if(isBacklash()){toast('降靈反噬中，暫時無法行動');return}return old.apply(this,arguments)};fn.__v153TechniqueFix9=true;fn.__base=old;set(name,fn);state.patches[name]=fn;
 }
 const oldStartAi=get('startFightAi');
 if(typeof oldStartAi==='function'&&!oldStartAi.__v153TechniqueFix9){
  const fn=function(){const r=oldStartAi.apply(this,arguments);const rt=runtime();if(rt&&learned('big_eye')&&Math.random()<.10){rt.bigEye.ambush=true;rt.bigEye.doubleReady=Math.random()<.50;setTimeout(()=>{try{get('renderFight')?.(rt.bigEye.doubleReady?'大眼訣看穿對手靈力破綻；本次伏擊成功，首擊威力將翻倍。':'大眼訣協助你搶得先手，但尚未鎖定致命破綻。')}catch(_){ }},0)}return r};
  fn.__v153TechniqueFix9=true;fn.__base=oldStartAi;set('startFightAi',fn);state.patches.startFightAi=fn;
 }
}
function patchRaid(){
 const api=window.V151_PHASE2;if(!api||typeof api.divineAttack!=='function'||api.divineAttack.__v153TechniqueFix9)return;
 const old=api.divineAttack;
 const fn=async function(){
  const f=fight(),g=game(),rt=runtime();if(!f||!g)return old.apply(this,arguments);
  if(isBacklash()){toast('降靈反噬中，暫時無法攻擊');return}
  const d=rt?.descent,ctx={descent:!!d?.active,descentSpecial:!!d?.active&&Math.random()<.20,bigEye:false,lightning:learned('lightning_breath'),legacyFlatLightning:false};
  const beforeMp=num(g.mp);state.attackContext=ctx;
  let out;try{out=await old.apply(this,arguments)}finally{state.attackContext=null}
  afterPlayerAttack(f,beforeMp,ctx);return out;
 };
 fn.__v153TechniqueFix9=true;fn.__base=old;api.divineAttack=fn;state.patches.divineAttack=fn;
}
function raidGentlemanMonitor(){
 const g=game();
 if(!g||!window.V152_RAID?.active?.()){state.raidLastHp=num(g?.hp,null);return}
 const hp=num(g.hp);if(state.raidLastHp==null){state.raidLastHp=hp;return}
 if(learned('gentleman')&&!state.raidAdjusting&&hp<state.raidLastHp){
  const damage=state.raidLastHp-hp,prevented=Math.floor(damage*.5);
  if(prevented>0){state.raidAdjusting=true;g.hp=Math.min(num(g.hpMax),hp+prevented);save();redraw();window.V152_RAID?.setLine?.(`君子功化解 ${prevented} 點神獸傷害。`);setTimeout(()=>state.raidAdjusting=false,0)}
 }
 state.raidLastHp=num(g.hp);
}
function install(){
 if(state.installed)return true;
 if(!game()||!config()||typeof get('pAtk')!=='function'||typeof get('attackTurn')!=='function')return false;
 updateTechniqueDescriptions();patchCoreStats();patchMeditation();patchCombat();syncGoldenDragonHp();state.installed=true;
 console.info('['+BUILD+'] installed',audit());return true;
}
function audit(){
 return {
  build:BUILD,
  learned:[...(game()?.techniques||[])],
  checks:{
   rebirth:!!state.patches.gainExp,
   green_sword:typeof get('pAtk')==='function',
   gentleman:!!state.patches.pDef&&!!state.patches.enemyTurn,
   golden_dragon:!!game()?.v153GoldenDragonHp||!learned('golden_dragon'),
   big_eye:!!state.patches.senseRange&&!!state.patches.startFightAi,
   descent:!!state.patches.attackTurn,
   dust:!!state.patches.tickMeditation,
   lightning_breath:!!state.patches.calcDmg
  },
  pvpNote:'真人 PVP 的最終傷害由 Supabase pvp_attack 伺服器函式決定；本前端包只保證送入快照的攻防數值，未宣稱主動降靈術與最終減傷已進入伺服器公式。'
 };
}
window.V153_TECHNIQUES={build:BUILD,activateDescent,openStatus:openTechniqueStatus,audit,state:()=>({runtime:state.fightRuntime,attackContext:state.attackContext})};
let tries=0;const boot=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(boot)},250);
const loop=setInterval(()=>{if(!state.installed)install();patchRaid();syncGoldenDragonHp();refreshCombatUi();raidGentlemanMonitor()},250);state.timers.push(loop);
})();
