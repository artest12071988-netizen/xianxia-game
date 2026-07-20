'use strict';
(() => {
  const VERSION='V13.5-FIX2-CRAFT-1';
  let activeTab='alchemy';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function player(){return typeof g!=='undefined'&&g?g:(window.g||null);}
  function config(){return typeof C!=='undefined'&&C?C:(window.C||null);}
  function params(){return typeof P!=='undefined'&&P?P:(window.P||{});}
  function items(){return typeof IT!=='undefined'&&IT?IT:(window.IT||{});}
  function ensureState(){
    const p=player();if(!p)return null;
    p.craftingStats=p.craftingStats||{attempts:0,successes:0,failures:0,byRecipe:{}};
    p.masterCraftsman=p.masterCraftsman||{available:false,rejections:0,encounters:0,lastEncounterAt:0,lastSuccessAt:0};
    return p.masterCraftsman;
  }
  function recipes(){const c=config();return Array.isArray(c?.craftingRecipes)?c.craftingRecipes.filter(x=>x&&x.enabled!==false):[];}
  function recipe(id){return recipes().find(x=>x.id===id)||null;}
  function itemName(id){return items()[String(id)]?.name||String(id);}
  function itemCount(id){return num(player()?.inv?.[String(id)],0);}
  function ownsBlueprint(id){return !id||itemCount(id)>0;}
  function defaultRate(cat){
    const p=params();
    if(cat==='alchemy')return num(p.craft_alchemy_default_success_rate,.75);
    if(cat==='equipment')return num(p.craft_equipment_default_success_rate,1);
    return num(p.craft_legendary_default_success_rate,.35);
  }
  function rateOf(r){return clamp(num(r.successRate,defaultRate(r.category)),0,1);}
  function consumes(){return params().craft_consume_materials!==false;}
  function positiveInt(v){return Number.isInteger(Number(v))&&Number(v)>0;}
  function validateRecipe(r){
    if(!r||typeof r!=='object')return {ok:false,msg:'配方不存在'};
    if(!['alchemy','equipment','legendary'].includes(r.category))return {ok:false,msg:'配方分類錯誤'};
    if(!r.id||typeof r.id!=='string')return {ok:false,msg:'配方 ID 錯誤'};
    if(!Number.isFinite(Number(r.stamina))||Number(r.stamina)<0)return {ok:false,msg:'精力設定錯誤'};
    if(r.successRate!==undefined&&(!Number.isFinite(Number(r.successRate))||Number(r.successRate)<0||Number(r.successRate)>1))return {ok:false,msg:'成功率設定錯誤'};
    if(r.blueprint&&!items()[String(r.blueprint)])return {ok:false,msg:'圖譜設定不存在'};
    if(!r.materials||typeof r.materials!=='object'||Array.isArray(r.materials))return {ok:false,msg:'材料設定錯誤'};
    for(const [mid,q] of Object.entries(r.materials)){
      if(!items()[String(mid)]||!positiveInt(q))return {ok:false,msg:'材料設定錯誤'};
    }
    const outId=String(r.output?.itemId||'');
    if(!outId||!items()[outId]||!positiveInt(r.output?.qty??1))return {ok:false,msg:'產物設定不存在'};
    if(typeof window.isEquipmentId==='function'&&window.isEquipmentId(outId)&&typeof window.newEquipment!=='function')return {ok:false,msg:'裝備生成函式不存在'};
    return {ok:true,msg:''};
  }
  function materialsEnough(r){return Object.entries(r.materials||{}).every(([id,q])=>itemCount(id)>=num(q));}
  function canCraft(r){
    ensureState();
    const valid=validateRecipe(r);if(!valid.ok)return valid;
    if(r.category==='legendary'&&!g.masterCraftsman.available)return {ok:false,msg:'絕世工匠目前不願出手'};
    if(!ownsBlueprint(r.blueprint))return {ok:false,msg:'缺少'+itemName(r.blueprint)};
    if(!materialsEnough(r))return {ok:false,msg:'材料不足'};
    if(num(g.mp)<num(r.stamina))return {ok:false,msg:'精力不足'};
    return {ok:true,msg:''};
  }
  function consume(r){
    if(!consumes())return;
    for(const [id,q] of Object.entries(r.materials||{}))g.inv[String(id)]=Math.max(0,itemCount(id)-num(q));
  }
  function grant(r){
    const id=String(r.output?.itemId||''); const qty=Math.max(1,Math.floor(num(r.output?.qty,1)));
    const valid=validateRecipe(r);if(!valid.ok)throw new Error(valid.msg);
    for(let i=0;i<qty;i++){
      if(typeof window.isEquipmentId==='function'&&window.isEquipmentId(id)){
        g.equipment=Array.isArray(g.equipment)?g.equipment:[];
        g.equipment.push(window.newEquipment(id));
      }else g.inv[id]=(g.inv[id]||0)+1;
    }
  }
  function record(r,success){
    const s=g.craftingStats;s.attempts++;s[success?'successes':'failures']++;
    s.byRecipe[r.id]=s.byRecipe[r.id]||{attempts:0,successes:0,failures:0};
    s.byRecipe[r.id].attempts++;s.byRecipe[r.id][success?'successes':'failures']++;
    window.dispatchEvent(new CustomEvent('xianxia:craft-result',{detail:{version:VERSION,recipeId:r.id,category:r.category,success}}));
  }
  function snapshotState(){
    return {
      mp:g.mp,
      inv:JSON.parse(JSON.stringify(g.inv||{})),
      equipment:JSON.parse(JSON.stringify(Array.isArray(g.equipment)?g.equipment:[])),
      craftingStats:JSON.parse(JSON.stringify(g.craftingStats||{})),
      masterCraftsman:JSON.parse(JSON.stringify(g.masterCraftsman||{}))
    };
  }
  function restoreState(s){
    g.mp=s.mp;g.inv=s.inv;g.equipment=s.equipment;g.craftingStats=s.craftingStats;g.masterCraftsman=s.masterCraftsman;
  }
  function craft(id){
    const r=recipe(id),check=canCraft(r);if(!check.ok){toast(check.msg);return false;}
    const before=snapshotState();
    try{
      window.stopMeditate?.('進行煉製');g.mp-=num(r.stamina);consume(r);
      const success=Math.random()<rateOf(r);
      if(success)grant(r);
      record(r,success);
      if(success){
        if(r.category==='legendary'){
          g.masterCraftsman.available=false;g.masterCraftsman.rejections=0;g.masterCraftsman.lastSuccessAt=Date.now();
          log('絕世工匠鍛成 <b>'+itemName(r.output.itemId)+'</b>，隨即飄然離去。','lg');
        }else log('成功製成 <b>'+itemName(r.output.itemId)+'</b>。','lg');
      }else{
        if(r.category==='legendary')log('本次鍛造失敗；絕世工匠仍願留步，可備妥材料再次嘗試。','la');
        else log(r.name+' 煉製失敗。','la');
      }
      if(typeof saveGame==='function')saveGame(false);if(typeof render==='function')render();openCrafting(r.category);return success;
    }catch(e){
      restoreState(before);
      console.error('[V13.5 Craft] rollback',e);
      toast('煉製未完成，材料與精力已還原：'+(e?.message||'未知錯誤'));
      if(typeof render==='function')render();openCrafting(r?.category||activeTab);return false;
    }
  }
  function materialsHtml(r){
    const rows=[];
    if(r.blueprint)rows.push('<span>'+esc(itemName(r.blueprint))+' '+(ownsBlueprint(r.blueprint)?'✓':'×')+'</span>');
    for(const [id,q] of Object.entries(r.materials||{}))rows.push('<span>'+esc(itemName(id))+' '+itemCount(id)+'/'+q+'</span>');
    return rows.join(' · ');
  }
  function stateLabel(){
    ensureState();
    if(g.masterCraftsman.available)return ['waiting','願意鍛造','絕世工匠已答應出手；失敗後仍可重試，成功後才會離去。'];
    if(g.masterCraftsman.lastSuccessAt>0)return ['departed','鍛成後已離去','須再次探索冰火島並重新取得他的意願。'];
    if(g.masterCraftsman.encounters>0)return ['locked','尚未答應','工匠曾拒絕出手；再次探索冰火島可重新相遇，意願會逐次提高。'];
    return ['locked','未遇見','前往冰火島探索，才有機會遇見絕世工匠。'];
  }
  function openCrafting(tab='alchemy'){
    activeTab=tab;if(!ensureState()){toast('角色資料尚未載入');return false;}
    const labels={alchemy:'煉丹',equipment:'煉器',legendary:'絕世工匠'};
    let h='<h3>萬法煉造</h3><div class="tabs">'+Object.keys(labels).map(k=>'<button class="'+(activeTab===k?'on':'')+'" onclick="openCrafting(\''+k+'\')">'+labels[k]+'</button>').join('')+'</div>';
    if(activeTab==='legendary'){
      const [cls,title,desc]=stateLabel();h+='<div class="notice" data-state="'+cls+'"><b>'+title+'</b><br>'+desc+'</div>';
    }
    const list=recipes().filter(x=>x.category===activeTab);
    if(!list.length)h+='<p class="small">目前沒有啟用中的配方。</p>';
    for(const r of list){
      const c=canCraft(r),out=itemName(r.output?.itemId);
      h+='<div class="list-row"><div class="grow"><strong>'+esc(r.name)+'</strong><small>產物：'+esc(out)+'｜精力 '+num(r.stamina)+'｜成功率 '+Math.round(rateOf(r)*100)+'%</small><small>'+materialsHtml(r)+'</small></div><button class="btn '+(c.ok?'gold':'')+'" '+(c.ok?'':'disabled')+' onclick="V135_CRAFT_ENGINE.craft(\''+esc(r.id)+'\')">'+(c.ok?'煉製':esc(c.msg))+'</button></div>';
    }
    h+='<div class="small">材料消耗：'+(consumes()?'開啟':'關閉（封測模式）')+'</div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">離開</button>';
    sheet(h);
  }
  function currentZoneName(){try{const p=player();return p?zoneAt(p.pos.r,p.pos.c)?.name||'':''}catch{return ''}}
  function tryMasterEncounter(){
    const s=ensureState();if(!s||s.available||currentZoneName()!=='冰火島')return false;
    if(Math.random()>=clamp(num(params().master_craftsman_encounter_rate,.10),0,1))return false;
    s.encounters++;s.lastEncounterAt=Date.now();
    const willingness=clamp(num(params().master_craftsman_initial_willingness_rate,.02)+s.rejections*num(params().master_craftsman_rejection_increment,.01),0,num(params().master_craftsman_max_willingness_rate,1));
    if(Math.random()<willingness){
      s.available=true;
      log('你在冰火島遇見絕世工匠，他終於願意替你鍛造神兵。','lg');
      sheet('<h3>絕世工匠 · 願意出手</h3><p>烈焰與寒潮交界處，那位沉默的工匠審視你的材料，點頭答應鍛造。</p><div class="notice">鍛造失敗後仍可重試；只有成功鍛成絕世裝備，他才會離去。</div><button class="btn gold" style="width:100%;margin-top:12px" onclick="openCrafting(\'legendary\')">前往鍛造</button>');
    }else{
      s.rejections++;
      log('絕世工匠拒絕了你；下次相遇時，他的意願會略微提高。','la');
      sheet('<h3>絕世工匠 · 拒絕</h3><p>他只看了一眼便閉目不語。本次意願率為 <b>'+Math.round(willingness*10000)/100+'%</b>。</p><p class="small">拒絕次數：'+s.rejections+'。意願會依後台設定逐次累積。</p><button class="btn" style="width:100%" onclick="closeOv()">離開</button>');
    }
    window.saveGame?.(false);window.render?.();return true;
  }
  function installEncounterHook(){
    const w=window.V135_WORLD_EXPANSION;if(!w||w.__craftHooked)return false;
    const base=w.beforeExplore.bind(w);w.beforeExplore=function(){if(tryMasterEncounter())return true;return base()};w.__craftHooked=true;return true;
  }
  function injectButton(){
    const grid=document.querySelector('.action-grid');if(!grid||document.getElementById('craftActionBtn'))return;
    const b=document.createElement('button');b.id='craftActionBtn';b.className='btn action-tile';b.onclick=()=>openCrafting('alchemy');
    b.innerHTML='<span class="rune">煉</span><span><strong>萬法煉造</strong><small>煉丹、煉器與絕世鍛造</small></span>';grid.appendChild(b);
  }
  window.V135_CRAFT_ENGINE={version:VERSION,recipes,validateRecipe,canCraft,craft,openCrafting,tryMasterEncounter,getState:ensureState};
  window.openCrafting=openCrafting;
  const boot=()=>{ensureState();injectButton();if(!installEncounterHook())setTimeout(installEncounterHook,300)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
