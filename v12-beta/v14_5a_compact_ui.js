(()=>{
  'use strict';
  if(window.__V145PremiumHudLoaded)return;
  window.__V145PremiumHudLoaded=true;

  const state={tickerIndex:0,tickerTimer:null,lastQueueKey:'',auctionTimer:null};
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const get=(name)=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
  const ready=(fn)=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  const esc=(v)=>String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const controls=()=>window.cloudState?.worldControls||get('cloudState')?.worldControls||{};
  const button=(text,cls)=>{const b=document.createElement('button');b.type='button';b.className=`btn ${cls}`;b.textContent=text;return b;};

  const TIPS=[
    ['訣','探索未必直接獲得物品；有時情報比眼前的寶物更有價值。','tip'],
    ['圖','地圖上的地貌會影響遭遇與資源，前往前先確認區域資訊。','tip'],
    ['息','打坐可持續累積修為；危險區域打坐前，先確認世界事件。','tip'],
    ['囊','行囊中的裝備、符籙與丹藥，能在高風險戰鬥中救你一命。','tip'],
    ['煉','萬法煉造需要配方與材料；材料不足時，可先追查區域情報。','tip'],
    ['紋','器紋刻印成功率固定，但淬鍊失敗可能使法寶永久消失。','tip'],
    ['雲','黑雲內無法正常移動，只能探索；每次探索有 5% 機率找到出口。','warn'],
    ['獸','獸潮期間妖獸遭遇率提升，獸潮妖王有 5% 機率現身。','warn'],
    ['魔','大天劫代表古魔入侵；非安全區有機率遭遇 Lv12～14 古魔。','danger'],
    ['拍','萬寶拍賣每日 12:30、20:00 開場，每名玩家每日可上架一件拍品。','tip'],
    ['功','主畫面只顯示功法名稱；點擊功法即可查看完整效果。','tip'],
    ['訊','全服傳音會留下世界動向；有些 AI 修士的發言可能暗示附近風險。','tip']
  ];

  function compactCharacter(character){
    if(!character||character.dataset.v145aReady==='1')return;
    character.dataset.v145aReady='1';
    const name=q('.avatar-name',character);
    const realm=q('.realm-line',character);
    const meters=qa(':scope > .meter',character);
    const stats=q(':scope > .stat-grid',character);
    const techWrap=q(':scope > .technique-dock-wrap',character);
    if(name&&realm&&meters.length&&techWrap){
      const core=document.createElement('div');core.className='v145a-character-core';
      const vitals=document.createElement('section');vitals.className='v145a-vitals';
      const identity=document.createElement('div');identity.className='v145a-identity';identity.append(name,realm);
      vitals.append(identity,...meters);core.append(vitals,techWrap);
      const avatar=q('.avatar-wrap',character);if(avatar)avatar.insertAdjacentElement('afterend',core);else character.appendChild(core);
      if(stats)core.insertAdjacentElement('afterend',stats);
    }
    if(!q('.v145a-character-toggle',character)){
      const toggle=button('展開完整角色資料','v145a-character-toggle');
      toggle.addEventListener('click',()=>{const open=character.classList.toggle('v145a-expanded');toggle.textContent=open?'收合完整角色資料':'展開完整角色資料';});
      character.appendChild(toggle);
    }
  }

  function compactTechniques(){
    const tech=document.getElementById('techniqueDock');if(!tech||tech.dataset.v145aBound==='1')return;
    tech.dataset.v145aBound='1';
    tech.addEventListener('click',(e)=>{const slot=e.target.closest('.technique-slot');if(!slot)return;slot.classList.toggle('v145a-tech-expanded');});
  }

  function compactPanels(){
    const dashboard=q('#game .dashboard'),world=q('#game .world-panel'),character=q('#game .character-panel'),intel=q('#game .intel-panel');
    if(dashboard&&world&&character){dashboard.insertBefore(character,dashboard.firstChild);dashboard.insertBefore(world,character.nextSibling);if(intel)dashboard.appendChild(intel);}
    compactCharacter(character);
    if(intel&&!q('.v145a-intel-toggle',intel)){
      const t=button('展開區域情報','v145a-intel-toggle');t.addEventListener('click',()=>{const open=intel.classList.toggle('v145a-expanded');t.textContent=open?'收合區域情報':'展開區域情報';});intel.insertBefore(t,intel.children[1]||null);
    }
    const chat=document.getElementById('worldChatDock');
    if(chat&&!q('.v145a-chat-toggle',chat)){
      const t=button('展開傳音與輸入','v145a-chat-toggle');t.addEventListener('click',()=>{const open=chat.classList.toggle('v145a-expanded');t.textContent=open?'收合傳音':'展開傳音與輸入';});chat.appendChild(t);
    }
  }

  function markActionHierarchy(){
    const grid=q('#game .action-grid');if(!grid)return;
    qa('.action-tile',grid).forEach((el)=>{
      const code=(el.getAttribute('onclick')||'')+' '+(el.id||'');
      el.classList.remove('v145a-primary-action','v145a-secondary-action');
      if(/openWorldMap|explore\(|meditationButtonClick|openBag/.test(code))el.classList.add('v145a-primary-action');else el.classList.add('v145a-secondary-action');
    });
    if(!q('#v145aMoreAction',grid)){
      const more=document.createElement('button');more.type='button';more.id='v145aMoreAction';more.className='btn action-tile v145a-secondary-action';
      more.innerHTML='<span class="rune">更</span><span><strong>更多功能</strong><small>拍賣、傳音、教學與系統</small></span>';
      more.addEventListener('click',openMoreMenu);grid.appendChild(more);
    }
  }

  function nextAuction(){
    const now=new Date(),targets=[[12,30],[20,0]];
    for(const [h,m] of targets){const d=new Date(now);d.setHours(h,m,0,0);if(d>now)return d;}
    const d=new Date(now);d.setDate(d.getDate()+1);d.setHours(12,30,0,0);return d;
  }
  function auctionWindow(){
    const now=new Date();
    for(const [h,m] of [[12,30],[20,0]]){const d=new Date(now);d.setHours(h,m,0,0);const diff=(now-d)/60000;if(diff>=-10&&diff<=30)return {show:true,diff,start:d};}
    return {show:false,start:nextAuction()};
  }
  function remainText(date){
    const sec=Math.max(0,Math.floor((date-Date.now())/1000)),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return h?`${h}時${String(m).padStart(2,'0')}分`:`${m}分${String(s).padStart(2,'0')}秒`;
  }

  function eventMessages(){
    const c=controls(),rows=[];
    const sync=document.getElementById('cloudSyncBadge');
    if(c.black_cloud_active){
      const inside=!!window.V14BlackCloud?.isInside?.();
      rows.push([inside?'雲':'黑',inside?'你正被困在黑雲中：目前不可移動，只能探索尋找出口。':`黑雲壓境，中心位於 ${c.black_cloud_coord||'未知座標'}。`,inside?'danger':'warn']);
    }
    if(c.beast_tide_active)rows.push(['獸','獸潮來襲：妖獸遭遇率提升，獸潮妖王有 5% 機率現身。','warn']);
    if(c.great_tribulation_active){
      const end=c.great_tribulation_ends_at?new Date(c.great_tribulation_ends_at):null;
      rows.push(['魔',`大天劫・古魔入侵${end&&!Number.isNaN(end.getTime())?'，剩餘 '+remainText(end):'正在持續'}。`,'danger']);
    }
    const worldStatus=document.getElementById('worldStatus')?.textContent?.trim();
    if(worldStatus)rows.push(['世',worldStatus,'world']);
    if(sync){const t=sync.textContent.trim();if(t)rows.push(['雲',`雲端狀態：${t}`,(sync.dataset.state==='bad'||sync.dataset.state==='warn')?'warn':'system']);}
    const aw=auctionWindow();
    rows.push(['拍',aw.show?(aw.diff<0?`萬寶拍賣即將開場，倒數 ${remainText(aw.start)}。`:'萬寶拍賣正在開放，請把握本場競拍。'):`下一場萬寶拍賣倒數 ${remainText(aw.start)}。`,'system']);
    return rows;
  }

  function shuffledTips(count=3){
    const pool=TIPS.slice();for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}return pool.slice(0,count);
  }
  function tickerQueue(){
    const events=eventMessages();
    const active=events.filter(x=>['danger','warn'].includes(x[2]));
    const support=events.filter(x=>!['danger','warn'].includes(x[2]));
    return [...active,...support.slice(0,2),...shuffledTips(active.length?2:3)];
  }

  function ensureTicker(){
    let root=document.getElementById('v145aWorldTicker');if(root)return root;
    const header=q('#game .world-header');if(!header)return null;
    root=document.createElement('button');root.type='button';root.id='v145aWorldTicker';root.className='v145a-world-ticker';
    root.innerHTML='<span class="v145a-ticker-seal" id="v145aTickerSeal">世</span><span class="v145a-ticker-window"><span class="v145a-ticker-track" id="v145aTickerTrack">天地氣機運行中</span></span><span class="v145a-ticker-open">詳情</span>';
    root.addEventListener('click',openWorldInfo);header.insertAdjacentElement('afterend',root);return root;
  }
  function showTickerItem(item){
    const root=ensureTicker(),seal=document.getElementById('v145aTickerSeal'),track=document.getElementById('v145aTickerTrack');if(!root||!seal||!track)return;
    const [icon,text,type]=item;seal.textContent=icon;root.dataset.kind=type;
    track.classList.remove('v145a-running');track.textContent=text;void track.offsetWidth;
    const duration=Math.max(8,Math.min(16,6+String(text).length*.18));track.style.setProperty('--v145a-run-duration',`${duration}s`);track.classList.add('v145a-running');
  }
  function cycleTicker(force=false){
    const queue=tickerQueue();if(!queue.length)return;
    const key=queue.map(x=>x.join('|')).join('||');if(force||key!==state.lastQueueKey){state.tickerIndex=0;state.lastQueueKey=key;}
    showTickerItem(queue[state.tickerIndex%queue.length]);state.tickerIndex=(state.tickerIndex+1)%queue.length;
    clearTimeout(state.tickerTimer);state.tickerTimer=setTimeout(()=>cycleTicker(false),9000);
  }

  function infoRows(){
    const c=controls(),rows=[];
    rows.push(['雲端同步',document.getElementById('cloudSyncBadge')?.textContent?.trim()||'等待同步']);
    rows.push(['黑雲',c.black_cloud_active?`啟動中｜中心 ${c.black_cloud_coord||'未知'}${window.V14BlackCloud?.isInside?.()?'｜你目前受困其中':''}`:'未啟動']);
    rows.push(['獸潮',c.beast_tide_active?'正在席捲世界':'未啟動']);
    const end=c.great_tribulation_ends_at?new Date(c.great_tribulation_ends_at):null;
    rows.push(['大天劫',c.great_tribulation_active?`古魔入侵中${end&&!Number.isNaN(end.getTime())?'｜剩餘 '+remainText(end):''}`:'未啟動']);
    rows.push(['下一場拍賣',nextAuction().toLocaleString('zh-TW',{hour:'2-digit',minute:'2-digit',month:'2-digit',day:'2-digit'})]);
    return rows;
  }
  function openWorldInfo(){
    const sheetFn=get('sheet')||window.sheet;if(typeof sheetFn!=='function')return;
    const rows=infoRows().map(([k,v])=>`<div class="v145a-info-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
    const tips=shuffledTips(4).map(([,t])=>`<li>${esc(t)}</li>`).join('');
    sheetFn(`<div class="v145a-info-sheet"><div class="v145a-info-kicker">WORLD INTELLIGENCE</div><h3>天地情報</h3><div class="v145a-info-list">${rows}</div><div class="v145a-info-subtitle">修行提示</div><ul class="v145a-tip-list">${tips}</ul><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">收起情報</button></div>`);
  }

  function actionCall(name){
    const fn=window[name]||get(name);if(typeof fn==='function'){try{return fn()}catch(e){console.warn('[V14.5A action]',name,e);}}
    const toastFn=window.toast||get('toast');if(typeof toastFn==='function')toastFn('此功能尚未載入');
  }
  function openMoreMenu(){
    const sheetFn=get('sheet')||window.sheet;if(typeof sheetFn!=='function')return;
    const item=(icon,label,call,sub='')=>`<button class="v145a-more-item" type="button" onclick="closeOv();setTimeout(()=>window.V145PremiumHud.run('${call}'),80)"><span>${icon}</span><b>${label}</b>${sub?`<small>${sub}</small>`:''}</button>`;
    sheetFn(`<div class="v145a-more-sheet"><div class="v145a-info-kicker">CULTIVATION MENU</div><h3>更多功能</h3><div class="v145a-more-grid">${item('坊','商城坊市','openShop','NPC交易與元寶')}${item('拍','萬寶拍賣','openAuctionHouseV142','競標、上架、領取')}${item('破','境界突破','openBreak','築基、結丹、元嬰')}${item('煉','萬法煉造','openCrafting','煉丹、煉器與鍛造')}${item('音','全服傳音','openWorldChat','查看與發布傳音')}${item('訣','新手教學','openTutorial','重新查看操作教學')}${item('紋','天工器紋','openArtifactWorkshopV143','刻印、洗煉與淬鍊')}${item('雲','天地情報','openV145WorldInfo','世界事件與提示')}</div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">返回</button></div>`);
  }

  function compactNav(){
    const nav=q('#game .mobile-nav');if(!nav)return;
    const buttons=qa('button',nav);if(buttons.length<5)return;
    buttons[4].innerHTML='<b>更</b>更多';buttons[4].onclick=openMoreMenu;
    if(buttons[5])buttons[5].style.display='none';
  }

  function updateAuctionLauncher(){
    const el=document.getElementById('auctionLaunch');if(!el)return;
    const w=auctionWindow();el.classList.toggle('v145a-auction-live',w.show);
    el.hidden=!w.show;
    if(w.show)el.textContent=w.diff<0?`拍賣 ${remainText(w.start)}`:'萬寶拍賣';
  }

  function refineBrand(){
    const tag=q('#game .brand-tag');if(tag)tag.textContent='V14.5 · CELESTIAL HUD';
  }

  function boot(){
    compactPanels();compactTechniques();markActionHierarchy();compactNav();refineBrand();ensureTicker();cycleTicker(true);updateAuctionLauncher();
    clearInterval(state.auctionTimer);state.auctionTimer=setInterval(()=>{markActionHierarchy();updateAuctionLauncher();cycleTicker(false);},5000);
    const observer=new MutationObserver(()=>{markActionHierarchy();updateAuctionLauncher();});observer.observe(document.body,{childList:true,subtree:true});
  }

  window.openV145WorldInfo=openWorldInfo;
  window.V145PremiumHud={openWorldInfo,openMoreMenu,run:(name)=>name==='openV145WorldInfo'?openWorldInfo():actionCall(name),refresh:()=>cycleTicker(true)};
  ready(boot);
})();
