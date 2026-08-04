/* 修仙大逃殺 V15.4｜探索介面黑金還原 FIX2
   僅裝飾現有 V15.4 DOM；不替換、攔截或重寫既有功能事件。 */
(function(){
'use strict';
const VERSION='V15.4-VISUAL-SCENE-UI-MATCH-FIX2-20260804';
const ICON_ROOT='assets/visual_v154_fix2/icons/';
let observer=null;
const $=id=>document.getElementById(id);
function decorateCurrency(){
  const specs=[
    {id:'v154uiLingshi',kind:'lingshi',label:'靈石',icon:'spirit_stone.svg'},
    {id:'v154uiYuanbao',kind:'yuanbao',label:'元寶',icon:'yuanbao.svg'}
  ];
  specs.forEach(spec=>{
    const value=$(spec.id),pill=value?.closest('.v154ui-currency-pill');
    if(!value||!pill||pill.dataset.v154Match==='done')return;
    pill.dataset.v154Match='done';pill.dataset.kind=spec.kind;
    const preserved=value.textContent;
    pill.replaceChildren();
    const img=document.createElement('img');img.className='v154ui-currency-icon';img.alt='';img.src=ICON_ROOT+spec.icon;
    const label=document.createElement('span');label.className='v154ui-currency-label';label.textContent=spec.label;
    const b=document.createElement('b');b.id=spec.id;b.textContent=preserved;
    const plus=document.createElement('span');plus.className='v154ui-currency-plus';plus.setAttribute('aria-hidden','true');plus.textContent='＋';
    pill.append(img,label,b,plus);
  });
}
function ensureZoneTag(){
  const game=$('game'),scene=game?.querySelector('.world-scene');if(!game||!scene)return;
  let tag=scene.querySelector('.v14f-terrain-badge')||scene.querySelector('.v154ui-zone-tag');
  if(!tag){tag=document.createElement('span');tag.className='v154ui-zone-tag';scene.appendChild(tag)}
  const zone=$('sceneZone')?.textContent?.trim();if(zone&&tag.textContent.trim()!==zone)tag.textContent=zone;
}
function markExploreActive(){
  const nav=document.querySelector('#game .mobile-nav');if(!nav)return;
  nav.querySelectorAll('[data-v154nav]').forEach(btn=>btn.classList.toggle('v154ui-active',btn.dataset.v154nav==='explore'));
}
function decorate(){
  const game=$('game');if(!game)return false;
  game.classList.add('v154ui-match-fix2');
  document.documentElement.dataset.v154UiMatch='fix2';
  decorateCurrency();ensureZoneTag();
  const nav=game.querySelector('.mobile-nav');
  if(nav&&!nav.dataset.v154MatchInit){nav.dataset.v154MatchInit='done';markExploreActive()}
  return true;
}
function install(){
  if(!decorate())return;
  const game=$('game');
  observer=new MutationObserver(()=>decorate());
  observer.observe(game,{subtree:true,childList:true,characterData:true});
  setTimeout(decorate,250);setTimeout(decorate,900);
  console.info('[V15.4 VISUAL SCENE UI MATCH FIX2] installed',VERSION);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
