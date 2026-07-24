(()=>{
'use strict';
const BUILD='V15.4-ARTIFACT-FUNCTION-AUTHORITY-FIX4-20260724';
const MATS={
 '8501':{name:'赤陽器紋砂',cat:'器紋材料',stat:'atk_pct',label:'攻擊',min:3,max:8},
 '8502':{name:'玄甲器紋砂',cat:'器紋材料',stat:'def_pct',label:'防禦',min:3,max:8},
 '8503':{name:'雷鳴器紋砂',cat:'器紋材料',stat:'crit_pct',label:'暴擊',min:2,max:6},
 '8504':{name:'長生器紋砂',cat:'器紋材料',stat:'hp_pct',label:'體力',min:4,max:10},
 '8505':{name:'靈泉器紋砂',cat:'器紋材料',stat:'spirit_pct',label:'精力',min:3,max:8},
 '8301':{name:'庚金',cat:'強化材料'},
 '8410':{name:'淬器石',cat:'保階材料'},
 '8411':{name:'護器符',cat:'保護材料'},
 '8412':{name:'天工石',cat:'增幅材料'},
 '8413':{name:'洗煉石',cat:'洗煉材料'}
};
const LEGACY_SAND={'8501':'8401','8502':'8402','8503':'8403','8504':'8404','8505':'8405'};
const q=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=s=>[...String(s)].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,2166136261);
const rand=(a,b)=>Math.round((a+Math.random()*(b-a))*10)/10;
function ready(){return !!(window.g&&window.IT)}
function registerItems(){
 if(!window.IT)return;
 for(const [id,m] of Object.entries(MATS)){
  const old=window.IT[id]||{};
  window.IT[id]={...old,...m,eff:m.stat?'刻印器紋':(old.eff||m.cat),val:Number(old.val||0),detail:m.stat?`${m.label}器紋 ${m.min}%～${m.max}%`:(old.detail||m.name)};
 }
}
function legacyIsSameSand(canon){
 const legacy=LEGACY_SAND[canon], item=window.IT?.[legacy];
 return !!(item&&String(item.name||'').includes('器紋砂'));
}
function sandCount(id){
 const inv=window.g?.inv||{};
 let n=Math.max(0,Number(inv[id])||0);
 const legacy=LEGACY_SAND[id];
 if(legacyIsSameSand(id))n+=Math.max(0,Number(inv[legacy])||0);
 return Math.floor(n);
}
function consumeSand(id){
 const inv=window.g.inv||(window.g.inv={});
 if(Number(inv[id])>0){inv[id]--;return true;}
 const legacy=LEGACY_SAND[id];
 if(legacyIsSameSand(id)&&Number(inv[legacy])>0){inv[legacy]--;return true;}
 return false;
}
function normalize(e){
 if(!e||typeof e!=='object')return e;
 if(!Number.isInteger(e.inscriptionCapacity))e.inscriptionCapacity=hash(e.uid||e.name)%4;
 e.inscriptionCapacity=Math.max(0,Math.min(3,e.inscriptionCapacity));
 if(!Array.isArray(e.inscriptions))e.inscriptions=[];
 e.inscriptions=e.inscriptions.slice(0,e.inscriptionCapacity).filter(x=>x&&x.stat&&Number.isFinite(Number(x.value))).map(x=>({stat:x.stat,label:x.label||x.stat,value:Number(x.value)}));
 if(!Number.isFinite(Number(e.temperLevel)))e.temperLevel=Number(e.enhance||0);
 e.temperLevel=Math.max(0,Math.floor(Number(e.temperLevel)||0));
 e.enhance=e.temperLevel;
 return e;
}
function migrate(){
 if(!ready())return;
 registerItems();
 window.g.inv=window.g.inv||{};
 window.g.equipment=window.g.equipment||[];
 window.g.equipment.forEach(normalize);
 // 8301 庚金為正式強化材料，永不轉換、刪除或併入其他材料。
}
function sumStat(stat){migrate();return (window.g?.equipment||[]).filter(e=>e.uid===window.g.weaponUid||e.uid===window.g.armorUid).flatMap(e=>e.inscriptions||[]).filter(x=>x.stat===stat).reduce((a,x)=>a+Number(x.value||0),0)}
function capText(e){return '★'.repeat(e.inscriptionCapacity)+'☆'.repeat(3-e.inscriptionCapacity)}
function lineText(x){return `${x.label} +${Number(x.value).toFixed(1)}%`}
function eqCard(e){
 normalize(e);
 const lines=e.inscriptions.map((x,i)=>`<div class="v143-line"><span>第 ${i+1} 紋</span><b>${esc(lineText(x))}</b></div>`).join('');
 const empties=Math.max(0,e.inscriptionCapacity-e.inscriptions.length);
 return `<article class="v143-card"><h4>${esc(e.name)} +${e.temperLevel}</h4><small>${esc(e.cat)}｜器紋容量 <span class="v143-cap">${capText(e)}</span></small><div class="v143-lines">${lines}${Array.from({length:empties},(_,i)=>`<div class="v143-line"><span>第 ${e.inscriptions.length+i+1} 紋</span><span class="v143-empty">未刻印</span></div>`).join('')}${e.inscriptionCapacity===0?'<div class="v143-line"><span>此器胚無天然器紋</span><span class="v143-empty">可交易或收藏</span></div>':''}</div><div class="v143-actions"><button class="btn jade" data-v143-inscribe="${esc(e.uid)}" ${empties?'':'disabled'}>刻印</button><button class="btn" data-v143-reforge="${esc(e.uid)}" ${e.inscriptions.length?'':'disabled'}>洗煉</button><button class="btn gold" data-v143-temper="${esc(e.uid)}" ${e.inscriptions.length===e.inscriptionCapacity&&e.inscriptionCapacity>0?'':'disabled'}>強化</button></div></article>`;
}
function render(){
 migrate();const root=q('v143Root');if(!root)return;const eq=window.g.equipment||[];
 root.innerHTML=`<div class="v143-shell"><div class="v143-head"><div><div class="v143-title">天工器紋閣</div><small>器紋砂依裝備洞數刻印；庚金用於裝備 +1、+2……強化。</small></div><span class="pill">${BUILD}</span></div><div class="v143-note">器紋砂：刻印器紋｜洗煉石：重抽器紋數值｜庚金：裝備強化｜護器符：防止強化失敗時裝備消失｜淬器石：防止強化失敗時等級倒退。五行附魔及神獸掉落材料維持原系統，不在本模組更動。</div><div class="v143-grid">${eq.length?eq.map(eqCard).join(''):'<div class="v143-empty">目前沒有可處理的法寶或防具。</div>'}</div><button class="btn" id="v143Close">關閉</button></div>`;bind();
}
function bind(){document.querySelectorAll('[data-v143-inscribe]').forEach(b=>b.addEventListener('click',()=>chooseInscribe(b.dataset.v143Inscribe)));document.querySelectorAll('[data-v143-reforge]').forEach(b=>b.addEventListener('click',()=>chooseReforge(b.dataset.v143Reforge)));document.querySelectorAll('[data-v143-temper]').forEach(b=>b.addEventListener('click',()=>temper(b.dataset.v143Temper)));q('v143Close')?.addEventListener('click',()=>window.closeOv?.())}
function open(){if(!ready()){window.toast?.('角色資料尚未載入');return}migrate();window.sheet?.('<div id="v143Root"></div>');render()}
function findEq(uid){migrate();return window.g.equipment.find(e=>String(e.uid)===String(uid))}
function chooseInscribe(uid){
 const e=findEq(uid);if(!e||e.inscriptions.length>=e.inscriptionCapacity)return;
 const opts=Object.entries(MATS).filter(([,m])=>m.stat).map(([id,m])=>{const n=sandCount(id);return `<option value="${id}" ${n>0?'':'disabled'}>${esc(m.name)} ×${n}｜${m.label} ${m.min}～${m.max}%</option>`}).join('');
 window.sheet?.(`<h3>刻印器紋｜${esc(e.name)}</h3><div class="v143-note">刻印成功率固定 100%，每次消耗 1 份器紋砂；可刻印數量由裝備器紋容量決定。</div><label>器紋材料<select id="v143Mat" class="v143-select">${opts}</select></label><div class="v143-actions"><button class="btn gold" id="v143DoInscribe">確認刻印</button><button class="btn" id="v143Back">返回</button></div>`);
 q('v143DoInscribe')?.addEventListener('click',()=>inscribe(uid,q('v143Mat')?.value));q('v143Back')?.addEventListener('click',open);
}
function inscribe(uid,id){
 const e=findEq(uid),m=MATS[id];
 if(!e||!m?.stat||sandCount(id)<1||e.inscriptions.length>=e.inscriptionCapacity){window.toast?.('材料不足或器紋已滿');return}
 if(!consumeSand(id)){window.toast?.('器紋砂不足');return}
 e.inscriptions.push({stat:m.stat,label:m.label,value:rand(m.min,m.max)});
 window.log?.(`${e.name} 成功刻印「${lineText(e.inscriptions.at(-1))}」。`,'lg');
 Promise.resolve(window.saveGame?.(false)).catch(()=>{});open();window.render?.();
}
function chooseReforge(uid){const e=findEq(uid);if(!e||!e.inscriptions.length)return;if(!(window.g.inv['8413']>0)){window.toast?.('洗煉石不足');return}const opts=e.inscriptions.map((x,i)=>`<option value="${i}">第 ${i+1} 紋｜${esc(lineText(x))}</option>`).join('');window.sheet?.(`<h3>洗煉器紋｜${esc(e.name)}</h3><div class="v143-note">消耗 1 顆洗煉石，只重抽指定器紋的數值，不改變屬性種類。</div><label>選擇器紋<select id="v143Line" class="v143-select">${opts}</select></label><div class="v143-actions"><button class="btn gold" id="v143DoReforge">確認洗煉</button><button class="btn" id="v143Back">返回</button></div>`);q('v143DoReforge')?.addEventListener('click',()=>reforge(uid,Number(q('v143Line')?.value)));q('v143Back')?.addEventListener('click',open)}
function reforge(uid,i){const e=findEq(uid),x=e?.inscriptions?.[i],m=Object.values(MATS).find(v=>v.stat===x?.stat);if(!e||!x||!m||!(window.g.inv['8413']>0))return;window.g.inv['8413']--;const old=x.value;x.value=rand(m.min,m.max);window.log?.(`${e.name} 洗煉完成：${x.label} ${old}% → ${x.value}%。`,'lg');Promise.resolve(window.saveGame?.(false)).catch(()=>{});open();window.render?.()}
function temperRate(level){return Math.max(.05,level<3?1:level<6?.65:Math.pow(.72,level-5)*.45)}
function temper(uid){
 const e=findEq(uid);if(!e||e.inscriptionCapacity===0||e.inscriptions.length!==e.inscriptionCapacity)return;
 if(!(Number(window.g.inv['8301'])>0)){window.toast?.('庚金不足');return}
 const useGuard=Number(window.g.inv['8411'])>0&&confirm('是否消耗 1 張護器符？強化失敗時可防止裝備直接消失。');
 const useKeep=Number(window.g.inv['8410'])>0&&confirm('是否消耗 1 顆淬器石？強化失敗時可防止強化等級倒退。');
 const useBoost=Number(window.g.inv['8412'])>0&&confirm('是否消耗 1 顆天工石？本次成功率提高 15%。');
 let rate=Math.min(.95,temperRate(e.temperLevel)+(useBoost?.15:0));
 const failText=`${useGuard?'護器符保護裝備。':'未使用護器符，失敗時裝備可能消失。'}${useKeep?' 淬器石保護強化等級。':' 未使用淬器石，裝備保住時強化等級可能倒退。'}`;
 if(!confirm(`本次強化成功率 ${Math.round(rate*100)}%。${failText} 是否繼續？`))return;
 window.g.inv['8301']--;
 if(useGuard)window.g.inv['8411']--;
 if(useKeep)window.g.inv['8410']--;
 if(useBoost)window.g.inv['8412']--;
 if(Math.random()<rate){
  e.temperLevel++;e.enhance=e.temperLevel;window.log?.(`${e.name} 強化成功，達到 +${e.temperLevel}。`,'lg');
 }else if(!useGuard){
  window.g.equipment=window.g.equipment.filter(x=>x.uid!==uid);if(window.g.weaponUid===uid)window.g.weaponUid=null;if(window.g.armorUid===uid)window.g.armorUid=null;window.log?.(`${e.name} 強化失敗，裝備徹底損毀。`,'ld');
 }else{
  if(!useKeep&&e.temperLevel>0){e.temperLevel--;e.enhance=e.temperLevel;window.log?.(`${e.name} 強化失敗，護器符保住裝備，但強化等級降至 +${e.temperLevel}。`,'la');}
  else window.log?.(`${e.name} 強化失敗，裝備與強化等級均已保住。`,'la');
 }
 Promise.resolve(window.saveGame?.(false)).catch(()=>{});open();window.render?.();
}
function patch(){
 if(window.__V143_PATCHED||!ready())return false;window.__V143_PATCHED=true;registerItems();migrate();
 const oldNew=window.newEquipment;if(typeof oldNew==='function')window.newEquipment=function(itemId,enhance=0){const e=oldNew(itemId,enhance);e.inscriptionCapacity=Math.floor(Math.random()*4);e.inscriptions=[];e.temperLevel=Number(enhance||0);return normalize(e)};
 const oldAtk=window.pAtk;if(typeof oldAtk==='function')window.pAtk=function(){return Math.round(oldAtk()*(1+sumStat('atk_pct')/100))};
 const oldDef=window.pDef;if(typeof oldDef==='function')window.pDef=function(){return Math.round(oldDef()*(1+sumStat('def_pct')/100))};
 const oldAttack=window.attackTurn;if(typeof oldAttack==='function')window.attackTurn=function(){const oldRate=window.P?.base_crit_rate;try{if(window.P)window.P.base_crit_rate=Number(oldRate||0)+sumStat('crit_pct')/100;return oldAttack.apply(this,arguments)}finally{if(window.P)window.P.base_crit_rate=oldRate}};
 const oldWin=window.winFight;if(typeof oldWin==='function')window.winFight=function(){const r=oldWin.apply(this,arguments);setTimeout(()=>{if(!window.g)return;const pool=['8501','8502','8503','8504','8505','8410','8413'];if(Math.random()<.22){const id=pool[Math.floor(Math.random()*pool.length)];window.g.inv[id]=(window.g.inv[id]||0)+1;window.log?.(`妖獸殘骸中發現 ${MATS[id].name}。`,'lg');Promise.resolve(window.saveGame?.(false)).catch(()=>{});window.render?.()}},60);return r};
 const oldOpenBag=window.openBag;if(typeof oldOpenBag==='function')window.openBag=function(tab='bag'){if(tab==='forge')return open();return oldOpenBag.apply(this,arguments)};
 window.enhanceItem=function(uid){open();setTimeout(()=>{document.querySelector(`[data-v143-temper="${CSS.escape(String(uid))}"]`)?.scrollIntoView({block:'center'})},40)};
 return true;
}
function mount(){if(q('v143Launch'))return;const b=document.createElement('button');b.id='v143Launch';b.className='v143-launch';b.type='button';b.textContent='天工器紋';b.addEventListener('click',open);document.body.appendChild(b)}
window.openArtifactWorkshopV143=open;window.V14_ARTIFACT_BUILD=BUILD;
let tries=0;const t=setInterval(()=>{tries++;if(patch()){mount();clearInterval(t)}else if(tries>80)clearInterval(t)},250);
console.info('[V15.4 ARTIFACT FUNCTION AUTHORITY FIX4] loaded',{build:BUILD});
})();
