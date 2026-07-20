/* V14.4 FIX4B — 獸潮實效系統
 * 沿用 world_controls.beast_tide_active，不建立第二套開關。
 * 依專案既有怪物資料的 spawn 欄位投放獸潮妖獸；spawn=獸潮5% 的妖王固定為 5% 特殊遭遇池。
 */
(function(){
  'use strict';
  if(window.__V144BeastTideLoaded)return;
  window.__V144BeastTideLoaded=true;

  const state={active:false,wrapped:false,lastAnnounced:null};
  const get=(name)=>{try{return Function('return typeof '+name+'!=="undefined"?'+name+':null')()}catch(_){return null}};
  const setGlobal=(name,value)=>{try{Function('v',name+'=v')(value);return true}catch(_){try{window[name]=value;return true}catch(__){return false}}};
  const controls=()=>{const cs=window.cloudState||get('cloudState')||{};return cs.worldControls||{}};
  const active=()=>!!controls().beast_tide_active;
  const clone=(x)=>JSON.parse(JSON.stringify(x));
  const random=(arr)=>arr&&arr.length?arr[Math.floor(Math.random()*arr.length)]:null;
  const notify=(text,type)=>{const log=get('log');if(typeof log==='function')try{log(text,type||'la')}catch(_){};const toast=get('toast');if(typeof toast==='function')try{toast(text)}catch(_){} };

  function ensureBadge(){
    let badge=document.getElementById('beastTideEffectBadge');
    if(badge)return badge;
    badge=document.createElement('div');
    badge.id='beastTideEffectBadge';
    badge.innerHTML='<span class="beast-tide-icon">獸</span><b>獸潮來襲</b><span>妖獸遭遇率提升，獸潮妖王有 5% 機率現身</span>';
    const cloud=document.getElementById('blackCloudEffectBadge');
    const ribbon=document.querySelector('.status-ribbon');
    if(cloud&&cloud.parentNode)cloud.parentNode.insertBefore(badge,cloud.nextSibling);
    else if(ribbon&&ribbon.parentNode)ribbon.parentNode.insertBefore(badge,ribbon.nextSibling);
    else document.body.prepend(badge);
    return badge;
  }

  function updateVisualState(){
    ensureBadge();
    const on=active();
    document.body.classList.toggle('beast-tide-active',on);
    if(state.lastAnnounced!==on){
      if(state.lastAnnounced!==null){
        notify(on?'萬獸奔騰，獸潮已席捲十方浮島！':'獸吼漸息，這一輪獸潮已經退去。',on?'ld':'lg');
      }
      state.lastAnnounced=on;
    }
    state.active=on;
  }

  function monsterPools(){
    const C=get('C');
    const monsters=Array.isArray(C?.monsters)?C.monsters:[];
    const regular=monsters.filter(m=>{
      const s=String(m.spawn||'');
      return s==='獸潮'||s.includes('黑雲/獸潮');
    });
    const bosses=monsters.filter(m=>String(m.spawn||'').includes('獸潮5%'));
    return {regular,bosses};
  }

  function selectTideMonster(){
    const g=get('g');
    const {regular,bosses}=monsterPools();
    if(Math.random()<0.05&&bosses.length){
      const ordered=bosses.slice().sort((a,b)=>Math.abs(Number(a.lv)-Number(g?.lv||1))-Math.abs(Number(b.lv)-Number(g?.lv||1)));
      const nearest=ordered.slice(0,Math.min(2,ordered.length));
      const boss=random(nearest)||random(bosses);
      if(boss){notify('獸潮深處傳來王者威壓——'+boss.name+' 現身！','ld');return clone(boss)}
    }
    let pool=regular;
    if(g&&regular.length){
      const matched=regular.filter(m=>Math.abs(Number(m.lv)-Number(g.lv))<=3);
      if(matched.length)pool=matched;
    }
    return clone(random(pool)||random(regular)||random((get('C')?.monsters||[]).filter(m=>!['活動王','古魔'].includes(m.cat))));
  }

  function wrapEncounter(){
    if(state.wrapped)return;
    const oldRoll=get('rollEncounter');
    const oldPick=get('pickMonster');
    if(typeof oldRoll!=='function'||typeof oldPick!=='function')return;

    setGlobal('pickMonster',function(z){
      if(active())return selectTideMonster();
      return oldPick.apply(this,arguments);
    });

    setGlobal('rollEncounter',function(source){
      if(!active())return oldRoll.apply(this,arguments);
      const g=get('g'),zoneAt=get('zoneAt'),coordOf=get('coordOf'),rnd=get('rnd'),startAiEncounter=get('startAiEncounter'),startFightMonster=get('startFightMonster');
      const ai=get('ai')||[];
      if(!g||typeof zoneAt!=='function'||typeof startFightMonster!=='function')return oldRoll.apply(this,arguments);
      const z=zoneAt(g.pos.r,g.pos.c);
      const safe=z&&String(z.type||'').includes('安全區');
      if(safe)return;

      // 保留原本真人／AI 修士遭遇邏輯，獸潮只改變妖獸部分。
      const aiChance=z&&z.novice?.05:.22;
      if(Math.random()<aiChance&&typeof startAiEncounter==='function'){
        let cand=ai.filter(a=>a.alive&&a.coord===(typeof coordOf==='function'?coordOf(g.pos.r,g.pos.c):''));
        if(!cand.length)cand=ai.filter(a=>a.alive&&Math.abs(Number(a.lv)-Number(g.lv))<=2);
        if(cand.length)return startAiEncounter(typeof rnd==='function'?rnd(cand):random(cand));
      }

      // 原版為移動 25%、探索 42%；獸潮期間提高但不保證每次必遇，避免連續鎖死玩家。
      const monsterChance=source==='move'?.50:.70;
      if(Math.random()<monsterChance){
        const m=selectTideMonster();
        if(m)return startFightMonster(m);
      }
    });
    state.wrapped=true;
  }

  window.V14BeastTide={
    isActive:active,
    getPools:()=>{const p=monsterPools();return {regular:p.regular.map(x=>x.id),bosses:p.bosses.map(x=>x.id)}}
  };

  function boot(){wrapEncounter();updateVisualState()}
  const timer=setInterval(()=>{try{boot()}catch(e){console.warn('[V14 beast tide]',e)}},1000);
  window.addEventListener('beforeunload',()=>clearInterval(timer));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
