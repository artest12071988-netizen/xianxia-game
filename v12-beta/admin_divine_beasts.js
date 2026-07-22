(()=>{
'use strict';
const CARD='v151DivineBeastCard';
const N={east:'東方',west:'西方',north:'北方',south:'南方',center:'中央'};
const STATUS={dormant:'未現世',active:'現世中',defeated:'已戰死',escaped:'已逃離',expired:'逾時離去',withdrawn:'後台撤離'};
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sb(){return window.xianxiaAdminSupabase||window.sb||null}
function pct(v){return (Number(v||0)*100).toFixed(2)}
function num(v){return Number(v||0).toLocaleString('zh-TW')}
function notify(m){if(typeof window.toast==='function')window.toast(m);else alert(m)}
function ensure(){
 if($(CARD))return;
 const main=$('adminMain');if(!main)return;
 const card=document.createElement('section');card.id=CARD;card.className='card';card.dataset.uiGroup='world';
 card.innerHTML=`<div class="head"><div><h2>五大神獸世界控制台</h2><small>五隻神獸獨立判定；每 10 分鐘檢查一次。可自由放置、補滿血量或撤離。</small></div><button class="btn" id="v151Refresh">更新</button></div><div id="v151Config"></div><div id="v151Beasts" class="v151-beast-grid"></div><h3 style="margin-top:16px">最近事件</h3><div id="v151Events" class="v151-events"></div>`;
 main.appendChild(card);$('v151Refresh').onclick=load;setTimeout(()=>window.dispatchEvent(new CustomEvent('xianxia-admin-module-added')),0);load();
}
async function rpc(fn,args={}){const c=sb();if(!c)throw new Error('後台連線尚未建立');const {data,error}=await c.rpc(fn,args);if(error)throw error;return data}
async function load(){
 try{const d=await rpc('admin_divine_beast_snapshot');renderConfig(d.config||{});renderBeasts(d.beasts||[]);renderEvents(d.events||[])}catch(e){notify('神獸後台讀取失敗：'+(e.message||e))}
}
function renderConfig(c){
 $('v151Config').innerHTML=`<div class="notice">預設規則：出現率 2%、遭遇率 60%、停留 60 分鐘、最後交戰修士取得材料機率 30%。低血量逃跑率因需求未指定，暫設 30%，可在此調整。</div><div class="v151-config-grid">
 <label>自動判定<select id="v151Auto"><option value="true" ${c.auto_enabled?'selected':''}>啟用</option><option value="false" ${!c.auto_enabled?'selected':''}>停用</option></select></label>
 <label>判定間隔（分鐘）<input id="v151Interval" type="number" min="1" value="${Number(c.check_interval_minutes||10)}"></label>
 <label>出現率（%）<input id="v151Spawn" type="number" step="0.01" min="0" max="100" value="${pct(c.spawn_chance)}"></label>
 <label>遭遇率（%）<input id="v151Encounter" type="number" step="0.01" min="0" max="100" value="${pct(c.encounter_chance)}"></label>
 <label>低血量門檻（%）<input id="v151Threshold" type="number" step="0.01" min="0" max="100" value="${pct(c.low_hp_escape_threshold)}"></label>
 <label>殘血逃離率（%）<input id="v151Escape" type="number" step="0.01" min="0" max="100" value="${pct(c.low_hp_escape_chance)}"></label>
 <label>材料取得率（%）<input id="v151Reward" type="number" step="0.01" min="0" max="100" value="${pct(c.reward_chance)}"></label>
 <label>停留時間（分鐘）<input id="v151Stay" type="number" min="1" value="${Number(c.stay_minutes||60)}"></label>
 <label>單次傷害上限（最大血量%）<input id="v151DamageCap" type="number" step="0.01" min="0.01" max="100" value="${pct(c.max_damage_per_hit_pct)}"></label>
 </div><div class="row" style="margin-top:10px"><button class="btn gold" id="v151SaveConfig">儲存規則</button><button class="btn jade" id="v151RunTick">立即執行世界判定</button></div>`;
 $('v151SaveConfig').onclick=saveConfig;$('v151RunTick').onclick=runTick;
}
async function saveConfig(){
 try{await rpc('admin_divine_beast_update_config',{p_auto_enabled:$('v151Auto').value==='true',p_check_interval_minutes:Number($('v151Interval').value),p_spawn_chance:Number($('v151Spawn').value)/100,p_encounter_chance:Number($('v151Encounter').value)/100,p_low_hp_escape_threshold:Number($('v151Threshold').value)/100,p_low_hp_escape_chance:Number($('v151Escape').value)/100,p_reward_chance:Number($('v151Reward').value)/100,p_stay_minutes:Number($('v151Stay').value),p_max_damage_per_hit_pct:Number($('v151DamageCap').value)/100});notify('神獸規則已儲存');load()}catch(e){notify('儲存失敗：'+(e.message||e))}
}
async function runTick(){try{const d=await rpc('divine_beast_world_tick');notify('世界判定完成：'+((d?.events||[]).length)+' 個事件');load()}catch(e){notify('執行失敗：'+(e.message||e))}}
function renderBeasts(rows){
 $('v151Beasts').innerHTML=rows.map(s=>{const hp=Number(s.max_hp)>0?Math.max(0,Math.min(100,Number(s.current_hp)/Number(s.max_hp)*100)):0;return `<article class="v151-beast-card"><h3><span>${esc(s.beast_name)}</span><span class="pill">${esc(STATUS[s.status]||s.status)}</span></h3><small>${N[s.direction]||s.direction}｜掉落 ${esc(s.material_name)}｜世代 ${s.generation}</small><div class="v151-beast-bar"><i style="width:${hp}%"></i></div><div class="small">血量 ${num(s.current_hp)} / ${num(s.max_hp)}｜位置 ${esc(s.coord||'—')}｜最後交戰 ${esc(s.last_combatant_name||'—')}</div><div class="v151-beast-fields"><input id="coord_${s.beast_key}" placeholder="座標或留空隨機" value="${esc(s.coord||'')}"><input id="hp_${s.beast_key}" type="number" value="${Number(s.max_hp)}" title="最大血量"><input id="atk_${s.beast_key}" type="number" value="${Number(s.attack_power)}" title="攻擊"><input id="def_${s.beast_key}" type="number" value="${Number(s.defense_power)}" title="防禦"></div><div class="v151-beast-actions"><button class="btn gold" data-place="${s.beast_key}">自由放置</button><button class="btn" data-stats="${s.beast_key}">更新數值</button><button class="btn jade" data-heal="${s.beast_key}">補滿血量</button><button class="btn red" data-withdraw="${s.beast_key}">撤離</button></div></article>`}).join('');
 document.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>place(b.dataset.place));document.querySelectorAll('[data-stats]').forEach(b=>b.onclick=()=>stats(b.dataset.stats));document.querySelectorAll('[data-heal]').forEach(b=>b.onclick=()=>heal(b.dataset.heal));document.querySelectorAll('[data-withdraw]').forEach(b=>b.onclick=()=>withdraw(b.dataset.withdraw));
}
async function place(k){try{await rpc('admin_divine_beast_place',{p_beast_key:k,p_coord:$('coord_'+k).value.trim()||null});notify('神獸已放置並推播全服');load()}catch(e){notify('放置失敗：'+(e.message||e))}}
async function stats(k){try{await rpc('admin_divine_beast_update_stats',{p_beast_key:k,p_max_hp:Number($('hp_'+k).value),p_attack_power:Number($('atk_'+k).value),p_defense_power:Number($('def_'+k).value)});notify('神獸數值已更新');load()}catch(e){notify('更新失敗：'+(e.message||e))}}
async function heal(k){try{await rpc('admin_divine_beast_heal',{p_beast_key:k});notify('神獸血量已補滿');load()}catch(e){notify('補血失敗：'+(e.message||e))}}
async function withdraw(k){if(!confirm('確定撤離這隻神獸？'))return;try{await rpc('admin_divine_beast_withdraw',{p_beast_key:k});notify('神獸已撤離');load()}catch(e){notify('撤離失敗：'+(e.message||e))}}
function renderEvents(rows){$('v151Events').innerHTML=rows.map(x=>`<div class="v151-event"><b>${esc(x.beast_key)}｜${esc(x.event_type)}</b><br>${esc(x.message||'')}<br><small>${new Date(x.created_at).toLocaleString('zh-TW')}</small></div>`).join('')||'<div class="small">尚無神獸事件。</div>'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});else ensure();
})();
