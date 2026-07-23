(()=>{
'use strict';
const ID='meditationRuntimeSettingsCard';
const $=id=>document.getElementById(id);
function sb(){return window.xianxiaAdminSupabase||window.sb||null}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function fmt(v,d=5){return num(v).toFixed(d)}
function field(id,label,value,step='0.00001',min='0',max='100'){
 return `<div class="field"><label>${label}</label><input id="${id}" type="number" min="${min}" max="${max}" step="${step}" value="${value}"></div>`
}
function tickBase(max,pct,min){return Math.max(num(min),num(max)*num(pct)/100)}
function renderPreview(){
 const hpMax=num($('medPreviewHpMax')?.value,26000);
 const mpMax=num($('medPreviewMpMax')?.value,7900);
 const interval=Math.max(1,num($('medTickInterval')?.value,2));
 const recovery=num($('medRecoveryPercent')?.value,100)/100;
 const hpTick=tickBase(hpMax,$('medHpTickPercent')?.value,$('medHpMinGain')?.value)*recovery;
 const mpTick=tickBase(mpMax,$('medMpTickPercent')?.value,$('medMpMinGain')?.value)*recovery;
 const hpPerMin=60/interval*hpTick,mpPerMin=60/interval*mpTick;
 const hpMinutes=hpPerMin>0?hpMax/hpPerMin:Infinity;
 const mpMinutes=mpPerMin>0?mpMax/mpPerMin:Infinity;
 $('medPreviewBody').innerHTML=`
  <tr><th>體力打坐</th><td>每 ${interval} 秒</td><td>${fmt(hpTick,2)}</td><td>${fmt(hpPerMin,2)}</td><td>${isFinite(hpMinutes)?fmt(hpMinutes,2)+' 分':'—'}</td></tr>
  <tr><th>精力打坐</th><td>每 ${interval} 秒</td><td>${fmt(mpTick,2)}</td><td>${fmt(mpPerMin,2)}</td><td>${isFinite(mpMinutes)?fmt(mpMinutes,2)+' 分':'—'}</td></tr>
  <tr><th>回體丹</th><td>立即</td><td>${fmt(Math.max(20,hpMax*num($('medHpSmallPotion')?.value)/100),2)}</td><td>—</td><td>—</td></tr>
  <tr><th>中品培元丹</th><td>立即</td><td>${fmt(Math.max(120,hpMax*num($('medHpLargePotion')?.value)/100),2)}</td><td>—</td><td>—</td></tr>
  <tr><th>回精丹</th><td>立即</td><td>${fmt(Math.max(20,mpMax*num($('medMpSmallPotion')?.value)/100),2)}</td><td>—</td><td>—</td></tr>
  <tr><th>聚靈丹</th><td>立即</td><td>${fmt(Math.max(120,mpMax*num($('medMpLargePotion')?.value)/100),2)}</td><td>—</td><td>—</td></tr>
  <tr><th>打坐修為</th><td>每 1 秒</td><td>${fmt(num($('medExperiencePercent')?.value,100)/100,2)}</td><td>${fmt(60*num($('medExperiencePercent')?.value,100)/100,2)}</td><td>基礎 1 點／秒</td></tr>`;
 $('medRecoveryReadout').textContent=fmt($('medRecoveryPercent').value)+'%';
 $('medExperienceReadout').textContent=fmt($('medExperiencePercent').value)+'%';
}
function ensure(){
 if($(ID))return;
 const main=$('adminMain');if(!main)return;
 const card=document.createElement('section');
 card.className='card';card.id=ID;card.dataset.uiGroup='world';
 card.innerHTML=`<div class="head"><div><h2>打坐與高階恢復設定</h2><small>體力／精力採比例恢復；修為基礎固定為每 1 秒 1 點，再乘修為倍率。</small></div></div>
 <div class="grid2 meditation-settings-grid">
  ${field('medRecoveryPercent','打坐恢復總倍率（%）','100.00000','0.00001','0','10000')}
  ${field('medExperiencePercent','打坐修為總倍率（%）','100.00000','0.00001','0','10000')}
  ${field('medTickInterval','體力／精力結算間隔（秒）','2','1','1','60')}
  ${field('medHpTickPercent','每跳最大體力比例（%）','0.25000')}
  ${field('medMpTickPercent','每跳最大精力比例（%）','0.35000')}
  ${field('medHpMinGain','每跳體力最低恢復','5.00000','0.00001','0','100000000')}
  ${field('medMpMinGain','每跳精力最低恢復','3.00000','0.00001','0','100000000')}
  ${field('medHpSmallPotion','回體丹比例（%）','8.00000')}
  ${field('medHpLargePotion','中品培元丹比例（%）','22.00000')}
  ${field('medMpSmallPotion','回精丹比例（%）','10.00000')}
  ${field('medMpLargePotion','聚靈丹比例（%）','25.00000')}
 </div>
 <div class="status" style="margin-top:12px">
  <div><span>恢復倍率</span><b id="medRecoveryReadout">100.00000%</b></div>
  <div><span>修為倍率</span><b id="medExperienceReadout">100.00000%</b></div>
  <div><span>更新時間</span><b id="medUpdatedAt">尚未載入</b></div>
 </div>
 <section class="med-preview">
  <div class="med-preview-head"><div><h3>高階角色試算</h3><small>區域、廣告與功法倍率以 ×1 試算。</small></div>
   <div class="med-preview-inputs">
    <label>最大體力<input id="medPreviewHpMax" type="number" value="26000"></label>
    <label>最大精力<input id="medPreviewMpMax" type="number" value="7900"></label>
   </div>
  </div>
  <div class="med-preview-wrap"><table><thead><tr><th>項目</th><th>間隔</th><th>每次／立即</th><th>每分鐘</th><th>空值回滿</th></tr></thead><tbody id="medPreviewBody"></tbody></table></div>
 </section>
 <button class="btn gold" id="medSavePublish" style="width:100%;margin-top:12px">儲存並發布</button>`;
 main.appendChild(card);
 $('medSavePublish').onclick=save;
 card.querySelectorAll('input').forEach(x=>x.addEventListener('input',renderPreview));
 setTimeout(()=>window.dispatchEvent(new CustomEvent('xianxia-admin-module-added')),0);
 load();
}
async function load(){
 const c=sb();if(!c)return setTimeout(load,500);
 const {data,error}=await c.rpc('get_meditation_runtime_settings');
 if(error){window.toast?.('打坐設定載入失敗：'+error.message);return}
 const d=data||{};
 const map={
  medRecoveryPercent:d.recovery_percent??100,
  medExperiencePercent:d.experience_percent??100,
  medTickInterval:d.recovery_tick_interval_sec??2,
  medHpTickPercent:d.hp_tick_percent??.25,
  medMpTickPercent:d.mp_tick_percent??.35,
  medHpMinGain:d.hp_min_gain??5,
  medMpMinGain:d.mp_min_gain??3,
  medHpSmallPotion:d.hp_small_potion_percent??8,
  medHpLargePotion:d.hp_large_potion_percent??22,
  medMpSmallPotion:d.mp_small_potion_percent??10,
  medMpLargePotion:d.mp_large_potion_percent??25
 };
 Object.entries(map).forEach(([id,v])=>{if($(id))$(id).value=v});
 $('medUpdatedAt').textContent=d.updated_at?new Date(d.updated_at).toLocaleString('zh-TW'):'尚未更新';
 renderPreview();
}
async function save(){
 const args={
  p_recovery_percent:num($('medRecoveryPercent').value),
  p_experience_percent:num($('medExperiencePercent').value),
  p_recovery_tick_interval_sec:Math.floor(num($('medTickInterval').value)),
  p_hp_tick_percent:num($('medHpTickPercent').value),
  p_mp_tick_percent:num($('medMpTickPercent').value),
  p_hp_min_gain:num($('medHpMinGain').value),
  p_mp_min_gain:num($('medMpMinGain').value),
  p_hp_small_potion_percent:num($('medHpSmallPotion').value),
  p_hp_large_potion_percent:num($('medHpLargePotion').value),
  p_mp_small_potion_percent:num($('medMpSmallPotion').value),
  p_mp_large_potion_percent:num($('medMpLargePotion').value)
 };
 const c=sb();if(!c){window.toast?.('Supabase 尚未連線');return}
 const btn=$('medSavePublish');btn.disabled=true;
 const {data,error}=await c.rpc('admin_set_meditation_runtime_settings_v2',args);
 btn.disabled=false;
 if(error){window.toast?.('發布失敗：'+error.message);return}
 window.toast?.('高階恢復與丹藥比例已發布');
 window.addLog?.('更新打坐比例恢復與四種丹藥百分比');
 $('medUpdatedAt').textContent=new Date(data?.updated_at||Date.now()).toLocaleString('zh-TW');
 renderPreview();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
})();
