/* 修仙大逃殺 V14.5C FIX1 — 探索情報系統
 * 只在原探索確定沒有物品、沒有遭遇、沒有其他事件時，才以 40% 機率給予情報。
 * 情報可持久化至 Supabase；資料庫不可用時退回角色雲端存檔，不阻斷探索。
 * 同步修正 V14 固定地圖與 V13.5 天地靈物地域名稱不一致，確保情報指向的地點實際可探索靈物。
 */
(function(){
  'use strict';
  if(window.__V145CIntelLoaded)return;
  window.__V145CIntelLoaded=true;

  const VERSION='V14.5C-FIX1-20260721';
  const EMPTY_TO_INTEL_RATE=.40;
  const MAX_INTEL=30;
  const EMPTY_TEXT='你搜尋四周，暫無所得。';
  const state={wrapped:false,mapWrapped:false,moveWrapped:false,loaded:false,loading:false,rows:[],focusId:null,observer:null,dbWarned:false};

  const get=(name)=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
  const setGlobal=(name,value)=>{try{Function('v',name+'=v')(value);return true}catch(_){try{window[name]=value;return true}catch(__){return false}}};
  const esc=(s)=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const strip=(s)=>String(s??'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
  const rnd=(arr)=>arr&&arr.length?arr[Math.floor(Math.random()*arr.length)]:null;
  const nowIso=()=>new Date().toISOString();
  const getG=()=>get('g');
  const getCloud=()=>window.cloudState||get('cloudState')||{};
  const getClient=()=>getCloud().client||null;
  const getUser=()=>getCloud().user||null;
  const currentCoord=()=>{const g=getG();return g?.pos?String.fromCharCode(65+Number(g.pos.r))+'-'+(Number(g.pos.c)+1):''};
  const coordParts=(coord)=>{const m=String(coord||'').match(/^([A-J])-(10|[1-9])$/);return m?[m[1].charCodeAt(0)-65,Number(m[2])-1]:null};
  const coordDistance=(a,b)=>{const x=coordParts(a),y=coordParts(b);return x&&y?Math.max(Math.abs(x[0]-y[0]),Math.abs(x[1]-y[1])):999};
  const mapApi=()=>window.V144_FIXED_MAP||null;
  const mapEntries=()=>Object.values(mapApi()?.MAP||{});
  const mapInfo=(coord)=>mapApi()?.MAP?.[coord]||null;
  const controls=()=>getCloud().worldControls||{};
  const save=()=>{const fn=get('saveGame');if(typeof fn==='function')try{fn(false)}catch(_){}};
  const render=()=>{const fn=get('render');if(typeof fn==='function')try{fn()}catch(_){}};
  const logMsg=(msg,type='la')=>{const fn=get('log');if(typeof fn==='function')try{fn(msg,type)}catch(_){}};
  const toastMsg=(msg)=>{const fn=get('toast');if(typeof fn==='function')try{fn(msg)}catch(_){}};
  const closeSheet=()=>{const fn=get('closeOv');if(typeof fn==='function')try{fn()}catch(_){}};

  const TREASURES={
    '9501':{name:'青帝木心',kind:'label',value:'萬木森域'},
    '9502':{name:'大日砂晶',kind:'label',value:'赤沙荒漠'},
    '9503':{name:'戰魂玄鐵',kind:'label',value:'太古戰場'},
    '9504':{name:'太初道紋',kind:'label',value:'上古遺跡'},
    '9505':{name:'崑崙仙髓',kind:'label',value:'崑崙山'},
    '9506':{name:'北辰天璇玉',kind:'label',value:'北寒天宮'},
    '9507':{name:'萬載玄冰魄',kind:'type',value:'ice'},
    '9508':{name:'滄海龍涎珠',kind:'type',value:'sea'},
    '9509':{name:'冰火兩儀晶',kind:'label',value:'冰火島'},
    '9510':{name:'陰陽混元珠',kind:'type',value:'yinyang'}
  };

  function ensureLocalStore(){
    const g=getG();if(!g)return [];
    if(!Array.isArray(g.explorationIntel))g.explorationIntel=[];
    return g.explorationIntel;
  }
  function normalizeRow(row){
    if(!row)return null;
    const exp=new Date(row.expires_at||Date.now()+1800000);
    let status=row.status||'active';if(exp<=new Date()&&status!=='dismissed')status='expired';
    return {...row,id:String(row.id||('local-'+Date.now()+'-'+Math.random().toString(36).slice(2))),accuracy_radius:Math.max(0,Math.min(2,Number(row.accuracy_radius)||0)),status,expires_at:exp.toISOString()};
  }
  function mergeRows(rows){
    const byId=new Map();
    [...ensureLocalStore(),...(rows||[])].map(normalizeRow).filter(Boolean).forEach(r=>byId.set(String(r.id),r));
    state.rows=[...byId.values()].sort((a,b)=>new Date(b.discovered_at||0)-new Date(a.discovered_at||0)).slice(0,MAX_INTEL);
    const g=getG();if(g){g.explorationIntel=state.rows;save()}
    return state.rows;
  }
  async function loadRows(force=false){
    if(state.loading||(!force&&state.loaded))return state.rows;
    state.loading=true;
    try{
      const client=getClient(),user=getUser();
      if(client&&user){
        await client.from('exploration_intel').update({status:'expired',updated_at:nowIso()}).eq('user_id',user.id).in('status',['active','arrived']).lte('expires_at',nowIso());
        const {data,error}=await client.from('exploration_intel').select('*').eq('user_id',user.id).order('discovered_at',{ascending:false}).limit(MAX_INTEL);
        if(error)throw error;mergeRows(data||[]);
      }else mergeRows([]);
      state.loaded=true;
    }catch(err){
      mergeRows([]);
      if(!state.dbWarned){state.dbWarned=true;console.warn('[V14.5C] 情報資料庫未就緒，暫存於角色存檔：',err?.message||err)}
    }finally{state.loading=false}
    return state.rows;
  }
  async function persistRow(row){
    const normalized=normalizeRow(row);mergeRows([normalized]);
    const client=getClient(),user=getUser();if(!client||!user)return normalized;
    try{
      const payload={
        user_id:user.id,intel_type:normalized.intel_type,title:normalized.title,message:normalized.message,
        target_coord:normalized.target_coord||null,target_name:normalized.target_name||null,target_item_id:normalized.target_item_id||null,
        credibility:normalized.credibility,accuracy_radius:normalized.accuracy_radius,source_coord:normalized.source_coord||null,
        status:normalized.status,payload:normalized.payload||{},discovered_at:normalized.discovered_at,expires_at:normalized.expires_at,updated_at:nowIso()
      };
      const {data,error}=await client.from('exploration_intel').insert(payload).select('*').single();
      if(error)throw error;
      state.rows=state.rows.filter(x=>String(x.id)!==String(normalized.id));
      const g=getG();if(g)g.explorationIntel=state.rows.slice();
      mergeRows([data]);
      return data;
    }catch(err){if(!state.dbWarned){state.dbWarned=true;console.warn('[V14.5C] 情報寫入失敗，已保留於角色存檔：',err?.message||err)}return normalized}
  }
  async function updateStatus(id,status){
    const row=state.rows.find(x=>String(x.id)===String(id));if(!row)return;
    row.status=status;row.updated_at=nowIso();mergeRows([row]);
    const client=getClient(),user=getUser();if(client&&user&&!String(id).startsWith('local-')){
      try{await client.from('exploration_intel').update({status,updated_at:nowIso()}).eq('id',id).eq('user_id',user.id)}catch(err){console.warn('[V14.5C] status update failed',err)}
    }
  }

  function credibility(){
    const x=Math.random();
    if(x<.35)return {key:'reliable',label:'可靠情報',radius:0,minutes:45};
    if(x<.80)return {key:'fuzzy',label:'模糊情報',radius:1,minutes:30};
    return {key:'rumor',label:'坊間傳聞',radius:2,minutes:20};
  }
  function treasureTargets(){
    const entries=mapEntries(),out=[];
    for(const [itemId,t] of Object.entries(TREASURES)){
      let cells=entries.filter(x=>t.kind==='label'?x.label===t.value:x.type===t.value);
      if(itemId==='9508')cells=entries.filter(x=>x.type==='sea'||x.type==='lighthouse');
      for(const cell of cells)out.push({itemId,itemName:t.name,cell});
    }
    return out;
  }
  function makeTreasureIntel(){
    let choices=treasureTargets();
    const activeKeys=new Set(state.rows.filter(x=>['active','arrived'].includes(x.status)&&new Date(x.expires_at)>new Date()).map(x=>`${x.target_item_id}|${x.target_coord}`));
    const filtered=choices.filter(x=>!activeKeys.has(`${x.itemId}|${x.cell.coord}`)&&x.cell.coord!==currentCoord());
    if(filtered.length)choices=filtered;
    const pick=rnd(choices);if(!pick)return null;
    const c=credibility(),loc=pick.cell.label,coord=pick.cell.coord;
    let message='';
    if(c.key==='reliable')message=`一名採藥修士確信在 ${coord}・${loc} 感應到「${pick.itemName}」的天地靈機。`;
    else if(c.key==='fuzzy')message=`你從殘留靈韻判斷，「${pick.itemName}」可能出現在 ${coord}・${loc} 周邊一格。`;
    else message=`坊間傳聞有人曾在 ${coord}・${loc} 一帶看見「${pick.itemName}」，但消息可能已經過時。`;
    const discovered=new Date(),expires=new Date(discovered.getTime()+c.minutes*60000);
    return normalizeRow({
      id:'local-'+Date.now()+'-'+Math.random().toString(36).slice(2),intel_type:'treasure',title:`${c.label}・天地靈物`,message,
      target_coord:coord,target_name:loc,target_item_id:pick.itemId,credibility:c.key,accuracy_radius:c.radius,source_coord:currentCoord(),
      status:'active',payload:{item_name:pick.itemName,credibility_label:c.label},discovered_at:discovered.toISOString(),expires_at:expires.toISOString(),updated_at:discovered.toISOString()
    });
  }
  function makeCultivatorIntel(){
    const cloud=getCloud(),ai=get('ai')||[];
    const humans=(cloud.otherPlayers||[]).filter(x=>x?.alive&&x.coord&&x.coord!==currentCoord()).map(x=>({name:x.player_name||x.name||'無名修士',coord:x.coord,kind:'真人修士'}));
    const ais=ai.filter(x=>x?.alive&&x.coord&&x.coord!==currentCoord()).map(x=>({name:x.name||'無名修士',coord:x.coord,kind:'修士'}));
    const pick=rnd(humans.length?humans:ais);if(!pick)return null;
    const cell=mapInfo(pick.coord),discovered=new Date(),expires=new Date(discovered.getTime()+5*60000);
    return normalizeRow({id:'local-'+Date.now()+'-'+Math.random().toString(36).slice(2),intel_type:'cultivator',title:'修士行蹤',message:`你從尚未散去的氣息判斷，${pick.name} 不久前曾在 ${pick.coord}・${cell?.label||'未知地域'} 活動。`,target_coord:pick.coord,target_name:cell?.label||'未知地域',credibility:'fuzzy',accuracy_radius:1,source_coord:currentCoord(),status:'active',payload:{cultivator_name:pick.name},discovered_at:discovered.toISOString(),expires_at:expires.toISOString(),updated_at:discovered.toISOString()});
  }
  function makeEventIntel(){
    const c=controls(),discovered=new Date();
    if(c.black_cloud_active&&c.black_cloud_coord){
      const expires=new Date(discovered.getTime()+20*60000),cell=mapInfo(c.black_cloud_coord);
      return normalizeRow({id:'local-'+Date.now()+'-'+Math.random().toString(36).slice(2),intel_type:'world',title:'黑雲動向',message:`附近修士傳來警訊：黑雲核心目前位於 ${c.black_cloud_coord}・${cell?.label||'未知地域'}，進入後將無法正常移動。`,target_coord:c.black_cloud_coord,target_name:cell?.label||'未知地域',credibility:'reliable',accuracy_radius:1,source_coord:currentCoord(),status:'active',payload:{event:'black_cloud'},discovered_at:discovered.toISOString(),expires_at:expires.toISOString(),updated_at:discovered.toISOString()});
    }
    if(c.beast_tide_active){
      const cells=mapEntries().filter(x=>!['market','village'].includes(x.type));const cell=rnd(cells);if(cell){const expires=new Date(discovered.getTime()+20*60000);return normalizeRow({id:'local-'+Date.now()+'-'+Math.random().toString(36).slice(2),intel_type:'beast',title:'獸潮妖氣',message:`獵妖修士回報：${cell.coord}・${cell.label} 附近妖氣翻湧，獸潮期間可能接連遭遇妖獸。`,target_coord:cell.coord,target_name:cell.label,credibility:'fuzzy',accuracy_radius:1,source_coord:currentCoord(),status:'active',payload:{event:'beast_tide'},discovered_at:discovered.toISOString(),expires_at:expires.toISOString(),updated_at:discovered.toISOString()})}
    }
    const specials=mapEntries().filter(x=>['battle','ruin','abyss','lighthouse'].includes(x.type));const cell=rnd(specials);if(!cell)return null;
    const expires=new Date(discovered.getTime()+25*60000);
    return normalizeRow({id:'local-'+Date.now()+'-'+Math.random().toString(36).slice(2),intel_type:'location',title:'地域異動',message:`你在殘破地圖上發現標記：${cell.coord}・${cell.label} 最近似乎出現異常靈氣波動。`,target_coord:cell.coord,target_name:cell.label,credibility:'rumor',accuracy_radius:2,source_coord:currentCoord(),status:'active',payload:{terrain:cell.type},discovered_at:discovered.toISOString(),expires_at:expires.toISOString(),updated_at:discovered.toISOString()});
  }
  function generateIntel(){
    const r=Math.random();let intel=r<.70?makeTreasureIntel():(r<.85?makeCultivatorIntel():makeEventIntel());
    if(!intel)intel=makeTreasureIntel()||makeEventIntel();
    return intel;
  }
  async function grantIntel(){
    await loadRows();const intel=generateIntel();if(!intel){logMsg(EMPTY_TEXT);return false}
    await persistRow(intel);
    const item=intel.payload?.item_name?`「${intel.payload.item_name}」`:'一則線索';
    logMsg(`【探索情報】你沒有找到物品，卻獲得了關於 ${item} 的線索。`,'lg');
    toastMsg('獲得一則探索情報，已收入傳聞錄');
    markMapIntel();injectMoreMenu();
    return true;
  }

  function hasNewOverlay(before){const ov=document.getElementById('ov');return !!(ov?.classList.contains('on')&&!before)};
  function wrapExplore(){
    if(state.wrapped)return;
    const oldExplore=get('explore'),oldLog=get('log');if(typeof oldExplore!=='function'||typeof oldLog!=='function')return;
    setGlobal('explore',function(){
      const beforeCoord=currentCoord(),beforeFight=get('fight'),beforeOverlay=!!document.getElementById('ov')?.classList.contains('on');let empty=false;
      const liveLog=get('log')||oldLog;
      setGlobal('log',function(message,type){if(strip(message)===EMPTY_TEXT){empty=true;return}return liveLog.apply(this,arguments)});
      let result;
      try{result=oldExplore.apply(this,arguments)}finally{setGlobal('log',liveLog)}
      setTimeout(()=>{
        if(!empty)return;
        const changed=currentCoord()!==beforeCoord,combat=get('fight')&&get('fight')!==beforeFight,overlay=hasNewOverlay(beforeOverlay);
        if(changed||combat||overlay)return;
        if(Math.random()<EMPTY_TO_INTEL_RATE)grantIntel();else liveLog(EMPTY_TEXT);
      },0);
      return result;
    });
    state.wrapped=true;
  }

  function fixedTreasureItem(){
    const api=mapApi(),g=getG();if(!api||!g?.pos)return null;
    const cell=api.infoFor?.(g.pos.r,g.pos.c)||mapInfo(currentCoord());if(!cell)return null;
    for(const [itemId,t] of Object.entries(TREASURES)){
      if(t.kind==='label'&&cell.label===t.value)return {itemId,itemName:t.name,cell};
      if(t.kind==='type'&&cell.type===t.value)return {itemId,itemName:t.name,cell};
      if(itemId==='9508'&&(cell.type==='sea'||cell.type==='lighthouse'))return {itemId,itemName:t.name,cell};
    }
    return null;
  }
  function recordTreasure(itemId,field){
    const g=getG();if(!g)return;
    g.worldStats=g.worldStats||{};g.worldStats.heavenlyTreasure=g.worldStats.heavenlyTreasure||{discoveries:0,captures:0,failedCaptures:0,aiCaptures:0,byItem:{}};
    const s=g.worldStats.heavenlyTreasure;s[field]=(s[field]||0)+1;s.byItem=s.byItem||{};s.byItem[itemId]=s.byItem[itemId]||{discoveries:0,captures:0,failedCaptures:0,aiCaptures:0};s.byItem[itemId][field]=(s.byItem[itemId][field]||0)+1;
  }
  function installFixedTreasureBridge(){
    const expansion=window.V135_WORLD_EXPANSION;if(!expansion||expansion.__v145cFixedMapBridge)return;
    const original=expansion.beforeExplore;
    expansion.beforeExplore=function(){
      const target=fixedTreasureItem();if(!target)return false;
      const rates=typeof expansion.rates==='function'?expansion.rates():{discovery:.15,capture:.10};
      if(Math.random()>=Number(rates.discovery||.15))return false;
      const g=getG(),IT=get('IT')||{};if(!g||!IT[target.itemId])return typeof original==='function'?original():false;
      const item=IT[target.itemId];recordTreasure(target.itemId,'discoveries');
      if(Math.random()<Number(rates.capture||.10)){
        g.inv=g.inv||{};g.inv[target.itemId]=(g.inv[target.itemId]||0)+1;recordTreasure(target.itemId,'captures');
        logMsg(`天地異象驟現，你成功收取 <b>${esc(item.name||target.itemName)}</b>。`,'lg');
        const sheetFn=get('sheet');if(typeof sheetFn==='function')sheetFn(`<h3>天地靈物現世</h3><p>你依循天地情報，在 <b>${esc(target.cell.label)}</b> 感應到異象，並成功將 <b style="color:var(--gold)">${esc(item.name||target.itemName)}</b> 收入背包。</p><div class="notice">情報只提供線索；天地靈物仍依原本發現與收取機率判定。</div><button class="btn gold" style="width:100%;margin-top:12px" onclick="closeOv()">收入囊中</button>`);
      }else{
        recordTreasure(target.itemId,'failedCaptures');logMsg(`你發現 <b>${esc(item.name||target.itemName)}</b> 的氣息，但天地靈機轉瞬消散。`,'la');
        const sheetFn=get('sheet');if(typeof sheetFn==='function')sheetFn(`<h3>天地異象消散</h3><p>你在 <b>${esc(target.cell.label)}</b> 發現 <b style="color:var(--gold)">${esc(item.name||target.itemName)}</b>，但本次收取失敗。</p><div class="money"><div><span>發現機率</span><b>${Math.round(Number(rates.discovery||.15)*100)}%</b></div><div><span>收取機率</span><b>${Math.round(Number(rates.capture||.10)*100)}%</b></div></div><button class="btn" style="width:100%" onclick="closeOv()">返回</button>`);
      }
      save();render();return true;
    };
    expansion.__v145cFixedMapBridge=true;
  }

  function activeRows(){return state.rows.filter(x=>['active','arrived'].includes(x.status)&&new Date(x.expires_at)>new Date())}
  function timeLeft(row){
    const ms=new Date(row.expires_at)-Date.now();if(ms<=0)return '已失效';const m=Math.ceil(ms/60000);return m>=60?`${Math.floor(m/60)}時${m%60}分`:`${m}分鐘`;
  }
  function credLabel(key){return key==='reliable'?'可靠':key==='fuzzy'?'模糊':'傳聞'}
  function typeIcon(type){return type==='treasure'?'靈':type==='cultivator'?'修':type==='beast'?'獸':type==='world'?'世':'跡'}
  function rowHtml(row){
    const target=row.target_coord?`${row.target_coord}${row.target_name?'・'+row.target_name:''}`:'無指定位置';
    const mapBtn=row.target_coord?`<button class="btn jade" onclick="window.V145CIntel.viewMap('${esc(row.id)}')">查看地圖</button>`:'';
    return `<article class="v145c-intel-card" data-status="${esc(row.status)}"><div class="v145c-intel-top"><span class="v145c-intel-icon">${typeIcon(row.intel_type)}</span><div><b>${esc(row.title)}</b><small>${credLabel(row.credibility)}｜剩餘 ${timeLeft(row)}</small></div></div><p>${esc(row.message)}</p><div class="v145c-intel-target"><span>指向</span><b>${esc(target)}</b>${row.status==='arrived'?'<em>已抵達情報區域</em>':''}</div><div class="v145c-intel-actions">${mapBtn}<button class="btn" onclick="window.V145CIntel.dismiss('${esc(row.id)}')">忽略</button></div></article>`;
  }
  async function openIntelBook(){
    await loadRows(true);const sheetFn=get('sheet');if(typeof sheetFn!=='function')return;
    const rows=activeRows();const html=rows.length?rows.map(rowHtml).join(''):'<div class="v145c-intel-empty">目前沒有有效情報。探索一無所獲時，可能從蛛絲馬跡中得到新的線索。</div>';
    sheetFn(`<div class="v145c-intel-sheet"><div class="v145c-kicker">EXPLORATION INTELLIGENCE</div><h3>傳聞錄</h3><div class="v145c-intel-summary"><b>${rows.length}</b><span>則有效情報</span><small>情報只提供線索，不保證靈物仍在原處。</small></div><div class="v145c-intel-list">${html}</div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">收起傳聞錄</button></div>`);
  }
  async function dismiss(id){await updateStatus(id,'dismissed');openIntelBook()}
  function viewMap(id){state.focusId=String(id);closeSheet();setTimeout(()=>{const fn=get('openWorldMap');if(typeof fn==='function')fn()},80)}

  function coordFromCell(el){return el?.dataset?.coord||((el?.getAttribute('aria-label')||el?.textContent||'').match(/[A-J]-(?:10|[1-9])/)||[])[0]||''}
  function markMapIntel(){
    document.querySelectorAll('.v145c-intel-marker').forEach(x=>x.remove());
    const rows=activeRows();if(!rows.length)return;
    document.querySelectorAll('.v14f-cell,button.cell,[data-coord]').forEach(el=>{
      const coord=coordFromCell(el);if(!coord)return;
      const matched=rows.filter(r=>r.target_coord&&coordDistance(coord,r.target_coord)<=Math.max(0,Number(r.accuracy_radius)||0));
      if(!matched.length)return;
      const mark=document.createElement('span');mark.className='v145c-intel-marker'+(matched.some(r=>String(r.id)===state.focusId)?' focus':'');mark.textContent=matched.some(r=>r.intel_type==='treasure')?'靈':'聞';mark.title=matched.map(r=>r.title).join('、');el.appendChild(mark);
    });
  }
  function wrapMap(){
    if(state.mapWrapped)return;const old=get('openWorldMap');if(typeof old!=='function')return;
    setGlobal('openWorldMap',function(){const out=old.apply(this,arguments);setTimeout(markMapIntel,30);return out});state.mapWrapped=true;
  }
  function arrivalCheck(){
    const here=currentCoord();if(!here)return;
    activeRows().filter(r=>r.status==='active'&&r.target_coord&&coordDistance(here,r.target_coord)<=Math.max(0,Number(r.accuracy_radius)||0)).forEach(r=>{
      updateStatus(r.id,'arrived');logMsg(`【情報抵達】你已抵達「${esc(r.title)}」指向的區域，可繼續探索查證。`,'lg');toastMsg('已抵達情報指向區域');
    });
  }
  function wrapMove(){
    if(state.moveWrapped)return;const old=get('moveTo');if(typeof old!=='function')return;
    setGlobal('moveTo',function(){const before=currentCoord(),out=old.apply(this,arguments);setTimeout(()=>{if(currentCoord()!==before)arrivalCheck()},120);return out});state.moveWrapped=true;
  }

  function injectMoreMenu(){
    document.querySelectorAll('.v145a-more-grid').forEach(grid=>{
      if(grid.querySelector('[data-v145c-intel]'))return;
      const b=document.createElement('button');b.type='button';b.className='v145a-more-item';b.dataset.v145cIntel='1';b.innerHTML='<span>聞</span><b>探索情報</b><small>天地靈物、修士與事件線索</small>';
      b.addEventListener('click',()=>{closeSheet();setTimeout(openIntelBook,80)});grid.appendChild(b);
    });
  }
  function boot(){
    wrapExplore();installFixedTreasureBridge();wrapMap();wrapMove();loadRows();injectMoreMenu();arrivalCheck();
  }

  window.openExplorationIntelV145C=openIntelBook;
  window.V145CIntel={version:VERSION+'-LOGIN-SAFE',open:openIntelBook,dismiss,viewMap,refresh:()=>loadRows(true),active:activeRows};
  /*
   * LOGIN HOTFIX3:
   * 禁止監看整個 document.body。原 MutationObserver 會與 V14.5A HUD
   * 互相觸發 childList，登入頁載入時形成主執行緒循環。
   * 改成低頻、有限工作量的安全補掛。
   */
  const timer=setInterval(()=>{try{
    wrapExplore();installFixedTreasureBridge();wrapMap();wrapMove();
    injectMoreMenu();
  }catch(err){console.warn('[V14.5C]',err)}},5000);
  window.addEventListener('beforeunload',()=>clearInterval(timer));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
