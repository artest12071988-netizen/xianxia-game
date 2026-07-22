(()=>{
'use strict';
const ID='meditationRuntimeSettingsCard';
const FALLBACK={
  meditate_hp_interval_sec:10,
  meditate_hp_gain:1,
  meditate_mp_interval_sec:10,
  meditate_mp_gain:1,
  meditate_exp_interval_sec:20,
  meditate_novice_exp_interval_sec:2
};
function sb(){return window.xianxiaAdminSupabase||window.sb||null}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function fmt(v){return num(v).toFixed(5)}
function getParams(){
  const cfg=window.V129_CONFIG_ADMIN?.state?.published?.config
    ||window.V129_CONFIG_ADMIN?.state?.draft
    ||{};
  return {...FALLBACK,...(cfg.params||{})};
}
function calc(amount,percent){return num(amount)*num(percent)/100}
function ratePer(seconds,interval,amount){
  interval=Math.max(0.00001,num(interval,1));
  return seconds/interval*num(amount);
}
function previewRow(label,interval,base,percent){
  const actual=calc(base,percent);
  return `<tr><th>${label}</th><td>每 ${fmt(interval)} 秒</td><td>${fmt(base)}</td><td>${fmt(actual)}</td><td>${fmt(ratePer(60,interval,actual))}</td><td>${fmt(ratePer(3600,interval,actual))}</td></tr>`;
}
function renderPreview(){
  const box=document.getElementById('medPreviewBody'); if(!box)return;
  const p=getParams();
  const recovery=num(document.getElementById('medRecoveryPercent')?.value,100);
  const experience=num(document.getElementById('medExperiencePercent')?.value,100);
  box.innerHTML=[
    previewRow('體力恢復',p.meditate_hp_interval_sec,p.meditate_hp_gain,recovery),
    previewRow('精力恢復',p.meditate_mp_interval_sec,p.meditate_mp_gain,recovery),
    previewRow('一般區修為',p.meditate_exp_interval_sec,1,experience),
    previewRow('新手區修為',p.meditate_novice_exp_interval_sec,1,experience)
  ].join('');
  const note=document.getElementById('medPreviewNote');
  if(note)note.textContent='依目前正式 Config 基礎值試算；區域靈氣與廣告加成以 ×1 計。實際遊戲會再乘上所在地與其他加成。';
}
function ensure(){
 if(document.getElementById(ID)) return;
 const main=document.getElementById('adminMain'); if(!main) return;
 const card=document.createElement('section');
 card.className='card'; card.id=ID; card.dataset.uiGroup='world';
 card.innerHTML=`<div class="head"><div><h2>打坐與修煉設定</h2><small>以百分比控制打坐恢復與修為獲得速度，支援小數點後五位。</small></div></div>
 <div class="grid2 meditation-settings-grid">
  <div class="field"><label>打坐恢復速度（%）</label><input id="medRecoveryPercent" type="number" min="0" max="10000" step="0.00001" value="100.00000"><small>體力與精力恢復共用此倍率。</small></div>
  <div class="field"><label>打坐經驗獲得速度（%）</label><input id="medExperiencePercent" type="number" min="0" max="10000" step="0.00001" value="100.00000"><small>只乘在最終修為結果，不改原始打坐公式。</small></div>
 </div>
 <div class="status" style="margin-top:12px"><div><span>目前恢復倍率</span><b id="medRecoveryReadout">100.00000%</b></div><div><span>目前經驗倍率</span><b id="medExperienceReadout">100.00000%</b></div><div><span>更新時間</span><b id="medUpdatedAt">尚未載入</b></div></div>
 <section class="med-preview">
   <div class="med-preview-head"><div><h3>目前結算預覽</h3><small id="medPreviewNote"></small></div></div>
   <div class="med-preview-wrap"><table><thead><tr><th>項目</th><th>結算間隔</th><th>原始每次</th><th>套用後每次</th><th>每分鐘</th><th>每小時</th></tr></thead><tbody id="medPreviewBody"></tbody></table></div>
 </section>
 <button class="btn gold" id="medSavePublish" style="width:100%;margin-top:12px">儲存並發布</button>`;
 main.appendChild(card);
 document.getElementById('medSavePublish').addEventListener('click',save);
 ['medRecoveryPercent','medExperiencePercent'].forEach(id=>document.getElementById(id).addEventListener('input',()=>{updateReadout();renderPreview()}));
 window.addEventListener('xianxia:config-admin-ready',renderPreview);
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
 updateReadout();renderPreview();
}
async function save(){
 const r=Number(document.getElementById('medRecoveryPercent').value),e=Number(document.getElementById('medExperiencePercent').value);
 if(!Number.isFinite(r)||!Number.isFinite(e)||r<0||r>10000||e<0||e>10000){window.toast?.('倍率必須介於 0.00000%～10000.00000%');return}
 const c=sb(); if(!c){window.toast?.('Supabase 尚未連線');return}
 const btn=document.getElementById('medSavePublish'); btn.disabled=true;
 const {data,error}=await c.rpc('admin_set_meditation_runtime_settings',{p_recovery_percent:r,p_experience_percent:e}); btn.disabled=false;
 if(error){window.toast?.('發布失敗：'+error.message);return}
 window.toast?.('打坐倍率已儲存並發布'); window.addLog?.(`打坐倍率：恢復 ${fmt(r)}%，經驗 ${fmt(e)}%`);
 document.getElementById('medUpdatedAt').textContent=new Date(data?.updated_at||Date.now()).toLocaleString('zh-TW'); updateReadout();renderPreview();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ensure); else ensure();
})();
