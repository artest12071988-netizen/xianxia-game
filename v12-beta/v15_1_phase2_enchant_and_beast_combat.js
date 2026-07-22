(()=>{
'use strict';

const BUILD='V15.1-PHASE2-FIVE-ELEMENT-ENCHANT-DIVINE-BEAST-COMBAT';
const ELEMENTS={
  '8401':{key:'fire',label:'火性附魔',element:'火',target:'weapon',valueMin:20,valueMax:25,summary:e=>`追加 ${Number(e.value||20).toFixed(1)}% 火性傷害`},
  '8402':{key:'water',label:'水性附魔',element:'水',target:'weapon',value:3,summary:()=>`每次命中削減對方最大法力 3%`},
  '8403':{key:'wood',label:'木性附魔',element:'木',target:'weapon',value:20,summary:()=>`實際傷害 20% 轉為自身體力`},
  '8404':{key:'metal',label:'金性附魔',element:'金',target:'weapon',critRate:25,critMultiplier:1.5,summary:()=>`暴擊率 +25%，暴擊傷害 ×1.5`},
  '8405':{key:'earth',label:'土性附魔',element:'土',target:'armor',reduction:25,summary:()=>`所有最終承傷降低 25%`}
};
const S={encounterBusy:false,attackBusy:false,rewardBusy:false,rewardTimer:null,patched:false};

function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function clamp2(v,a,b){return Math.max(a,Math.min(b,v))}
function coreReady(){return !!(window.g&&window.IT&&window.P&&typeof window.sheet==='function')}
function client(){try{return window.cloudState?.client||null}catch(_){return null}}
function loggedIn(){try{return !!(window.cloudState?.enabled&&window.cloudState?.user&&client())}catch(_){return false}}
function rpc(name,args={}){const c=client();if(!c)return Promise.reject(new Error('尚未連線伺服器'));return c.rpc(name,args).then(({data,error})=>{if(error)throw error;return data})}
function coord(){try{return typeof window.coordOf==='function'?window.coordOf(g.pos.r,g.pos.c):String.fromCharCode(65+num(g.pos?.r))+'-'+(num(g.pos?.c)+1)}catch(_){return ''}}
function equipment(){return Array.isArray(g?.equipment)?g.equipment:[]}
function findEq(uid){return equipment().find(e=>String(e?.uid)===String(uid))||null}
function baseItem(e){return e?IT?.[String(e.itemId||e.item_id)]||null:null}
function eqCat(e){const it=baseItem(e);return String(e?.cat||it?.cat||'')}
function compatible(e,m){return m?.target==='weapon'?eqCat(e)==='法器':m?.target==='armor'?eqCat(e)==='防具':false}
function elementMeta(e){const id=String(e?.elementEnchant?.materialId||'');return ELEMENTS[id]||null}
function elementClass(e){const m=elementMeta(e);return m?`v151-element-${m.key}`:'v151-element-none'}
function equippedWeapon(){return equipment().find(e=>String(e.uid)===String(g?.weaponUid))||null}
function equippedArmor(){return equipment().find(e=>String(e.uid)===String(g?.armorUid))||null}
function weaponEnchant(){return equippedWeapon()?.elementEnchant||null}
function armorEnchant(){return equippedArmor()?.elementEnchant||null}
function elementByEnchant(x){return ELEMENTS[String(x?.materialId||'')]||null}
function inscriptionSummary(e){
  const cap=Math.max(0,Math.floor(num(e?.inscriptionCapacity,0)));
  const lines=Array.isArray(e?.inscriptions)?e.inscriptions:[];
  return `器紋 ${lines.length}/${cap}｜洞數 ${cap}｜${lines.length?lines.map(x=>`${x.label||x.stat} +${num(x.value).toFixed(1)}%`).join('、'):'尚未刻印'}`;
}
function enchantSummary(e){
  const m=elementMeta(e),x=e?.elementEnchant;
  return m?`${m.label}｜${m.summary(x||{})}`:'尚未附魔';
}
function normalizeEquipment(){
  if(!coreReady())return;
  g.inv=g.inv&&typeof g.inv==='object'?g.inv:{};
  g.equipment=equipment();
  for(const e of g.equipment){
    if(!e||typeof e!=='object')continue;
    if(e.elementEnchant&&typeof e.elementEnchant!=='object')delete e.elementEnchant;
    if(e.elementEnchant&&!ELEMENTS[String(e.elementEnchant.materialId||'')])delete e.elementEnchant;
  }
}

function applyEnchant(uid,materialId){
  normalizeEquipment();
  const e=findEq(uid),m=ELEMENTS[String(materialId)];
  if(!e||!m){toast?.('附魔目標或材料不存在');return}
  if(!compatible(e,m)){toast?.(m.target==='weapon'?'此附魔只能施加於法器':'土性附魔只能施加於防具');return}
  if(!(num(g.inv?.[materialId])>0)){toast?.('附魔材料不足');return}
  const previous=elementMeta(e);
  if(previous&&!confirm(`${e.name} 已有「${previous.label}」。重新附魔會覆蓋原效果，是否繼續？`))return;
  const ench={
    materialId:String(materialId),key:m.key,element:m.element,label:m.label,
    value:m.valueMin!=null?Number((m.valueMin+Math.random()*(m.valueMax-m.valueMin)).toFixed(1)):num(m.value,0),
    appliedAt:Date.now(),version:'V15.1-P2'
  };
  g.inv[materialId]=Math.max(0,num(g.inv[materialId])-1);
  e.elementEnchant=ench;
  log?.(`${e.name} 完成${m.label}：${m.summary(ench)}。`,'lg');
  saveGame?.(false);render?.();openEnchantWorkshop();
}
function openEnchantWorkshop(){
  if(!coreReady()){toast?.('角色資料尚未載入');return}
  normalizeEquipment();
  let h='<div class="v151-enchant-shell"><h3>五行附魔閣</h3>'+
    '<div class="tabs"><button onclick="openBag(\'bag\')">道具</button><button onclick="openBag(\'equip\')">裝備</button><button onclick="openBag(\'forge\')">獨立強化</button><button class="on">五行附魔</button></div>'+
    '<div class="v151-enchant-note">火、水、木、金附於法器；土附於防具。每件裝備只能保留一種五行附魔，重新附魔會覆蓋舊效果。器紋與附魔是兩套獨立加成，可同時存在。</div>';
  if(!equipment().length)h+='<p class="small">目前沒有可附魔裝備。</p>';
  for(const e of equipment()){
    const cls=elementClass(e),current=enchantSummary(e);
    const mats=Object.entries(ELEMENTS).filter(([,m])=>compatible(e,m));
    h+=`<article class="v151-enchant-card ${cls}"><h4>${esc(e.name)} +${Math.floor(num(e.enhance))}${String(e.uid)===String(g.weaponUid)||String(e.uid)===String(g.armorUid)?' <span class="pill">已裝備</span>':''}</h4>`+
       `<small>${esc(eqCat(e))}｜${esc(inscriptionSummary(e))}</small><small><b class="v151-element-label">${esc(current)}</b></small><div class="v151-materials">`;
    for(const [id,m] of mats){
      const count=num(g.inv[id]);
      h+=`<button class="btn v151-material-btn v151-element-${m.key}" ${count>0?'':'disabled'} onclick="V151_PHASE2.applyEnchant('${esc(e.uid)}','${id}')">${esc(m.label)} ×${count}</button>`;
    }
    h+='</div></article>';
  }
  h+='<button class="btn" style="width:100%" onclick="closeOv()">關閉</button></div>';
  sheet(h);
}

function augmentBag(){
  const root=document.getElementById('sheet');if(!root)return;
  const tabs=root.querySelector('.tabs');
  if(tabs&&!tabs.querySelector('[data-v151-enchant-tab]')){
    const b=document.createElement('button');b.dataset.v151EnchantTab='1';b.textContent='五行附魔';b.onclick=openEnchantWorkshop;tabs.appendChild(b);
  }
  const buttons=[...root.querySelectorAll('button[onclick*="equipItem("],button[onclick*="enhanceItem("]')];
  for(const b of buttons){
    const code=b.getAttribute('onclick')||'';
    const match=code.match(/(?:equipItem|enhanceItem)\(['"]([^'"]+)['"]\)/);
    const e=match?findEq(match[1]):null;if(!e)continue;
    const row=b.closest('.list-row');if(!row||row.querySelector('.v151-eq-meta'))continue;
    const meta=document.createElement('div');meta.className=`v151-eq-meta ${elementClass(e)}`;
    meta.innerHTML=`<b>${esc(enchantSummary(e))}</b><br>${esc(inscriptionSummary(e))}`;
    row.querySelector('.grow')?.appendChild(meta);
  }
}
function patchBag(){
  if(typeof window.openBag!=='function'||window.openBag.__v151p2)return;
  const old=window.openBag;
  window.openBag=function(tab='bag'){
    if(tab==='enchant')return openEnchantWorkshop();
    const r=old.apply(this,arguments);setTimeout(augmentBag,0);return r;
  };
  window.openBag.__v151p2=true;
}

function critInscriptionPct(){
  return equipment()
    .filter(e=>String(e.uid)===String(g.weaponUid)||String(e.uid)===String(g.armorUid))
    .flatMap(e=>Array.isArray(e.inscriptions)?e.inscriptions:[])
    .filter(x=>x?.stat==='crit_pct')
    .reduce((s,x)=>s+num(x.value),0);
}
function ensureEnemyMana(){
  if(!fight)return;
  if(num(fight.enemyMpMax)<=0){
    let max=0,current=0;
    if(fight.aiId!=null){
      const a=(Array.isArray(window.ai)?window.ai:[]).find(x=>String(x.id)===String(fight.aiId));
      max=num(a?.mpMax,num(a?.mp,0));current=num(a?.mp,max);
    }
    if(max<=0)max=Math.max(100,Math.round(num(fight.enemy?.atk,100)*5));
    fight.enemyMpMax=max;fight.enemyMp=current>0?current:max;
  }
}
function syncAiMana(){
  if(!fight||fight.aiId==null)return;
  const a=(Array.isArray(window.ai)?window.ai:[]).find(x=>String(x.id)===String(fight.aiId));
  if(a){a.mpMax=num(fight.enemyMpMax,a.mpMax);a.mp=clamp2(num(fight.enemyMp),0,a.mpMax)}
}
function attackProfile(){
  const ench=weaponEnchant(),m=elementByEnchant(ench);
  const rate=num(P.base_crit_rate)+((g.techniques||[]).includes('lightning_breath')?.10:0)+critInscriptionPct()/100+(m?.key==='metal'?.25:0);
  const crit=Math.random()<clamp2(rate,0,.95);
  const mult=crit?(m?.key==='metal'?1.5:num(P.base_crit_min,1.5)+Math.random()*(num(P.base_crit_max,2)-num(P.base_crit_min,1.5))):1;
  return {ench,m,crit,mult};
}
function resolvePlayerDamage(targetDef,targetHp){
  const p=attackProfile();
  const base=Math.max(1,calcDmg(pAtk(),targetDef,p.mult));
  const fire=p.m?.key==='fire'?Math.max(1,Math.round(base*num(p.ench?.value,20)/100)):0;
  const requested=base+fire;
  const actual=Math.min(Math.max(0,targetHp),requested);
  const water=p.m?.key==='water'?true:false;
  return {...p,base,fire,requested,actual,water};
}
function applyPostHitEffects(result,actualDamage){
  let parts=[];
  if(result.fire)parts.push(`火性追加 ${result.fire}`);
  if(result.water&&fight){
    ensureEnemyMana();
    const loss=Math.max(1,Math.round(fight.enemyMpMax*.03));
    fight.enemyMp=Math.max(0,fight.enemyMp-loss);syncAiMana();parts.push(`法力削減 ${loss}`);
  }
  if(result.m?.key==='wood'){
    const heal=Math.max(1,Math.round(actualDamage*.20));
    const before=num(g.hp);g.hp=clamp2(before+heal,0,num(g.hpMax));parts.push(`回復體力 ${Math.round(g.hp-before)}`);
  }
  return parts;
}
function earthReduction(raw){
  const m=elementByEnchant(armorEnchant());
  return m?.key==='earth'?Math.max(1,Math.round(raw*.75)):raw;
}
function combatElementBadges(){
  const w=weaponEnchant(),a=armorEnchant(),wm=elementByEnchant(w),am=elementByEnchant(a),out=[];
  if(wm)out.push(`<span class="v151-element-${wm.key}">${esc(wm.label)}</span>`);
  if(am)out.push(`<span class="v151-element-${am.key}">${esc(am.label)}</span>`);
  return out.join('');
}
function augmentRegularFight(){
  const root=document.getElementById('sheet');if(!root||!fight||fight.kind==='divine_beast')return;
  ensureEnemyMana();
  if(!root.querySelector('.v151-combat-elements')){
    const p=root.querySelector('.small[style*="min-height"]')||root.querySelector('p.small');
    const d=document.createElement('div');d.className='v151-combat-elements';d.innerHTML=combatElementBadges();
    if(p)p.after(d);
  }
  const enemy=root.querySelector('#enemyFighter .small');
  if(enemy&&!enemy.dataset.v151mp){enemy.dataset.v151mp='1';enemy.innerHTML+=`<br>法力 ${Math.round(fight.enemyMp)} / ${Math.round(fight.enemyMpMax)}`;}
}
function normalRender(line){
  if(typeof S.baseRenderFight==='function')S.baseRenderFight(line);
  setTimeout(augmentRegularFight,0);
}
function regularAttack(){
  if(!fight)return;
  if(g.mp<P.normal_attack_mp_cost){normalRender('精力不足，無法出手。請使用回精丹或遁走。');return}
  g.mp-=P.normal_attack_mp_cost;ensureEnemyMana();
  if(Math.random()<P.encounter_miss_rate){animateStrike('playerFighter');normalRender('你的攻擊落空了。');return setTimeout(window.enemyTurn,380)}
  const r=resolvePlayerDamage(num(fight.enemy.def),num(fight.hp));
  fight.hp-=r.requested;
  const effects=applyPostHitEffects(r,Math.min(r.requested,r.actual));
  animateStrike('playerFighter');animateHit('enemyFighter',r.requested);
  saveGame?.(false);render?.();
  if(fight.hp<=0)return setTimeout(winFight,330);
  normalRender(`你造成 ${r.base}${r.crit?'（暴擊）':''}${effects.length?'；'+effects.join('、'):''}。`);
  setTimeout(window.enemyTurn,420);
}
function regularEnemyTurn(){
  if(!fight)return;
  ensureEnemyMana();
  if(num(fight.enemyMp)<=0){
    const regain=Math.max(1,Math.round(fight.enemyMpMax*.05));fight.enemyMp=Math.min(fight.enemyMpMax,regain);
    normalRender(`${fight.enemy.name} 法力枯竭，停手回氣。`);syncAiMana();return;
  }
  fight.enemyMp=Math.max(0,fight.enemyMp-num(P.normal_attack_mp_cost,10));syncAiMana();
  if(Math.random()<P.encounter_miss_rate){normalRender(`${fight.enemy.name} 的攻擊被你避開。`);return}
  const raw=calcDmg(fight.enemy.atk,pDef()),dmg=earthReduction(raw);
  g.hp-=dmg;animateHit('playerFighter',dmg);saveGame?.(false);
  if(g.hp<=0)return setTimeout(loseFight,300);
  const earth=dmg<raw?`（土性附魔減免 ${raw-dmg}）`:'';
  normalRender(`${fight.enemy.name} 反擊，造成 ${dmg} 傷害${earth}。`);render?.();
}

async function tryBeastEncounter(source){
  if(S.encounterBusy||!loggedIn()||!coreReady()||fight)return false;
  S.encounterBusy=true;
  try{
    const data=await rpc('divine_beast_try_encounter',{p_coord:coord(),p_player_name:String(g.name||'未知修士')});
    if(data?.encountered){startDivineFight(data,source);return true}
    return false;
  }catch(e){
    const msg=String(e?.message||e);
    if(!/LOGIN_REQUIRED|INVALID_COORD|Could not find|does not exist/i.test(msg))console.warn('['+BUILD+'] encounter failed',e);
    return false;
  }finally{S.encounterBusy=false}
}
function startDivineFight(data,source){
  const b=data.beast||{};
  stopMeditate?.('遭遇神獸');
  fight={
    kind:'divine_beast',token:data.token,source,
    enemy:{name:b.beast_name,atk:num(b.attack_power),def:num(b.defense_power)},
    beast:b,hp:num(b.current_hp),hpMax:num(b.max_hp),
    enemyMpMax:Math.max(1000,Math.round(num(b.attack_power,100)*10)),
    enemyMp:Math.max(1000,Math.round(num(b.attack_power,100)*10))
  };
  renderDivineFight(`天地震動，你在 ${esc(b.coord||coord())} 遭遇了 ${esc(b.beast_name)}！`);
}
function renderDivineFight(line){
  if(!fight||fight.kind!=='divine_beast')return;
  const b=fight.beast||{},hpPct=clamp2(num(fight.hp)/Math.max(1,num(fight.hpMax))*100,0,100),mpPct=clamp2(num(fight.enemyMp)/Math.max(1,num(fight.enemyMpMax))*100,0,100);
  sheet(`<div class="v151-beast-shell"><div class="v151-beast-head"><div><div class="v151-beast-title">${esc(b.beast_name||fight.enemy.name)}</div><div class="v151-beast-sub">${esc(b.direction||'')}方神獸｜全服共用持久血量｜本次傷害會立即寫入伺服器</div></div><span class="pill">世代 ${num(b.generation)}</span></div>`+
    `<div><div class="small">神獸體力 ${Math.round(fight.hp).toLocaleString()} / ${Math.round(fight.hpMax).toLocaleString()}</div><div class="v151-beast-bar"><i style="width:${hpPct}%"></i></div></div>`+
    `<div><div class="small">神力 ${Math.round(fight.enemyMp).toLocaleString()} / ${Math.round(fight.enemyMpMax).toLocaleString()}</div><div class="v151-beast-bar mp"><i style="width:${mpPct}%"></i></div></div>`+
    `<div class="v151-beast-stats"><div><span>你的體力</span><b>${Math.max(0,Math.round(g.hp))} / ${Math.round(g.hpMax)}</b></div><div><span>你的精力</span><b>${Math.max(0,Math.round(g.mp))} / ${Math.round(g.mpMax)}</b></div><div><span>神獸防禦</span><b>${Math.round(num(b.defense_power))}</b></div></div>`+
    `<div class="v151-beast-message">${line}</div><div class="v151-combat-elements">${combatElementBadges()}</div>`+
    `<div class="row"><button class="btn red" ${S.attackBusy?'disabled':''} onclick="V151_PHASE2.divineAttack()">攻擊 −${P.normal_attack_mp_cost}精力</button><button class="btn jade" onclick="openCombatItems()">道具／丹藥</button><button class="btn" onclick="V151_PHASE2.fleeDivine()">遁走</button></div></div>`);
}
async function divineAttack(){
  if(S.attackBusy||!fight||fight.kind!=='divine_beast')return;
  if(g.mp<P.normal_attack_mp_cost){renderDivineFight('精力不足，無法攻擊。');return}
  S.attackBusy=true;g.mp-=P.normal_attack_mp_cost;
  try{
    if(Math.random()<P.encounter_miss_rate){renderDivineFight('你的攻擊被神獸避開。');S.attackBusy=false;return setTimeout(divineEnemyTurn,420)}
    const r=resolvePlayerDamage(num(fight.beast.defense_power),num(fight.hp));
    const data=await rpc('divine_beast_attack',{p_token:fight.token,p_damage:r.requested,p_player_name:String(g.name||'未知修士')});
    const applied=num(data?.applied_damage),before=num(fight.hp);
    fight.hp=num(data?.hp_after,Math.max(0,before-applied));
    if(data?.beast)fight.beast={...fight.beast,...data.beast};
    const effects=applyPostHitEffects(r,applied);
    saveGame?.(false);render?.();
    if(data?.outcome&&data.outcome!=='active'){S.attackBusy=false;return finishDivine(data.outcome,data)}
    renderDivineFight(`你對神獸造成 ${Math.round(applied)} 點持久傷害${r.crit?'（暴擊）':''}${effects.length?'；'+effects.join('、'):''}。`);
    S.attackBusy=false;setTimeout(divineEnemyTurn,480);
  }catch(e){
    S.attackBusy=false;
    const msg=String(e?.message||e);
    if(/ENCOUNTER_EXPIRED|BEAST_NOT_ACTIVE|ENCOUNTER_NOT_FOUND/i.test(msg)){fight=null;closeOv?.();toast?.('此次神獸遭遇已結束');pollRewards();return}
    renderDivineFight('攻擊寫入失敗：'+esc(msg));
  }
}
function divineEnemyTurn(){
  if(!fight||fight.kind!=='divine_beast')return;
  if(fight.enemyMp<=0){
    fight.enemyMp=Math.min(fight.enemyMpMax,Math.round(fight.enemyMpMax*.08));
    renderDivineFight(`${fight.enemy.name} 神力枯竭，暫停攻勢恢復神力。`);return
  }
  fight.enemyMp=Math.max(0,fight.enemyMp-Math.max(1,Math.round(fight.enemyMpMax*.05)));
  if(Math.random()<P.encounter_miss_rate){renderDivineFight(`${fight.enemy.name} 的神通被你避開。`);return}
  const raw=calcDmg(num(fight.beast.attack_power),pDef()),dmg=earthReduction(raw);
  g.hp-=dmg;saveGame?.(false);render?.();
  if(g.hp<=0){
    const token=fight.token;rpc('divine_beast_close_encounter',{p_token:token}).catch(()=>{});
    return setTimeout(loseFight,300);
  }
  renderDivineFight(`${fight.enemy.name} 反擊造成 ${dmg} 傷害${dmg<raw?`；土性附魔減免 ${raw-dmg}`:''}。`);
}
async function fleeDivine(){
  if(!fight||fight.kind!=='divine_beast'||S.attackBusy)return;
  const chance=num(P.encounter_flee_success,.45)+(g.big==='元嬰期'?.15:g.big==='結丹期'?.10:0);
  if(Math.random()<chance){
    const token=fight.token;fight=null;closeOv?.();log?.('你從神獸威壓中成功遁走。','la');render?.();
    try{await rpc('divine_beast_close_encounter',{p_token:token})}catch(_){}
  }else{renderDivineFight('遁走失敗，神獸封鎖了空間。');setTimeout(divineEnemyTurn,420)}
}
function finishDivine(outcome,data){
  const name=fight?.enemy?.name||'神獸';
  const line=outcome==='defeated'?`${name} 已被全服修士擊潰。`:`${name} 傷勢過重，撕裂空間逃離。`;
  log?.(line,'lg');fight=null;closeOv?.();render?.();toast?.(line);setTimeout(pollRewards,700);
}

async function pollRewards(){
  if(S.rewardBusy||!loggedIn()||!coreReady())return;
  S.rewardBusy=true;
  try{
    const rows=await rpc('divine_beast_pending_rewards');
    if(!Array.isArray(rows)||!rows.length)return;
    g.v151ClaimedRewards=g.v151ClaimedRewards&&typeof g.v151ClaimedRewards==='object'?g.v151ClaimedRewards:{};
    for(const r of rows){
      const id=String(r.id);
      if(!g.v151ClaimedRewards[id]){
        const itemId=String(r.material_id),q=Math.max(1,Math.floor(num(r.quantity,1)));
        g.inv[itemId]=num(g.inv[itemId])+q;
        g.v151ClaimedRewards[id]={itemId,quantity:q,at:Date.now()};
        log?.(`神獸機緣：獲得 ${r.material_name} ×${q}。`,'lg');
        saveGame?.(false);
        if(typeof window.flushCloudSave==='function')try{await window.flushCloudSave(true)}catch(_){}
      }
      try{await rpc('divine_beast_ack_reward',{p_claim_id:r.id})}catch(e){console.warn('['+BUILD+'] reward ack pending',e)}
    }
    render?.();toast?.('神獸附魔材料已收入行囊');
  }catch(e){
    const msg=String(e?.message||e);
    if(!/Could not find|does not exist/i.test(msg))console.warn('['+BUILD+'] reward poll failed',e);
  }finally{S.rewardBusy=false}
}

function patchEncounters(){
  if(typeof window.rollEncounter==='function'&&!window.rollEncounter.__v151p2){
    const old=window.rollEncounter;
    window.rollEncounter=async function(source){if(await tryBeastEncounter(source))return;return old.apply(this,arguments)};
    window.rollEncounter.__v151p2=true;
  }
  if(typeof window.explore==='function'&&!window.explore.__v151p2){
    const old=window.explore;
    window.explore=async function(){
      if(fight||g.mp<P.explore_stamina_cost)return old.apply(this,arguments);
      if(!loggedIn())return old.apply(this,arguments);
      stopMeditate?.('開始探索');g.mp-=P.explore_stamina_cost;render?.();
      if(await tryBeastEncounter('explore')){saveGame?.(false);return}
      g.mp+=P.explore_stamina_cost;
      return old.apply(this,arguments);
    };
    window.explore.__v151p2=true;
  }
}
async function divineUseCombatItem(id){
  if(S.attackBusy||!fight||fight.kind!=='divine_beast')return;
  const it=IT?.[String(id)];if(!it||!(num(g.inv?.[id])>0))return;
  if(it.eff==='體力回復'){
    g.inv[id]--;g.hp=clamp2(num(g.hp)+num(it.val),0,num(g.hpMax));saveGame?.(false);render?.();
    renderDivineFight(`你服下 ${esc(it.name)}，回復 ${num(it.val)} 體力。`);return setTimeout(divineEnemyTurn,450)
  }
  if(it.eff==='精力回復'){
    g.inv[id]--;g.mp=clamp2(num(g.mp)+num(it.val),0,num(g.mpMax));saveGame?.(false);render?.();
    renderDivineFight(`你服下 ${esc(it.name)}，回復 ${num(it.val)} 精力。`);return setTimeout(divineEnemyTurn,450)
  }
  if(it.eff==='療傷'){
    g.inv[id]--;g.injury=null;saveGame?.(false);
    renderDivineFight(`你使用 ${esc(it.name)} 穩住傷勢。`);return setTimeout(divineEnemyTurn,450)
  }
  if(it.eff==='投擲'){
    S.attackBusy=true;g.inv[id]--;saveGame?.(false);
    try{
      const data=await rpc('divine_beast_attack',{p_token:fight.token,p_damage:num(it.val,1),p_player_name:String(g.name||'未知修士')});
      const applied=num(data?.applied_damage);fight.hp=num(data?.hp_after,Math.max(0,num(fight.hp)-applied));
      if(data?.beast)fight.beast={...fight.beast,...data.beast};
      render?.();
      if(data?.outcome&&data.outcome!=='active'){S.attackBusy=false;return finishDivine(data.outcome,data)}
      renderDivineFight(`你祭出 ${esc(it.name)}，對神獸造成 ${Math.round(applied)} 點持久傷害。`);
      S.attackBusy=false;return setTimeout(divineEnemyTurn,450)
    }catch(e){
      S.attackBusy=false;g.inv[id]=num(g.inv[id])+1;saveGame?.(false);
      renderDivineFight(`投擲傷害寫入失敗，物品已退回：${esc(e?.message||e)}`);
      return
    }
  }
  toast?.('此道具目前不能在神獸戰鬥中使用');
}
function patchCombat(){
  if(S.combatPatched)return;
  if(typeof window.renderFight!=='function'||typeof window.attackTurn!=='function'||typeof window.enemyTurn!=='function')return;
  S.combatPatched=true;
  S.baseRenderFight=window.renderFight;
  const oldStartMonster=window.startFightMonster,oldStartAi=window.startFightAi,oldFlee=window.fleeTurn,oldUseCombatItem=window.useCombatItem;
  window.renderFight=function(line){if(fight?.kind==='divine_beast')return renderDivineFight(line);return normalRender(line)};
  window.startFightMonster=function(){const r=oldStartMonster.apply(this,arguments);ensureEnemyMana();setTimeout(augmentRegularFight,0);return r};
  window.startFightAi=function(){const r=oldStartAi.apply(this,arguments);ensureEnemyMana();setTimeout(augmentRegularFight,0);return r};
  window.attackTurn=function(){return fight?.kind==='divine_beast'?divineAttack():regularAttack()};
  window.enemyTurn=function(){return fight?.kind==='divine_beast'?divineEnemyTurn():regularEnemyTurn()};
  window.fleeTurn=function(){return fight?.kind==='divine_beast'?fleeDivine():oldFlee.apply(this,arguments)};
  window.useCombatItem=function(id){return fight?.kind==='divine_beast'?divineUseCombatItem(id):oldUseCombatItem.apply(this,arguments)};
}

function install(){
  if(!coreReady())return false;
  normalizeEquipment();patchBag();patchEncounters();patchCombat();
  if(!S.rewardTimer){pollRewards();S.rewardTimer=setInterval(pollRewards,20000)}
  window.V151_PHASE2={
    build:BUILD,applyEnchant,openEnchantWorkshop,divineAttack,fleeDivine,
    tryBeastEncounter,pollRewards,state:S
  };
  console.info('['+BUILD+'] active');
  return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(timer)},250);
})();
