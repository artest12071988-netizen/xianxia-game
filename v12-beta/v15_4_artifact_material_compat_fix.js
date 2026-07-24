(()=>{
'use strict';
const BUILD='V15.4-ARTIFACT-MATERIAL-COMPAT-FIX1-20260724';
const ITEMS={
 '8501':{name:'赤陽器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'攻擊器紋 3%～8%'},
 '8502':{name:'玄甲器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'防禦器紋 3%～8%'},
 '8503':{name:'雷鳴器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'暴擊器紋 2%～6%'},
 '8504':{name:'長生器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'體力器紋 4%～10%'},
 '8505':{name:'靈泉器紋砂',cat:'器紋材料',eff:'刻印器紋',val:0,detail:'精力器紋 3%～8%'},
 '8410':{name:'淬器石',cat:'淬鍊材料',eff:'器紋系統',val:0,detail:'器紋刻滿後用於淬鍊'},
 '8411':{name:'護器符',cat:'護器材料',eff:'器紋系統',val:0,detail:'淬鍊失敗時保護法寶'},
 '8412':{name:'天工石',cat:'增幅材料',eff:'器紋系統',val:0,detail:'提高本次淬鍊成功率'},
 '8413':{name:'洗煉石',cat:'洗煉材料',eff:'器紋系統',val:0,detail:'重抽指定器紋數值'}
};
const LEGACY_SANDS={'8401':'8501','8402':'8502','8403':'8503','8404':'8504','8405':'8505'};
let migrating=false;
function register(){
 if(!window.IT)return false;
 for(const [id,it] of Object.entries(ITEMS))window.IT[id]={...(window.IT[id]||{}),...it};
 return true;
}
function migrate(){
 if(migrating||!window.g)return false;
 migrating=true;
 try{
  register();
  const inv=window.g.inv||(window.g.inv={});
  let changed=false;
  for(const [oldId,newId] of Object.entries(LEGACY_SANDS)){
   const n=Math.max(0,Math.floor(Number(inv[oldId])||0));
   if(n){inv[newId]=(Number(inv[newId])||0)+n;delete inv[oldId];changed=true;}
  }
  // 舊庚精可能在新版上線後才由後台補發；持續轉換，不再受一次性旗標限制。
  const oldForge=Math.max(0,Math.floor(Number(inv['8301'])||0));
  if(oldForge){inv['8410']=(Number(inv['8410'])||0)+oldForge;delete inv['8301'];changed=true;}
  if(changed){
   window.log?.('舊版器紋／強化材料已轉換為目前正式材料。','lg');
   Promise.resolve(window.saveGame?.(false)).catch(()=>{});
   window.render?.();
  }
  return changed;
 }finally{migrating=false;}
}
function wrapOpen(){
 const fn=window.openArtifactWorkshopV143;
 if(typeof fn!=='function'||fn.__v154MaterialCompat)return false;
 function wrapped(){migrate();return fn.apply(this,arguments)}
 wrapped.__v154MaterialCompat=true;
 window.openArtifactWorkshopV143=wrapped;
 return true;
}
function wrapBag(){
 const fn=window.openBag;
 if(typeof fn!=='function'||fn.__v154MaterialCompat)return false;
 function wrapped(){register();migrate();return fn.apply(this,arguments)}
 wrapped.__v154MaterialCompat=true;
 window.openBag=wrapped;
 return true;
}
let tries=0;
const timer=setInterval(()=>{
 tries++;
 register();migrate();wrapOpen();wrapBag();
 if(tries>80)clearInterval(timer);
},250);
window.addEventListener('xianxia:save-applied',()=>setTimeout(migrate,0));
console.info('[V15.4 ARTIFACT MATERIAL COMPAT FIX1] installed', {build:BUILD});
})();
