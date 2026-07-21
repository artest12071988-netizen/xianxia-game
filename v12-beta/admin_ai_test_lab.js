(function(){
'use strict';
if(window.__AITestStage1Loaded)return;
window.__AITestStage1Loaded=true;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false;
function client(){try{return typeof sb!=='undefined'?sb:null}catch(_){return null}}
function notice(t){if(typeof toast==='function')toast(t);else alert(t)}
function ensurePanel(){
  if($('aiTestStage1Panel'))return;
  const host=$('aiObservatoryPanel')||document.querySelector('main')||document.body;
  const s=document.createElement('section');
  s.id='aiTestStage1Panel';s.className='card';s.style.marginTop='18px';
  s.innerHTML=`<h2>AI 修仙實境測試場</h2>
  <div class="notice">第一階段只建立資料表、測試草稿與安全預檢。<b>不刪除 AI、不重生 AI、不修改玩家資料或遊戲設定。</b></div>
  <div class="grid3" style="margin-top:12px">
    <div class="field"><label>測試 AI 數量</label><input id="aiTestCount" type="number" value="100" min="1" max="1000"></div>
    <div class="field"><label>監控 AI 數量</label><input id="aiTestSubjects" type="number" value="20" min="1" max="100"></div>
    <div class="field"><label>監控時數</label><input id="aiTestHours" type="number" value="12" min="1" max="72"></div>
  </div>
  <div class="row" style="margin-top:10px">
    <button class="btn jade" id="aiTestPreflightBtn">執行安全預檢</button>
    <button class="btn gold" id="aiTestDraftBtn">建立測試草稿</button>
    <button class="btn" id="aiTestRefreshBtn">重新整理紀錄</button>
  </div>
  <div id="aiTestPreflightResult" class="notice" style="margin-top:12px">尚未執行安全預檢。</div>
  <h3>遊戲歷程保存位置</h3>
  <div class="notice">批次：<code>public.ai_test_runs</code><br>20 位觀測名單：<code>public.ai_test_subjects</code><br>詳細文字歷程：<code>public.ai_test_events</code><br>定時狀態快照：<code>public.ai_test_snapshots</code></div>
  <h3>最近測試批次</h3><div id="aiTestRuns">尚無測試草稿。</div>`;
  host.appendChild(s);
  $('aiTestPreflightBtn').onclick=preflight;
  $('aiTestDraftBtn').onclick=createDraft;
  $('aiTestRefreshBtn').onclick=loadRuns;
}
function lock(on){busy=on;['aiTestPreflightBtn','aiTestDraftBtn','aiTestRefreshBtn'].forEach(id=>{const e=$(id);if(e)e.disabled=on})}
async function rpc(name,args){
  const c=client();if(!c)throw new Error('Supabase 尚未初始化');
  const {data:s,error:se}=await c.auth.getSession();if(se)throw se;
  if(!s?.session?.user)throw new Error('請先登入後台');
  const {data,error}=await c.rpc(name,args||{});if(error)throw error;return data;
}
async function preflight(){
  if(busy)return;ensurePanel();lock(true);
  try{
    const d=await rpc('admin_ai_test_preflight');
    $('aiTestPreflightResult').innerHTML=`<b>安全模式：${d.safe_mode?'已啟用':'異常'}</b><br>
    破壞性操作：${d.destructive_actions_enabled?'已開啟':'尚未開啟（正確）'}<br>
    偵測 AI 主表：${esc(d.detected_ai_table||'未辨識')}<br>
    現有 AI 數量：${esc(d.detected_ai_count??'—')}<br>
    玩家資料筆數：${esc(d.detected_player_count??'—')}<br>
    進行中測試：${esc(d.active_test_runs??0)}<br>
    正式設定版本：${esc(d.config_version||'未提供版本欄位')}<br>
    檢查時間：${esc(new Date(d.checked_at).toLocaleString('zh-TW'))}`;
    notice('安全預檢完成，沒有執行任何刪除或重生');
  }catch(e){$('aiTestPreflightResult').textContent='預檢失敗：'+(e?.message||e);notice('預檢失敗')}
  finally{lock(false)}
}
async function createDraft(){
  if(busy)return;lock(true);
  try{
    const d=await rpc('admin_ai_test_create_draft',{
      p_ai_count:Number($('aiTestCount').value)||100,
      p_subject_count:Number($('aiTestSubjects').value)||20,
      p_duration_hours:Number($('aiTestHours').value)||12
    });
    const r=Array.isArray(d)?d[0]:d;
    notice('已建立安全草稿：'+r.run_code+'；尚未重生 AI');
    await loadRuns();
  }catch(e){notice('建立草稿失敗：'+(e?.message||e))}
  finally{lock(false)}
}
async function loadRuns(){
  ensurePanel();
  try{
    const rows=await rpc('admin_ai_test_list_runs',{p_limit:20});
    $('aiTestRuns').innerHTML=(rows||[]).map(r=>`<div style="padding:9px 0;border-bottom:1px solid #443725"><b>${esc(r.run_code)}</b>｜狀態：${esc(r.status)}｜AI ${esc(r.requested_ai_count)}｜監控 ${esc(r.requested_subject_count)}｜${esc(r.requested_duration_hours)} 小時<br>建立：${esc(new Date(r.created_at).toLocaleString('zh-TW'))}</div>`).join('')||'尚無測試草稿。';
  }catch(e){$('aiTestRuns').textContent='讀取失敗：'+(e?.message||e)}
}
function boot(){ensurePanel();setTimeout(loadRuns,800)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();