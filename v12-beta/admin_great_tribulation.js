(function(){
'use strict';
if(window.__AdminGreatTribulationStage1Fix1Loaded)return;
window.__AdminGreatTribulationStage1Fix1Loaded=true;

function byId(id){return document.getElementById(id);}
function notify(message){
  if(typeof toast==='function')toast(message);
  else alert(message);
}
function logAction(message){
  if(typeof addLog==='function')addLog(message);
}
function getClient(){
  try{
    if(typeof sb!=='undefined' && sb)return sb;
  }catch(_){}
  return null;
}
async function ensureAdminSession(){
  const client=getClient();
  if(!client)throw new Error('Supabase 尚未初始化');
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  if(!data?.session?.user)throw new Error('請先登入後台');
  const {data:isAdmin,error:adminError}=await client.rpc('is_game_admin');
  if(adminError)throw adminError;
  if(!isAdmin)throw new Error('目前帳號沒有管理員權限');
  return client;
}
function updateExistingControls(row){
  if(!row)return;
  try{
    if(typeof controls!=='undefined')controls=row;
  }catch(_){}
  const active=!!row.great_tribulation_active;
  const status=byId('tribStatus');
  if(status)status.textContent=active?'正在降臨':'未降臨';
  const pill=byId('tribPill');
  if(pill){
    pill.textContent=active?'開啟':'關閉';
    pill.classList.toggle('on',active);
  }
}
async function invoke(name,args,success){
  try{
    const client=await ensureAdminSession();
    const {data,error}=await client.rpc(name,args);
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    updateExistingControls(row);
    if(typeof renderControls==='function')renderControls();
    logAction(success);
    notify(success);
    return row;
  }catch(error){
    console.warn('[Great Tribulation Admin]',error);
    notify('操作失敗：'+(error?.message||String(error)));
    return null;
  }
}
window.adminStartGreatTribulation=function(force){
  return invoke(
    'admin_great_tribulation_start',
    {p_force:!!force},
    force?'已忽略冷卻並強制啟動古魔入侵':'大天劫古魔入侵已啟動'
  );
};
window.adminEndGreatTribulation=function(applyCooldown){
  return invoke(
    'admin_great_tribulation_end',
    {p_apply_cooldown:!!applyCooldown},
    applyCooldown?'古魔入侵已結束並進入48小時冷卻':'古魔入侵已結束，冷卻已清除'
  );
};
})();