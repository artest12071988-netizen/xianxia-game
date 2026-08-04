/* 修仙大逃殺 V15.4｜探索場景視覺 FIX6
   依最新指示：停用獨立修士合成層，十地域直接使用完整場景圖（純單張場景），保留 UI 與玩法。 */
(function(){
'use strict';
const VERSION='V15.4-VISUAL-SCENE-ART-FIX6-20260804';
const ROOT='assets/visual_v154_fix4/';
const DESKTOP=window.matchMedia('(min-width:781px)');
const DISPLAY={
  icefire:'冰火島',ice:'冰原',battle:'遠古戰場',ruin:'上古遺跡',desert:'沙漠',
  forest:'樹海',yinyang:'陰陽海',northpalace:'北寒天宮',sea:'海',mountain:'崑崙山'
};
const SUPPORTED=new Set(Object.keys(DISPLAY));
const byId=id=>document.getElementById(id);
let scheduled=false,lastKey='',token=0,rootObserver=null,gameObserver=null;

function terrainFromName(name){
  const z=String(name||'');
  if(/冰火/.test(z))return 'icefire';
  if(/樹海|森林|森域|迷霧林/.test(z))return 'forest';
  if(/陰陽海/.test(z))return 'yinyang';
  if(/北寒|北天|天宮/.test(z))return 'northpalace';
  if(/冰原|玄霜/.test(z))return 'ice';
  if(/遠古戰場|太古戰場|古戰場|戰場/.test(z))return 'battle';
  if(/上古遺跡|遺跡/.test(z))return 'ruin';
  if(/沙漠|荒漠|砂海/.test(z))return 'desert';
  if(/崑崙|昆侖/.test(z))return 'mountain';
  if(/^海$|鎮海|海域/.test(z))return 'sea';
  return '';
}
function currentTerrain(scene){
  const fromText=terrainFromName(byId('sceneZone')?.textContent);
  return fromText||String(scene?.dataset.terrain||scene?.closest('.world-scene')?.dataset.v154Terrain||'');
}
function mode(){return DESKTOP.matches?'desktop':'mobile'}
function waitImage(url){
  return new Promise((resolve,reject)=>{const im=new Image();im.decoding='async';im.onload=()=>resolve(url);im.onerror=()=>reject(new Error('asset-load-failed '+url));im.src=url;if(im.complete&&im.naturalWidth>0)resolve(url)});
}
function ensureLayers(){
  const scene=byId('v154vsScene'); if(!scene)return null;
  let bg=byId('v154fix6Background');
  if(!bg){
    bg=document.createElement('img');
    bg.id='v154fix6Background';
    bg.className='v154fix6-background';
    bg.alt='';
    bg.decoding='async';
    bg.draggable=false;
    scene.prepend(bg);
  }
  return {scene,bg,world:scene.closest('.world-scene')};
}
function syncVisualLabels(terrain,world){
  const label=DISPLAY[terrain];if(!label)return;
  const zone=byId('sceneZone');if(zone&&zone.textContent.trim()!==label)zone.textContent=label;
  const coord=byId('sceneCoord');
  if(coord){
    const prefix=(coord.textContent.split('·')[0]||'').trim();
    const next=(prefix?prefix+' · ':'')+label;
    if(coord.textContent.trim()!==next)coord.textContent=next;
  }
  let tag=world?.querySelector('.v14f-terrain-badge,.v154ui-zone-tag');
  if(!tag&&world){tag=document.createElement('span');tag.className='v154ui-zone-tag';world.appendChild(tag)}
  if(tag&&tag.textContent.trim()!==label)tag.textContent=label;
}
function deactivate(layer){
  if(!layer)return;
  layer.scene.classList.remove('v154fix6-active','v154fix6-loading');
  layer.world?.classList.remove('v154fix6-world-active');
  document.documentElement.removeAttribute('data-v154fix6-terrain');
  lastKey='';
}
async function commit(force){
  scheduled=false;
  const layer=ensureLayers(); if(!layer) return;
  const terrain=currentTerrain(layer.scene);
  if(!SUPPORTED.has(terrain)){deactivate(layer);return;}
  const key=[terrain,mode()].join('|');
  if(!force&&key===lastKey&&layer.scene.classList.contains('v154fix6-active')){syncVisualLabels(terrain,layer.world);return;}
  const bgUrl=`${ROOT}backgrounds/${mode()}/${terrain}.webp`;
  const my=++token;
  layer.scene.classList.add('v154fix6-loading');
  try{
    await waitImage(bgUrl); if(my!==token) return;
    layer.bg.src=bgUrl;
    layer.scene.dataset.fix6Terrain=terrain;
    layer.scene.dataset.fix6Mode=mode();
    layer.scene.classList.add('v154fix6-active');
    layer.scene.classList.remove('v154fix6-loading');
    layer.world?.classList.add('v154fix6-world-active');
    document.documentElement.dataset.v154fix6Terrain=terrain;
    syncVisualLabels(terrain,layer.world);
    lastKey=key;
  }catch(err){ if(my!==token)return; console.warn('[V15.4 ART FIX6] fail-open',err); deactivate(layer); }
}
function schedule(force=false){if(force){requestAnimationFrame(()=>commit(true));return;} if(scheduled)return; scheduled=true; requestAnimationFrame(()=>commit(false));}
function observeScene(){
  const scene=byId('v154vsScene'); if(!scene||scene.dataset.v154fix6Observed==='1')return;
  scene.dataset.v154fix6Observed='1';
  rootObserver?.disconnect();
  rootObserver=new MutationObserver(()=>schedule(false));
  rootObserver.observe(scene,{attributes:true,attributeFilter:['data-terrain','class']});
}
function install(){
  const game=byId('game'); if(!game)return;
  game.classList.add('v154-art-fix6');
  document.documentElement.dataset.v154Art='fix6';
  observeScene(); schedule(true);
  gameObserver=new MutationObserver(()=>{observeScene();schedule(false)});
  gameObserver.observe(game,{subtree:true,childList:true,characterData:true});
  const onMedia=()=>schedule(true);
  if(DESKTOP.addEventListener)DESKTOP.addEventListener('change',onMedia); else DESKTOP.addListener(onMedia);
  window.addEventListener('resize',()=>schedule(false),{passive:true});
  window.V154_VISUAL_ART_FIX6={version:VERSION,sync:()=>schedule(true),supported:[...SUPPORTED]};
  console.info('[V15.4 VISUAL SCENE ART FIX6] installed',VERSION);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();
