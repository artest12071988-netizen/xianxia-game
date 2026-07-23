(()=>{
'use strict';
const BUILD='V15.3-PHASE2-FIX7-MONSTER-ART-RUNTIME-BRIDGE';
const REV='20260723-v153-fix7-force-id';
if(window.__V153MonsterArtFix7Loaded)return;
window.__V153MonsterArtFix7Loaded=true;
const get=name=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
const set=(name,value)=>{try{Function('v',name+'=v')(value);return true}catch(_){try{window[name]=value;return true}catch(__){return false}}};
const url=id=>`assets/monsters/monster_${Number(id)}_v153_fix7.webp?v=${REV}`;
const force=monster=>{if(monster&&Number.isFinite(Number(monster.id)))monster.image=url(monster.id);return monster};
let installed=false;
function install(){
 const C=get('C');
 if(!C||!Array.isArray(C.monsters))return false;
 C.monsters.forEach(force);
 const fight=get('fight');if(fight?.enemy)force(fight.enemy);
 if(!installed){
   const oldStart=get('startFightMonster');
   if(typeof oldStart==='function'){
     set('startFightMonster',function(monster){return oldStart(force(monster))});
   }
   installed=true;
 }
 window.V153MonsterArtFix7={build:BUILD,url,refresh:()=>{C.monsters.forEach(force);const f=get('fight');if(f?.enemy)force(f.enemy)}};
 console.info(`[${BUILD}] forced ${C.monsters.length} monster portraits by ID`);
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(timer)},200);
})();
