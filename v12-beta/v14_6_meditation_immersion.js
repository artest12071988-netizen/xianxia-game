(function(){
'use strict';
if(window.__V146MeditationImmersionLoaded)return;
window.__V146MeditationImmersionLoaded=true;

const VERSION='V14.6-MEDITATION-IMMERSION-1';
const state={
  active:false,
  overlay:null,
  chatList:null,
  chatForm:null,
  listAnchor:null,
  formAnchor:null,
  timer:null,
  tipIndex:0
};

const tips=[
  '打坐可持續累積修為，離線期間也會依規則結算。',
  '高靈氣區域能提升吐納效率，但危險區域仍可能發生突襲。',
  '探索可取得材料、丹藥、裝備、天地靈物與特殊情報。',
  '行囊中的裝備可以強化；強化前請先準備足夠靈石。',
  '冰火島可能遇見絕世神匠，部分高階裝備只能由神匠煉造。',
  '萬法譜會顯示目前已公開的正式配方與所需材料。',
  '黑雲籠罩時無法移動，只能探索並嘗試尋找出口。',
  '獸潮期間妖獸出現率提高，也是大量取得材料的時機。',
  '大天劫降臨後，非安全區域可能遭遇古魔。',
  '突破前請確認修為、丹藥、材料與所在地是否符合條件。',
  '擊敗其他修士後可搜刮屍身，但每件裝備都必須先確認資料完整。',
  '全服傳音可與其他修士交流情報、交易消息與世界異象。'
];

function byId(id){return document.getElementById(id)}

function injectStyle(){
  if(byId('v146MeditationStyle'))return;
  const style=document.createElement('style');
  style.id='v146MeditationStyle';
  style.textContent=`
  #v146MeditationOverlay{
    position:fixed;inset:0;z-index:90;display:none;overflow:auto;
    background:
      radial-gradient(circle at 50% 34%,rgba(30,91,104,.20),transparent 34%),
      radial-gradient(circle at 50% 75%,rgba(165,109,37,.13),transparent 40%),
      #03070b;
    color:#e7dfce;padding:18px;
  }
  #v146MeditationOverlay.active{display:block}
  .v146-med-shell{width:min(1380px,100%);margin:auto;display:grid;grid-template-columns:minmax(420px,1.35fr) minmax(330px,.65fr);gap:18px}
  .v146-med-main,.v146-med-side{border:1px solid rgba(216,187,106,.24);background:rgba(7,13,20,.88);border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.55)}
  .v146-med-main{padding:18px;min-height:calc(100vh - 36px);display:flex;flex-direction:column}
  .v146-med-head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:12px}
  .v146-med-head h2{margin:0;font:28px "Songti TC",serif;color:#e5ca79;letter-spacing:.12em}
  .v146-med-status{font-size:12px;color:#72ddd3;border:1px solid rgba(85,217,207,.35);padding:6px 10px;border-radius:999px}
  .v146-med-visual{position:relative;flex:1;min-height:560px;overflow:hidden;border-radius:15px;border:1px solid rgba(85,217,207,.24);background:#020509}
  .v146-med-visual:before{content:"";position:absolute;inset:-20%;background:conic-gradient(from 0deg,transparent,rgba(85,217,207,.10),transparent 30%,rgba(216,187,106,.09),transparent 62%);animation:v146Orbit 18s linear infinite;z-index:1}
  .v146-med-visual:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,transparent 32%,rgba(1,4,8,.58) 78%,rgba(1,4,8,.94));z-index:3;pointer-events:none}
  .v146-med-visual img{width:100%;height:100%;min-height:560px;object-fit:contain;position:relative;z-index:2;filter:saturate(1.18) brightness(.9) drop-shadow(0 0 24px rgba(85,217,207,.28));animation:v146Breath 4.2s ease-in-out infinite}
  .v146-qi-layer{position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden}
  .v146-qi-layer i{position:absolute;bottom:-20px;width:5px;height:5px;border-radius:50%;background:#8af6e8;box-shadow:0 0 13px #55d9cf;opacity:0;animation:v146QiRise 7s linear infinite}
  .v146-qi-layer i:nth-child(2n){background:#f0d889;box-shadow:0 0 13px #d8bb6a}
  .v146-qi-layer i:nth-child(1){left:14%;animation-delay:0s}.v146-qi-layer i:nth-child(2){left:26%;animation-delay:1.3s}
  .v146-qi-layer i:nth-child(3){left:38%;animation-delay:2.1s}.v146-qi-layer i:nth-child(4){left:52%;animation-delay:.6s}
  .v146-qi-layer i:nth-child(5){left:64%;animation-delay:3.4s}.v146-qi-layer i:nth-child(6){left:76%;animation-delay:1.8s}
  .v146-qi-layer i:nth-child(7){left:86%;animation-delay:4.2s}.v146-qi-layer i:nth-child(8){left:46%;animation-delay:5s}
  .v146-med-ticker{overflow:hidden;white-space:nowrap;margin:12px 0 0;border:1px solid rgba(216,187,106,.22);background:rgba(15,20,27,.82);border-radius:10px}
  .v146-med-ticker span{display:inline-block;padding:10px 0 10px 100%;color:#e9d28a;font-size:13px;animation:v146Ticker 18s linear infinite}
  .v146-med-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
  .v146-med-metrics div{padding:10px;border:1px solid rgba(255,255,255,.08);background:#07101a;border-radius:10px}
  .v146-med-metrics span{display:block;color:#7f8e9d;font-size:10px}.v146-med-metrics b{display:block;margin-top:5px;color:#f0dfb0;font-size:14px}
  .v146-med-side{padding:16px;min-height:calc(100vh - 36px);display:flex;flex-direction:column}
  .v146-med-side .panel-head{margin-bottom:9px}
  .v146-med-chat-host{flex:1;min-height:360px;display:flex;flex-direction:column}
  .v146-med-chat-host .world-chat.inline{height:auto;min-height:320px;flex:1}
  .v146-med-exit{width:100%;margin-top:12px;min-height:48px;border-color:rgba(238,102,94,.5)!important;color:#ffb2aa!important}
  body.v146-meditation-lock{overflow:hidden}
  body.v146-meditation-lock #ov{z-index:120}
  @keyframes v146Breath{0%,100%{transform:scale(1);filter:saturate(1.08) brightness(.82) drop-shadow(0 0 16px rgba(85,217,207,.20))}50%{transform:scale(1.025);filter:saturate(1.25) brightness(1) drop-shadow(0 0 34px rgba(85,217,207,.45))}}
  @keyframes v146Orbit{to{transform:rotate(360deg)}}
  @keyframes v146QiRise{0%{transform:translateY(0) scale(.5);opacity:0}15%{opacity:.85}80%{opacity:.55}100%{transform:translateY(-680px) scale(1.8);opacity:0}}
  @keyframes v146Ticker{from{transform:translateX(0)}to{transform:translateX(-100%)}}
  @media(max-width:900px){
    #v146MeditationOverlay{padding:8px}.v146-med-shell{grid-template-columns:1fr}.v146-med-main,.v146-med-side{min-height:auto}
    .v146-med-visual,.v146-med-visual img{min-height:420px}.v146-med-metrics{grid-template-columns:1fr 1fr}.v146-med-side{height:58vh}
  }
  @media(max-width:560px){
    .v146-med-head h2{font-size:21px}.v146-med-visual,.v146-med-visual img{min-height:350px}
    .v146-med-ticker span{font-size:12px}.v146-med-metrics{grid-template-columns:1fr 1fr}
  }`;
  document.head.appendChild(style);
}

function createOverlay(){
  if(state.overlay)return state.overlay;
  injectStyle();
  const el=document.createElement('div');
  el.id='v146MeditationOverlay';
  el.setAttribute('aria-hidden','true');
  el.innerHTML=`
    <div class="v146-med-shell">
      <section class="v146-med-main">
        <div class="v146-med-head">
          <h2>入定 · 周天運行</h2>
          <span class="v146-med-status">靈氣正在流入道體</span>
        </div>
        <div class="v146-med-visual">
          <img src="assets/meditation_meridians.webp?v=20260717-121" alt="打坐經脈運行圖">
          <div class="v146-qi-layer">${'<i></i>'.repeat(8)}</div>
        </div>
        <div class="v146-med-ticker"><span id="v146MeditationTip">修仙之路，靜心方能見真章。</span></div>
        <div class="v146-med-metrics">
          <div><span>道號</span><b id="v146MedName">—</b></div>
          <div><span>境界</span><b id="v146MedRealm">—</b></div>
          <div><span>打坐時間</span><b id="v146MedTime">00:00</b></div>
          <div><span>吐納效率</span><b id="v146MedRate">—</b></div>
        </div>
      </section>
      <aside class="v146-med-side">
        <div class="panel-head"><strong>全服傳音</strong><span>入定期間可交流情報</span></div>
        <div id="v146MeditationChatHost" class="v146-med-chat-host"></div>
        <button class="btn red v146-med-exit" type="button" id="v146MeditationExit">收功出定</button>
      </aside>
    </div>`;
  document.body.appendChild(el);
  state.overlay=el;
  byId('v146MeditationExit').addEventListener('click',()=>{
    try{
      if(typeof meditationButtonClick==='function')meditationButtonClick();
    }catch(err){console.warn('[V14.6 Meditation exit]',err)}
  });
  return el;
}

function moveChatIntoOverlay(){
  const host=byId('v146MeditationChatHost');
  const list=byId('worldChatInlineList');
  const form=byId('worldChatInlineForm');
  if(!host||!list||!form)return;

  if(!state.listAnchor){
    state.listAnchor=document.createComment('v146-chat-list-anchor');
    list.parentNode.insertBefore(state.listAnchor,list);
  }
  if(!state.formAnchor){
    state.formAnchor=document.createComment('v146-chat-form-anchor');
    form.parentNode.insertBefore(state.formAnchor,form);
  }
  state.chatList=list;
  state.chatForm=form;
  host.appendChild(list);
  host.appendChild(form);
}

function restoreChat(){
  if(state.chatList&&state.listAnchor?.parentNode){
    state.listAnchor.parentNode.insertBefore(state.chatList,state.listAnchor.nextSibling);
    state.listAnchor.remove();
  }
  if(state.chatForm&&state.formAnchor?.parentNode){
    state.formAnchor.parentNode.insertBefore(state.chatForm,state.formAnchor.nextSibling);
    state.formAnchor.remove();
  }
  state.listAnchor=null;
  state.formAnchor=null;
  state.chatList=null;
  state.chatForm=null;
}

function formatTime(sec){
  sec=Math.max(0,Number(sec)||0);
  const h=Math.floor(sec/3600);
  const m=Math.floor((sec%3600)/60);
  const s=Math.floor(sec%60);
  return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

function updateMetrics(){
  try{
    if(typeof g==='undefined'||!g)return;
    const zone=typeof zoneAt==='function'?zoneAt(g.pos.r,g.pos.c):null;
    const interval=zone&&zone.novice
      ?(typeof P!=='undefined'?P.meditate_novice_exp_interval_sec:2)
      :(typeof P!=='undefined'?P.meditate_exp_interval_sec:20);
    byId('v146MedName').textContent=g.name||'無名散修';
    byId('v146MedRealm').textContent=(g.big||'練氣期')+' · Lv'+(g.lv||1);
    byId('v146MedTime').textContent=formatTime(g.meditateSec);
    byId('v146MedRate').textContent=(zone?.ling||1)+'階靈氣 · '+interval+'秒/EXP';
  }catch(err){console.warn('[V14.6 Meditation metrics]',err)}
}

function rotateTip(){
  const target=byId('v146MeditationTip');
  if(!target)return;
  target.textContent=tips[state.tipIndex%tips.length];
  state.tipIndex++;
  target.style.animation='none';
  void target.offsetWidth;
  target.style.animation='v146Ticker 18s linear infinite';
}

function enter(){
  if(state.active)return;
  const overlay=createOverlay();
  state.active=true;
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden','false');
  document.body.classList.add('v146-meditation-lock');
  moveChatIntoOverlay();
  updateMetrics();
  rotateTip();
  clearInterval(state.timer);
  let seconds=0;
  state.timer=setInterval(()=>{
    updateMetrics();
    seconds++;
    if(seconds%16===0)rotateTip();
  },1000);
}

function leave(){
  if(!state.active)return;
  state.active=false;
  clearInterval(state.timer);
  state.timer=null;
  restoreChat();
  state.overlay?.classList.remove('active');
  state.overlay?.setAttribute('aria-hidden','true');
  document.body.classList.remove('v146-meditation-lock');
}

function sync(){
  try{
    if(typeof g==='undefined'||!g){leave();return}
    if(g.meditating)enter();else leave();
  }catch(err){console.warn('[V14.6 Meditation sync]',err)}
}

function wrapMeditationButton(){
  if(typeof meditationButtonClick!=='function'||meditationButtonClick.__v146Wrapped)return;
  const original=meditationButtonClick;
  const wrapped=function(){
    const result=original.apply(this,arguments);
    setTimeout(sync,0);
    return result;
  };
  wrapped.__v146Wrapped=true;
  window.meditationButtonClick=wrapped;
}

function boot(){
  createOverlay();
  wrapMeditationButton();
  sync();
  setTimeout(sync,800);
  setTimeout(sync,2200);
}

window.V146MeditationImmersion={
  version:VERSION,
  sync,
  enter,
  leave
};

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',boot,{once:true});
}else{
  boot();
}
})();