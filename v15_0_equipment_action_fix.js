(()=>{
'use strict';

const PATCH_ID='V15.0-EQUIPMENT-ACTION-FIX3';

function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
function sid(v){return v==null?'':String(v)}
function getItemByEquipment(e){
  if(!e||typeof e!=='object')return null;
  const id=sid(e.itemId||e.item_id);
  if(window.IT?.[id])return window.IT[id];
  const aliases={
    '斬仙劍':'9601',
    '兩儀斬仙劍':'9601',
    '北辰玄冰甲':'9602'
  };
  const mapped=aliases[sid(e.name)];
  return mapped&&window.IT?.[mapped]?window.IT[mapped]:null;
}
function normalizedCat(e){
  const it=getItemByEquipment(e);
  const raw=sid(e?.cat||it?.cat||e?.type||it?.type);
  if(raw==='法器'||raw.includes('劍')||raw.includes('刀')||raw.includes('槍')||raw.includes('法器'))return '法器';
  if(raw==='防具'||raw.includes('甲')||raw.includes('袍')||raw.includes('衣')||raw.includes('防具'))return '防具';
  return '';
}
function findEquipment(uid){
  if(!window.g||!Array.isArray(g.equipment))return null;
  return g.equipment.find(x=>sid(x?.uid)===sid(uid))||null;
}
function persistAndRefresh(tab){
  try{if(typeof saveGame==='function')saveGame(false)}catch(e){console.warn('[FIX3 save]',e)}
  try{if(typeof render==='function')render()}catch(e){console.warn('[FIX3 render]',e)}
  try{if(typeof openBag==='function')openBag(tab)}catch(e){console.warn('[FIX3 bag]',e)}
}
function robustEquip(uid){
  const e=findEquipment(uid);
  if(!e){try{toast('找不到這件裝備，請重新整理後再試')}catch(_){};return}
  const cat=normalizedCat(e);
  if(!cat){try{toast('這件物品的裝備類型尚未設定')}catch(_){};return}
  e.cat=cat;
  const it=getItemByEquipment(e);
  if(it){
    e.itemId=sid(e.itemId||e.item_id||Object.keys(IT).find(k=>IT[k]===it));
    e.name=e.name||it.name;
    e.type=e.type||it.type||it.cat;
  }
  if(cat==='法器')g.weaponUid=e.uid;
  else g.armorUid=e.uid;
  for(const x of g.equipment){
    if(normalizedCat(x)===cat)x.equipped=(x.uid===e.uid);
  }
  try{log(`裝備 ${e.name||it?.name||'裝備'} +${Math.max(0,Math.floor(n(e.enhance)))}。`,'lg')}catch(_){}
  persistAndRefresh('equip');
}
function robustEnhance(uid){
  const e=findEquipment(uid);
  if(!e){try{toast('找不到這件裝備，請重新整理後再試')}catch(_){};return}
  const cat=normalizedCat(e);
  if(!cat){try{toast('此物品不是可強化的武器或防具')}catch(_){};return}
  g.inv=(g.inv&&typeof g.inv==='object')?g.inv:{};
  if(n(g.inv['8301'])<=0){try{toast('庚精不足，無法強化')}catch(_){};return}
  e.cat=cat;
  e.enhance=Math.max(0,Math.floor(n(e.enhance)));
  g.inv['8301']=Math.max(0,n(g.inv['8301'])-1);
  const rate=e.enhance<6?1:Math.pow(0.5,e.enhance-5);
  const success=Math.random()<rate;
  if(success){
    e.enhance++;
    try{log(`${e.name||'裝備'} 強化成功，達 +${e.enhance}。`,'lg')}catch(_){}
  }else{
    const roll=Math.random();
    if(roll<0.4){
      g.equipment=g.equipment.filter(x=>sid(x.uid)!==sid(uid));
      if(sid(g.weaponUid)===sid(uid))g.weaponUid=null;
      if(sid(g.armorUid)===sid(uid))g.armorUid=null;
      try{log(`${e.name||'裝備'} 強化失敗，裝備化為飛灰。`,'ld')}catch(_){}
    }else if(roll<0.7){
      try{log(`${e.name||'裝備'} 強化失敗，等級維持。`,'la')}catch(_){}
    }else{
      e.enhance=Math.max(0,e.enhance-1);
      try{log(`${e.name||'裝備'} 強化失敗，降為 +${e.enhance}。`,'la')}catch(_){}
    }
  }
  persistAndRefresh('forge');
}
function repairAll(){
  try{
    if(window.XIANXIA_CONVERT_STACKED_EQUIPMENT){
      window.XIANXIA_CONVERT_STACKED_EQUIPMENT('裝備操作修復');
    }
    if(!window.g||!Array.isArray(g.equipment))return;
    let changed=false;
    for(const e of g.equipment){
      if(!e||typeof e!=='object')continue;
      const cat=normalizedCat(e);
      if(cat&&e.cat!==cat){e.cat=cat;changed=true}
      if(!e.uid){e.uid=`eq_fix3_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;changed=true}
      e.enhance=Math.max(0,Math.floor(n(e.enhance)));
    }
    if(changed&&typeof saveGame==='function')saveGame(false);
  }catch(err){console.error('[FIX3 repair]',err)}
}
function install(){
  repairAll();
  window.equipItem=robustEquip;
  window.enhanceItem=robustEnhance;
  try{
    equipItem=robustEquip;
    enhanceItem=robustEnhance;
  }catch(_){}
  console.info(`[${PATCH_ID}] installed`);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,50));
else setTimeout(install,50);
setInterval(repairAll,2000);
})();
