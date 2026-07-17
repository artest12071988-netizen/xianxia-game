'use strict';

const V12_ONLINE = window.XIANXIA_ONLINE_CONFIG || {};
const V12_PREVIEW = new URLSearchParams(location.search).get('preview') === '1' || ['localhost','127.0.0.1'].includes(location.hostname);
const V12_LOCAL_CACHE = 'xianxia_v12_emergency_cache';
const V12_RECOVERY_CONFLICT = 'xianxia_v12_recovery_conflict';
const V12_BUILD = V12_ONLINE.build || 'V12-CBT';
const cloudState = {
  client:null,user:null,enabled:false,preview:false,revision:0,remoteSave:null,
  saveTimer:null,saving:false,pending:false,lastSyncedAt:null,lastError:'',
  channel:null,presence:{},chatMessages:[],chatOpen:false,aiChatAt:0
};

const v11Render = render;
const v11TickAiWorld = tickAiWorld;
const v11OpenVersion = openVersion;

function cloudConfigured(){
  return !!(V12_ONLINE.enabled && V12_ONLINE.supabaseUrl && V12_ONLINE.supabasePublishableKey && window.supabase);
}
function setCloudBadge(text,state='ok'){
  const e=$('cloudSyncBadge'); if(!e)return;
  e.textContent=text; e.dataset.state=state;
}
function updateCloudBadge(){
  if(cloudState.preview)return setCloudBadge('離線預覽｜不可封測','warn');
  if(!cloudState.enabled)return setCloudBadge('伺服器未設定','bad');
  if(!cloudState.user)return setCloudBadge('尚未登入','warn');
  if(!navigator.onLine)return setCloudBadge('離線暫存｜等待同步','warn');
  if(cloudState.saving)return setCloudBadge('雲端存檔中…','busy');
  if(cloudState.lastError)return setCloudBadge('同步異常','bad');
  if(cloudState.lastSyncedAt)return setCloudBadge('雲端已同步 '+new Date(cloudState.lastSyncedAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}),'ok');
  setCloudBadge('安全連線中','busy');
}

async function initV12Online(){
  window.addEventListener('online',()=>{cloudState.lastError='';updateCloudBadge();flushCloudSave(true)});
  window.addEventListener('offline',updateCloudBadge);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushCloudSave(true)});
  window.addEventListener('beforeunload',flushOnUnload);

  if(cloudConfigured()){
    cloudState.client=window.supabase.createClient(V12_ONLINE.supabaseUrl,V12_ONLINE.supabasePublishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
      realtime:{params:{eventsPerSecond:8}}
    });
    cloudState.enabled=true;
    const {data,error}=await cloudState.client.auth.getSession();
    if(error){cloudState.lastError=error.message;updateCloudBadge();return}
    if(data.session){cloudState.user=data.session.user;await afterCloudLogin()}
    else updateCloudBadge();
    cloudState.client.auth.onAuthStateChange(async(event,session)=>{
      if(session?.user && (!cloudState.user || cloudState.user.id!==session.user.id)){
        cloudState.user=session.user;await afterCloudLogin();
      }
      if(event==='SIGNED_OUT'){cloudState.user=null;cloudState.remoteSave=null;cloudState.revision=0;teardownRealtime();updateCloudBadge();show('intro')}
    });
  }else if(V12_PREVIEW){
    cloudState.preview=true;
    $('continueBtn').style.display=localStorage.getItem(V12_LOCAL_CACHE)?'block':'none';
    updateCloudBadge();
  }else{
    updateCloudBadge();
    $('continueBtn').style.display='none';
  }
}

async function afterCloudLogin(){
  cloudState.lastError='';
  await loadCloudSave();
  await recoverEmergencyCache();
  await initRealtime();
  $('continueBtn').style.display=cloudState.remoteSave?'block':'none';
  updateCloudBadge();
}

function readEmergencyCache(){
  try{
    const raw=localStorage.getItem(V12_LOCAL_CACHE);if(!raw)return null;
    const data=JSON.parse(raw);if(!data?.g)return null;
    if(data.userId && cloudState.user && data.userId!==cloudState.user.id)return null;
    return data;
  }catch(e){console.warn('invalid emergency cache',e);return null}
}

async function recoverEmergencyCache(){
  if(!cloudState.enabled||!cloudState.user)return;
  const local=readEmergencyCache();if(!local)return;
  const localSavedAt=Number(local.savedAt||local.g?.lastSavedAt||0);
  const remoteSavedAt=Number(cloudState.remoteSave?.savedAt||cloudState.remoteSave?.g?.lastSavedAt||0);
  if(localSavedAt<=remoteSavedAt)return;
  const baseRevision=Number(local.clientRevision??cloudState.revision??0);
  if(cloudState.remoteSave && baseRevision!==cloudState.revision){
    localStorage.setItem(V12_RECOVERY_CONFLICT,JSON.stringify(local));
    toast('另一裝置已有較新進度；離線紀錄已保留，未覆蓋伺服器存檔');
    return;
  }
  try{
    applySavePayload(local);
    cloudState.revision=baseRevision;
    await flushCloudSave(true);
    if(!cloudState.lastError)toast('偵測到未上傳的離線進度，已補傳至雲端');
  }catch(e){
    cloudState.lastError=e.message||String(e);updateCloudBadge();
  }
}

function enterBeta(){
  if(cloudState.enabled){
    if(cloudState.user)show(cloudState.remoteSave?'intro':'create');
    else show('auth');
    return;
  }
  if(cloudState.preview){show('create');return}
  openServerSetup();
}

function openServerSetup(){
  sheet('<h3>聯網封測尚未接上伺服器</h3><div class="notice">V12 封測版已鎖定「雲端為唯一正式存檔」。未填入 Supabase Project URL 與 Publishable key 前，不允許對外封測，以免玩家斷線後回朔。</div><p class="small">請先執行交付包內 supabase_schema.sql，再填寫 online_config.js。完成後重新部署 GitHub Pages。</p><button class="btn gold" style="width:100%" onclick="closeOv()">了解</button>');
}

async function doBetaAuth(mode){
  if(!cloudState.client){openServerSetup();return}
  const email=($('authEmail')?.value||'').trim();
  const password=$('authPassword')?.value||'';
  if(!/^\S+@\S+\.\S+$/.test(email)){toast('請輸入有效 Email');return}
  if(password.length<6){toast('密碼至少 6 碼');return}
  setCloudBadge(mode==='signup'?'建立封測帳號中…':'登入中…','busy');
  let result;
  if(mode==='signup')result=await cloudState.client.auth.signUp({email,password});
  else result=await cloudState.client.auth.signInWithPassword({email,password});
  if(result.error){cloudState.lastError=result.error.message;toast('登入失敗：'+result.error.message);updateCloudBadge();return}
  if(!result.data.session){toast('帳號已建立，請先完成 Email 驗證後登入');updateCloudBadge();return}
  cloudState.user=result.data.user;await afterCloudLogin();
  show(cloudState.remoteSave?'intro':'create');
}

async function logoutBeta(){
  await flushCloudSave(true);
  if(cloudState.client)await cloudState.client.auth.signOut({scope:'local'});
  localStorage.removeItem(V12_LOCAL_CACHE);
}

async function loadCloudSave(){
  if(!cloudState.enabled||!cloudState.user)return;
  const {data,error}=await cloudState.client.from('game_saves').select('save_data,revision,updated_at').eq('user_id',cloudState.user.id).maybeSingle();
  if(error){cloudState.lastError=error.message;updateCloudBadge();return}
  cloudState.remoteSave=data?.save_data||null;
  cloudState.revision=data?.revision||0;
  cloudState.lastSyncedAt=data?.updated_at?Date.parse(data.updated_at):null;
}

function applySavePayload(data){
  if(!data?.g)throw new Error('存檔格式不完整');
  g=data.g;ai=data.ai&&data.ai.length?data.ai:initAi();
  normalizeSave();
  applyOffline(data.savedAt||g.lastSavedAt||Date.now());
}

continueGame = async function(){
  try{
    if(cloudState.enabled){
      if(!cloudState.user){show('auth');return}
      await loadCloudSave();
      if(!cloudState.remoteSave){toast('雲端尚無角色');show('create');return}
      applySavePayload(cloudState.remoteSave);
    }else if(cloudState.preview){
      applySavePayload(JSON.parse(localStorage.getItem(V12_LOCAL_CACHE)));
    }else return openServerSetup();
    show('game');startLoops();render();log('神識歸位，已載入伺服器最新存檔。','lg');
  }catch(e){toast('存檔載入失敗：'+e.message)}
};

startGame = function(){
  if(!C)return;
  if(V12_ONLINE.requireCloudForBeta && !cloudState.enabled && !cloudState.preview){openServerSetup();return}
  if(cloudState.enabled&&!cloudState.user){show('auth');return}
  const nm=$('nm').value.trim()||'無名散修';
  g=freshGame(nm);g.build=V12_BUILD;ai=initAi();show('game');startLoops();
  log('你在 <b>青牛谷</b> 凝聚道體。所有進度將持續同步至封測伺服器。','la');
  log('手動存檔已取消；每次行動與固定心跳均會自動雲端存檔。');
  saveGame(false);render();setTimeout(()=>openTutorial(0),450);
};

saveGame = function(showToast=false){
  if(!g)return;
  const payload={savedAt:Date.now(),build:V12_BUILD,userId:cloudState.user?.id||null,clientRevision:cloudState.revision,g,ai};
  g.lastSavedAt=payload.savedAt;
  localStorage.setItem(V12_LOCAL_CACHE,JSON.stringify(payload));
  if(cloudState.enabled&&cloudState.user)scheduleCloudSave();
  if(showToast)toast(cloudState.enabled?'已排入雲端同步':'僅為離線預覽暫存');
};

function scheduleCloudSave(force=false){
  clearTimeout(cloudState.saveTimer);
  cloudState.saveTimer=setTimeout(()=>flushCloudSave(force),force?0:(P?.autosave_debounce_ms||450));
}

async function flushCloudSave(force=false){
  if(!g||!cloudState.enabled||!cloudState.user)return;
  if(!navigator.onLine){updateCloudBadge();return}
  if(cloudState.saving){cloudState.pending=true;return}
  cloudState.saving=true;cloudState.pending=false;updateCloudBadge();
  const payload={savedAt:Date.now(),build:V12_BUILD,userId:cloudState.user.id,clientRevision:cloudState.revision,g,ai};
  try{
    const {data,error}=await cloudState.client.rpc('save_game_state',{p_save:payload,p_client_revision:cloudState.revision});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    if(!row)throw new Error('伺服器未回傳存檔結果');
    if(row.accepted){
      cloudState.revision=Number(row.server_revision||cloudState.revision+1);
      cloudState.lastSyncedAt=row.server_updated_at?Date.parse(row.server_updated_at):Date.now();
      cloudState.remoteSave=payload;cloudState.lastError='';
      localStorage.setItem(V12_LOCAL_CACHE,JSON.stringify({...payload,clientRevision:cloudState.revision}));
    }else{
      cloudState.revision=Number(row.server_revision||0);
      cloudState.remoteSave=row.server_save;
      applySavePayload(row.server_save);
      render();toast('偵測到另一裝置的新進度，已同步伺服器最新存檔');
    }
  }catch(e){
    cloudState.lastError=e.message||String(e);
    console.error('cloud save failed',e);
  }finally{
    cloudState.saving=false;updateCloudBadge();
    if(cloudState.pending)scheduleCloudSave(true);
  }
}

function flushOnUnload(){
  if(!g||!cloudState.enabled||!cloudState.user||!navigator.onLine)return;
  const sessionToken=cloudState.client?.auth?.getSession?null:null;
  // 一般情況已由每次行動與 10 秒心跳存檔；離頁時再排一次 keepalive RPC。
  cloudState.client.auth.getSession().then(({data})=>{
    const token=data.session?.access_token;if(!token)return;
    fetch(V12_ONLINE.supabaseUrl+'/rest/v1/rpc/save_game_state',{
      method:'POST',keepalive:true,
      headers:{'Content-Type':'application/json','apikey':V12_ONLINE.supabasePublishableKey,'Authorization':'Bearer '+token},
      body:JSON.stringify({p_save:{savedAt:Date.now(),build:V12_BUILD,userId:cloudState.user.id,clientRevision:cloudState.revision,g,ai},p_client_revision:cloudState.revision})
    }).catch(()=>{});
  }).catch(()=>{});
}

function openCloudStatus(){
  const mode=cloudState.preview?'離線預覽':cloudState.enabled?'正式雲端存檔':'未連線';
  const account=cloudState.user?.email||'尚未登入';
  const t=cloudState.lastSyncedAt?new Date(cloudState.lastSyncedAt).toLocaleString('zh-TW'):'尚未完成';
  sheet('<h3>雲端存檔狀態</h3><div class="money"><div><span>模式</span><b style="font-size:14px">'+esc(mode)+'</b></div><div><span>帳號</span><b style="font-size:12px">'+esc(account)+'</b></div><div><span>伺服器版本</span><b>'+cloudState.revision+'</b></div></div><div class="notice" style="margin-top:12px">封測版沒有手動存檔。每次行動後自動排程同步，另有固定心跳與重新連線補傳；若多裝置衝突，伺服器最新版本優先，避免舊分頁覆蓋新進度。</div><p class="small">最後同步：'+esc(t)+(cloudState.lastError?'<br>錯誤：'+esc(cloudState.lastError):'')+'</p><div class="row"><button class="btn jade" onclick="flushCloudSave(true)">立即檢查同步</button>'+(cloudState.user?'<button class="btn red" onclick="logoutBeta()">登出</button>':'')+'</div><button class="btn" style="width:100%;margin-top:8px" onclick="closeOv()">關閉</button>');
}

async function initRealtime(){
  teardownRealtime();
  if(!cloudState.enabled||!cloudState.user)return;
  const channelName=V12_ONLINE.worldChannel||'xianxia-world-v12';
  cloudState.channel=cloudState.client.channel(channelName,{config:{presence:{key:cloudState.user.id}}});
  cloudState.channel
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'world_chat'},payload=>{
      cloudState.chatMessages.push(payload.new);cloudState.chatMessages=cloudState.chatMessages.slice(-80);renderChatIfOpen();
    })
    .on('presence',{event:'sync'},()=>{
      cloudState.presence=cloudState.channel.presenceState();
      const count=Object.keys(cloudState.presence).length;
      const e=$('onlineCount');if(e)e.textContent=count+' 人在線';
    })
    .subscribe(async status=>{
      if(status==='SUBSCRIBED'){
        await cloudState.channel.track({user_id:cloudState.user.id,name:g?.name||'未凝聚道體',build:V12_BUILD,online_at:new Date().toISOString()});
      }
    });
  const {data}=await cloudState.client.from('world_chat').select('id,user_id,player_name,speaker_type,message,created_at').order('created_at',{ascending:false}).limit(60);
  cloudState.chatMessages=(data||[]).reverse();
}
function teardownRealtime(){if(cloudState.channel&&cloudState.client)cloudState.client.removeChannel(cloudState.channel);cloudState.channel=null;cloudState.presence={}}

function openWorldChat(){
  if(!cloudState.enabled||!cloudState.user){toast('全服傳音需登入封測伺服器');return}
  cloudState.chatOpen=true;
  sheet('<h3>全服傳音</h3><div class="chat-status"><span id="onlineCount">'+Object.keys(cloudState.presence).length+' 人在線</span><span>世界修士共用傳音頻道</span></div><div class="world-chat" id="worldChatList"></div><div class="chat-compose"><input id="worldChatInput" maxlength="160" placeholder="輸入傳音內容…"><button class="btn gold" onclick="sendWorldChat()">傳音</button></div><button class="btn" style="width:100%;margin-top:8px" onclick="cloudState.chatOpen=false;closeOv()">關閉</button>');
  renderChatIfOpen();setTimeout(()=>$('worldChatInput')?.focus(),50);
}
function renderChatIfOpen(){
  if(!cloudState.chatOpen||!$('worldChatList'))return;
  $('worldChatList').innerHTML=cloudState.chatMessages.slice(-60).map(m=>'<div class="chat-line '+esc(m.speaker_type)+'"><span>['+new Date(m.created_at).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})+']</span><b>'+esc(m.player_name)+'</b><p>'+esc(m.message)+'</p></div>').join('')||'<div class="small">世界頻道尚無傳音。</div>';
  $('worldChatList').scrollTop=$('worldChatList').scrollHeight;
}
async function sendWorldChat(){
  const input=$('worldChatInput'),message=(input?.value||'').trim();if(!message)return;
  if(message.length>160){toast('傳音最多 160 字');return}
  const {error}=await cloudState.client.from('world_chat').insert({user_id:cloudState.user.id,player_name:g?.name||cloudState.user.email.split('@')[0],speaker_type:'player',message});
  if(error){toast('傳音失敗：'+error.message);return}input.value='';
}
function isAiChatLeader(){
  const ids=Object.keys(cloudState.presence).sort();return !!(cloudState.user&&ids[0]===cloudState.user.id);
}
async function postAiWorldLine(){
  if(!cloudState.enabled||!cloudState.user||!isAiChatLeader()||Date.now()-cloudState.aiChatAt<18000)return;
  cloudState.aiChatAt=Date.now();const alive=ai.filter(a=>a.alive);if(!alive.length)return;
  const a=rnd(alive),pool=C.aiDialoguePools?.[a.personality]||['此地氣機有變。'];
  await cloudState.client.from('world_chat').insert({user_id:cloudState.user.id,player_name:a.name,speaker_type:'ai',message:rnd(pool)});
}

function realmRank(big){return ({'練氣期':0,'築基期':1,'結丹期':2,'元嬰期':3})[big]??0}
function sameMajorRealm(playerBig,otherLv){return playerBig===realmOf(otherLv).big}
function relativePower(a){
  const diff=a.lv-g.lv;if(diff<=-2)return'氣息遠弱於你';if(diff===-1)return'氣息稍弱';if(diff===0)return'勢均力敵';if(diff===1)return'氣息稍強';return'氣息遠勝於你';
}

renderAiIntel = function(){
  if(!g||!$('aiList'))return;
  const range=senseRange(g.big),near=ai.filter(a=>a.alive&&distanceCoord(a.coord,coordOf(g.pos.r,g.pos.c))<=range).slice(0,8);
  $('nearbyCount').textContent=near.length+' 人';
  $('aiList').innerHTML=near.length?near.map(a=>{
    const same=sameMajorRealm(g.big,a.lv);
    const intel=same?(a.personality+' · '+relativePower(a)+' · 體力 '+Math.round(a.hp)+'/'+a.hpMax):'境界隔絕 · 強弱與體力無法探知';
    return '<div class="ai-item ai-click" onclick="openAiInteract('+a.id+')"><div><b>'+esc(a.name)+'</b><br><span>'+esc(intel)+'</span></div><span>'+esc(a.action)+'</span></div>';
  }).join(''):'<div class="small">神識範圍內暫無修士氣息。</div>';
};

function openAiInteract(id){
  const a=ai.find(x=>x.id===id);if(!a)return;
  const same=sameMajorRealm(g.big,a.lv),intel=same?relativePower(a):'境界相隔，無法判斷其強弱與體力';
  const greeting=aiReply(a,'greet');
  sheet('<h3>修士互動 · '+esc(a.name)+'</h3><div class="ai-dialogue"><img src="assets/ai_cultivator.svg" alt="修士頭像"><div><b>'+esc(a.personality)+'</b><p>「'+esc(greeting)+'」</p><small>'+esc(intel)+'</small></div></div><div class="command-row"><button class="btn jade" onclick="talkToAi('+id+')">交談</button><button class="btn gold" onclick="tradeWithAi('+id+')">詢問交易</button><button class="btn red" onclick="startFightAi('+id+')">攔截鬥法</button></div><button class="btn" style="width:100%;margin-top:8px" onclick="closeOv()">離開</button>');
}
function aiReply(a,type){
  const pool=C.aiDialoguePools?.[a.personality]||['道友，有何見教？'];
  if(type==='trade'&&a.personality==='商人修士')return'妖丹、庚精、法器，皆可談價。';
  if(type==='trade')return'我不是商賈，莫浪費彼此時間。';
  if(type==='threat'&&realmRank(g.big)>realmRank(realmOf(a.lv).big))return'前輩修為深不可測，晚輩無意冒犯。';
  return rnd(pool);
}
function talkToAi(id){const a=ai.find(x=>x.id===id);if(!a)return;const line=aiReply(a,'talk');log('<b>'+esc(a.name)+'</b>：「'+esc(line)+'」','la');openAiInteract(id)}
function tradeWithAi(id){const a=ai.find(x=>x.id===id);if(!a)return;sheet('<h3>'+esc(a.name)+' 的回應</h3><p>「'+esc(aiReply(a,'trade'))+'」</p><div class="notice">個人交易與交情會記錄在伺服器。本版已完成對話與互動入口，不會偽造未實作的交易結果。</div><button class="btn" style="width:100%" onclick="openAiInteract('+id+')">返回</button>')}

startAiEncounter = function(a){
  const same=sameMajorRealm(g.big,a.lv);
  const detail=same?('<div class="money"><div><span>同階感知</span><b>'+esc(relativePower(a))+'</b></div><div><span>體力</span><b>'+Math.round(a.hp)+' / '+a.hpMax+'</b></div></div>'):'<div class="notice">對方與你跨越大境界。神識只能確認其存在，無法窺探強弱、等級與實際體力。</div>';
  sheet('<h3>神識遭遇</h3><div class="ai-dialogue"><img src="assets/ai_cultivator.svg"><div><b>'+esc(a.name)+'</b><p>「'+esc(aiReply(a,'greet'))+'」</p></div></div>'+detail+'<div class="row" style="margin-top:12px"><button class="btn jade" onclick="openAiInteract('+a.id+')">互動</button><button class="btn red" onclick="startFightAi('+a.id+')">攔截鬥法</button><button class="btn" onclick="closeOv()">避開</button></div>');
};

startFightMonster = function(m){
  stopMeditate('遭遇妖獸');
  fight={kind:'monster',enemy:{...m,image:m.image||('assets/monsters/'+m.id+'.svg')},hp:m.hp,hpMax:m.hp};
  renderFight('你察覺到 '+m.name+' 的殺意。',{enemy:rnd(m.attackLines||['吼——！'])});
};
startFightAi = function(id){
  const a=ai.find(x=>x.id===id);if(!a)return;stopMeditate('遭遇修士');closeOv();
  const rr=realmOf(a.lv),wp=a.gear.find(e=>e.cat==='法器'&&e.equipped),ar=a.gear.find(e=>e.cat==='防具'&&e.equipped);
  const atk=Math.round(rr.atk+(wp?(IT[wp.itemId].val||0)*(1+.05*wp.enhance):0)),def=Math.round(rr.def+(ar?(IT[ar.itemId].val||0)*(1+.05*ar.enhance):0));
  fight={kind:'ai',aiId:id,enemy:{name:a.name,lv:a.lv,big:rr.big,image:'assets/ai_cultivator.svg',personality:a.personality,hp:a.hpMax,atk,def,exp:Math.round(a.lv*70+40)},hp:a.hp,hpMax:a.hpMax};
  renderFight('兩道神識交鋒，'+a.name+' 已拔劍。',{enemy:rnd(C.combatSpeech.aiAttack)});
};
function canSeeFightHp(){return fight?.kind!=='ai'||sameMajorRealm(g.big,fight.enemy.lv)}
function fighterPortrait(src,alt){return '<img class="fight-portrait" src="'+esc(src)+'" alt="'+esc(alt)+'">'}
renderFight = function(line,speech={}){
  const e=fight.enemy,visible=canSeeFightHp();
  const enemyHp=visible?('體力 '+Math.max(0,Math.round(fight.hp))+' / '+fight.hpMax):'體力：無法探知';
  const enemyBar=visible?('<div class="bar"><i class="enemy-hpf" style="width:'+clamp(fight.hp/fight.hpMax*100,0,100)+'%"></i></div>'):'<div class="bar fog-bar"><i style="width:100%"></i></div>';
  sheet('<h3>鬥法 · '+esc(e.name)+'</h3><div class="fight-stage"><div class="fighter" id="playerFighter">'+fighterPortrait('assets/player_cultivator.svg',g.name)+'<strong>'+esc(g.name)+'</strong><div class="small">體力 '+Math.max(0,Math.round(g.hp))+' / '+g.hpMax+'</div></div><div class="fighter enemy" id="enemyFighter">'+fighterPortrait(e.image||'assets/ai_cultivator.svg',e.name)+'<strong>'+esc(e.name)+'</strong><div class="small">'+enemyHp+'</div></div></div>'+enemyBar+'<p class="small fight-line">'+line+'</p><div class="row"><button class="btn red" onclick="attackTurn()">攻擊 −'+P.normal_attack_mp_cost+'精力</button><button class="btn jade" onclick="openCombatItems()">道具／丹藥</button><button class="btn" onclick="fleeTurn()">遁走</button></div>');
  if(speech.player)setTimeout(()=>showFightSpeech('playerFighter',speech.player,speech.playerType||'normal'),80);
  if(speech.enemy)setTimeout(()=>showFightSpeech('enemyFighter',speech.enemy,speech.enemyType||'normal'),120);
};
function showFightSpeech(id,text,type='normal'){
  const e=$(id);if(!e||!text)return;const b=document.createElement('div');b.className='fight-speech '+type;b.textContent=text;e.appendChild(b);setTimeout(()=>b.classList.add('show'),20);setTimeout(()=>b.remove(),1250);
}
function calcBlockChance(def,atk){return clamp((def/(Math.max(1,atk+def)))*.42,.04,.32)}
function getEnemyLine(group){
  if(fight.kind==='monster')return rnd(fight.enemy[group]||fight.enemy.attackLines||['吼——！']);
  return rnd(C.combatSpeech[group==='critLines'?'aiCrit':group==='blockLines'?'aiBlock':group==='hitLines'?'aiHit':'aiAttack']);
}
function animateDamage(id,dmg,{crit=false,blocked=false}={}){
  setTimeout(()=>{const e=$(id);if(!e)return;e.classList.add('hit');const p=document.createElement('div');p.className='damage-pop'+(crit?' crit':'')+(blocked?' blocked':'');p.textContent=blocked?'格擋 -'+dmg:(crit?'暴擊 -'+dmg:'-'+dmg);e.appendChild(p);setTimeout(()=>{e.classList.remove('hit');p.remove()},850)},80);
}
attackTurn = function(){
  if(g.mp<P.normal_attack_mp_cost){renderFight('精力不足，無法出手。請使用回精丹或遁走。');return}
  g.mp-=P.normal_attack_mp_cost;
  const attackLine=Math.random()<(P.combat_speech_normal_chance||.42)?rnd(C.combatSpeech.playerAttack):'';
  if(Math.random()<P.encounter_miss_rate){renderFight('你的攻擊落空了。',{player:attackLine});setTimeout(()=>animateStrike('playerFighter'),40);return setTimeout(enemyTurn,500)}
  let mult=1,crit=false,rate=P.base_crit_rate+(g.techniques.includes('lightning_breath')?.10:0);
  if(Math.random()<rate){crit=true;mult=P.base_crit_min+Math.random()*(P.base_crit_max-P.base_crit_min)}
  let dmg=calcDmg(pAtk(),fight.enemy.def,mult);if(crit&&g.techniques.includes('lightning_breath'))dmg+=50;
  const blocked=Math.random()<calcBlockChance(fight.enemy.def,pAtk());if(blocked)dmg=Math.max(1,Math.round(dmg*(P.block_damage_multiplier||.35)));
  fight.hp-=dmg;
  const speech={player:crit?rnd(C.combatSpeech.playerCrit):attackLine,playerType:crit?'crit':'normal'};
  if(blocked){speech.enemy=getEnemyLine('blockLines');speech.enemyType='block'}else if(Math.random()<.35){speech.enemy=getEnemyLine('hitLines');speech.enemyType='hit'}
  renderFight('你造成 '+dmg+' 傷害'+(crit?'（暴擊）':'')+(blocked?'，但對方成功格擋':'')+'。',speech);
  setTimeout(()=>animateStrike('playerFighter'),40);animateDamage('enemyFighter',dmg,{crit,blocked});
  if(fight.hp<=0)return setTimeout(winFight,720);setTimeout(enemyTurn,780);
};
enemyTurn = function(){
  if(!fight)return;
  const attackLine=Math.random()<.48?getEnemyLine('attackLines'):'';
  if(Math.random()<P.encounter_miss_rate){renderFight(fight.enemy.name+' 的攻擊被你避開。',{enemy:attackLine});return}
  let crit=Math.random()<Math.max(.04,P.base_crit_rate*.65),mult=crit?(P.base_crit_min+Math.random()*(P.base_crit_max-P.base_crit_min)):1;
  let dmg=calcDmg(fight.enemy.atk,pDef(),mult);
  const blocked=Math.random()<calcBlockChance(pDef(),fight.enemy.atk);if(blocked)dmg=Math.max(1,Math.round(dmg*(P.block_damage_multiplier||.35)));
  g.hp-=dmg;
  const speech={enemy:crit?getEnemyLine('critLines'):attackLine,enemyType:crit?'crit':'normal'};
  if(blocked){speech.player=rnd(C.combatSpeech.playerBlock);speech.playerType='block'}else if(Math.random()<.38){speech.player=rnd(C.combatSpeech.playerHit);speech.playerType='hit'}
  renderFight(fight.enemy.name+' 反擊，造成 '+dmg+' 傷害'+(crit?'（暴擊）':'')+(blocked?'，你傲然格擋':'')+'。',speech);
  setTimeout(()=>animateStrike('enemyFighter'),40);animateDamage('playerFighter',dmg,{crit,blocked});render();
  if(g.hp<=0)return setTimeout(loseFight,720);
};

function itemDetail(it){return it?.detail||((it?.eff||'物品')+(it?.val?' '+it.val:''))}
function techniqueDetail(t){return t.details||t.desc}
function qtyBox(kind,id,max){
  max=Math.max(1,Math.floor(max||1));const safe=String(id).replace(/[^\w-]/g,'');
  return '<div class="qty-box"><button onclick="adjustQty(\''+kind+'\',\''+id+'\',-1,'+max+')">−</button><input id="qty_'+kind+'_'+safe+'" type="number" min="1" max="'+max+'" value="1"><button onclick="adjustQty(\''+kind+'\',\''+id+'\',1,'+max+')">＋</button><button class="max" onclick="setMaxQty(\''+kind+'\',\''+id+'\','+max+')">最大</button></div>';
}
function qtyId(kind,id){return 'qty_'+kind+'_'+String(id).replace(/[^\w-]/g,'')}
function adjustQty(kind,id,delta,max){const e=$(qtyId(kind,id));if(e)e.value=clamp((Number(e.value)||1)+delta,1,max)}
function setMaxQty(kind,id,max){const e=$(qtyId(kind,id));if(e)e.value=max}
function readQty(kind,id,max=9999){const e=$(qtyId(kind,id));return clamp(Math.floor(Number(e?.value)||1),1,max)}
function dailyKey(id){return new Date().toISOString().slice(0,10)+':'+id}
function dailyBought(id){return Number(g.purchaseLimits?.[dailyKey(id)]||0)}
function npcMaxQty(s){const money=g.lingshi+g.boundStone,byMoney=Math.floor(money/s.price),byDaily=Math.max(0,(s.daily||9999)-dailyBought(s.id));return Math.max(0,Math.min(byMoney,byDaily))}

renderShop = function(){
  let h='<h3>商城與萬寶坊市</h3><div class="money"><div><span>商城元寶</span><b>'+g.yuanbao.toLocaleString()+'</b></div><div><span>靈石</span><b>'+g.lingshi.toLocaleString()+'</b></div><div><span>綁定靈石</span><b>'+g.boundStone.toLocaleString()+'</b></div></div><div class="tabs">'+tabBtn('yuanbao','元寶購買')+tabBtn('premium','功法商城')+tabBtn('exchange','元寶兌換')+tabBtn('npc','NPC購買')+tabBtn('sell','出售物品')+'</div>';
  if(shopTab==='yuanbao'){
    h+='<div class="notice">封測期間保留原商城流程，但不開啟真實扣款。正式金流仍需後端訂單驗證。</div>';
    C.paymentPackages.forEach(p=>{h+='<div class="list-row"><div class="grow"><strong>NT$'+p.twd+' → '+p.yuanbao+' 元寶</strong><small>'+p.label+(p.bonus?' · 含贈送 '+p.bonus+' 元寶':'')+'</small></div><button class="btn gold" onclick="startCheckout(\''+p.id+'\')">建立訂單</button></div>'});
    const pending=g.orders.filter(o=>o.status==='待付款').slice(-3);if(pending.length)h+='<p class="small">待付款訂單</p>'+pending.map(o=>'<div class="list-row"><div class="grow"><strong>'+o.orderNo+'</strong><small>NT$'+o.twd+' · '+o.yuanbao+' 元寶 · '+o.method+'</small></div><button class="btn" onclick="payOrder(\''+o.orderNo+'\')">繼續付款</button></div>').join('');
  }else if(shopTab==='premium'){
    C.techniques.forEach(t=>{const owned=g.techniques.includes(t.id);h+='<div class="list-row shop-rich"><div class="grow"><strong>'+t.name+' <span class="pill">'+t.category+'</span></strong><small>'+esc(techniqueDetail(t))+'<br>售價：'+t.price+' 元寶</small></div><button class="btn '+(owned?'':'gold')+'" '+(owned?'disabled':'')+' onclick="buyTechnique(\''+t.id+'\')">'+(owned?'已研習':'購買')+'</button></div>'});
    const max=Math.max(1,Math.floor(g.yuanbao/20));h+='<div class="list-row shop-rich"><div class="grow"><strong>轉身丹</strong><small>'+esc(itemDetail(IT['9001']))+'<br>單價：20 元寶</small>'+qtyBox('premium','9001',max)+'</div><button class="btn gold" onclick="buyPremiumItem(\'9001\',20,readQty(\'premium\',\'9001\','+max+'))">批量購買</button></div>';
  }else if(shopTab==='exchange'){
    h+='<div class="form"><label>兌換元寶數量（1 元寶 = '+P.yuanbao_exchange_lingshi+' 靈石）</label><input id="exchangeAmount" type="number" min="1" max="'+g.yuanbao+'" value="1"><button class="btn gold" onclick="exchangeYuanbao()">確認單向兌換</button></div>';
  }else if(shopTab==='npc'){
    C.npcShop.forEach(s=>{const it=IT[String(s.id)],max=npcMaxQty(s),remain=Math.max(0,(s.daily||9999)-dailyBought(s.id));h+='<div class="list-row shop-rich"><div class="grow"><strong>'+s.name+'</strong><small>'+esc(itemDetail(it))+'<br>單價 '+s.price+' 靈石｜今日剩餘 '+remain+'</small>'+(max>0?qtyBox('npc',s.id,max):'')+'</div><button class="btn" '+(max<1?'disabled':'')+' onclick="buyNpc(\''+s.id+'\','+s.price+',readQty(\'npc\',\''+s.id+'\','+Math.max(1,max)+'))">批量購買</button></div>'});
  }else{
    const ids=Object.keys(g.inv).filter(id=>g.inv[id]>0&&sellPrice(id)>0);if(!ids.length&&!g.equipment.length)h+='<p class="small">目前沒有 NPC 願意回收的物品。</p>';
    ids.forEach(id=>h+='<div class="list-row"><div class="grow"><strong>'+IT[id].name+' ×'+g.inv[id]+'</strong><small>回收價 '+sellPrice(id)+' 靈石／件</small></div><button class="btn" onclick="sellItem(\''+id+'\')">出售1件</button></div>');
    g.equipment.forEach(e=>h+='<div class="list-row"><div class="grow"><strong>'+e.name+' +'+e.enhance+'</strong><small>獨立裝備回收價 '+sellEquipmentPrice(e)+' 靈石</small></div><button class="btn red" onclick="sellEquipment(\''+e.uid+'\')">出售此件</button></div>');
  }
  h+='<button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">離開商城</button>';sheet(h);
};

buyPremiumItem = function(id,price,qty=1){
  qty=Math.max(1,Math.floor(qty));const total=price*qty;if(g.yuanbao<total){toast('商城元寶不足');return}
  g.yuanbao-=total;g.inv[id]=(g.inv[id]||0)+qty;log('購得 '+IT[id].name+' ×'+qty+'，共消耗 '+total+' 元寶。','lg');render();renderShop();
};
buyNpc = function(id,price,qty=1){
  const s=C.npcShop.find(x=>String(x.id)===String(id));const max=s?npcMaxQty(s):9999;qty=clamp(Math.floor(qty),1,Math.max(1,max));
  const total=price*qty;if(g.lingshi+g.boundStone<total){toast('靈石不足');return}
  if(s&&qty>max){toast('超過今日限購或可負擔數量');return}
  let remain=total;if(g.boundStone>0){const use=Math.min(g.boundStone,remain);g.boundStone-=use;remain-=use}g.lingshi-=remain;
  if(isEquipmentId(id)){for(let i=0;i<qty;i++)g.equipment.push(newEquipment(id))}else g.inv[String(id)]=(g.inv[String(id)]||0)+qty;
  if(s)g.purchaseLimits[dailyKey(id)]=dailyBought(id)+qty;
  log('向 NPC 購得 '+IT[String(id)].name+' ×'+qty+'，共消耗 '+total+' 靈石。','lg');render();renderShop();
};

function openMonsterDex(){
  const rows=C.monsters.map(m=>'<div class="monster-card"><img src="'+esc(m.image||('assets/monsters/'+m.id+'.svg'))+'" alt="'+esc(m.name)+'"><div><strong>'+esc(m.name)+'</strong><span>'+esc(m.cat)+' · Lv'+m.lv+'</span><small>體力 '+m.hp+'｜攻擊 '+m.atk+'｜防禦 '+m.def+'<br>出沒：'+esc(m.spawn)+'</small></div></div>').join('');
  sheet('<h3>妖獸圖鑑</h3><p class="small">V12 已為全部 '+C.monsters.length+' 種怪物配置圖像；戰鬥與圖鑑共用同一資料來源。</p><div class="monster-grid">'+rows+'</div><button class="btn" style="width:100%;margin-top:10px" onclick="closeOv()">關閉圖鑑</button>');
}

async function submitFeedback(){
  if(!cloudState.enabled||!cloudState.user){toast('回報需登入封測伺服器');return}
  const category=$('feedbackCategory').value,message=$('feedbackMessage').value.trim();if(message.length<2){toast('請描述問題');return}
  const {error}=await cloudState.client.from('beta_feedback').insert({user_id:cloudState.user.id,player_name:g?.name||'未凝聚道體',category,message,build:V12_BUILD});
  if(error){toast('回報失敗：'+error.message);return}toast('問題已送入封測回報庫');closeOv();
}
function openFeedback(){
  sheet('<h3>封測問題回報</h3><div class="form"><label>類型</label><select id="feedbackCategory"><option>BUG</option><option>介面</option><option>數值</option><option>流程</option><option>建議</option><option>其他</option></select><label>描述</label><textarea id="feedbackMessage" maxlength="1000" placeholder="請寫下發生位置、操作步驟與看到的結果"></textarea><button class="btn gold" onclick="submitFeedback()">送出回報</button></div><button class="btn" style="width:100%;margin-top:8px" onclick="closeOv()">取消</button>');
}

render = function(){
  v11Render();
  const img=$('meditationPortrait');if(img)img.classList.toggle('active',!!g?.meditating);
  const stream=$('qiStream');if(stream)stream.classList.toggle('active',!!g?.meditating);
  const mode=$('cloudModeText');if(mode)mode.textContent=cloudState.preview?'OFFLINE PREVIEW':'ONLINE CBT';
  updateCloudBadge();
  if(cloudState.channel&&cloudState.user)cloudState.channel.track({user_id:cloudState.user.id,name:g?.name||'未凝聚道體',realm:g?.big||'',level:g?.lv||0,online_at:new Date().toISOString()});
};

tickAiWorld = function(){
  v11TickAiWorld();
  if(Math.random()<.18)postAiWorldLine();
};

openVersion = function(){
  sheet('<h3>V12 聯網封測候選版</h3><div class="list-row"><div class="grow"><strong>伺服器權威自動存檔</strong><small>每次行動、固定心跳、重新連線補傳；多裝置衝突由伺服器新版本勝出。</small></div></div><div class="list-row"><div class="grow"><strong>全服傳音與在線狀態</strong><small>真人共用世界頻道；世界修士由伺服器持久運行並發言，避免每位玩家各自洗頻。</small></div></div><div class="list-row"><div class="grow"><strong>完整怪物圖像</strong><small>17 種怪物皆有圖鑑與戰鬥頭像。</small></div></div><div class="list-row"><div class="grow"><strong>戰鬥台詞</strong><small>攻擊、受擊、暴擊、格擋皆有獨立台詞與文字泡泡。</small></div></div><div class="list-row"><div class="grow"><strong>神識跨階規則</strong><small>同一大境界可判斷強弱與體力；跨境界隱藏精確數值。</small></div></div><div class="list-row"><div class="grow"><strong>商城補強</strong><small>保留原商城與單件獨立強化；新增數值說明、批量購買、最大數量及每日限購。</small></div></div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">關閉</button>');
};

confirmReset = function(){
  sheet('<h3 style="color:var(--red)">重置角色</h3><p>這會刪除伺服器上的角色存檔與本機緊急快取。此動作不可復原。</p><div class="row"><button class="btn red" onclick="resetCharacter()">確認重置</button><button class="btn" onclick="closeOv()">取消</button></div>');
};
async function resetCharacter(){
  if(cloudState.enabled&&cloudState.user){const {error}=await cloudState.client.from('game_saves').delete().eq('user_id',cloudState.user.id);if(error){toast('重置失敗：'+error.message);return}}
  localStorage.removeItem(V12_LOCAL_CACHE);localStorage.removeItem(V12_RECOVERY_CONFLICT);localStorage.removeItem(SAVE_KEY);location.reload();
}
loseFight = function(){
  const name=fight?.enemy?.name||'未知敵手';fight=null;g.dead=true;closeOv();saveGame(false);
  sheet('<h3 style="color:var(--red)">身隕道消</h3><p>你被 '+esc(name)+' 所殺。死亡狀態已同步伺服器，不會因重新整理而回朔。</p><button class="btn gold" onclick="resetCharacter()">重新凝聚道體</button>');
};

setTimeout(initV12Online,0);

/* ============================================================
   V12.1 PATCH — permanent death, account wallet, persistent world
   ============================================================ */
const V121_DEATH_LOCK='xianxia_v121_death_lock';
Object.assign(cloudState,{
  walletBalance:0,walletRevision:0,walletUpdatedAt:null,
  worldLoaded:false,worldSyncAt:0,worldSyncBusy:false,worldTimer:null,
  graves:[],migrationReady:false
});

function cloneForSave(){
  const clean=typeof structuredClone==='function'?structuredClone(g):JSON.parse(JSON.stringify(g));
  delete clean.yuanbao;
  clean.dead=false;
  return clean;
}
function buildSavePayload(){
  return {savedAt:Date.now(),build:V12_BUILD,userId:cloudState.user?.id||null,clientRevision:cloudState.revision,g:cloneForSave()};
}
function setWallet(balance,revision=cloudState.walletRevision,updatedAt=null){
  cloudState.walletBalance=Math.max(0,Number(balance||0));
  cloudState.walletRevision=Number(revision||0);
  cloudState.walletUpdatedAt=updatedAt?Date.parse(updatedAt):Date.now();
  if(g)g.yuanbao=cloudState.walletBalance;
  const e=$('yb');if(e)e.textContent=cloudState.walletBalance.toLocaleString();
}
async function loadAccountWallet(){
  if(!cloudState.enabled||!cloudState.user)return;
  const legacy=Math.max(0,Number(cloudState.remoteSave?.g?.yuanbao||0));
  const {data,error}=await cloudState.client.rpc('ensure_account_wallet',{p_legacy_yuanbao:legacy});
  if(error){
    cloudState.migrationReady=false;
    throw new Error('V12.1 資料庫尚未升級：'+error.message);
  }
  const row=Array.isArray(data)?data[0]:data;
  setWallet(row?.yuanbao||0,row?.revision||1,row?.updated_at);
  cloudState.migrationReady=true;
}
async function walletTransaction(delta,reason,referenceKey){
  if(!cloudState.enabled||!cloudState.user)throw new Error('尚未登入封測伺服器');
  const {data,error}=await cloudState.client.rpc('apply_wallet_transaction',{p_delta:Math.trunc(delta),p_reason:reason,p_reference_key:referenceKey});
  if(error){
    if(String(error.message).includes('INSUFFICIENT_YUANBAO'))throw new Error('商城元寶不足');
    throw error;
  }
  const row=Array.isArray(data)?data[0]:data;
  setWallet(row?.yuanbao||0,row?.revision||0,row?.updated_at);
  return row;
}

async function loadCloudSave(){
  if(!cloudState.enabled||!cloudState.user)return;
  const {data,error}=await cloudState.client.from('game_saves').select('save_data,revision,updated_at').eq('user_id',cloudState.user.id).maybeSingle();
  if(error){cloudState.lastError=error.message;updateCloudBadge();return}
  cloudState.remoteSave=data?.save_data||null;
  cloudState.revision=data?.revision||0;
  cloudState.lastSyncedAt=data?.updated_at?Date.parse(data.updated_at):null;
}
async function archiveLegacyDeadSave(){
  if(!cloudState.remoteSave?.g?.dead)return false;
  const payload=cloudState.remoteSave;
  try{await cloudState.client.rpc('record_character_death',{p_snapshot:payload,p_cause:'舊版本死亡紀錄'});}catch(e){console.warn(e)}
  cloudState.remoteSave=null;cloudState.revision=0;
  localStorage.removeItem(V12_LOCAL_CACHE);
  return true;
}
async function retryDeathLock(){
  let lock=null;
  try{lock=JSON.parse(localStorage.getItem(V121_DEATH_LOCK)||'null')}catch(_){lock=null}
  if(!lock||lock.userId!==cloudState.user?.id)return;
  try{
    const {error}=await cloudState.client.rpc('record_character_death',{p_snapshot:lock.snapshot,p_cause:lock.cause||'身隕道消'});
    if(error)throw error;
    localStorage.removeItem(V121_DEATH_LOCK);
    localStorage.removeItem(V12_LOCAL_CACHE);
    cloudState.remoteSave=null;cloudState.revision=0;
  }catch(e){cloudState.lastError='死亡紀錄等待同步：'+e.message;updateCloudBadge()}
}
async function afterCloudLogin(){
  cloudState.lastError='';
  try{
    await loadCloudSave();
    await loadAccountWallet();
    await retryDeathLock();
    await loadCloudSave();
    await archiveLegacyDeadSave();
    await syncWorldCultivators(true);
    await recoverEmergencyCache();
    await initRealtime();
    await loadRecentGraves();
    $('continueBtn').style.display=cloudState.remoteSave?.g&&!cloudState.remoteSave.g.dead?'block':'none';
    updateCloudBadge();
  }catch(e){
    cloudState.lastError=e.message||String(e);updateCloudBadge();
    sheet('<h3>V12.1 升級尚未完成</h3><div class="notice">'+esc(cloudState.lastError)+'</div><p class="small">請先在 Supabase SQL Editor 執行「01_只執行這個_升級資料庫_V12_1.sql」，再重新整理遊戲。</p><button class="btn gold" style="width:100%" onclick="location.reload()">重新檢查</button>');
  }
}
async function loadRecentGraves(){
  if(!cloudState.enabled||!cloudState.user)return;
  const {data}=await cloudState.client.from('character_graves').select('id,player_name,level,realm,cause,died_at').order('died_at',{ascending:false}).limit(10);
  cloudState.graves=data||[];
}

function readEmergencyCache(){
  try{
    const raw=localStorage.getItem(V12_LOCAL_CACHE);if(!raw)return null;
    const data=JSON.parse(raw);if(!data?.g||data.g.dead)return null;
    if(data.userId&&cloudState.user&&data.userId!==cloudState.user.id)return null;
    return data;
  }catch(e){return null}
}
function applySavePayload(data){
  if(!data?.g)throw new Error('存檔格式不完整');
  if(data.g.dead)throw new Error('此道體已身隕，不能重新載入');
  g=data.g;
  normalizeSave();
  g.dead=false;g.yuanbao=cloudState.walletBalance;
  if(!g.characterId)g.characterId=(crypto.randomUUID?crypto.randomUUID():'char_'+Date.now()+'_'+Math.random().toString(36).slice(2));
  if(!cloudState.worldLoaded)ai=initAi();
  applyOffline(data.savedAt||g.lastSavedAt||Date.now());
}
continueGame=async function(){
  try{
    if(cloudState.enabled){
      if(!cloudState.user){show('auth');return}
      await loadCloudSave();
      if(!cloudState.remoteSave){toast('目前沒有存活道體');show('create');return}
      if(cloudState.remoteSave.g?.dead){await archiveLegacyDeadSave();toast('死亡道體已封存，請建立新角色');show('create');return}
      applySavePayload(cloudState.remoteSave);
    }else if(cloudState.preview){
      const local=readEmergencyCache();if(!local){show('create');return}applySavePayload(local);
    }else return openServerSetup();
    show('game');startLoops();render();log('現存道體已從伺服器喚醒。','lg');
  }catch(e){toast('道體載入失敗：'+e.message);show('create')}
};
startGame=async function(){
  if(!C)return;
  if(V12_ONLINE.requireCloudForBeta&&!cloudState.enabled&&!cloudState.preview){openServerSetup();return}
  if(cloudState.enabled&&!cloudState.user){show('auth');return}
  if(cloudState.remoteSave?.g&&!cloudState.remoteSave.g.dead){toast('此帳號已有存活道體');return}
  const nm=$('nm').value.trim()||'無名散修';
  g=freshGame(nm);g.characterId=(crypto.randomUUID?crypto.randomUUID():'char_'+Date.now()+'_'+Math.random().toString(36).slice(2));
  g.build=V12_BUILD;g.yuanbao=cloudState.walletBalance;g.dead=false;
  if(!cloudState.worldLoaded)ai=initAi();
  show('game');startLoops();
  log('你在 <b>青牛谷</b> 凝聚全新道體。此生只有一次。','la');
  log('角色死亡即永久身隕；帳號元寶則由雲端錢包永久保留。');
  saveGame(false);render();
  if(cloudState.enabled)await flushCloudSave(true);
  setTimeout(()=>openTutorial(0),450);
};
saveGame=function(showToast=false){
  if(!g||g.dead)return;
  g.lastSavedAt=Date.now();g.yuanbao=cloudState.walletBalance;
  const payload=buildSavePayload();
  localStorage.setItem(V12_LOCAL_CACHE,JSON.stringify(payload));
  if(cloudState.enabled&&cloudState.user)scheduleCloudSave();
  if(showToast)toast(cloudState.enabled?'已排入雲端同步':'離線預覽暫存');
};
async function flushCloudSave(force=false){
  if(!g||g.dead||!cloudState.enabled||!cloudState.user)return;
  if(!navigator.onLine){updateCloudBadge();return}
  if(cloudState.saving){cloudState.pending=true;return}
  cloudState.saving=true;cloudState.pending=false;updateCloudBadge();
  const payload=buildSavePayload();
  try{
    const {data,error}=await cloudState.client.rpc('save_game_state',{p_save:payload,p_client_revision:cloudState.revision});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('伺服器未回傳存檔結果');
    if(row.accepted){
      cloudState.revision=Number(row.server_revision||cloudState.revision+1);cloudState.lastSyncedAt=row.server_updated_at?Date.parse(row.server_updated_at):Date.now();cloudState.remoteSave=payload;cloudState.lastError='';
      localStorage.setItem(V12_LOCAL_CACHE,JSON.stringify({...payload,clientRevision:cloudState.revision}));
    }else{
      cloudState.revision=Number(row.server_revision||0);cloudState.remoteSave=row.server_save;applySavePayload(row.server_save);render();toast('另一裝置已有更新，已採用伺服器最新道體');
    }
  }catch(e){cloudState.lastError=e.message||String(e);console.error(e)}
  finally{cloudState.saving=false;updateCloudBadge();if(cloudState.pending)scheduleCloudSave(true)}
}
function flushOnUnload(){
  if(!g||g.dead||!cloudState.enabled||!cloudState.user||!navigator.onLine)return;
  const payload=buildSavePayload();
  cloudState.client.auth.getSession().then(({data})=>{
    const token=data.session?.access_token;if(!token)return;
    fetch(V12_ONLINE.supabaseUrl+'/rest/v1/rpc/save_game_state',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','apikey':V12_ONLINE.supabasePublishableKey,'Authorization':'Bearer '+token},body:JSON.stringify({p_save:payload,p_client_revision:cloudState.revision})}).catch(()=>{});
  }).catch(()=>{});
}

async function finalizePermanentDeath(cause){
  if(!g)return;
  clearInterval(tickTimer);clearInterval(aiTimer);g.dead=true;g.meditating=false;
  const snapshot={savedAt:Date.now(),build:V12_BUILD,userId:cloudState.user?.id||null,g:{...g,yuanbao:undefined}};
  const lock={userId:cloudState.user?.id||null,cause,snapshot};
  localStorage.setItem(V121_DEATH_LOCK,JSON.stringify(lock));
  localStorage.removeItem(V12_LOCAL_CACHE);localStorage.removeItem(SAVE_KEY);
  let archived=false;
  if(cloudState.enabled&&cloudState.user&&navigator.onLine){
    try{
      const {error}=await cloudState.client.rpc('record_character_death',{p_snapshot:snapshot,p_cause:cause});if(error)throw error;
      archived=true;localStorage.removeItem(V121_DEATH_LOCK);cloudState.remoteSave=null;cloudState.revision=0;await loadRecentGraves();
    }catch(e){cloudState.lastError='死亡封存等待同步：'+e.message;updateCloudBadge()}
  }
  showDeathScreen(cause,archived);
}
function showDeathScreen(cause,archived){
  closeOv();
  let layer=document.getElementById('graveLock');if(layer)layer.remove();
  layer=document.createElement('div');layer.id='graveLock';layer.className='grave-lock';
  layer.innerHTML='<div class="grave-card"><div class="intro-seal" style="width:72px;height:72px;font-size:30px">墓</div><h2>身隕道消</h2><p><b>'+esc(g?.name||'此世道體')+'</b> 已永久死亡。</p><p class="small">死因：'+esc(cause)+'<br>'+(archived?'死亡紀錄已封存至伺服器。':'網路異常，死亡鎖已保存；重新連線後會自動封存。')+'</p><div class="notice">此角色的境界、功法、裝備、靈石與進度不可恢復。帳號商城元寶保留：'+cloudState.walletBalance.toLocaleString()+'。</div><button class="btn gold" style="width:100%;margin-top:14px" onclick="beginNewCharacter()">建立全新道體</button></div>';
  document.body.appendChild(layer);
}
function beginNewCharacter(){
  const layer=document.getElementById('graveLock');if(layer)layer.remove();
  g=null;fight=null;corpse=null;localStorage.removeItem(V12_LOCAL_CACHE);$('continueBtn').style.display='none';show('create');
}
loseFight=function(){const cause='遭 '+(fight?.enemy?.name||'未知敵手')+' 擊殺';fight=null;finalizePermanentDeath(cause)};
confirmReset=function(){
  sheet('<h3 style="color:var(--red)">放棄道體</h3><p>放棄等同此角色永久死亡：角色進度不可恢復，但帳號元寶仍會保留。</p><div class="row"><button class="btn red" onclick="closeOv();finalizePermanentDeath(\'自行散去道體\')">確認放棄</button><button class="btn" onclick="closeOv()">取消</button></div>');
};
async function resetCharacter(){return finalizePermanentDeath('自行散去道體')}

function mapWorldRow(r){
  return {id:Number(r.id),name:r.name,personality:r.personality,weights:r.behavior_weights,lv:Number(r.level),realm:r.realm,coord:r.coord,hp:Number(r.hp),hpMax:Number(r.hp_max),mp:Number(r.mp),mpMax:Number(r.mp_max),alive:!!r.alive,gear:Array.isArray(r.gear)?r.gear:[],inv:r.inventory||{},techniques:Array.isArray(r.techniques)?r.techniques:[],lingshi:Number(r.lingshi||0),action:r.action||'修行'};
}
async function syncWorldCultivators(force=false){
  if(!cloudState.enabled||!cloudState.user){
    if(!ai.length)ai=initAi();cloudState.worldLoaded=ai.length>0;updateWorldPopulation();return;
  }
  if(cloudState.worldSyncBusy||(!force&&Date.now()-cloudState.worldSyncAt<6000))return;
  cloudState.worldSyncBusy=true;
  try{
    await cloudState.client.rpc('advance_world_cultivators',{p_limit:50});
    const {data,error}=await cloudState.client.from('world_cultivators').select('id,name,personality,behavior_weights,level,realm,coord,hp,hp_max,mp,mp_max,lingshi,gear,inventory,techniques,action,alive').eq('alive',true).order('id');
    if(error)throw error;
    ai=(data||[]).map(mapWorldRow);cloudState.worldLoaded=true;cloudState.worldSyncAt=Date.now();
    renderAiIntel();updateWorldPopulation();
  }catch(e){cloudState.lastError='世界修士同步異常：'+e.message;updateCloudBadge()}
  finally{cloudState.worldSyncBusy=false}
}
function updateWorldPopulation(){
  const real=Object.keys(cloudState.presence||{}).length;
  const living=ai.filter(x=>x.alive).length;
  const total=living+real;
  const e=$('activeAi');if(e)e.textContent=String(total||150);
  const label=$('worldPopulationText');if(label)label.textContent='全域修士氣息 '+(total||150);
}
tickAiWorld=function(){
  if(cloudState.enabled&&cloudState.user)syncWorldCultivators(false);
  else {v11TickAiWorld();updateWorldPopulation()}
};

async function initRealtime(){
  teardownRealtime();if(!cloudState.enabled||!cloudState.user)return;
  const channelName=V12_ONLINE.worldChannel||'xianxia-world-v12';
  cloudState.channel=cloudState.client.channel(channelName,{config:{presence:{key:cloudState.user.id}}});
  cloudState.channel
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'world_chat'},payload=>{cloudState.chatMessages.push(payload.new);cloudState.chatMessages=cloudState.chatMessages.slice(-100);renderChatIfOpen()})
   .on('postgres_changes',{event:'*',schema:'public',table:'world_cultivators'},()=>{setTimeout(()=>syncWorldCultivators(true),250)})
   .on('presence',{event:'sync'},()=>{cloudState.presence=cloudState.channel.presenceState();updateWorldPopulation()})
   .subscribe(async status=>{if(status==='SUBSCRIBED'){await cloudState.channel.track({user_id:cloudState.user.id,name:g?.name||'未凝聚道體',build:V12_BUILD,online_at:new Date().toISOString()})}});
  const {data}=await cloudState.client.from('world_chat').select('id,user_id,player_name,speaker_type,message,created_at,cultivator_id').order('created_at',{ascending:false}).limit(80);
  cloudState.chatMessages=(data||[]).reverse();renderChatIfOpen();
}
function openWorldChat(){
  const dock=$('worldChatDock');if(dock)dock.scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(()=>$('worldChatInlineInput')?.focus(),350);
}
function renderChatIfOpen(){
  const html=cloudState.chatMessages.slice(-70).map(m=>'<div class="chat-line '+esc(m.speaker_type==='ai'?'cultivator':m.speaker_type)+'"><span>['+new Date(m.created_at).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})+']</span><b>'+esc(m.player_name)+'</b><p>'+esc(m.message)+'</p></div>').join('')||'<div class="small">世界頻道尚無傳音。</div>';
  const inline=$('worldChatInlineList');if(inline){inline.innerHTML=html;inline.scrollTop=inline.scrollHeight}
  const modal=$('worldChatList');if(modal){modal.innerHTML=html;modal.scrollTop=modal.scrollHeight}
}
async function sendWorldChat(){
  if(!cloudState.enabled||!cloudState.user){toast('全服傳音需登入封測伺服器');return}
  const input=$('worldChatInlineInput')||$('worldChatInput'),message=(input?.value||'').trim();if(!message)return;
  if(message.length>160){toast('傳音最多 160 字');return}
  const {error}=await cloudState.client.from('world_chat').insert({user_id:cloudState.user.id,player_name:g?.name||cloudState.user.email.split('@')[0],speaker_type:'player',message});
  if(error){toast('傳音失敗：'+error.message);return}input.value='';
}
async function postAiWorldLine(){return}

function renderTechniqueDock(){
  const dock=$('techniqueDock');if(!dock||!g)return;
  const learned=(g.techniques||[]).slice(0,P.max_techniques||3);
  const slots=[];
  for(let i=0;i<(P.max_techniques||3);i++){
    const id=learned[i],t=C.techniques.find(x=>x.id===id);
    slots.push(t?'<div class="technique-slot"><b>'+esc(t.name)+' · 第一重</b><span>'+esc(techniqueDetail(t))+'</span></div>':'<div class="technique-slot empty">功法位 '+(i+1)+' · 尚未研習</div>');
  }
  dock.innerHTML=slots.join('');
}
const v121PreviousRender=render;
render=function(){
  if(!g)return;g.yuanbao=cloudState.walletBalance;
  v121PreviousRender();
  const y=$('yb');if(y)y.textContent=cloudState.walletBalance.toLocaleString();
  renderTechniqueDock();renderChatIfOpen();updateWorldPopulation();
};

async function interactWithCultivator(id,action){
  if(!cloudState.enabled)return {reply:aiReply(ai.find(x=>x.id===id),action)};
  const {data,error}=await cloudState.client.rpc('interact_world_cultivator',{p_cultivator_id:id,p_action:action});if(error)throw error;
  return Array.isArray(data)?data[0]:data;
}
function openAiInteract(id){
  const a=ai.find(x=>x.id===id);if(!a)return;
  const same=sameMajorRealm(g.big,a.lv),intel=same?relativePower(a):'境界相隔，無法判斷其強弱與體力';
  sheet('<h3>修士互動 · '+esc(a.name)+'</h3><div class="ai-dialogue"><img src="assets/ai_cultivator.svg" alt="修士頭像"><div><b>'+esc(a.personality)+'</b><p>「'+esc(aiReply(a,'greet'))+'」</p><small>'+esc(intel)+'</small></div></div><div class="command-row"><button class="btn jade" onclick="talkToAi('+id+')">交談</button><button class="btn gold" onclick="tradeWithAi('+id+')">詢問交易</button><button class="btn red" onclick="startFightAi('+id+')">攔截鬥法</button></div><button class="btn" style="width:100%;margin-top:8px" onclick="closeOv()">離開</button>');
}
async function talkToAi(id){
  const a=ai.find(x=>x.id===id);if(!a)return;
  try{const r=await interactWithCultivator(id,'talk');log('<b>'+esc(a.name)+'</b>：「'+esc(r?.reply||aiReply(a,'talk'))+'」','la');openAiInteract(id)}catch(e){toast('互動失敗：'+e.message)}
}
async function tradeWithAi(id){
  const a=ai.find(x=>x.id===id);if(!a)return;
  try{const r=await interactWithCultivator(id,'trade');sheet('<h3>'+esc(a.name)+' 的回應</h3><p>「'+esc(r?.reply||aiReply(a,'trade'))+'」</p><p class="small">你們的交情：'+Number(r?.affinity||0)+'</p><button class="btn" style="width:100%" onclick="openAiInteract('+id+')">返回</button>')}catch(e){toast('互動失敗：'+e.message)}
}
startFightAi=function(id){
  const a=ai.find(x=>x.id===id);if(!a||!a.alive)return;stopMeditate('遭遇修士');closeOv();
  const rr=realmOf(a.lv),wp=(a.gear||[]).find(e=>e.cat==='法器'&&e.equipped),ar=(a.gear||[]).find(e=>e.cat==='防具'&&e.equipped);
  const atk=Math.round(rr.atk+(wp?(IT[wp.itemId]?.val||0)*(1+.05*(wp.enhance||0)):0)),def=Math.round(rr.def+(ar?(IT[ar.itemId]?.val||0)*(1+.05*(ar.enhance||0)):0));
  fight={kind:'cultivator',aiId:id,serverStartHp:a.hp,enemy:{name:a.name,lv:a.lv,big:rr.big,image:'assets/ai_cultivator.svg',personality:a.personality,hp:a.hpMax,atk,def,exp:Math.round(a.lv*70+40)},hp:a.hp,hpMax:a.hpMax};
  renderFight('兩道神識交鋒，'+a.name+' 已拔劍。',{enemy:rnd(C.combatSpeech.aiAttack)});
};
function canSeeFightHp(){return fight?.kind!=='cultivator'||sameMajorRealm(g.big,fight.enemy.lv)}
const v121MonsterWin=winFight;
winFight=async function(){
  if(!fight)return;
  if(fight.kind==='monster')return v121MonsterWin();
  const f=fight;fight=null;closeOv();
  const a=ai.find(x=>x.id===f.aiId);
  try{
    if(cloudState.enabled){
      const {data,error}=await cloudState.client.rpc('damage_world_cultivator',{p_cultivator_id:f.aiId,p_damage:1000000,p_cause:'遭 '+g.name+' 擊敗'});if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;if(!row?.defeated){toast('對方已被其他修士先一步擊敗');await syncWorldCultivators(true);render();return}
    }
    if(a){a.alive=false;a.hp=0;log('你擊敗修士 '+a.name+'。其死亡已同步至全服世界。','lg');gainExp(f.enemy.exp,false);openCorpse(a)}
    await syncWorldCultivators(true);render();
  }catch(e){toast('世界戰果同步失敗：'+e.message);render()}
};

confirmPayment=async function(no){
  const code=$('gatewayCode').value.trim().toUpperCase();if(code!=='TEST-PAID'){toast('付款回傳碼不正確');return}
  const o=g.orders.find(x=>x.orderNo===no);if(!o||o.status==='已付款')return;
  try{
    await walletTransaction(o.yuanbao,'sandbox_order','order:'+o.orderNo);
    o.status='已付款';o.paidAt=Date.now();g.yuanbao=cloudState.walletBalance;
    log('訂單 '+o.orderNo+' 支付沙盒驗證成功，帳號元寶 +'+o.yuanbao+'。','lg');saveGame(false);render();openShop('yuanbao');
  }catch(e){toast('元寶入帳失敗：'+e.message)}
};
buyTechnique=async function(id){
  const t=C.techniques.find(x=>x.id===id);if(!t||g.techniques.includes(id))return;
  if(g.techniques.length>=P.max_techniques){toast('最多同時研習 '+P.max_techniques+' 種功法');return}
  try{await walletTransaction(-t.price,'buy_technique','tech:'+g.characterId+':'+id);g.techniques.push(id);g.yuanbao=cloudState.walletBalance;log('研習功法 '+t.name+'。','lg');saveGame(false);render();renderShop()}catch(e){toast(e.message)}
};
buyPremiumItem=async function(id,price,qty=1){
  qty=Math.max(1,Math.floor(qty));const total=price*qty;
  try{await walletTransaction(-total,'buy_premium','premium:'+g.characterId+':'+id+':'+Date.now());g.inv[id]=(g.inv[id]||0)+qty;g.yuanbao=cloudState.walletBalance;log('購得 '+IT[id].name+' ×'+qty+'，共消耗 '+total+' 帳號元寶。','lg');saveGame(false);render();renderShop()}catch(e){toast(e.message)}
};
exchangeYuanbao=async function(){
  const n=Math.floor(Number($('exchangeAmount').value));if(!(n>0)){toast('元寶數量不正確');return}
  try{await walletTransaction(-n,'exchange_lingshi','exchange:'+g.characterId+':'+Date.now());g.lingshi+=n*P.yuanbao_exchange_lingshi;g.yuanbao=cloudState.walletBalance;log('兌換 '+n+' 帳號元寶為 '+(n*P.yuanbao_exchange_lingshi)+' 靈石。','lg');saveGame(false);render();renderShop()}catch(e){toast(e.message)}
};

openCloudStatus=function(){
  const mode=cloudState.preview?'離線預覽':cloudState.enabled?'正式雲端存檔':'未連線',account=cloudState.user?.email||'尚未登入',t=cloudState.lastSyncedAt?new Date(cloudState.lastSyncedAt).toLocaleString('zh-TW'):'尚未完成';
  sheet('<h3>雲端存檔狀態</h3><div class="money"><div><span>模式</span><b style="font-size:14px">'+esc(mode)+'</b></div><div><span>帳號</span><b style="font-size:12px">'+esc(account)+'</b></div><div><span>存檔版本</span><b>'+cloudState.revision+'</b></div><div><span>帳號元寶</span><b>'+cloudState.walletBalance.toLocaleString()+'</b></div></div><div class="notice" style="margin-top:12px">角色行動自動存檔；角色死亡後立即封存墓誌並刪除可遊玩存檔。商城元寶獨立存於帳號錢包，不隨死亡消失。</div><p class="small">最後同步：'+esc(t)+(cloudState.lastError?'<br>錯誤：'+esc(cloudState.lastError):'')+'</p><div class="row"><button class="btn jade" onclick="flushCloudSave(true)">立即檢查同步</button>'+(cloudState.user?'<button class="btn red" onclick="logoutBeta()">登出</button>':'')+'</div><button class="btn" style="width:100%;margin-top:8px" onclick="closeOv()">關閉</button>');
};
openVersion=function(){
  sheet('<h3>V12.1 永久死亡與世界修士版</h3><div class="list-row"><div class="grow"><strong>永久死亡</strong><small>死亡角色立即封存，不能復活、回朔或繼續；只能建立全新道體。</small></div></div><div class="list-row"><div class="grow"><strong>帳號級元寶</strong><small>元寶獨立存放於雲端帳號錢包，角色死亡仍完整保留。</small></div></div><div class="list-row"><div class="grow"><strong>150位共用世界修士</strong><small>伺服器持久保存位置、境界、體力、裝備、行動、聊天與死亡狀態；所有真人看到同一個世界。</small></div></div><div class="list-row"><div class="grow"><strong>常駐全服傳音</strong><small>傳音視窗固定在天機紀錄旁，不必另開視窗。</small></div></div><div class="list-row"><div class="grow"><strong>常駐功法欄</strong><small>三個功法位固定顯示名稱、重數與當前效果。</small></div></div><div class="list-row"><div class="grow"><strong>獨立強化保留</strong><small>每一件裝備仍擁有自己的強化值，規則未改動。</small></div></div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">關閉</button>');
};

// Enter key sends the permanent chat box.
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.activeElement===$('worldChatInlineInput')){e.preventDefault();sendWorldChat()}});
