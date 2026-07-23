(()=>{
'use strict';
const BUILD='V15.3-PHASE1-FIX1-MONSTER-MODULE-BOOT';
if(window.__V153MonsterEcologyLoaded)return;
window.__V153MonsterEcologyLoaded=true;

const CYCLE={wood:'earth',earth:'water',water:'fire',fire:'metal',metal:'wood'};
const ELEMENT_NAME={wood:'木',fire:'火',earth:'土',metal:'金',water:'水'};
const ELEMENT_CLASS={wood:'wood',fire:'fire',earth:'earth',metal:'metal',water:'water'};

const ZONE_TAGS={
 'A-1':['新手','草原','荒野'],
 'J-2':['新手','草原','荒野'],
 'C-3':['城鎮周邊','荒野'],
 'C-4':['城鎮周邊','荒野'],
 'C-5':['靈地','山地'],
 'D-4':['水域','靈地','森林'],
 'E-5':['秘境','山地','森林','遺跡'],
 'F-2':['廢墟','荒野'],
 'B-4':['廢墟','荒野'],
 'G-6':['山地','廢墟'],
 'H-4':['森林','沼澤'],
 'I-10':['海岸','海域'],
 'A-6':['安全區'],
 'B-7':['森林'],
 'D-8':['沙漠'],
 'F-7':['古戰場','荒野'],
 'H-8':['遺跡','廢墟'],
 'B-9':['崑崙','山地'],
 'A-10':['天宮','冰原','山地'],
 'C-10':['冰原'],
 'F-10':['海域'],
 'H-10':['冰火島','火山','冰原'],
 'J-10':['陰陽海','海域']
};

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
const clone=x=>JSON.parse(JSON.stringify(x));
const esc2=s=>window.esc?window.esc(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const currentZone=()=>window.zoneAt?.(g.pos.r,g.pos.c)||null;
const currentCoord=()=>window.coordOf?.(g.pos.r,g.pos.c)||'';
function zoneTags(z=currentZone()){
  const coord=z?.coord||currentCoord();
  if(ZONE_TAGS[coord])return ZONE_TAGS[coord].slice();
  const n=String(z?.name||''),t=String(z?.type||'');
  const tags=[];
  if(/森林|林/.test(n+t))tags.push('森林');
  if(/沙漠|赤砂/.test(n+t))tags.push('沙漠');
  if(/冰原|玄霜/.test(n+t))tags.push('冰原');
  if(/海|燈塔/.test(n+t))tags.push('海域');
  if(/遺跡|廢墟/.test(n+t))tags.push('遺跡','廢墟');
  if(/戰場/.test(n+t))tags.push('古戰場');
  if(/崑崙|山/.test(n+t))tags.push('山地');
  return tags.length?tags:['荒野'];
}
function isBound(m){return m&&m.ecologyLocked!==false&&Array.isArray(m.habitats)&&m.habitats.length}
function compatible(m,z=currentZone()){
  if(!m||!isBound(m))return true;
  const tags=zoneTags(z);
  return m.habitats.some(h=>tags.includes(h));
}
function weighted(list){
  if(!list.length)return null;
  const total=list.reduce((s,m)=>s+Math.max(.1,num(m.spawnWeight,1)),0);
  let r=Math.random()*total;
  for(const m of list){r-=Math.max(.1,num(m.spawnWeight,1));if(r<=0)return m}
  return list[list.length-1];
}
function candidates(z,{tide=false}={}){
  let pool=(C?.monsters||[]).filter(m=>!['活動王','古魔'].includes(m.cat));
  pool=pool.filter(m=>compatible(m,z));
  if(tide){
    const tidePool=pool.filter(m=>String(m.spawn||'').includes('獸潮'));
    if(tidePool.length)pool=tidePool;
  }
  if(z?.novice){
    const novice=pool.filter(m=>num(m.lv)<=3&&num(m.lv)<=num(g.lv)+1);
    if(novice.length)pool=novice;
  }else{
    const matched=pool.filter(m=>Math.abs(num(m.lv)-num(g.lv))<=3);
    if(matched.length)pool=matched;
    else pool=pool.slice().sort((a,b)=>Math.abs(num(a.lv)-num(g.lv))-Math.abs(num(b.lv)-num(g.lv))).slice(0,6);
  }
  return pool;
}
function pick(z=currentZone(),opts={}){
  const pool=candidates(z,opts);
  const regional=pool.filter(m=>num(m.id)>=9401&&num(m.id)<=9415);
  const selected=(regional.length&&Math.random()<.65)
    ?weighted(regional)
    :weighted(pool);
  return clone(selected||(C?.monsters||[]).find(m=>m.id===9001));
}
function weaponElement(){
  const e=(g?.equipment||[]).find(x=>String(x.uid)===String(g?.weaponUid));
  return e?.elementEnchant?.key||null;
}
function armorElement(){
  const e=(g?.equipment||[]).find(x=>String(x.uid)===String(g?.armorUid));
  return e?.elementEnchant?.key||null;
}
function relation(attacker,defender){
  if(!attacker||!defender)return {mult:1,label:''};
  if(attacker===defender)return {mult:.90,label:'同屬抗性'};
  if(CYCLE[attacker]===defender)return {mult:1.25,label:'五行克制'};
  if(CYCLE[defender]===attacker)return {mult:.85,label:'五行受制'};
  return {mult:1,label:''};
}
function elementBadge(m){
  const key=ELEMENT_CLASS[m?.elementKey]||'none';
  return `<span class="v153-element ${key}">${esc2(m?.element||'無')}屬性</span>`;
}
function habitatText(m){return Array.isArray(m?.habitats)?m.habitats.join('／'):'不受地域限制'}

let installed=false;
function runtimeReady(){
  try{
    return typeof C!=='undefined'
      &&Array.isArray(C?.monsters)
      &&typeof g!=='undefined'
      &&!!g
      &&typeof window.startFightMonster==='function';
  }catch(_){return false}
}
function install(){
  if(installed||!runtimeReady())return false;
  installed=true;
  const oldStart=window.startFightMonster;
  const oldRender=window.renderFight;
  const oldAttack=window.attackTurn;
  const oldEnemy=window.enemyTurn;
  const oldDex=window.openMonsterDex;

  window.pickMonster=function(z){
    return pick(z,{tide:!!window.V14BeastTide?.isActive?.()});
  };

  window.startFightMonster=function(m){
    const z=currentZone();
    let selected=m;
    if(isBound(m)&&!compatible(m,z)){
      selected=pick(z,{tide:!!window.V14BeastTide?.isActive?.()});
      console.info(`[${BUILD}] blocked incompatible spawn`,m?.name,'at',z?.name,'->',selected?.name);
    }
    return oldStart(selected);
  };

  window.renderFight=function(line,speech={}){
    if(fight?.kind!=='monster')return oldRender(line,speech);
    const e=fight.enemy;
    const enemyHp=`體力 ${Math.max(0,Math.round(fight.hp))} / ${fight.hpMax}`;
    const enemyBar=`<div class="bar"><i class="enemy-hpf" style="width:${clamp(fight.hp/fight.hpMax*100,0,100)}%"></i></div>`;
    const meta=`<div class="v153-fight-meta">${elementBadge(e)}<span>${esc2(e.trait||'普通妖獸')}</span><span>棲地：${esc2(habitatText(e))}</span></div>`;
    sheet(`<h3>鬥法 · ${esc2(e.name)}</h3><div class="fight-stage"><div class="fighter" id="playerFighter">${fighterPortrait('assets/player_cultivator.svg',g.name)}<strong>${esc2(g.name)}</strong><div class="small">體力 ${Math.max(0,Math.round(g.hp))} / ${g.hpMax}</div></div><div class="fighter enemy" id="enemyFighter">${fighterPortrait(e.image||('assets/monsters/'+e.id+'.svg'),e.name)}<strong>${esc2(e.name)}</strong><div class="small">${enemyHp}</div></div></div>${enemyBar}${meta}<div class="v153-trait"><b>${esc2(e.trait||'妖獸本能')}</b>：${esc2(e.traitText||'無特殊能力')}｜弱點：${esc2(e.weakTo||'無')}</div><p class="small fight-line">${line}</p><div class="row"><button class="btn red" onclick="attackTurn()">攻擊 −${P.normal_attack_mp_cost}精力</button><button class="btn jade" onclick="openCombatItems()">道具／丹藥</button><button class="btn" onclick="fleeTurn()">遁走</button></div>`);
    if(speech.player)setTimeout(()=>showFightSpeech('playerFighter',speech.player,speech.playerType||'normal'),80);
    if(speech.enemy)setTimeout(()=>showFightSpeech('enemyFighter',speech.enemy,speech.enemyType||'normal'),120);
  };

  window.attackTurn=function(){
    if(fight?.kind!=='monster')return oldAttack();
    if(g.mp<P.normal_attack_mp_cost){renderFight('精力不足，無法出手。請使用回精丹或遁走。');return}
    g.mp-=P.normal_attack_mp_cost;
    const e=fight.enemy;
    const attackLine=Math.random()<(P.combat_speech_normal_chance||.42)?rnd(C.combatSpeech.playerAttack):'';
    const miss=clamp(num(P.encounter_miss_rate)+num(e.evasionBonus),0,.75);
    if(Math.random()<miss){
      renderFight(`你的攻擊被${e.name}避開。`,{player:attackLine});
      setTimeout(()=>animateStrike('playerFighter'),40);
      return setTimeout(()=>window.enemyTurn(),500);
    }
    let mult=1,crit=false,rate=P.base_crit_rate+(g.techniques.includes('lightning_breath')?.10:0);
    if(Math.random()<rate){crit=true;mult=P.base_crit_min+Math.random()*(P.base_crit_max-P.base_crit_min)}
    let dmg=calcDmg(pAtk(),e.def,mult);
    if(crit&&g.techniques.includes('lightning_breath'))dmg+=50;
    const elem=relation(weaponElement(),e.elementKey);
    dmg=Math.max(1,Math.round(dmg*elem.mult*(1-num(e.damageReduction))));
    const blockChance=clamp(calcBlockChance(e.def,pAtk())+num(e.blockBonus),.04,.60);
    const blocked=Math.random()<blockChance;
    if(blocked)dmg=Math.max(1,Math.round(dmg*(P.block_damage_multiplier||.35)));
    fight.hp-=dmg;
    const speech={player:crit?rnd(C.combatSpeech.playerCrit):attackLine,playerType:crit?'crit':'normal'};
    if(blocked){speech.enemy=getEnemyLine('blockLines');speech.enemyType='block'}else if(Math.random()<.35){speech.enemy=getEnemyLine('hitLines');speech.enemyType='hit'}
    const elemText=elem.label?`，${elem.label} ×${elem.mult.toFixed(2)}`:'';
    renderFight(`你造成 ${dmg} 傷害${crit?'（暴擊）':''}${blocked?'，但對方成功格擋':''}${elemText}。`,speech);
    setTimeout(()=>animateStrike('playerFighter'),40);
    animateDamage('enemyFighter',dmg,{crit,blocked});
    if(fight.hp<=0)return setTimeout(winFight,720);
    setTimeout(()=>window.enemyTurn(),780);
  };

  window.enemyTurn=function(){
    if(fight?.kind!=='monster')return oldEnemy();
    if(!fight)return;
    const e=fight.enemy;
    const attackLine=Math.random()<.48?getEnemyLine('attackLines'):'';
    if(Math.random()<P.encounter_miss_rate){
      renderFight(`${e.name}的攻擊被你避開。`,{enemy:attackLine});
      return;
    }
    const critRate=Math.max(.04,P.base_crit_rate*.65)+num(e.critBonus);
    let crit=Math.random()<critRate;
    let mult=crit?(P.base_crit_min+Math.random()*(P.base_crit_max-P.base_crit_min)):1;
    let dmg=calcDmg(e.atk,pDef(),mult);
    const elem=relation(e.elementKey,armorElement());
    dmg=Math.max(1,Math.round(dmg*elem.mult*(1+num(e.damageBonus))));
    const blocked=Math.random()<calcBlockChance(pDef(),e.atk);
    if(blocked)dmg=Math.max(1,Math.round(dmg*(P.block_damage_multiplier||.35)));
    g.hp-=dmg;
    const speech={enemy:crit?getEnemyLine('critLines'):attackLine,enemyType:crit?'crit':'normal'};
    if(blocked){speech.player=rnd(C.combatSpeech.playerBlock);speech.playerType='block'}else if(Math.random()<.38){speech.player=rnd(C.combatSpeech.playerHit);speech.playerType='hit'}
    const elemText=elem.label?`，${elem.label} ×${elem.mult.toFixed(2)}`:'';
    renderFight(`${e.name}反擊，造成 ${dmg} 傷害${crit?'（暴擊）':''}${blocked?'，你傲然格擋':''}${elemText}。`,speech);
    setTimeout(()=>animateStrike('enemyFighter'),40);
    animateDamage('playerFighter',dmg,{crit,blocked});
    render();
    if(g.hp<=0)return setTimeout(loseFight,720);
  };

  window.openMonsterDex=function(){
    const rows=C.monsters.map(m=>`<div class="monster-card v153-dex-card"><img src="${esc2(m.image||('assets/monsters/'+m.id+'.svg'))}" alt="${esc2(m.name)}"><div><strong>${esc2(m.name)}</strong><span>${esc2(m.cat)} · Lv${m.lv} ${elementBadge(m)}</span><small>體力 ${m.hp}｜攻擊 ${m.atk}｜防禦 ${m.def}<br>特性：${esc2(m.trait||'—')}｜弱點：${esc2(m.weakTo||'—')}<br>出沒：${esc2(m.spawn)}</small></div></div>`).join('');
    sheet(`<h3>妖獸圖鑑 · 地域生態版</h3><p class="small">目前共 ${C.monsters.length} 種怪物。一般探索會依所在地棲地篩選；海域不會生成陸地妖獸。</p><div class="monster-grid">${rows}</div><button class="btn" style="width:100%;margin-top:10px" onclick="closeOv()">關閉圖鑑</button>`);
  };

  window.V153MonsterEcology={
    build:BUILD,
    zoneTags:()=>zoneTags(),
    compatible:(monster,zone)=>compatible(monster,zone),
    localPool:()=>candidates(currentZone(),{tide:!!window.V14BeastTide?.isActive?.()}).map(m=>({id:m.id,name:m.name,habitats:m.habitats})),
    pick:()=>pick(currentZone(),{tide:!!window.V14BeastTide?.isActive?.()}),
    diagnose:()=>({installed,zone:currentZone()?.name,tags:zoneTags(),monsterCount:C.monsters.length,localPool:candidates(currentZone(),{}).map(m=>`${m.id}:${m.name}`)}),
    relation,
  };
  const local=candidates(currentZone(),{tide:!!window.V14BeastTide?.isActive?.()});
  console.info(`[${BUILD}] installed`,{
    monsters:C.monsters.length,
    zone:currentZone()?.name||'荒野',
    tags:zoneTags(),
    localPool:local.map(m=>`${m.id}:${m.name}`),
    regionalPriority:'65%'
  });
  return true;
}

let attempts=0;
const timer=setInterval(()=>{
  attempts++;
  try{
    if(runtimeReady()&&install())clearInterval(timer);
    else if(installed)clearInterval(timer);
    else if(attempts===80){
      console.warn(`[${BUILD}] still waiting`,{
        hasConfig:typeof C!=='undefined'&&Array.isArray(C?.monsters),
        hasGame:typeof g!=='undefined'&&!!g,
        hasStartFight:typeof window.startFightMonster==='function'
      });
    }
  }catch(e){console.warn(`[${BUILD}]`,e)}
},250);
window.addEventListener('beforeunload',()=>clearInterval(timer));
})();
