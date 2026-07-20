/* 修仙大逃殺 V14.3 FIX1｜介面與世界地圖累積修正版 */
(function(){
  'use strict';
  const VERSION='14.3-fix1';
  const ASSET='assets/world_map/';
  const FILES={plain:'plain.webp',forest:'forest.webp',desert:'desert.webp',ice:'ice.webp',sea:'sea.webp',yinyang:'yinyang_sea.webp',icefire:'icefire_island.webp',kunlun:'kunlun.webp',ruin:'ancient_ruins.webp',battle:'ancient_battlefield.webp',market:'market.webp',village:'village.webp'};
  const LABELS={plain:'荒野',forest:'樹海',desert:'沙漠',ice:'冰原',sea:'海域',yinyang:'陰陽海',icefire:'冰火島',kunlun:'崑崙山',ruin:'上古遺跡',battle:'遠古戰場',market:'坊市',village:'村落'};

  /* 明確座標地貌，不再依名稱猜測。命名地點只改視覺地貌，不改遊戲 zone、移動與事件規則。 */
  const TERRAIN_ROWS={
    A:['village','village','plain','plain','plain','market','plain','ice','ice','ice'],
    B:['plain','plain','plain','village','plain','plain','forest','forest','kunlun','ice'],
    C:['plain','plain','market','market','market','forest','forest','plain','ice','ice'],
    D:['plain','plain','plain','plain','plain','plain','desert','desert','desert','plain'],
    E:['plain','plain','plain','plain','ruin','plain','desert','desert','plain','plain'],
    F:['plain','village','plain','plain','plain','battle','battle','sea','sea','sea'],
    G:['plain','plain','plain','plain','plain','ruin','plain','sea','yinyang','yinyang'],
    H:['plain','plain','plain','forest','forest','plain','plain','sea','yinyang','icefire'],
    I:['plain','plain','plain','plain','forest','plain','plain','sea','yinyang','yinyang'],
    J:['plain','village','plain','plain','plain','plain','plain','sea','sea','yinyang']
  };
  const TERRAIN=Object.create(null);
  Object.entries(TERRAIN_ROWS).forEach(([row,arr])=>arr.forEach((t,i)=>TERRAIN[row+'-'+(i+1)]=t));
  const NAMED={
    '青牛谷':'village','萬寶交易所':'market','青雲坊市':'market','萬木森域':'forest','迷霧林':'forest',
    '赤砂荒漠':'desert','太古戰場':'battle','上古遺跡':'ruin','崑崙仙山':'kunlun','北天宮':'ice',
    '玄霜冰原':'ice','滄溟外海':'sea','冰火島':'icefire','陰陽海':'yinyang','鎮海燈塔':'yinyang'
  };
  function coord(r,c){return String.fromCharCode(65+Number(r))+'-'+(Number(c)+1)}
  function infoFor(r,c){
    const co=coord(r,c), z=(typeof zoneAt==='function'&&window.C)?zoneAt(Number(r),Number(c)):null;
    const type=(z&&NAMED[z.name])||TERRAIN[co]||'plain';
    return {coord:co,zone:z,type,label:z?z.name:LABELS[type],terrainLabel:LABELS[type],file:FILES[type]||FILES.plain};
  }
  function currentInfo(){return window.g&&g.pos?infoFor(g.pos.r,g.pos.c):infoFor(0,0)}

  function updateCurrentScene(){
    const scene=document.querySelector('.world-scene'); if(!scene||!window.g)return;
    const i=currentInfo();
    scene.classList.add('v14f-scene'); scene.dataset.terrain=i.type;
    scene.style.setProperty('--v14-scene-image','url("'+ASSET+i.file+'?v=143fix1")');
    const zone=document.getElementById('sceneZone'), co=document.getElementById('sceneCoord');
    if(zone) zone.textContent=i.label;
    if(co) co.textContent=i.coord+' · '+i.terrainLabel;
    let badge=scene.querySelector('.v14f-terrain-badge');
    if(!badge){badge=document.createElement('span');badge.className='v14f-terrain-badge';scene.appendChild(badge)}
    badge.textContent=i.terrainLabel;
  }

  function aiCountAt(co){return Array.isArray(window.ai)?ai.filter(a=>a&&a.alive&&a.coord===co).length:0}
  function buildMap(){
    if(!window.g||typeof bigMove!=='function'||typeof mapMoveDistance!=='function'||typeof sheet!=='function')return;
    const rng=Math.max(1,Number(bigMove(g.big))||1), here=coord(g.pos.r,g.pos.c);
    let h='<div class="v14f-map-title"><div><h3>十方山海圖</h3><p class="small">御風距離 '+rng+' 格；地貌已按世界區域固定配置。</p></div><span class="v14f-map-version">FIX1</span></div>';
    h+='<div class="v14f-map-legend"><span><i class="me"></i>目前位置</span><span><i class="go"></i>可前往</span><span><i class="far"></i>超出距離</span></div><div class="v14f-map-grid">';
    for(let r=0;r<10;r++)for(let c=0;c<10;c++){
      const i=infoFor(r,c), dist=mapMoveDistance(r,c), me=i.coord===here, reachable=!me&&dist>=1&&dist<=rng, count=aiCountAt(i.coord);
      h+='<button type="button" class="v14f-cell '+(me?'me ':'')+(!reachable&&!me?'block ':'')+'" style="--cell-bg:url(&quot;'+ASSET+i.file+'?v=143fix1&quot;)" '+(reachable?'onclick="moveTo('+r+','+c+')"':'disabled')+' aria-label="'+i.label+' '+i.coord+' '+(me?'目前位置':reachable?'可移動':'不可移動')+'">';
      h+='<span class="v14f-cell-shade"></span><span class="v14f-cell-terrain">'+i.terrainLabel+'</span><span class="v14f-cell-copy"><b>'+i.label+'</b><small>'+i.coord+'</small>'+(count?'<em>修士 '+count+'</em>':'')+'</span></button>';
    }
    h+='</div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">關閉地圖</button>';
    sheet(h);
    const s=document.getElementById('sheet'); if(s)s.classList.add('v14f-map-sheet');
  }

  const previousOpen=window.openWorldMap;
  window.openWorldMap=buildMap;
  const previousRender=window.render;
  if(typeof previousRender==='function'){
    window.render=function(){const out=previousRender.apply(this,arguments);updateCurrentScene();return out};
  }
  const previousMove=window.moveTo;
  if(typeof previousMove==='function'){
    window.moveTo=function(){const out=previousMove.apply(this,arguments);setTimeout(updateCurrentScene,0);return out};
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.documentElement.dataset.v14Ui=VERSION;
    const header=document.querySelector('.brand-tag'); if(header)header.textContent='V14.3 · WORLD MAP FIX1';
    setTimeout(updateCurrentScene,300);
  });
  window.V143_FIX1={VERSION,TERRAIN,infoFor,updateCurrentScene,previousOpen};
})();
