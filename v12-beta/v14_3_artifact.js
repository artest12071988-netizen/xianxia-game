(()=>{
'use strict';
if(window.__V143ArtifactCompatFix3Loaded)return;
window.__V143ArtifactCompatFix3Loaded=true;

const BUILD='V14.5A-FIX3-ARTIFACT-20260721';
const MATS={
 '8401':{name:'赤陽器紋砂',cat:'器紋材料',stat:'atk_pct',label:'攻擊',min:3,max:8},
 '8402':{name:'玄甲器紋砂',cat:'器紋材料',stat:'def_pct',label:'防禦',min:3,max:8},
 '8403':{name:'雷鳴器紋砂',cat:'器紋材料',stat:'crit_pct',label:'暴擊',min:2,max:6},
 '8404':{name:'長生器紋砂',cat:'器紋材料',stat:'hp_pct',label:'體力',min:4,max:10},
 '8405':{name:'靈泉器紋砂',cat:'器紋材料',stat:'spirit_pct',label:'精力',min:3,max:8},
 '8410':{name:'淬器石',cat:'淬鍊材料'},
 '8411':{name:'護器符',cat:'護器材料'},
 '8412':{name:'天工石',cat:'增幅材料'},
 '8413':{name:'洗煉石',cat:'洗煉材料'}
};

const q=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=s=>[...String(s)].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,2166136261);
const rand=(a,b)=>Math.round((a+Math.random()*(b-a))*10)/10;

function readGlobal(name){
  try{return Function(`return typeof ${name}!=="undefined"?${name}:null`)()}
  catch(_){try{return window[name]??null}catch(__){return null}}
}
function writeGlobal(name,value){
  let ok=false;
  try{Function('value',`${name}=value`)(value);ok=true}catch(_){}
  try{window[name]=value;ok=true}catch(_){}
  return ok;
}
function fn(name){const value=window[name]||readGlobal(name);return typeof value==='function'?value:null}
function call(name,...args){const f=fn(name);if(!f)return undefined;try{return f(...args)}catch(e){console.warn(`[${BUILD}] ${name}`,e);return undefined}}
function G(){return readGlobal('g')||window.g||null}
function ITEMS(){return readGlobal('IT')||window.IT||null}
function PARAMS(){return readGlobal('P')||window.P||null}
function ready(){return !!(G()&&ITEMS())}
function save(){call('saveGame',false)}
function rerender(){call('render')}
function notice(text,type='lg'){call('log',text,type)}
function toast(text){call('toast',text)}
function sheet(html){call('sheet',html)}

function registerItems(){
  const table=ITEMS();if(!table)return;
  for(const [id,m] of Object.entries(MATS)){
    table[id]=table[id]||{...m,eff:m.stat?'刻印器紋':'器紋系統',val:0,detail:m.stat?`${m.label}器紋 ${m.min}%～${m.max}%`:m.name};
  }
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
  const g=G();if(!g||!ITEMS())return false;
  registerItems();g.inv=g.inv||{};g.equipment=Array.isArray(g.equipment)?g.equipment:[];g.equipment.forEach(normalize);
  if(!g.v143Migrated){
    const old=Number(g.inv['8301']||0);
    if(old>0){g.inv['8410']=(g.inv['8410']||0)+old;g.inv['8301']=0;notice(`舊有庚精已安全轉換為淬器石 ×${old}。`,'lg')}
    g.v143Migrated=true;save();
  }
  return true;
}
function sumStat(stat){
  migrate();const g=G();if(!g)return 0;
  return (g.equipment||[]).filter(e=>e.uid===g.weaponUid||e.uid===g.armorUid).flatMap(e=>e.inscriptions||[]).filter(x=>x.stat===stat).reduce((a,x)=>a+Number(x.value||0),0);
}
function capText(e){return '★'.repeat(e.inscriptionCapacity)+'☆'.repeat(3-e.inscriptionCapacity)}
function lineText(x){return `${x.label} +${Number(x.value).toFixed(1)}%`}
function eqCard(e){
  normalize(e);
  const lines=e.inscriptions.map((x,i)=>`<div class="v143-line"><span>第 ${i+1} 紋</span><b>${esc(lineText(x))}</b></div>`).join('');
  const empties=Math.max(0,e.inscriptionCapacity-e.inscriptions.length);
  return `<article class="v143-card"><h4>${esc(e.name)} +${e.temperLevel}</h4><small>${esc(e.cat)}｜器紋容量 <span class="v143-cap">${capText(e)}</span></small><div class="v143-lines">${lines}${Array.from({length:empties},(_,i)=>`<div class="v143-line"><span>第 ${e.inscriptions.length+i+1} 紋</span><span class="v143-empty">未刻印</span></div>`).join('')}${e.inscriptionCapacity===0?'<div class="v143-line"><span>此器胚無天然器紋</span><span class="v143-empty">可交易或收藏</span></div>':''}</div><div class="v143-actions"><button class="btn jade" data-v143-inscribe="${esc(e.uid)}" ${empties?'':'disabled'}>刻印</button><button class="btn" data-v143-reforge="${esc(e.uid)}" ${e.inscriptions.length?'':'disabled'}>洗煉</button><button class="btn gold" data-v143-temper="${esc(e.uid)}" ${e.inscriptions.length===e.inscriptionCapacity&&e.inscriptionCapacity>0?'':'disabled'}>淬鍊</button></div></article>`;
}
function renderWorkshop(){
  if(!migrate())return;
  const root=q('v143Root'),g=G();if(!root||!g)return;
  const eq=g.equipment||[];
  root.innerHTML=`<div class="v143-shell"><div class="v143-head"><div><div class="v143-title">天工器紋閣</div><small>刻印必成；器紋刻滿後方可淬鍊。淬鍊失敗時法寶永久消失，護器符可保住法寶。</small></div><span class="pill">${BUILD}</span></div><div class="v143-note">材料：器紋砂用於刻印；洗煉石重抽數值；淬器石用於淬鍊；護器符防止損毀；天工石提高本次成功率。</div><div class="v143-grid">${eq.length?eq.map(eqCard).join(''):'<div class="v143-empty">目前沒有可處理的法寶或防具。</div>'}</div><button class="btn" id="v143Close">關閉</button></div>`;
  bind();
}
function bind(){
  document.querySelectorAll('[data-v143-inscribe]').forEach(b=>b.addEventListener('click',()=>chooseInscribe(b.dataset.v143Inscribe)));
  document.querySelectorAll('[data-v143-reforge]').forEach(b=>b.addEventListener('click',()=>chooseReforge(b.dataset.v143Reforge)));
  document.querySelectorAll('[data-v143-temper]').forEach(b=>b.addEventListener('click',()=>temper(b.dataset.v143Temper)));
  q('v143Close')?.addEventListener('click',()=>call('closeOv'));
}
function open(){
  ensurePatched();
  if(!ready()){toast('角色資料仍在同步，請稍候再試');scheduleEnsure(300);return}
  migrate();sheet('<div id="v143Root"></div>');renderWorkshop();
}
function findEq(uid){migrate();return G()?.equipment?.find(e=>String(e.uid)===String(uid))||null}
function chooseInscribe(uid){
  const e=findEq(uid),g=G();if(!e||!g||e.inscriptions.length>=e.inscriptionCapacity)return;
  const opts=Object.entries(MATS).filter(([,m])=>m.stat).map(([id,m])=>`<option value="${id}" ${Number(g.inv[id]||0)>0?'':'disabled'}>${esc(m.name)} ×${Number(g.inv[id]||0)}｜${m.label} ${m.min}～${m.max}%</option>`).join('');
  sheet(`<h3>刻印器紋｜${esc(e.name)}</h3><div class="v143-note">刻印成功率固定 100%，每次消耗 1 份器紋砂。</div><label>器紋材料<select id="v143Mat" class="v143-select">${opts}</select></label><div class="v143-actions"><button class="btn gold" id="v143DoInscribe">確認刻印</button><button class="btn" id="v143Back">返回</button></div>`);
  q('v143DoInscribe')?.addEventListener('click',()=>inscribe(uid,q('v143Mat')?.value));q('v143Back')?.addEventListener('click',open);
}
function inscribe(uid,id){
  const e=findEq(uid),m=MATS[id],g=G();
  if(!e||!g||!m?.stat||!(Number(g.inv[id]||0)>0)||e.inscriptions.length>=e.inscriptionCapacity){toast('材料不足或器紋已滿');return}
  g.inv[id]--;e.inscriptions.push({stat:m.stat,label:m.label,value:rand(m.min,m.max)});notice(`${e.name} 成功刻印「${lineText(e.inscriptions.at(-1))}」。`,'lg');save();open();rerender();
}
function chooseReforge(uid){
  const e=findEq(uid),g=G();if(!e||!g||!e.inscriptions.length)return;
  if(!(Number(g.inv['8413']||0)>0)){toast('洗煉石不足');return}
  const opts=e.inscriptions.map((x,i)=>`<option value="${i}">第 ${i+1} 紋｜${esc(lineText(x))}</option>`).join('');
  sheet(`<h3>洗煉器紋｜${esc(e.name)}</h3><div class="v143-note">消耗 1 顆洗煉石，只重抽指定器紋的數值，不改變屬性種類。</div><label>選擇器紋<select id="v143Line" class="v143-select">${opts}</select></label><div class="v143-actions"><button class="btn gold" id="v143DoReforge">確認洗煉</button><button class="btn" id="v143Back">返回</button></div>`);
  q('v143DoReforge')?.addEventListener('click',()=>reforge(uid,Number(q('v143Line')?.value)));q('v143Back')?.addEventListener('click',open);
}
function reforge(uid,i){
  const e=findEq(uid),x=e?.inscriptions?.[i],m=Object.values(MATS).find(v=>v.stat===x?.stat),g=G();if(!e||!x||!m||!g||!(Number(g.inv['8413']||0)>0))return;
  g.inv['8413']--;const old=x.value;x.value=rand(m.min,m.max);notice(`${e.name} 洗煉完成：${x.label} ${old}% → ${x.value}%。`,'lg');save();open();rerender();
}
function temperRate(level){return Math.max(.05,level<3?1:(level<6?0.65:Math.pow(.72,level-5)*0.45))}
function temper(uid){
  const e=findEq(uid),g=G();if(!e||!g||e.inscriptionCapacity===0||e.inscriptions.length!==e.inscriptionCapacity)return;
  if(!(Number(g.inv['8410']||0)>0)){toast('淬器石不足');return}
  const useGuard=Number(g.inv['8411']||0)>0&&confirm('是否同時消耗 1 張護器符？失敗時可防止法寶消失。');
  const useBoost=Number(g.inv['8412']||0)>0&&confirm('是否同時消耗 1 顆天工石？本次成功率提高 15%。');
  const rate=Math.min(.95,temperRate(e.temperLevel)+(useBoost?0.15:0));
  if(!confirm(`本次淬鍊成功率 ${Math.round(rate*100)}%。${useGuard?'護器符已選用。':'失敗將永久消失。'} 是否繼續？`))return;
  g.inv['8410']--;if(useGuard)g.inv['8411']--;if(useBoost)g.inv['8412']--;
  if(Math.random()<rate){e.temperLevel++;e.enhance=e.temperLevel;notice(`${e.name} 淬鍊成功，達到 +${e.temperLevel}。`,'lg')}
  else if(useGuard)notice(`${e.name} 淬鍊失敗，護器符化為飛灰，法寶得以保全。`,'la');
  else{g.equipment=g.equipment.filter(x=>x.uid!==uid);if(g.weaponUid===uid)g.weaponUid=null;if(g.armorUid===uid)g.armorUid=null;notice(`${e.name} 淬鍊失敗，法寶徹底化為飛灰。`,'ld')}
  save();open();rerender();
}

function wrap(name,factory){
  const original=fn(name);if(!original||original.__v145aArtifactWrapped)return false;
  const wrapped=factory(original);Object.defineProperty(wrapped,'__v145aArtifactWrapped',{value:true});return writeGlobal(name,wrapped);
}
function patchCore(){
  if(window.__V143ArtifactCorePatched)return true;
  if(!ready())return false;
  registerItems();migrate();
  const essential=['newEquipment','pAtk','pDef','attackTurn','winFight','openBag'];
  if(essential.some(name=>!fn(name)))return false;
  wrap('newEquipment',old=>function(itemId,enhance=0){const e=old(itemId,enhance);if(!e)return e;e.inscriptionCapacity=Math.floor(Math.random()*4);e.inscriptions=[];e.temperLevel=Number(enhance||0);return normalize(e)});
  wrap('pAtk',old=>function(){return Math.round(Number(old.apply(this,arguments)||0)*(1+sumStat('atk_pct')/100))});
  wrap('pDef',old=>function(){return Math.round(Number(old.apply(this,arguments)||0)*(1+sumStat('def_pct')/100))});
  wrap('attackTurn',old=>function(){const p=PARAMS(),oldRate=p?.base_crit_rate;try{if(p)p.base_crit_rate=Number(oldRate||0)+sumStat('crit_pct')/100;return old.apply(this,arguments)}finally{if(p)p.base_crit_rate=oldRate}});
  wrap('winFight',old=>function(){const result=old.apply(this,arguments);setTimeout(()=>{const g=G();if(!g)return;const pool=['8401','8402','8403','8404','8405','8410','8413'];if(Math.random()<.22){const id=pool[Math.floor(Math.random()*pool.length)];g.inv=g.inv||{};g.inv[id]=(g.inv[id]||0)+1;notice(`妖獸殘骸中發現 ${MATS[id].name}。`,'lg');save();rerender()}},60);return result});
  wrap('openBag',old=>function(tab='bag'){if(tab==='forge')return open();return old.apply(this,arguments)});
  writeGlobal('enhanceItem',function(uid){open();setTimeout(()=>{document.querySelector(`[data-v143-temper="${CSS.escape(String(uid))}"]`)?.scrollIntoView({block:'center'})},40)});
  window.__V143ArtifactCorePatched=true;
  return true;
}
function ensurePatched(){return patchCore()}
let ensureTimer=null;
function scheduleEnsure(delay=500){
  clearTimeout(ensureTimer);ensureTimer=setTimeout(()=>{if(!ensurePatched())scheduleEnsure(750)},delay);
}

window.openArtifactWorkshopV143=open;
window.V14_ARTIFACT_BUILD=BUILD;
window.V14_ARTIFACT_COMPAT={build:BUILD,ready,ensurePatched,gameState:G,itemTable:ITEMS};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>scheduleEnsure(50),{once:true});else scheduleEnsure(50);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleEnsure(50)});
window.addEventListener('pageshow',()=>scheduleEnsure(50));
})();
