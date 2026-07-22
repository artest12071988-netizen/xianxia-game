(()=>{'use strict';
const VERSION='V14.8-CORPSE-WORLD-PHASE2';
const esc2=s=>typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function client(){return window.cloudState?.client||null}
async function createCorpse(aiId){const c=client();if(!c)return null;const {data,error}=await c.rpc('v148_create_cultivator_corpse',{p_cultivator_id:Number(aiId),p_killer_character_id:g?.characterId||null,p_killer_name:g?.name||'未知修士'});if(error)throw error;return data}
async function listHere(){const c=client();if(!c||!g?.pos)return[];const coord=String.fromCharCode(65+Number(g.pos.c))+'-'+(Number(g.pos.r)+1);const {data,error}=await c.rpc('v148_list_corpses_at_coord',{p_coord:coord});if(error)throw error;return Array.isArray(data)?data:[]}
async function take(corpseId,slot){const c=client();const {data,error}=await c.rpc('v148_loot_corpse',{p_corpse_id:corpseId,p_slot:Number(slot),p_character_id:g?.characterId||null,p_looter_name:g?.name||'未知修士'});if(error)throw error;const x=data;if(!x)return;
 if(x.kind==='stone')g.lingshi=(g.lingshi||0)+Number(x.qty||0);else if(x.kind==='equipment'){const e=normalizeEquipmentRecord?.({...x.data,uid:null,equipped:false},g.equipment.length);if(e)g.equipment.push(e)}else{const id=String(x.item_id||'');if(id&&IT[id])g.inv[id]=(g.inv[id]||0)+Number(x.qty||1)}
 saveGame?.(false);render?.();toast?.('已拾取 '+(x.label||'戰利品'));await search()}
function renderCorpseList(rows){let h='<h3>戰鬥痕跡</h3><p>這裡看起來曾經發生過一場激烈的戰鬥……</p>';if(!rows.length)h+='<p class="small">血跡已乾，沒有留下可搜刮之物。</p>';
 rows.forEach(r=>{const left=(r.loot||[]).filter(x=>!x.taken);h+='<div class="card"><b>'+esc2(r.source_name||'無名修士')+' 的屍體</b><small>剩餘 '+Number(r.remaining_count||0)+' 類物品｜約 '+Math.max(0,Math.ceil((new Date(r.expires_at)-Date.now())/3600000))+' 小時後消失</small>'+(left.length?left.map(x=>'<div class="list-row"><div class="grow"><strong>'+esc2(x.label)+'</strong></div><button class="btn" onclick="V148Corpse.take(\''+r.id+'\','+(r.loot||[]).indexOf(x)+')">拾取</button></div>').join(''):'<p class="small">屍體上已沒有值得取走的東西，顯然有人比你更早來過。</p>')+'</div>'});h+='<button class="btn" style="width:100%" onclick="closeOv()">離開</button>';sheet(h)}
async function search(){try{renderCorpseList(await listHere())}catch(e){toast?.('搜尋屍體失敗：'+e.message)}}
const previous=window.winFight;window.winFight=async function(){if(!fight||fight.kind==='monster')return previous?.();const f=fight;fight=null;closeOv();const a=ai.find(x=>x.id===f.aiId);try{if(cloudState.enabled){const {data,error}=await client().rpc('damage_world_cultivator',{p_cultivator_id:f.aiId,p_damage:1000000,p_cause:'遭 '+g.name+' 擊敗'});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row?.defeated){toast('對方已被其他修士先一步擊敗');await syncWorldCultivators(true);render();return}await createCorpse(f.aiId)}if(a){a.alive=false;a.hp=0;log('你擊敗修士 '+a.name+'。其屍體將在原地保留一天。','lg');gainExp(f.enemy.exp,false)}await syncWorldCultivators(true);render();await search()}catch(e){toast('戰果或屍體建立失敗：'+e.message);render()}};
const oldExplore=window.explore;window.explore=async function(){
 if(fight)return;if(g.mp<P.explore_stamina_cost){toast('精力不足');return}
 try{const rows=await listHere();const has=rows.some(r=>Number(r.remaining_count||0)>0);if(has&&Math.random()<0.65){stopMeditate('搜索戰場');g.mp-=P.explore_stamina_cost;log('你在附近察覺到殘留的血氣與破碎法器。','lg');render();return renderCorpseList(rows)}}catch(_){}
 return oldExplore?.();
};
const oldMove=window.moveTo;window.moveTo=function(r,c){const before=g?.pos?g.pos.r+'-'+g.pos.c:'';const out=oldMove?.(r,c);setTimeout(async()=>{try{if(!g?.pos||before===g.pos.r+'-'+g.pos.c)return;const rows=await listHere();if(rows.some(x=>Number(x.remaining_count||0)>0)){log('你抵達此地後，察覺附近殘留著激烈鬥法的痕跡。可透過探索搜尋屍體。','lg');render?.()}}catch(_){}},650);return out};
const oldMaint=window.runWorldMaintenance;window.runWorldMaintenance=async function(){const r=await oldMaint?.();try{await client()?.rpc('v148_world_corpse_maintenance')}catch(_){}return r};
window.V148Corpse={version:VERSION,search,take};window.searchBattlefieldV148=search;
})();
