(()=>{
'use strict';
const BUILD='V15.3-PHASE2-FIX5-QINGNIU-NOVICE-RING';
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
const state={installed:false};
const TERRAIN_POOLS={"desert":[9401,9402,9403,9413],"forest":[9001,9002,9404,9405,9406],"ice":[9407,9408,9409],"northpalace":[9407,9408,9409],"sea":[9410,9411,9412],"yinyang":[9410,9411,9412],"icefire":[9408,9413],"battle":[9414,9415],"ruin":[9404,9414,9415],"kunlun":[9406,9415],"mountain":[9001,9002,9406,9415],"village":[9001,9002],"lighthouse":[9410,9412],"abyss":[9414,9415],"market":[]};
const QINGNIU_NOVICE_COORDS=new Set([
 'D-3','D-4','D-5',
 'E-3','E-4','E-5',
 'F-3','F-4','F-5'
]);
const QINGNIU_LOW_MONSTER_IDS=[9001,9002];
function isQingniuNoviceCoord(coord){
 return QINGNIU_NOVICE_COORDS.has(String(coord||''));
}
const BEAST_TIDE_ONLY_IDS=new Set([9004,9005,9006,9101,9102,9103]);
const REQUIRED_NEW_IDS=[...Array.from({length:15},(_,i)=>9401+i),9421,9422,9423,9424,9425];
const ELITE_CHANCE=.05;
const ELITE_BY_TERRAIN={desert:9421,ice:9422,northpalace:9422,forest:9423,sea:9424,yinyang:9424,lighthouse:9424,battle:9425};

const get=name=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
const set=(name,value)=>{try{Function('v',name+'=v')(value);return true}catch(_){try{window[name]=value;return true}catch(__){return false}}};
const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
const clone=x=>x?JSON.parse(JSON.stringify(x)):null;
const esc2=s=>{const fn=get('esc');return typeof fn==='function'?fn(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))};
const currentGame=()=>get('g');
const currentConfig=()=>get('C');
const currentConfigZone=()=>{const g=currentGame(),zoneAt=get('zoneAt');return g&&typeof zoneAt==='function'?zoneAt(g.pos.r,g.pos.c):null};
const currentCoord=()=>{const g=currentGame(),coordOf=get('coordOf');return g&&typeof coordOf==='function'?coordOf(g.pos.r,g.pos.c):''};
function resolveTerrain(z=null){
 const g=currentGame(),coordOf=get('coordOf');
 try{
   const fixed=window.V144_FIXED_MAP?.infoFor?.(g.pos.r,g.pos.c);
   if(fixed?.type)return {name:String(fixed.label||fixed.terrainLabel||fixed.type),type:String(fixed.type),coord:String(fixed.coord||currentCoord()),source:'V144_FIXED_MAP'};
 }catch(err){console.warn(`[${BUILD}] fixed map resolve failed`,err)}
 const base=z||currentConfigZone();
 const name=String(base?.name||''),type=String(base?.type||''),text=name+' '+type;
 let terrain='';
 if(/萬寶交易所|交易所|安全區/.test(text))terrain='market';
 else if(/赤砂荒漠|赤沙荒漠|沙漠/.test(text))terrain='desert';
 else if(/萬木森域|迷霧林|樹海|森林/.test(text))terrain='forest';
 else if(/北天宮|北寒天宮|天宮/.test(text))terrain='northpalace';
 else if(/玄霜冰原|冰原/.test(text))terrain='ice';
 else if(/陰陽海/.test(text))terrain='yinyang';
 else if(/冰火島/.test(text))terrain='icefire';
 else if(/鎮海燈塔|鎮海海域/.test(text))terrain='lighthouse';
 else if(/滄溟外海|(^|[^陰陽])海域|(^|[^陰陽])海$/.test(text))terrain='sea';
 else if(/太古戰場|遠古戰場|古戰場/.test(text))terrain='battle';
 else if(/上古遺跡|古代遺跡|遺跡|廢墟/.test(text))terrain='ruin';
 else if(/崑崙仙山|崑崙山|崑崙/.test(text))terrain='kunlun';
 else if(/魔淵/.test(text))terrain='abyss';
 else if(/青牛谷|清牛谷|練氣坊|新手村/.test(text))terrain='village';
 else if(/山域|山地|神祠|山$/.test(text))terrain='mountain';
 return {name:name||'未知地域',type:terrain,coord:String(base?.coord||currentCoord()),source:'CONFIG_ZONE_FALLBACK'};
}
function tagsFor(z=null){
 const region=resolveTerrain(z);
 const map={desert:['沙漠'],forest:['森林','沼澤'],ice:['冰原'],northpalace:['天宮','冰原','山地'],sea:['海域'],yinyang:['陰陽海','海域'],icefire:['冰火島','火山','冰原'],battle:['古戰場'],ruin:['遺跡','廢墟'],kunlun:['崑崙','山地'],mountain:['山地'],village:['新手','草原','荒野'],lighthouse:['海岸','海域'],abyss:['廢墟'],market:['安全區']};
 return map[region.type]||[];
}
function compatible(m,z=null){
 if(!m)return false;
 if(m.ecologyLocked===false||!Array.isArray(m.habitats)||!m.habitats.length)return true;
 const tags=tagsFor(z);return m.habitats.some(h=>tags.includes(h));
}
function randomOne(list){
 if(!Array.isArray(list)||!list.length)return null;
 return list[Math.floor(Math.random()*list.length)]||null;
}
function tideActive(){
 try{return window.V14BeastTide?.isActive?.()===true}catch(_){return false}
}
function blackCloudActiveHere(){
 try{return window.V14BlackCloud?.isInside?.()===true}catch(_){return false}
}
function monsterById(id){
 return (currentConfig()?.monsters||[]).find(m=>Number(m.id)===Number(id))||null;
}
function localPool(z=null){
 const region=resolveTerrain(z);
 const ids=isQingniuNoviceCoord(region.coord)
   ?QINGNIU_LOW_MONSTER_IDS
   :TERRAIN_POOLS[region.type];
 if(!Array.isArray(ids))return [];
 return ids
   .map(monsterById)
   .filter(Boolean)
   .filter(m=>m.normalEncounter!==false);
}
function choose(z=null){
 const region=resolveTerrain(z);
 if(region.type==='market')return null;
 const noviceArea=isQingniuNoviceCoord(region.coord);
 const ids=noviceArea
   ?QINGNIU_LOW_MONSTER_IDS
   :TERRAIN_POOLS[region.type];
 if(!Array.isArray(ids)){
   console.error(`[${BUILD}] undefined terrain pool`,region);
   const toast=get('toast');if(typeof toast==='function')toast('目前地貌尚未設定怪物生態：'+region.name);
   return null;
 }
 const pool=localPool(z);
 if(!pool.length){
   const missing=ids.filter(id=>!monsterById(id));
   console.error(`[${BUILD}] terrain pool load failed`,{region,ids,missing,catalogCount:currentConfig()?.monsters?.length||0});
   const toast=get('toast');if(typeof toast==='function')toast(missing.length?'怪物設定缺少 ID：'+missing.join('、'):'目前地貌沒有可遭遇怪物。');
   return null;
 }
 const eliteId=noviceArea?null:ELITE_BY_TERRAIN[region.type];
 const elite=eliteId?monsterById(eliteId):null;
 const selected=(elite&&Math.random()<ELITE_CHANCE)?elite:randomOne(pool);
 console.info(`[${BUILD}] fixed-map terrain encounter`,{region,eliteRoll:!!(selected?.elite),pool:pool.map(m=>`${m.id}:${m.name}`),selected:selected?`${selected.id}:${selected.name}`:null});
 return clone(selected);
}
function validateIncoming(monster,z=null){
 if(!monster)return null;
 const id=Number(monster.id),region=resolveTerrain(z);
 if(BEAST_TIDE_ONLY_IDS.has(id)&&!tideActive()){
   console.warn(`[${BUILD}] blocked beast-tide-only monster`,{id,name:monster.name,region});return choose(z);
 }
 if(id===9003&&!tideActive()&&!blackCloudActiveHere()){
   console.warn(`[${BUILD}] blocked black-cloud/tide monster`,{id,name:monster.name,region});return choose(z);
 }
 if(monster.normalEncounter===false)return monster;
 const eliteId=isQingniuNoviceCoord(region.coord)
   ?null
   :ELITE_BY_TERRAIN[region.type];
 if(monster.elite===true&&Number(eliteId)===id)return monster;
 const allowed=localPool(z).some(m=>Number(m.id)===id);
 if(!allowed){console.warn(`[${BUILD}] replaced wrong-terrain monster`,{id,name:monster.name,region});return choose(z)}
 return monster;
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
function ensureCombatState(fight){
 if(!fight)return null;
 if(!fight.v153Status||typeof fight.v153Status!=='object')fight.v153Status={poison:null,burn:null,slow:null};
 return fight.v153Status;
}
function statusText(fight){
 const s=ensureCombatState(fight),out=[];
 if(s?.poison?.turns>0)out.push(`<span class="v153-status poison">中毒 ${s.poison.turns}回合</span>`);
 if(s?.burn?.turns>0)out.push(`<span class="v153-status burn">灼燒 ${s.burn.turns}回合</span>`);
 if(s?.slow?.turns>0)out.push(`<span class="v153-status slow">寒緩 ${s.slow.turns}回合</span>`);
 return out.join('');
}
function effectDescription(e){
 const x=e?.combatEffect;if(!x)return '';
 const names={poison:'中毒',burn:'灼燒',slow:'緩速',multi_hit:'群體連擊',tide:'潮汐傷害',drain_mp:'吸取精力',abyssal_tide:'潮汐傷害＋吸精',entangle:'藤纏緩速＋吸精',heavy_strike:'戰魂重斬'};
 return names[x.type]||x.label||'';
}
function dotDamage(g,effect){
 return Math.max(num(effect?.minDamage,1),Math.min(num(effect?.maxDamage,999999),Math.round(num(g?.hpMax)*num(effect?.damagePct))));
}
function applyTimedStatus(fight,key,effect){
 const s=ensureCombatState(fight),current=s[key];
 if(!current||num(effect.turns)>num(current.turns)||num(effect.damagePct)>num(current.damagePct))s[key]={...effect};
 else current.turns=Math.max(num(current.turns),num(effect.turns));
}
function tickDots(fight,g){
 const s=ensureCombatState(fight),parts=[],ticks=[];let total=0;
 for(const key of ['poison','burn']){
   const x=s[key];if(!x||num(x.turns)<=0)continue;
   const dmg=dotDamage(g,x);g.hp-=dmg;total+=dmg;x.turns--;
   parts.push(`${key==='poison'?'毒素':'灼火'}發作，受到 ${dmg} 傷害`);
   ticks.push({type:key,damage:dmg});
   if(x.turns<=0)s[key]=null;
 }
 return {total,parts,ticks};
}
function applySpecialAfterHit(fight,g,e,baseDamage){
 const x=e?.combatEffect;if(!x||x.type==='multi_hit'||Math.random()>=num(x.chance))return {extraDamage:0,mpDrain:0,parts:[],effectType:null,label:''};
 const parts=[];let extraDamage=0,mpDrain=0;
 if(x.type==='poison'){applyTimedStatus(fight,'poison',x);parts.push(`陷入【${x.label}】`)}
 else if(x.type==='burn'){applyTimedStatus(fight,'burn',x);parts.push(`陷入【${x.label}】`)}
 else if(x.type==='slow'){applyTimedStatus(fight,'slow',x);parts.push(`受到【${x.label}】影響`)}
 else if(x.type==='tide'||x.type==='heavy_strike'){
   extraDamage=Math.max(1,Math.round(baseDamage*num(x.bonusDamage)));parts.push(`【${x.label}】追加 ${extraDamage} 傷害`);
 }
 else if(x.type==='drain_mp'){
   mpDrain=Math.max(num(x.minDrain,1),Math.min(num(x.maxDrain,999999),Math.round(num(g.mpMax)*num(x.mpPct))));g.mp=Math.max(0,num(g.mp)-mpDrain);parts.push(`【${x.label}】吸取 ${mpDrain} 精力`);
 }
 else if(x.type==='abyssal_tide'){
   extraDamage=Math.max(1,Math.round(baseDamage*num(x.bonusDamage)));
   mpDrain=Math.max(num(x.minDrain,1),Math.min(num(x.maxDrain,999999),Math.round(num(g.mpMax)*num(x.mpPct))));g.mp=Math.max(0,num(g.mp)-mpDrain);
   parts.push(`【${x.label}】追加 ${extraDamage} 傷害並吸取 ${mpDrain} 精力`);
 }
 else if(x.type==='entangle'){
   applyTimedStatus(fight,'slow',x);
   mpDrain=Math.max(num(x.minDrain,1),Math.min(num(x.maxDrain,999999),Math.round(num(g.mpMax)*num(x.mpPct))));g.mp=Math.max(0,num(g.mp)-mpDrain);
   parts.push(`【${x.label}】纏住身法並吸取 ${mpDrain} 精力`);
 }
 return {extraDamage,mpDrain,parts,effectType:x.type,label:x.label||''};
}


function battleFxMarkup(fight){
 const s=ensureCombatState(fight);
 const poison=!!(s?.poison&&num(s.poison.turns)>0);
 const burn=!!(s?.burn&&num(s.burn.turns)>0);
 const slow=!!(s?.slow&&num(s.slow.turns)>0);
 const flames=Array.from({length:12},(_,i)=>`<i style="--i:${i}"></i>`).join('');
 const ice=Array.from({length:9},(_,i)=>`<i style="--i:${i}"></i>`).join('');
 return `<div class="v153-battle-fx ${poison?'poison-active':''} ${burn?'burn-active':''} ${slow?'slow-active':''}">
   <div class="v153-poison-ambience"></div>
   <div class="v153-burn-floor">${flames}</div>
   <div class="v153-ice-floor">${ice}</div>
   <div class="v153-transient-fx" data-v153-transient></div>
 </div>`;
}
function fxStage(){
 return document.querySelector('.fight-stage');
}
function transientLayer(){
 return document.querySelector('[data-v153-transient]');
}
function safeVibrate(pattern){
 try{navigator.vibrate?.(pattern)}catch(_){}
}
function pulseClass(target,className,duration=420){
 if(!target)return;
 target.classList.remove(className);
 void target.offsetWidth;
 target.classList.add(className);
 setTimeout(()=>target?.classList.remove(className),duration);
}
function spawnFloat(value,kind='damage',index=0,delay=0,label=''){
 setTimeout(()=>{
   const layer=transientLayer();if(!layer)return;
   const positions=[
     [26,34],[35,47],[20,55],[39,28],
     [30,61],[17,40],[42,56],[24,24]
   ];
   const [x,y]=positions[index%positions.length];
   const el=document.createElement('div');
   el.className=`v153-fx-number ${kind}`;
   el.style.left=x+'%';
   el.style.top=y+'%';
   el.innerHTML=`${label?`<small>${esc2(label)}</small>`:''}<b>${esc2(value)}</b>`;
   layer.appendChild(el);
   setTimeout(()=>el.remove(),1150);
 },delay);
}
function microShake(delay=0,strong=false){
 setTimeout(()=>{
   const fighter=document.getElementById('playerFighter');
   const stage=fxStage();
   pulseClass(fighter,strong?'v153-hit-shake-strong':'v153-hit-shake',strong?360:210);
   if(strong)pulseClass(stage,'v153-stage-shake',440);
   safeVibrate(strong?[28,20,38]:18);
 },delay);
}
function playMultiHitVisual(hitDamages=[],crit=false,startDelay=40){
 const animateStrike=get('animateStrike');
 hitDamages.forEach((damage,i)=>{
   const delay=startDelay+i*190;
   setTimeout(()=>{if(typeof animateStrike==='function')animateStrike('enemyFighter')},delay);
   spawnFloat('-'+Math.max(1,Math.round(damage)),crit?'crit':'damage',i,delay,`${i+1} HIT`);
   microShake(delay, i===hitDamages.length-1);
 });
}
function playDotTicks(ticks=[],startDelay=30){
 ticks.forEach((tick,i)=>{
   const delay=startDelay+i*230;
   const kind=tick.type==='burn'?'burn':'poison';
   const label=tick.type==='burn'?'灼燒':'毒傷';
   spawnFloat('-'+Math.round(tick.damage),kind,i,delay,label);
   microShake(delay,false);
   setTimeout(()=>{
     const stage=fxStage();
     pulseClass(stage,tick.type==='burn'?'v153-burn-tick':'v153-poison-tick',620);
   },delay);
 });
}
function playStatusApplyVisual(type,delay=0){
 setTimeout(()=>{
   const stage=fxStage();if(!stage)return;
   if(type==='poison'){
     pulseClass(stage,'v153-poison-apply',900);
     spawnFloat('中毒','status-poison',0,0,'異常狀態');
   }else if(type==='burn'){
     pulseClass(stage,'v153-burn-apply',900);
     spawnFloat('灼燒','status-burn',1,0,'異常狀態');
   }else if(type==='slow'){
     pulseClass(stage,'v153-slow-apply',1000);
     spawnFloat('寒緩','status-slow',2,0,'異常狀態');
   }
 },delay);
}
function playTideVisual(damage,delay=0,label='潮汐傷害'){
 setTimeout(()=>{
   const layer=transientLayer();if(!layer)return;
   const wave=document.createElement('div');
   wave.className='v153-tide-wave';
   wave.innerHTML='<i></i><i></i><i></i>';
   layer.appendChild(wave);
   pulseClass(fxStage(),'v153-tide-impact',820);
   safeVibrate([35,30,55]);
   setTimeout(()=>wave.remove(),1000);
   if(num(damage)>0)spawnFloat('-'+Math.round(damage),'tide',3,270,label);
 },delay);
}
function playDrainVisual(mpDrain,delay=0){
 setTimeout(()=>{
   const layer=transientLayer();if(!layer)return;
   const orb=document.createElement('div');
   orb.className='v153-drain-orb';
   orb.innerHTML='<i></i><span></span>';
   layer.appendChild(orb);
   spawnFloat('-'+Math.round(mpDrain)+' 精力','drain',4,180,'吸取');
   safeVibrate(22);
   setTimeout(()=>orb.remove(),1100);
 },delay);
}
function playHeavyStrikeVisual(damage,delay=0){
 setTimeout(()=>{
   const layer=transientLayer();if(!layer)return;
   const slash=document.createElement('div');
   slash.className='v153-heavy-slash';
   layer.appendChild(slash);
   pulseClass(fxStage(),'v153-stage-shake',520);
   safeVibrate([45,20,65]);
   if(num(damage)>0)spawnFloat('-'+Math.round(damage),'heavy',5,120,'追加重擊');
   setTimeout(()=>slash.remove(),720);
 },delay);
}
function playSpecialVisual(effectType,extraDamage=0,mpDrain=0,delay=0){
 if(!effectType)return;
 if(effectType==='poison'||effectType==='burn'||effectType==='slow'){
   playStatusApplyVisual(effectType,delay);
 }else if(effectType==='tide'){
   playTideVisual(extraDamage,delay);
 }else if(effectType==='drain_mp'){
   playDrainVisual(mpDrain,delay);
 }else if(effectType==='abyssal_tide'){
   playTideVisual(extraDamage,delay,'深淵潮噬');
   playDrainVisual(mpDrain,delay+300);
 }else if(effectType==='entangle'){
   playStatusApplyVisual('slow',delay);
   playDrainVisual(mpDrain,delay+220);
 }else if(effectType==='heavy_strike'){
   playHeavyStrikeVisual(extraDamage,delay);
 }
}

function ready(){
 const C=currentConfig(),g=currentGame();
 const ids=new Set((C?.monsters||[]).map(m=>Number(m.id)));
 const catalogReady=Array.isArray(C?.monsters)&&C.monsters.length>=37&&REQUIRED_NEW_IDS.every(id=>ids.has(id));
 return catalogReady&&!!g&&typeof get('startFightMonster')==='function';
}
function install(){
 if(state.installed||!ready())return false;
 const oldStart=get('startFightMonster'),oldRender=get('renderFight'),oldAttack=get('attackTurn'),oldEnemy=get('enemyTurn'),oldDex=get('openMonsterDex');
 const zoneAt=get('zoneAt'),coordOf=get('coordOf'),rnd=get('rnd');

 set('pickMonster',function(z){return choose(z)});
 set('rollEncounter',function(source){
   const g=currentGame(),ai=get('ai')||[],startAiEncounter=get('startAiEncounter'),startFightMonster=get('startFightMonster');
   const z=typeof zoneAt==='function'?zoneAt(g.pos.r,g.pos.c):null,region=resolveTerrain(z);
   if(region.type==='market'||(z&&String(z.type||'').includes('安全區')))return;
   const aiChance=z&&z.novice?.05:.22;
   if(Math.random()<aiChance&&typeof startAiEncounter==='function'){
     let list=ai.filter(a=>a.alive&&a.coord===(typeof coordOf==='function'?coordOf(g.pos.r,g.pos.c):''));
     if(!list.length)list=ai.filter(a=>a.alive&&Math.abs(num(a.lv)-num(g.lv))<=2);
     if(list.length)return startAiEncounter(typeof rnd==='function'?rnd(list):list[Math.floor(Math.random()*list.length)]);
   }
   const chance=source==='move'?.25:.42;
   if(Math.random()<chance){
     const monster=choose(z);
     if(monster)return startFightMonster(monster);
   }
 });
 set('startFightMonster',function(m){
   const selected=validateIncoming(m,currentConfigZone());
   if(!selected)return;
   const result=oldStart(selected);
   const currentFight=get('fight');if(currentFight?.kind==='monster')ensureCombatState(currentFight);
   return result;
 });
 set('renderFight',function(line,speech={}){
   const fight=get('fight'),g=currentGame(),P=get('P'),clamp=get('clamp'),sheet=get('sheet'),fighterPortrait=get('fighterPortrait'),showFightSpeech=get('showFightSpeech');
   if(fight?.kind!=='monster')return oldRender(line,speech);
   const e=fight.enemy,enemyHp=`體力 ${Math.max(0,Math.round(fight.hp))} / ${fight.hpMax}`;
   const enemyBar=`<div class="bar"><i class="enemy-hpf" style="width:${clamp(fight.hp/fight.hpMax*100,0,100)}%"></i></div>`;
   const eliteBadge=e.elite?'<span class="v153-elite">地域精英 · 5%</span>':'';
   const sceneFx=battleFxMarkup(fight);
   const meta=`<div class="v153-fight-meta">${eliteBadge}${elementBadge(e)}<span>${esc2(e.trait||'普通妖獸')}</span><span>棲地：${esc2(habitatText(e))}</span>${statusText(fight)}</div>`;
   sheet(`<h3>鬥法 · ${esc2(e.name)}${e.elite?' <em class="v153-elite-title">精英</em>':''}</h3><div class="fight-stage"><div class="fighter" id="playerFighter">${fighterPortrait('assets/player_cultivator.svg',g.name)}<strong>${esc2(g.name)}</strong><div class="small">體力 ${Math.max(0,Math.round(g.hp))} / ${g.hpMax}</div></div><div class="fighter enemy" id="enemyFighter">${fighterPortrait(e.image||('assets/monsters/'+e.id+'.svg'),e.name)}<strong>${esc2(e.name)}</strong><div class="small">${enemyHp}</div></div>${sceneFx}</div>${enemyBar}${meta}<div class="v153-trait"><b>${esc2(e.trait||'妖獸本能')}</b>：${esc2(e.traitText||'無特殊能力')}｜弱點：${esc2(e.weakTo||'無')}${effectDescription(e)?'｜異能：'+esc2(effectDescription(e)):''}</div><p class="small fight-line">${line}</p><div class="row"><button class="btn red" onclick="attackTurn()">攻擊 −${P.normal_attack_mp_cost}精力</button><button class="btn jade" onclick="openCombatItems()">道具／丹藥</button><button class="btn" onclick="fleeTurn()">遁走</button></div>`);
   if(speech.player)setTimeout(()=>showFightSpeech('playerFighter',speech.player,speech.playerType||'normal'),80);
   if(speech.enemy)setTimeout(()=>showFightSpeech('enemyFighter',speech.enemy,speech.enemyType||'normal'),120);
 });
 set('attackTurn',function(){
   const fight=get('fight'),g=currentGame(),P=get('P');if(fight?.kind!=='monster')return oldAttack();
   const renderFight=get('renderFight'),animateStrike=get('animateStrike'),animateDamage=get('animateDamage'),calcDmg=get('calcDmg'),pAtk=get('pAtk'),calcBlockChance=get('calcBlockChance'),clamp=get('clamp'),rnd=get('rnd'),winFight=get('winFight'),getEnemyLine=get('getEnemyLine');
   const status=ensureCombatState(fight),slow=status.slow&&num(status.slow.turns)>0?status.slow:null;
   if(g.mp<P.normal_attack_mp_cost){renderFight('精力不足，無法出手。請使用回精丹或遁走。');return}
   g.mp-=P.normal_attack_mp_cost;const e=fight.enemy,C=currentConfig();
   const attackLine=Math.random()<(P.combat_speech_normal_chance||.42)?rnd(C.combatSpeech.playerAttack):'';
   const missChance=clamp(num(P.encounter_miss_rate)+num(e.evasionBonus)+(slow?num(slow.missBonus):0),0,.80);
   if(Math.random()<missChance){
     if(slow){slow.turns--;if(slow.turns<=0)status.slow=null}
     renderFight(`你的攻擊被${e.name}避開${slow?'，寒緩令身法遲滯':''}。`,{player:attackLine});setTimeout(()=>animateStrike('playerFighter'),40);return setTimeout(()=>get('enemyTurn')(),500)
   }
   let mult=1,crit=false,rate=P.base_crit_rate+(g.techniques.includes('lightning_breath')?.10:0);if(Math.random()<rate){crit=true;mult=P.base_crit_min+Math.random()*(P.base_crit_max-P.base_crit_min)}
   let dmg=calcDmg(pAtk(),e.def,mult);if(crit&&g.techniques.includes('lightning_breath'))dmg+=50;
   const elem=relation(weaponElement(),e.elementKey);dmg=Math.max(1,Math.round(dmg*elem.mult*(1-num(e.damageReduction))*(slow?num(slow.damageMultiplier,.75):1)));
   const blocked=Math.random()<clamp(calcBlockChance(e.def,pAtk())+num(e.blockBonus),.04,.60);if(blocked)dmg=Math.max(1,Math.round(dmg*(P.block_damage_multiplier||.35)));
   if(slow){slow.turns--;if(slow.turns<=0)status.slow=null}
   fight.hp-=dmg;const speech={player:crit?rnd(C.combatSpeech.playerCrit):attackLine,playerType:crit?'crit':'normal'};
   if(blocked){speech.enemy=getEnemyLine('blockLines');speech.enemyType='block'}else if(Math.random()<.35){speech.enemy=getEnemyLine('hitLines');speech.enemyType='hit'}
   renderFight(`你造成 ${dmg} 傷害${crit?'（暴擊）':''}${blocked?'，但對方成功格擋':''}${elem.label?'，'+elem.label+' ×'+elem.mult.toFixed(2):''}${slow?'；寒緩使傷害降低':''}。`,speech);
   setTimeout(()=>animateStrike('playerFighter'),40);animateDamage('enemyFighter',dmg,{crit,blocked});if(fight.hp<=0)return setTimeout(winFight,720);setTimeout(()=>get('enemyTurn')(),780);
 });
 set('enemyTurn',function(){
   const fight=get('fight'),g=currentGame(),P=get('P');if(fight?.kind!=='monster')return oldEnemy();if(!fight)return;
   const e=fight.enemy,renderFight=get('renderFight'),getEnemyLine=get('getEnemyLine'),calcDmg=get('calcDmg'),pDef=get('pDef'),calcBlockChance=get('calcBlockChance'),animateStrike=get('animateStrike'),animateDamage=get('animateDamage'),render=get('render'),loseFight=get('loseFight'),rnd=get('rnd'),C=currentConfig();
   const dot=tickDots(fight,g);
   if(g.hp<=0){
     renderFight(dot.parts.join('；')+'。');
     setTimeout(()=>playDotTicks(dot.ticks||[]),30);
     render();
     return setTimeout(loseFight,650);
   }
   const attackLine=Math.random()<.48?getEnemyLine('attackLines'):'';
   if(Math.random()<P.encounter_miss_rate){
     renderFight(`${dot.parts.length?dot.parts.join('；')+'；':''}${e.name}的攻擊被你避開。`,{enemy:attackLine});
     setTimeout(()=>playDotTicks(dot.ticks||[]),30);
     render();
     return;
   }

   const crit=Math.random()<Math.max(.04,P.base_crit_rate*.65)+num(e.critBonus);
   const mult=crit?(P.base_crit_min+Math.random()*(P.base_crit_max-P.base_crit_min)):1;
   let base=calcDmg(e.atk,pDef(),mult);
   const elem=relation(e.elementKey,armorElement());
   base=Math.max(1,Math.round(base*elem.mult*(1+num(e.damageBonus))));

   const effect=e.combatEffect||null;
   let hitDamages=null;
   let directDamage=base;
   let hitCount=1;
   const specialParts=[];

   if(effect?.type==='multi_hit'&&Math.random()<num(effect.chance)){
     hitCount=Math.floor(
       num(effect.minHits,2)+
       Math.random()*(num(effect.maxHits,4)-num(effect.minHits,2)+1)
     );
     const perHit=Math.max(1,Math.round(base*num(effect.hitMultiplier,.45)));
     hitDamages=Array.from({length:hitCount},()=>perHit);
     directDamage=hitDamages.reduce((sum,v)=>sum+v,0);
     specialParts.push(`【${effect.label}】連擊 ${hitCount} 次`);
   }

   const blocked=Math.random()<calcBlockChance(pDef(),e.atk);
   if(blocked){
     if(hitDamages){
       hitDamages=hitDamages.map(v=>Math.max(1,Math.round(v*(P.block_damage_multiplier||.35))));
       directDamage=hitDamages.reduce((sum,v)=>sum+v,0);
     }else{
       directDamage=Math.max(1,Math.round(directDamage*(P.block_damage_multiplier||.35)));
     }
   }

   const special=applySpecialAfterHit(fight,g,e,directDamage);
   const totalDamage=directDamage+special.extraDamage;
   specialParts.push(...special.parts);
   g.hp-=totalDamage;

   const speech={
     enemy:crit?getEnemyLine('critLines'):attackLine,
     enemyType:crit?'crit':'normal'
   };
   if(blocked){
     speech.player=rnd(C.combatSpeech.playerBlock);
     speech.playerType='block';
   }else if(Math.random()<.38){
     speech.player=rnd(C.combatSpeech.playerHit);
     speech.playerType='hit';
   }

   const pieces=[];
   if(dot.parts.length)pieces.push(dot.parts.join('；'));
   pieces.push(
     `${e.name}反擊，造成 ${totalDamage} 傷害${crit?'（暴擊）':''}`+
     `${blocked?'，你傲然格擋':''}`+
     `${elem.label?'，'+elem.label+' ×'+elem.mult.toFixed(2):''}`
   );
   if(specialParts.length)pieces.push(specialParts.join('；'));

   renderFight(pieces.join('；')+'。',speech);
   render();

   const dotDelay=30;
   const attackDelay=(dot.ticks||[]).length?360:60;
   setTimeout(()=>playDotTicks(dot.ticks||[]),dotDelay);

   if(hitDamages){
     playMultiHitVisual(hitDamages,crit,attackDelay);
   }else{
     setTimeout(()=>{
       if(typeof animateStrike==='function')animateStrike('enemyFighter');
       if(typeof animateDamage==='function')animateDamage('playerFighter',directDamage,{crit,blocked});
       microShake(0,crit);
     },attackDelay);
   }

   const directDuration=hitDamages?hitDamages.length*190+140:300;
   playSpecialVisual(
     special.effectType,
     special.extraDamage,
     special.mpDrain,
     attackDelay+directDuration
   );

   if(g.hp<=0){
     const totalVisualTime=attackDelay+directDuration+
       (special.effectType==='abyssal_tide'?900:550);
     return setTimeout(loseFight,totalVisualTime);
   }
 });
 set('openMonsterDex' ,function(){
   const C=currentConfig(),sheet=get('sheet');const rows=C.monsters.map(m=>`<div class="monster-card v153-dex-card"><img src="${esc2(m.image||('assets/monsters/'+m.id+'.svg'))}" alt="${esc2(m.name)}"><div><strong>${esc2(m.name)}</strong><span>${esc2(m.cat)} · Lv${m.lv} ${m.elite?'<span class="v153-elite">精英</span>':''} ${elementBadge(m)}</span><small>體力 ${m.hp}｜攻擊 ${m.atk}｜防禦 ${m.def}<br>特性：${esc2(m.trait||'—')}｜弱點：${esc2(m.weakTo||'—')}<br>出沒：${esc2(m.spawn)}</small></div></div>`).join('');
   sheet(`<h3>妖獸圖鑑 · 地域生態版</h3><p class="small">目前共 ${C.monsters.length} 種怪物。地域精英在指定地貌以 5% 機率出現；未增加任何新物品。</p><div class="monster-grid">${rows}</div><button class="btn" style="width:100%;margin-top:10px" onclick="closeOv()">關閉圖鑑</button>`);
 });
 state.installed=true;
 window.V153MonsterEcology={
   build:BUILD,
   pickForZone:(z)=>choose(z),
   pick:()=>choose(currentConfigZone()),
   compatible,
   zoneTags:()=>tagsFor(currentConfigZone()),
   localPool:()=>localPool(currentConfigZone()).map(m=>({id:m.id,name:m.name,habitats:m.habitats})),
   diagnose:()=>({
     installed:state.installed,
     catalogVersion:currentConfig()?.version,
     catalogCount:currentConfig()?.monsters?.length||0,
     configZone:currentConfigZone()?.name||null,
     region:resolveTerrain(currentConfigZone()),
     coord:currentCoord(),
     beastTideActive:tideActive(),
     selectionRule:'以十方山海圖地貌為唯一來源；5%地域精英，其餘一般池等機率；獸潮專屬怪隔離',
     eliteChance:ELITE_CHANCE,
     localPool:localPool(currentConfigZone()).map(m=>`${m.id}:${m.name}`)
   }),
   relation
 };
 console.info(`[${BUILD}] installed`,window.V153MonsterEcology.diagnose());return true;
}
let attempts=0;const timer=setInterval(()=>{attempts++;try{if(install()||state.installed)clearInterval(timer);else if(attempts===80)console.warn(`[${BUILD}] waiting`,{monsterCount:currentConfig()?.monsters?.length||0,hasGame:!!currentGame(),hasStart:typeof get('startFightMonster')==='function'})}catch(e){console.warn(`[${BUILD}]`,e)}},250);
window.addEventListener('beforeunload',()=>clearInterval(timer));
})();
