(()=>{
'use strict';
const state={recoveryPercent:100,experiencePercent:100,loaded:false};
const session={active:false,hp:0,mp:0,exp:0,lastHp:0,lastMp:0,lastExp:0,lastAt:0};
function item(id){try{return window.IT?.[String(id)]||IT?.[String(id)]||null}catch(_){return null}}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function f(v,d=5){return n(v).toFixed(d)}
function signed(v,suffix=''){const x=n(v);return (x>=0?'+':'')+x+suffix}
function effectText(it,eq=null){
 if(!it) return '效果資料未設定';
 const lines=[]; const eff=String(it.eff||''); const val=n(it.val);
 if(eff==='體力回復') lines.push(`使用後恢復${val}點體力`);
 else if(eff==='精力回復') lines.push(`使用後恢復${val}點精力`);
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
    ids.forEach(id=>{const it=item(id);if(!it)return;h+='<div class="list-row"><div class="grow"><strong>'+esc(it.name)+' ×'+g.inv[id]+'</strong><small>'+esc(it.cat||'道具')+' · '+esc(effectText(it))+'</small></div>'+(canUseOutside(it)?'<button class="btn" onclick="useOutside(\''+id+'\')">使用</button>':'')+'</div>'});
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
 const novice=!!zone?.novice;
 const expInterval=novice?n(params.meditate_novice_exp_interval_sec)||2:n(params.meditate_exp_interval_sec)||20;
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
     hp:n(params.meditate_hp_interval_sec)||1,
     mp:n(params.meditate_mp_interval_sec)||1,
     exp:expInterval
   },
   perTick:{
     hp:(n(params.meditate_hp_gain)||0)*recoveryMult,
     mp:(n(params.meditate_mp_gain)||0)*recoveryMult,
     exp:1*expMult
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
  state.recoveryPercent=n(d?.recovery_percent);state.experiencePercent=n(d?.experience_percent);state.loaded=true;
  window.XIANXIA_MEDITATION_RUNTIME={...state};publishLive();
 }catch(e){console.warn('[V14.9 FIX1 meditation settings]',e)}
}
function patchMeditation(){
 const fn=window.meditationTick||window.tickMeditation;
 if(typeof fn!=='function'||fn.__v149fix1)return;
 const patched=function(){
  if(!g||!g.meditating||fight){if(session.active){session.active=false;publishLive()}return}
  if(!session.active)resetSession();
  g.meditateSec++;
  const z=zoneAt(g.pos.r,g.pos.c),novice=!!(z&&z.novice),expInterval=novice?P.meditate_novice_exp_interval_sec:P.meditate_exp_interval_sec;
  const zoneMult=(z?.recover||1),boost=(window.V13_REWARDED_ADS?.getMeditationMultiplier?.()||1);
  const recoveryMult=zoneMult*boost*(state.recoveryPercent/100), expMult=zoneMult*boost*(state.experiencePercent/100);
  let changed=false;session.lastHp=0;session.lastMp=0;session.lastExp=0;
  if(g.meditateSec%expInterval===0){
    const amount=1*expMult;gainExp(amount,false);session.exp+=amount;session.lastExp=amount;changed=true
  }
  if(g.meditateSec%P.meditate_hp_interval_sec===0){
    const before=n(g.hp);g.hp=clamp(g.hp+P.meditate_hp_gain*recoveryMult,0,g.hpMax);
    const actual=Math.max(0,n(g.hp)-before);session.hp+=actual;session.lastHp=actual;changed=true
  }
  if(g.meditateSec%P.meditate_mp_interval_sec===0){
    const before=n(g.mp);g.mp=clamp(g.mp+P.meditate_mp_gain*recoveryMult,0,g.mpMax);
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
 if(typeof window.offlineSettlement!=='function'||window.offlineSettlement.__v149fix1)return;
 const original=window.offlineSettlement;
 window.offlineSettlement=function(){
  const before={exp:g?.exp,hp:g?.hp,mp:g?.mp};
  const result=original.apply(this,arguments);
  if(g&&before.exp!=null){
    g.exp=before.exp+(g.exp-before.exp)*(state.experiencePercent/100);
    g.hp=before.hp+(g.hp-before.hp)*(state.recoveryPercent/100);
    g.mp=before.mp+(g.mp-before.mp)*(state.recoveryPercent/100);
    render();saveGame(false)
  }
  return result;
 };
 window.offlineSettlement.__v149fix1=true;
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
 patchMeditation();ensureLiveMetrics();updateLiveMetrics();
 if(g?.meditating&&!session.active)resetSession();
 if(!g?.meditating&&session.active){session.active=false;publishLive()}
}
function init(){
 patchBag();patchMeditation();patchOffline();loadSettings();
 setInterval(loadSettings,60000);setInterval(monitor,500);
 window.addEventListener('xianxia:meditation-live',updateLiveMetrics);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
