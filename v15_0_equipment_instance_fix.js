(()=>{
'use strict';

const PATCH_ID='V15.0-EQUIPMENT-INSTANCE-FIX2';
let converting=false;

function qty(v){
  const n=Math.floor(Number(v));
  return Number.isFinite(n)&&n>0?n:0;
}
function isEquip(id){
  try{
    if(typeof isEquipmentId==='function'&&isEquipmentId(String(id)))return true;
  }catch(_){}
  const it=window.IT?.[String(id)]||null;
  return !!it&&['法器','防具'].includes(String(it.cat||''));
}
function makeEquip(id){
  const sid=String(id);
  try{
    if(typeof newEquipment==='function'){
      const e=newEquipment(sid);
      if(e&&typeof e==='object')return e;
    }
  }catch(err){
    console.warn('[Equipment FIX2] newEquipment fallback',sid,err);
  }
  const it=window.IT?.[sid]||{};
  return {
    uid:`eq_${Date.now()}_${Math.random().toString(36).slice(2,10)}`,
    itemId:sid,
    name:String(it.name||`裝備 ${sid}`),
    cat:String(it.cat||'裝備'),
    type:String(it.type||it.cat||'裝備'),
    enhance:0,
    equipped:false
  };
}
function convertStackedEquipment(reason='自動修復'){
  if(converting||!window.g)return {converted:0,types:0};
  converting=true;
  try{
    g.inv=(g.inv&&typeof g.inv==='object')?g.inv:{};
    g.equipment=Array.isArray(g.equipment)?g.equipment:[];
    let converted=0,types=0;
    for(const id of Object.keys(g.inv)){
      const count=qty(g.inv[id]);
      if(!count||!isEquip(id))continue;
      types++;
      for(let i=0;i<count;i++)g.equipment.push(makeEquip(id));
      delete g.inv[id];
      converted+=count;
    }
    if(converted){
      try{
        if(typeof repairPlayerEquipment==='function')repairPlayerEquipment();
      }catch(err){console.warn('[Equipment FIX2] repairPlayerEquipment',err)}
      try{if(typeof saveGame==='function')saveGame(false)}catch(err){console.warn('[Equipment FIX2] save',err)}
      try{if(typeof render==='function')render()}catch(_){}
      try{if(typeof toast==='function')toast(`${reason}：已將 ${converted} 件堆疊裝備轉為可強化的獨立裝備`)}catch(_){}
      console.info(`[${PATCH_ID}] converted`,{converted,types});
    }
    return {converted,types};
  }finally{
    converting=false;
  }
}
window.XIANXIA_CONVERT_STACKED_EQUIPMENT=convertStackedEquipment;

function patchPremiumPurchase(){
  if(typeof window.buyPremiumItem!=='function'||window.buyPremiumItem.__v150fix2)return;
  const original=window.buyPremiumItem;
  window.buyPremiumItem=function(id,price){
    const sid=String(id);
    if(!isEquip(sid))return original.apply(this,arguments);
    if(Number(g?.yuanbao||0)<Number(price||0)){
      try{toast('商城元寶不足')}catch(_){}
      return;
    }
    g.yuanbao-=Number(price||0);
    g.equipment=Array.isArray(g.equipment)?g.equipment:[];
    g.equipment.push(makeEquip(sid));
    try{log(`購得 ${IT?.[sid]?.name||sid}。`,'lg')}catch(_){}
    try{saveGame(false);render();renderShop()}catch(_){}
  };
  window.buyPremiumItem.__v150fix2=true;
}
function patchBag(){
  if(typeof window.openBag!=='function'||window.openBag.__v150fix2)return;
  const original=window.openBag;
  window.openBag=function(tab='bag'){
    convertStackedEquipment('行囊修復');
    return original.call(this,tab);
  };
  window.openBag.__v150fix2=true;
}
function patchShop(){
  if(typeof window.renderShop!=='function'||window.renderShop.__v150fix2)return;
  const original=window.renderShop;
  window.renderShop=function(){
    convertStackedEquipment('商店資料修復');
    return original.apply(this,arguments);
  };
  window.renderShop.__v150fix2=true;
}
function monitor(){
  patchPremiumPurchase();
  patchBag();
  patchShop();
  convertStackedEquipment('裝備資料修復');
}
function init(){
  monitor();
  setInterval(monitor,1500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
else setTimeout(init,0);
})();
