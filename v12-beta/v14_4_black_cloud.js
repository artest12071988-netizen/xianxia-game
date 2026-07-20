/* V14.4 FIX4F — 黑雲禁行與探索逃生
 * 規則：角色位於黑雲 3×3 影響範圍時禁止移動；只能探索。
 * 每次探索有 5% 機率找到出口，並隨機傳送至黑雲範圍外的有效地域。
 * 黑雲關閉或移離角色所在位置後，移動立即恢復。
 */
(function(){
  'use strict';
  if(window.__V144BlackCloudLoaded)return;
  window.__V144BlackCloudLoaded=true;

  const state={inside:false,lastCoord:'',combatWrapped:false,navigationWrapped:false,observer:null};
  const get=(name)=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
  const setGlobal=(name,value)=>{try{Function('v',name+'=v')(value);return true}catch(_){try{window[name]=value;return true}catch(__){return false}}};
  const coordParts=(coord)=>{const m=String(coord||'').match(/^([A-J])-(10|[1-9])$/);return m?[m[1].charCodeAt(0)-65,Number(m[2])-1]:null};
  const coordOfRC=(r,c)=>String.fromCharCode(65+Number(r))+'-'+(Number(c)+1);
  const currentCoord=()=>{const g=get('g');return g&&g.pos?coordOfRC(g.pos.r,g.pos.c):''};
  const controls=()=>{const cs=window.cloudState||get('cloudState')||{};return cs.worldControls||{}};
  const isCloudCoord=(coord)=>{
    const c=controls();if(!c.black_cloud_active)return false;
    const a=coordParts(coord),b=coordParts(c.black_cloud_coord);if(!a||!b)return false;
    return Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]))<=1;
  };
  const isPlayerInside=()=>{const coord=currentCoord();return !!coord&&isCloudCoord(coord)};
  window.V14BlackCloud={isInside:isPlayerInside,isCloudCoord,getCenter:()=>controls().black_cloud_coord||'',radius:1,escapeChance:.05};

  function ensureBadge(){
    let badge=document.getElementById('blackCloudEffectBadge');
    if(badge)return badge;
    badge=document.createElement('div');badge.id='blackCloudEffectBadge';
    badge.innerHTML='<span>☁</span><b>黑雲封禁</b><span>無法移動，只能探索；每次探索有 5% 機率找到出口</span>';
    const ribbon=document.querySelector('.status-ribbon');
    if(ribbon&&ribbon.parentNode)ribbon.parentNode.insertBefore(badge,ribbon.nextSibling);else document.body.prepend(badge);
    return badge;
  }
  function notify(text,type){
    const fn=get('log');if(typeof fn==='function')try{fn(text,type||'la')}catch(_){}
    const toast=get('toast');if(typeof toast==='function')try{toast(text)}catch(_){}
  }
  function stopMeditating(){
    const g=get('g');if(!g||!g.meditating)return;
    const fn=get('stopMeditate');if(typeof fn==='function')try{fn('黑雲封禁修為')}catch(_){g.meditating=false}else g.meditating=false;
  }
  function saveAndSync(){
    const save=get('saveGame');if(typeof save==='function')try{save(false)}catch(_){}
    const sync=get('syncPlayerPresence');if(typeof sync==='function')try{sync(true)}catch(_){}
  }
  function validEscapeCells(){
    const cells=[];const zoneAt=get('zoneAt');const here=currentCoord();
    for(let r=0;r<10;r++)for(let c=0;c<10;c++){
      const coord=coordOfRC(r,c);if(coord===here||isCloudCoord(coord))continue;
      let zone=null;if(typeof zoneAt==='function')try{zone=zoneAt(r,c)}catch(_){}
      const type=String(zone?.type||''),name=String(zone?.name||'');
      if(/未開放|封閉/.test(type+' '+name))continue;
      cells.push({r,c,coord,zone});
    }
    return cells;
  }
  function escapeBlackCloud(){
    const g=get('g');if(!g)return false;
    const cells=validEscapeCells();if(!cells.length){notify('黑雲之外暫無可抵達地域，空間裂隙瞬間崩散。','ld');return false}
    const target=cells[Math.floor(Math.random()*cells.length)];
    stopMeditating();g.pos={r:target.r,c:target.c};
    const close=get('closeOv');if(typeof close==='function')try{close()}catch(_){}
    const place=target.zone?.name||target.coord;
    notify('你在翻湧黑霧中發現一道空間裂隙，強行穿越後，被傳送至 <b>'+place+'</b>（'+target.coord+'）。','lg');
    const render=get('render');if(typeof render==='function')try{render()}catch(_){}
    saveAndSync();updateState();return true;
  }
  function updateState(){
    const badge=ensureBadge(),coord=currentCoord(),inside=!!coord&&isCloudCoord(coord);
    if(inside!==state.inside){
      state.inside=inside;document.body.classList.toggle('black-cloud-inside',inside);
      if(inside){stopMeditating();notify('黑雲封鎖天地，空間凝滯。目前無法離開，只能探索尋找生路。','ld')}
      else if(state.lastCoord)notify('黑雲束縛已解除，你現在可以正常移動。','lg');
      const render=get('render');if(typeof render==='function')try{render()}catch(_){}
    }
    badge.style.display=inside?'flex':'none';state.lastCoord=coord;markMapCells();lockMapButtons();
  }

  function equipmentAttack(){
    const g=get('g'),IT=get('IT');if(!g||!IT)return 1;
    let a=0,w=null;const getWeapon=get('getWeapon');if(typeof getWeapon==='function')try{w=getWeapon()}catch(_){}
    if(w){const it=IT[w.itemId]||{};a+=(Number(it.val)||0)*(1+.05*(Number(w.enhance)||0));if(w.type==='飛劍')a*=1.5}
    if((g.techniques||[]).includes('golden_dragon'))a*=1.02;
    return Math.max(1,Math.round(a));
  }
  function equipmentDefense(){
    const g=get('g'),IT=get('IT');if(!g||!IT)return 0;
    let d=0,a=null;const getArmor=get('getArmor');if(typeof getArmor==='function')try{a=getArmor()}catch(_){}
    if(a){const it=IT[a.itemId]||{};d+=(Number(it.val)||0)*(1+.05*(Number(a.enhance)||0))}
    if((g.techniques||[]).includes('golden_dragon'))d*=1.05;
    return Math.max(0,Math.round(d));
  }
  function wrapCombatFunctions(){
    if(state.combatWrapped)return;
    const oldAtk=get('pAtk'),oldDef=get('pDef'),oldTick=get('tickMeditation'),oldBreak=get('openBreak'),oldAttack=get('attackTurn'),oldAi=get('startFightAi');
    if(typeof oldAtk!=='function'||typeof oldDef!=='function'||typeof oldTick!=='function')return;
    setGlobal('pAtk',function(){return isPlayerInside()?equipmentAttack():oldAtk.apply(this,arguments)});
    setGlobal('pDef',function(){return isPlayerInside()?equipmentDefense():oldDef.apply(this,arguments)});
    setGlobal('tickMeditation',function(){if(isPlayerInside()){stopMeditating();return}return oldTick.apply(this,arguments)});
    if(typeof oldBreak==='function')setGlobal('openBreak',function(){if(isPlayerInside()){notify('黑雲封禁修為，無法進行境界突破。','ld');return}return oldBreak.apply(this,arguments)});
    if(typeof oldAttack==='function')setGlobal('attackTurn',function(){
      if(!isPlayerInside())return oldAttack.apply(this,arguments);
      const g=get('g');if(!g)return oldAttack.apply(this,arguments);
      const saved=g.techniques;g.techniques=(saved||[]).filter(x=>x==='golden_dragon');
      try{return oldAttack.apply(this,arguments)}finally{g.techniques=saved}
    });
    if(typeof oldAi==='function')setGlobal('startFightAi',function(id){
      const ai=get('ai')||[],target=ai.find(x=>String(x.id)===String(id));const result=oldAi.apply(this,arguments);
      if(target&&isCloudCoord(target.coord)){
        const fight=get('fight'),IT=get('IT');if(fight&&fight.enemy&&IT){
          const wp=(target.gear||[]).find(e=>e.cat==='法器'&&e.equipped),ar=(target.gear||[]).find(e=>e.cat==='防具'&&e.equipped);
          let atk=wp?(Number(IT[wp.itemId]?.val)||0)*(1+.05*(Number(wp.enhance)||0)):1;
          let def=ar?(Number(IT[ar.itemId]?.val)||0)*(1+.05*(Number(ar.enhance)||0)):0;
          if((target.techniques||[]).includes('golden_dragon')){atk*=1.02;def*=1.05}
          fight.enemy.atk=Math.max(1,Math.round(atk));fight.enemy.def=Math.max(0,Math.round(def));
        }
      }
      return result;
    });
    state.combatWrapped=true;
  }
  function wrapNavigationFunctions(){
    if(state.navigationWrapped)return;
    const oldMove=get('moveTo'),oldExplore=get('explore'),oldMap=get('openWorldMap');
    if(typeof oldMove!=='function'||typeof oldExplore!=='function')return;
    setGlobal('moveTo',function(){
      if(isPlayerInside()){
        notify('黑雲封鎖天地，空間凝滯。目前無法移動，只能探索尋找出口。','ld');
        lockMapButtons();return;
      }
      return oldMove.apply(this,arguments);
    });
    setGlobal('explore',function(){
      if(!isPlayerInside())return oldExplore.apply(this,arguments);
      const fight=get('fight'),g=get('g'),P=get('P');
      if(fight)return;
      const cost=Number(P?.explore_stamina_cost)||0;
      if(!g||Number(g.mp)<cost){const toast=get('toast');if(typeof toast==='function')toast('精力不足');return}
      if(Math.random()>=.05)return oldExplore.apply(this,arguments);
      stopMeditating();g.mp-=cost;
      if(!escapeBlackCloud()){
        g.mp+=cost;
        return oldExplore.apply(this,arguments);
      }
    });
    if(typeof oldMap==='function')setGlobal('openWorldMap',function(){
      const result=oldMap.apply(this,arguments);setTimeout(lockMapButtons,0);return result;
    });
    state.navigationWrapped=true;
  }
  function markMapCells(){
    document.querySelectorAll('.black-cloud-cell').forEach(x=>x.classList.remove('black-cloud-cell'));
    if(!controls().black_cloud_active)return;
    document.querySelectorAll('button.cell,[data-coord],.v14-map-cell').forEach(el=>{
      const coord=el.dataset?.coord||((el.textContent||'').match(/[A-J]-(?:10|[1-9])/)||[])[0];
      if(coord&&isCloudCoord(coord)){el.classList.add('black-cloud-cell');if(getComputedStyle(el).position==='static')el.style.position='relative'}
    });
  }
  function lockMapButtons(){
    const inside=isPlayerInside();
    document.querySelectorAll('button.cell,.v14-map-cell,[data-coord]').forEach(el=>{
      if(!inside){
        if(el.dataset.blackCloudLocked==='1'){
          el.disabled=el.dataset.blackCloudWasDisabled==='1';
          el.classList.remove('black-cloud-move-locked');
          delete el.dataset.blackCloudLocked;delete el.dataset.blackCloudWasDisabled;
        }
        return;
      }
      const coord=el.dataset?.coord||((el.textContent||'').match(/[A-J]-(?:10|[1-9])/)||[])[0];
      if(!coord||coord===currentCoord())return;
      if(el.dataset.blackCloudLocked!=='1'){
        el.dataset.blackCloudWasDisabled=el.disabled?'1':'0';el.dataset.blackCloudLocked='1';
      }
      el.disabled=true;el.classList.add('black-cloud-move-locked');el.title='黑雲封鎖：只能探索尋找出口';
    });
  }
  function boot(){
    wrapCombatFunctions();wrapNavigationFunctions();updateState();
    if(!state.observer){state.observer=new MutationObserver(()=>{markMapCells();lockMapButtons()});state.observer.observe(document.body,{childList:true,subtree:true})}
  }
  const timer=setInterval(()=>{try{boot()}catch(e){console.warn('[V14 black cloud]',e)}},1000);
  window.addEventListener('beforeunload',()=>clearInterval(timer));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
