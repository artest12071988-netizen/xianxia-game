(function(){
'use strict';
if(window.__AdminGreatTribulationStage1Loaded)return;
window.__AdminGreatTribulationStage1Loaded=true;

const byId=id=>document.getElementById(id);
const fmt=value=>value?new Date(value).toLocaleString('zh-TW'):'—';
let refreshTimer=null;
let loading=false;

function notify(message){
  if(typeof window.toast==='function')window.toast(message);
  else alert(message);
}
function logAction(message){
  if(typeof window.addLog==='function')window.addLog(message);
}
function getClient(){
  return window.sb||null;
}
function ensurePanel(){
  let panel=byId('tribCyclePanel');
  if(panel)return panel;

  const status=byId('tribStatus');
  const card=status?.closest('.card');
  if(!card)return null;

  panel=document.createElement('div');
  panel.id='tribCyclePanel';
  panel.className='notice';
  panel.style.marginTop='12px';
  panel.innerHTML=`
    <b>大天劫・古魔入侵控制</b>
    <div id="tribCycleReadout" style="margin-top:6px;line-height:1.7">讀取中…</div>
    <div class="row" style="margin-top:10px">
      <button class="btn red" id="tribStartNormal" type="button">啟動四小時古魔入侵</button>
      <button class="btn gold" id="tribStartForce" type="button">忽略冷卻・強制啟動</button>
    </div>
    <div class="row" style="margin-top:8px">
      <button class="btn" id="tribEndCooldown" type="button">立即結束並進入48小時冷卻</button>
      <button class="btn" id="tribEndNoCooldown" type="button">立即結束且清除冷卻</button>
    </div>`;

  card.appendChild(panel);
  byId('tribStartNormal').addEventListener('click',()=>start(false));
  byId('tribStartForce').addEventListener('click',()=>start(true));
  byId('tribEndCooldown').addEventListener('click',()=>end(true));
  byId('tribEndNoCooldown').addEventListener('click',()=>end(false));
  return panel;
}

function setButtonsDisabled(disabled){
  ['tribStartNormal','tribStartForce','tribEndCooldown','tribEndNoCooldown']
    .forEach(id=>{const el=byId(id);if(el)el.disabled=disabled;});
}
function render(row){
  ensurePanel();
  if(!row)return;
  const readout=byId('tribCycleReadout');
  if(readout){
    readout.innerHTML=
      '狀態：<b>'+(row.great_tribulation_active?'古魔入侵中':'未降臨')+'</b><br>'+
      '開始：'+fmt(row.great_tribulation_started_at)+'<br>'+
      '預定結束：'+fmt(row.great_tribulation_ends_at)+'<br>'+
      '冷卻至：'+fmt(row.great_tribulation_cooldown_until)+'<br>'+
      '下次自動判定：'+fmt(row.great_tribulation_next_auto_check_at);
  }
  const status=byId('tribStatus');
  if(status)status.textContent=row.great_tribulation_active?'古魔入侵中':'未降臨';
  const pill=byId('tribPill');
  if(pill){
    pill.textContent=row.great_tribulation_active?'開啟':'關閉';
    pill.classList.toggle('on',!!row.great_tribulation_active);
  }
}
async function refresh(){
  if(loading)return;
  const client=getClient();
  if(!client||!window.sessionUser)return;
  loading=true;
  try{
    const {data,error}=await client.rpc('admin_great_tribulation_status');
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    if(row){
      window.controls=row;
      render(row);
    }
  }catch(error){
    console.warn('[Tribulation admin refresh]',error);
  }finally{
    loading=false;
  }
}
async function invoke(name,args,success){
  const client=getClient();
  if(!client)return notify('後台尚未完成登入');
  setButtonsDisabled(true);
  try{
    const {data,error}=await client.rpc(name,args);
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    if(row){
      window.controls=row;
      render(row);
      if(typeof window.renderControls==='function')window.renderControls();
    }
    logAction(success);
    notify(success);
  }catch(error){
    notify('操作失敗：'+(error?.message||error));
  }finally{
    setButtonsDisabled(false);
  }
}
function start(force){
  return invoke(
    'admin_great_tribulation_start',
    {p_force:!!force},
    force?'已忽略冷卻並強制啟動古魔入侵':'大天劫古魔入侵已啟動'
  );
}
function end(applyCooldown){
  return invoke(
    'admin_great_tribulation_end',
    {p_apply_cooldown:!!applyCooldown},
    applyCooldown?'古魔入侵已結束並進入48小時冷卻':'古魔入侵已結束，冷卻已清除'
  );
}

window.adminStartGreatTribulation=start;
window.adminEndGreatTribulation=end;
window.adminRefreshGreatTribulation=refresh;

const oldRender=window.renderControls;
window.renderControls=function(){
  if(typeof oldRender==='function')oldRender.apply(this,arguments);
  render(window.controls);
};

function boot(){
  ensurePanel();
  refresh();
  clearInterval(refreshTimer);
  refreshTimer=setInterval(()=>{
    const main=byId('adminMain');
    if(main&&!main.classList.contains('hidden'))refresh();
  },15000);
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700),{once:true});
}else{
  setTimeout(boot,700);
}
})();