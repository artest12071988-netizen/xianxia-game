/* V14.4 FIX4A — 黑雲實效系統
 * 原專案規則落地：黑雲中心周圍 3×3（半徑 1）修為封禁；裝備與金龍火體訣保留。
 * 不建立第二套 world_controls；沿用 black_cloud_active / black_cloud_coord。
 */
(function(){
  'use strict';
  if(window.__V144BlackCloudLoaded)return;
  window.__V144BlackCloudLoaded=true;

  const state={inside:false,lastCoord:'',wrapped:false,observer:null};
  const get=(name)=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
  const setGlobal=(name,value)=>{try{Function('v',name+'=v')(value);return true}catch(_){try{window[name]=value;return true}catch(__){return false}}};
  const coordParts=(coord)=>{const m=String(coord||'').match(/^([A-J])-(10|[1-9])$/);return m?[m[1].charCodeAt(0)-65,Number(m[2])-1]:null};
  const currentCoord=()=>{const g=get('g');return g&&g.pos?String.fromCharCode(65+Number(g.pos.r))+'-'+(Number(g.pos.c)+1):''};
  const controls=()=>{const cs=window.cloudState||get('cloudState')||{};return cs.worldControls||{}};
  const isCloudCoord=(coord)=>{
    const c=controls();if(!c.black_cloud_active)return false;
    const a=coordParts(coord),b=coordParts(c.black_cloud_coord);if(!a||!b)return false;
    return Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]))<=1;
  };
  window.V14BlackCloud={isInside:()=>state.inside,isCloudCoord,getCenter:()=>controls().black_cloud_coord||'',radius:1};

  function ensureBadge(){
    let badge=document.getElementById('blackCloudEffectBadge');
    if(badge)return badge;
    badge=document.createElement('div');badge.id='blackCloudEffectBadge';
    badge.innerHTML='<span>☁</span><b>黑雲封禁</b><span>修為與一般功法失效；裝備、煉體功法仍可使用</span>';
    const ribbon=document.querySelector('.status-ribbon');
    if(ribbon&&ribbon.parentNode)ribbon.parentNode.insertBefore(badge,ribbon.nextSibling);else document.body.prepend(badge);
    return badge;
  }
  function notify(text,type){const fn=get('log');if(typeof fn==='function')try{fn(text,type||'la')}catch(_){};const toast=get('toast');if(typeof toast==='function')try{toast(text)}catch(_){} }
  function stopMeditating(){const g=get('g');if(!g||!g.meditating)return;const fn=get('stopMeditate');if(typeof fn==='function')try{fn('黑雲封禁修為')}catch(_){g.meditating=false}else g.meditating=false;}
  function updateState(){
    ensureBadge();const coord=currentCoord(),inside=!!coord&&isCloudCoord(coord);
    if(inside!==state.inside){
      state.inside=inside;document.body.classList.toggle('black-cloud-inside',inside);
      if(inside){stopMeditating();notify('黑雲壓境！方圓修為盡失，僅裝備與煉體之力仍可運轉。','ld')}
      else notify('你已離開黑雲範圍，修為與功法重新運轉。','lg');
      const render=get('render');if(typeof render==='function')try{render()}catch(_){}
    }
    state.lastCoord=coord;markMapCells();
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
  function wrapFunctions(){
    if(state.wrapped)return;
    const oldAtk=get('pAtk'),oldDef=get('pDef'),oldTick=get('tickMeditation'),oldBreak=get('openBreak'),oldAttack=get('attackTurn'),oldAi=get('startFightAi');
    if(typeof oldAtk!=='function'||typeof oldDef!=='function'||typeof oldTick!=='function')return;
    setGlobal('pAtk',function(){return state.inside?equipmentAttack():oldAtk.apply(this,arguments)});
    setGlobal('pDef',function(){return state.inside?equipmentDefense():oldDef.apply(this,arguments)});
    setGlobal('tickMeditation',function(){if(state.inside){stopMeditating();return}return oldTick.apply(this,arguments)});
    if(typeof oldBreak==='function')setGlobal('openBreak',function(){if(state.inside){notify('黑雲封禁修為，無法進行境界突破。','ld');return}return oldBreak.apply(this,arguments)});
    if(typeof oldAttack==='function')setGlobal('attackTurn',function(){
      if(!state.inside)return oldAttack.apply(this,arguments);
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
    state.wrapped=true;
  }
  function markMapCells(){
    document.querySelectorAll('.black-cloud-cell').forEach(x=>x.classList.remove('black-cloud-cell'));
    if(!controls().black_cloud_active)return;
    document.querySelectorAll('button.cell,[data-coord],.v14-map-cell').forEach(el=>{
      const coord=el.dataset?.coord||((el.textContent||'').match(/[A-J]-(?:10|[1-9])/)||[])[0];
      if(coord&&isCloudCoord(coord)){el.classList.add('black-cloud-cell');if(getComputedStyle(el).position==='static')el.style.position='relative'}
    });
  }
  function boot(){
    wrapFunctions();updateState();
    if(!state.observer){state.observer=new MutationObserver(()=>markMapCells());state.observer.observe(document.body,{childList:true,subtree:true})}
  }
  const timer=setInterval(()=>{try{boot()}catch(e){console.warn('[V14 black cloud]',e)}},1000);
  window.addEventListener('beforeunload',()=>clearInterval(timer));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
