(()=>{
  'use strict';
  const onReady=(fn)=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  const mkToggle=(text, cls)=>{
    const b=document.createElement('button');
    b.type='button'; b.className=`btn ${cls}`; b.textContent=text;
    return b;
  };
  onReady(()=>{
    const dashboard=document.querySelector('#game .dashboard');
    const world=document.querySelector('#game .world-panel');
    const character=document.querySelector('#game .character-panel');
    const intel=document.querySelector('#game .intel-panel');
    if(dashboard&&world&&character){
      dashboard.insertBefore(world,dashboard.firstChild);
      dashboard.insertBefore(character,world.nextSibling);
      if(intel) dashboard.appendChild(intel);
    }

    if(character&&!character.querySelector('.v145a-character-toggle')){
      const t=mkToggle('展開角色命盤與完整屬性','v145a-character-toggle');
      t.addEventListener('click',()=>{
        const open=character.classList.toggle('v145a-expanded');
        t.textContent=open?'收合角色命盤':'展開角色命盤與完整屬性';
      });
      character.appendChild(t);
    }

    if(intel&&!intel.querySelector('.v145a-intel-toggle')){
      const t=mkToggle('展開區域情報','v145a-intel-toggle');
      t.addEventListener('click',()=>{
        const open=intel.classList.toggle('v145a-expanded');
        t.textContent=open?'收合區域情報':'展開區域情報';
      });
      intel.insertBefore(t,intel.children[1]||null);
    }

    const chat=document.getElementById('worldChatDock');
    if(chat&&!chat.querySelector('.v145a-chat-toggle')){
      const t=mkToggle('展開傳音與輸入','v145a-chat-toggle');
      t.addEventListener('click',()=>{
        const open=chat.classList.toggle('v145a-expanded');
        t.textContent=open?'收合傳音':'展開傳音與輸入';
      });
      chat.appendChild(t);
    }

    const tech=document.getElementById('techniqueDock');
    if(tech){
      tech.addEventListener('click',(e)=>{
        const slot=e.target.closest('.technique-slot');
        if(slot) slot.classList.toggle('v145a-tech-expanded');
      });
    }

    /* Five-tab nav: final visible slot opens chat while preserving all legacy handlers. */
    const nav=document.querySelector('#game .mobile-nav');
    if(nav){
      const buttons=[...nav.querySelectorAll('button')];
      if(buttons[4]){ buttons[4].innerHTML='<b>更</b>更多'; buttons[4].onclick=()=>{
        if(character) character.classList.add('v145a-expanded');
        character?.scrollIntoView({behavior:'smooth',block:'start'});
      }; }
    }
  });
})();
