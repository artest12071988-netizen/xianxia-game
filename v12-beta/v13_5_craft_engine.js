'use strict';
(() => {
  const VERSION='V14.5B-FIX1-CRAFT-ENGINE-1';
  let activeTab='alchemy';
  let uiTimer=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const get=name=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
  const G=()=>get('g');
  const CFG=()=>get('C')||{};
  const PARAMS=()=>get('P')||{};
  const ITEMS=()=>get('IT')||{};
  const call=(name,...args)=>{const fn=get(name)||window[name];return typeof fn==='function'?fn(...args):undefined};

  function ensureState(){
    const g=G();if(!g)return null;
    g.craftingStats=g.craftingStats||{attempts:0,successes:0,failures:0,byRecipe:{}};
    g.masterCraftsman=g.masterCraftsman||{available:false,rejections:0,encounters:0,lastEncounterAt:0,lastSuccessAt:0};
    g.masterCraftsman.available=!!g.masterCraftsman.available;
    g.masterCraftsman.rejections=Math.max(0,Math.floor(num(g.masterCraftsman.rejections,0)));
    g.masterCraftsman.encounters=Math.max(0,Math.floor(num(g.masterCraftsman.encounters,0)));
    return g.masterCraftsman;
  }
  function params(){return PARAMS()}
  function recipes(){return Array.isArray(CFG().craftingRecipes)?CFG().craftingRecipes.filter(x=>x&&x.enabled!==false):[]}
  function recipe(id){return recipes().find(x=>String(x.id)===String(id))||null}
  function itemName(id){return ITEMS()?.[String(id)]?.name||String(id)}
  function itemCount(id){return num(G()?.inv?.[String(id)],0)}
  function ownsBlueprint(id){return !id||itemCount(id)>0}
  function defaultRate(cat){const p=params();if(cat==='alchemy')return num(p.craft_alchemy_default_success_rate,.75);if(cat==='equipment')return num(p.craft_equipment_default_success_rate,1);return num(p.craft_legendary_default_success_rate,.35)}
  function rateOf(r){return clamp(num(r?.successRate,defaultRate(r?.category)),0,1)}
  function consumes(){return params().craft_consume_materials!==false}
  function positiveInt(v){return Number.isInteger(Number(v))&&Number(v)>0}
  function validateRecipe(r){
    const items=ITEMS();
    if(!r||typeof r!=='object')return {ok:false,msg:'配方不存在'};
    if(!['alchemy','equipment','legendary'].includes(r.category))return {ok:false,msg:'配方分類錯誤'};
    if(!r.id||typeof r.id!=='string')return {ok:false,msg:'配方 ID 錯誤'};
    if(!Number.isFinite(Number(r.stamina))||Number(r.stamina)<0)return {ok:false,msg:'精力設定錯誤'};
    if(r.successRate!==undefined&&(!Number.isFinite(Number(r.successRate))||Number(r.successRate)<0||Number(r.successRate)>1))return {ok:false,msg:'成功率設定錯誤'};
    if(r.blueprint&&!items?.[String(r.blueprint)])return {ok:false,msg:'圖譜設定不存在'};
    if(!r.materials||typeof r.materials!=='object'||Array.isArray(r.materials)||!Object.keys(r.materials).length)return {ok:false,msg:'材料設定錯誤'};
    for(const [mid,q] of Object.entries(r.materials)){if(!items?.[String(mid)]||!positiveInt(q))return {ok:false,msg:'材料設定錯誤'}}
    const outId=String(r.output?.itemId||'');
    if(!outId||!items?.[outId]||!positiveInt(r.output?.qty??1))return {ok:false,msg:'產物設定不存在'};
    const isEquipment=get('isEquipmentId'),newEquipment=get('newEquipment');
    if(typeof isEquipment==='function'&&isEquipment(outId)&&typeof newEquipment!=='function')return {ok:false,msg:'裝備生成函式不存在'};
    return {ok:true,msg:''};
  }
  function materialsEnough(r){return Object.entries(r.materials||{}).every(([id,q])=>itemCount(id)>=num(q))}
  function canCraft(r){
    const g=G();ensureState();if(!g)return {ok:false,msg:'角色資料尚未載入'};
    const valid=validateRecipe(r);if(!valid.ok)return valid;
    if(r.category==='legendary'&&!g.masterCraftsman.available)return {ok:false,msg:'絕世神匠目前不願出手'};
    if(!ownsBlueprint(r.blueprint))return {ok:false,msg:'缺少'+itemName(r.blueprint)};
    if(!materialsEnough(r))return {ok:false,msg:'材料不足'};
    if(num(g.mp)<num(r.stamina))return {ok:false,msg:'精力不足'};
    return {ok:true,msg:''};
  }
  function consume(r){const g=G();if(!g||!consumes())return;for(const [id,q] of Object.entries(r.materials||{}))g.inv[String(id)]=Math.max(0,itemCount(id)-num(q))}
  function grant(r){
    const g=G(),items=ITEMS(),id=String(r.output?.itemId||''),qty=Math.max(1,Math.floor(num(r.output?.qty,1)));
    const valid=validateRecipe(r);if(!g||!valid.ok)throw new Error(valid.msg||'角色資料不存在');
    const isEquipment=get('isEquipmentId'),newEquipment=get('newEquipment');
    for(let i=0;i<qty;i++){
      if(typeof isEquipment==='function'&&isEquipment(id)){g.equipment=Array.isArray(g.equipment)?g.equipment:[];g.equipment.push(newEquipment(id))}
      else{g.inv=g.inv||{};g.inv[id]=(g.inv[id]||0)+1}
    }
    return items[id];
  }
  function record(r,success){
    const g=G(),s=g.craftingStats;s.attempts++;s[success?'successes':'failures']++;
    s.byRecipe[r.id]=s.byRecipe[r.id]||{attempts:0,successes:0,failures:0};s.byRecipe[r.id].attempts++;s.byRecipe[r.id][success?'successes':'failures']++;
    window.dispatchEvent(new CustomEvent('xianxia:craft-result',{detail:{version:VERSION,recipeId:r.id,category:r.category,success}}));
  }
  function snapshotState(){const g=G();return {mp:g.mp,inv:JSON.parse(JSON.stringify(g.inv||{})),equipment:JSON.parse(JSON.stringify(Array.isArray(g.equipment)?g.equipment:[])),craftingStats:JSON.parse(JSON.stringify(g.craftingStats||{})),masterCraftsman:JSON.parse(JSON.stringify(g.masterCraftsman||{}))}}
  function restoreState(s){const g=G();g.mp=s.mp;g.inv=s.inv;g.equipment=s.equipment;g.craftingStats=s.craftingStats;g.masterCraftsman=s.masterCraftsman}
  function craft(id){
    const g=G(),r=recipe(id),check=canCraft(r);if(!check.ok){call('toast',check.msg);return false}
    const before=snapshotState();
    try{
      call('stopMeditate','進行煉製');g.mp-=num(r.stamina);consume(r);const success=Math.random()<rateOf(r);if(success)grant(r);record(r,success);
      if(success){
        if(r.category==='legendary'){g.masterCraftsman.available=false;g.masterCraftsman.rejections=0;g.masterCraftsman.lastSuccessAt=Date.now();call('log','絕世神匠鍛成 <b>'+itemName(r.output.itemId)+'</b>，隨即飄然離去。','lg')}
        else call('log','成功製成 <b>'+itemName(r.output.itemId)+'</b>。','lg');
      }else if(r.category==='legendary')call('log','本次鍛造失敗；絕世神匠仍願留步，可備妥材料再次嘗試。','la');
      else call('log',r.name+' 煉製失敗。','la');
      call('saveGame',false);call('render');openCrafting(r.category);return success;
    }catch(e){restoreState(before);console.error('[V14.5B Craft] rollback',e);call('toast','煉製未完成，材料與精力已還原：'+(e?.message||'未知錯誤'));call('render');openCrafting(r?.category||activeTab);return false}
  }
  function materialsHtml(r){const rows=[];if(r.blueprint)rows.push('<span>圖譜：'+esc(itemName(r.blueprint))+' '+(ownsBlueprint(r.blueprint)?'✓':'×')+'</span>');for(const [id,q] of Object.entries(r.materials||{}))rows.push('<span>'+esc(itemName(id))+' '+itemCount(id)+'/'+q+'</span>');return rows.join(' · ')}
  function stateLabel(){
    const g=G();ensureState();if(!g)return ['locked','尚未載入','角色資料尚未載入。'];
    if(g.masterCraftsman.available)return ['waiting','願意鍛造','絕世神匠已答應出手；鍛造失敗後仍可重試，成功後才會離去。'];
    if(g.masterCraftsman.lastSuccessAt>0)return ['departed','鍛成後已離去','再次探索冰火島，仍有機會重新遇見他。'];
    if(g.masterCraftsman.encounters>0)return ['locked','等待再次相遇','神匠曾拒絕出手；再次探索冰火島時，意願會逐次提高。'];
    return ['locked','行蹤未定','絕世神匠確實隱居冰火島；在島上探索才有機會尋到他。'];
  }
  function openCrafting(tab='alchemy'){
    activeTab=tab;ensureState();const labels={alchemy:'煉丹',equipment:'煉器',legendary:'絕世神匠'};
    let h='<div class="v145b-craft-head"><div><small>MYRIAD CRAFTING</small><h3>萬法煉造</h3></div><button class="btn" onclick="openRecipeCodexV145B()">萬法譜</button></div><div class="tabs">'+Object.keys(labels).map(k=>'<button class="'+(activeTab===k?'on':'')+'" onclick="openCrafting(\''+k+'\')">'+labels[k]+'</button>').join('')+'</div>';
    if(activeTab==='legendary'){const [cls,title,desc]=stateLabel();h+='<div class="notice" data-state="'+cls+'"><b>'+title+'</b><br>'+desc+'</div>'}
    const list=recipes().filter(x=>x.category===activeTab);
    if(!list.length)h+='<p class="small">目前沒有啟用中的配方。</p>';
    for(const r of list){const c=canCraft(r),out=itemName(r.output?.itemId);h+='<div class="list-row"><div class="grow"><strong>'+esc(r.name)+'</strong><small>產物：'+esc(out)+' ×'+Math.max(1,num(r.output?.qty,1))+'｜精力 '+num(r.stamina)+'｜成功率 '+Math.round(rateOf(r)*100)+'%</small><small>'+materialsHtml(r)+'</small></div><button class="btn '+(c.ok?'gold':'')+'" '+(c.ok?'':'disabled')+' onclick="V135_CRAFT_ENGINE.craft(\''+esc(r.id)+'\')">'+(c.ok?'煉製':esc(c.msg))+'</button></div>'}
    h+='<div class="small">材料消耗：'+(consumes()?'開啟':'關閉（封測模式）')+'</div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">離開</button>';call('sheet',h);
  }
  function currentMapInfo(){
    const g=G();if(!g?.pos)return null;
    const fixed=window.V144_FIXED_MAP?.infoFor?.(g.pos.r,g.pos.c);if(fixed)return fixed;
    try{const zone=get('zoneAt')?.(g.pos.r,g.pos.c);return zone?{label:zone.name,type:zone.name==='冰火島'?'icefire':''}:null}catch(_){return null}
  }
  function isIcefireIsland(){const x=currentMapInfo();return !!x&&(x.type==='icefire'||x.label==='冰火島')}
  function tryMasterEncounter(){
    const g=G(),s=ensureState();if(!g||!s||s.available||!isIcefireIsland())return false;
    if(Math.random()>=clamp(num(params().master_craftsman_encounter_rate,.10),0,1))return false;
    s.encounters++;s.lastEncounterAt=Date.now();
    const willingness=clamp(num(params().master_craftsman_initial_willingness_rate,.02)+s.rejections*num(params().master_craftsman_rejection_increment,.01),0,num(params().master_craftsman_max_willingness_rate,1));
    if(Math.random()<willingness){
      s.available=true;call('log','你在冰火島尋到絕世神匠，他終於願意替你鍛造神兵。','lg');
      call('sheet','<h3>絕世神匠 · 願意出手</h3><p>烈焰與寒潮交界處，那位沉默的神匠審視你的材料，終於點頭。</p><div class="notice">鍛造失敗後仍可重試；只有成功鍛成絕世裝備，他才會離去。</div><button class="btn gold" style="width:100%;margin-top:12px" onclick="openCrafting(\'legendary\')">前往鍛造</button>');
    }else{
      s.rejections++;call('log','你找到了絕世神匠，但他拒絕出手；下次相遇時意願會略微提高。','la');
      call('sheet','<h3>絕世神匠 · 拒絕</h3><p>他只看了一眼便閉目不語。本次意願率為 <b>'+Math.round(willingness*10000)/100+'%</b>。</p><p class="small">累計拒絕 '+s.rejections+' 次；下次相遇意願將依後台設定提高。</p><button class="btn" style="width:100%" onclick="closeOv()">離開</button>');
    }
    call('saveGame',false);call('render');updateNpcPresence();return true;
  }
  function installEncounterHook(){
    const world=window.V135_WORLD_EXPANSION;if(!world||typeof world.beforeExplore!=='function')return false;
    if(world.beforeExplore.__v145bMasterHook)return true;
    const base=world.beforeExplore.bind(world);
    const wrapped=function(){if(tryMasterEncounter())return true;return base()};
    wrapped.__v145bMasterHook=true;wrapped.__v145bBase=base;world.beforeExplore=wrapped;return true;
  }
  function openNpc(){
    if(!isIcefireIsland())return call('toast','絕世神匠只在冰火島出沒');
    const g=G();ensureState();const [cls,title,desc]=stateLabel();
    const action=g?.masterCraftsman?.available?'<button class="btn gold" style="width:100%;margin-top:12px" onclick="openCrafting(\'legendary\')">請神匠鍛造</button>':'<button class="btn jade" style="width:100%;margin-top:12px" onclick="closeOv()">繼續探索尋訪</button>';
    call('sheet','<div class="v145b-npc-sheet" data-state="'+cls+'"><small>ICEFIRE ISLAND NPC</small><h3>絕世神匠</h3><p>'+desc+'</p><div class="notice">相遇率、初始意願與拒絕累積皆由後台煉造控制台設定。</div>'+action+'<button class="btn" style="width:100%;margin-top:8px" onclick="closeOv()">離開</button></div>');
  }
  function updateNpcPresence(){
    const scene=document.querySelector('#game .world-scene');if(!scene)return;
    let b=scene.querySelector('#v145bMasterNpc');
    if(!isIcefireIsland()){b?.remove();return}
    const g=G();ensureState();if(!b){b=document.createElement('button');b.type='button';b.id='v145bMasterNpc';b.className='v145b-master-npc';b.addEventListener('click',openNpc);scene.appendChild(b)}
    const status=g?.masterCraftsman?.available?'願意鍛造':g?.masterCraftsman?.encounters>0?'行蹤可循':'島上隱居';
    b.dataset.ready=g?.masterCraftsman?.available?'1':'0';b.innerHTML='<span>匠</span><b>絕世神匠</b><small>'+status+'</small>';
  }
  function injectButton(){
    const grid=document.querySelector('.action-grid');if(!grid||document.getElementById('craftActionBtn'))return;
    const b=document.createElement('button');b.id='craftActionBtn';b.className='btn action-tile';b.addEventListener('click',()=>openCrafting('alchemy'));b.innerHTML='<span class="rune">煉</span><span><strong>萬法煉造</strong><small>煉丹、煉器與絕世鍛造</small></span>';grid.appendChild(b);
  }
  function startUiLoop(){clearInterval(uiTimer);uiTimer=setInterval(()=>{installEncounterHook();injectButton();updateNpcPresence()},1200)}

  window.V135_CRAFT_ENGINE={version:VERSION,recipes,validateRecipe,canCraft,craft,openCrafting,tryMasterEncounter,installEncounterHook,isIcefireIsland,currentMapInfo,getState:ensureState,updateNpcPresence};
  window.openCrafting=openCrafting;window.openMasterCraftsmanV145B=openNpc;
  const boot=()=>{ensureState();injectButton();installEncounterHook();updateNpcPresence();startUiLoop()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
