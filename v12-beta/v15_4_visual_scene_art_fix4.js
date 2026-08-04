/* 修仙大逃殺 V15.4｜探索場景正式視覺 FIX4
   僅替換核准地域的場景美術與介面排列；保留既有玩法、事件、數值、存檔、RPC 與後台。 */
(function(){
'use strict';
const VERSION='V15.4-VISUAL-SCENE-ART-FIX4-20260804';
const ROOT='assets/visual_v154_fix4/';
const DESKTOP=window.matchMedia('(min-width:781px)');
const DISPLAY={
  icefire:'冰火島',ice:'冰原',battle:'遠古戰場',ruin:'上古遺跡',desert:'沙漠',
  forest:'樹海',yinyang:'陰陽海',northpalace:'北寒天宮',sea:'海',mountain:'崑崙山'
};
const POSE={icefire:'flight',ice:'ground',battle:'ground',ruin:'flight',desert:'ground',forest:'ground',yinyang:'flight',northpalace:'ground',sea:'flight',mountain:'flight'};
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
function armed(scene){const w=String(scene?.dataset.weapon||'none');return w&&w!=='none'?'sword':'unarmed'}
function waitImage(url){
  return new Promise((resolve,reject)=>{const im=new Image();im.decoding='async';im.onload=()=>resolve(url);im.onerror=()=>reject(new Error('asset-load-failed '+url));im.src=url;if(im.complete&&im.naturalWidth>0)resolve(url)});
}
function ensureLayers(){
  const scene=byId('v154vsScene'); if(!scene)return null;
  let bg=byId('v154fix4Background'),actor=byId('v154fix4Character');
  if(!bg){bg=document.createElement('img');bg.id='v154fix4Background';bg.className='v154fix4-background';bg.alt='';bg.decoding='async';bg.draggable=false;scene.prepend(bg)}
  if(!actor){actor=document.createElement('img');actor.id='v154fix4Character';actor.className='v154fix4-character';actor.alt='';actor.decoding='async';actor.draggable=false;scene.append(actor)}
  return {scene,bg,actor,world:scene.closest('.world-scene')};
}
function ensureDesktopHud(world){
  if(!world)return null;
  let hud=byId('v154fix4DesktopHud');
  if(!hud){
    hud=document.createElement('div');hud.id='v154fix4DesktopHud';hud.className='v154fix4-desktop-hud';
    hud.innerHTML='<img id="v154fix4DesktopAvatar" alt=""><div><div class="v154fix4-desktop-name"><b id="v154fix4DesktopName"></b><span id="v154fix4DesktopLevel"></span></div><small id="v154fix4DesktopRealm"></small></div>';
    world.appendChild(hud);
  }
  return hud;
}
function syncDesktopHud(world){
  const hud=ensureDesktopHud(world);if(!hud)return;
  const src=byId('v154uiAvatar')?.getAttribute('src');if(src)byId('v154fix4DesktopAvatar')?.setAttribute('src',src);
  const name=byId('v154uiName')?.textContent||'';const level=byId('v154uiLevel')?.textContent||'';const realm=byId('v154uiRealm')?.textContent||'';
  if(byId('v154fix4DesktopName'))byId('v154fix4DesktopName').textContent=name;
  if(byId('v154fix4DesktopLevel'))byId('v154fix4DesktopLevel').textContent=level;
  if(byId('v154fix4DesktopRealm'))byId('v154fix4DesktopRealm').textContent=realm;
}
function syncVisualLabels(terrain,world){
  const label=DISPLAY[terrain];if(!label)return;
  const zone=byId('sceneZone');if(zone&&zone.textContent.trim()!==label)zone.textContent=label;
  const coord=byId('sceneCoord');if(coord){const prefix=(coord.textContent.split('·')[0]||'').trim();const next=(prefix?prefix+' · ':'')+label;if(coord.textContent.trim()!==next)coord.textContent=next}
  let tag=world?.querySelector('.v14f-terrain-badge,.v154ui-zone-tag');
  if(!tag&&world){tag=document.createElement('span');tag.className='v154ui-zone-tag';world.appendChild(tag)}
  if(tag&&tag.textContent.trim()!==label)tag.textContent=label;
}
function deactivate(layer){
  if(!layer)return;layer.scene.classList.remove('v154fix4-active','v154fix4-loading');layer.world?.classList.remove('v154fix4-world-active');
  document.documentElement.removeAttribute('data-v154fix4-terrain');lastKey='';
}
async function commit(force){
  scheduled=false;const layer=ensureLayers();if(!layer)return;
  const terrain=currentTerrain(layer.scene);if(!SUPPORTED.has(terrain)){deactivate(layer);return}
  const pose=POSE[terrain]||'ground';const weapon=armed(layer.scene);const armor=String(layer.scene.dataset.armor||'plain');
  const key=[terrain,mode(),pose,weapon,armor].join('|');if(!force&&key===lastKey&&layer.scene.classList.contains('v154fix4-active')){syncDesktopHud(layer.world);syncVisualLabels(terrain,layer.world);return}
  const bgUrl=`${ROOT}backgrounds/${mode()}/${terrain}.webp`;
  const actorUrl=`${ROOT}characters/generic_${pose}_${weapon}.webp`;
  const my=++token;layer.scene.classList.add('v154fix4-loading');
  try{
    await Promise.all([waitImage(bgUrl),waitImage(actorUrl)]);if(my!==token)return;
    layer.bg.src=bgUrl;layer.actor.src=actorUrl;
    layer.scene.dataset.fix4Terrain=terrain;layer.scene.dataset.fix4Pose=pose;layer.scene.dataset.fix4Weapon=weapon;layer.scene.dataset.fix4Armor=armor;layer.scene.dataset.fix4Mode=mode();
    layer.scene.classList.add('v154fix4-active');layer.scene.classList.remove('v154fix4-loading');layer.world?.classList.add('v154fix4-world-active');
    document.documentElement.dataset.v154fix4Terrain=terrain;
    syncVisualLabels(terrain,layer.world);syncDesktopHud(layer.world);lastKey=key;
  }catch(err){if(my!==token)return;console.warn('[V15.4 ART FIX4] fail-open to V15.4 scene',err);deactivate(layer)}
}
function schedule(force=false){if(force){requestAnimationFrame(()=>commit(true));return}if(scheduled)return;scheduled=true;requestAnimationFrame(()=>commit(false))}
function observeScene(){
  const scene=byId('v154vsScene');if(!scene||scene.dataset.v154fix4Observed==='1')return;
  scene.dataset.v154fix4Observed='1';rootObserver?.disconnect();rootObserver=new MutationObserver(()=>schedule(false));
  rootObserver.observe(scene,{attributes:true,attributeFilter:['data-terrain','data-pose','data-gender','data-weapon','data-armor','class']});
}
function install(){
  const game=byId('game');if(!game)return;game.classList.add('v154-art-fix4');document.documentElement.dataset.v154Art='fix4';
  observeScene();schedule(true);
  gameObserver=new MutationObserver(()=>{observeScene();schedule(false)});gameObserver.observe(game,{subtree:true,childList:true,characterData:true});
  const onMedia=()=>schedule(true);if(DESKTOP.addEventListener)DESKTOP.addEventListener('change',onMedia);else DESKTOP.addListener(onMedia);
  window.addEventListener('resize',()=>schedule(false),{passive:true});
  window.V154_VISUAL_ART_FIX4={version:VERSION,sync:()=>schedule(true),supported:[...SUPPORTED]};
  console.info('[V15.4 VISUAL SCENE ART FIX4] installed',VERSION);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
