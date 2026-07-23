(()=>{
'use strict';

const BUILD='V15.3-PHASE2-FIX10-BREAKTHROUGH-SUCCESS-FX-20260723';
const ROOT_ID='v153BreakSuccessFx';
let activeCleanup=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function vibrate(pattern){
  try{navigator.vibrate?.(pattern)}catch(_){/* unsupported */}
}

function removeExisting(){
  if(typeof activeCleanup==='function')activeCleanup();
  document.getElementById(ROOT_ID)?.remove();
  document.body.classList.remove('v153-break-success-locked');
  activeCleanup=null;
}

function particleCount(){
  const mobile=matchMedia('(max-width: 700px)').matches;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced)return 12;
  return mobile?32:54;
}

function seededAngle(i,count){
  const base=(360/count)*i;
  return base+((i*47)%17)-8;
}

function createQiParticles(layer,count){
  const colors=['#59e8ff','#66f2b0','#ffd46b','#ff765f','#b98cff','#ffffff'];
  for(let i=0;i<count;i++){
    const angle=seededAngle(i,count);
    const rad=angle*Math.PI/180;
    const distance=46+(i%7)*5;
    const x=Math.cos(rad)*distance;
    const y=Math.sin(rad)*distance;
    const p=document.createElement('i');
    p.className='v153-break-qi-particle';
    p.style.setProperty('--sx',`${x}vw`);
    p.style.setProperty('--sy',`${y}vh`);
    p.style.setProperty('--delay',`${(i%11)*-0.09}s`);
    p.style.setProperty('--duration',`${1.12+(i%5)*0.12}s`);
    p.style.setProperty('--size',`${3+(i%4)*2}px`);
    p.style.setProperty('--color',colors[i%colors.length]);
    layer.appendChild(p);
  }
}

function createBurstShards(layer,count=24){
  const colors=['#6de9ff','#6dffc0','#ffe074','#ff7a63','#c794ff'];
  for(let i=0;i<count;i++){
    const angle=(360/count)*i+((i*19)%13)-6;
    const rad=angle*Math.PI/180;
    const d=22+(i%5)*7;
    const shard=document.createElement('i');
    shard.className='v153-break-burst-shard';
    shard.style.setProperty('--bx',`${Math.cos(rad)*d}vw`);
    shard.style.setProperty('--by',`${Math.sin(rad)*d}vh`);
    shard.style.setProperty('--rot',`${angle+90}deg`);
    shard.style.setProperty('--color',colors[i%colors.length]);
    layer.appendChild(shard);
  }
}

function buildScene(options){
  const targetRealm=esc(options?.targetRealm||options?.realm||'新境界');
  const root=document.createElement('section');
  root.id=ROOT_ID;
  root.className='v153-break-success';
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-label','突破成功');
  root.innerHTML=`
    <div class="v153-break-success-bg"></div>
    <div class="v153-break-success-vignette"></div>
    <div class="v153-break-success-qi" data-qi></div>
    <div class="v153-break-success-body-aura"></div>
    <div class="v153-break-success-orb-wrap">
      <div class="v153-break-success-orb"></div>
      <div class="v153-break-success-orb-core"></div>
      <div class="v153-break-success-orbit orbit-a"></div>
      <div class="v153-break-success-orbit orbit-b"></div>
    </div>
    <div class="v153-break-success-rings">
      <i></i><i></i><i></i>
    </div>
    <div class="v153-break-success-burst" data-burst></div>
    <div class="v153-break-success-flash"></div>
    <div class="v153-break-success-copy">
      <small>BREAKTHROUGH · 破境</small>
      <h2>恭喜突破成功</h2>
      <p>靈氣歸一，天門已開</p>
      <strong>已晉升：${targetRealm}</strong>
      <button type="button" data-close>穩固境界</button>
    </div>
    <button type="button" class="v153-break-success-skip" data-skip aria-label="略過突破特效">略過</button>
  `;
  createQiParticles(root.querySelector('[data-qi]'),particleCount());
  createBurstShards(root.querySelector('[data-burst]'));
  return root;
}

async function play(options={}){
  removeExisting();
  const root=buildScene(options);
  document.body.appendChild(root);
  document.body.classList.add('v153-break-success-locked');

  let closed=false;
  let resolveFinished;
  const finished=new Promise(resolve=>{resolveFinished=resolve});
  const close=()=>{
    if(closed)return;
    closed=true;
    root.classList.add('is-closing');
    setTimeout(()=>{
      root.remove();
      document.body.classList.remove('v153-break-success-locked');
      if(activeCleanup===close)activeCleanup=null;
      resolveFinished?.();
    },320);
  };
  activeCleanup=close;

  root.querySelector('[data-close]')?.addEventListener('click',close);
  root.querySelector('[data-skip]')?.addEventListener('click',close);
  const keyHandler=e=>{
    if(e.key==='Escape'||e.key==='Enter'||e.key===' '){
      e.preventDefault();
      if(root.classList.contains('show-result'))close();
    }
  };
  window.addEventListener('keydown',keyHandler);
  finished.finally(()=>window.removeEventListener('keydown',keyHandler));

  // Phase 1: the original breakthrough scene remains, while qi converges inward.
  requestAnimationFrame(()=>root.classList.add('is-running'));
  await wait(920);
  if(closed)return finished;
  root.classList.add('orb-condense');
  vibrate([24,34,24]);

  // Phase 2: the five-colored spirit orb condenses and pressure rises.
  await wait(900);
  if(closed)return finished;
  root.classList.add('pressure-peak');
  vibrate([45,30,65,26,80]);

  // Phase 3: violent rupture, white flash and colored shockwave.
  await wait(520);
  if(closed)return finished;
  root.classList.add('burst-open');
  vibrate([90,35,110,40,135]);

  // Phase 4: reveal the result only after the burst.
  await wait(520);
  if(closed)return finished;
  root.classList.add('show-result');
  root.querySelector('[data-close]')?.focus({preventScroll:true});

  // Keep the result visible. No automatic close so players can read the new realm.
  return finished;
}

window.playBreakthroughSuccessFxV153=play;
window.closeBreakthroughSuccessFxV153=removeExisting;
window.V153_BREAKTHROUGH_SUCCESS_FX={build:BUILD,play,close:removeExisting};
})();
