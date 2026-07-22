(()=>{
'use strict';

const PATCH_ID='V15.0-EQUIPMENT-INTEGRITY-FIX1';
const ENHANCE_RATE=0.05;
const CANONICAL={
  '9601':{name:'兩儀斬仙劍',cat:'法器',type:'飛劍',eff:'攻擊',val:160,rarity:'絕世'},
  '9602':{name:'北辰玄冰甲',cat:'防具',type:'重甲',eff:'防禦',val:150,rarity:'絕世'}
};
const NAME_TO_ID={
  '兩儀斬仙劍':'9601',
  '斬仙劍':'9601',
  '北辰玄冰甲':'9602'
};

function finite(...vals){
  for(const v of vals){
    const n=Number(v);
    if(Number.isFinite(n)) return n;
  }
  return 0;
}
function safeText(v,fallback=''){return v==null?fallback:String(v)}
function escapeHtml(s){
  return safeText(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function ensureCanonicalItems(){
  if(typeof IT!=='object'||!IT)return;
  for(const [id,fix] of Object.entries(CANONICAL)){
    const old=(IT[id]&&typeof IT[id]==='object')?IT[id]:{};
    IT[id]={...old,...fix,detail:old.detail||old.desc||''};
  }
}
function resolveItemId(record){
  let id=safeText(record?.itemId??record?.item_id);
  if(id&&IT?.[id])return id;
  const mapped=NAME_TO_ID[safeText(record?.name)];
  if(mapped&&IT?.[mapped])return mapped;
  return id;
}
function resolveItem(recordOrId){
  ensureCanonicalItems();
  if(typeof recordOrId==='string'||typeof recordOrId==='number'){
    return IT?.[String(recordOrId)]||null;
  }
  const id=resolveItemId(recordOrId);
  return IT?.[id]||null;
}
function equipCat(record,it){
  return safeText(record?.cat||it?.cat||record?.type||it?.type);
}
function baseValue(record,it){
  const cat=equipCat(record,it);
  if(cat==='法器'){
    return finite(it?.attack,it?.val,record?.attack,record?.aiOriginalAttack,record?.baseAttack,record?.val);
  }
  if(cat==='防具'){
    return finite(it?.defense,it?.val,record?.defense,record?.aiOriginalDefense,record?.baseDefense,record?.val);
  }
  return finite(it?.val,record?.val);
}
function enhanceLevel(record){return Math.max(0,Math.floor(finite(record?.enhance,0)))}
function finalValue(record,it){
  const base=baseValue(record,it);
  return base*(1+ENHANCE_RATE*enhanceLevel(record));
}
function valueBreakdown(record,it){
  const cat=equipCat(record,it);
  const label=cat==='防具'?'防禦':'攻擊';
  const base=baseValue(record,it);
  const lv=enhanceLevel(record);
  const bonus=base*ENHANCE_RATE*lv;
  const total=base+bonus;
  if(base<=0){
    return `${label}數值未設定（物品 ID：${escapeHtml(resolveItemId(record)||'未知')}）`;
  }
  if(lv<=0)return `${label}力 +${Math.round(base)}`;
  return `基礎${label} ${Math.round(base)}｜強化 +${Math.round(bonus)}｜最終${label} ${Math.round(total)}（每級 +5%）`;
}
window.XIANXIA_EQUIPMENT_VALUE={
  patch:PATCH_ID,
  enhanceRate:ENHANCE_RATE,
  baseValue,
  finalValue,
  valueBreakdown
};

function repairEquipmentRecords(){
  if(!g||!Array.isArray(g.equipment))return 0;
  ensureCanonicalItems();
  let changed=0;
  g.equipment=g.equipment.map((raw,index)=>{
    if(!raw||typeof raw!=='object')return raw;
    const mapped=resolveItemId(raw);
    const it=IT?.[mapped];
    const fixed={...raw};
    if(mapped&&mapped!==safeText(raw.itemId)){fixed.itemId=mapped;changed++}
    if(it){
      if(!fixed.name){fixed.name=it.name;changed++}
      if(!fixed.cat||!['法器','防具'].includes(fixed.cat)){fixed.cat=it.cat;changed++}
      if(!fixed.type){fixed.type=it.type||it.cat;changed++}
    }
    const enh=enhanceLevel(fixed);
    if(fixed.enhance!==enh){fixed.enhance=enh;changed++}
    if(!fixed.uid){fixed.uid=`eq_fix_${Date.now()}_${index}_${Math.random().toString(36).slice(2,7)}`;changed++}
    return fixed;
  }).filter(Boolean);
  return changed;
}

function robustAttack(){
  if(!g)return 0;
  let total=finite(realmOf(g.lv)?.atk);
  const w=typeof getWeapon==='function'?getWeapon():null;
  if(w){
    const it=resolveItem(w);
    total+=finalValue(w,it);
    if(safeText(w.type||it?.type)==='飛劍')total*=1.5;
    if(g.techniques?.includes('green_sword')&&safeText(w.type||it?.type)==='飛劍')total*=1.1;
  }
  if(g.techniques?.includes('golden_dragon'))total*=1.02;
  return Math.round(total);
}
function robustDefense(){
  if(!g)return 0;
  let total=finite(realmOf(g.lv)?.def);
  const a=typeof getArmor==='function'?getArmor():null;
  if(a)total+=finalValue(a,resolveItem(a));
  if(g.techniques?.includes('golden_dragon'))total*=1.05;
  return Math.round(total);
}

function itemEffectText(it,record=null){
  if(record&&['法器','防具'].includes(equipCat(record,it)))return valueBreakdown(record,it);
  if(!it)return '物品資料異常，請聯絡管理員';
  const eff=safeText(it.eff);
  const val=finite(it.val);
  if(eff==='體力回復')return `使用後恢復 ${val} 點體力`;
  if(eff==='精力回復')return `使用後恢復 ${val} 點精力`;
  if(eff==='療傷')return '使用後解除一項外傷狀態';
  if(eff==='攻擊')return `裝備後攻擊力 +${val}`;
  if(eff==='防禦')return `裝備後防禦力 +${val}`;
  if(eff==='投擲')return `戰鬥中造成固定 ${val} 點傷害`;
  if(eff==='突破增益')return `突破成功率增加 ${val}%`;
  if(eff==='合成材料')return '可作為煉丹或煉器材料';
  return safeText(it.detail||it.desc||eff||'效果資料未設定');
}

function renderBag(tab='bag'){
  try{
    ensureCanonicalItems();
    const repaired=repairEquipmentRecords();
    if(repaired>0){
      try{saveGame(false)}catch(_){}
      try{toast(`已修復 ${repaired} 筆裝備資料`)}catch(_){}
    }
    let h='<h3>行囊與鑄器</h3><div class="tabs">'+
      `<button class="${tab==='bag'?'on':''}" onclick="openBag('bag')">道具</button>`+
      `<button class="${tab==='equip'?'on':''}" onclick="openBag('equip')">裝備</button>`+
      `<button class="${tab==='forge'?'on':''}" onclick="openBag('forge')">獨立強化</button></div>`;

    if(tab==='bag'){
      const inv=(g&&g.inv&&typeof g.inv==='object')?g.inv:{};
      const ids=Object.keys(inv).filter(id=>finite(inv[id])>0);
      if(!ids.length)h+='<p class="small">行囊空空如也。</p>';
      for(const id of ids){
        try{
          const it=resolveItem(id);
          const name=it?.name||`未知物品 ${id}`;
          const cat=it?.cat||'資料異常';
          const effect=itemEffectText(it);
          h+=`<div class="list-row"><div class="grow"><strong>${escapeHtml(name)} ×${finite(inv[id])}</strong>`+
             `<small>${escapeHtml(cat)} · ${escapeHtml(effect)}</small></div>`+
             `${it&&typeof canUseOutside==='function'&&canUseOutside(it)?`<button class="btn" onclick="useOutside('${escapeHtml(id)}')">使用</button>`:''}</div>`;
        }catch(err){
          console.error('[Equipment FIX] bag item failed',id,err);
          h+=`<div class="list-row"><div class="grow"><strong>異常物品 ${escapeHtml(id)}</strong><small>此項資料異常，但不影響其他行囊內容。</small></div></div>`;
        }
      }
    }else if(tab==='equip'){
      const list=Array.isArray(g?.equipment)?g.equipment:[];
      if(!list.length)h+='<p class="small">尚未取得裝備。</p>';
      for(const e of list){
        try{
          const it=resolveItem(e);
          const name=e?.name||it?.name||'未知裝備';
          const detail=valueBreakdown(e,it);
          const equipped=e.uid===g.weaponUid||e.uid===g.armorUid;
          h+=`<div class="list-row"><div class="grow"><strong>${escapeHtml(name)} +${enhanceLevel(e)}${equipped?' <span class="pill">已裝備</span>':''}</strong>`+
             `<small>${escapeHtml(equipCat(e,it)||'裝備')} · ${escapeHtml(detail)}</small></div>`+
             `<button class="btn" onclick="equipItem('${escapeHtml(e.uid)}')">裝備</button></div>`;
        }catch(err){
          console.error('[Equipment FIX] equipment row failed',e,err);
          h+='<div class="list-row"><div class="grow"><strong>異常裝備資料</strong><small>此件裝備無法解析，但其他行囊內容仍可使用。</small></div></div>';
        }
      }
    }else{
      h+='<div class="notice">強化實際公式：最終數值＝基礎數值 ×（1＋強化等級 × 5%）。+0→+6 必成；+6 後成功率逐級減半。</div>'+
         `<p class="small">庚精：${finite(g?.inv?.['8301'])}</p>`;
      const list=Array.isArray(g?.equipment)?g.equipment:[];
      if(!list.length)h+='<p class="small">沒有可強化的裝備。</p>';
      for(const e of list){
        try{
          const it=resolveItem(e);
          const lv=enhanceLevel(e);
          const rate=lv<6?100:Math.pow(.5,lv-5)*100;
          h+=`<div class="list-row"><div class="grow"><strong>${escapeHtml(e.name||it?.name||'未知裝備')} +${lv}</strong>`+
             `<small>${escapeHtml(valueBreakdown(e,it))}<br>下一級成功率 ${rate.toFixed(rate<10?2:0)}%</small></div>`+
             `<button class="btn gold" onclick="enhanceItem('${escapeHtml(e.uid)}')">消耗1庚精</button></div>`;
        }catch(err){
          console.error('[Equipment FIX] forge row failed',e,err);
        }
      }
    }
    h+='<button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">關閉</button>';
    sheet(h);
  }catch(err){
    console.error('[Equipment FIX] openBag fatal',err);
    try{toast('行囊資料有異常，已啟用安全模式')}catch(_){}
    sheet('<h3>行囊安全模式</h3><p>部分裝備資料異常，已阻止整個行囊崩潰。請將主控台錯誤交給管理員。</p><button class="btn" style="width:100%" onclick="closeOv()">關閉</button>');
  }
}

function install(){
  ensureCanonicalItems();
  repairEquipmentRecords();
  try{
    pAtk=robustAttack;
    pDef=robustDefense;
    openBag=renderBag;
  }catch(err){console.error('[Equipment FIX] override failed',err)}
  window.XIANXIA_ITEM_EFFECT_TEXT=itemEffectText;
  try{render()}catch(_){}
  console.info(`[${PATCH_ID}] active; enhancement=${ENHANCE_RATE*100}% per level`);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
else setTimeout(install,0);
})();
