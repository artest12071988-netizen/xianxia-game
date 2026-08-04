/* 修仙大逃殺 V15.4｜場景美術實裝 FIX3
   只覆寫十個核准地域的背景與角色顯示；不修改玩法、存檔、數值、RPC 或按鈕事件。 */
(function(){
'use strict';
const VERSION='V15.4-VISUAL-SCENE-ART-FIX3-20260804';
const BACKGROUND_ROOT='assets/visual_v154_fix3/backgrounds/';
const CHARACTER_ROOT='assets/visual_v154_fix1/characters/';
const SUPPORTED=new Set(['icefire','ice','battle','ruin','desert','forest','yinyang','northpalace','sea','mountain']);
const DESKTOP=window.matchMedia('(min-width:781px)');
let observer=null, rootObserver=null, scheduled=false, requestToken=0, lastKey='';
const byId=id=>document.getElementById(id);
function assetMode(){return DESKTOP.matches?'desktop':'mobile'}
function terrainFromZone(name){
  const z=String(name||'');
  if(/冰火/.test(z))return 'icefire';
  if(/樹海|森林|森域|迷霧林/.test(z))return 'forest';
  if(/陰陽海/.test(z))return 'yinyang';
  if(/北寒|北天|天宮/.test(z))return 'northpalace';
  if(/冰原|玄霜/.test(z))return 'ice';
  if(/古戰場|遠古戰場|戰場/.test(z))return 'battle';
  if(/遺跡/.test(z))return 'ruin';
  if(/沙漠|荒漠|砂海/.test(z))return 'desert';
  if(/崑崙|山/.test(z))return 'mountain';
  if(/海|鎮海/.test(z))return 'sea';
  if(/青牛|村|坊市|交易所|丹房|靈泉|神祠|傳訊台/.test(z))return 'village';
  return '';
}
function resolvedTerrain(legacy){return terrainFromZone(byId('sceneZone')?.textContent)||String(legacy.dataset.terrain||'')}
function poseForTerrain(){return 'flight'}
function ensureLayer(){
  const legacy=byId('v154vsScene');
  if(!legacy)return null;
  let bg=byId('v154fix3Background');
  let character=byId('v154fix3Character');
  if(!bg){
    bg=document.createElement('img');
    bg.id='v154fix3Background';bg.className='v154fix3-background';bg.alt='';bg.decoding='async';bg.draggable=false;
    legacy.insertBefore(bg,legacy.firstChild);
  }
  if(!character){
    character=document.createElement('img');
    character.id='v154fix3Character';character.className='v154fix3-character';character.alt='';character.decoding='async';character.draggable=false;
    const beast=byId('v154vsBeast');
    legacy.insertBefore(character,beast||legacy.lastChild);
  }
  return {legacy,bg,character};
}
function waitImage(url){
  return new Promise((resolve,reject)=>{
    const img=new Image();img.decoding='async';
    img.onload=()=>resolve(url);img.onerror=()=>reject(new Error('asset-load-failed '+url));img.src=url;
    if(img.complete&&img.naturalWidth>0)resolve(url);
  });
}
function characterSource(gender,pose,weapon){
  const sex=gender==='female'?'female':'male';
  const stance=pose==='flight'?'flight':'ground';
  const armed=weapon&&weapon!=='none'?'sword':'unarmed';
  return `${CHARACTER_ROOT}${sex}_${stance}_${armed}.webp`;
}
function deactivate(layer){
  if(!layer)return;
  layer.legacy.classList.remove('v154fix3-active','v154fix3-loading');
  layer.legacy.closest('.world-scene')?.classList.remove('v154fix3-world-active');
  document.documentElement.removeAttribute('data-v154fix3-terrain');
  delete layer.legacy.dataset.fix3Terrain;delete layer.legacy.dataset.fix3Pose;
  lastKey='';
}
async function commit(force){
  scheduled=false;
  const layer=ensureLayer();
  if(!layer)return;
  const terrain=resolvedTerrain(layer.legacy);
  if(!SUPPORTED.has(terrain)){deactivate(layer);return}
  const gender=String(layer.legacy.dataset.gender||'male');
  const pose=poseForTerrain(terrain);
  const weapon=String(layer.legacy.dataset.weapon||'none');
  const armor=String(layer.legacy.dataset.armor||'plain');
  const mode=assetMode();
  const key=[terrain,mode,gender,pose,weapon,armor].join('|');
  if(!force&&key===lastKey&&layer.legacy.classList.contains('v154fix3-active'))return;
  const bgUrl=`${BACKGROUND_ROOT}${mode}/${terrain}.webp`;
  const charUrl=characterSource(gender,pose,weapon);
  const token=++requestToken;
  layer.legacy.classList.add('v154fix3-loading');
  try{
    await Promise.all([waitImage(bgUrl),waitImage(charUrl)]);
    if(token!==requestToken)return;
    layer.bg.src=bgUrl;
    layer.character.src=charUrl;
    layer.character.dataset.armor=armor;
    layer.legacy.dataset.fix3Terrain=terrain;
    layer.legacy.dataset.fix3Pose=pose;
    layer.character.dataset.weapon=weapon;
    layer.legacy.dataset.fix3Mode=mode;
    layer.legacy.classList.add('v154fix3-active');
    layer.legacy.classList.remove('v154fix3-loading');
    layer.legacy.closest('.world-scene')?.classList.add('v154fix3-world-active');
    document.documentElement.dataset.v154fix3Terrain=terrain;
    lastKey=key;
  }catch(err){
    if(token!==requestToken)return;
    console.warn('[V15.4 ART FIX3] fail-open to legacy scene',err);
    deactivate(layer);
  }
}
function schedule(force){
  if(force){requestAnimationFrame(()=>commit(true));return}
  if(scheduled)return;scheduled=true;requestAnimationFrame(()=>commit(false));
}
function observeRoot(){
  const root=byId('v154vsScene');
  if(!root||root.dataset.v154fix3Observed==='1')return;
  root.dataset.v154fix3Observed='1';
  rootObserver?.disconnect();
  rootObserver=new MutationObserver(()=>schedule(false));
  rootObserver.observe(root,{attributes:true,attributeFilter:['data-terrain','data-pose','data-gender','data-weapon','data-armor','class']});
}
function install(){
  const game=byId('game');if(!game)return;
  game.classList.add('v154-art-fix3');
  observeRoot();schedule(true);
  observer=new MutationObserver(()=>{observeRoot();schedule(false)});
  observer.observe(game,{subtree:true,childList:true,characterData:true});
  if(typeof DESKTOP.addEventListener==='function')DESKTOP.addEventListener('change',()=>schedule(true));
  else DESKTOP.addListener(()=>schedule(true));
  window.addEventListener('resize',()=>schedule(false),{passive:true});
  window.V154_VISUAL_ART_FIX3={version:VERSION,sync:()=>schedule(true),supported:[...SUPPORTED]};
  console.info('[V15.4 VISUAL SCENE ART FIX3] installed',VERSION);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
