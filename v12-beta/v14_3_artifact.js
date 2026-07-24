(()=>{
'use strict';

const BUILD='V15.4-ARTIFACT-ID-AUTHORITY-FIX6-20260724';

const MATS={
  '8301':{
    name:'庚精',
    cat:'強化石',
    eff:'強化',
    detail:'裝備獨立強化的必要材料；每次消耗 1 顆。'
  },
  '8501':{name:'赤陽器紋砂',cat:'器紋材料',stat:'atk_pct',label:'攻擊',min:3,max:8},
  '8502':{name:'玄甲器紋砂',cat:'器紋材料',stat:'def_pct',label:'防禦',min:3,max:8},
  '8503':{name:'雷鳴器紋砂',cat:'器紋材料',stat:'crit_pct',label:'暴擊',min:2,max:6},
  '8504':{name:'長生器紋砂',cat:'器紋材料',stat:'hp_pct',label:'體力',min:4,max:10},
  '8505':{name:'靈泉器紋砂',cat:'器紋材料',stat:'spirit_pct',label:'精力',min:3,max:8},
  '8410':{
    name:'淬器石',
    cat:'淬鍊／保階材料',
    eff:'淬鍊與保階',
    detail:'可用於器紋淬鍊；裝備強化時選用，可保證失敗不降級。'
  },
  '8411':{
    name:'保護符',
    cat:'保護材料',
    eff:'防止損毀',
    detail:'強化或淬鍊失敗時，防止裝備永久消失；不防止強化降級。'
  },
  '8412':{
    name:'天工石',
    cat:'增幅材料',
    eff:'淬鍊增幅',
    detail:'器紋淬鍊時選用，本次成功率提高 15%。'
  },
  '8413':{
    name:'洗鍊石',
    cat:'洗鍊材料',
    eff:'洗鍊器紋',
    detail:'重抽指定器紋數值，但不改變器紋屬性種類。'
  }
};

const q=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(
  /[&<>"']/g,
  c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c])
);
const hash=s=>[...String(s)].reduce(
  (a,c)=>(a*31+c.charCodeAt(0))>>>0,
  2166136261
);
const rand=(a,b)=>Math.round((a+Math.random()*(b-a))*10)/10;
const inv=id=>Number(window.g?.inv?.[id]||0);
const ASSET_SNAPSHOT_KEY='xianxia_v154_asset_safety_snapshot';

function safeSave(){
  try{
    return Promise.resolve(window.saveGame?.(false)).catch(error=>{
      console.warn('[V15.4 ARTIFACT FIX5] save deferred',error);
    });
  }catch(error){
    console.warn('[V15.4 ARTIFACT FIX5] save deferred',error);
    return Promise.resolve();
  }
}

function readAssetSnapshot(){
  try{
    const raw=localStorage.getItem(ASSET_SNAPSHOT_KEY);
    if(!raw)return null;
    const snap=JSON.parse(raw);
    const currentUser=window.cloudState?.user?.id||null;
    if(currentUser&&snap?.userId&&snap.userId!==currentUser)return null;
    if(snap?.characterId&&window.g?.characterId&&snap.characterId!==window.g.characterId)return null;
    return snap;
  }catch(_){return null;}
}

function findEquipmentIn(source,uid){
  const list=source?.equipment;
  if(!Array.isArray(list))return null;
  return list.find(x=>String(x?.uid)===String(uid))||null;
}

function recoveredEnhanceLevel(e){
  const candidates=[
    e?.enhance,
    e?.enhanceLevel,
    e?.enhancement,
    e?.upgradeLevel,
    e?.forgeLevel,
    e?.plus,
    e?._enhance,
    e?.legacyEnhance
  ];
  const remote=findEquipmentIn(window.cloudState?.remoteSave?.g,e?.uid);
  const backup=findEquipmentIn(readAssetSnapshot(),e?.uid);
  for(const source of [remote,backup]){
    if(!source)continue;
    candidates.push(
      source.enhance,
      source.enhanceLevel,
      source.enhancement,
      source.upgradeLevel,
      source.forgeLevel,
      source.plus,
      source._enhance,
      source.legacyEnhance
    );
  }
  return Math.max(0,...candidates.map(v=>{
    const n=Number(v);
    return Number.isFinite(n)?Math.floor(n):0;
  }));
}

function materialIds(id){
  const canonical=String(id);
  const name=MATS[canonical]?.name;
  const ids=[canonical];
  if(name&&window.IT&&typeof window.IT==='object'){
    for(const [candidate,item] of Object.entries(window.IT)){
      if(candidate!==canonical&&String(item?.name||'')===name)ids.push(String(candidate));
    }
  }
  return [...new Set(ids)];
}

function materialCount(id){
  return materialIds(id).reduce((sum,key)=>sum+Math.max(0,Number(window.g?.inv?.[key])||0),0);
}

function consumeMaterial(id,qty=1){
  let remain=Math.max(0,Math.floor(Number(qty)||0));
  const inventory=window.g?.inv;
  if(!inventory||remain<=0)return remain===0;
  for(const key of materialIds(id)){
    const have=Math.max(0,Number(inventory[key])||0);
    if(have<=0)continue;
    const take=Math.min(have,remain);
    inventory[key]=have-take;
    remain-=take;
    if(remain<=0)return true;
  }
  return false;
}

function ready(){
  return !!(window.g&&window.IT);
}

function registerItems(){
  if(!window.IT)return;
  for(const [id,m] of Object.entries(MATS)){
    const old=window.IT[id]||{};
    window.IT[id]={
      ...old,
      ...m,
      val:Number(old.val||0),
      type:old.type??null,
      detail:m.detail||(
        m.stat
          ?`${m.label}器紋 ${m.min}%～${m.max}%`
          :m.name
      )
    };
  }
}

function normalize(e){
  if(!e||typeof e!=='object')return e;

  if(!Number.isInteger(e.inscriptionCapacity)){
    e.inscriptionCapacity=hash(e.uid||e.name)%4;
  }
  e.inscriptionCapacity=Math.max(
    0,
    Math.min(3,e.inscriptionCapacity)
  );

  if(!Array.isArray(e.inscriptions)){
    e.inscriptions=[];
  }
  e.inscriptions=e.inscriptions
    .slice(0,e.inscriptionCapacity)
    .filter(x=>x&&x.stat&&Number.isFinite(Number(x.value)))
    .map(x=>({
      stat:x.stat,
      label:x.label||x.stat,
      value:Number(x.value)
    }));

  /*
   * 強化值只由 enhance 系列欄位與同 UID 的安全快照恢復。
   * 禁止再用 temperLevel 覆寫 enhance；兩套系統永久分離。
   */
  e.enhance=recoveredEnhanceLevel(e);

  /*
   * 強化與淬鍊正式分離。
   * 舊裝備若已經有 temperLevel，完整保留。
   * 只有從未進入天工系統的舊裝備，才從 0 重開始。
   */
  if(!Number.isFinite(Number(e.temperLevel))){
    e.temperLevel=0;
  }
  e.temperLevel=Math.max(
    0,
    Math.floor(Number(e.temperLevel)||0)
  );

  return e;
}

function migrate(){
  if(!ready())return;

  registerItems();
  window.g.inv=window.g.inv||{};
  window.g.equipment=window.g.equipment||[];
  let repaired=false;
  window.g.equipment.forEach(e=>{
    const before=Number(e?.enhance)||0;
    normalize(e);
    if(Number(e?.enhance)!==before)repaired=true;
  });

  /*
   * 不做任何物品 ID 轉換，不刪除庚精、器紋砂或附魔材料。
   * 只標記本次權威修復已完成。
   */
  if(!window.g.v154ArtifactAuthorityFix5){
    window.g.v154ArtifactAuthorityFix5=true;
    repaired=true;
  }
  if(repaired)setTimeout(safeSave,0);
}

function sumStat(stat){
  migrate();
  return (window.g?.equipment||[])
    .filter(
      e=>
        e.uid===window.g.weaponUid||
        e.uid===window.g.armorUid
    )
    .flatMap(e=>e.inscriptions||[])
    .filter(x=>x.stat===stat)
    .reduce((a,x)=>a+Number(x.value||0),0);
}

function capText(e){
  return '★'.repeat(e.inscriptionCapacity)+
    '☆'.repeat(3-e.inscriptionCapacity);
}

function lineText(x){
  return `${x.label} +${Number(x.value).toFixed(1)}%`;
}

function enhanceRate(level){
  return level<6
    ?1
    :Math.pow(.5,level-5);
}

function temperRate(level){
  return Math.max(
    .05,
    level<3
      ?1
      :level<6
        ?.65
        :Math.pow(.72,level-5)*.45
  );
}

function isEquipment(e){
  const cat=String(e?.cat||e?.type||'');
  return cat==='法器'||cat==='防具';
}

function eqCard(e){
  normalize(e);

  const lines=e.inscriptions.map(
    (x,i)=>`
      <div class="v143-line">
        <span>第 ${i+1} 紋</span>
        <b>${esc(lineText(x))}</b>
      </div>
    `
  ).join('');

  const empties=Math.max(
    0,
    e.inscriptionCapacity-e.inscriptions.length
  );

  const emptyLines=Array.from(
    {length:empties},
    (_,i)=>`
      <div class="v143-line">
        <span>第 ${e.inscriptions.length+i+1} 紋</span>
        <span class="v143-empty">未刻印</span>
      </div>
    `
  ).join('');

  const noNatural=e.inscriptionCapacity===0
    ?`
      <div class="v143-line">
        <span>此器胚無天然器紋</span>
        <span class="v143-empty">仍可進行裝備強化</span>
      </div>
    `
    :'';

  const nextRate=enhanceRate(e.enhance)*100;

  return `
    <article class="v143-card" data-v143-card="${esc(e.uid)}">
      <div class="v143-card-head">
        <h4>${esc(e.name)}</h4>
        <span class="v143-enhance-level">強化 +${e.enhance}</span>
      </div>

      <small>
        ${esc(e.cat)}｜
        淬鍊 ${e.temperLevel} 重｜
        器紋容量
        <span class="v143-cap">${capText(e)}</span>
      </small>

      <div class="v143-lines">
        ${lines}
        ${emptyLines}
        ${noNatural}
      </div>

      <div class="v143-card-summary">
        <span>下次強化 ${nextRate.toFixed(nextRate<10?2:0)}%</span>
        <span>每次消耗庚精 1</span>
      </div>

      <div class="v143-inline-enhance">
        <label class="${inv('8410')>0?'':'is-disabled'}">
          <input
            type="checkbox"
            data-v143-inline-stabilizer="${esc(e.uid)}"
            ${inv('8410')>0?'':'disabled'}
          >
          <span>淬器石保階</span>
        </label>
        <label class="${inv('8411')>0?'':'is-disabled'}">
          <input
            type="checkbox"
            data-v143-inline-guard="${esc(e.uid)}"
            ${inv('8411')>0?'':'disabled'}
          >
          <span>保護符防碎</span>
        </label>
      </div>

      <div class="v143-actions">
        <button
          class="btn jade"
          data-v143-inscribe="${esc(e.uid)}"
          ${empties?'':'disabled'}
        >刻印</button>

        <button
          class="btn"
          data-v143-reforge="${esc(e.uid)}"
          ${e.inscriptions.length?'':'disabled'}
        >洗鍊</button>

        <button
          class="btn gold"
          data-v143-temper="${esc(e.uid)}"
          ${
            e.inscriptions.length===e.inscriptionCapacity&&
            e.inscriptionCapacity>0
              ?''
              :'disabled'
          }
        >淬鍊</button>

        <button
          class="btn red"
          data-v143-enhance="${esc(e.uid)}"
          ${isEquipment(e)?'':'disabled'}
        >強化</button>
      </div>
    </article>
  `;
}

function legacyRecoveryNotice(){return '';}

function render(){
  migrate();

  const root=q('v143Root');
  if(!root)return;

  const eq=window.g.equipment||[];

  root.innerHTML=`
    <div class="v143-shell">
      <div class="v143-head">
        <div>
          <div class="v143-title">天工器紋閣</div>
          <small>
            刻印、洗鍊、淬鍊、強化四套系統彼此獨立。
          </small>
        </div>
        <span class="pill">${BUILD}</span>
      </div>

      <div class="v143-note">
        <b>強化</b>消耗庚精，提升裝備 +值；
        <b>淬器石</b>可用於淬鍊，亦可在強化時保證失敗不降級；
        <b>保護符</b>只防止裝備損毀；
        <b>天工石</b>只提高淬鍊成功率。
      </div>

      <div class="v143-materials">
        <span>庚精 ${inv('8301')}</span>
        <span>淬器石 ${inv('8410')}</span>
        <span>保護符 ${inv('8411')}</span>
        <span>天工石 ${inv('8412')}</span>
        <span>洗鍊石 ${inv('8413')}</span>
      </div>

      ${legacyRecoveryNotice()}

      <div class="v143-grid">
        ${
          eq.length
            ?eq.map(eqCard).join('')
            :'<div class="v143-empty">目前沒有可處理的法寶或防具。</div>'
        }
      </div>

      <button class="btn" id="v143Close">關閉</button>
    </div>
  `;

  bind();
}

function bind(){
  document
    .querySelectorAll('[data-v143-inscribe]')
    .forEach(
      b=>b.addEventListener(
        'click',
        ()=>chooseInscribe(b.dataset.v143Inscribe)
      )
    );

  document
    .querySelectorAll('[data-v143-reforge]')
    .forEach(
      b=>b.addEventListener(
        'click',
        ()=>chooseReforge(b.dataset.v143Reforge)
      )
    );

  document
    .querySelectorAll('[data-v143-temper]')
    .forEach(
      b=>b.addEventListener(
        'click',
        ()=>temper(b.dataset.v143Temper)
      )
    );

  document
    .querySelectorAll('[data-v143-enhance]')
    .forEach(
      b=>b.addEventListener(
        'click',
        ()=>{
          const uid=b.dataset.v143Enhance;
          const useStabilizer=!!document.querySelector(
            `[data-v143-inline-stabilizer="${CSS.escape(uid)}"]`
          )?.checked;
          const useGuard=!!document.querySelector(
            `[data-v143-inline-guard="${CSS.escape(uid)}"]`
          )?.checked;
          enhance(uid,useStabilizer,useGuard);
        }
      )
    );

  q('v143LegacyRecover')?.addEventListener(
    'click',
    openLegacyRecovery
  );

  q('v143Close')?.addEventListener(
    'click',
    ()=>window.closeOv?.()
  );
}

function open(){
  if(!ready()){
    window.toast?.('角色資料尚未載入');
    return;
  }

  migrate();
  window.sheet?.('<div id="v143Root"></div>');
  render();
}

function findEq(uid){
  migrate();
  return window.g.equipment.find(
    e=>String(e.uid)===String(uid)
  );
}

/* ------------------------------------------------------------------
 * 刻印
 * ------------------------------------------------------------------ */

function chooseInscribe(uid){
  const e=findEq(uid);
  if(
    !e||
    e.inscriptions.length>=e.inscriptionCapacity
  )return;

  const opts=Object.entries(MATS)
    .filter(([,m])=>m.stat)
    .map(
      ([id,m])=>`
        <option
          value="${id}"
          ${materialCount(id)>0?'':'disabled'}
        >
          ${esc(m.name)} ×${materialCount(id)}
          ｜${m.label} ${m.min}～${m.max}%
        </option>
      `
    )
    .join('');

  window.sheet?.(`
    <h3>刻印器紋｜${esc(e.name)}</h3>
    <div class="v143-note">
      刻印成功率固定 100%，每次消耗 1 份器紋砂。
    </div>

    <label>
      器紋材料
      <select id="v143Mat" class="v143-select">
        ${opts}
      </select>
    </label>

    <div class="v143-actions">
      <button class="btn gold" id="v143DoInscribe">
        確認刻印
      </button>
      <button class="btn" id="v143Back">返回</button>
    </div>
  `);

  q('v143DoInscribe')?.addEventListener(
    'click',
    ()=>inscribe(uid,q('v143Mat')?.value)
  );
  q('v143Back')?.addEventListener('click',open);
}

function inscribe(uid,id){
  const e=findEq(uid);
  const m=MATS[id];

  if(
    !e||
    !m?.stat||
    materialCount(id)<=0||
    e.inscriptions.length>=e.inscriptionCapacity
  ){
    window.toast?.('材料不足或器紋已滿');
    return;
  }

  if(!consumeMaterial(id,1)){
    window.toast?.('器紋砂不足');
    return;
  }
  e.inscriptions.push({
    stat:m.stat,
    label:m.label,
    value:rand(m.min,m.max)
  });

  window.log?.(
    `${e.name} 成功刻印「${lineText(e.inscriptions.at(-1))}」。`,
    'lg'
  );
  safeSave();
  open();
  window.render?.();
}

/* ------------------------------------------------------------------
 * 洗鍊
 * ------------------------------------------------------------------ */

function chooseReforge(uid){
  const e=findEq(uid);
  if(!e||!e.inscriptions.length)return;

  if(!(window.g.inv['8413']>0)){
    window.toast?.('洗鍊石不足');
    return;
  }

  const opts=e.inscriptions
    .map(
      (x,i)=>`
        <option value="${i}">
          第 ${i+1} 紋｜${esc(lineText(x))}
        </option>
      `
    )
    .join('');

  window.sheet?.(`
    <h3>洗鍊器紋｜${esc(e.name)}</h3>
    <div class="v143-note">
      消耗 1 顆洗鍊石，只重抽指定器紋的數值，
      不改變屬性種類。
    </div>

    <label>
      選擇器紋
      <select id="v143Line" class="v143-select">
        ${opts}
      </select>
    </label>

    <div class="v143-actions">
      <button class="btn gold" id="v143DoReforge">
        確認洗鍊
      </button>
      <button class="btn" id="v143Back">返回</button>
    </div>
  `);

  q('v143DoReforge')?.addEventListener(
    'click',
    ()=>reforge(uid,Number(q('v143Line')?.value))
  );
  q('v143Back')?.addEventListener('click',open);
}

function reforge(uid,i){
  const e=findEq(uid);
  const x=e?.inscriptions?.[i];
  const m=Object.values(MATS).find(
    v=>v.stat===x?.stat
  );

  if(
    !e||
    !x||
    !m||
    !(window.g.inv['8413']>0)
  )return;

  window.g.inv['8413']--;
  const old=x.value;
  x.value=rand(m.min,m.max);

  window.log?.(
    `${e.name} 洗鍊完成：${x.label} ${old}% → ${x.value}%。`,
    'lg'
  );
  safeSave();
  open();
  window.render?.();
}

/* ------------------------------------------------------------------
 * 淬鍊
 * 保留原本流程：器紋刻滿、消耗淬器石、可用保護符與天工石。
 * 成功後不再篡改 enhance，而是直接提升所有器紋數值 5%。
 * ------------------------------------------------------------------ */

function temper(uid){
  const e=findEq(uid);

  if(
    !e||
    e.inscriptionCapacity===0||
    e.inscriptions.length!==e.inscriptionCapacity
  )return;

  if(!(window.g.inv['8410']>0)){
    window.toast?.('淬器石不足');
    return;
  }

  const useGuard=
    window.g.inv['8411']>0&&
    confirm(
      '是否同時消耗 1 張保護符？'+
      '淬鍊失敗時可防止裝備永久消失。'
    );

  const useBoost=
    window.g.inv['8412']>0&&
    confirm(
      '是否同時消耗 1 顆天工石？'+
      '本次淬鍊成功率提高 15%。'
    );

  const rate=Math.min(
    .95,
    temperRate(e.temperLevel)+(useBoost?.15:0)
  );

  if(!confirm(
    `本次淬鍊成功率 ${Math.round(rate*100)}%。\n`+
    `成功：淬鍊提升 1 重，所有已刻印器紋數值提高 5%。\n`+
    (
      useGuard
        ?'保護符已選用，失敗不會摧毀裝備。'
        :'未使用保護符，失敗將永久摧毀裝備。'
    )+
    '\n是否繼續？'
  ))return;

  window.g.inv['8410']--;
  if(useGuard)window.g.inv['8411']--;
  if(useBoost)window.g.inv['8412']--;

  if(Math.random()<rate){
    e.temperLevel++;
    e.inscriptions=e.inscriptions.map(
      x=>({
        ...x,
        value:Math.round(Number(x.value||0)*1.05*10)/10
      })
    );

    window.log?.(
      `${e.name} 淬鍊成功，達到 ${e.temperLevel} 重；`+
      '所有器紋效果提高 5%。',
      'lg'
    );
  }else if(useGuard){
    window.log?.(
      `${e.name} 淬鍊失敗，保護符化為飛灰，裝備得以保全。`,
      'la'
    );
  }else{
    window.g.equipment=window.g.equipment.filter(
      x=>x.uid!==uid
    );
    if(window.g.weaponUid===uid)window.g.weaponUid=null;
    if(window.g.armorUid===uid)window.g.armorUid=null;

    window.log?.(
      `${e.name} 淬鍊失敗，裝備徹底化為飛灰。`,
      'ld'
    );
  }

  safeSave();
  open();
  window.render?.();
}

/* ------------------------------------------------------------------
 * 強化
 * 恢復舊版庚精強化：
 * +0 → +6 必成；+6 後成功率逐級減半。
 * 失敗原始結果：40%摧毀、30%維持、30%降級。
 * 淬器石只封鎖降級；保護符只封鎖摧毀。
 * ------------------------------------------------------------------ */

function protectionText(useStabilizer,useGuard){
  if(useStabilizer&&useGuard){
    return '失敗時不會摧毀裝備，也不會降低強化等級。';
  }
  if(useStabilizer){
    return '失敗時不會降級，但仍可能摧毀裝備。';
  }
  if(useGuard){
    return '失敗時不會摧毀裝備，但仍可能降低強化等級。';
  }
  return '失敗可能摧毀裝備、維持原級或降低 1 級。';
}

function chooseEnhance(uid){
  const e=findEq(uid);
  if(!e||!isEquipment(e))return;

  const rate=enhanceRate(e.enhance)*100;

  window.sheet?.(`
    <h3>裝備強化｜${esc(e.name)}</h3>

    <div class="v143-enhance-panel">
      <div>
        <span>目前強化</span>
        <b>+${e.enhance}</b>
      </div>
      <div>
        <span>成功後</span>
        <b>+${e.enhance+1}</b>
      </div>
      <div>
        <span>成功率</span>
        <b>${rate.toFixed(rate<10?2:0)}%</b>
      </div>
    </div>

    <div class="v143-note">
      每次固定消耗 1 顆庚精。
      +0 至 +6 必定成功；+6 之後成功率逐級減半。
      每級強化提高此裝備基礎攻擊或防禦 5%。
    </div>

    <div class="v143-materials">
      <span>庚精 ${inv('8301')}</span>
      <span>淬器石 ${inv('8410')}</span>
      <span>保護符 ${inv('8411')}</span>
    </div>

    <label class="v143-option ${
      inv('8410')>0?'':'is-disabled'
    }">
      <input
        type="checkbox"
        id="v143UseStabilizer"
        ${inv('8410')>0?'':'disabled'}
      >
      <span>
        <b>使用淬器石</b>
        <small>失敗時 100% 不降低強化等級；不能防止裝備摧毀。</small>
      </span>
    </label>

    <label class="v143-option ${
      inv('8411')>0?'':'is-disabled'
    }">
      <input
        type="checkbox"
        id="v143UseGuard"
        ${inv('8411')>0?'':'disabled'}
      >
      <span>
        <b>使用保護符</b>
        <small>失敗時防止裝備摧毀；不能防止強化降級。</small>
      </span>
    </label>

    <div class="v143-risk" id="v143EnhanceRisk">
      ${protectionText(false,false)}
    </div>

    <div class="v143-actions">
      <button class="btn red" id="v143DoEnhance">
        消耗 1 庚精進行強化
      </button>
      <button class="btn" id="v143Back">返回</button>
    </div>
  `);

  const refreshRisk=()=>{
    const useStabilizer=!!q('v143UseStabilizer')?.checked;
    const useGuard=!!q('v143UseGuard')?.checked;
    const risk=q('v143EnhanceRisk');
    if(risk){
      risk.textContent=protectionText(
        useStabilizer,
        useGuard
      );
    }
  };

  q('v143UseStabilizer')?.addEventListener(
    'change',
    refreshRisk
  );
  q('v143UseGuard')?.addEventListener(
    'change',
    refreshRisk
  );

  q('v143DoEnhance')?.addEventListener(
    'click',
    ()=>enhance(
      uid,
      !!q('v143UseStabilizer')?.checked,
      !!q('v143UseGuard')?.checked
    )
  );

  q('v143Back')?.addEventListener('click',open);
}

function enhance(uid,useStabilizer,useGuard){
  const e=findEq(uid);
  if(!e||!isEquipment(e))return;

  if(!(window.g.inv['8301']>0)){
    window.toast?.('庚精不足');
    return;
  }
  if(useStabilizer&&!(window.g.inv['8410']>0)){
    window.toast?.('淬器石不足');
    return;
  }
  if(useGuard&&!(window.g.inv['8411']>0)){
    window.toast?.('保護符不足');
    return;
  }

  const rate=enhanceRate(e.enhance);

  /*
   * 強化頁面已完整顯示材料、成功率與失敗風險。
   * 按下強化按鈕後直接執行，不再跳出瀏覽器二次確認。
   */
  window.g.inv['8301']--;
  if(useStabilizer)window.g.inv['8410']--;
  if(useGuard)window.g.inv['8411']--;

  if(Math.random()<rate){
    e.enhance++;

    window.log?.(
      `${e.name} 強化成功，達到 +${e.enhance}。`,
      'lg'
    );
  }else{
    const roll=Math.random();

    if(roll<.4){
      if(useGuard){
        window.log?.(
          `${e.name} 強化失敗，本應損毀；`+
          '保護符化為飛灰，裝備與強化等級得以保全。',
          'la'
        );
      }else{
        window.g.equipment=window.g.equipment.filter(
          x=>x.uid!==uid
        );
        if(window.g.weaponUid===uid)window.g.weaponUid=null;
        if(window.g.armorUid===uid)window.g.armorUid=null;

        window.log?.(
          `${e.name} 強化失敗，裝備化為飛灰。`,
          'ld'
        );
      }
    }else if(roll<.7){
      window.log?.(
        `${e.name} 強化失敗，強化等級維持 +${e.enhance}。`,
        'la'
      );
    }else if(useStabilizer){
      window.log?.(
        `${e.name} 強化失敗，本應降低 1 級；`+
        `淬器石發揮保階效果，維持 +${e.enhance}。`,
        'la'
      );
    }else{
      e.enhance=Math.max(0,e.enhance-1);

      window.log?.(
        `${e.name} 強化失敗，降低為 +${e.enhance}。`,
        'la'
      );
    }
  }

  safeSave();
  open();
  window.render?.();
}

/* ------------------------------------------------------------------
 * 舊版庚精材料修復
 * 只做 1：1 轉換，不複製材料。
 * ------------------------------------------------------------------ */

function openLegacyRecovery(){window.toast?.('本版本不執行任何材料轉換');}

/* ------------------------------------------------------------------
 * 核心接線
 * ------------------------------------------------------------------ */

function patch(){
  if(
    window.__V143_PATCHED||
    !ready()
  )return false;

  window.__V143_PATCHED=true;
  registerItems();
  migrate();

  const oldNew=window.newEquipment;
  if(typeof oldNew==='function')window.newEquipment=function(itemId,enhance=0){
    const e=oldNew(itemId,enhance);
    e.inscriptionCapacity=Math.floor(Math.random()*4);
    e.inscriptions=[];
    e.temperLevel=0;
    e.enhance=Math.max(0,Math.floor(Number(enhance)||0));
    return normalize(e);
  };

  const oldAtk=window.pAtk;
  if(typeof oldAtk==='function')window.pAtk=function(){
    return Math.round(oldAtk()*(1+sumStat('atk_pct')/100));
  };

  const oldDef=window.pDef;
  if(typeof oldDef==='function')window.pDef=function(){
    return Math.round(oldDef()*(1+sumStat('def_pct')/100));
  };

  const oldAttack=window.attackTurn;
  if(typeof oldAttack==='function')window.attackTurn=function(){
    const oldRate=window.P?.base_crit_rate;
    try{
      if(window.P)window.P.base_crit_rate=Number(oldRate||0)+sumStat('crit_pct')/100;
      return oldAttack.apply(this,arguments);
    }finally{
      if(window.P)window.P.base_crit_rate=oldRate;
    }
  };

  const oldWin=window.winFight;
  if(typeof oldWin==='function')window.winFight=function(){
    const result=oldWin.apply(this,arguments);

    setTimeout(()=>{
      if(!window.g)return;

      /*
       * 庚精重新進入一般天工材料掉落池。
       * 不新增物品，只恢復原有材料用途。
       */
      const pool=[
        '8301',
        '8501',
        '8502',
        '8503',
        '8504',
        '8505',
        '8410',
        '8413'
      ];

      if(Math.random()<.22){
        const id=pool[
          Math.floor(Math.random()*pool.length)
        ];

        window.g.inv[id]=(window.g.inv[id]||0)+1;
        window.log?.(
          `妖獸殘骸中發現 ${MATS[id].name}。`,
          'lg'
        );
        safeSave();
        window.render?.();
      }
    },60);

    return result;
  };

  const oldOpenBag=window.openBag;
  if(typeof oldOpenBag==='function')window.openBag=function(tab='bag'){
    if(tab==='forge')return open();
    return oldOpenBag.apply(this,arguments);
  };

  /*
   * 舊版行囊強化按鈕仍可直接進入新的強化視窗。
   */
  window.enhanceItem=function(uid){
    open();
    setTimeout(()=>{
      document.querySelector(
        `[data-v143-card="${CSS.escape(String(uid))}"]`
      )?.scrollIntoView({behavior:'smooth',block:'center'});
    },50);
  };

  return true;
}

function mount(){
  if(q('v143Launch'))return;

  const b=document.createElement('button');
  b.id='v143Launch';
  b.className='v143-launch';
  b.type='button';
  b.textContent='天工器紋';
  b.addEventListener('click',open);
  document.body.appendChild(b);
}

window.openArtifactWorkshopV143=open;
window.V14_ARTIFACT_BUILD=BUILD;
window.V153_FORGE_SYSTEMS={
  build:BUILD,
  open,
  enhanceRate,
  temperRate
};
window.V154_ARTIFACT_AUTHORITY_FIX5={
  build:BUILD,
  open,
  repair:migrate,
  materialCount,
  consumeMaterial
};
console.info('[V15.4 ARTIFACT ID AUTHORITY FIX6] loaded',{build:BUILD});

let tries=0;
const timer=setInterval(()=>{
  tries++;

  if(patch()){
    mount();
    clearInterval(timer);
  }else if(tries>80){
    clearInterval(timer);
  }
},250);

})();
