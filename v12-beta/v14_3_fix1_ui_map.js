/* 修仙大逃殺 V14.3 FIX2｜地圖開啟與移動緊急修正 */
(function(){
  'use strict';
  const VERSION='14.3-fix3';
  const ASSET='assets/world_map/';
  const FILES={plain:'plain.webp',forest:'forest.webp',desert:'desert.webp',ice:'ice.webp',northpalace:'north_palace.webp',sea:'sea.webp',yinyang:'yinyang_sea.webp',icefire:'icefire_island.webp',kunlun:'kunlun.webp',ruin:'ancient_ruins.webp',battle:'ancient_battlefield.webp',market:'market.webp',village:'village.webp'};
  const LABELS={plain:'荒野',forest:'樹海',desert:'沙漠',ice:'冰原',northpalace:'北寒天宮',sea:'海域',yinyang:'陰陽海',icefire:'冰火島',kunlun:'崑崙山',ruin:'上古修士遺跡',battle:'遠古戰場',market:'坊市',village:'村落'};
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
  Object.keys(TERRAIN_ROWS).forEach(function(row){
    TERRAIN_ROWS[row].forEach(function(type,index){TERRAIN[row+'-'+(index+1)]=type;});
  });
  const NAMED={
    '青牛谷':'village','萬寶交易所':'market','青雲坊市':'market','萬木森域':'forest','迷霧林':'forest',
    '赤砂荒漠':'desert','太古戰場':'battle','遠古戰場':'battle','上古遺跡':'ruin','崑崙仙山':'kunlun','崑崙山':'kunlun',
    '北天宮':'northpalace','北寒天宮':'northpalace','玄霜冰原':'ice','滄溟外海':'sea','海':'sea','冰火島':'icefire','烈火島':'icefire',
    '陰陽海':'yinyang','鎮海燈塔':'yinyang'
  };

  function gameReady(){
    return typeof g!=='undefined' && g && g.pos && typeof C!=='undefined' && C;
  }
  function coord(r,c){return String.fromCharCode(65+Number(r))+'-'+(Number(c)+1);}
  function infoFor(r,c){
    const co=coord(r,c);
    const z=(typeof zoneAt==='function' && typeof C!=='undefined' && C)?zoneAt(Number(r),Number(c)):null;
    const type=(z && NAMED[z.name]) || TERRAIN[co] || 'plain';
    return {coord:co,zone:z,type:type,label:z?z.name:LABELS[type],terrainLabel:LABELS[type],file:FILES[type]||FILES.plain};
  }
  function currentInfo(){return gameReady()?infoFor(g.pos.r,g.pos.c):infoFor(0,0);}

  function updateCurrentScene(){
    try{
      if(!gameReady())return;
      const scene=document.querySelector('.world-scene');
      if(!scene)return;
      const i=currentInfo();
      scene.classList.add('v14f-scene');
      scene.dataset.terrain=i.type;
      scene.style.setProperty('--v14-scene-image','url("'+ASSET+i.file+'?v=143fix3")');
      const zone=document.getElementById('sceneZone');
      const co=document.getElementById('sceneCoord');
      if(zone)zone.textContent=i.label;
      if(co)co.textContent=i.coord+' · '+i.terrainLabel;
      let badge=scene.querySelector('.v14f-terrain-badge');
      if(!badge){badge=document.createElement('span');badge.className='v14f-terrain-badge';scene.appendChild(badge);}
      badge.textContent=i.terrainLabel;
    }catch(err){console.error('[V14.3 FIX3] current scene update failed',err);}
  }

  function aiCountAt(co){
    if(typeof ai==='undefined' || !Array.isArray(ai))return 0;
    return ai.filter(function(a){return a&&a.alive&&a.coord===co;}).length;
  }

  const previousOpen=typeof window.openWorldMap==='function'?window.openWorldMap:null;
  function buildMap(){
    try{
      if(!gameReady() || typeof bigMove!=='function' || typeof mapMoveDistance!=='function' || typeof sheet!=='function'){
        if(previousOpen)return previousOpen();
        return;
      }
      const rng=Math.max(1,Number(bigMove(g.big))||1);
      const here=coord(g.pos.r,g.pos.c);
      let h='<div class="v14f-map-title"><div><h3>十方山海圖</h3><p class="small">御風距離 '+rng+' 格；點選亮起的地域即可移動。</p></div><span class="v14f-map-version">FIX3</span></div>';
      h+='<div class="v14f-map-legend"><span><i class="me"></i>目前位置</span><span><i class="go"></i>可前往</span><span><i class="far"></i>超出距離</span></div><div class="v14f-map-grid">';
      for(let r=0;r<10;r++){
        for(let c=0;c<10;c++){
          const i=infoFor(r,c);
          const dist=mapMoveDistance(r,c);
          const me=i.coord===here;
          const reachable=!me&&dist>=1&&dist<=rng;
          const count=aiCountAt(i.coord);
          h+='<button type="button" class="v14f-cell '+(me?'me ':'')+(!reachable&&!me?'block ':'')+'" style="--cell-bg:url(&quot;'+ASSET+i.file+'?v=143fix3&quot;)" '+(reachable?'onclick="moveTo('+r+','+c+')"':'disabled')+' aria-label="'+i.label+' '+i.coord+'">';
          h+='<span class="v14f-cell-shade"></span><span class="v14f-cell-terrain">'+i.terrainLabel+'</span><span class="v14f-cell-copy"><b>'+i.label+'</b><small>'+i.coord+'</small>'+(count?'<em>修士 '+count+'</em>':'')+'</span></button>';
        }
      }
      h+='</div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">關閉地圖</button>';
      sheet(h);
      const s=document.getElementById('sheet');
      if(s)s.classList.add('v14f-map-sheet');
    }catch(err){
      console.error('[V14.3 FIX3] map build failed, reverting to original map',err);
      if(previousOpen)return previousOpen();
      if(typeof toast==='function')toast('地圖載入失敗，請重新整理');
    }
  }

  window.openWorldMap=buildMap;

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){
    window.render=function(){
      const out=previousRender.apply(this,arguments);
      setTimeout(updateCurrentScene,0);
      return out;
    };
  }
  const previousMove=typeof window.moveTo==='function'?window.moveTo:null;
  if(previousMove){
    window.moveTo=function(){
      const out=previousMove.apply(this,arguments);
      setTimeout(updateCurrentScene,0);
      return out;
    };
  }

  document.addEventListener('DOMContentLoaded',function(){
    document.documentElement.dataset.v14Ui=VERSION;
    const header=document.querySelector('.brand-tag');
    if(header)header.textContent='V14.3 · WORLD MAP FIX3';
    setTimeout(updateCurrentScene,300);
  });

  window.V143_FIX1={VERSION:VERSION,TERRAIN:TERRAIN,infoFor:infoFor,updateCurrentScene:updateCurrentScene,previousOpen:previousOpen};
})();
