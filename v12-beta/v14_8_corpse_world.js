(()=>{'use strict';
const VERSION='V15.3-PHASE2-CORPSE-CLOUD-BRIDGE';
const esc2=s=>typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function cloud(){
 try{if(typeof cloudState!=='undefined'&&cloudState){window.cloudState=cloudState;window.xianxiaCloudState=cloudState;return cloudState}}catch(_){}
 return window.cloudState||window.xianxiaCloudState||null
}
function client(){return cloud()?.client||null}
async function waitClient(timeout=5000){
 const started=Date.now();let c=client();
 while(!c&&Date.now()-started<timeout){await new Promise(r=>setTimeout(r,120));c=client()}
 return c
}
async function createCorpse(aiId){const c=await waitClient();if(!c)throw new Error('雲端客戶端尚未完成初始化');const {data,error}=await c.rpc('v148_create_cultivator_corpse',{p_cultivator_id:Number(aiId),p_killer_character_id:g?.characterId||null,p_killer_name:g?.name||'未知修士'});if(error)throw error;return data}
async function listHere(){const c=await waitClient(1500);if(!c||!g?.pos)return[];const coord=String.fromCharCode(65+Number(g.pos.c))+'-'+(Number(g.pos.r)+1);const {data,error}=await c.rpc('v148_list_corpses_at_coord',{p_coord:coord});if(error)throw error;return Array.isArray(data)?data:[]}
async function take(corpseId,slot){const c=await waitClient();if(!c)throw new Error('雲端客戶端尚未完成初始化');const {data,error}=await c.rpc('v148_loot_corpse',{p_corpse_id:corpseId,p_slot:Number(slot),p_character_id:g?.characterId||null,p_looter_name:g?.name||'未知修士'});if(error)throw error;const x=data;if(!x)return;
 if(x.kind==='stone')g.lingshi=(g.lingshi||0)+Number(x.qty||0);else if(x.kind==='equipment'){const e=normalizeEquipmentRecord?.({...x.data,uid:null,equipped:false},g.equipment.length);if(e)g.equipment.push(e)}else{const id=String(x.item_id||'');if(id&&IT[id])g.inv[id]=(g.inv[id]||0)+Number(x.qty||1)}
 saveGame?.(false);render?.();toast?.('已拾取 '+(x.label||'戰利品'));await search()}
function renderCorpseList(rows){let h='<h3>戰鬥痕跡</h3><p>這裡看起來曾經發生過一場激烈的戰鬥……</p>';if(!rows.length)h+='<p class="small">血跡已乾，沒有留下可搜刮之物。</p>';
 rows.forEach(r=>{const left=(r.loot||[]).filter(x=>!x.taken);h+='<div class="card"><b>'+esc2(r.source_name||'無名修士')+' 的屍體</b><small>剩餘 '+Number(r.remaining_count||0)+' 類物品｜約 '+Math.max(0,Math.ceil((new Date(r.expires_at)-Date.now())/3600000))+' 小時後消失</small>'+(left.length?left.map(x=>'<div class="list-row"><div class="grow"><strong>'+esc2(x.label)+'</strong></div><button class="btn" onclick="V148Corpse.take(\''+r.id+'\','+(r.loot||[]).indexOf(x)+')">拾取</button></div>').join(''):'<p class="small">屍體上已沒有值得取走的東西，顯然有人比你更早來過。</p>')+'</div>'});h+='<button class="btn" style="width:100%" onclick="closeOv()">離開</button>';sheet(h)}
async function search(){try{renderCorpseList(await listHere())}catch(e){toast?.('搜尋屍體失敗：'+e.message)}}
let pendingSettlement=null;
const previous=window.winFight;
async function settleCultivatorFight(f){
 const cs=cloud(),a=ai.find(x=>x.id===f.aiId);
 if(cs?.enabled){
   const c=await waitClient();if(!c)throw new Error('雲端連線尚未完成，無法建立屍體');
   const {error}=await c.rpc('damage_world_cultivator',{p_cultivator_id:f.aiId,p_damage:1000000,p_cause:'遭 '+g.name+' 擊敗'});if(error)throw error;
   await createCorpse(f.aiId);
 }
 if(a){a.alive=false;a.hp=0;log('你擊敗修士 '+a.name+'。其屍體將在原地保留一天。','lg');gainExp(f.enemy.exp,false)}
 pendingSettlement=null;
 try{await syncWorldCultivators(true)}catch(e){console.warn('[V148Corpse] sync after kill failed',e)}
 render();await search();
}
async function retrySettlement(){
 if(!pendingSettlement){toast?.('目前沒有待補建的屍體');return}
 closeOv();
 try{await settleCultivatorFight(pendingSettlement)}catch(e){toast?.('屍體補建失敗：'+e.message);renderRetry(e)}
}
function renderRetry(error){
 sheet('<h3>戰果等待雲端結算</h3><p class="small">修士已在本地戰鬥中被擊敗，但雲端屍體尚未建立。</p><div class="notice">'+esc2(error?.message||error)+'</div><button class="btn gold" style="width:100%" onclick="V148Corpse.retry()">重新建立屍體</button><button class="btn" style="width:100%;margin-top:8px" onclick="closeOv()">稍後再試</button>');
}
window.winFight=async function(){
 if(!fight||fight.kind==='monster')return previous?.();
 const f=fight;fight=null;closeOv();pendingSettlement=f;
 try{await settleCultivatorFight(f)}catch(e){toast?.('戰果或屍體建立失敗：'+e.message);renderRetry(e);render()}
};
const oldExplore=window.explore;window.explore=async function(){
 if(fight)return;if(g.mp<P.explore_stamina_cost){toast('精力不足');return}
 try{const rows=await listHere();const has=rows.some(r=>Number(r.remaining_count||0)>0);if(has&&Math.random()<0.65){stopMeditate('搜索戰場');g.mp-=P.explore_stamina_cost;log('你在附近察覺到殘留的血氣與破碎法器。','lg');render();return renderCorpseList(rows)}}catch(_){}
 return oldExplore?.();
};
const oldMove=window.moveTo;window.moveTo=function(r,c){const before=g?.pos?g.pos.r+'-'+g.pos.c:'';const out=oldMove?.(r,c);setTimeout(async()=>{try{if(!g?.pos||before===g.pos.r+'-'+g.pos.c)return;const rows=await listHere();if(rows.some(x=>Number(x.remaining_count||0)>0)){log('你抵達此地後，察覺附近殘留著激烈鬥法的痕跡。可透過探索搜尋屍體。','lg');render?.()}}catch(_){}},650);return out};
const oldMaint=window.runWorldMaintenance;window.runWorldMaintenance=async function(){const r=await oldMaint?.();try{const c=await waitClient(1200);if(c)await c.rpc('v148_world_corpse_maintenance')}catch(_){}return r};
window.V148Corpse={version:VERSION,search,take,retry:retrySettlement,cloud:()=>({enabled:!!cloud()?.enabled,hasClient:!!client(),hasUser:!!cloud()?.user})};window.searchBattlefieldV148=search;
})();
