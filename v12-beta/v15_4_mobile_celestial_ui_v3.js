/* 修仙大逃殺 V15.4 MOBILE CELESTIAL UI PHASE2 FIX2
   純介面橋接：讀取既有角色、裝備、地域與功能函式；不修改玩法、資料格式、物品、功法、怪物、存檔或 RPC。 */
(function(){
'use strict';
const VERSION='V15.4-MOBILE-CELESTIAL-UI-PHASE2-FIX2-20260726';
let syncTimer=null,observer=null;
const $id=id=>document.getElementById(id);
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const pct=(v,max)=>max>0?Math.max(0,Math.min(100,v/max*100)):0;
const text=(id,fallback='')=>($id(id)?.textContent||fallback).trim();
const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
function state(){return window.g&&typeof window.g==='object'?window.g:null}
function safeCall(name,...args){const fn=window[name];if(typeof fn!=='function')return false;try{fn(...args);return true}catch(err){console.error('[V15.4 MOBILE UI] '+name+' failed',err);window.toast?.('功能暫時無法開啟');return false}}
function closeNativeOverlay(){try{window.closeOv?.()}catch(_){}}
function catalogItem(eq){if(!eq)return null;return window.IT?.[String(eq.itemId)]||window.C?.items?.[String(eq.itemId)]||null}
function getEquipment(){
  const s=state();if(!s)return {weapon:null,armor:null};let weapon=null,armor=null;
  try{weapon=typeof window.getWeapon==='function'?window.getWeapon():null}catch(_){}
  try{armor=typeof window.getArmor==='function'?window.getArmor():null}catch(_){}
  if(!weapon&&Array.isArray(s.equipment))weapon=s.equipment.find(e=>e&&e.uid===s.weaponUid)||null;
  if(!armor&&Array.isArray(s.equipment))armor=s.equipment.find(e=>e&&e.uid===s.armorUid)||null;
  return {weapon,armor};
}
function equipmentInfo(eq,empty){
  if(!eq)return {name:empty,meta:'尚未裝備',type:'none',enhance:0};
  const it=catalogItem(eq)||{};const name=eq.name||it.name||empty;const enhance=Math.max(0,num(eq.enhance??eq.strength));
  return {name:name+(enhance?` +${enhance}`:''),meta:eq.type||it.type||'已裝備',type:String(eq.type||it.type||'').trim(),enhance};
}
function terrainFromName(name){
  const z=String(name||'');
  if(/冰火/.test(z))return 'icefire'; if(/陰陽海/.test(z))return 'yinyang'; if(/海|鎮海/.test(z))return 'sea';
  if(/樹海|森林|迷霧林/.test(z))return 'forest'; if(/沙漠|砂海/.test(z))return 'desert'; if(/冰原/.test(z))return 'ice';
  if(/北寒|天宮/.test(z))return 'northpalace'; if(/崑崙|山/.test(z))return 'mountain'; if(/古戰場|戰場/.test(z))return 'battle';
  if(/遺跡/.test(z))return 'ruin'; if(/魔淵|深淵/.test(z))return 'abyss'; if(/青牛|村/.test(z))return 'village'; return 'land';
}
const HERO_ASSETS={
  groundLong:'assets/ui/v154_hero_ground_long.png?v=20260726-v154-mobile-ui-p2-fix2',
  groundUnarmed:'assets/ui/v154_hero_ground_unarmed.png?v=20260726-v154-mobile-ui-p2-fix2',
  flightLong:'assets/ui/v154_hero_flight_long.png?v=20260726-v154-mobile-ui-p2-fix2',
  flightUnarmed:'assets/ui/v154_hero_flight_unarmed.png?v=20260726-v154-mobile-ui-p2-fix2'
};
function heroAsset(pose,weapon){
  const airborne=pose==='hover'||pose==='swordfly';
  if(airborne)return weapon==='long'?HERO_ASSETS.flightLong:HERO_ASSETS.flightUnarmed;
  return weapon==='long'?HERO_ASSETS.groundLong:HERO_ASSETS.groundUnarmed;
}
function createHud(game){
  if($id('v154uiMobileHud'))return;
  const hud=document.createElement('div');hud.id='v154uiMobileHud';hud.className='v154ui-mobile-hud';
  hud.innerHTML=`<button type="button" class="v154ui-avatar-button" id="v154uiAvatarButton" aria-label="開啟個人資訊"><img id="v154uiAvatar" src="assets/meditation_meridians.webp?v=20260717-121" alt="角色頭像"></button><div class="v154ui-hud-core"><div class="v154ui-name-line"><strong class="v154ui-name" id="v154uiName">無名散修</strong><span class="v154ui-level" id="v154uiLevel">Lv1</span></div><div class="v154ui-realm" id="v154uiRealm">練氣一層</div><div class="v154ui-bar-row"><span>HP</span><div class="v154ui-bar-track"><i class="v154ui-bar-fill hp" id="v154uiHpFill"></i></div><span class="v154ui-bar-value" id="v154uiHpText">0/0</span></div><div class="v154ui-bar-row"><span>MP</span><div class="v154ui-bar-track"><i class="v154ui-bar-fill mp" id="v154uiMpFill"></i></div><span class="v154ui-bar-value" id="v154uiMpText">0/0</span></div></div><div class="v154ui-hud-currency"><span class="v154ui-currency-pill">靈石 <b id="v154uiLingshi">0</b></span><span class="v154ui-currency-pill">元寶 <b id="v154uiYuanbao">0</b></span></div>`;
  game.insertBefore(hud,game.firstChild);$id('v154uiAvatarButton')?.addEventListener('click',openProfile);
}
function createWorldAvatar(){
 const scene=document.querySelector('#game .world-scene');if(!scene||$id('v154uiWorldAvatar'))return;
 const standard=document.createElement('div');standard.id='v154uiSceneStandard';standard.className='v154ui-scene-standard';standard.setAttribute('aria-hidden','true');scene.appendChild(standard);
 const root=document.createElement('div');root.id='v154uiWorldAvatar';root.className='v154ui-world-avatar terrain-land pose-walk armor-none weapon-none';
 root.innerHTML=`<img id="v154uiWorldHero" class="v154ui-world-hero" src="${HERO_ASSETS.groundUnarmed}" alt="修仙者場景角色"><span class="v154ui-flight-sword" aria-hidden="true"></span>`;scene.appendChild(root);
 const actions=document.createElement('div');actions.id='v154uiSceneActions';actions.className='v154ui-scene-actions';actions.innerHTML=`<button type="button" id="v154uiArtifactAction"><span>紋</span><b>天工器紋</b></button><button type="button" id="v154uiCraftsmanAction"><span>匠</span><b>絕世神匠</b><small id="v154uiCraftsmanState">尋訪中</small></button>`;scene.appendChild(actions);
 $id('v154uiArtifactAction')?.addEventListener('click',()=>safeCall('openArtifactWorkshopV143'));
 $id('v154uiCraftsmanAction')?.addEventListener('click',()=>safeCall('openCrafting','legendary'));
}

function createProfile(){
 if($id('v154uiProfile'))return;const root=document.createElement('section');root.id='v154uiProfile';root.className='v154ui-profile';root.setAttribute('aria-hidden','true');
 root.innerHTML=`<div class="v154ui-page"><header class="v154ui-page-head"><button type="button" class="v154ui-back" id="v154uiProfileBack">‹</button><div class="v154ui-page-title">個人資訊</div><span></span></header><main class="v154ui-profile-body"><section class="v154ui-hero-card"><img class="v154ui-hero-img" id="v154uiProfileImage" src="assets/meditation_meridians.webp?v=20260717-121" alt="角色形象"><div class="v154ui-hero-info"><div class="v154ui-profile-name" id="v154uiProfileName">無名散修</div><div class="v154ui-profile-realm" id="v154uiProfileRealm">練氣一層</div><div class="v154ui-profile-level" id="v154uiProfileLevel">Lv1</div><div class="v154ui-profile-stats"><div class="v154ui-profile-stat"><span>生命</span><b id="v154uiProfileHp">0</b></div><div class="v154ui-profile-stat"><span>法力</span><b id="v154uiProfileMp">0</b></div><div class="v154ui-profile-stat"><span>攻擊</span><b id="v154uiProfileAtk">0</b></div><div class="v154ui-profile-stat"><span>防禦</span><b id="v154uiProfileDef">0</b></div></div></div></section><section class="v154ui-equip-row"><div class="v154ui-equip-slot"><small>武器</small><strong id="v154uiWeapon">空手</strong><span id="v154uiWeaponMeta">尚未裝備</span></div><div class="v154ui-equip-slot"><small>防具</small><strong id="v154uiArmor">無</strong><span id="v154uiArmorMeta">尚未裝備</span></div></section><section class="v154ui-tech-card"><div class="v154ui-section-label">已學功法</div><div class="v154ui-tech-list" id="v154uiTechList"></div></section></main></div>`;
 document.body.appendChild(root);$id('v154uiProfileBack')?.addEventListener('click',closeProfile);
}
function moreButton(icon,label,sub,action,id=''){return `<button type="button" class="v154ui-more-button" ${id?`id="${id}"`:''} data-action="${action}"><b>${icon}</b><span>${label}</span><small>${sub}</small></button>`}
function createMore(){
 if($id('v154uiMore'))return;const root=document.createElement('section');root.id='v154uiMore';root.className='v154ui-more';root.setAttribute('aria-hidden','true');
 root.innerHTML=`<div class="v154ui-page"><header class="v154ui-page-head"><button type="button" class="v154ui-back" id="v154uiMoreBack">‹</button><div class="v154ui-page-title">更多功能</div><span></span></header><main class="v154ui-more-body"><div class="v154ui-more-summary"><strong id="v154uiMoreZone">當前地域</strong><span id="v154uiMoreStatus">選擇要進行的操作</span></div><div class="v154ui-more-grid">${moreButton('圖','御風地圖','選擇目的地','openWorldMap')}${moreButton('坊','商城坊市','交易與功法','openShop')}${moreButton('破','境界突破','達成條件後突破','openBreak','v154uiBreakMore')}${moreButton('煉','萬法煉造','煉丹、煉器與鍛造','openCrafting')}${moreButton('音','全服傳音','查看世界訊息','openWorldChat')}${moreButton('獸','妖獸圖鑑','查看既有妖獸','openMonsterDex')}${moreButton('教','新手教學','玩法操作說明','openTutorial')}${moreButton('雲','雲端狀態','查看同步狀態','openCloudStatus')}${moreButton('報','問題回報','回報遊戲問題','openFeedback')}</div><div class="v154ui-more-note">只整理既有功能入口，不新增任務或裝備欄位。</div></main></div>`;
 document.body.appendChild(root);$id('v154uiMoreBack')?.addEventListener('click',closeMore);root.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{const name=btn.dataset.action;closeMore();if(name==='openTutorial'){safeCall(name,0);return}if(name==='openCrafting'){safeCall(name,'alchemy');return}safeCall(name)}));
}
function installNav(game){const nav=game.querySelector('.mobile-nav');if(!nav)return;nav.innerHTML=`<button type="button" class="v154ui-active" data-v154nav="home"><b>首</b>首頁</button><button type="button" data-v154nav="explore"><b>探</b>探索</button><button type="button" data-v154nav="meditate"><b>修</b>修行</button><button type="button" data-v154nav="bag"><b>囊</b>背包</button><button type="button" data-v154nav="more"><b>更</b>更多</button>`;nav.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{nav.querySelectorAll('button').forEach(x=>x.classList.remove('v154ui-active'));btn.classList.add('v154ui-active');const a=btn.dataset.v154nav;if(a==='home'){closeNativeOverlay();closeProfile();closeMore()}else if(a==='explore')safeCall('explore');else if(a==='meditate')safeCall('meditationButtonClick');else if(a==='bag')safeCall('openBag');else if(a==='more')openMore()}))}
function techniqueRows(){const s=state(),ids=Array.isArray(s?.techniques)?s.techniques.slice(0,3):[],catalog=Array.isArray(window.C?.techniques)?window.C.techniques:[];const rows=ids.map((id,i)=>{const t=catalog.find(x=>x&&x.id===id)||{};return {icon:['劍','息','法'][i]||'訣',name:t.name||String(id),desc:t.desc||t.category||'已研習功法'}});while(rows.length<3)rows.push({icon:'訣',name:'尚未研習',desc:'功法欄位保留'});return rows}
function syncWorldAvatar(eq,zoneName){
 const root=$id('v154uiWorldAvatar'),hero=$id('v154uiWorldHero'),scene=document.querySelector('#game .world-scene'),standard=$id('v154uiSceneStandard');if(!root||!hero||!scene)return;
 const terrain=terrainFromName(zoneName),wi=equipmentInfo(eq.weapon,'空手'),ai=equipmentInfo(eq.armor,'無');
 const weapon=/飛劍/.test(wi.type||wi.name)?'flying':(/長劍|劍/.test(wi.type||wi.name)?'long':'none');
 const armor=/重甲|玄冰甲|玄龜甲|玄鐵甲/.test(ai.type||ai.name)?'heavy':(/法袍|袍/.test(ai.type||ai.name)?'light':'none');
 const airborne=['sea','yinyang','icefire','abyss'].includes(terrain);const pose=weapon==='flying'?'swordfly':(airborne?'hover':'walk');
 const useStandard=terrain==='icefire'&&armor==='heavy'&&weapon==='long';
 root.className=`v154ui-world-avatar terrain-${terrain} pose-${pose} armor-${armor} weapon-${weapon}${useStandard?' v154ui-hidden-by-standard':''}`;
 scene.classList.toggle('v154ui-terrain-icefire',terrain==='icefire');scene.classList.toggle('v154ui-standard-scene-on',useStandard);
 if(standard)standard.setAttribute('aria-hidden',useStandard?'false':'true');
 const next=heroAsset(pose,weapon);if(hero.getAttribute('src')!==next)hero.setAttribute('src',next);
 hero.alt=`${ai.name!=='無'?ai.name:'素衣'}、${wi.name!=='空手'?wi.name:'空手'}的修仙者`;
 const profile=$id('v154uiProfileImage');if(profile){profile.src=next;profile.classList.add('v154ui-profile-scene-hero')}
 const craft=$id('v154uiCraftsmanAction');if(craft){craft.hidden=terrain!=='icefire';const m=state()?.masterCraftsman||{};$id('v154uiCraftsmanState').textContent=m.available?'願意鍛造':(m.encounters>0?'再次尋訪':'尋訪神匠')}
}

function sync(){
 const s=state();if(!s)return;const hp=Math.round(num(s.hp)),hpMax=Math.max(1,Math.round(num(s.hpMax))),mp=Math.round(num(s.mp)),mpMax=Math.max(1,Math.round(num(s.mpMax)));const realm=text('prealm',`${s.big||'練氣'} · Lv${s.lv||1}`),name=s.name||text('pname','無名散修'),avatar=$id('meditationPortrait')?.getAttribute('src')||'assets/meditation_meridians.webp?v=20260717-121';const set=(id,v)=>{const el=$id(id);if(el)el.textContent=v};
 set('v154uiName',name);set('v154uiLevel','Lv'+(s.lv||1));set('v154uiRealm',realm);set('v154uiHpText',`${hp}/${hpMax}`);set('v154uiMpText',`${mp}/${mpMax}`);if($id('v154uiHpFill'))$id('v154uiHpFill').style.width=pct(hp,hpMax)+'%';if($id('v154uiMpFill'))$id('v154uiMpFill').style.width=pct(mp,mpMax)+'%';set('v154uiLingshi',num(s.lingshi).toLocaleString());set('v154uiYuanbao',num(s.yuanbao).toLocaleString());[$id('v154uiAvatar'),$id('v154uiProfileImage')].forEach(img=>{if(img&&img.getAttribute('src')!==avatar)img.setAttribute('src',avatar)});
 set('v154uiProfileName',name);set('v154uiProfileRealm',realm);set('v154uiProfileLevel','等級 Lv.'+(s.lv||1));set('v154uiProfileHp',`${hp}/${hpMax}`);set('v154uiProfileMp',`${mp}/${mpMax}`);let atk=text('atk','0'),def=text('def','0');try{if(typeof window.pAtk==='function')atk=String(window.pAtk())}catch(_){}try{if(typeof window.pDef==='function')def=String(window.pDef())}catch(_){}set('v154uiProfileAtk',atk);set('v154uiProfileDef',def);
 const eq=getEquipment(),w=equipmentInfo(eq.weapon,'空手'),a=equipmentInfo(eq.armor,'無');set('v154uiWeapon',w.name);set('v154uiWeaponMeta',w.meta);set('v154uiArmor',a.name);set('v154uiArmorMeta',a.meta);const tech=$id('v154uiTechList');if(tech)tech.innerHTML=techniqueRows().map(x=>`<div class="v154ui-tech-item"><span class="v154ui-tech-icon">${x.icon}</span><div class="v154ui-tech-copy"><strong>${esc(x.name)}</strong><span>${esc(x.desc)}</span></div></div>`).join('');
 const zone=text('sceneZone','當前地域');set('v154uiMoreZone',zone);set('v154uiMoreStatus',text('worldStatus','選擇要進行的操作'));syncWorldAvatar(eq,zone);const breakSource=$id('brkBtn'),breakMore=$id('v154uiBreakMore');if(breakMore)breakMore.disabled=!!breakSource?.disabled;
}
function openProfile(){createProfile();sync();const p=$id('v154uiProfile');if(p){p.classList.add('on');p.setAttribute('aria-hidden','false')}}function closeProfile(){const p=$id('v154uiProfile');if(p){p.classList.remove('on');p.setAttribute('aria-hidden','true')}}function openMore(){createMore();sync();const p=$id('v154uiMore');if(p){p.classList.add('on');p.setAttribute('aria-hidden','false')}}function closeMore(){const p=$id('v154uiMore');if(p){p.classList.remove('on');p.setAttribute('aria-hidden','true')}}
function install(){
 const game=$id('game');if(!game||game.dataset.v154MobileUiV2==='installed')return;game.dataset.v154MobileUiV2='installed';createHud(game);createWorldAvatar();createProfile();createMore();installNav(game);
 const ids=['pname','prealm','hpText','mpText','atk','def','ls','yb','wp','armor','sceneZone','worldStatus','techniqueDock'];observer=new MutationObserver(sync);ids.forEach(id=>{const el=$id(id);if(el)observer.observe(el,{subtree:true,childList:true,characterData:true,attributes:true})});syncTimer=setInterval(sync,800);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});window.addEventListener('resize',sync,{passive:true});setTimeout(()=>{try{window.V144_FIXED_MAP?.updateCurrentScene?.()}catch(_){}sync()},350);window.openV154MobileProfile=openProfile;window.closeV154MobileProfile=closeProfile;window.openV154MobileMore=openMore;window.closeV154MobileMore=closeMore;console.info('[V15.4 MOBILE CELESTIAL UI PHASE2 FIX2] installed',VERSION);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();setTimeout(install,0);
})();
