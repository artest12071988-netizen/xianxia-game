(()=>{
'use strict';
const BUILD='V15.1-PHASE3-DIVINE-BEAST-AI-BRIDGE';
const S={timer:null,running:false,last:null,lastError:null};

function cloud(){
  try{
    if(typeof cloudState!=='undefined'&&cloudState)return cloudState;
  }catch(_){}
  return window.XIANXIA_CLOUD_STATE||window.cloudState||null;
}
function client(){return cloud()?.client||null}
function ready(){return !!(cloud()?.enabled&&cloud()?.user&&client())}

async function cycle(force=false){
  if(S.running||!ready())return null;
  S.running=true;
  try{
    const {data,error}=await client().rpc('divine_beast_ai_cycle',{
      p_limit:25,
      p_force:!!force
    });
    if(error)throw error;
    S.last=data||null;
    S.lastError=null;
    if(data?.processed>0)
      console.info('['+BUILD+'] AI 神獸循環',data);
    return data;
  }catch(e){
    S.lastError=e;
    const m=String(e?.message||e);
    if(!/Could not find|does not exist/i.test(m))
      console.warn('['+BUILD+'] cycle failed',e);
    return null;
  }finally{
    S.running=false;
  }
}

function start(){
  if(S.timer)return;
  setTimeout(()=>cycle(false),4000);
  S.timer=setInterval(()=>cycle(false),60000);
  console.info('['+BUILD+'] active');
}
function stop(){
  if(S.timer)clearInterval(S.timer);
  S.timer=null;
}
window.V151_PHASE3_AI={
  build:BUILD,
  cycle,
  start,
  stop,
  state:S,
  connection:()=>({
    ready:ready(),
    userId:cloud()?.user?.id||null,
    rpcReady:!!client()
  })
};
if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
