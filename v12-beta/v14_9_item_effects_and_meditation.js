(()=>{
'use strict';
const state={recoveryPercent:100,experiencePercent:100,loaded:false};
function item(id){try{return window.IT?.[String(id)]||IT?.[String(id)]||null}catch(_){return null}}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
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
 if(typeof window.openBag!=='function' || window.openBag.__v149) return;
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
  }catch(err){console.error('[V14.9 bag]',err);return original(tab)}
 };
 window.openBag.__v149=true;
}

async function loadSettings(){
 try{
  if(!window.V12_ONLINE?.supabaseUrl||!window.V12_ONLINE?.supabasePublishableKey) return;
  const res=await fetch(window.V12_ONLINE.supabaseUrl+'/rest/v1/rpc/get_meditation_runtime_settings',{method:'POST',headers:{'Content-Type':'application/json','apikey':window.V12_ONLINE.supabasePublishableKey},body:'{}',cache:'no-store'});
  if(!res.ok) throw new Error(await res.text()); const d=await res.json();
  state.recoveryPercent=n(d?.recovery_percent)||0;state.experiencePercent=n(d?.experience_percent)||0;state.loaded=true;
  window.XIANXIA_MEDITATION_RUNTIME={...state};
 }catch(e){console.warn('[V14.9 meditation settings]',e)}
}
function patchMeditation(){
 if(typeof window.meditationTick!=='function'||window.meditationTick.__v149) return;
 window.meditationTick=function(){
  if(!g||!g.meditating||fight)return;
  g.meditateSec++;
  const z=zoneAt(g.pos.r,g.pos.c),novice=!!(z&&z.novice),expInterval=novice?P.meditate_novice_exp_interval_sec:P.meditate_exp_interval_sec;
  const zoneMult=(z?.recover||1),boost=(window.V13_REWARDED_ADS?.getMeditationMultiplier?.()||1);
  const recoveryMult=zoneMult*boost*(state.recoveryPercent/100), expMult=zoneMult*boost*(state.experiencePercent/100);
  let changed=false;
  if(g.meditateSec%expInterval===0){gainExp(1*expMult,false);changed=true}
  if(g.meditateSec%P.meditate_hp_interval_sec===0){g.hp=clamp(g.hp+P.meditate_hp_gain*recoveryMult,0,g.hpMax);changed=true}
  if(g.meditateSec%P.meditate_mp_interval_sec===0){g.mp=clamp(g.mp+P.meditate_mp_gain*recoveryMult,0,g.mpMax);changed=true}
  if(changed){render();saveGame(false)}
 };
 window.meditationTick.__v149=true;
}
function patchOffline(){
 if(typeof window.offlineSettlement!=='function'||window.offlineSettlement.__v149)return;
 const original=window.offlineSettlement;
 window.offlineSettlement=function(){
  const before={exp:g?.exp,hp:g?.hp,mp:g?.mp};
  const result=original.apply(this,arguments);
  // Offline function already applied base gains. Adjust only the incremental gains.
  if(g&&before.exp!=null){g.exp=before.exp+(g.exp-before.exp)*(state.experiencePercent/100);g.hp=before.hp+(g.hp-before.hp)*(state.recoveryPercent/100);g.mp=before.mp+(g.mp-before.mp)*(state.recoveryPercent/100);render();saveGame(false)}
  return result;
 };
 window.offlineSettlement.__v149=true;
}
function init(){patchBag();patchMeditation();patchOffline();loadSettings();setInterval(loadSettings,60000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
