(()=>{
'use strict';
if(window.__V153MobileResponsiveFix8)return;
window.__V153MobileResponsiveFix8=true;
const BUILD='V15.3-PHASE2-FIX8-MOBILE-RESPONSIVE';
const root=document.documentElement;

function updateViewport(){
  const vv=window.visualViewport;
  const width=Math.round(vv?.width||window.innerWidth||document.documentElement.clientWidth||0);
  const height=Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||0);
  root.style.setProperty('--v153m-vh',height+'px');
  document.body?.classList.toggle('v153m-phone',width<=820);
  document.body?.classList.toggle('v153m-phone-small',width<=430);
  document.body?.classList.toggle('v153m-landscape',width>height&&height<=520);
}

function classifySheet(sheet){
  if(!(sheet instanceof HTMLElement))return;
  const classes=[
    'v153m-fight','v153m-monster-dex','v153m-map','v153m-artifact',
    'v153m-auction','v153m-crafting','v153m-beast','v153m-pvp','v153m-grave'
  ];
  sheet.classList.remove(...classes);
  if(sheet.querySelector('.fight-stage'))sheet.classList.add('v153m-fight');
  if(sheet.querySelector('.monster-grid'))sheet.classList.add('v153m-monster-dex');
  if(sheet.querySelector('.v14f-map-sheet,.v14f-blueprint-grid'))sheet.classList.add('v153m-map');
  if(sheet.querySelector('.v143-shell'))sheet.classList.add('v153m-artifact');
  if(sheet.querySelector('.auction-shell'))sheet.classList.add('v153m-auction');
  if(sheet.querySelector('.v145b-codex,.v145b-recipe-card'))sheet.classList.add('v153m-crafting');
  if(sheet.querySelector('.v151-beast-shell,.v151-enchant-shell'))sheet.classList.add('v153m-beast');
  if(sheet.querySelector('.pvp-card,.pvp-bars'))sheet.classList.add('v153m-pvp');
  if(sheet.querySelector('.grave-card,.grave-lock'))sheet.classList.add('v153m-grave');
}

function syncModalState(){
  const body=document.body;
  if(!body)return;
  document.querySelectorAll('.sheet').forEach(classifySheet);
  const modalOpen=!!(
    document.querySelector('.ov.on')||
    document.querySelector('.v152-raid-root')||
    document.querySelector('.v152-raid-prompt')||
    document.querySelector('#v146MeditationOverlay.active')||
    document.querySelector('.maintenance-shell')
  );
  body.classList.toggle('v153m-modal-open',modalOpen&&innerWidth<=820);
}

function ensureCssLast(){
  const link=document.querySelector('link[href*="v15_3_mobile_responsive_fix8.css"]');
  if(link&&link.parentNode===document.head&&link!==document.head.lastElementChild){
    document.head.appendChild(link);
  }
}

let raf=0;
function schedule(){
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(()=>{
    updateViewport();
    syncModalState();
    ensureCssLast();
  });
}

window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('orientationchange',schedule,{passive:true});
window.visualViewport?.addEventListener('resize',schedule,{passive:true});
window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
document.addEventListener('DOMContentLoaded',schedule,{once:true});
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
schedule();
window.V153MobileResponsive={build:BUILD,refresh:schedule};
console.info('['+BUILD+'] loaded');
})();
