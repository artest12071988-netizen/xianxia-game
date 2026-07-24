(()=>{
'use strict';
const BUILD='V15.4-ARTIFACT-MATERIAL-COMPAT-FIX3-20260724';
const CANON={
 '8401':{name:'赤陽器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'攻擊器紋 3%～8%'},
 '8402':{name:'玄甲器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'防禦器紋 3%～8%'},
 '8403':{name:'雷鳴器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'暴擊器紋 2%～6%'},
 '8404':{name:'長生器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'體力器紋 4%～10%'},
 '8405':{name:'靈泉器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'精力器紋 3%～8%'},
 '8410':{name:'淬器石',cat:'淬鍊材料',eff:'器紋系統',val:0,detail:'器紋刻滿後用於淬鍊'},
 '8411':{name:'護器符',cat:'護器材料',eff:'器紋系統',val:0,detail:'淬鍊失敗時保護法寶'},
 '8412':{name:'天工石',cat:'增幅材料',eff:'器紋系統',val:0,detail:'提高本次淬鍊成功率'},
 '8413':{name:'洗煉石',cat:'洗煉材料',eff:'器紋系統',val:0,detail:'重抽指定器紋數值'}
};
const WRONG_TO_CANON={'8501':'8401','8502':'8402','8503':'8403','8504':'8404','8505':'8405'};
let busy=false;
function register(){
 if(!window.IT)return false;
 for(const [id,it] of Object.entries(CANON)) window.IT[id]={...(window.IT[id]||{}),...it};
 return true;
}
function normalizeInventory(){
 if(busy||!window.g)return false;
 busy=true;
 try{
  register();
  const inv=window.g.inv||(window.g.inv={});
  let changed=false;
  for(const [wrong,canon] of Object.entries(WRONG_TO_CANON)){
   const n=Math.max(0,Math.floor(Number(inv[wrong])||0));
   if(n){inv[canon]=(Number(inv[canon])||0)+n;delete inv[wrong];changed=true;}
  }
  // 8301 庚金是正式商店物品，禁止轉換、刪除或併入淬器石。
  if(changed){
   window.log?.('器紋材料已校正為天工器紋閣正式格式。','lg');
   Promise.resolve(window.saveGame?.(false)).catch(()=>{});
   window.render?.();
  }
  return changed;
 }finally{busy=false;}
}
function wrap(name){
 const fn=window[name];
 if(typeof fn!=='function'||fn.__v154ArtifactFix3)return false;
 const wrapped=function(){normalizeInventory();return fn.apply(this,arguments)};
 wrapped.__v154ArtifactFix3=true;
 window[name]=wrapped;
 return true;
}
let tries=0;
const timer=setInterval(()=>{
 tries++;
 register();normalizeInventory();
 wrap('openArtifactWorkshopV143');
 wrap('openBag');
 wrap('saveGame');
 if(tries>120)clearInterval(timer);
},250);
window.addEventListener('xianxia:save-applied',()=>setTimeout(normalizeInventory,0));
window.addEventListener('focus',()=>setTimeout(normalizeInventory,0));
console.info('[V15.4 ARTIFACT MATERIAL COMPAT FIX3] installed',{build:BUILD});
})();
