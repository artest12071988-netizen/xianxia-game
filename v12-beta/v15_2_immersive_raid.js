(()=>{
'use strict';
const BUILD='V15.2-PHASE3-FIX2-RAID-ITEM-RETURN';
const ART={
 qinglong:'assets/divine_beasts/qinglong.webp',
 baihu:'assets/divine_beasts/baihu.webp',
 fenghuang:'assets/divine_beasts/fenghuang.webp',
 xuanwu:'assets/divine_beasts/xuanwu.webp',
 qilin:'assets/divine_beasts/qilin.webp'
};
const DIR={east:'東方',west:'西方',north:'北方',south:'南方',center:'中央'};
const S={
 prompt:null,root:null,token:null,beast:null,active:false,poll:null,countdown:null,
 snapshot:null,tab:'feed',line:'',handlers:null,seen:new Set(),hitLedger:new Set(),busy:false,hitBusy:false,castBusy:false,tauntTimer:null,lastDialogueAt:0,audio:null
};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
const fmt=v=>Math.round(num(v)).toLocaleString('zh-TW');
const pct=(v,max)=>Math.max(0,Math.min(100,num(v)/Math.max(1,num(max))*100));
function cloud(){try{if(typeof cloudState!=='undefined'&&cloudState)return cloudState}catch(_){}return window.XIANXIA_CLOUD_STATE||window.cloudState||null}
function client(){return cloud()?.client||null}
async function rpc(name,args={}){
 const c=client();if(!c)throw new Error('尚未連線伺服器');
 const {data,error}=await c.rpc(name,args);if(error)throw error;return data
}
function art(beast){return ART[String(beast?.beast_key||'')]||ART.baihu}
function removePrompt(){S.prompt?.remove();S.prompt=null}
function removeRoot(){S.root?.remove();S.root=null;document.body.style.overflow=''}
function secondsLeft(iso){
 if(!iso)return 0;return Math.max(0,Math.floor((new Date(iso).getTime()-Date.now())/1000))
}
function timeText(sec){
 const m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

const INTRO_LINES={
 baihu:'渺小的人類修士，還妄想得到我身上的異寶？',
 qinglong:'東方萬木皆聽吾令，爾等也敢逆天而行？',
 fenghuang:'凡火亦敢近吾真炎？頃刻便教爾等化作飛灰！',
 xuanwu:'萬水歸墟，爾等攻勢不過蜉蝣撼海。',
 qilin:'中土氣運由吾鎮守，貪念一起，便是劫數。'
};
const AMBIENT_LINES={
 baihu:[
  '爾等的殺意，遠不及西方庚金萬一。',
  '再靠近一步，本座便撕碎你的元神。',
  '人數再多，也只會讓此地多幾具屍骨。',
  '吾之一爪，可斷山河，何況爾等血肉之軀。',
  '異寶有靈，絕不會落入弱者手中。',
  '本座已記住你們每一道氣息。',
  '想以車輪戰消耗本座？可笑。',
  '西方殺劫已至，誰也逃不出去。',
  '你們的恐懼，本座聽得一清二楚。',
  '再讓本座失望，便一爪結束這場鬧劇。'
 ],
 qinglong:[
  '山川草木都在告訴吾，你們的每一步。',
  '龍脈不絕，吾之力量便永不枯竭。',
  '東方生機並非仁慈，亦可化作無盡殺機。',
  '爾等身上的木靈之氣，正向吾臣服。',
  '逆鱗不可觸，你們卻一再挑釁。',
  '萬木正在收緊，爾等還能退往何處？',
  '龍威籠罩之地，連呼吸都需吾允許。',
  '凡人妄圖屠龍，古今皆是笑談。',
  '吾見過無數天驕，最後都埋骨山河。',
  '此戰結束後，爾等將化作滋養大地的養分。'
 ],
 fenghuang:[
  '爾等的法力，正在真炎之前迅速蒸發。',
  '吾每一片火羽，都足以焚滅一座城池。',
  '涅槃不滅，爾等憑什麼與吾久戰？',
  '寒風只能讓吾之真火燃燒得更加猛烈。',
  '你們聞到了嗎？那是神魂被灼燒的氣息。',
  '敢覬覦鳳凰火羽，便準備以性命交換。',
  '火焰正在記住你們的氣機。',
  '吾將讓此地成為永不熄滅的火域。',
  '凡人的勇氣，在真炎面前只是一瞬。',
  '再多一息，你們的經脈便會開始燃燒。'
 ],
 xuanwu:[
  '玄冥之水無窮無盡，爾等的法力卻有盡時。',
  '吾已沉眠萬古，不介意再埋葬一批修士。',
  '攻擊落在吾甲上，不過如雨滴落海。',
  '蛇首已繞至爾等身後。',
  '水壓正在一寸寸壓碎你們的護體靈氣。',
  '玄冥海域之中，無人能逃。',
  '你們的腳步越來越沉了。',
  '吾不需要追趕，深海自會吞噬一切。',
  '萬法落入玄冥，終究只剩寂靜。',
  '繼續攻擊吧，讓爾等徹底明白何謂絕望。'
 ],
 qilin:[
  '此地每一寸土地，都在吾的掌控之中。',
  '貪念越重，地脈反噬便越深。',
  '祥瑞只庇護有德之人，而非覬覦異寶者。',
  '你們腳下的山河，正在為吾積蓄力量。',
  '中央厚土可載萬物，也可埋葬萬靈。',
  '爾等每一次踏步，都會驚動更深的地脈。',
  '吾已看見你們仙途盡頭的劫數。',
  '凡人的刀劍，如何斬得動山河氣運？',
  '此戰並非機緣，而是爾等自尋的死劫。',
  '退出此地，尚可留下一線生機。'
 ]
};
function uuid(){
 if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
   const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)
 });
}
function earthReductionPct(){
 try{
   const e=(window.g?.equipment||[]).find(x=>String(x.uid)===String(window.g?.armorUid));
   return e?.elementEnchant?.key==='earth'?25:0;
 }catch(_){return 0}
}
function showDialogue(text,skill=''){
 if(!S.root||!text)return;
 S.lastDialogueAt=Date.now();
 const box=S.root.querySelector('[data-boss-dialogue]');
 box.classList.remove('show');
 void box.offsetWidth;
 box.innerHTML=`<small>${esc(skill||'神獸怒喝')}</small><b>「${esc(text)}」</b>`;
 box.classList.add('show');
 setTimeout(()=>box?.classList.remove('show'),4200);
}

function randomLine(lines=[]){
 if(!Array.isArray(lines)||!lines.length)return '';
 return lines[Math.floor(Math.random()*lines.length)]||'';
}
function phaseInfo(beast=S.beast){
 const ratio=num(beast?.current_hp)/Math.max(1,num(beast?.max_hp));
 if(ratio<=.35)return {key:'berserk',label:'狂暴',tone:'滅世威壓'};
 if(ratio<=.70)return {key:'enraged',label:'震怒',tone:'神獸震怒'};
 return {key:'dominant',label:'天威',tone:'天地威壓'};
}
function ensureAudio(){
 try{
   if(!S.audio){
     const Ctx=window.AudioContext||window.webkitAudioContext;
     if(Ctx)S.audio=new Ctx();
   }
   if(S.audio?.state==='suspended')S.audio.resume();
 }catch(_){}
 return S.audio;
}
function playSound(kind='impact'){
 const ctx=ensureAudio();if(!ctx)return;
 const now=ctx.currentTime;
 const gain=ctx.createGain();
 gain.connect(ctx.destination);
 if(kind==='telegraph'){
   const osc=ctx.createOscillator();
   osc.type='sawtooth';osc.frequency.setValueAtTime(58,now);
   osc.frequency.exponentialRampToValueAtTime(34,now+.75);
   gain.gain.setValueAtTime(.0001,now);
   gain.gain.exponentialRampToValueAtTime(.08,now+.08);
   gain.gain.exponentialRampToValueAtTime(.0001,now+.85);
   osc.connect(gain);osc.start(now);osc.stop(now+.9);
 }else if(kind==='boss'){
   const osc=ctx.createOscillator();
   osc.type='square';osc.frequency.setValueAtTime(82,now);
   osc.frequency.exponentialRampToValueAtTime(28,now+.42);
   gain.gain.setValueAtTime(.12,now);
   gain.gain.exponentialRampToValueAtTime(.0001,now+.5);
   osc.connect(gain);osc.start(now);osc.stop(now+.52);
 }else{
   const osc=ctx.createOscillator();
   osc.type='triangle';osc.frequency.setValueAtTime(720,now);
   osc.frequency.exponentialRampToValueAtTime(160,now+.18);
   gain.gain.setValueAtTime(.07,now);
   gain.gain.exponentialRampToValueAtTime(.0001,now+.22);
   osc.connect(gain);osc.start(now);osc.stop(now+.24);
 }
}
function setActionsDisabled(disabled){
 S.root?.querySelectorAll('.v152-raid-action').forEach(b=>{
   if(!b.dataset.originalDisabled)b.dataset.originalDisabled=b.disabled?'1':'0';
   b.disabled=!!disabled||(b.dataset.originalDisabled==='1');
 });
}
function updatePhaseDisplay(){
 if(!S.root)return;
 const info=phaseInfo();
 S.root.dataset.phase=info.key;
 const badge=S.root.querySelector('[data-boss-phase]');
 if(badge){
   badge.className=`v152-phase-badge ${info.key}`;
   badge.innerHTML=`<small>${esc(info.tone)}</small><b>${esc(info.label)}</b>`;
 }
}
function startTaunts(){
 stopTaunts();
 const schedule=()=>{
   const delay=10000+Math.floor(Math.random()*7000);
   S.tauntTimer=setTimeout(()=>{
     if(S.active&&Date.now()-S.lastDialogueAt>6500&&!S.castBusy){
       const line=randomLine(AMBIENT_LINES[String(S.beast?.beast_key||'')]||[]);
       if(line)showDialogue(line,phaseInfo().tone);
     }
     schedule();
   },delay);
 };
 schedule();
}
function stopTaunts(){
 if(S.tauntTimer)clearTimeout(S.tauntTimer);
 S.tauntTimer=null;
}
function telegraphBossAttack(attack={}){
 if(!S.root)return Promise.resolve();
 S.castBusy=true;setActionsDisabled(true);updatePhaseDisplay();
 const root=S.root;
 const cast=root.querySelector('[data-skill-cast]');
 const aoe=attack.attack_type==='aoe';
 const warning=Math.max(650,Math.min(1600,num(attack.warning_ms,900)));
 root.classList.remove('casting-single','casting-aoe','phase-enraged','phase-berserk');
 root.classList.add(aoe?'casting-aoe':'casting-single');
 if(attack.phase==='enraged')root.classList.add('phase-enraged');
 if(attack.phase==='berserk')root.classList.add('phase-berserk');
 cast.innerHTML=`<small>${aoe?'全體危險｜所有參戰者':'神獸鎖定｜目前出手者'}</small><b>【${esc(attack.skill_name||'神獸神通')}】</b><i><em></em></i>`;
 cast.style.setProperty('--warning-ms',`${warning}ms`);
 cast.classList.remove('show');void cast.offsetWidth;cast.classList.add('show');
 showDialogue(attack.dialogue||'天地神通降臨！',attack.skill_name||'神獸神通');
 playSound('telegraph');
 try{navigator.vibrate?.(aoe?[80,50,120]:[70,40,70])}catch(_){}
 return new Promise(resolve=>setTimeout(()=>{
   cast.classList.remove('show');
   root.classList.remove('casting-single','casting-aoe');
   resolve();
 },warning));
}

function floatDamage(value,kind='player',label=''){
 if(!S.root)return;
 const layer=S.root.querySelector('[data-damage-layer]');
 const el=document.createElement('div');
 el.className=`v152-float-damage ${kind}`;
 el.innerHTML=`${label?`<small>${esc(label)}</small>`:''}<b>${kind==='boss'?'-':''}${fmt(value)}</b>`;
 el.style.left=`${44+Math.random()*16}%`;
 el.style.top=`${30+Math.random()*18}%`;
 layer.appendChild(el);
 setTimeout(()=>el.remove(),1300);
}
function playerImpact(info={}){
 if(!S.root)return;
 playSound('impact');
 const root=S.root,fx=root.querySelector('[data-fx-layer]');
 root.classList.remove('fx-player-hit','fx-player-crit');
 void root.offsetWidth;
 root.classList.add(info.crit?'fx-player-crit':'fx-player-hit');
 fx.innerHTML='<i class="v152-slash s1"></i><i class="v152-slash s2"></i><i class="v152-impact-ring"></i>';
 floatDamage(info.damage||0,info.crit?'crit':'player',info.crit?'暴擊':'');
 setTimeout(()=>{
   root.classList.remove('fx-player-hit','fx-player-crit');
   fx.innerHTML='';
 },680);
}
function bossImpact(hit={}){
 if(!S.root)return;
 playSound('boss');
 const root=S.root,fx=root.querySelector('[data-fx-layer]');
 root.classList.remove('fx-boss-single','fx-boss-aoe');
 void root.offsetWidth;
 const aoe=hit.attack_type==='aoe';
 root.classList.add(aoe?'fx-boss-aoe':'fx-boss-single');
 fx.innerHTML=aoe
   ?'<i class="v152-aoe-wave w1"></i><i class="v152-aoe-wave w2"></i><i class="v152-red-flash"></i>'
   :'<i class="v152-claw c1"></i><i class="v152-claw c2"></i><i class="v152-claw c3"></i><i class="v152-red-flash"></i>';
 showDialogue(hit.dialogue,hit.skill_name);
 floatDamage(hit.damage||0,'boss',hit.attack_type==='aoe'?'範圍神通':hit.skill_name);
 setLine(`${S.beast?.beast_name||'神獸'}施展【${hit.skill_name}】，你受到 ${fmt(hit.damage)} 傷害！`);
 setTimeout(()=>{
   root.classList.remove('fx-boss-single','fx-boss-aoe');
   fx.innerHTML='';
 },900);
}
async function updateCombatStats(){
 if(!S.token)return;
 try{
   await rpc('divine_beast_update_raid_combat_stats',{
     p_token:S.token,
     p_player_defense:num(window.pDef?.()),
     p_earth_reduction_pct:earthReductionPct()
   });
 }catch(e){
   const m=String(e?.message||e);
   if(!/Could not find|does not exist/i.test(m))
     console.warn('['+BUILD+'] combat stats failed',e);
 }
}
async function requestBossCounter(){
 if(!S.token||S.castBusy)return null;
 await updateCombatStats();
 try{
   const data=await rpc('divine_beast_boss_counterattack',{
     p_token:S.token,
     p_action_id:uuid(),
     p_player_defense:num(window.pDef?.()),
     p_earth_reduction_pct:earthReductionPct()
   });
   if(data?.attack){
     await telegraphBossAttack(data.attack);
     if(!S.castBusy)await applyPendingHits();
   }
   setTimeout(()=>refresh(true),100);
   return data;
 }catch(e){
   S.castBusy=false;setActionsDisabled(false);
   throw e;
 }
}
async function applyAttackReceipts(attackId=null){
 if(S.hitBusy||!S.active||!S.token)return;
 S.hitBusy=true;
 try{
   const hits=await rpc('divine_beast_pending_boss_hits_v2',{
     p_token:S.token,
     p_attack_id:attackId
   });
   if(!Array.isArray(hits)||!hits.length)return;
   const g=window.g;
   g.v152RaidHitLedger=g.v152RaidHitLedger&&typeof g.v152RaidHitLedger==='object'
     ?g.v152RaidHitLedger:{};
   for(const hit of hits){
     const id=String(hit.receipt_id);
     if(!g.v152RaidHitLedger[id]){
       const damage=Math.max(0,Math.round(num(hit.damage)));
       g.hp=Math.max(0,num(g.hp)-damage);
       g.v152RaidHitLedger[id]={at:Date.now(),damage};
       bossImpact(hit);
       window.saveGame?.(false);
       try{await window.flushCloudSave?.(true)}catch(_){}
     }
     try{
       await rpc('divine_beast_ack_boss_hit',{
         p_receipt_id:hit.receipt_id,
         p_hp_after:num(g.hp),
         p_mp_after:num(g.mp)
       });
     }catch(e){
       console.warn('['+BUILD+'] boss hit ack pending',e);
     }
     renderPlayer();
     if(g.hp<=0){
       const token=S.token;
       try{await rpc('divine_beast_leave_raid',{p_token:token,p_reason:'defeated_by_boss'})}catch(_){}
       finish('你在神獸神通下失去意識，討伐失敗。');
       setTimeout(()=>window.loseFight?.(),500);
       break;
     }
     await new Promise(r=>setTimeout(r,260));
   }
 }catch(e){
   const m=String(e?.message||e);
   if(!/Could not find|does not exist/i.test(m))
     console.warn('['+BUILD+'] pending boss hit failed',e);
 }finally{S.hitBusy=false}
}
async function applyPendingHits(){
 if(S.castBusy)return;
 return applyAttackReceipts(null);
}
async function playBossAttackQueue(attacks=[]){
 if(!Array.isArray(attacks)||!attacks.length)return;
 S.castBusy=true;setActionsDisabled(true);
 try{
   for(const attack of attacks){
     const kind=attack.kind||(attack.attack_type==='single'?'single':'aoe');
     const threshold=Number(attack.threshold_pct||0);
     if(kind==='rage'){
       setLine(`${S.beast?.beast_name||'神獸'}血量跨過 ${threshold}%！範圍狂暴即將爆發！`);
     }else if(kind==='aoe'){
       setLine(`${S.beast?.beast_name||'神獸'}血量跨過 ${threshold}%！全體神通即將爆發！`);
     }
     await telegraphBossAttack(attack);
     await applyAttackReceipts(attack.id);
     await new Promise(r=>setTimeout(r,260));
   }
 }finally{
   S.castBusy=false;setActionsDisabled(false);
   setTimeout(()=>refresh(true),80);
 }
}


function hideLegacyOverlay(){
 const ov=document.getElementById('ov');
 if(ov)ov.classList.remove('on');
}
function restore(line=''){
 hideLegacyOverlay();
 if(!S.active||!S.root)return;
 S.root.style.display='grid';
 document.body.style.overflow='hidden';
 if(line)setLine(line);
 renderPlayer();
 if(!S.castBusy&&!S.hitBusy)setActionsDisabled(false);
 setTimeout(()=>refresh(true),30);
}
function openRaidCombatItems(){
 if(!S.active||!S.root)return;
 if(S.castBusy||S.hitBusy){
   window.toast?.('神獸正在施展神通，暫時無法開啟行囊。');
   return;
 }
 const fn=window.openCombatItems;
 if(typeof fn!=='function'){
   window.toast?.('戰鬥道具功能尚未載入。');
   return;
 }
 fn();
 const ov=document.getElementById('ov');
 const sheet=document.getElementById('sheet');
 if(ov)ov.dataset.v152RaidOverlay='1';
 if(sheet){
   const buttons=[...sheet.querySelectorAll('button')];
   const back=buttons.find(b=>/返回鬥法|關閉|返回戰鬥/.test(b.textContent||''));
   if(back){
     back.textContent='返回聯合討伐';
     back.onclick=()=>{
       restore('重新選擇討伐行動。');
     };
   }else{
     const b=document.createElement('button');
     b.className='btn';
     b.style.cssText='width:100%;margin-top:12px';
     b.textContent='返回聯合討伐';
     b.onclick=()=>restore('重新選擇討伐行動。');
     sheet.appendChild(b);
   }
 }
}
function installLegacyOverlayBridge(){
 if(window.closeOv&&!window.closeOv.__v152RaidBridge){
   const oldClose=window.closeOv;
   const patched=function(){
     const result=oldClose.apply(this,arguments);
     if(S.active)setTimeout(()=>restore(),0);
     return result;
   };
   patched.__v152RaidBridge=true;
   patched.__base=oldClose;
   window.closeOv=patched;
 }
 const ov=document.getElementById('ov');
 if(ov&&!ov.dataset.v152RaidEvents){
   ov.dataset.v152RaidEvents='1';
   ov.addEventListener('click',e=>{
     if(S.active&&e.target===ov)restore('重新選擇討伐行動。');
   });
 }
 if(!document.documentElement.dataset.v152RaidEscape){
   document.documentElement.dataset.v152RaidEscape='1';
   document.addEventListener('keydown',e=>{
     if(e.key==='Escape'&&S.active&&document.getElementById('ov')?.classList.contains('on')){
       restore('重新選擇討伐行動。');
     }
   });
 }
}

function prompt(data,handlers={}){
 close(false);removePrompt();
 const b=data?.beast||{};
 const el=document.createElement('div');
 el.className='v152-raid-prompt';
 el.innerHTML=`<div class="v152-raid-prompt-card">
  <div class="v152-raid-prompt-bg" style="background-image:url('${art(b)}')"></div>
  <div class="v152-raid-prompt-body">
   <div class="v152-raid-kicker">DIVINE BEAST RAID · 神獸現世</div>
   <h2>${esc(b.beast_name||'神獸')}</h2>
   <div class="v152-raid-prompt-desc">天地異象匯聚於 <b>${esc(b.coord||'未知區域')}</b>。此神獸血量由全服修士與 AI 共同削減。加入討伐後將進入沉浸式聯合戰場；也可立即離開，不進入戰鬥。</div>
   <div class="v152-raid-prompt-stats">
    <span>${esc(DIR[b.direction]||b.direction||'未知方位')}</span>
    <span>世代 ${fmt(b.generation)}</span>
    <span>體力 ${fmt(b.current_hp)} / ${fmt(b.max_hp)}</span>
    <span>防禦 ${fmt(b.defense_power)}</span>
   </div>
   <div class="v152-raid-prompt-actions">
    <button class="v152-raid-btn join" data-act="join">加入討伐</button>
    <button class="v152-raid-btn leave" data-act="leave">快速離開</button>
   </div>
  </div>
 </div>`;
 document.body.appendChild(el);S.prompt=el;
 setTimeout(()=>{const line=INTRO_LINES[String(b.beast_key||'')];if(line){const desc=el.querySelector('.v152-raid-prompt-desc');desc.insertAdjacentHTML('afterend',`<div class="v152-prompt-dialogue">「${esc(line)}」</div>`) }},120);
 el.querySelector('[data-act="join"]').onclick=async()=>{
  const btn=el.querySelector('[data-act="join"]');btn.disabled=true;btn.textContent='正在進入戰場…';
  try{await handlers.join?.()}catch(e){btn.disabled=false;btn.textContent='加入討伐';alert('加入討伐失敗：'+(e?.message||e))}
 };
 el.querySelector('[data-act="leave"]').onclick=async()=>{
  const btn=el.querySelector('[data-act="leave"]');btn.disabled=true;
  try{await handlers.leave?.()}finally{removePrompt()}
 };
}
function open(ctx){
 removePrompt();removeRoot();
 S.token=ctx.token;S.beast=ctx.beast||{};S.handlers=ctx;S.active=true;S.line=ctx.line||'你已踏入聯合討伐戰場。';
 const b=S.beast,root=document.createElement('div');
 root.className='v152-raid-root';
 root.innerHTML=`<div class="v152-raid-stage-bg" style="background-image:url('${art(b)}')"></div>
 <header class="v152-raid-top">
  <div class="v152-boss-identity"><div class="v152-raid-boss-name" data-boss-name>${esc(b.beast_name||'神獸')}</div><div class="v152-raid-sub" data-boss-sub>${esc(DIR[b.direction]||b.direction)}｜${esc(b.coord||'—')}｜世代 ${fmt(b.generation)}</div><div class="v152-phase-badge dominant" data-boss-phase><small>天地威壓</small><b>天威</b></div></div>
  <div class="v152-raid-boss-bars">
   <div class="v152-raid-bar-label"><span>全服共用神獸體力</span><b data-hp-text>${fmt(b.current_hp)} / ${fmt(b.max_hp)}</b></div>
   <div class="v152-raid-bar"><i data-hp-bar style="width:${pct(b.current_hp,b.max_hp)}%"></i></div>
  </div>
  <div class="v152-raid-top-actions"><button class="v152-raid-mini" data-toggle-info>戰況</button><button class="v152-raid-mini" data-refresh>同步</button></div>
 </header>
 <main class="v152-raid-main">
  <aside class="v152-raid-side left">
   <div class="v152-raid-panel-title"><span>你的戰況</span><small data-connection>同步中</small></div>
   <div class="v152-raid-player-card" data-player-card></div>
   <div class="v152-raid-panel-title" style="margin-top:14px"><span>目前參戰</span><small data-member-count>0</small></div>
   <div class="v152-raid-list" data-participant-list></div>
  </aside>
  <section class="v152-raid-center"><div class="v152-boss-aura"></div><div class="v152-raid-particles"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="v152-skill-cast" data-skill-cast></div><div class="v152-boss-dialogue" data-boss-dialogue></div><div class="v152-fx-layer" data-fx-layer></div><div class="v152-damage-layer" data-damage-layer></div><div class="v152-raid-center-caption" data-line>${esc(S.line)}</div></section>
  <aside class="v152-raid-side right">
   <div class="v152-raid-tabs">
    <button class="on" data-tab="feed">即時戰況</button>
    <button data-tab="rank">傷害排行</button>
    <button data-tab="members">參戰名單</button>
   </div>
   <div class="v152-raid-feed" data-panel="feed"></div>
   <div class="v152-raid-rank" data-panel="rank" hidden></div>
   <div class="v152-raid-members" data-panel="members" hidden></div>
  </aside>
 </main>
 <footer class="v152-raid-controls">
  <div><small>全服戰場同步</small><div style="color:#d7e1e8;margin-top:4px" data-sync-note>每秒更新 BOSS 血量與傷害事件</div></div>
  <div class="v152-raid-actions">
   <button class="v152-raid-action attack" data-attack>攻擊 −10精力</button>
   <button class="v152-raid-action item" data-item>道具／丹藥</button>
   <button class="v152-raid-action" data-tech>功法狀態</button>
   <button class="v152-raid-action retreat" data-retreat>遁走</button>
  </div>
  <div class="v152-raid-countdown">神獸停留時間<b data-countdown>--:--</b></div>
 </footer>`;
 document.body.appendChild(root);document.body.style.overflow='hidden';S.root=root;
 root.querySelector('[data-attack]').onclick=()=>window.V151_PHASE2?.divineAttack?.();
 root.querySelector('[data-item]').onclick=openRaidCombatItems;
 root.querySelector('[data-retreat]').onclick=()=>window.V151_PHASE2?.fleeDivine?.();
 root.querySelector('[data-tech]').onclick=showTechniques;
 root.querySelector('[data-refresh]').onclick=()=>refresh(true);
 root.querySelector('[data-toggle-info]').onclick=()=>root.classList.toggle('show-right');
 root.querySelectorAll('[data-tab]').forEach(bn=>bn.onclick=()=>setTab(bn.dataset.tab));
 installLegacyOverlayBridge();
 renderPlayer();
 updatePhaseDisplay();
 ensureAudio();
 updateCombatStats();
 setTimeout(()=>showDialogue(INTRO_LINES[String(b.beast_key||'')]||'膽敢踏入吾之領域？','神獸威壓'),350);
 startSync();
 startTaunts();
}
function showTechniques(){
 const list=(window.g?.techniques||[]).map(id=>{
   const t=(window.C?.techniques||[]).find(x=>String(x.id)===String(id));
   return t?.name||id
 });
 alert(list.length?'目前常駐功法：\n'+list.join('\n'):'目前沒有常駐功法');
}
function setTab(tab){
 S.tab=tab;
 S.root?.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
 S.root?.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==tab);
}
function renderPlayer(){
 if(!S.root)return;
 const g=window.g||{},hp=pct(g.hp,g.hpMax),mp=pct(g.mp,g.mpMax);
 const enchant=window.XIANXIA_EQUIPMENT_VALUE?'裝備強化已啟用':'';
 S.root.querySelector('[data-player-card]').innerHTML=`<h3>${esc(g.name||'無名散修')}</h3>
  <small>${esc(g.big||'未知境界')}｜Lv${fmt(g.lv)}</small>
  <div class="v152-raid-stat"><span>體力</span><div class="meter"><i style="width:${hp}%"></i></div><b>${fmt(g.hp)}/${fmt(g.hpMax)}</b></div>
  <div class="v152-raid-stat mp"><span>精力</span><div class="meter"><i style="width:${mp}%"></i></div><b>${fmt(g.mp)}/${fmt(g.mpMax)}</b></div>
  <div class="v152-raid-enchants"><span>攻擊 ${fmt(window.pAtk?.())}</span><span>防禦 ${fmt(window.pDef?.())}</span>${enchant?`<span>${esc(enchant)}</span>`:''}</div>`;
}
function renderSnapshot(snap){
 if(!S.root||!snap)return;
 S.snapshot=snap;const b=snap.beast||S.beast;S.beast=b;updatePhaseDisplay();
 S.root.querySelector('[data-hp-text]').textContent=`${fmt(b.current_hp)} / ${fmt(b.max_hp)}`;
 S.root.querySelector('[data-hp-bar]').style.width=`${pct(b.current_hp,b.max_hp)}%`;
 S.root.querySelector('[data-boss-sub]').textContent=`${DIR[b.direction]||b.direction}｜${b.coord||'—'}｜世代 ${fmt(b.generation)}`;
 S.root.querySelector('[data-connection]').textContent='已同步';
 renderPlayer();
 const members=[...(snap.players||[]),...(snap.ai||[])];
 S.root.querySelector('[data-member-count]').textContent=`${members.length} 位`;
 S.root.querySelector('[data-participant-list]').innerHTML=members.slice(0,30).map(m=>`<div class="v152-raid-participant"><div><b>${esc(m.name)}</b><small>${m.kind==='ai'?'世界修士 AI':'玩家修士'}｜傷害 ${fmt(m.damage)}</small></div><span class="${m.online?'v152-online':'v152-offline'}">${m.online?'參戰中':'離線'}</span></div>`).join('')||'<small>尚無其他參戰者</small>';
 S.root.querySelector('[data-panel="members"]').innerHTML=members.map(m=>`<div class="v152-raid-participant"><div><b>${esc(m.name)}</b><small>${m.kind==='ai'?'AI':'玩家'}｜體力 ${fmt(m.hp)} / ${fmt(m.hp_max)}</small></div><b>${fmt(m.damage)}</b></div>`).join('')||'<small>尚無參戰者</small>';
 S.root.querySelector('[data-panel="rank"]').innerHTML=(snap.ranking||[]).map((r,i)=>`<div class="v152-rank-row"><span class="no">${i+1}</span><div><b>${esc(r.name)}</b><small>${r.kind==='ai'?'AI 修士':'玩家修士'}｜${fmt(r.hits)} 次</small></div><strong>${fmt(r.damage)}</strong></div>`).join('')||'<small>尚無傷害紀錄</small>';
 renderEvents(snap.events||[]);
 S.handlers?.onSnapshot?.(snap);
 if(!snap.active){
   finish('神獸已離開此空間，聯合討伐結束。');
 }
}
function renderEvents(events){
 if(!S.root)return;
 const panel=S.root.querySelector('[data-panel="feed"]');
 panel.innerHTML=events.map(e=>{
   const t=new Date(e.created_at).toLocaleTimeString('zh-TW',{hour12:false});
   let text=e.message||'';
   if(!text){
     if(e.action_type==='attack')text=`${e.actor_name} 造成 ${fmt(e.damage)} 傷害`;
     else if(e.action_type==='retreat')text=`${e.actor_name} 攻擊 ${fmt(e.damage)}，承受反擊 ${fmt(e.retaliation_damage)} 後撤離`;
     else if(e.action_type==='move')text=`${e.actor_name} 趕赴神獸戰場`;
     else if(e.action_type==='reward')text=`${e.actor_name} 取得神獸遺寶`;
     else text=`${e.actor_name}｜${e.action_type}`;
   }
   return `<div class="v152-feed-row ${esc(e.actor_kind)}"><time>${t}</time><strong>${esc(text)}</strong></div>`
 }).join('')||'<small>等待第一道攻擊紀錄…</small>';
}
function setLine(line){
 S.line=line||S.line;
 const el=S.root?.querySelector('[data-line]');if(el)el.innerHTML=esc(S.line);
 renderPlayer();
}
async function refresh(force=false){
 if(!S.active||S.busy||!S.token)return;
 S.busy=true;
 try{
   const g=window.g||{};
   const snap=await rpc('divine_beast_raid_snapshot',{
     p_token:S.token,
     p_player_hp:num(g.hp),
     p_player_hp_max:num(g.hpMax),
     p_player_mp:num(g.mp),
     p_player_mp_max:num(g.mpMax)
   });
   renderSnapshot(snap);
   if(!S.castBusy)await applyPendingHits();
   const note=S.root?.querySelector('[data-sync-note]');
   if(note)note.textContent=`最後同步 ${new Date().toLocaleTimeString('zh-TW',{hour12:false})}`;
 }catch(e){
   const msg=String(e?.message||e);
   const c=S.root?.querySelector('[data-connection]');if(c)c.textContent='同步中斷';
   if(!/ENCOUNTER_NOT_FOUND|BEAST_NOT_FOUND/i.test(msg))console.warn('['+BUILD+'] snapshot failed',e);
 }finally{S.busy=false}
}
function startSync(){
 stopSync();refresh(true);
 S.poll=setInterval(()=>refresh(false),1000);
 S.countdown=setInterval(()=>{
   if(!S.root)return;
   const iso=S.snapshot?.beast?.expires_at||S.beast?.expires_at;
   S.root.querySelector('[data-countdown]').textContent=timeText(secondsLeft(iso));
 },1000);
}
function stopSync(){
 stopTaunts();
 if(S.poll)clearInterval(S.poll);if(S.countdown)clearInterval(S.countdown);
 S.poll=null;S.countdown=null;
}
function finish(line){
 setLine(line);stopSync();
 const attack=S.root?.querySelector('[data-attack]');if(attack)attack.disabled=true;
 setTimeout(()=>close(true),2600);
}
function close(restore=true){
 stopSync();removePrompt();removeRoot();
 S.token=null;S.beast=null;S.active=false;S.snapshot=null;S.handlers=null;S.busy=false;
 if(restore)window.render?.();
}
window.V152_RAID={
 build:BUILD,prompt,open,setLine,refresh,finish,close,restore,openRaidCombatItems,playerImpact,bossImpact,requestBossCounter,showDialogue,telegraphBossAttack,playBossAttackQueue,
 active:()=>S.active,state:S
};
console.info('['+BUILD+'] active');
})();
