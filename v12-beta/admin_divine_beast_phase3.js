(()=>{
'use strict';
const CARD='v151Phase3Card';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v||0).toLocaleString('zh-TW');
const pct=v=>(Number(v||0)*100).toFixed(1);
const E={fire:'火',water:'水',wood:'木',metal:'金',earth:'土'};
const ET={
 applied:'附魔',
 fire_damage:'火傷',
 water_mana_drain:'削法',
 wood_heal:'吸血',
 metal_crit:'金暴擊',
 earth_reduction:'土減傷'
};

function sb(){return window.xianxiaAdminSupabase||window.sb||null}
function notify(m){if(typeof window.toast==='function')window.toast(m);else alert(m)}
async function rpc(fn,args={}){
 const c=sb();if(!c)throw new Error('後台連線尚未建立');
 const {data,error}=await c.rpc(fn,args);if(error)throw error;return data
}
function ensure(){
 if($(CARD))return;
 const main=$('adminMain');if(!main)return;
 const card=document.createElement('section');
 card.id=CARD;card.className='card';card.dataset.uiGroup='world';
 card.innerHTML=`<div class="head"><div><h2>V15.1 Phase 3｜神獸戰況與 AI 參戰</h2><small>玩家、AI、掉落與五行附魔實戰統計；不重建神獸。</small></div><div class="row"><select id="v151p3Hours"><option value="24">24小時</option><option value="72">3天</option><option value="168">7天</option></select><button class="btn" id="v151p3Refresh">更新</button></div></div>
 <div class="status v151p3-summary">
  <div><span>玩家傷害</span><b id="v151p3PlayerDamage">—</b></div>
  <div><span>AI 傷害</span><b id="v151p3AiDamage">—</b></div>
  <div><span>神獸結束</span><b id="v151p3Outcomes">—</b></div>
  <div><span>附魔觸發</span><b id="v151p3Enchant">—</b></div>
 </div>
 <div id="v151p3Config" class="v151p3-panel" style="margin-top:12px"></div>
 <div class="v151p3-grid">
  <div class="v151p3-panel"><h3>目前五大神獸累積戰況</h3><div id="v151p3Beasts" class="v151p3-scroll"></div></div>
  <div class="v151p3-panel"><h3>五行附魔驗收</h3><div id="v151p3EnchantMix" class="v151p3-mix"></div></div>
  <div class="v151p3-panel"><h3>玩家傷害排行</h3><div id="v151p3Players" class="v151p3-scroll"></div></div>
  <div class="v151p3-panel"><h3>AI 參戰排行</h3><div id="v151p3Ai" class="v151p3-scroll"></div></div>
  <div class="v151p3-panel" style="grid-column:1/-1"><h3>最近 AI 神獸行動</h3><div id="v151p3Recent" class="v151p3-scroll"></div></div>
 </div>`;
 main.appendChild(card);
 $('v151p3Refresh').onclick=load;
 setTimeout(()=>window.dispatchEvent(new CustomEvent('xianxia-admin-module-added')),0);
 load();
}
function table(headers,rows){
 return `<table class="v151p3-table"><thead><tr>${headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function renderConfig(c={}){
 $('v151p3Config').innerHTML=`<h3>AI 參戰規則</h3><div class="v151p3-config">
  <label>AI 參戰<select id="v151p3Enabled"><option value="true" ${c.ai_enabled?'selected':''}>啟用</option><option value="false" ${!c.ai_enabled?'selected':''}>停用</option></select></label>
  <label>循環秒數<input id="v151p3Seconds" type="number" min="15" max="3600" value="${Number(c.ai_cycle_seconds||60)}"></label>
  <label>同座標出手機率（%）<input id="v151p3Join" type="number" step=".1" min="0" max="100" value="${pct(c.ai_join_chance)}"></label>
  <label>同方位趕赴機率（%）<input id="v151p3Move" type="number" step=".1" min="0" max="100" value="${pct(c.ai_move_chance)}"></label>
  <label>最低體力比例（%）<input id="v151p3MinHp" type="number" step=".1" min="0" max="100" value="${pct(c.ai_min_hp_ratio)}"></label>
  <label>每輪最多行動<input id="v151p3Max" type="number" min="1" max="100" value="${Number(c.ai_max_actions_per_cycle||20)}"></label>
 </div><div class="row" style="margin-top:10px"><button class="btn gold" id="v151p3Save">儲存 AI 規則</button><button class="btn jade" id="v151p3Run">立即執行 AI 參戰</button><small>最後循環：${c.last_ai_cycle_at?new Date(c.last_ai_cycle_at).toLocaleString('zh-TW'):'尚未執行'}</small></div>`;
 $('v151p3Save').onclick=saveConfig;
 $('v151p3Run').onclick=runAi;
}
async function saveConfig(){
 try{
  await rpc('admin_divine_beast_update_ai_config',{
   p_ai_enabled:$('v151p3Enabled').value==='true',
   p_ai_cycle_seconds:Number($('v151p3Seconds').value),
   p_ai_join_chance:Number($('v151p3Join').value)/100,
   p_ai_move_chance:Number($('v151p3Move').value)/100,
   p_ai_min_hp_ratio:Number($('v151p3MinHp').value)/100,
   p_ai_max_actions_per_cycle:Number($('v151p3Max').value)
  });
  notify('AI 參戰規則已儲存');load();
 }catch(e){notify('儲存失敗：'+(e.message||e))}
}
async function runAi(){
 try{
  const d=await rpc('divine_beast_ai_cycle',{p_limit:25,p_force:true});
  notify(`AI 循環完成：移動 ${d?.moved||0}、攻擊 ${d?.hits||0}、撤退 ${d?.retreats||0}`);
  load();
 }catch(e){notify('AI 參戰失敗：'+(e.message||e))}
}
async function load(){
 try{
  const d=await rpc('admin_divine_beast_phase3_report',{p_hours:Number($('v151p3Hours')?.value||24)});
  render(d||{});
 }catch(e){notify('Phase 3 報告失敗：'+(e.message||e))}
}
function render(d){
 const s=d.summary||{};
 $('v151p3PlayerDamage').textContent=num(s.player_damage);
 $('v151p3AiDamage').textContent=num(s.ai_damage);
 $('v151p3Outcomes').textContent=`戰死 ${num(s.defeated)}／逃離 ${num(s.escaped)}`;
 $('v151p3Enchant').textContent=num(s.enchant_events);
 renderConfig(d.config||{});
 $('v151p3Beasts').innerHTML=table(['神獸','狀態','血量','玩家／AI傷害','最後交戰'],(d.beasts||[]).map(b=>`<tr><td><b>${esc(b.beast_name)}</b><br><small>世代 ${num(b.generation)}｜${esc(b.coord||'—')}</small></td><td>${esc(b.status)}</td><td>${num(b.current_hp)} / ${num(b.max_hp)}</td><td>${num(b.player_damage_total)} / ${num(b.ai_damage_total)}<br><small>${num(b.player_hit_count)} / ${num(b.ai_hit_count)} 次</small></td><td>${esc(b.last_combatant_kind||'—')}｜${esc(b.last_combatant_name||'—')}</td></tr>`));
 $('v151p3Players').innerHTML=table(['修士','傷害','次數'],(d.top_players||[]).map(x=>`<tr><td>${esc(x.player_name)}</td><td>${num(x.damage)}</td><td>${num(x.hits)}</td></tr>`));
 $('v151p3Ai').innerHTML=table(['AI 修士','傷害','次數／材料'],(d.top_ai||[]).map(x=>`<tr><td>${esc(x.ai_name)}</td><td>${num(x.damage)}</td><td>${num(x.hits)}／${num(x.rewards)}</td></tr>`));
 $('v151p3EnchantMix').innerHTML=(d.enchant_mix||[]).map(x=>`<span class="v151p3-element-${esc(x.element)}"><b>${esc(E[x.element]||x.element)}｜${esc(ET[x.event_type]||x.event_type)}</b> ${num(x.events)} 次｜${num(x.amount)}</span>`).join('')||'<span>尚無附魔觸發紀錄</span>';
 $('v151p3Recent').innerHTML=table(['時間','AI','行動','神獸','傷害／反擊','結果'],(d.recent_ai_actions||[]).map(x=>`<tr><td>${new Date(x.created_at).toLocaleString('zh-TW')}</td><td>${esc(x.ai_name)}</td><td>${esc(x.action_type)}</td><td>${esc(x.beast_key)}</td><td>${num(x.damage)}／${num(x.retaliation_damage)}</td><td>${esc(x.outcome)}</td></tr>`));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});else ensure();
})();
