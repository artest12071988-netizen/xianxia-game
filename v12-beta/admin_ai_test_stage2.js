
(function(){
'use strict';
if(window.__AITestStage2Loaded)return;
window.__AITestStage2Loaded=true;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false;
function client(){try{return typeof sb!=='undefined'?sb:null}catch(_){return null}}
function notice(t){if(typeof toast==='function')toast(t);else alert(t)}
async function rpc(name,args){
  const c=client();if(!c)throw new Error('Supabase 尚未初始化');
  const {data:s,error:se}=await c.auth.getSession();if(se)throw se;
  if(!s?.session?.user)throw new Error('請先登入後台');
  const {data,error}=await c.rpc(name,args||{});if(error)throw error;return data;
}
function lock(on){
  busy=on;
  ['aiStage2Preview','aiStage2Execute','aiStage2Restore'].forEach(id=>{const e=$(id);if(e)e.disabled=on});
}
function ensure(){
  const panel=$('aiTestStage1Panel');
  if(!panel||$('aiTestStage2Controls'))return;
  const box=document.createElement('div');
  box.id='aiTestStage2Controls';
  box.className='notice';
  box.style.marginTop='16px';
  box.innerHTML=`
    <h3>第二階段｜100 位 AI 安全重生</h3>
    <p>執行前會完整備份目前 AI。只操作 <code>public.world_cultivators</code>；
    玩家資料預計修改數固定為 <b>0</b>。</p>
    <div class="row">
      <button class="btn jade" id="aiStage2Preview" type="button">檢查重生範圍</button>
      <input id="aiStage2Confirm" placeholder="輸入 RESET-100-AI" style="min-width:240px">
      <button class="btn red" id="aiStage2Execute" type="button">備份並重生100位AI</button>
    </div>
    <div id="aiStage2PreviewResult" style="margin-top:10px">尚未檢查。</div>
    <hr style="margin:16px 0;border-color:#403624">
    <div class="row">
      <input id="aiStage2RestoreRun" type="number" placeholder="測試 Run ID">
      <input id="aiStage2RestoreConfirm" placeholder="輸入 RESTORE-AI-BACKUP" style="min-width:250px">
      <button class="btn" id="aiStage2Restore" type="button">還原指定備份</button>
    </div>`;
  panel.appendChild(box);
  $('aiStage2Preview').onclick=preview;
  $('aiStage2Execute').onclick=executeReset;
  $('aiStage2Restore').onclick=restore;
}
async function preview(){
  if(busy)return;lock(true);
  try{
    const d=await rpc('admin_ai_test_stage2_preview');
    $('aiStage2PreviewResult').innerHTML=`
      安全狀態：<b>${d.safe?'可執行':'不可執行'}</b><br>
      AI 主表：${esc(d.ai_table)}<br>
      現有 AI：${esc(d.current_ai_count)}<br>
      目標 AI：${esc(d.target_ai_count)}<br>
      將備份：${esc(d.rows_to_backup)} 筆<br>
      將移除：${esc(d.rows_to_remove)} 筆舊 AI<br>
      玩家資料修改：<b>${esc(d.player_rows_to_modify)}</b><br>
      執行中測試：${esc(d.active_runs)}<br>
      確認文字：<code>${esc(d.confirmation_required)}</code>`;
    notice('第二階段重生範圍檢查完成');
  }catch(e){notice('檢查失敗：'+(e?.message||e))}
  finally{lock(false)}
}
async function executeReset(){
  if(busy)return;
  const confirm=$('aiStage2Confirm').value.trim();
  if(confirm!=='RESET-100-AI'){
    notice('確認文字不正確，未執行任何操作');return;
  }
  if(!window.confirm('將完整備份目前 AI，並重生為100位新生修士。玩家資料不會修改。確定執行？'))return;
  lock(true);
  try{
    const d=await rpc('admin_ai_test_reset_100',{
      p_confirmation:confirm,
      p_duration_hours:Number($('aiTestHours')?.value)||12,
      p_subject_count:Number($('aiTestSubjects')?.value)||20
    });
    $('aiStage2RestoreRun').value=d.run_id;
    notice(`重生完成：${d.after_ai_count} 位 AI；固定監控 ${d.subjects} 位；Run ID ${d.run_id}`);
    if(typeof loadRuns==='function')await loadRuns();
    await preview();
  }catch(e){notice('重生失敗，交易已回滾：'+(e?.message||e))}
  finally{lock(false)}
}
async function restore(){
  if(busy)return;
  const runId=Number($('aiStage2RestoreRun').value);
  const confirm=$('aiStage2RestoreConfirm').value.trim();
  if(!runId||confirm!=='RESTORE-AI-BACKUP'){
    notice('請輸入 Run ID 與 RESTORE-AI-BACKUP');return;
  }
  if(!window.confirm('確定以該 Run ID 的備份還原 AI 世界？玩家資料不會修改。'))return;
  lock(true);
  try{
    const d=await rpc('admin_ai_test_restore_run',{p_run_id:runId,p_confirmation:confirm});
    notice(`AI 備份已還原，共 ${d.restored_rows} 位`);
    await preview();
  }catch(e){notice('還原失敗，交易已回滾：'+(e?.message||e))}
  finally{lock(false)}
}
function boot(){
  ensure();
  setTimeout(()=>{if($('aiStage2Preview'))preview()},1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
