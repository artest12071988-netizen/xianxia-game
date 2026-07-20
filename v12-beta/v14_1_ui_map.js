/* 修仙大逃殺 V14.1｜非侵入式 UI / Map enhancer */
(function(){
  'use strict';
  const original=window.openWorldMap;
  if(typeof original!=='function'){console.warn('[V14.1] openWorldMap not found');return;}
  const terrain=(name)=>{
    name=String(name||'');
    if(/冰|寒|雪|崑崙/.test(name))return'ice';
    if(/火|烈|炎/.test(name))return'fire';
    if(/樹|林|谷|青牛/.test(name))return'forest';
    if(/沙|漠/.test(name))return'desert';
    if(/海|島|潮/.test(name))return'sea';
    if(/遺跡|戰場|古|墓|墟/.test(name))return'ruin';
    return'plain';
  };
  window.openWorldMap=function(){
    original.apply(this,arguments);
    const sheet=document.getElementById('sheet');
    if(!sheet)return;
    const grid=sheet.querySelector('.grid');
    if(!grid)return;
    grid.classList.add('v14-map-grid');
    const h3=sheet.querySelector('h3');
    if(h3){
      const head=document.createElement('div');head.className='v14-map-head';
      h3.parentNode.insertBefore(head,h3);head.appendChild(h3);
    }
    const p=sheet.querySelector('p.small');
    if(p){const legend=document.createElement('div');legend.className='v14-map-legend';legend.innerHTML='<span>青框：目前位置</span><span>明亮：可御風</span><span>黯淡：超出距離</span>';p.after(legend);}
    grid.querySelectorAll('.cell').forEach(btn=>{
      const html=btn.innerHTML;
      const name=(btn.querySelector('b')?.textContent||'荒野').trim();
      const coord=(btn.textContent.match(/[A-J]-\d{1,2}/)||[''])[0];
      const aiNode=btn.querySelector('.ai');
      btn.dataset.terrain=terrain(name);
      btn.innerHTML='<span class="v14-cell-copy"><b>'+name+'</b><small>'+coord+'</small>'+(aiNode?'<span class="ai">'+aiNode.textContent+'</span>':'')+'</span>';
      btn.setAttribute('aria-label',name+' '+coord+(btn.disabled?' 不可移動':' 可移動'));
      btn.dataset.v14Original=html;
    });
  };
  document.documentElement.dataset.v14Ui='14.1';
})();
