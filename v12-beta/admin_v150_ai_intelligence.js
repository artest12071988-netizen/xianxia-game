(()=>{
'use strict';
const CARD_ID='v150AiIntelligenceCard';
const fmt=n=>Number(n||0).toLocaleString('zh-TW');
function client(){return window.xianxiaAdminSupabase||window.sb||null}
function ensure(){
  if(document.getElementById(CARD_ID))return;
  const main=document.getElementById('adminMain');if(!main)return;
  const card=document.createElement('section');
  card.id=CARD_ID;card.className='card';card.dataset.uiGroup='ai';
  card.innerHTML=`
    <div class="head">
      <div>
        <h2>V15.0 AI 真人化驗收</h2>
        <small>檢查現有 AI 是否有裝備、行囊、決策活動與多樣化行為。此面板不會重建 AI。</small>
      </div>
      <button class="btn" id="v150Refresh">更新報告</button>
    </div>
    <div class="status v150-ai-grid">
      <div><span>AI 總數</span><b id="v150Total">—</b></div>
      <div><span>有武器</span><b id="v150Weapon">—</b></div>
      <div><span>有防具</span><b id="v150Armor">—</b></div>
      <div><span>有行囊</span><b id="v150Inventory">—</b></div>
      <div><span>10分鐘有決策</span><b id="v150Recent">—</b></div>
      <div><span>24小時事件</span><b id="v150Events">—</b></div>
    </div>
    <div class="v150-ai-report">
      <h3>24 小時行為分布</h3>
      <div id="v150Mix" class="v150-mix">尚未載入</div>
      <p id="v150Verdict" class="small"></p>
    </div>
    <div class="row" style="margin-top:12px">
      <button class="btn gold" id="v150RunCycle">手動執行一輪（最多25位）</button>
    </div>`;
  main.appendChild(card);
  document.getElementById('v150Refresh').onclick=load;
  document.getElementById('v150RunCycle').onclick=runCycle;
  setTimeout(()=>window.dispatchEvent(new CustomEvent('xianxia-admin-module-added')),0);
  load();
}
async function load(){
  const c=client();if(!c)return setTimeout(load,500);
  const {data,error}=await c.rpc('admin_v150_ai_intelligence_report');
  if(error){window.toast?.('V15 AI 報告失敗：'+error.message);return}
  const d=data||{};
  v150Total.textContent=fmt(d.total_ai);
  v150Weapon.textContent=`${fmt(d.with_weapon)} / ${fmt(d.total_ai)}`;
  v150Armor.textContent=`${fmt(d.with_armor)} / ${fmt(d.total_ai)}`;
  v150Inventory.textContent=`${fmt(d.with_inventory)} / ${fmt(d.total_ai)}`;
  v150Recent.textContent=fmt(d.recently_decided);
  v150Events.textContent=fmt(d.events_24h);
  const mix=d.decision_mix_24h||{};
  v150Mix.innerHTML=Object.keys(mix).length
    ?Object.entries(mix).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span><b>${k}</b>${fmt(v)}</span>`).join('')
    :'尚無 V15 決策事件';
  const gearOk=Number(d.with_weapon)===Number(d.total_ai)&&Number(d.with_armor)===Number(d.total_ai);
  const active=Number(d.recently_decided)>0;
  v150Verdict.textContent=gearOk&&active
    ?'基礎配裝與決策引擎已運作。請持續觀察 12～24 小時，確認行為分布不是單一動作。'
    :'尚未達驗收：請確認 SQL 已執行，並等待世界循環或手動執行一輪。';
}
async function runCycle(){
  const c=client();if(!c)return;
  const btn=document.getElementById('v150RunCycle');btn.disabled=true;
  const {data,error}=await c.rpc('process_ai_brain_batch',{p_limit:25});
  btn.disabled=false;
  if(error){window.toast?.('執行失敗：'+error.message);return}
  window.toast?.(`已處理 ${data?.processed||0} 位 AI`);
  setTimeout(load,500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
})();
