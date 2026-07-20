(()=>{
  'use strict';
  const ready=(fn)=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  const button=(text,cls)=>{const b=document.createElement('button');b.type='button';b.className=`btn ${cls}`;b.textContent=text;return b;};

  function compactCharacter(character){
    if(!character||character.dataset.v145aReady==='1') return;
    character.dataset.v145aReady='1';

    const name=character.querySelector('.avatar-name');
    const realm=character.querySelector('.realm-line');
    const meters=[...character.querySelectorAll(':scope > .meter')];
    const stats=character.querySelector(':scope > .stat-grid');
    const techWrap=character.querySelector(':scope > .technique-dock-wrap');

    if(name&&realm&&meters.length&&techWrap){
      const core=document.createElement('div');
      core.className='v145a-character-core';
      const vitals=document.createElement('section');
      vitals.className='v145a-vitals';
      const identity=document.createElement('div');
      identity.className='v145a-identity';
      identity.append(name,realm);
      vitals.append(identity,...meters);
      core.append(vitals,techWrap);
      const avatar=character.querySelector('.avatar-wrap');
      if(avatar) avatar.insertAdjacentElement('afterend',core); else character.appendChild(core);
      if(stats) core.insertAdjacentElement('afterend',stats);
    }

    const toggle=button('展開完整角色資料','v145a-character-toggle');
    toggle.addEventListener('click',()=>{
      const open=character.classList.toggle('v145a-expanded');
      toggle.textContent=open?'收合完整角色資料':'展開完整角色資料';
    });
    character.appendChild(toggle);
  }

  function compactTechniques(){
    const tech=document.getElementById('techniqueDock');
    if(!tech) return;
    tech.addEventListener('click',(e)=>{
      const slot=e.target.closest('.technique-slot');
      if(!slot) return;
      slot.classList.toggle('v145a-tech-expanded');
    });
  }

  function compactPanels(){
    const dashboard=document.querySelector('#game .dashboard');
    const world=document.querySelector('#game .world-panel');
    const character=document.querySelector('#game .character-panel');
    const intel=document.querySelector('#game .intel-panel');
    if(dashboard&&world&&character){
      dashboard.insertBefore(character,dashboard.firstChild);
      dashboard.insertBefore(world,character.nextSibling);
      if(intel) dashboard.appendChild(intel);
    }
    compactCharacter(character);

    if(intel&&!intel.querySelector('.v145a-intel-toggle')){
      const t=button('展開區域情報','v145a-intel-toggle');
      t.addEventListener('click',()=>{
        const open=intel.classList.toggle('v145a-expanded');
        t.textContent=open?'收合區域情報':'展開區域情報';
      });
      intel.insertBefore(t,intel.children[1]||null);
    }

    const chat=document.getElementById('worldChatDock');
    if(chat&&!chat.querySelector('.v145a-chat-toggle')){
      const t=button('展開傳音與輸入','v145a-chat-toggle');
      t.addEventListener('click',()=>{
        const open=chat.classList.toggle('v145a-expanded');
        t.textContent=open?'收合傳音':'展開傳音與輸入';
      });
      chat.appendChild(t);
    }
  }

  function removeDuplicateAuctionFloaters(){
    const candidates=[...document.querySelectorAll('button,a')].filter(el=>el.textContent.trim()==='萬寶拍賣');
    candidates.forEach((el,i)=>{ if(i>0||el.closest('.character-panel,.comm-panel')) el.classList.add('v145a-hidden-auction-floater'); });
  }

  function compactNav(){
    const nav=document.querySelector('#game .mobile-nav');
    if(!nav) return;
    const buttons=[...nav.querySelectorAll('button')];
    if(buttons[4]){
      buttons[4].innerHTML='<b>更</b>更多';
      buttons[4].onclick=()=>document.querySelector('#game .character-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }

  ready(()=>{
    compactPanels();
    compactTechniques();
    compactNav();
    removeDuplicateAuctionFloaters();
    new MutationObserver(removeDuplicateAuctionFloaters).observe(document.body,{childList:true,subtree:true});
  });
})();
