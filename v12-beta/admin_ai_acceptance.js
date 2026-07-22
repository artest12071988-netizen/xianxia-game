(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function client(){return window.xianxiaAdminSupabase||window.cloudState?.client||window.sb||null}
function toast2(m){if(typeof window.toast==='function')window.toast(m);else alert(m)}
function card(){
  let c=$('#aiAcceptanceCard');if(c)return c;
  c=document.createElement('section');c.className='card';c.id='aiAcceptanceCard';
  c.innerHTML='<h2>AI 歷程驗收中心</h2><p class="small">不重建 AI；讀取目前世界資料，檢查裝備、行囊、重生與屍體狀態。</p><div class="v148-audit-actions"><button class="btn jade" id="v148AuditRun">產生驗收報告</button><button class="btn" id="v148AuditAnomaly">查看異常 AI</button></div><div id="v148AuditSummary" class="small">尚未產生報告。</div><div id="v148AuditTable"></div>';
  const main=document.getElementById('adminMain');(main||document.body).appendChild(c);
  $('#v148AuditRun').onclick=run;
  $('#v148AuditAnomaly').onclick=anomalies;
  return c;
}
function box(label,val,cls=''){return '<div class="v148-audit-box"><span>'+esc(label)+'</span><b class="'+cls+'">'+esc(val)+'</b></div>'}
async function run(){
  const c=client();if(!c)return toast2('Supabase 尚未連線');
  const b=$('#v148AuditRun');b.disabled=true;b.textContent='讀取中…';
  try{
    const {data,error}=await c.rpc('admin_v148_ai_acceptance_report',{p_hours:24});if(error)throw error;
    const a=data.ai||{},co=data.corpses||{};
    $('#v148AuditSummary').innerHTML='<div class="v148-audit-grid">'+
      box('驗收結果',data.pass?'PASS':'FAIL',data.pass?'v148-pass':'v148-fail')+
      box('AI 總數',a.total??0)+box('存活／待重生',(a.alive??0)+' / '+(a.dead_waiting??0))+
      box('有裝備 AI',a.with_gear??0)+box('有行囊 AI',a.with_inventory??0)+
      box('資產全空 AI',a.empty_assets??0,(a.empty_assets??0)>0?'v148-fail':'v148-pass')+
      box('非法物品',((a.invalid_inventory_entries??0)+(a.invalid_gear_entries??0)),((a.invalid_inventory_entries??0)+(a.invalid_gear_entries??0))>0?'v148-fail':'v148-pass')+
      box('活躍屍體',co.active??0)+box('24h 搜刮事件',co.loot_events??0)+
      box('AI 搜刮／玩家搜刮',(co.ai_loot_events??0)+' / '+(co.player_loot_events??0))+
      box('最高世代',a.max_generation??0)+'</div>';
    toast2('AI 驗收報告已更新');
  }catch(e){toast2('驗收失敗：'+(e.message||e));}
  finally{b.disabled=false;b.textContent='產生驗收報告';}
}
async function anomalies(){
  const c=client();if(!c)return toast2('Supabase 尚未連線');
  try{
    const {data,error}=await c.rpc('admin_v148_ai_anomalies',{p_limit:100});if(error)throw error;
    const rows=Array.isArray(data)?data:[];
    $('#v148AuditTable').innerHTML=rows.length?'<h3>異常 AI</h3><div class="v148-table-wrap"><table><thead><tr><th>ID</th><th>道號</th><th>境界</th><th>座標</th><th>世代</th><th>靈石</th><th>裝備</th><th>行囊</th><th>異常</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.id)+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.realm)+' Lv'+esc(r.level)+'</td><td>'+esc(r.coord)+'</td><td>'+esc(r.generation)+'</td><td>'+esc(r.lingshi)+'</td><td>'+esc(r.gear_count)+'</td><td>'+esc(r.inventory_types)+'</td><td>'+esc(r.anomaly)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="small v148-pass">目前沒有符合條件的異常 AI。</p>';
  }catch(e){toast2('讀取異常清單失敗：'+(e.message||e));}
}
function waitForClient(maxWaitMs=10000){
  return new Promise(resolve=>{
    const started=Date.now();
    const timer=setInterval(()=>{
      const c=client();
      if(c||Date.now()-started>=maxWaitMs){clearInterval(timer);resolve(c||null)}
    },100);
  });
}
async function init(){
  card();
  const c=await waitForClient();
  if(!c){
    const summary=$('#v148AuditSummary');
    if(summary)summary.textContent='Supabase 連線尚未建立，請重新整理後台。';
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
