(()=>{
'use strict';
const state={
 recoveryPercent:100,experiencePercent:100,recoveryTickIntervalSec:2,
 hpTickPercent:.25,mpTickPercent:.35,hpMinGain:5,mpMinGain:3,
 hpSmallPotionPercent:8,hpLargePotionPercent:22,
 mpSmallPotionPercent:10,mpLargePotionPercent:25,loaded:false
};
const session={active:false,hp:0,mp:0,exp:0,lastHp:0,lastMp:0,lastExp:0,lastAt:0};
const BASE_EXP_PER_SECOND=1;
function item(id){try{return window.IT?.[String(id)]||IT?.[String(id)]||null}catch(_){return null}}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function f(v,d=5){return n(v).toFixed(d)}
function signed(v,suffix=''){const x=n(v);return (x>=0?'+':'')+x+suffix}

const POTION_MAP={
 '1001':{resource:'hp',percentKey:'hpSmallPotionPercent',fallback:20},
 '1003':{resource:'hp',percentKey:'hpLargePotionPercent',fallback:120},
 '1002':{resource:'mp',percentKey:'mpSmallPotionPercent',fallback:20},
 '1004':{resource:'mp',percentKey:'mpLargePotionPercent',fallback:120}
};
function potionRule(id,it=null){
 const rule=POTION_MAP[String(id)];
 if(rule)return rule;
 const eff=String(it?.eff||'');
 if(eff==='體力回復')return {resource:'hp',percentKey:null,fallback:n(it?.val)};
 if(eff==='精力回復')return {resource:'mp',percentKey:null,fallback:n(it?.val)};
 return null;
}
function potionPercent(id){
 const rule=POTION_MAP[String(id)];
 return rule?Math.max(0,n(state[rule.percentKey])):0;
}
function scaledRecovery(id,it,resource=null){
 const rule=potionRule(id,it);if(!rule)return n(it?.val);
 const key=resource||rule.resource;
 const max=key==='hp'?n(g?.hpMax):n(g?.mpMax);
 const pct=potionPercent(id);
 return Math.max(n(it?.val,rule.fallback),max*pct/100);
}
function meditationBase(resource){
 if(resource==='hp')return Math.max(state.hpMinGain,n(g?.hpMax)*state.hpTickPercent/100);
 return Math.max(state.mpMinGain,n(g?.mpMax)*state.mpTickPercent/100);
}
window.XIANXIA_SCALED_RECOVERY=(id,it,resource)=>scaledRecovery(id,it,resource);

function effectText(it,eq=null){
 if(!it) return '效果資料未設定';
 const lines=[]; const eff=String(it.eff||''); const val=n(it.val);
 if(eff==='體力回復'){
   const pct=potionPercent(it.id||it.itemId);
   lines.push(pct?`使用後恢復最大體力 ${f(pct,2)}%（最低 ${val} 點）`:`使用後恢復${val}點體力`);
 }
 else if(eff==='精力回復'){
   const pct=potionPercent(it.id||it.itemId);
   lines.push(pct?`使用後恢復最大精力 ${f(pct,2)}%（最低 ${val} 點）`:`使用後恢復${val}點精力`);
 }
 else if(eff==='療傷') lines.push('使用後解除一項外傷狀態');
 else if(eff==='攻擊') lines.push(`裝備後攻擊力${signed(val)}`);
 else if(eff==='防禦') lines.push(`裝備後防禦力${signed(val)}`);
 else if(eff==='投擲') lines.push(`戰鬥中造成固定${val}點傷害`);
 else if(eff==='遮蔽氣息') lines.push(`可遮蔽氣息${val}分鐘`);
 else if(eff==='奪舍') lines.push('可用於奪舍相關行動');
 else if(eff==='習得配方') lines.push(`使用後習得配方${val?`（編號${val}）`:''}`);
 else if(eff==='突破增益') lines.push(`突破成功率增加${val}%`);
 else if(eff==='合成材料') lines.push('可作為煉丹或煉器材料');
 if(n(it.attack)) lines.push(`攻擊力${signed(it.attack)}`);
 if(n(it.defense)) lines.push(`防禦力${signed(it.defense)}`);
 if(n(it.hp)) lines.push(`生命上限${signed(it.hp)}`);
 if(n(it.mp)) lines.push(`精力上限${signed(it.mp)}`);
 if(n(it.crit)) lines.push(`暴擊率${signed(it.crit,'%')}`);
 if(n(it.dodge)) lines.push(`閃避率${signed(it.dodge,'%')}`);
 if(eq&&n(eq.enhance)) lines.push(`強化等級 +${Math.floor(n(eq.enhance))}`);
 if(!lines.length && eff) lines.push(eff+(val?` ${val}`:''));
 return lines.join('；')||String(it.desc||'效果資料未設定');
}
window.XIANXIA_ITEM_EFFECT_TEXT=effectText;

function patchBag(){
 if(typeof window.openBag!=='function' || window.openBag.__v149fix1) return;
 const original=window.openBag;
 window.openBag=function(tab='bag'){
  try{
   const repaired=typeof repairPlayerEquipment==='function'?repairPlayerEquipment():0;
   if(repaired>0){saveGame(false);toast('已修復 '+repaired+' 件異常裝備')}
   let h='<h3>行囊與鑄器</h3><div class="tabs"><button class="'+(tab==='bag'?'on':'')+'" onclick="openBag(\'bag\')">道具</button><button class="'+(tab==='equip'?'on':'')+'" onclick="openBag(\'equip\')">裝備</button><button class="'+(tab==='forge'?'on':'')+'" onclick="openBag(\'forge\')">獨立強化</button></div>';
   if(tab==='bag'){
    const ids=Object.keys(g.inv||{}).filter(id=>g.inv[id]>0);
    if(!ids.length)h+='<p class="small">行囊空空如也。</p>';
    ids.forEach(id=>{const it=item(id);if(!it)return;const view={...it,id:String(id)};h+='<div class="list-row"><div class="grow"><strong>'+esc(it.name)+' ×'+g.inv[id]+'</strong><small>'+esc(it.cat||'道具')+' · '+esc(effectText(view))+'</small></div>'+(canUseOutside(it)?'<button class="btn" onclick="useOutside(\''+id+'\')">使用</button>':'')+'</div>'});
   }else if(tab==='equip'){
    if(!g.equipment.length)h+='<p class="small">尚未取得裝備。坊市可購買長劍與護體法袍。</p>';
    g.equipment.forEach(e=>{const it=item(e.itemId);h+='<div class="list-row"><div class="grow"><strong>'+esc(e.name)+' +'+e.enhance+(e.uid===g.weaponUid||e.uid===g.armorUid?' <span class="pill">已裝備</span>':'')+'</strong><small>'+esc(effectText(it,e))+'</small></div><button class="btn" onclick="equipItem(\''+e.uid+'\')">裝備</button></div>'});
   }else return original(tab);
   h+='<button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">關閉</button>';sheet(h);
  }catch(err){console.error('[V14.9 FIX1 bag]',err);return original(tab)}
 };
 window.openBag.__v149fix1=true;
}

function resetSession(){
 session.active=true;session.hp=0;session.mp=0;session.exp=0;
 session.lastHp=0;session.lastMp=0;session.lastExp=0;session.lastAt=Date.now();
 publishLive();
}
function publishLive(extra={}){
 let zone=null,params={};
 try{zone=typeof zoneAt==='function'&&g?zoneAt(g.pos.r,g.pos.c):null;params=typeof P==='object'&&P?P:{}}catch(_){}
 const expInterval=1;
 const zoneMult=n(zone?.recover)||1;
 const boost=n(window.V13_REWARDED_ADS?.getMeditationMultiplier?.())||1;
 const recoveryMult=zoneMult*boost*(state.recoveryPercent/100);
 const expMult=zoneMult*boost*(state.experiencePercent/100);
 window.XIANXIA_MEDITATION_LIVE={
   active:session.active,
   elapsed:n(g?.meditateSec),
   cumulative:{hp:session.hp,mp:session.mp,exp:session.exp},
   last:{hp:session.lastHp,mp:session.lastMp,exp:session.lastExp,at:session.lastAt},
   intervals:{
     hp:n(state.recoveryTickIntervalSec)||2,
     mp:n(state.recoveryTickIntervalSec)||2,
     exp:expInterval
   },
   perTick:{
     hp:meditationBase('hp')*recoveryMult,
     mp:meditationBase('mp')*recoveryMult,
     exp:BASE_EXP_PER_SECOND*expMult
   },
   multipliers:{
     recoveryPercent:state.recoveryPercent,
     experiencePercent:state.experiencePercent,
     zone:zoneMult,
     boost
   },
   ...extra
 };
 window.dispatchEvent(new CustomEvent('xianxia:meditation-live',{detail:window.XIANXIA_MEDITATION_LIVE}));
}
async function loadSettings(){
 try{
  if(!window.V12_ONLINE?.supabaseUrl||!window.V12_ONLINE?.supabasePublishableKey) return;
  const res=await fetch(window.V12_ONLINE.supabaseUrl+'/rest/v1/rpc/get_meditation_runtime_settings',{method:'POST',headers:{'Content-Type':'application/json','apikey':window.V12_ONLINE.supabasePublishableKey},body:'{}',cache:'no-store'});
  if(!res.ok) throw new Error(await res.text()); const d=await res.json();
  state.recoveryPercent=n(d?.recovery_percent)||100;
  state.experiencePercent=n(d?.experience_percent)||100;
  state.recoveryTickIntervalSec=Math.max(1,Math.floor(n(d?.recovery_tick_interval_sec)||2));
  state.hpTickPercent=n(d?.hp_tick_percent)||.25;
  state.mpTickPercent=n(d?.mp_tick_percent)||.35;
  state.hpMinGain=n(d?.hp_min_gain)||5;
  state.mpMinGain=n(d?.mp_min_gain)||3;
  state.hpSmallPotionPercent=n(d?.hp_small_potion_percent)||8;
  state.hpLargePotionPercent=n(d?.hp_large_potion_percent)||22;
  state.mpSmallPotionPercent=n(d?.mp_small_potion_percent)||10;
  state.mpLargePotionPercent=n(d?.mp_large_potion_percent)||25;
  state.loaded=true;
  window.XIANXIA_MEDITATION_RUNTIME={...state};publishLive();
 }catch(e){console.warn('[V15.2 PHASE3 FIX2 EXP-1S meditation settings]',e)}
}
function patchMeditation(){
 const fn=window.meditationTick||window.tickMeditation;
 if(typeof fn!=='function'||fn.__v149fix1)return;
 const patched=function(){
  if(!g||!g.meditating||fight){if(session.active){session.active=false;publishLive()}return}
  if(!session.active)resetSession();
  g.meditateSec++;
  const z=zoneAt(g.pos.r,g.pos.c),expInterval=1;
  const zoneMult=(z?.recover||1),boost=(window.V13_REWARDED_ADS?.getMeditationMultiplier?.()||1);
  const recoveryMult=zoneMult*boost*(state.recoveryPercent/100), expMult=zoneMult*boost*(state.experiencePercent/100);
  let changed=false;session.lastHp=0;session.lastMp=0;session.lastExp=0;
  if(g.meditateSec%expInterval===0){
    const amount=BASE_EXP_PER_SECOND*expMult;gainExp(amount,false);session.exp+=amount;session.lastExp=amount;changed=true
  }
  if(g.meditateSec%state.recoveryTickIntervalSec===0){
    const before=n(g.hp);g.hp=clamp(g.hp+meditationBase('hp')*recoveryMult,0,g.hpMax);
    const actual=Math.max(0,n(g.hp)-before);session.hp+=actual;session.lastHp=actual;changed=true
  }
  if(g.meditateSec%state.recoveryTickIntervalSec===0){
    const before=n(g.mp);g.mp=clamp(g.mp+meditationBase('mp')*recoveryMult,0,g.mpMax);
    const actual=Math.max(0,n(g.mp)-before);session.mp+=actual;session.lastMp=actual;changed=true
  }
  if(session.lastHp||session.lastMp||session.lastExp)session.lastAt=Date.now();
  publishLive();
  if(changed){render();saveGame(false)}
 };
 patched.__v149fix1=true;
 if(window.meditationTick===fn)window.meditationTick=patched;
 if(window.tickMeditation===fn)window.tickMeditation=patched;
}
function patchOffline(){
 const patchOne=name=>{
  const current=window[name];
  if(typeof current!=='function'||current.__v152recovery)return;
  const patched=function(savedAt){
   const elapsed=Math.max(0,Math.floor((Date.now()-savedAt)/1000));
   if(!g?.meditating||elapsed<2)return;
   const cap=(n(P?.offline_meditate_cap_hours)||8)*3600;
   const sec=Math.min(elapsed,cap);
   const z=zoneAt(g.pos.r,g.pos.c);
   const expInterval=1;
   const zoneMult=n(z?.recover)||1;
   const boost=n(window.V13_REWARDED_ADS?.getMeditationMultiplier?.())||1;
   const recoveryMult=zoneMult*boost*(state.recoveryPercent/100);
   const expMult=zoneMult*boost*(state.experiencePercent/100);
   const ticks=Math.floor(sec/state.recoveryTickIntervalSec);
   let exp=Math.floor(sec/expInterval)*BASE_EXP_PER_SECOND*expMult;
   let hp=ticks*Math.max(state.hpMinGain,n(g.hpMax)*state.hpTickPercent/100)*recoveryMult;
   let mp=ticks*Math.max(state.mpMinGain,n(g.mpMax)*state.mpTickPercent/100)*recoveryMult;
   if(g.techniques?.includes('dust')){exp*=2;hp*=2;mp*=2}
   const hpBefore=n(g.hp),mpBefore=n(g.mp);
   g.hp=clamp(hpBefore+hp,0,g.hpMax);
   g.mp=clamp(mpBefore+mp,0,g.mpMax);
   gainExp(exp,false);
   const actualHp=n(g.hp)-hpBefore,actualMp=n(g.mp)-mpBefore;
   setTimeout(()=>sheet(
    '<h3>離線打坐結算</h3><div class="money">'+
    '<div><span>離線時間</span><b>'+formatDuration(sec)+'</b></div>'+
    '<div><span>修為</span><b>+'+f(exp,2)+'</b></div>'+
    '<div><span>體力</span><b>+'+f(actualHp,2)+'</b></div>'+
    '<div><span>精力</span><b>+'+f(actualMp,2)+'</b></div></div>'+
    '<p class="small">比例恢復已依最大體力／精力、區域、廣告與後台倍率結算；最多 '+P.offline_meditate_cap_hours+' 小時。</p>'+
    '<button class="btn gold" onclick="closeOv()">收下</button>'
   ),300);
  };
  patched.__v152recovery=true;
  window[name]=patched;
 };
 patchOne('applyOffline');
 patchOne('offlineSettlement');
}

function patchConsumables(){
 if(typeof window.useOutside==='function'&&!window.useOutside.__v152recovery){
  const old=window.useOutside;
  window.useOutside=function(id){
   const it=item(id);
   if(!it||!(g?.inv?.[id]>0))return old.apply(this,arguments);
   if(it.eff==='體力回復'||it.eff==='精力回復'){
    const resource=it.eff==='體力回復'?'hp':'mp';
    const before=n(g[resource]),amount=scaledRecovery(id,{...it,id},resource);
    g[resource]=clamp(before+amount,0,g[resource+'Max']);
    g.inv[id]--;
    const actual=n(g[resource])-before;
    log(`你使用 ${it.name}，恢復 ${f(actual,2)} ${resource==='hp'?'體力':'精力'}。`,'lg');
    render();saveGame(false);openBag('bag');return
   }
   return old.apply(this,arguments);
  };
  window.useOutside.__v152recovery=true;
 }
 if(typeof window.useCombatItem==='function'&&!window.useCombatItem.__v152recovery){
  const old=window.useCombatItem;
  window.useCombatItem=function(id){
   const it=item(id);
   if(!it||!(g?.inv?.[id]>0)||!fight)return old.apply(this,arguments);
   if(it.eff==='體力回復'||it.eff==='精力回復'){
    const resource=it.eff==='體力回復'?'hp':'mp';
    const before=n(g[resource]),amount=scaledRecovery(id,{...it,id},resource);
    g[resource]=clamp(before+amount,0,g[resource+'Max']);
    g.inv[id]--;
    const actual=n(g[resource])-before;
    renderFight(`你服下 ${it.name}，回復 ${f(actual,2)} ${resource==='hp'?'體力':'精力'}。`);
    render();saveGame(false);return setTimeout(enemyTurn,450)
   }
   return old.apply(this,arguments);
  };
  window.useCombatItem.__v152recovery=true;
 }
}

function ensureLiveMetrics(){
 const metrics=document.querySelector('.v146-med-metrics');if(!metrics)return;
 const defs=[
  ['v149MedCycle','本次結算','等待結算'],
  ['v149MedHp','累積體力','+0.00000'],
  ['v149MedMp','累積精力','+0.00000'],
  ['v149MedExp','累積修為','+0.00000']
 ];
 defs.forEach(([id,label,value])=>{
  if(document.getElementById(id))return;
  const d=document.createElement('div');d.innerHTML=`<span>${label}</span><b id="${id}">${value}</b>`;metrics.appendChild(d);
 });
}
function updateLiveMetrics(){
 ensureLiveMetrics();
 const d=window.XIANXIA_MEDITATION_LIVE;if(!d)return;
 const cycle=document.getElementById('v149MedCycle');
 const hp=document.getElementById('v149MedHp'),mp=document.getElementById('v149MedMp'),exp=document.getElementById('v149MedExp');
 const parts=[];
 if(d.last?.hp)parts.push(`體力 +${f(d.last.hp)}`);
 if(d.last?.mp)parts.push(`精力 +${f(d.last.mp)}`);
 if(d.last?.exp)parts.push(`修為 +${f(d.last.exp)}`);
 if(cycle)cycle.textContent=parts.length?parts.join('｜'):`體 ${f(d.perTick.hp)}/${d.intervals.hp}秒 · 精 ${f(d.perTick.mp)}/${d.intervals.mp}秒 · 修 ${f(d.perTick.exp)}/${d.intervals.exp}秒`;
 if(hp)hp.textContent='+'+f(d.cumulative.hp);
 if(mp)mp.textContent='+'+f(d.cumulative.mp);
 if(exp)exp.textContent='+'+f(d.cumulative.exp);
 const rate=document.getElementById('v146MedRate');
 if(rate)rate.textContent=`恢復 ${f(d.multipliers.recoveryPercent)}% · 修為 ${f(d.multipliers.experiencePercent)}%`;
}
function monitor(){
 patchMeditation();patchOffline();patchConsumables();ensureLiveMetrics();updateLiveMetrics();
 if(g?.meditating&&!session.active)resetSession();
 if(!g?.meditating&&session.active){session.active=false;publishLive()}
}
function init(){
 patchBag();patchMeditation();patchOffline();patchConsumables();loadSettings();
 setInterval(loadSettings,60000);setInterval(monitor,500);
 window.addEventListener('xianxia:meditation-live',updateLiveMetrics);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
