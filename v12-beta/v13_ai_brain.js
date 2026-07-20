'use strict';
(() => {
  const state={timer:null,busy:false,lastRun:0};
  function cloud(){try{return typeof cloudState!=='undefined'&&cloudState?cloudState:(window.cloudState||null)}catch{return window.cloudState||null}}
  async function tick(){
    if(state.busy) return;
    const cs=cloud();
    if(!cs?.enabled||!cs?.user||!cs?.client) return;
    state.busy=true;
    try{
      const {data,error}=await cs.client.rpc('process_ai_brain_batch',{p_limit:25});
      if(error) throw error;
      state.lastRun=Date.now();
      window.dispatchEvent(new CustomEvent('xianxia:ai-brain-tick',{detail:data}));
    }catch(e){ console.warn('[V13.1 AI Brain]',e.message||e); }
    finally{ state.busy=false; }
  }
  function stop(){ if(state.timer){clearInterval(state.timer);state.timer=null;} }
  function start(){ stop(); state.timer=setInterval(tick,15000); setTimeout(tick,4000); }
  window.V13_AI_BRAIN={tick,start,stop,state};
  if(!window.XIANXIA_V13_EXTERNAL_SCHEDULER){
    window.addEventListener('load',start,{once:true});
  }
})();
