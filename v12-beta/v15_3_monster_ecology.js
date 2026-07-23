(()=>{
'use strict';
const BUILD='V15.3-PHASE1-FIX2-CORE-ENCOUNTER';
if(window.__V153MonsterEcologyFix2Loaded)return;
window.__V153MonsterEcologyFix2Loaded=true;

const CYCLE={wood:'earth',earth:'water',water:'fire',fire:'metal',metal:'wood'};
const ELEMENT_CLASS={wood:'wood',fire:'fire',earth:'earth',metal:'metal',water:'water'};
const ZONE_TAGS={
 'A-1':['新手','草原','荒野'],'J-2':['新手','草原','荒野'],
 'C-3':['城鎮周邊','荒野'],'C-4':['城鎮周邊','荒野'],
 'C-5':['靈地','山地'],'D-4':['水域','靈地','森林'],
 'E-5':['秘境','山地','森林','遺跡'],'F-2':['廢墟'],
 'B-4':['廢墟'],'G-6':['山地','廢墟'],'H-4':['森林','沼澤'],
 'I-10':['海岸','海域'],'A-6':['安全區'],'B-7':['森林'],
 'D-8':['沙漠'],'F-7':['古戰場'],'H-8':['遺跡','廢墟'],
 'B-9':['崑崙','山地'],'A-10':['天宮','冰原','山地'],
 'C-10':['冰原'],'F-10':['海域'],'H-10':['冰火島','火山','冰原'],
 'J-10':['陰陽海','海域']
};
const state={installed:false,legacyStreak:{},lastMonster:{}};
const get=name=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
const set=(name,value)=>{try{Function('v',name+'=v')(value);return true}catch(_){try{window[name]=value;return true}catch(__){return false}}};
const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
const clone=x=>x?JSON.parse(JSON.stringify(x)):null;
const esc2=s=>{const fn=get('esc');return typeof fn==='function'?fn(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))};
const currentGame=()=>get('g');
const currentConfig=()=>get('C');
const currentZone=()=>{const g=currentGame(),zoneAt=get('zoneAt');return g&&typeof zoneAt==='function'?zoneAt(g.pos.r,g.pos.c):null};
const currentCoord=()=>{const g=currentGame(),coordOf=get('coordOf');return g&&typeof coordOf==='function'?coordOf(g.pos.r,g.pos.c):''};
function tagsFor(z=currentZone()){
 const coord=z?.coord||currentCoord();
 if(ZONE_TAGS[coord])return ZONE_TAGS[coord].slice();
 const text=String(z?.name||'')+' '+String(z?.type||''),tags=[];
 if(/森林|林/.test(text))tags.push('森林');
 if(/沙漠|赤砂/.test(text))tags.push('沙漠');
 if(/冰原|玄霜/.test(text))tags.push('冰原');
 if(/陰陽海/.test(text))tags.push('陰陽海','海域');else if(/海|燈塔/.test(text))tags.push('海岸','海域');
 if(/遺跡/.test(text))tags.push('遺跡');
 if(/廢墟/.test(text))tags.push('廢墟');
 if(/戰場/.test(text))tags.push('古戰場');
 if(/崑崙/.test(text))tags.push('崑崙','山地');
 if(/天宮/.test(text))tags.push('天宮','冰原');
 return tags.length?tags:['荒野'];
}
function compatible(m,z=currentZone()){
 if(!m)return false;
 if(m.ecologyLocked===false||!Array.isArray(m.habitats)||!m.habitats.length)return true;
 const tags=tagsFor(z);
 return m.habitats.some(h=>tags.includes(h));
}
function weighted(list){
 if(!list.length)return null;
 const total=list.reduce((s,m)=>s+Math.max(.1,num(m.spawnWeight,1)),0);
 let r=Math.random()*total;
 for(const m of list){r-=Math.max(.1,num(m.spawnWeight,1));if(r<=0)return m}
 return list[list.length-1];
}
function localPool(z=currentZone(),{tide=false}={}){
 const C=currentConfig(),g=currentGame();
 let pool=(C?.monsters||[]).filter(m=>!['活動王','古魔'].includes(m.cat)&&compatible(m,z));
 if(tide){
   const regular=pool.filter(m=>String(m.spawn||'').includes('獸潮')&&!String(m.spawn||'').includes('獸潮5%'));
   if(regular.length)pool=regular;
 }
 if(z?.novice){
   const novice=pool.filter(m=>num(m.lv)<=3&&num(m.lv)<=num(g?.lv)+1);
   if(novice.length)pool=novice;
 }else{
   const near=pool.filter(m=>Math.abs(num(m.lv)-num(g?.lv))<=3);
   if(near.length)pool=near;
 }
 return pool;
}
function choose(z=currentZone(),opts={}){
 const C=currentConfig(),coord=z?.coord||currentCoord();
 let pool=localPool(z,opts);
 if(opts.tide){
   const bosses=(C?.monsters||[]).filter(m=>String(m.spawn||'').includes('獸潮5%')&&compatible(m,z));
   if(bosses.length&&Math.random()<.05){
     const g=currentGame();
     bosses.sort((a,b)=>Math.abs(num(a.lv)-num(g?.lv))-Math.abs(num(b.lv)-num(g?.lv)));
     return clone(weighted(bosses.slice(0,Math.min(2,bosses.length))));
   }
 }
 if(!pool.length)pool=(C?.monsters||[]).filter(m=>!['活動王','古魔'].includes(m.cat)&&compatible(m,z));
 const regional=pool.filter(m=>num(m.id)>=9401&&num(m.id)<=9415);
 const forceRegional=regional.length&&num(state.legacyStreak[coord])>=2;
 let candidatePool=(regional.length&&(forceRegional||Math.random()<.75))?regional:pool;
 const last=state.lastMonster[coord];
 if(candidatePool.length>1&&last!=null){
   const noRepeat=candidatePool.filter(m=>String(m.id)!==String(last));
   if(noRepeat.length)candidatePool=noRepeat;
 }
 const selected=weighted(candidatePool)||weighted(pool);
 if(selected){
   state.lastMonster[coord]=selected.id;
   state.legacyStreak[coord]=num(selected.id)>=9401&&num(selected.id)<=9415?0:num(state.legacyStreak[coord])+1;
 }
 return clone(selected);
}
function weaponElement(){const g=currentGame();const e=(g?.equipment||[]).find(x=>String(x.uid)===String(g?.weaponUid));return e?.elementEnchant?.key||null}
function armorElement(){const g=currentGame();const e=(g?.equipment||[]).find(x=>String(x.uid)===String(g?.armorUid));return e?.elementEnchant?.key||null}
function relation(attacker,defender){
 if(!attacker||!defender)return {mult:1,label:''};
 if(attacker===defender)return {mult:.90,label:'同屬抗性'};
 if(CYCLE[attacker]===defender)return {mult:1.25,label:'五行克制'};
 if(CYCLE[defender]===attacker)return {mult:.85,label:'五行受制'};
 return {mult:1,label:''};
}
function elementBadge(m){const key=ELEMENT_CLASS[m?.elementKey]||'none';return `<span class="v153-element ${key}">${esc2(m?.element||'無')}屬性</span>`}
function habitatText(m){return Array.isArray(m?.habitats)?m.habitats.join('／'):'不受地域限制'}
function ready(){const C=currentConfig(),g=currentGame();return Array.isArray(C?.monsters)&&C.monsters.length>=32&&!!g&&typeof get('startFightMonster')==='function'}
function install(){
 if(state.installed||!ready())return false;
 const oldStart=get('startFightMonster'),oldRender=get('renderFight'),oldAttack=get('attackTurn'),oldEnemy=get('enemyTurn'),oldDex=get('openMonsterDex');
 const zoneAt=get('zoneAt'),coordOf=get('coordOf'),rnd=get('rnd');

 set('pickMonster',function(z){return choose(z,{tide:!!window.V14BeastTide?.isActive?.()})});
 set('rollEncounter',function(source){
   const g=currentGame(),ai=get('ai')||[],startAiEncounter=get('startAiEncounter'),startFightMonster=get('startFightMonster');
   const z=typeof zoneAt==='function'?zoneAt(g.pos.r,g.pos.c):null;
   if(z&&String(z.type||'').includes('安全區'))return;
   const aiChance=z&&z.novice?.05:.22;
   if(Math.random()<aiChance&&typeof startAiEncounter==='function'){
     let list=ai.filter(a=>a.alive&&a.coord===(typeof coordOf==='function'?coordOf(g.pos.r,g.pos.c):''));
     if(!list.length)list=ai.filter(a=>a.alive&&Math.abs(num(a.lv)-num(g.lv))<=2);
     if(list.length)return startAiEncounter(typeof rnd==='function'?rnd(list):list[Math.floor(Math.random()*list.length)]);
   }
   const tide=!!window.V14BeastTide?.isActive?.();
   const chance=tide?(source==='move'?.50:.70):(source==='move'?.25:.42);
   if(Math.random()<chance){const m=choose(z,{tide});if(m)return startFightMonster(m)}
 });
 set('startFightMonster',function(m){
   const z=currentZone();let selected=m;
   if(!compatible(selected,z))selected=choose(z,{tide:!!window.V14BeastTide?.isActive?.()});
   return oldStart(selected);
 });
 set('renderFight',function(line,speech={}){
   const fight=get('fight'),g=currentGame(),P=get('P'),clamp=get('clamp'),sheet=get('sheet'),fighterPortrait=get('fighterPortrait'),showFightSpeech=get('showFightSpeech');
   if(fight?.kind!=='monster')return oldRender(line,speech);
   const e=fight.enemy,enemyHp=`體力 ${Math.max(0,Math.round(fight.hp))} / ${fight.hpMax}`;
   const enemyBar=`<div class="bar"><i class="enemy-hpf" style="width:${clamp(fight.hp/fight.hpMax*100,0,100)}%"></i></div>`;
   const meta=`<div class="v153-fight-meta">${elementBadge(e)}<span>${esc2(e.trait||'普通妖獸')}</span><span>棲地：${esc2(habitatText(e))}</span></div>`;
   sheet(`<h3>鬥法 · ${esc2(e.name)}</h3><div class="fight-stage"><div class="fighter" id="playerFighter">${fighterPortrait('assets/player_cultivator.svg',g.name)}<strong>${esc2(g.name)}</strong><div class="small">體力 ${Math.max(0,Math.round(g.hp))} / ${g.hpMax}</div></div><div class="fighter enemy" id="enemyFighter">${fighterPortrait(e.image||('assets/monsters/'+e.id+'.svg'),e.name)}<strong>${esc2(e.name)}</strong><div class="small">${enemyHp}</div></div></div>${enemyBar}${meta}<div class="v153-trait"><b>${esc2(e.trait||'妖獸本能')}</b>：${esc2(e.traitText||'無特殊能力')}｜弱點：${esc2(e.weakTo||'無')}</div><p class="small fight-line">${line}</p><div class="row"><button class="btn red" onclick="attackTurn()">攻擊 −${P.normal_attack_mp_cost}精力</button><button class="btn jade" onclick="openCombatItems()">道具／丹藥</button><button class="btn" onclick="fleeTurn()">遁走</button></div>`);
   if(speech.player)setTimeout(()=>showFightSpeech('playerFighter',speech.player,speech.playerType||'normal'),80);
   if(speech.enemy)setTimeout(()=>showFightSpeech('enemyFighter',speech.enemy,speech.enemyType||'normal'),120);
 });
 set('attackTurn',function(){
   const fight=get('fight'),g=currentGame(),P=get('P');if(fight?.kind!=='monster')return oldAttack();
   const renderFight=get('renderFight'),animateStrike=get('animateStrike'),animateDamage=get('animateDamage'),calcDmg=get('calcDmg'),pAtk=get('pAtk'),calcBlockChance=get('calcBlockChance'),clamp=get('clamp'),rnd=get('rnd'),winFight=get('winFight'),getEnemyLine=get('getEnemyLine');
   if(g.mp<P.normal_attack_mp_cost){renderFight('精力不足，無法出手。請使用回精丹或遁走。');return}
   g.mp-=P.normal_attack_mp_cost;const e=fight.enemy,C=currentConfig();
   const attackLine=Math.random()<(P.combat_speech_normal_chance||.42)?rnd(C.combatSpeech.playerAttack):'';
   if(Math.random()<clamp(num(P.encounter_miss_rate)+num(e.evasionBonus),0,.75)){renderFight(`你的攻擊被${e.name}避開。`,{player:attackLine});setTimeout(()=>animateStrike('playerFighter'),40);return setTimeout(()=>get('enemyTurn')(),500)}
   let mult=1,crit=false,rate=P.base_crit_rate+(g.techniques.includes('lightning_breath')?.10:0);if(Math.random()<rate){crit=true;mult=P.base_crit_min+Math.random()*(P.base_crit_max-P.base_crit_min)}
   let dmg=calcDmg(pAtk(),e.def,mult);if(crit&&g.techniques.includes('lightning_breath'))dmg+=50;
   const elem=relation(weaponElement(),e.elementKey);dmg=Math.max(1,Math.round(dmg*elem.mult*(1-num(e.damageReduction))));
   const blocked=Math.random()<clamp(calcBlockChance(e.def,pAtk())+num(e.blockBonus),.04,.60);if(blocked)dmg=Math.max(1,Math.round(dmg*(P.block_damage_multiplier||.35)));
   fight.hp-=dmg;const speech={player:crit?rnd(C.combatSpeech.playerCrit):attackLine,playerType:crit?'crit':'normal'};
   if(blocked){speech.enemy=getEnemyLine('blockLines');speech.enemyType='block'}else if(Math.random()<.35){speech.enemy=getEnemyLine('hitLines');speech.enemyType='hit'}
   renderFight(`你造成 ${dmg} 傷害${crit?'（暴擊）':''}${blocked?'，但對方成功格擋':''}${elem.label?'，'+elem.label+' ×'+elem.mult.toFixed(2):''}。`,speech);
   setTimeout(()=>animateStrike('playerFighter'),40);animateDamage('enemyFighter',dmg,{crit,blocked});if(fight.hp<=0)return setTimeout(winFight,720);setTimeout(()=>get('enemyTurn')(),780);
 });
 set('enemyTurn',function(){
   const fight=get('fight'),g=currentGame(),P=get('P');if(fight?.kind!=='monster')return oldEnemy();if(!fight)return;
   const e=fight.enemy,renderFight=get('renderFight'),getEnemyLine=get('getEnemyLine'),calcDmg=get('calcDmg'),pDef=get('pDef'),calcBlockChance=get('calcBlockChance'),animateStrike=get('animateStrike'),animateDamage=get('animateDamage'),render=get('render'),loseFight=get('loseFight'),rnd=get('rnd'),C=currentConfig();
   const attackLine=Math.random()<.48?getEnemyLine('attackLines'):'';if(Math.random()<P.encounter_miss_rate){renderFight(`${e.name}的攻擊被你避開。`,{enemy:attackLine});return}
   const crit=Math.random()<Math.max(.04,P.base_crit_rate*.65)+num(e.critBonus);const mult=crit?(P.base_crit_min+Math.random()*(P.base_crit_max-P.base_crit_min)):1;
   let dmg=calcDmg(e.atk,pDef(),mult);const elem=relation(e.elementKey,armorElement());dmg=Math.max(1,Math.round(dmg*elem.mult*(1+num(e.damageBonus))));
   const blocked=Math.random()<calcBlockChance(pDef(),e.atk);if(blocked)dmg=Math.max(1,Math.round(dmg*(P.block_damage_multiplier||.35)));g.hp-=dmg;
   const speech={enemy:crit?getEnemyLine('critLines'):attackLine,enemyType:crit?'crit':'normal'};if(blocked){speech.player=rnd(C.combatSpeech.playerBlock);speech.playerType='block'}else if(Math.random()<.38){speech.player=rnd(C.combatSpeech.playerHit);speech.playerType='hit'}
   renderFight(`${e.name}反擊，造成 ${dmg} 傷害${crit?'（暴擊）':''}${blocked?'，你傲然格擋':''}${elem.label?'，'+elem.label+' ×'+elem.mult.toFixed(2):''}。`,speech);setTimeout(()=>animateStrike('enemyFighter'),40);animateDamage('playerFighter',dmg,{crit,blocked});render();if(g.hp<=0)return setTimeout(loseFight,720);
 });
 set('openMonsterDex',function(){
   const C=currentConfig(),sheet=get('sheet');const rows=C.monsters.map(m=>`<div class="monster-card v153-dex-card"><img src="${esc2(m.image||('assets/monsters/'+m.id+'.svg'))}" alt="${esc2(m.name)}"><div><strong>${esc2(m.name)}</strong><span>${esc2(m.cat)} · Lv${m.lv} ${elementBadge(m)}</span><small>體力 ${m.hp}｜攻擊 ${m.atk}｜防禦 ${m.def}<br>特性：${esc2(m.trait||'—')}｜弱點：${esc2(m.weakTo||'—')}<br>出沒：${esc2(m.spawn)}</small></div></div>`).join('');
   sheet(`<h3>妖獸圖鑑 · 地域生態版</h3><p class="small">目前共 ${C.monsters.length} 種怪物。一般探索與獸潮都依所在地棲地篩選。</p><div class="monster-grid">${rows}</div><button class="btn" style="width:100%;margin-top:10px" onclick="closeOv()">關閉圖鑑</button>`);
 });
 state.installed=true;
 window.V153MonsterEcology={
   build:BUILD,pickForZone:(z,opts={})=>choose(z,opts),pick:()=>choose(currentZone(),{tide:!!window.V14BeastTide?.isActive?.()}),
   compatible,zoneTags:()=>tagsFor(),localPool:()=>localPool(currentZone(),{tide:!!window.V14BeastTide?.isActive?.()}).map(m=>({id:m.id,name:m.name,habitats:m.habitats})),
   diagnose:()=>({installed:state.installed,zone:currentZone()?.name,coord:currentCoord(),tags:tagsFor(),monsterCount:currentConfig()?.monsters?.length||0,localPool:localPool().map(m=>`${m.id}:${m.name}`),legacyStreak:state.legacyStreak[currentCoord()]||0}),relation
 };
 console.info(`[${BUILD}] installed`,window.V153MonsterEcology.diagnose());return true;
}
let attempts=0;const timer=setInterval(()=>{attempts++;try{if(install()||state.installed)clearInterval(timer);else if(attempts===80)console.warn(`[${BUILD}] waiting`,{monsterCount:currentConfig()?.monsters?.length||0,hasGame:!!currentGame(),hasStart:typeof get('startFightMonster')==='function'})}catch(e){console.warn(`[${BUILD}]`,e)}},250);
window.addEventListener('beforeunload',()=>clearInterval(timer));
})();
