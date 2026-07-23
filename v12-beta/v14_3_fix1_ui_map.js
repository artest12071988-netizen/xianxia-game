/* 修仙大逃殺 V14.4 FIX4｜固定格子世界地圖（僅替換視覺與地貌標示，不改移動/戰鬥核心） */
(function(){
'use strict';
const VERSION='15.3-fix5-qingniu-spawn';
const ASSET='assets/world_map/';
const FILES={forest:'forest.webp',desert:'desert.webp',ice:'ice.webp',northpalace:'north_palace.webp',sea:'sea.webp',yinyang:'yinyang_sea.webp',icefire:'icefire_island.webp',kunlun:'kunlun.webp',mountain:'kunlun.webp',ruin:'ancient_ruins.webp',battle:'ancient_battlefield.webp',market:'market.webp',village:'village.webp',abyss:'ancient_battlefield.webp',lighthouse:'sea.webp'};
const TERRAIN_LABEL={forest:'樹海',desert:'沙漠',ice:'冰原',northpalace:'北寒天宮',sea:'海',yinyang:'陰陽海',icefire:'冰火島',kunlun:'崑崙山',mountain:'山域',ruin:'上古遺跡',battle:'古戰場',market:'萬寶交易所',village:'青牛谷',abyss:'魔淵',lighthouse:'鎮海海域'};
const ICON={northpalace:'宮',ice:'冰',forest:'木',desert:'沙',battle:'戰',ruin:'遺',village:'谷',market:'寶',mountain:'山',kunlun:'崑',lighthouse:'燈',sea:'海',yinyang:'陰陽',icefire:'火',abyss:'淵'};
// A-J columns, 1-10 rows in the spreadsheet. Converted to game coordinates A-1 ... J-10.
const BLUEPRINT=[
[['北寒天宮','northpalace'],['冰原','ice'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['沙漠','desert'],['沙漠','desert'],['沙漠','desert'],['沙漠','desert'],['沙漠','desert']],
[['冰原','ice'],['冰原','ice'],['樹海','forest'],['萬木森域','forest'],['樹海','forest'],['沙漠','desert'],['太古戰場','battle'],['沙漠','desert'],['沙漠','desert'],['遠古戰場','battle']],
[['冰原','ice'],['冰原','ice'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['沙漠','desert'],['赤沙荒漠','desert'],['沙漠','desert'],['沙漠','desert'],['沙漠','desert']],
[['冰原','ice'],['冰原','ice'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['樹海','forest']],
[['冰原','ice'],['冰原','ice'],['樹海','forest'],['青牛谷','village'],['樹海','forest'],['萬寶交易所','market'],['樹海','forest'],['樹海','forest'],['上古遺跡','ruin'],['樹海','forest']],
[['冰原','ice'],['冰原','ice'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['樹海','forest'],['樹海','forest']],
[['冰原','ice'],['冰原','ice'],['山','mountain'],['山','mountain'],['山','mountain'],['樹海','forest'],['海','sea'],['海','sea'],['海','sea'],['海','sea']],
[['冰原','ice'],['冰原','ice'],['山','mountain'],['山','mountain'],['山','mountain'],['山','mountain'],['海','sea'],['海','sea'],['海','sea'],['海','sea']],
[['崑崙山','kunlun'],['冰原','ice'],['山','mountain'],['山','mountain'],['山','mountain'],['鎮海燈塔','lighthouse'],['海','sea'],['海','sea'],['陰陽海','yinyang'],['陰陽海','yinyang']],
[['冰原','ice'],['冰原','ice'],['山','mountain'],['魔淵谷','abyss'],['山','mountain'],['海','sea'],['海','sea'],['海','sea'],['陰陽海','yinyang'],['冰火島','icefire']]
];
const MAP=Object.create(null);
for(let r=0;r<10;r++)for(let c=0;c<10;c++){const key=String.fromCharCode(65+r)+'-'+(c+1);const x=BLUEPRINT[r][c];MAP[key]={coord:key,label:x[0],type:x[1],terrainLabel:TERRAIN_LABEL[x[1]],file:FILES[x[1]],icon:ICON[x[1]]}}
function gameReady(){return typeof g!=='undefined'&&g&&g.pos&&typeof C!=='undefined'&&C}
function coord(r,c){return String.fromCharCode(65+Number(r))+'-'+(Number(c)+1)}
function infoFor(r,c){return MAP[coord(r,c)]||MAP['A-1']}
function currentInfo(){return gameReady()?infoFor(g.pos.r,g.pos.c):MAP['A-1']}
function updateCurrentScene(){try{if(!gameReady())return;const scene=document.querySelector('.world-scene');if(!scene)return;const i=currentInfo();scene.classList.add('v14f-scene');scene.dataset.terrain=i.type;scene.style.setProperty('--v14-scene-image','url("'+ASSET+i.file+'?v=144fix4g")');const zone=document.getElementById('sceneZone');const co=document.getElementById('sceneCoord');if(zone)zone.textContent=i.label;if(co)co.textContent=i.coord+' · '+i.terrainLabel;let badge=scene.querySelector('.v14f-terrain-badge');if(!badge){badge=document.createElement('span');badge.className='v14f-terrain-badge';scene.appendChild(badge)}badge.textContent=i.terrainLabel}catch(err){console.error('[V14.4 FIX4G] current scene update failed',err)}}
function aiCountAt(co){if(typeof ai==='undefined'||!Array.isArray(ai))return 0;return ai.filter(a=>a&&a.alive&&a.coord===co).length}
const previousOpen=typeof window.openWorldMap==='function'?window.openWorldMap:null;
function buildMap(){try{if(!gameReady()||typeof bigMove!=='function'||typeof mapMoveDistance!=='function'||typeof sheet!=='function'){if(previousOpen)return previousOpen();return}const rng=Math.max(1,Number(bigMove(g.big))||1);const here=coord(g.pos.r,g.pos.c);let h='<div class="v14f-map-title"><div><h3>十方山海圖・10×10固定配置</h3><p class="small">依固定地貌配置顯示；御風距離 '+rng+' 格。僅亮起的地域可以移動。</p></div><span class="v14f-map-version">FIX4G</span></div>';h+='<div class="v14f-map-legend"><span><i class="me"></i>目前位置</span><span><i class="go"></i>可前往</span><span><i class="far"></i>超出距離</span></div><div class="v14f-map-grid v14f-blueprint-grid">';for(let r=0;r<10;r++){for(let c=0;c<10;c++){const i=infoFor(r,c);const dist=mapMoveDistance(r,c);const me=i.coord===here;const reachable=!me&&dist>=1&&dist<=rng;const count=aiCountAt(i.coord);h+='<button type="button" class="v14f-cell '+(me?'me ':'')+(!reachable&&!me?'block ':'')+'" style="--cell-bg:url(&quot;'+ASSET+i.file+'?v=144fix4g&quot;)" '+(reachable?'onclick="moveTo('+r+','+c+')"':'disabled')+' aria-label="'+i.label+' '+i.coord+'"><span class="v14f-cell-shade"></span><span class="v14f-cell-icon">'+i.icon+'</span><span class="v14f-cell-copy"><b>'+i.label+'</b><small>'+i.coord+'</small>'+(count?'<em>修士 '+count+'</em>':'')+'</span></button>'}}h+='</div><div class="notice" style="margin-top:10px">地圖名稱與圖片依你的配置表固定顯示；本修正版沒有更動原有移動距離、戰鬥、探索、掉落與存檔規則。</div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">關閉地圖</button>';sheet(h);const s=document.getElementById('sheet');if(s)s.classList.add('v14f-map-sheet')}catch(err){console.error('[V14.4 FIX4G] map build failed, reverting',err);if(previousOpen)return previousOpen();if(typeof toast==='function')toast('地圖載入失敗，請重新整理')}}
window.openWorldMap=buildMap;
const previousRender=typeof window.render==='function'?window.render:null;if(previousRender)window.render=function(){const out=previousRender.apply(this,arguments);setTimeout(updateCurrentScene,0);return out};
const previousMove=typeof window.moveTo==='function'?window.moveTo:null;if(previousMove)window.moveTo=function(){const out=previousMove.apply(this,arguments);setTimeout(updateCurrentScene,0);return out};
document.addEventListener('DOMContentLoaded',function(){document.documentElement.dataset.v14Ui=VERSION;const header=document.querySelector('.brand-tag');if(header)header.textContent='V14.4 · FIXED WORLD MAP';setTimeout(updateCurrentScene,300)});
window.V144_FIXED_MAP={VERSION,MAP,BLUEPRINT,infoFor,updateCurrentScene,previousOpen};
})();
