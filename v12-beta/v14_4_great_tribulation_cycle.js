/* V14.4 FIX4D — 大天劫伺服器週期橋接 */
(function(){
'use strict';
if(window.__V144TribulationCycleLoaded)return;window.__V144TribulationCycleLoaded=true;
const get=n=>{try{return Function('return typeof '+n+'!=="undefined"?'+n+':null')()}catch(_){return null}};
const client=()=>window.cloudState?.client||get('cloudState')?.client||null;
let lastActive=null,lastEnds=null,busy=false;
function fmt(ms){if(ms<=0)return'即將結束';const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h+'時'+String(m).padStart(2,'0')+'分';}
function updateBadge(row){const b=document.getElementById('greatTribulationEffectBadge');if(!b||!row)return;const span=b.querySelector('span:last-child');if(row.great_tribulation_active&&row.great_tribulation_ends_at){span.textContent='古魔入侵・剩餘 '+fmt(new Date(row.great_tribulation_ends_at)-Date.now());}else if(row.great_tribulation_cooldown_until&&new Date(row.great_tribulation_cooldown_until)>Date.now()){span.textContent='冷卻中・剩餘 '+fmt(new Date(row.great_tribulation_cooldown_until)-Date.now());}}
function announce(row){const log=get('log'),toast=get('toast');if(lastActive!==null&&lastActive!==!!row.great_tribulation_active){const t=row.great_tribulation_active?'魔界裂隙洞開，大天劫降臨！':'仙人下凡封閉魔界裂隙，大天劫結束。';try{if(typeof log==='function')log(t,row.great_tribulation_active?'ld':'lg');if(typeof toast==='function')toast(t)}catch(_){}}lastActive=!!row.great_tribulation_active;lastEnds=row.great_tribulation_ends_at||null;}
async function tick(){const sb=client();if(!sb||busy)return;busy=true;try{const {data,error}=await sb.rpc('great_tribulation_tick');if(error){console.warn('[FIX4D tick]',error.message);return;}const row=Array.isArray(data)?data[0]:data;if(row){if(window.cloudState)window.cloudState.worldControls=row;announce(row);updateBadge(row);}}finally{busy=false;}}
setInterval(()=>{const row=window.cloudState?.worldControls||get('cloudState')?.worldControls;updateBadge(row);},1000);
setInterval(tick,60000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(tick,1500));else setTimeout(tick,1500);
window.V14GreatTribulationCycle={tick};
})();
