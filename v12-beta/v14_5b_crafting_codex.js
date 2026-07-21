/* 修仙大逃殺 V14.5B FIX1 — 萬法譜、神匠接線與更多功能入口 */
(() => {
  'use strict';
  if(window.__V145BCraftingCodexLoaded)return;window.__V145BCraftingCodexLoaded=true;
  const VERSION='V14.5B-FIX1-CODEX-1';
  const get=name=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const C=()=>get('C')||{};const IT=()=>get('IT')||{};const G=()=>get('g');
  const sheet=html=>{const fn=get('sheet')||window.sheet;if(typeof fn==='function')fn(html)};
  const recipes=()=>Array.isArray(C().craftingRecipes)?C().craftingRecipes.filter(r=>r&&r.enabled!==false&&r.public!==false):[];
  const itemName=id=>IT()?.[String(id)]?.name||String(id||'未設定');
  const count=id=>Number(G()?.inv?.[String(id)]||0);
  const categoryName=c=>({alchemy:'煉丹',equipment:'煉器',legendary:'絕世鍛造'}[c]||c);
  const icon=c=>({alchemy:'丹',equipment:'器',legendary:'絕'}[c]||'譜');
  const rate=r=>Math.round(Number(r.successRate??({alchemy:.75,equipment:1,legendary:.35}[r.category]||0))*100);
  function materialRows(r){
    const rows=[];
    if(r.blueprint)rows.push(`<li data-ok="${count(r.blueprint)>0?'1':'0'}"><span>圖譜</span><b>${esc(itemName(r.blueprint))}</b><em>${count(r.blueprint)>0?'已持有':'未持有'}</em></li>`);
    for(const [id,qty] of Object.entries(r.materials||{})){const have=count(id),ok=have>=Number(qty);rows.push(`<li data-ok="${ok?'1':'0'}"><span>材料</span><b>${esc(itemName(id))} ×${Number(qty)}</b><em>${have}/${Number(qty)}</em></li>`)}
    return rows.join('');
  }
  function recipeCard(r){
    return `<article class="v145b-recipe-card" data-category="${esc(r.category)}"><header><span>${icon(r.category)}</span><div><small>${esc(categoryName(r.category))}</small><h4>${esc(r.name)}</h4></div><b>${rate(r)}%</b></header><div class="v145b-recipe-output"><span>合成結果</span><strong>${esc(itemName(r.output?.itemId))} ×${Math.max(1,Number(r.output?.qty||1))}</strong></div><ul>${materialRows(r)}</ul><footer><span>精力 ${Math.max(0,Number(r.stamina||0))}</span><button class="btn" type="button" onclick="closeOv();setTimeout(()=>openCrafting('${esc(r.category)}'),80)">前往煉造</button></footer></article>`;
  }
  function openCodex(category='all'){
    const all=recipes();const groups=['all','alchemy','equipment','legendary'];
    const tabs=groups.map(k=>`<button class="${category===k?'on':''}" onclick="openRecipeCodexV145B('${k}')">${k==='all'?'全部':categoryName(k)}</button>`).join('');
    const list=all.filter(r=>category==='all'||r.category===category);
    const body=list.length?list.map(recipeCard).join(''):'<div class="v145b-codex-empty">目前沒有公開且啟用中的配方。</div>';
    sheet(`<div class="v145b-codex"><div class="v145b-codex-kicker">MYRIAD RECIPE CODEX</div><h3>萬法譜</h3><p class="small">由後台發布的公開配方會同步顯示；材料組合、產物與成功率可隨 Config 版本調整。</p><div class="tabs v145b-codex-tabs">${tabs}</div><div class="v145b-codex-list">${body}</div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">收起萬法譜</button></div>`);
  }
  function injectMoreMenu(){
    document.querySelectorAll('.v145a-more-grid').forEach(grid=>{
      if(grid.querySelector('[data-v145b-codex]'))return;
      const b=document.createElement('button');b.type='button';b.className='v145a-more-item';b.dataset.v145bCodex='1';b.innerHTML='<span>譜</span><b>萬法譜</b><small>查看公開合成配方</small>';b.addEventListener('click',()=>{get('closeOv')?.();setTimeout(()=>openCodex('all'),80)});grid.appendChild(b);
    });
  }
  function gameReady(){
    const game=document.getElementById('game');
    return !!(game && !game.classList.contains('hide') && window.V135_CRAFT_ENGINE);
  }
  let refreshTimer=0;
  function ensureFinalEncounterHook(){
    if(!gameReady())return;
    window.V135_CRAFT_ENGINE?.installEncounterHook?.();
    window.V135_CRAFT_ENGINE?.updateNpcPresence?.();
  }
  function safeRefresh(){
    if(!gameReady())return;
    injectMoreMenu();
    ensureFinalEncounterHook();
  }
  function boot(){
    // FIX4H: 移除全頁 MutationObserver。它會因神匠按鈕與黑雲地圖標記的
    // DOM 變動互相觸發，造成登入後高頻同步執行與頁面假死。
    safeRefresh();
    setTimeout(safeRefresh,500);
    setTimeout(safeRefresh,1600);
    clearInterval(refreshTimer);
    refreshTimer=setInterval(safeRefresh,5000);
  }
  window.openRecipeCodexV145B=openCodex;window.V145B_CRAFTING_CODEX={version:VERSION,recipes,open:openCodex,injectMoreMenu,ensureFinalEncounterHook};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
