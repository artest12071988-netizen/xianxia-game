/* 修仙大逃殺 V15.4 VISUAL SCENE ENGINE V2 FORMAL
   唯讀橋接既有角色、地域、裝備、強化與功能入口；不寫入遊戲核心資料。 */
(function(){
'use strict';
const VERSION='V15.4-VISUAL-SCENE-ENGINE-V2-FORMAL-20260726';
const ASSET='assets/visual_scene_v2/';
let timer=null,observer=null;
const $=id=>document.getElementById(id);
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const pct=(v,m)=>m>0?Math.max(0,Math.min(100,v/m*100)):0;
const txt=(id,f='')=>($(id)?.textContent||f).trim();
const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
function state(){return window.g&&typeof window.g==='object'?window.g:null}
function call(name,...args){const fn=window[name];if(typeof fn!=='function'){window.toast?.('功能尚未載入，請稍後再試');return false}try{fn(...args);return true}catch(e){console.error('[V15.4 SCENE V2] '+name,e);window.toast?.('功能暫時無法開啟');return false}}
function catalog(eq){return eq?(window.IT?.[String(eq.itemId)]||window.C?.items?.[String(eq.itemId)]||{}):{}}
function equipment(){
 const s=state();if(!s)return {weapon:null,armor:null};let weapon=null,armor=null;
 try{weapon=typeof window.getWeapon==='function'?window.getWeapon():null}catch(_){}
 try{armor=typeof window.getArmor==='function'?window.getArmor():null}catch(_){}
 if(!weapon&&Array.isArray(s.equipment))weapon=s.equipment.find(e=>e&&e.uid===s.weaponUid)||null;
 if(!armor&&Array.isArray(s.equipment))armor=s.equipment.find(e=>e&&e.uid===s.armorUid)||null;
 return {weapon,armor}
}
function eqInfo(eq,empty){if(!eq)return {name:empty,meta:'尚未裝備',enhance:0};const it=catalog(eq),enhance=Math.max(0,num(eq.enhance??eq.strength));return {name:(eq.name||it.name||empty)+(enhance?` +${enhance}`:''),meta:eq.type||it.type||'已裝備',enhance}}
function terrain(name){
 const z=String(name||'');
 if(/冰火/.test(z))return'icefire';if(/陰陽海/.test(z))return'sea';if(/海|鎮海/.test(z))return'sea';
 if(/樹海|森林|迷霧林/.test(z))return'forest';if(/沙漠|砂海/.test(z))return'desert';if(/冰原|北寒|天宮/.test(z))return'ice';
 if(/崑崙|山/.test(z))return'mountain';return'land'
}
function gender(){const s=state();const raw=String(s?.gender??s?.sex??localStorage.getItem('v154_visual_gender')??'male').toLowerCase();return /女|female|woman|f/.test(raw)?'female':'male'}
function setGender(v){localStorage.setItem('v154_visual_gender',v==='female'?'female':'male');sync()}
const SCENES={
 sea:{male:'sea_male.webp',female:'sea_female.webp'},
 icefire:{male:'icefire_male.webp',female:'icefire_female.webp'},
 mountain:{male:'mountain_male.webp',female:'mountain_female.webp'},
 forest:{male:'forest_male.webp',female:'forest_female.webp'},
 ice:{male:'ice_male.webp',female:'ice_female.webp'},
 desert:{male:'desert_male.webp',female:'desert_female.webp'},
 land:{male:'land_male.webp',female:'land_female.webp'}
};
const ICONS={
 home:`<svg viewBox="0 0 48 48"><path d="M7 23 24 8l17 15v17H8V23Zm9 17V27h16v13H16Z"/></svg>`,
 explore:`<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="none"/><path d="m31 14-7 13-12 7 7-13 12-7Zm-9 9 4 4"/></svg>`,
 meditate:`<svg viewBox="0 0 48 48"><circle cx="24" cy="11" r="5"/><path d="M18 21c2-4 4-6 6-6s4 2 6 6l2 9 9 8H7l9-8 2-9Zm6 1v11"/></svg>`,
 bag:`<svg viewBox="0 0 48 48"><path d="M13 17h22l5 24H8l5-24Zm6 0c0-6 2-9 5-9s5 3 5 9M18 28h12M24 23v10"/></svg>`,
 more:`<svg viewBox="0 0 48 48"><circle cx="10" cy="24" r="4"/><circle cx="24" cy="24" r="4"/><circle cx="38" cy="24" r="4"/></svg>`
};
function createHud(game){
 if($('v154Hud'))return;const h=document.createElement('div');h.id='v154Hud';h.className='v154-mobile-hud';
 h.innerHTML=`<button class="v154-avatar-button" id="v154AvatarButton"><img id="v154Avatar" src="assets/meditation_meridians.webp?v=20260717-121" alt="角色頭像"></button>
 <div class="v154-hud-core"><div class="v154-name-line"><strong class="v154-name" id="v154Name">無名散修</strong><span class="v154-level" id="v154Level">Lv1</span></div>
 <div class="v154-realm" id="v154Realm">練氣一層</div>
 <div class="v154-bar-row"><span>HP</span><div class="v154-bar-track"><i class="v154-bar-fill hp" id="v154HpFill"></i></div><span class="v154-bar-value" id="v154HpText">0/0</span></div>
 <div class="v154-bar-row"><span>MP</span><div class="v154-bar-track"><i class="v154-bar-fill mp" id="v154MpFill"></i></div><span class="v154-bar-value" id="v154MpText">0/0</span></div></div>
 <div class="v154-hud-currency"><span class="v154-currency-pill">靈石 <b id="v154Ls">0</b></span><span class="v154-currency-pill">元寶 <b id="v154Yb">0</b></span></div>`;
 game.insertBefore(h,game.firstChild);$('v154AvatarButton').addEventListener('click',openProfile)
}
function createActions(){
 const scene=document.querySelector('#game .world-scene');if(!scene)return;
 if(!$('v154Aura')){const a=document.createElement('i');a.id='v154Aura';a.className='v154-enhance-aura';scene.appendChild(a)}
 if($('v154Actions'))return;const d=document.createElement('div');d.id='v154Actions';d.className='v154-scene-actions';
 d.innerHTML=`<button id="v154Artifact"><span>紋</span><b>天工器紋</b></button><button id="v154Craftsman"><span>匠</span><b>絕世神匠</b><small id="v154CraftsmanState">尋訪神匠</small></button>`;
 scene.appendChild(d);$('v154Artifact').addEventListener('click',()=>call('openArtifactWorkshopV143'));$('v154Craftsman').addEventListener('click',()=>call('openCrafting','legendary'))
}
function createProfile(){
 if($('v154Profile'))return;const r=document.createElement('section');r.id='v154Profile';r.className='v154-profile';r.setAttribute('aria-hidden','true');
 r.innerHTML=`<div class="v154-page"><header class="v154-page-head"><button class="v154-back" id="v154ProfileBack">‹</button><div class="v154-page-title">個人資訊</div><span></span></header>
 <main class="v154-profile-body"><section class="v154-hero-card"><img class="v154-hero-img" id="v154ProfileImage" src="assets/meditation_meridians.webp?v=20260717-121">
 <div class="v154-hero-info"><div class="v154-profile-name" id="v154ProfileName">無名散修</div><div class="v154-profile-realm" id="v154ProfileRealm">練氣一層</div><div class="v154-profile-level" id="v154ProfileLevel">Lv1</div>
 <div class="v154-profile-stats"><div class="v154-profile-stat"><span>生命</span><b id="v154ProfileHp">0</b></div><div class="v154-profile-stat"><span>法力</span><b id="v154ProfileMp">0</b></div><div class="v154-profile-stat"><span>攻擊</span><b id="v154ProfileAtk">0</b></div><div class="v154-profile-stat"><span>防禦</span><b id="v154ProfileDef">0</b></div></div></div></section>
 <div class="v154-gender-row"><button id="v154Male">男修外觀</button><button id="v154Female">女修外觀</button></div>
 <section class="v154-equip-row"><div class="v154-equip-slot"><small>武器</small><strong id="v154Weapon">空手</strong><span id="v154WeaponMeta">尚未裝備</span></div><div class="v154-equip-slot"><small>防具</small><strong id="v154Armor">無</strong><span id="v154ArmorMeta">尚未裝備</span></div></section>
 <section class="v154-tech-card"><div class="v154-section-label">已學功法</div><div class="v154-tech-list" id="v154TechList"></div></section></main></div>`;
 document.body.appendChild(r);$('v154ProfileBack').addEventListener('click',closeProfile);$('v154Male').addEventListener('click',()=>setGender('male'));$('v154Female').addEventListener('click',()=>setGender('female'))
}
function moreButton(i,l,s,a,id=''){return `<button class="v154-more-button" ${id?`id="${id}"`:''} data-action="${a}"><b>${i}</b><span>${l}</span><small>${s}</small></button>`}
function createMore(){
 if($('v154More'))return;const r=document.createElement('section');r.id='v154More';r.className='v154-more';r.setAttribute('aria-hidden','true');
 r.innerHTML=`<div class="v154-page"><header class="v154-page-head"><button class="v154-back" id="v154MoreBack">‹</button><div class="v154-page-title">更多功能</div><span></span></header>
 <main class="v154-more-body"><div class="v154-more-summary"><strong id="v154MoreZone">當前地域</strong><span id="v154MoreStatus">選擇操作</span></div>
 <div class="v154-more-grid">${moreButton('圖','御風地圖','選擇目的地','openWorldMap')}${moreButton('坊','商城坊市','交易與功法','openShop')}${moreButton('破','境界突破','達成條件後突破','openBreak','v154BreakMore')}${moreButton('煉','萬法煉造','煉丹、煉器與鍛造','openCrafting')}${moreButton('音','全服傳音','查看世界訊息','openWorldChat')}${moreButton('獸','妖獸圖鑑','查看既有妖獸','openMonsterDex')}${moreButton('教','新手教學','玩法操作說明','openTutorial')}${moreButton('雲','雲端狀態','查看同步狀態','openCloudStatus')}${moreButton('報','問題回報','回報遊戲問題','openFeedback')}</div><div class="v154-more-note">僅整理既有功能入口。</div></main></div>`;
 document.body.appendChild(r);$('v154MoreBack').addEventListener('click',closeMore);
 r.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{const n=b.dataset.action;closeMore();if(n==='openTutorial')return call(n,0);if(n==='openCrafting')return call(n,'alchemy');call(n)}))
}
function navButton(a,l,i,on=false){return `<button class="${on?'v154-active':''}" data-v154nav="${a}"><span class="v154-nav-icon">${i}</span><span class="v154-nav-label">${l}</span><i></i></button>`}
function active(a){document.querySelectorAll('#game .mobile-nav [data-v154nav]').forEach(b=>b.classList.toggle('v154-active',b.dataset.v154nav===a))}
function installNav(game){
 const n=game.querySelector('.mobile-nav');if(!n)return;n.innerHTML=navButton('home','首頁',ICONS.home,true)+navButton('explore','探索',ICONS.explore)+navButton('meditate','修行',ICONS.meditate)+navButton('bag','背包',ICONS.bag)+navButton('more','更多',ICONS.more);
 n.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.v154nav;active(a);if(a==='home'){try{window.closeOv?.()}catch(_){}closeProfile();closeMore()}else if(a==='explore')call('explore');else if(a==='meditate')call('meditationButtonClick');else if(a==='bag')call('openBag');else openMore()}))
}
function techRows(){
 const s=state(),ids=Array.isArray(s?.techniques)?s.techniques.slice(0,3):[],cat=Array.isArray(window.C?.techniques)?window.C.techniques:[];
 const rows=ids.map((id,i)=>{const t=cat.find(x=>x&&x.id===id)||{};return{icon:['劍','息','法'][i]||'訣',name:t.name||String(id),desc:t.desc||t.category||'已研習功法'}});
 while(rows.length<3)rows.push({icon:'訣',name:'尚未研習',desc:'功法欄位保留'});return rows
}
function setText(id,v){const e=$(id);if(e)e.textContent=v}
function sync(){
 const s=state();if(!s)return;const hp=Math.round(num(s.hp)),hm=Math.max(1,Math.round(num(s.hpMax))),mp=Math.round(num(s.mp)),mm=Math.max(1,Math.round(num(s.mpMax)));
 const name=s.name||txt('pname','無名散修'),realm=txt('prealm',`${s.big||'練氣'} · Lv${s.lv||1}`),avatar=$('meditationPortrait')?.getAttribute('src')||'assets/meditation_meridians.webp?v=20260717-121';
 setText('v154Name',name);setText('v154Level','Lv'+(s.lv||1));setText('v154Realm',realm);setText('v154HpText',`${hp}/${hm}`);setText('v154MpText',`${mp}/${mm}`);
 if($('v154HpFill'))$('v154HpFill').style.width=pct(hp,hm)+'%';if($('v154MpFill'))$('v154MpFill').style.width=pct(mp,mm)+'%';
 setText('v154Ls',num(s.lingshi).toLocaleString());setText('v154Yb',num(s.yuanbao).toLocaleString());[$('v154Avatar'),$('v154ProfileImage')].forEach(im=>{if(im&&im.getAttribute('src')!==avatar)im.src=avatar});
 setText('v154ProfileName',name);setText('v154ProfileRealm',realm);setText('v154ProfileLevel','等級 Lv.'+(s.lv||1));setText('v154ProfileHp',`${hp}/${hm}`);setText('v154ProfileMp',`${mp}/${mm}`);
 let atk=txt('atk','0'),def=txt('def','0');try{if(typeof window.pAtk==='function')atk=String(window.pAtk())}catch(_){}try{if(typeof window.pDef==='function')def=String(window.pDef())}catch(_){}
 setText('v154ProfileAtk',atk);setText('v154ProfileDef',def);
 const eq=equipment(),w=eqInfo(eq.weapon,'空手'),a=eqInfo(eq.armor,'無');setText('v154Weapon',w.name);setText('v154WeaponMeta',w.meta);setText('v154Armor',a.name);setText('v154ArmorMeta',a.meta);
 const t=$('v154TechList');if(t)t.innerHTML=techRows().map(x=>`<div class="v154-tech-item"><span class="v154-tech-icon">${x.icon}</span><div class="v154-tech-copy"><strong>${esc(x.name)}</strong><span>${esc(x.desc)}</span></div></div>`).join('');
 const zone=txt('sceneZone','當前地域'),tr=terrain(zone),gen=gender(),scene=document.querySelector('#game .world-scene'),file=SCENES[tr]?.[gen]||SCENES.land[gen];
 if(scene){scene.style.setProperty('--v154-scene-art',`url("${ASSET+file}?v=20260726-v2")`);scene.dataset.v154Terrain=tr;scene.dataset.enhanceTier=w.enhance>=12?'12':w.enhance>=8?'8':'0'}
 setText('v154MoreZone',zone);setText('v154MoreStatus',txt('worldStatus','選擇要進行的操作'));
 const craft=$('v154Craftsman');if(craft){craft.hidden=tr!=='icefire';const st=$('v154CraftsmanState'),m=s.masterCraftsman||{};if(st)st.textContent=m.available?'願意鍛造':(m.encounters>0?'再次尋訪':'尋訪神匠')}
 const bm=$('v154BreakMore');if(bm)bm.disabled=!!$('brkBtn')?.disabled;
 $('v154Male')?.classList.toggle('on',gen==='male');$('v154Female')?.classList.toggle('on',gen==='female')
}
function openProfile(){createProfile();sync();active('home');const p=$('v154Profile');p.classList.add('on');p.setAttribute('aria-hidden','false')}
function closeProfile(){const p=$('v154Profile');if(p){p.classList.remove('on');p.setAttribute('aria-hidden','true')}}
function openMore(){createMore();sync();const p=$('v154More');p.classList.add('on');p.setAttribute('aria-hidden','false')}
function closeMore(){const p=$('v154More');if(p){p.classList.remove('on');p.setAttribute('aria-hidden','true')}}
function install(){
 const game=$('game');if(!game||game.dataset.v154SceneV2==='installed')return;game.dataset.v154SceneV2='installed';
 createHud(game);createActions();createProfile();createMore();installNav(game);
 const ids=['pname','prealm','hpText','mpText','atk','def','ls','yb','wp','armor','sceneZone','worldStatus','techniqueDock'];
 observer=new MutationObserver(sync);ids.forEach(id=>{const e=$(id);if(e)observer.observe(e,{subtree:true,childList:true,characterData:true,attributes:true})});
 timer=setInterval(sync,850);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});window.addEventListener('resize',sync,{passive:true});
 setTimeout(()=>{try{window.V144_FIXED_MAP?.updateCurrentScene?.()}catch(_){}sync()},350);
 window.openV154MobileProfile=openProfile;window.closeV154MobileProfile=closeProfile;window.openV154MobileMore=openMore;window.closeV154MobileMore=closeMore;
 console.info('[V15.4 VISUAL SCENE ENGINE V2 FORMAL] installed',VERSION)
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();setTimeout(install,0);
})();