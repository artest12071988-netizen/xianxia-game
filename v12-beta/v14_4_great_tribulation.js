/* V14.4 FIX4C — 大天劫（古魔入侵）實效系統
 * 沿用 world_controls.great_tribulation_active，不建立第二套事件開關。
 * 依專案既有資料：古魔類別、spawn=魔界降臨2%，在非安全區每次遭遇判定前有 2% 機率投放古魔。
 */
(function(){
  'use strict';
  if(window.__V144GreatTribulationLoaded)return;
  window.__V144GreatTribulationLoaded=true;

  const state={wrapped:false,lastAnnounced:null};
  const get=(name)=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
  const setGlobal=(name,value)=>{try{Function('v',name+'=v')(value);return true}catch(_){try{window[name]=value;return true}catch(__){return false}}};
  const controls=()=>{const cs=window.cloudState||get('cloudState')||{};return cs.worldControls||{}};
  const active=()=>!!controls().great_tribulation_active;
  const clone=(x)=>JSON.parse(JSON.stringify(x));
  const random=(arr)=>arr&&arr.length?arr[Math.floor(Math.random()*arr.length)]:null;
  const notify=(text,type)=>{const log=get('log');if(typeof log==='function')try{log(text,type||'ld')}catch(_){};const toast=get('toast');if(typeof toast==='function')try{toast(text)}catch(_){} };

  function ensureBadge(){
    let badge=document.getElementById('greatTribulationEffectBadge');
    if(badge)return badge;
    badge=document.createElement('div');
    badge.id='greatTribulationEffectBadge';
    badge.innerHTML='<span class="tribulation-icon">魔</span><b>大天劫・古魔入侵</b><span>非安全區遭遇古魔機率 2%</span>';
    const beast=document.getElementById('beastTideEffectBadge');
    const cloud=document.getElementById('blackCloudEffectBadge');
    const anchor=beast||cloud||document.querySelector('.status-ribbon');
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(badge,anchor.nextSibling);else document.body.prepend(badge);
    return badge;
  }

  function updateVisualState(){
    ensureBadge();
    const on=active();
    document.body.classList.toggle('great-tribulation-active',on);
    if(state.lastAnnounced!==on){
      if(state.lastAnnounced!==null){
        notify(on?'魔界裂隙洞開，古魔臨世！':'仙威降臨，魔界裂隙已暫時封閉。',on?'ld':'lg');
      }
      state.lastAnnounced=on;
    }
  }

  function ancientDemonPool(){
    const C=get('C');
    return Array.isArray(C?.monsters)?C.monsters.filter(m=>m&&m.cat==='古魔'&&String(m.spawn||'').includes('魔界降臨')):[];
  }

  function selectAncientDemon(){
    const g=get('g');
    const pool=ancientDemonPool();
    if(!pool.length)return null;
    // 古魔固定 Lv12–14。優先選擇與玩家境界較接近者，但不改動原始怪物數值。
    const sorted=pool.slice().sort((a,b)=>Math.abs(Number(a.lv)-Number(g?.lv||1))-Math.abs(Number(b.lv)-Number(g?.lv||1)));
    const candidates=sorted.slice(0,Math.min(2,sorted.length));
    const demon=clone(random(candidates)||random(pool));
    if(demon){
      demon.__greatTribulation=true;
      // 黑雲既有模組只提供區域判定；此處只標記受壓制，不自行杜撰未定案數值。
      const bc=window.V14BlackCloud;
      const coord=(g&&g.pos)?String.fromCharCode(65+Number(g.pos.r))+'-'+(Number(g.pos.c)+1):'';
      if(bc&&typeof bc.isCloudCoord==='function'&&bc.isCloudCoord(coord))demon.__blackCloudSuppressed=true;
    }
    return demon;
  }

  function wrapEncounter(){
    if(state.wrapped)return;
    const oldRoll=get('rollEncounter');
    const startFightMonster=get('startFightMonster');
    const zoneAt=get('zoneAt');
    if(typeof oldRoll!=='function'||typeof startFightMonster!=='function'||typeof zoneAt!=='function')return;

    setGlobal('rollEncounter',function(source){
      if(!active())return oldRoll.apply(this,arguments);
      const g=get('g');
      if(!g||!g.pos)return oldRoll.apply(this,arguments);
      const z=zoneAt(g.pos.r,g.pos.c);
      const safe=!!(z&&String(z.type||'').includes('安全區'));
      if(!safe&&Math.random()<0.02){
        const demon=selectAncientDemon();
        if(demon){
          notify('魔界裂隙撕開——'+demon.name+' 降臨！','ld');
          return startFightMonster(demon);
        }
      }
      return oldRoll.apply(this,arguments);
    });
    state.wrapped=true;
  }

  function markFight(){
    const fight=get('fight');
    document.body.classList.toggle('fighting-ancient-demon',!!(fight&&fight.kind==='monster'&&fight.enemy&&fight.enemy.__greatTribulation));
  }

  window.V14GreatTribulation={
    isActive:active,
    getAncientDemonIds:()=>ancientDemonPool().map(m=>m.id),
    selectAncientDemon
  };

  function boot(){wrapEncounter();updateVisualState();markFight()}
  const timer=setInterval(()=>{try{boot()}catch(e){console.warn('[V14 great tribulation]',e)}},1000);
  window.addEventListener('beforeunload',()=>clearInterval(timer));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
