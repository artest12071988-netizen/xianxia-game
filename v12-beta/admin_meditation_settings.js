(()=>{
'use strict';
const ID='meditationRuntimeSettingsCard';
function sb(){return window.xianxiaAdminSupabase||window.sb||null}
function fmt(v){return Number(v||0).toFixed(5)}
function ensure(){
 if(document.getElementById(ID)) return;
 const main=document.getElementById('adminMain'); if(!main) return;
 const card=document.createElement('section');
 card.className='card'; card.id=ID; card.dataset.uiGroup='world';
 card.innerHTML=`<div class="head"><div><h2>打坐與修煉設定</h2><small>以百分比控制打坐恢復與修為獲得速度，支援小數點後五位。</small></div></div>
 <div class="grid2 meditation-settings-grid">
  <div class="field"><label>打坐恢復速度（%）</label><input id="medRecoveryPercent" type="number" min="0" max="10000" step="0.00001" value="100.00000"><small>100.00000%＝原始速度；50%＝一半；200%＝兩倍。</small></div>
  <div class="field"><label>打坐經驗獲得速度（%）</label><input id="medExperiencePercent" type="number" min="0" max="10000" step="0.00001" value="100.00000"><small>只乘在最終修為結果，不改原始打坐公式。</small></div>
 </div>
 <div class="status" style="margin-top:12px"><div><span>目前恢復倍率</span><b id="medRecoveryReadout">100.00000%</b></div><div><span>目前經驗倍率</span><b id="medExperienceReadout">100.00000%</b></div><div><span>更新時間</span><b id="medUpdatedAt">尚未載入</b></div></div>
 <button class="btn gold" id="medSavePublish" style="width:100%;margin-top:12px">儲存並發布</button>`;
 main.appendChild(card);
 document.getElementById('medSavePublish').addEventListener('click',save);
 ['medRecoveryPercent','medExperiencePercent'].forEach(id=>document.getElementById(id).addEventListener('input',updateReadout));
 setTimeout(()=>window.dispatchEvent(new CustomEvent('xianxia-admin-module-added')),0);
 load();
}
function updateReadout(){
 const r=document.getElementById('medRecoveryPercent'),e=document.getElementById('medExperiencePercent');
 if(r) document.getElementById('medRecoveryReadout').textContent=fmt(r.value)+'%';
 if(e) document.getElementById('medExperienceReadout').textContent=fmt(e.value)+'%';
}
async function load(){
 const c=sb(); if(!c) return setTimeout(load,500);
 const {data,error}=await c.rpc('get_meditation_runtime_settings');
 if(error){window.toast?.('打坐設定載入失敗：'+error.message);return}
 const d=data||{};
 document.getElementById('medRecoveryPercent').value=fmt(d.recovery_percent??100);
 document.getElementById('medExperiencePercent').value=fmt(d.experience_percent??100);
 document.getElementById('medUpdatedAt').textContent=d.updated_at?new Date(d.updated_at).toLocaleString('zh-TW'):'尚未更新';
 updateReadout();
}
async function save(){
 const r=Number(document.getElementById('medRecoveryPercent').value),e=Number(document.getElementById('medExperiencePercent').value);
 if(!Number.isFinite(r)||!Number.isFinite(e)||r<0||r>10000||e<0||e>10000){window.toast?.('倍率必須介於 0.00000%～10000.00000%');return}
 const c=sb(); if(!c){window.toast?.('Supabase 尚未連線');return}
 const btn=document.getElementById('medSavePublish'); btn.disabled=true;
 const {data,error}=await c.rpc('admin_set_meditation_runtime_settings',{p_recovery_percent:r,p_experience_percent:e}); btn.disabled=false;
 if(error){window.toast?.('發布失敗：'+error.message);return}
 window.toast?.('打坐倍率已儲存並發布'); window.addLog?.(`打坐倍率：恢復 ${fmt(r)}%，經驗 ${fmt(e)}%`);
 document.getElementById('medUpdatedAt').textContent=new Date(data?.updated_at||Date.now()).toLocaleString('zh-TW'); updateReadout();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ensure); else ensure();
})();
