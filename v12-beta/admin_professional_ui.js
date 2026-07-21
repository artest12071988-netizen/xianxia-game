/* 修仙大逃殺｜專業後台導覽 V14.6 ADMIN UI FIX2
   顯示層插件：真正將功能卡片分派到獨立分類頁；不覆寫原函式、不改欄位 ID、不改 RPC。 */
(function(){
'use strict';
const GROUPS=[
  {id:'overview',label:'總覽',icon:'◈',keys:['世界即時狀態','最近操作']},
  {id:'world',label:'世界控制',icon:'◎',keys:['全服維護與強制離線','黑雲控制','世界天災','活動秘境','地圖放毒','全服公告','世界循環維護']},
  {id:'revenue',label:'收益設定',icon:'◇',keys:['廣告收益與獎勵設定']},
  {id:'auction',label:'萬寶拍賣',icon:'◆',keys:['萬寶拍賣後台']},
  {id:'config',label:'遊戲數值',icon:'▦',keys:['遊戲數值營運後台','版本紀錄與回復']},
  {id:'craft',label:'萬法煉造',icon:'⚒',keys:['萬法煉造與合成控制台','絕世神匠','萬法譜']},
  {id:'ai',label:'AI 測試場',icon:'✦',keys:['AI 修仙實境測試場']},
  {id:'all',label:'全部功能',icon:'☰',keys:[]}
];
const state={active:localStorage.getItem('xianxia_admin_ui_group')||'overview',search:'',observer:null,scheduled:false,classifying:false};
const normalize=s=>(s||'').replace(/\s+/g,' ').trim();
const headingText=node=>normalize(Array.from(node.querySelectorAll(':scope > h2,:scope > .head h2')).map(x=>x.textContent).join(' '));
function groupFor(text){
  for(const g of GROUPS){if(g.id==='all')continue;if(g.keys.some(k=>text.includes(k)))return g.id;}
  return 'other';
}
function paneFor(id){return document.querySelector('#adminMain .admin-ui-pane[data-group="'+id+'"]')||document.querySelector('#adminMain .admin-ui-pane[data-group="other"]');}
function addCollapse(card){
  if(card.dataset.uiCollapseReady)return;
  card.dataset.uiCollapseReady='1';
  const title=card.querySelector(':scope > h2')||card.querySelector(':scope > .head h2');
  if(!title)return;
  const key='xianxia_admin_collapse_'+normalize(title.textContent);
  const tools=document.createElement('span');tools.className='admin-ui-card-tools';
  const btn=document.createElement('button');btn.type='button';btn.className='admin-ui-collapse';btn.title='收合／展開';btn.setAttribute('aria-label','收合／展開');
  const sync=()=>{const c=card.classList.contains('admin-ui-collapsed');btn.textContent=c?'＋':'−';btn.setAttribute('aria-expanded',String(!c));};
  if(localStorage.getItem(key)==='1')card.classList.add('admin-ui-collapsed');
  btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();card.classList.toggle('admin-ui-collapsed');localStorage.setItem(key,card.classList.contains('admin-ui-collapsed')?'1':'0');sync();});
  tools.appendChild(btn);
  if(title.parentElement&&title.parentElement.classList.contains('head'))title.parentElement.appendChild(tools);else title.insertAdjacentElement('afterend',tools);
  sync();
}
function isTopCard(card){return !card.parentElement.closest('section.card');}
function cleanEmptyLayouts(content){
  Array.from(content.querySelectorAll(':scope > .grid, :scope > div.grid')).forEach(grid=>{
    if(!grid.querySelector('section.card')&&!normalize(grid.textContent)&&grid.children.length===0)grid.remove();
  });
}
function classify(){
  if(state.classifying)return;
  const main=document.getElementById('adminMain');
  const content=main&&main.querySelector(':scope > .admin-ui-content');
  if(!content)return;
  state.classifying=true;
  try{
    const cards=Array.from(content.querySelectorAll('section.card')).filter(isTopCard);
    cards.forEach(card=>{
      if(card.closest('#loginCard,#claimCard'))return;
      addCollapse(card);
      const text=headingText(card);
      const group=groupFor(text);
      card.dataset.uiGroup=group;
      card.classList.add('admin-ui-managed');
      if(/遊戲數值營運後台|萬法煉造與合成控制台|AI 修仙實境測試場/.test(text))card.classList.add('admin-ui-scroll-card');
      const pane=paneFor(group);
      if(pane&&card.parentElement!==pane)pane.appendChild(card);
    });
    cleanEmptyLayouts(content);
    updateCounts();applyView();
  }finally{state.classifying=false;}
}
function buildShell(){
  const main=document.getElementById('adminMain');if(!main||main.dataset.uiShellReady)return;
  main.dataset.uiShellReady='1';
  const existing=Array.from(main.children);
  const sidebar=document.createElement('aside');sidebar.className='admin-ui-sidebar';
  sidebar.innerHTML='<div class="admin-ui-sidebar-title">管理模組</div><nav class="admin-ui-nav" aria-label="後台功能分類"></nav><div class="admin-ui-side-actions"><button type="button" class="btn" data-ui-action="expand">全部展開</button><button type="button" class="btn" data-ui-action="collapse">全部收合</button></div>';
  const content=document.createElement('div');content.className='admin-ui-content';
  const toolbar=document.createElement('div');toolbar.className='admin-ui-toolbar';toolbar.innerHTML='<div class="admin-ui-section-title" id="adminUiSectionTitle">總覽</div><div class="admin-ui-search-wrap"><input class="admin-ui-search" id="adminUiSearch" type="search" placeholder="搜尋目前模組的功能、欄位或文字"><button type="button" class="admin-ui-search-clear" title="清除搜尋">×</button></div><div class="admin-ui-toolbar-info" id="adminUiToolbarInfo"></div>';
  const banner=document.createElement('div');banner.className='admin-ui-dashboard-banner';banner.dataset.uiDashboard='1';banner.innerHTML='<div><b>世界管理駕駛艙</b><span>各管理功能已分入獨立模組；切換分類時只顯示該頁內容。</span></div><div class="admin-ui-quick"><button type="button" class="btn" data-ui-jump="world">世界控制</button><button type="button" class="btn gold" data-ui-jump="auction">萬寶拍賣</button><button type="button" class="btn jade" data-ui-jump="config">遊戲數值</button></div>';
  const panes=document.createElement('div');panes.className='admin-ui-panes';
  GROUPS.filter(g=>g.id!=='all').forEach(g=>{const p=document.createElement('div');p.className='admin-ui-pane';p.dataset.group=g.id;panes.appendChild(p);});
  const other=document.createElement('div');other.className='admin-ui-pane';other.dataset.group='other';panes.appendChild(other);
  const empty=document.createElement('div');empty.className='admin-ui-empty';empty.textContent='目前分類沒有符合搜尋條件的項目。';
  content.append(toolbar,banner,panes,...existing,empty);main.append(sidebar,content);
  const nav=sidebar.querySelector('.admin-ui-nav');
  GROUPS.forEach(g=>{const b=document.createElement('button');b.type='button';b.className='admin-ui-nav-btn';b.dataset.group=g.id;b.innerHTML='<span class="admin-ui-nav-icon">'+g.icon+'</span><span class="admin-ui-nav-label">'+g.label+'</span><span class="admin-ui-nav-count">0</span>';b.addEventListener('click',()=>setGroup(g.id));nav.appendChild(b);});
  toolbar.querySelector('#adminUiSearch').addEventListener('input',e=>{state.search=normalize(e.target.value).toLowerCase();applyView();});
  toolbar.querySelector('.admin-ui-search-clear').addEventListener('click',()=>{const i=toolbar.querySelector('#adminUiSearch');i.value='';state.search='';applyView();i.focus();});
  sidebar.querySelector('[data-ui-action="expand"]').addEventListener('click',()=>setCollapse(false));
  sidebar.querySelector('[data-ui-action="collapse"]').addEventListener('click',()=>setCollapse(true));
  banner.querySelectorAll('[data-ui-jump]').forEach(b=>b.addEventListener('click',()=>setGroup(b.dataset.uiJump)));
}
function setCollapse(collapsed){
  document.querySelectorAll('#adminMain .card').forEach(card=>{card.classList.toggle('admin-ui-collapsed',collapsed);const btn=card.querySelector('.admin-ui-collapse');if(btn){btn.textContent=collapsed?'＋':'−';btn.setAttribute('aria-expanded',String(!collapsed));}});
}
function setGroup(id){state.active=GROUPS.some(g=>g.id===id)?id:'overview';localStorage.setItem('xianxia_admin_ui_group',state.active);applyView();window.scrollTo({top:0,behavior:'smooth'});}
function updateCounts(){
  GROUPS.forEach(g=>{const b=document.querySelector('.admin-ui-nav-btn[data-group="'+g.id+'"]');if(!b)return;let n;if(g.id==='all')n=document.querySelectorAll('#adminMain .admin-ui-pane .admin-ui-managed').length;else n=document.querySelectorAll('#adminMain .admin-ui-pane[data-group="'+g.id+'"] > .admin-ui-managed').length;b.querySelector('.admin-ui-nav-count').textContent=n;});
}
function applyView(){
  const active=state.active;const group=GROUPS.find(g=>g.id===active)||GROUPS[0];
  document.querySelectorAll('.admin-ui-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.group===active));
  const title=document.getElementById('adminUiSectionTitle');if(title)title.textContent=group.label;
  const panes=Array.from(document.querySelectorAll('#adminMain .admin-ui-pane'));
  let shown=0;
  panes.forEach(pane=>{
    const paneOn=active==='all'||pane.dataset.group===active;
    pane.classList.toggle('active',paneOn);
    Array.from(pane.children).forEach(card=>{
      if(!card.classList.contains('admin-ui-managed'))return;
      const searchOk=!state.search||normalize(card.textContent).toLowerCase().includes(state.search);
      card.dataset.uiSearchHidden=(paneOn&&searchOk)?'false':'true';
      if(paneOn&&searchOk)shown++;
    });
  });
  const banner=document.querySelector('[data-ui-dashboard]');if(banner)banner.style.display=active==='overview'?'grid':'none';
  const info=document.getElementById('adminUiToolbarInfo');if(info)info.textContent='顯示 '+shown+' 個區塊';
  const empty=document.querySelector('.admin-ui-empty');if(empty)empty.classList.toggle('on',shown===0);
}
function scheduleClassify(){if(state.scheduled||state.classifying)return;state.scheduled=true;requestAnimationFrame(()=>{state.scheduled=false;classify();});}
function init(){
  document.body.classList.add('admin-ui-ready');buildShell();classify();
  const content=document.querySelector('#adminMain > .admin-ui-content');
  if(content){state.observer=new MutationObserver(scheduleClassify);state.observer.observe(content,{childList:true,subtree:true});}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
