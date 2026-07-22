/* 修仙大逃殺｜專業後台導覽 V14.7 ADMIN UI FIX5
   顯示層插件：真正將功能卡片分派到獨立分類頁；不覆寫原函式、不改欄位 ID、不改 RPC。 */
(function(){
'use strict';
const GROUPS=[
  {id:'overview',label:'總覽',icon:'◈',keys:['世界即時狀態','最近操作']},
  {id:'players',label:'玩家管理',icon:'♟',keys:['玩家管理與卡點救援']},
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
function absorbStrayMainChildren(main,content){
  Array.from(main.children).forEach(node=>{
    if(node===content||node.classList?.contains('admin-ui-sidebar'))return;
    // 動態模組可能在 UI 建立後仍直接 append 到 #adminMain；先移入內容區再分類。
    content.appendChild(node);
  });
}
function cleanEmptyLayouts(content){
  Array.from(content.querySelectorAll('.grid')).forEach(grid=>{
    if(grid.closest('.admin-ui-pane'))return;
    if(!grid.querySelector('section.card')&&!normalize(grid.textContent))grid.remove();
  });
  Array.from(content.children).forEach(node=>{
    if(node.matches?.('.admin-ui-toolbar,.admin-ui-dashboard-banner,.admin-ui-panes,.admin-ui-empty'))return;
    if(node.matches?.('section.card'))return;
    if(!node.querySelector?.('section.card')&&!normalize(node.textContent))node.remove();
  });
}
function classify(){
  if(state.classifying)return;
  const main=document.getElementById('adminMain');
  const content=main&&main.querySelector(':scope > .admin-ui-content');
  if(!content)return;
  state.classifying=true;
  try{
    absorbStrayMainChildren(main,content);
    const cards=Array.from(main.querySelectorAll('section.card')).filter(card=>{
      if(card.closest('.admin-ui-sidebar'))return false;
      return isTopCard(card);
    });
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
  const existing=Array.from(main.children).filter(node=>!node.classList?.contains('admin-ui-sidebar')&&!node.classList?.contains('admin-ui-content'));
  const sidebar=document.createElement('aside');sidebar.className='admin-ui-sidebar';
  sidebar.innerHTML='<div class="admin-ui-sidebar-title">管理模組</div><nav class="admin-ui-nav" aria-label="後台功能分類"></nav><div class="admin-ui-side-actions"><button type="button" class="btn" data-ui-action="expand">全部展開</button><button type="button" class="btn" data-ui-action="collapse">全部收合</button></div>';
  const content=document.createElement('div');content.className='admin-ui-content';
  const toolbar=document.createElement('div');toolbar.className='admin-ui-toolbar';toolbar.innerHTML='<div class="admin-ui-section-title" id="adminUiSectionTitle">總覽</div><div class="admin-ui-search-wrap"><input class="admin-ui-search" id="adminUiSearch" type="search" placeholder="搜尋目前模組的功能、欄位或文字"><button type="button" class="admin-ui-search-clear" title="清除搜尋">×</button></div><div class="admin-ui-toolbar-info" id="adminUiToolbarInfo"></div>';
  const banner=document.createElement('div');banner.className='admin-ui-dashboard-banner';banner.dataset.uiDashboard='1';banner.innerHTML='<div><b>世界管理駕駛艙</b><span>各管理功能已分入獨立模組；切換分類時只顯示該頁內容。</span></div><div class="admin-ui-quick"><button type="button" class="btn" data-ui-jump="world">世界控制</button><button type="button" class="btn gold" data-ui-jump="auction">萬寶拍賣</button><button type="button" class="btn jade" data-ui-jump="config">遊戲數值</button></div>';
  const panes=document.createElement('div');panes.className='admin-ui-panes';
  GROUPS.filter(g=>g.id!=='all').forEach(g=>{const p=document.createElement('div');p.className='admin-ui-pane';p.dataset.group=g.id;panes.appendChild(p);});
  const other=document.createElement('div');other.className='admin-ui-pane';other.dataset.group='other';panes.appendChild(other);
  const empty=document.createElement('div');empty.className='admin-ui-empty';empty.textContent='目前分類沒有符合搜尋條件的項目。';
  content.append(toolbar,banner,panes,...existing,empty);
  main.replaceChildren(sidebar,content);
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
  const main=document.getElementById('adminMain');
  if(main){state.observer=new MutationObserver(scheduleClassify);state.observer.observe(main,{childList:true,subtree:true});}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* V14.6 ADMIN UI FIX3｜道具與配方簡化工作流
   僅包裝既有套用、儲存、發布函式；不改 Config/RPC/資料結構。 */
(function(){
'use strict';
const SIMPLE_ATTR='data-simple-workflow-ready';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const text=n=>(n?.textContent||'').replace(/\s+/g,' ').trim();
function toastSafe(message){
  if(typeof window.toast==='function')window.toast(message);
  else alert(message);
}
function busy(button,on,label){
  if(!button)return;
  if(on){button.dataset.oldText=button.textContent;button.disabled=true;button.textContent=label||'處理中…';}
  else{button.disabled=false;button.textContent=button.dataset.oldText||button.textContent;}
}
function findButton(root,patterns){
  return Array.from(root?.querySelectorAll('button')||[]).find(b=>patterns.some(p=>p.test(text(b))));
}
function hideLegacyButtons(card,type){
  const patterns=type==='config'
    ? [/從目前正式版建立草稿/,/^儲存草稿$/,/^發布草稿$/]
    : [/套用全部到草稿/,/套用至目前草稿/,/^儲存草稿$/,/^發布草稿$/];
  Array.from(card.querySelectorAll('button')).forEach(b=>{
    if(patterns.some(p=>p.test(text(b)))){
      b.classList.add('admin-ui-legacy-workflow');
      b.setAttribute('aria-hidden','true');
      b.tabIndex=-1;
    }
  });
}
function applyCraftChanges(card){
  if(typeof window.applyCraftConfigV135==='function'){
    const result=window.applyCraftConfigV135();
    if(result===false)throw new Error('配方內容尚未通過驗證');
    return true;
  }
  const apply=findButton(card,[/套用全部到草稿/,/套用至目前草稿/]);
  if(apply){apply.click();return true;}
  return true;
}
async function saveConfig(){
  if(typeof window.saveConfigDraftV129!=='function')throw new Error('遊戲數值儲存功能尚未載入');
  const ok=await window.saveConfigDraftV129();
  if(ok===false)throw new Error('資料驗證未通過，請查看畫面提示');
  return true;
}
async function publishConfig(){
  await saveConfig();
  await delay(80);
  if(typeof window.publishConfigDraftV129!=='function')throw new Error('發布功能尚未載入');
  await window.publishConfigDraftV129();
}
function makeBar(card,type){
  if(card.hasAttribute(SIMPLE_ATTR))return;
  card.setAttribute(SIMPLE_ATTR,'1');
  hideLegacyButtons(card,type);
  const bar=document.createElement('div');
  bar.className='admin-ui-simple-workflow';
  bar.innerHTML='<div class="admin-ui-simple-copy"><b>修改完成後只要兩步</b><span>先儲存確認內容，再發布到正式遊戲。</span></div><div class="admin-ui-simple-actions"><button type="button" class="btn jade" data-simple-save>儲存修改</button><button type="button" class="btn gold" data-simple-publish>發布正式版</button></div>';
  const heading=card.querySelector(':scope > h2, :scope > .head');
  if(heading)heading.insertAdjacentElement('afterend',bar);else card.prepend(bar);
  const saveBtn=bar.querySelector('[data-simple-save]');
  const pubBtn=bar.querySelector('[data-simple-publish]');
  saveBtn.addEventListener('click',async()=>{
    busy(saveBtn,true,'儲存中…');
    try{
      if(type==='craft')applyCraftChanges(card);
      await delay(60);
      await saveConfig();
      toastSafe('修改已儲存，尚未發布到遊戲');
    }catch(e){toastSafe('儲存失敗：'+(e?.message||e));}
    finally{busy(saveBtn,false);}
  });
  pubBtn.addEventListener('click',async()=>{
    if(!confirm('確定將目前修改發布到正式遊戲？'))return;
    busy(pubBtn,true,'發布中…');
    try{
      if(type==='craft')applyCraftChanges(card);
      await delay(60);
      await publishConfig();
    }catch(e){toastSafe('發布失敗：'+(e?.message||e));}
    finally{busy(pubBtn,false);}
  });
}
function enhance(){
  document.querySelectorAll('#adminMain section.card').forEach(card=>{
    const t=text(card.querySelector(':scope > h2, :scope > .head h2'));
    if(/遊戲數值營運後台/.test(t))makeBar(card,'config');
    if(/萬法煉造與合成控制台|V13\.5 煉造系統|絕世神匠|萬法譜/.test(t))makeBar(card,'craft');
  });
}
let pending=false;
function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;enhance();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{enhance();new MutationObserver(schedule).observe(document.getElementById('adminMain')||document.body,{childList:true,subtree:true});});
else{enhance();new MutationObserver(schedule).observe(document.getElementById('adminMain')||document.body,{childList:true,subtree:true});}
})();
