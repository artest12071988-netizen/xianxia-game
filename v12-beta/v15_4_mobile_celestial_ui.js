/* 修仙大逃殺 V15.4 MOBILE CELESTIAL UI PHASE1
   純介面橋接：只讀現有狀態、呼叫既有按鈕函式，不寫入遊戲資料。 */
(function(){
'use strict';
const VERSION='V15.4-MOBILE-CELESTIAL-UI-PHASE1-20260726';
let syncTimer=null;
let observer=null;
const $id=id=>document.getElementById(id);
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const pct=(v,max)=>max>0?Math.max(0,Math.min(100,v/max*100)):0;
const text=(id,fallback='')=>($id(id)?.textContent||fallback).trim();
function state(){return window.g&&typeof window.g==='object'?window.g:null}
function safeCall(name){
  const fn=window[name];
  if(typeof fn!=='function')return false;
  try{fn();return true}catch(err){console.error('[V15.4 MOBILE UI] '+name+' failed',err);if(typeof window.toast==='function')window.toast('功能暫時無法開啟');return false}
}
function closeNativeOverlay(){try{if(typeof window.closeOv==='function')window.closeOv()}catch(_){} }
function createHud(game){
  if($id('v154uiMobileHud'))return;
  const hud=document.createElement('div');
  hud.id='v154uiMobileHud';
  hud.className='v154ui-mobile-hud';
  hud.innerHTML=`
    <button type="button" class="v154ui-avatar-button" id="v154uiAvatarButton" aria-label="開啟個人資訊"><img id="v154uiAvatar" src="assets/meditation_meridians.webp?v=20260717-121" alt="角色頭像"></button>
    <div class="v154ui-hud-core">
      <div class="v154ui-name-line"><strong class="v154ui-name" id="v154uiName">無名散修</strong><span class="v154ui-level" id="v154uiLevel">Lv1</span></div>
      <div class="v154ui-realm" id="v154uiRealm">練氣一層</div>
      <div class="v154ui-bar-row"><span>HP</span><div class="v154ui-bar-track"><i class="v154ui-bar-fill hp" id="v154uiHpFill"></i></div><span class="v154ui-bar-value" id="v154uiHpText">0/0</span></div>
      <div class="v154ui-bar-row"><span>MP</span><div class="v154ui-bar-track"><i class="v154ui-bar-fill mp" id="v154uiMpFill"></i></div><span class="v154ui-bar-value" id="v154uiMpText">0/0</span></div>
    </div>
    <div class="v154ui-hud-currency"><span class="v154ui-currency-pill">靈石 <b id="v154uiLingshi">0</b></span><span class="v154ui-currency-pill">元寶 <b id="v154uiYuanbao">0</b></span></div>`;
  game.insertBefore(hud,game.firstChild);
  $id('v154uiAvatarButton')?.addEventListener('click',openProfile);
}
function createProfile(){
  if($id('v154uiProfile'))return;
  const root=document.createElement('section');
  root.id='v154uiProfile';root.className='v154ui-profile';root.setAttribute('aria-hidden','true');
  root.innerHTML=`<div class="v154ui-page">
    <header class="v154ui-page-head"><button type="button" class="v154ui-back" id="v154uiProfileBack" aria-label="返回">‹</button><div class="v154ui-page-title">個人資訊</div><span></span></header>
    <main class="v154ui-profile-body">
      <section class="v154ui-hero-card"><img class="v154ui-hero-img" id="v154uiProfileImage" src="assets/meditation_meridians.webp?v=20260717-121" alt="角色形象"><div class="v154ui-hero-info"><div class="v154ui-profile-name" id="v154uiProfileName">無名散修</div><div class="v154ui-profile-realm" id="v154uiProfileRealm">練氣一層</div><div class="v154ui-profile-level" id="v154uiProfileLevel">Lv1</div><div class="v154ui-profile-stats"><div class="v154ui-profile-stat"><span>生命</span><b id="v154uiProfileHp">0</b></div><div class="v154ui-profile-stat"><span>法力</span><b id="v154uiProfileMp">0</b></div><div class="v154ui-profile-stat"><span>攻擊</span><b id="v154uiProfileAtk">0</b></div><div class="v154ui-profile-stat"><span>防禦</span><b id="v154uiProfileDef">0</b></div></div></div></section>
      <section class="v154ui-equip-row"><div class="v154ui-equip-slot"><small>武器</small><strong id="v154uiWeapon">空手</strong><span id="v154uiWeaponMeta">尚未裝備</span></div><div class="v154ui-equip-slot"><small>防具</small><strong id="v154uiArmor">無</strong><span id="v154uiArmorMeta">尚未裝備</span></div></section>
      <section class="v154ui-tech-card"><div class="v154ui-section-label">已學功法</div><div class="v154ui-tech-list" id="v154uiTechList"></div></section>
    </main></div>`;
  document.body.appendChild(root);
  $id('v154uiProfileBack')?.addEventListener('click',closeProfile);
}
function moreButton(icon,label,sub,action,id=''){return `<button type="button" class="v154ui-more-button" ${id?`id="${id}"`:''} data-action="${action}"><b>${icon}</b><span>${label}</span><small>${sub}</small></button>`}
function createMore(){
  if($id('v154uiMore'))return;
  const root=document.createElement('section');root.id='v154uiMore';root.className='v154ui-more';root.setAttribute('aria-hidden','true');
  root.innerHTML=`<div class="v154ui-page"><header class="v154ui-page-head"><button type="button" class="v154ui-back" id="v154uiMoreBack" aria-label="返回">‹</button><div class="v154ui-page-title">更多功能</div><span></span></header><main class="v154ui-more-body"><div class="v154ui-more-summary"><strong id="v154uiMoreZone">當前地域</strong><span id="v154uiMoreStatus">選擇要進行的操作</span></div><div class="v154ui-more-grid">
  ${moreButton('圖','御風地圖','選擇目的地','openWorldMap')}
  ${moreButton('坊','商城坊市','交易與功法','openShop')}
  ${moreButton('破','境界突破','達成條件後突破','openBreak','v154uiBreakMore')}
  ${moreButton('音','全服傳音','查看世界訊息','openWorldChat')}
  ${moreButton('獸','妖獸圖鑑','查看既有妖獸','openMonsterDex')}
  ${moreButton('教','新手教學','玩法操作說明','openTutorial')}
  ${moreButton('雲','雲端狀態','查看同步狀態','openCloudStatus')}
  ${moreButton('報','問題回報','回報遊戲問題','openFeedback')}
  ${moreButton('境','活動秘境','管理員限時開放','openEventRealm','v154uiEventMore')}
  </div><div class="v154ui-more-note">本頁只整理既有功能入口，不新增任務、裝備欄位或遊戲玩法。</div></main></div>`;
  document.body.appendChild(root);
  $id('v154uiMoreBack')?.addEventListener('click',closeMore);
  root.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{
    const name=btn.dataset.action;
    closeMore();
    if(name==='openTutorial'&&typeof window.openTutorial==='function'){window.openTutorial(0);return}
    safeCall(name);
  }));
}
function installNav(game){
  const nav=game.querySelector('.mobile-nav');if(!nav)return;
  nav.innerHTML=`
    <button type="button" class="v154ui-active" data-v154nav="home"><b>首</b>首頁</button>
    <button type="button" data-v154nav="explore"><b>探</b>探索</button>
    <button type="button" data-v154nav="meditate"><b>修</b>修行</button>
    <button type="button" data-v154nav="bag"><b>囊</b>背包</button>
    <button type="button" data-v154nav="more"><b>更</b>更多</button>`;
  nav.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    nav.querySelectorAll('button').forEach(x=>x.classList.remove('v154ui-active'));
    btn.classList.add('v154ui-active');
    const action=btn.dataset.v154nav;
    if(action==='home'){closeNativeOverlay();closeProfile();closeMore();return}
    if(action==='explore'){safeCall('explore');return}
    if(action==='meditate'){safeCall('meditationButtonClick');return}
    if(action==='bag'){safeCall('openBag');return}
    if(action==='more'){openMore();return}
  }));
}
function getEquipment(){
  const s=state();if(!s)return {weapon:null,armor:null};
  let weapon=null,armor=null;
  try{weapon=typeof window.getWeapon==='function'?window.getWeapon():null}catch(_){}
  try{armor=typeof window.getArmor==='function'?window.getArmor():null}catch(_){}
  if(!weapon&&Array.isArray(s.equipment))weapon=s.equipment.find(e=>e&&e.uid===s.weaponUid)||null;
  if(!armor&&Array.isArray(s.equipment))armor=s.equipment.find(e=>e&&e.uid===s.armorUid)||null;
  return {weapon,armor};
}
function equipmentText(e,empty){
  if(!e)return {name:empty,meta:'尚未裝備'};
  const name=e.name||window.IT?.[e.itemId]?.name||empty;
  const enhance=Math.max(0,num(e.enhance));
  const type=e.type||window.IT?.[e.itemId]?.type||'';
  return {name:name+(enhance?` +${enhance}`:''),meta:type||'已裝備'};
}
function techniqueRows(){
  const s=state();const ids=Array.isArray(s?.techniques)?s.techniques.slice(0,3):[];
  const catalog=Array.isArray(window.C?.techniques)?window.C.techniques:[];
  const rows=ids.map((id,index)=>{const t=catalog.find(x=>x&&x.id===id)||{};return {icon:['劍','息','法'][index]||'訣',name:t.name||String(id),desc:t.desc||t.category||'已研習功法'}});
  while(rows.length<3)rows.push({icon:'訣',name:'尚未研習',desc:'功法欄位保留'});
  return rows;
}
function sync(){
  const s=state();if(!s)return;
  const hp=Math.round(num(s.hp)),hpMax=Math.max(1,Math.round(num(s.hpMax)));
  const mp=Math.round(num(s.mp)),mpMax=Math.max(1,Math.round(num(s.mpMax)));
  const realm=text('prealm',`${s.big||'練氣'} · Lv${s.lv||1}`);
  const name=s.name||text('pname','無名散修');
  const avatar=$id('meditationPortrait')?.getAttribute('src')||'assets/meditation_meridians.webp?v=20260717-121';
  const set=(id,value)=>{const el=$id(id);if(el)el.textContent=value};
  set('v154uiName',name);set('v154uiLevel','Lv'+(s.lv||1));set('v154uiRealm',realm);
  set('v154uiHpText',`${hp}/${hpMax}`);set('v154uiMpText',`${mp}/${mpMax}`);
  if($id('v154uiHpFill'))$id('v154uiHpFill').style.width=pct(hp,hpMax)+'%';
  if($id('v154uiMpFill'))$id('v154uiMpFill').style.width=pct(mp,mpMax)+'%';
  set('v154uiLingshi',num(s.lingshi).toLocaleString());set('v154uiYuanbao',num(s.yuanbao).toLocaleString());
  [$id('v154uiAvatar'),$id('v154uiProfileImage')].forEach(img=>{if(img&&img.getAttribute('src')!==avatar)img.setAttribute('src',avatar)});
  set('v154uiProfileName',name);set('v154uiProfileRealm',realm);set('v154uiProfileLevel','等級 Lv.'+(s.lv||1));
  set('v154uiProfileHp',`${hp}/${hpMax}`);set('v154uiProfileMp',`${mp}/${mpMax}`);
  let atk=text('atk','0'),def=text('def','0');
  try{if(typeof window.pAtk==='function')atk=String(window.pAtk())}catch(_){}
  try{if(typeof window.pDef==='function')def=String(window.pDef())}catch(_){}
  set('v154uiProfileAtk',atk);set('v154uiProfileDef',def);
  const eq=getEquipment(),w=equipmentText(eq.weapon,'空手'),a=equipmentText(eq.armor,'無');
  set('v154uiWeapon',w.name);set('v154uiWeaponMeta',w.meta);set('v154uiArmor',a.name);set('v154uiArmorMeta',a.meta);
  const tech=$id('v154uiTechList');if(tech){tech.innerHTML=techniqueRows().map(x=>`<div class="v154ui-tech-item"><span class="v154ui-tech-icon">${x.icon}</span><div class="v154ui-tech-copy"><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.desc)}</span></div></div>`).join('')}
  set('v154uiMoreZone',text('sceneZone','當前地域'));set('v154uiMoreStatus',text('worldStatus','選擇要進行的操作'));
  const breakSource=$id('brkBtn'),breakMore=$id('v154uiBreakMore');if(breakMore)breakMore.disabled=!!breakSource?.disabled;
  const eventSource=$id('eventRealmBtn'),eventMore=$id('v154uiEventMore');if(eventMore)eventMore.style.display=eventSource&&!eventSource.hidden?'block':'none';
}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function openProfile(){createProfile();sync();const p=$id('v154uiProfile');if(p){p.classList.add('on');p.setAttribute('aria-hidden','false')}}
function closeProfile(){const p=$id('v154uiProfile');if(p){p.classList.remove('on');p.setAttribute('aria-hidden','true')}}
function openMore(){createMore();sync();const p=$id('v154uiMore');if(p){p.classList.add('on');p.setAttribute('aria-hidden','false')}}
function closeMore(){const p=$id('v154uiMore');if(p){p.classList.remove('on');p.setAttribute('aria-hidden','true')}}
function install(){
  const game=$id('game');if(!game||game.dataset.v154MobileUi==='installed')return;
  game.dataset.v154MobileUi='installed';
  createHud(game);createProfile();createMore();installNav(game);
  const sourceIds=['pname','prealm','hpText','mpText','atk','def','ls','yb','wp','armor','sceneZone','worldStatus','techniqueDock'];
  observer=new MutationObserver(sync);sourceIds.forEach(id=>{const el=$id(id);if(el)observer.observe(el,{subtree:true,childList:true,characterData:true,attributes:true})});
  syncTimer=window.setInterval(sync,900);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
  window.addEventListener('resize',sync,{passive:true});
  setTimeout(()=>{try{window.V144_FIXED_MAP?.updateCurrentScene?.()}catch(_){}sync()},350);
  window.openV154MobileProfile=openProfile;window.closeV154MobileProfile=closeProfile;window.openV154MobileMore=openMore;window.closeV154MobileMore=closeMore;
  console.info('[V15.4 MOBILE CELESTIAL UI PHASE1] installed',VERSION);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
setTimeout(install,0);
})();
