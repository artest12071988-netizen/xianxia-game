(()=>{
'use strict';
const BUILD='V15.1-DIVINE-BEAST-WORLD-BRIDGE-PHASE1';
const S={timer:null,running:false,last:null};
function client(){try{return typeof cloudState!=='undefined'&&cloudState?.client?cloudState.client:null}catch(_){return null}}
function loggedIn(){try{return !!(cloudState?.enabled&&cloudState?.user&&client())}catch(_){return false}}
async function tick(){
  if(S.running||!loggedIn())return null;
  S.running=true;
  try{
    const {data,error}=await client().rpc('divine_beast_world_tick');
    if(error)throw error;
    S.last=data||null;
    return data;
  }catch(e){
    const m=String(e?.message||e);
    if(!/Could not find the function|does not exist/i.test(m))console.warn('['+BUILD+'] tick failed',e);
    return null;
  }finally{S.running=false;}
}
function start(){
  if(S.timer)return;
  tick();
  S.timer=setInterval(tick,60000);
  console.info('['+BUILD+'] active');
}
function stop(){if(S.timer)clearInterval(S.timer);S.timer=null}
window.V151_DIVINE_BEASTS={build:BUILD,tick,start,stop,state:S};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,1000),{once:true});else setTimeout(start,1000);
})();
