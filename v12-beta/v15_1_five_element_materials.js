(()=>{
'use strict';
const BUILD='V15.1-FIVE-ELEMENT-MATERIALS-PHASE1';
const ITEMS={
 '8401':{name:'鳳凰火羽(火)',cat:'附魔材料',eff:'五行附魔',val:1,type:'火',detail:'火性附魔：追加原傷害 20%～25% 火性傷害。'},
 '8402':{name:'玄武背甲(水)',cat:'附魔材料',eff:'五行附魔',val:1,type:'水',detail:'水性附魔：額外削減對方最大精力 3%，不扣體力。'},
 '8403':{name:'青龍鱗(木)',cat:'附魔材料',eff:'五行附魔',val:1,type:'木',detail:'木性附魔：將實際造成傷害的 20% 轉為自身體力。'},
 '8404':{name:'白虎牙(金)',cat:'附魔材料',eff:'五行附魔',val:1,type:'金',detail:'金性附魔：暴擊率提高 25%，暴擊傷害倍率 1.5。'},
 '8405':{name:'麒麟角(土)',cat:'附魔材料',eff:'五行附魔',val:1,type:'土',detail:'土性附魔：自身受到的所有最終傷害降低 25%。'},
 '8420':{name:'赤陽器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,type:'攻擊',detail:'攻擊器紋 3%～8%。'},
 '8421':{name:'玄甲器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,type:'防禦',detail:'防禦器紋 3%～8%。'},
 '8422':{name:'雷鳴器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,type:'暴擊',detail:'暴擊器紋 2%～6%。'},
 '8423':{name:'長生器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,type:'體力',detail:'體力器紋 4%～10%。'},
 '8424':{name:'靈泉器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,type:'精力',detail:'精力器紋 3%～8%。'}
};
function patch(){
  if(typeof IT==='undefined'||!IT)return false;
  Object.entries(ITEMS).forEach(([id,row])=>{IT[id]={...(IT[id]||{}),...row};});
  if(window.IT&&window.IT!==IT)Object.assign(window.IT,IT);
  window.V151_FIVE_ELEMENT_MATERIALS=ITEMS;
  console.info('['+BUILD+'] materials registered');
  return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(patch()||tries>80)clearInterval(timer)},250);
})();
