(()=>{
'use strict';
const BUILD='V15.4-ARTIFACT-MATERIAL-SAFETY-FIX4-20260724';
const ITEMS={
 '8301':{name:'庚金',cat:'強化材料',eff:'裝備強化',val:0,detail:'用於裝備 +1、+2……強化'},
 '8501':{name:'赤陽器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'攻擊器紋 3%～8%'},
 '8502':{name:'玄甲器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'防禦器紋 3%～8%'},
 '8503':{name:'雷鳴器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'暴擊器紋 2%～6%'},
 '8504':{name:'長生器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'體力器紋 4%～10%'},
 '8505':{name:'靈泉器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'精力器紋 3%～8%'},
 '8410':{name:'淬器石',cat:'保階材料',eff:'強化保階',val:0,detail:'強化失敗時防止強化等級倒退'},
 '8411':{name:'護器符',cat:'保護材料',eff:'裝備保護',val:0,detail:'強化失敗時防止裝備直接消失'},
 '8412':{name:'天工石',cat:'增幅材料',eff:'提高成功率',val:0,detail:'提高本次強化成功率'},
 '8413':{name:'洗煉石',cat:'洗煉材料',eff:'器紋洗煉',val:0,detail:'重抽指定器紋數值'}
};
function register(){if(!window.IT)return false;for(const [id,it] of Object.entries(ITEMS))window.IT[id]={...(window.IT[id]||{}),...it};return true;}
let tries=0;const timer=setInterval(()=>{tries++;if(register()||tries>120)clearInterval(timer)},250);
window.addEventListener('xianxia:save-applied',()=>setTimeout(register,0));
console.info('[V15.4 ARTIFACT MATERIAL SAFETY FIX4] installed',{build:BUILD,noInventoryConversion:true});
})();
