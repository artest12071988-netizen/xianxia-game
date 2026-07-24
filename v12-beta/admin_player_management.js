/* 修仙大逃殺 V14.7｜玩家管理與卡點救援 */
(function(){
'use strict';
const S={selected:null,rows:[],items:[]};
const LEGACY_ARTIFACT_ITEM_IDS=new Set(['8420','8421','8422','8423','8424']);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function msg(t){if(typeof window.toast==='function')window.toast(t);else alert(t)}
function cardHtml(){return `<section class="card" id="playerAdminCard"><h2>玩家管理與卡點救援</h2>
<div class="notice">僅供客服救援。所有移動、物品與資產調整都會留下操作紀錄；永久死亡角色不會被一鍵救援復活。</div>
<div class="player-admin-search" style="margin-top:12px"><input id="playerSearchInput" placeholder="輸入 Email、道號或玩家 UUID"><button class="btn jade" id="playerSearchBtn">搜尋玩家</button></div>
<div id="playerSearchResults" class="player-admin-results"></div>
<div id="playerAdminPanel" class="player-admin-panel">
<div class="status player-summary"><div><span>玩家</span><b id="paName">-</b></div><div><span>Email</span><b id="paEmail">-</b></div><div><span>位置</span><b id="paCoord">-</b></div><div><span>境界</span><b id="paRealm">-</b></div><div><span>等級</span><b id="paLevel">-</b></div><div><span>靈石</span><b id="paLingshi">-</b></div><div><span>元寶</span><b id="paYuanbao">-</b></div><div><span>狀態</span><b id="paAlive">-</b></div></div>
<div class="player-actions-grid">
<div class="player-action-box"><h3>卡點救援與移動</h3><div class="field"><label>目標座標</label><input id="paMoveCoord" value="A-1" placeholder="例如 A-1、E-5"></div><div class="field"><label>操作原因</label><input id="paMoveReason" value="玩家回報卡點"></div><div class="row" style="margin-top:10px"><button class="btn jade" id="paMoveBtn">移動玩家</button><button class="btn red" id="paUnstuckBtn">一鍵解除卡點</button></div></div>
<div class="player-action-box"><h3>增減背包物品</h3><div class="field"><label>搜尋物品</label><input id="paItemSearch" placeholder="輸入物品名稱或 ID"></div><div class="grid" style="margin-top:8px"><div class="field"><label>選擇物品</label><select id="paItemId"><option value="">載入正式物品中…</option></select></div><div class="field"><label>增減數量</label><input id="paItemDelta" type="number" value="1"></div></div><div class="field" style="margin-top:8px"><label>操作原因</label><input id="paItemReason" value="客服補發或移除異常物品"></div><button class="btn gold" id="paItemBtn" style="width:100%;margin-top:10px">套用物品調整</button></div>
<div class="player-action-box"><h3>增減靈石／元寶</h3><div class="grid"><div class="field"><label>資產</label><select id="paResource"><option value="lingshi">靈石</option><option value="yuanbao">元寶</option></select></div><div class="field"><label>增減數量</label><input id="paResourceDelta" type="number" value="0"></div></div><div class="field" style="margin-top:8px"><label>操作原因</label><input id="paResourceReason" value="客服資產修正"></div><button class="btn red" id="paResourceBtn" style="width:100%;margin-top:10px">套用資產調整</button></div>
<div class="player-action-box"><h3>帳號協助</h3><p class="small">系統不顯示原密碼。按下後寄送 Supabase 密碼重設信給玩家。</p><button class="btn jade" id="paResetPasswordBtn" style="width:100%">寄送密碼重設信</button><h3 style="margin-top:16px">最近管理紀錄</h3><div id="paLogs" class="player-log"></div></div>
</div></div></section>`}
function inject(){const main=$('adminMain');if(!main||$('playerAdminCard'))return;main.insertAdjacentHTML('beforeend',cardHtml());bind()}
function bind(){
 loadFormalItems();
 $('playerSearchBtn').onclick=search;$('playerSearchInput').addEventListener('keydown',e=>{if(e.key==='Enter')search()});
 $('paMoveBtn').onclick=()=>act('admin_player_move',{p_user_id:S.selected.user_id,p_coord:$('paMoveCoord').value,p_reason:$('paMoveReason').value},'玩家已移動');
 $('paUnstuckBtn').onclick=()=>{if(confirm('確定將玩家移至 A-1 並清除打坐與狀態資料？'))act('admin_player_unstuck',{p_user_id:S.selected.user_id,p_reason:$('paMoveReason').value},'卡點已解除')};
 $('paItemSearch').addEventListener('input',renderItemOptions);
 $('paItemBtn').onclick=()=>{const itemId=$('paItemId').value;if(!itemId)return msg('請先選擇物品');act('admin_player_adjust_item',{p_user_id:S.selected.user_id,p_item_id:itemId,p_delta:Number($('paItemDelta').value),p_reason:$('paItemReason').value},'物品補發已排入，玩家在線時會自動入帳')};
 $('paResourceBtn').onclick=()=>{const r=$('paResource').value,d=Number($('paResourceDelta').value);if(r==='yuanbao'&&!confirm('元寶是永久帳號資產，確定調整？'))return;act('admin_player_adjust_resource',{p_user_id:S.selected.user_id,p_resource:r,p_delta:d,p_reason:$('paResourceReason').value},'資產補發已排入，玩家在線時會自動入帳')};
 $('paResetPasswordBtn').onclick=resetPassword;
}

async function loadFormalItems(){
  const select=$('paItemId');
  try{
    const client=window.sb||window.xianxiaAdminSupabase;
    if(!client)throw new Error('Supabase 尚未連線');
    const {data,error}=await client.rpc('get_published_game_config');
    if(error)throw error;
    const items=data?.config?.items||data?.items||{};
    const supplementalItems={
      '8301':{name:'庚精',cat:'強化石'},
      '8501':{name:'赤陽器紋砂',cat:'器紋材料'},
      '8502':{name:'玄甲器紋砂',cat:'器紋材料'},
      '8503':{name:'雷鳴器紋砂',cat:'器紋材料'},
      '8504':{name:'長生器紋砂',cat:'器紋材料'},
      '8505':{name:'靈泉器紋砂',cat:'器紋材料'},
      '8410':{name:'淬器石',cat:'淬鍊材料'},
      '8411':{name:'保護符',cat:'保護材料'},
      '8412':{name:'天工石',cat:'增幅材料'},
      '8413':{name:'洗鍊石',cat:'洗鍊材料'}
    };
    const merged={...items};
    for(const legacyId of LEGACY_ARTIFACT_ITEM_IDS)delete merged[legacyId];
    for(const [id,it] of Object.entries(supplementalItems))merged[id]={...(merged[id]||{}),...it};
    S.items=Object.entries(merged).map(([id,it])=>({id:String(id),name:String(it?.name||id),cat:String(it?.cat||it?.type||'')})).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
    renderItemOptions();
  }catch(e){select.innerHTML='<option value="">物品載入失敗</option>';msg('正式物品載入失敗：'+e.message)}
}
function renderItemOptions(){
  const select=$('paItemId');if(!select)return;
  const q=($('paItemSearch')?.value||'').trim().toLowerCase();
  const current=select.value;
  const rows=S.items.filter(x=>!q||x.id.toLowerCase().includes(q)||x.name.toLowerCase().includes(q)||x.cat.toLowerCase().includes(q));
  select.innerHTML='<option value="">請選擇物品</option>'+rows.slice(0,300).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}｜${esc(x.id)}${x.cat?'｜'+esc(x.cat):''}</option>`).join('');
  if(rows.some(x=>x.id===current))select.value=current;
}

async function search(){const q=$('playerSearchInput').value.trim();$('playerSearchResults').innerHTML='搜尋中…';const {data,error}=await window.sb.rpc('admin_player_search',{p_query:q});if(error){$('playerSearchResults').innerHTML='';return msg('搜尋失敗：'+error.message)}S.rows=data||[];renderResults()}
function renderResults(){const box=$('playerSearchResults');if(!S.rows.length){box.innerHTML='<div class="notice">找不到玩家。</div>';return}box.innerHTML=S.rows.map((r,i)=>`<button type="button" class="player-row btn" data-i="${i}"><span><b>${esc(r.player_name)}</b><small>${esc(r.email)}｜${esc(r.coord)}｜${esc(r.realm)} Lv.${r.level}</small></span><span>選取</span></button>`).join('');box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>select(Number(b.dataset.i)))}
function select(i){S.selected=S.rows[i];document.querySelectorAll('.player-row').forEach((b,j)=>b.classList.toggle('active',j===i));$('playerAdminPanel').classList.add('on');fill();loadLogs()}
function fill(){const r=S.selected;if(!r)return;$('paName').textContent=r.player_name;$('paEmail').textContent=r.email;$('paCoord').textContent=r.coord;$('paRealm').textContent=r.realm;$('paLevel').textContent=r.level;$('paLingshi').textContent=r.lingshi;$('paYuanbao').textContent=r.yuanbao;$('paAlive').textContent=r.alive?'存活':'死亡鎖定';$('paMoveCoord').value=r.coord||'A-1'}
async function act(fn,args,ok){if(!S.selected)return msg('請先選擇玩家');const {error}=await window.sb.rpc(fn,args);if(error)return msg('操作失敗：'+error.message);msg(ok);await search();const idx=S.rows.findIndex(x=>x.user_id===S.selected.user_id);if(idx>=0)select(idx)}
async function resetPassword(){if(!S.selected)return msg('請先選擇玩家');if(!confirm('寄送密碼重設信給 '+S.selected.email+'？'))return;const {error}=await window.sb.auth.resetPasswordForEmail(S.selected.email,{redirectTo:location.origin+location.pathname.replace(/admin\.html.*$/,'')});if(error)return msg('寄送失敗：'+error.message);msg('密碼重設信已寄出')}
async function loadLogs(){const {data,error}=await window.sb.rpc('admin_player_logs',{p_user_id:S.selected.user_id,p_limit:30});if(error){$('paLogs').textContent='讀取失敗：'+error.message;return}$('paLogs').innerHTML=(data||[]).map(x=>`<div class="player-log-row"><b>${esc(x.action)}</b><br>${new Date(x.created_at).toLocaleString('zh-TW')}｜${esc(x.reason||'')}</div>`).join('')||'尚無紀錄'}
const mo=new MutationObserver(()=>inject());if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{inject();mo.observe(document.body,{childList:true,subtree:true})});else{inject();mo.observe(document.body,{childList:true,subtree:true})}
})();
