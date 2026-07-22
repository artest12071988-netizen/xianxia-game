(()=>{
'use strict';
const BUILD='V15.2-PHASE1-IMMERSIVE-RAID';
const ART={
 qinglong:'assets/divine_beasts/qinglong.webp',
 baihu:'assets/divine_beasts/baihu.webp',
 fenghuang:'assets/divine_beasts/fenghuang.webp',
 xuanwu:'assets/divine_beasts/xuanwu.webp',
 qilin:'assets/divine_beasts/qilin.webp'
};
const DIR={east:'東方',west:'西方',north:'北方',south:'南方',center:'中央'};
const S={
 prompt:null,root:null,token:null,beast:null,active:false,poll:null,countdown:null,
 snapshot:null,tab:'feed',line:'',handlers:null,seen:new Set(),busy:false
};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
const fmt=v=>Math.round(num(v)).toLocaleString('zh-TW');
const pct=(v,max)=>Math.max(0,Math.min(100,num(v)/Math.max(1,num(max))*100));
function cloud(){try{if(typeof cloudState!=='undefined'&&cloudState)return cloudState}catch(_){}return window.XIANXIA_CLOUD_STATE||window.cloudState||null}
function client(){return cloud()?.client||null}
async function rpc(name,args={}){
 const c=client();if(!c)throw new Error('尚未連線伺服器');
 const {data,error}=await c.rpc(name,args);if(error)throw error;return data
}
function art(beast){return ART[String(beast?.beast_key||'')]||ART.baihu}
function removePrompt(){S.prompt?.remove();S.prompt=null}
function removeRoot(){S.root?.remove();S.root=null;document.body.style.overflow=''}
function secondsLeft(iso){
 if(!iso)return 0;return Math.max(0,Math.floor((new Date(iso).getTime()-Date.now())/1000))
}
function timeText(sec){
 const m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}
function prompt(data,handlers={}){
 close(false);removePrompt();
 const b=data?.beast||{};
 const el=document.createElement('div');
 el.className='v152-raid-prompt';
 el.innerHTML=`<div class="v152-raid-prompt-card">
  <div class="v152-raid-prompt-bg" style="background-image:url('${art(b)}')"></div>
  <div class="v152-raid-prompt-body">
   <div class="v152-raid-kicker">DIVINE BEAST RAID · 神獸現世</div>
   <h2>${esc(b.beast_name||'神獸')}</h2>
   <div class="v152-raid-prompt-desc">天地異象匯聚於 <b>${esc(b.coord||'未知區域')}</b>。此神獸血量由全服修士與 AI 共同削減。加入討伐後將進入沉浸式聯合戰場；也可立即離開，不進入戰鬥。</div>
   <div class="v152-raid-prompt-stats">
    <span>${esc(DIR[b.direction]||b.direction||'未知方位')}</span>
    <span>世代 ${fmt(b.generation)}</span>
    <span>體力 ${fmt(b.current_hp)} / ${fmt(b.max_hp)}</span>
    <span>防禦 ${fmt(b.defense_power)}</span>
   </div>
   <div class="v152-raid-prompt-actions">
    <button class="v152-raid-btn join" data-act="join">加入討伐</button>
    <button class="v152-raid-btn leave" data-act="leave">快速離開</button>
   </div>
  </div>
 </div>`;
 document.body.appendChild(el);S.prompt=el;
 el.querySelector('[data-act="join"]').onclick=async()=>{
  const btn=el.querySelector('[data-act="join"]');btn.disabled=true;btn.textContent='正在進入戰場…';
  try{await handlers.join?.()}catch(e){btn.disabled=false;btn.textContent='加入討伐';alert('加入討伐失敗：'+(e?.message||e))}
 };
 el.querySelector('[data-act="leave"]').onclick=async()=>{
  const btn=el.querySelector('[data-act="leave"]');btn.disabled=true;
  try{await handlers.leave?.()}finally{removePrompt()}
 };
}
function open(ctx){
 removePrompt();removeRoot();
 S.token=ctx.token;S.beast=ctx.beast||{};S.handlers=ctx;S.active=true;S.line=ctx.line||'你已踏入聯合討伐戰場。';
 const b=S.beast,root=document.createElement('div');
 root.className='v152-raid-root';
 root.innerHTML=`<div class="v152-raid-stage-bg" style="background-image:url('${art(b)}')"></div>
 <header class="v152-raid-top">
  <div><div class="v152-raid-boss-name" data-boss-name>${esc(b.beast_name||'神獸')}</div><div class="v152-raid-sub" data-boss-sub>${esc(DIR[b.direction]||b.direction)}｜${esc(b.coord||'—')}｜世代 ${fmt(b.generation)}</div></div>
  <div class="v152-raid-boss-bars">
   <div class="v152-raid-bar-label"><span>全服共用神獸體力</span><b data-hp-text>${fmt(b.current_hp)} / ${fmt(b.max_hp)}</b></div>
   <div class="v152-raid-bar"><i data-hp-bar style="width:${pct(b.current_hp,b.max_hp)}%"></i></div>
  </div>
  <div class="v152-raid-top-actions"><button class="v152-raid-mini" data-toggle-info>戰況</button><button class="v152-raid-mini" data-refresh>同步</button></div>
 </header>
 <main class="v152-raid-main">
  <aside class="v152-raid-side left">
   <div class="v152-raid-panel-title"><span>你的戰況</span><small data-connection>同步中</small></div>
   <div class="v152-raid-player-card" data-player-card></div>
   <div class="v152-raid-panel-title" style="margin-top:14px"><span>目前參戰</span><small data-member-count>0</small></div>
   <div class="v152-raid-list" data-participant-list></div>
  </aside>
  <section class="v152-raid-center"><div class="v152-raid-center-caption" data-line>${esc(S.line)}</div></section>
  <aside class="v152-raid-side right">
   <div class="v152-raid-tabs">
    <button class="on" data-tab="feed">即時戰況</button>
    <button data-tab="rank">傷害排行</button>
    <button data-tab="members">參戰名單</button>
   </div>
   <div class="v152-raid-feed" data-panel="feed"></div>
   <div class="v152-raid-rank" data-panel="rank" hidden></div>
   <div class="v152-raid-members" data-panel="members" hidden></div>
  </aside>
 </main>
 <footer class="v152-raid-controls">
  <div><small>全服戰場同步</small><div style="color:#d7e1e8;margin-top:4px" data-sync-note>每秒更新 BOSS 血量與傷害事件</div></div>
  <div class="v152-raid-actions">
   <button class="v152-raid-action attack" data-attack>攻擊 −10精力</button>
   <button class="v152-raid-action item" data-item>道具／丹藥</button>
   <button class="v152-raid-action" data-tech>功法狀態</button>
   <button class="v152-raid-action retreat" data-retreat>遁走</button>
  </div>
  <div class="v152-raid-countdown">神獸停留時間<b data-countdown>--:--</b></div>
 </footer>`;
 document.body.appendChild(root);document.body.style.overflow='hidden';S.root=root;
 root.querySelector('[data-attack]').onclick=()=>window.V151_PHASE2?.divineAttack?.();
 root.querySelector('[data-item]').onclick=()=>window.openCombatItems?.();
 root.querySelector('[data-retreat]').onclick=()=>window.V151_PHASE2?.fleeDivine?.();
 root.querySelector('[data-tech]').onclick=showTechniques;
 root.querySelector('[data-refresh]').onclick=()=>refresh(true);
 root.querySelector('[data-toggle-info]').onclick=()=>root.classList.toggle('show-right');
 root.querySelectorAll('[data-tab]').forEach(bn=>bn.onclick=()=>setTab(bn.dataset.tab));
 renderPlayer();
 startSync();
}
function showTechniques(){
 const list=(window.g?.techniques||[]).map(id=>{
   const t=(window.C?.techniques||[]).find(x=>String(x.id)===String(id));
   return t?.name||id
 });
 alert(list.length?'目前常駐功法：\n'+list.join('\n'):'目前沒有常駐功法');
}
function setTab(tab){
 S.tab=tab;
 S.root?.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
 S.root?.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==tab);
}
function renderPlayer(){
 if(!S.root)return;
 const g=window.g||{},hp=pct(g.hp,g.hpMax),mp=pct(g.mp,g.mpMax);
 const enchant=window.XIANXIA_EQUIPMENT_VALUE?'裝備強化已啟用':'';
 S.root.querySelector('[data-player-card]').innerHTML=`<h3>${esc(g.name||'無名散修')}</h3>
  <small>${esc(g.big||'未知境界')}｜Lv${fmt(g.lv)}</small>
  <div class="v152-raid-stat"><span>體力</span><div class="meter"><i style="width:${hp}%"></i></div><b>${fmt(g.hp)}/${fmt(g.hpMax)}</b></div>
  <div class="v152-raid-stat mp"><span>精力</span><div class="meter"><i style="width:${mp}%"></i></div><b>${fmt(g.mp)}/${fmt(g.mpMax)}</b></div>
  <div class="v152-raid-enchants"><span>攻擊 ${fmt(window.pAtk?.())}</span><span>防禦 ${fmt(window.pDef?.())}</span>${enchant?`<span>${esc(enchant)}</span>`:''}</div>`;
}
function renderSnapshot(snap){
 if(!S.root||!snap)return;
 S.snapshot=snap;const b=snap.beast||S.beast;S.beast=b;
 S.root.querySelector('[data-hp-text]').textContent=`${fmt(b.current_hp)} / ${fmt(b.max_hp)}`;
 S.root.querySelector('[data-hp-bar]').style.width=`${pct(b.current_hp,b.max_hp)}%`;
 S.root.querySelector('[data-boss-sub]').textContent=`${DIR[b.direction]||b.direction}｜${b.coord||'—'}｜世代 ${fmt(b.generation)}`;
 S.root.querySelector('[data-connection]').textContent='已同步';
 renderPlayer();
 const members=[...(snap.players||[]),...(snap.ai||[])];
 S.root.querySelector('[data-member-count]').textContent=`${members.length} 位`;
 S.root.querySelector('[data-participant-list]').innerHTML=members.slice(0,30).map(m=>`<div class="v152-raid-participant"><div><b>${esc(m.name)}</b><small>${m.kind==='ai'?'世界修士 AI':'玩家修士'}｜傷害 ${fmt(m.damage)}</small></div><span class="${m.online?'v152-online':'v152-offline'}">${m.online?'參戰中':'離線'}</span></div>`).join('')||'<small>尚無其他參戰者</small>';
 S.root.querySelector('[data-panel="members"]').innerHTML=members.map(m=>`<div class="v152-raid-participant"><div><b>${esc(m.name)}</b><small>${m.kind==='ai'?'AI':'玩家'}｜體力 ${fmt(m.hp)} / ${fmt(m.hp_max)}</small></div><b>${fmt(m.damage)}</b></div>`).join('')||'<small>尚無參戰者</small>';
 S.root.querySelector('[data-panel="rank"]').innerHTML=(snap.ranking||[]).map((r,i)=>`<div class="v152-rank-row"><span class="no">${i+1}</span><div><b>${esc(r.name)}</b><small>${r.kind==='ai'?'AI 修士':'玩家修士'}｜${fmt(r.hits)} 次</small></div><strong>${fmt(r.damage)}</strong></div>`).join('')||'<small>尚無傷害紀錄</small>';
 renderEvents(snap.events||[]);
 S.handlers?.onSnapshot?.(snap);
 if(!snap.active){
   finish('神獸已離開此空間，聯合討伐結束。');
 }
}
function renderEvents(events){
 if(!S.root)return;
 const panel=S.root.querySelector('[data-panel="feed"]');
 panel.innerHTML=events.map(e=>{
   const t=new Date(e.created_at).toLocaleTimeString('zh-TW',{hour12:false});
   let text=e.message||'';
   if(!text){
     if(e.action_type==='attack')text=`${e.actor_name} 造成 ${fmt(e.damage)} 傷害`;
     else if(e.action_type==='retreat')text=`${e.actor_name} 攻擊 ${fmt(e.damage)}，承受反擊 ${fmt(e.retaliation_damage)} 後撤離`;
     else if(e.action_type==='move')text=`${e.actor_name} 趕赴神獸戰場`;
     else if(e.action_type==='reward')text=`${e.actor_name} 取得神獸遺寶`;
     else text=`${e.actor_name}｜${e.action_type}`;
   }
   return `<div class="v152-feed-row ${esc(e.actor_kind)}"><time>${t}</time><strong>${esc(text)}</strong></div>`
 }).join('')||'<small>等待第一道攻擊紀錄…</small>';
}
function setLine(line){
 S.line=line||S.line;
 const el=S.root?.querySelector('[data-line]');if(el)el.innerHTML=esc(S.line);
 renderPlayer();
}
async function refresh(force=false){
 if(!S.active||S.busy||!S.token)return;
 S.busy=true;
 try{
   const g=window.g||{};
   const snap=await rpc('divine_beast_raid_snapshot',{
     p_token:S.token,
     p_player_hp:num(g.hp),
     p_player_hp_max:num(g.hpMax),
     p_player_mp:num(g.mp),
     p_player_mp_max:num(g.mpMax)
   });
   renderSnapshot(snap);
   const note=S.root?.querySelector('[data-sync-note]');
   if(note)note.textContent=`最後同步 ${new Date().toLocaleTimeString('zh-TW',{hour12:false})}`;
 }catch(e){
   const msg=String(e?.message||e);
   const c=S.root?.querySelector('[data-connection]');if(c)c.textContent='同步中斷';
   if(!/ENCOUNTER_NOT_FOUND|BEAST_NOT_FOUND/i.test(msg))console.warn('['+BUILD+'] snapshot failed',e);
 }finally{S.busy=false}
}
function startSync(){
 stopSync();refresh(true);
 S.poll=setInterval(()=>refresh(false),1000);
 S.countdown=setInterval(()=>{
   if(!S.root)return;
   const iso=S.snapshot?.beast?.expires_at||S.beast?.expires_at;
   S.root.querySelector('[data-countdown]').textContent=timeText(secondsLeft(iso));
 },1000);
}
function stopSync(){
 if(S.poll)clearInterval(S.poll);if(S.countdown)clearInterval(S.countdown);
 S.poll=null;S.countdown=null;
}
function finish(line){
 setLine(line);stopSync();
 const attack=S.root?.querySelector('[data-attack]');if(attack)attack.disabled=true;
 setTimeout(()=>close(true),2600);
}
function close(restore=true){
 stopSync();removePrompt();removeRoot();
 S.token=null;S.beast=null;S.active=false;S.snapshot=null;S.handlers=null;S.busy=false;
 if(restore)window.render?.();
}
window.V152_RAID={
 build:BUILD,prompt,open,setLine,refresh,finish,close,
 active:()=>S.active,state:S
};
console.info('['+BUILD+'] active');
})();
