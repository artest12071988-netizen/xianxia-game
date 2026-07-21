(()=>{
'use strict';
if(window.__V145DesktopSafeFix5Loaded)return;
window.__V145DesktopSafeFix5Loaded=true;
const B=()=>window.XIANXIA_CORE_BRIDGE||null;
const gameReady=()=>B()?.isGameVisible?.()===true;
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const actions={
 practice:()=>q('#game .world-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),
 world:()=>clickAction(/openWorldMap/),character:()=>q('#game .character-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),
 craft:()=>openMenu('天工',[['萬法煉造',/openCrafting/],['萬法譜',()=>window.openRecipeCodexV145B?.()],['天工器紋',()=>window.openArtifactWorkshopV143?.()]]),
 trade:()=>openMenu('交易',[['商城坊市',/openShop/],['萬寶拍賣',()=>window.openAuctionHouseV142?.()]]),
 social:()=>q('#worldChatDock')?.scrollIntoView({behavior:'smooth',block:'start'})
};
function clickAction(pattern){const b=qa('#game button').find(x=>pattern.test(x.getAttribute('onclick')||''));if(b)b.click();else B()?.toast?.('功能入口尚未載入');}
function runTarget(target){if(target instanceof RegExp)return clickAction(target);if(typeof target==='function')return target();}
function openMenu(title,items){const b=B();if(!b)return;b.sheet(`<h3>${title}</h3><div class="v145-safe-menu">${items.map((x,i)=>`<button class="btn" data-v145-safe="${i}">${x[0]}</button>`).join('')}</div><button class="btn" id="v145SafeClose" style="width:100%;margin-top:10px">關閉</button>`);items.forEach((x,i)=>q(`[data-v145-safe="${i}"]`)?.addEventListener('click',()=>{b.closeSheet();setTimeout(()=>runTarget(x[1]),60);}));q('#v145SafeClose')?.addEventListener('click',()=>b.closeSheet());}
function mount(){if(!gameReady())return false;const header=q('#game .world-header');if(!header||q('#v145DesktopSafeNav'))return !!header;const nav=document.createElement('nav');nav.id='v145DesktopSafeNav';nav.className='v145-desktop-safe-nav';nav.innerHTML='<button data-k="practice">修行</button><button data-k="world">世界</button><button data-k="character">角色</button><button data-k="craft">天工</button><button data-k="trade">交易</button><button data-k="social">社交</button>';nav.addEventListener('click',e=>{const b=e.target.closest('button[data-k]');if(b)actions[b.dataset.k]?.();});const meta=q('.world-meta',header);header.insertBefore(nav,meta||null);q('#game .brand-tag').textContent='V14.5 · SAFE DESKTOP';return true;}
let n=0;const timer=setInterval(()=>{n++;if(mount()||n>180)clearInterval(timer);},500);
})();
