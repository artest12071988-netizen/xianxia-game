'use strict';

const V12_ONLINE = window.XIANXIA_ONLINE_CONFIG || {};
const V12_PREVIEW = new URLSearchParams(location.search).get('preview') === '1' || ['localhost','127.0.0.1'].includes(location.hostname);
const V12_LOCAL_CACHE = 'xianxia_v12_emergency_cache';
const V12_RECOVERY_CONFLICT = 'xianxia_v12_recovery_conflict';
const V12_BUILD = V12_ONLINE.build || 'V12-CBT';
const cloudState = {
  client:null,user:null,enabled:false,preview:false,revision:0,remoteSave:null,
  saveTimer:null,saving:false,pending:false,lastSyncedAt:null,lastError:'',
  channel:null,presence:{},chatMessages:[],chatOpen:false,aiChatAt:0,chatRefreshTimer:null,chatPinnedToBottom:true
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
function teardownRealtime(){
  if(cloudState.channel&&cloudState.client)cloudState.client.removeChannel(cloudState.channel);
  if(cloudState.chatRefreshTimer)clearInterval(cloudState.chatRefreshTimer);
  cloudState.chatRefreshTimer=null;cloudState.channel=null;cloudState.presence={};
}

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
  let h='<h3>商城與萬寶坊市</h3><div class="money"><div><span>商城元寶</span><b>'+g.yuanbao.toLocaleString()+'</b></div><div><span>靈石</span><b>'+g.lingshi.toLocaleString()+'</b></div><div><span>綁定靈石</span><b>'+g.boundStone.toLocaleString()+'</b></div></div><div class="tabs">'+tabBtn('yuanbao','看廣告得元寶')+tabBtn('premium','功法商城')+tabBtn('exchange','元寶兌換')+tabBtn('npc','NPC購買')+tabBtn('sell','出售物品')+'</div>';
  if(shopTab==='yuanbao'){
    const a=cloudState.adStatus||{};
    h+='<div class="notice">封測版元寶改為獎勵式廣告取得。每次觀看前會明確顯示獎勵；跳過或未完成不會獲得元寶。</div>';
    h+='<div class="list-row shop-rich"><div class="grow"><strong>觀看廣告獲得 '+Number(a.yuanbao_per_ad||200)+' 元寶</strong><small>今日已完成 '+Number(a.used_today||0)+'／'+Number(a.daily_limit||5)+' 次'+(a.test_mode?' · 封測模擬廣告':' · 正式廣告')+'</small></div><button class="btn gold" '+(Number(a.remaining_today||0)<=0?'disabled':'')+' onclick="watchRewardedAd(\'yuanbao\')">觀看廣告</button></div>';
    h+='<button class="btn jade" style="width:100%;margin-top:8px" onclick="loadAdRewardStatus().then(renderShop)">更新今日額度</button>';
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

const CHAT_HISTORY_LIMIT=200;

function mergeChatMessages(messages=[]){
  const merged=new Map();
  for(const m of cloudState.chatMessages||[])if(m?.id!=null)merged.set(String(m.id),m);
  for(const m of messages||[])if(m?.id!=null)merged.set(String(m.id),m);
  cloudState.chatMessages=Array.from(merged.values())
    .sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime())
    .slice(-CHAT_HISTORY_LIMIT);
}
async function loadWorldChatHistory(){
  if(!cloudState.enabled||!cloudState.user)return;
  const {data,error}=await cloudState.client.from('world_chat')
    .select('id,user_id,player_name,speaker_type,message,created_at,cultivator_id')
    .order('created_at',{ascending:false}).limit(CHAT_HISTORY_LIMIT);
  if(error){console.warn('world chat refresh failed',error);return}
  mergeChatMessages((data||[]).reverse());renderChatIfOpen();
}
function renderChatContainer(el,html,forceBottom=false){
  if(!el)return;
  const oldHeight=el.scrollHeight,oldTop=el.scrollTop;
  const nearBottom=oldHeight-oldTop-el.clientHeight<48;
  el.innerHTML=html;
  if(forceBottom||nearBottom||cloudState.chatPinnedToBottom)el.scrollTop=el.scrollHeight;
  else el.scrollTop=Math.max(0,oldTop+(el.scrollHeight-oldHeight));
  el.onscroll=()=>{cloudState.chatPinnedToBottom=el.scrollHeight-el.scrollTop-el.clientHeight<48};
}
async function initRealtime(){
  teardownRealtime();if(!cloudState.enabled||!cloudState.user)return;
  const channelName=V12_ONLINE.worldChannel||'xianxia-world-v12';
  cloudState.channel=cloudState.client.channel(channelName,{config:{presence:{key:cloudState.user.id}}});
  cloudState.channel
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'world_chat'},payload=>{mergeChatMessages([payload.new]);renderChatIfOpen()})
   .on('postgres_changes',{event:'*',schema:'public',table:'world_cultivators'},()=>{setTimeout(()=>syncWorldCultivators(true),250)})
   .on('presence',{event:'sync'},()=>{cloudState.presence=cloudState.channel.presenceState();updateWorldPopulation()})
   .subscribe(async status=>{if(status==='SUBSCRIBED'){await cloudState.channel.track({user_id:cloudState.user.id,name:g?.name||'未凝聚道體',build:V12_BUILD,online_at:new Date().toISOString()})}});
  cloudState.chatPinnedToBottom=true;
  await loadWorldChatHistory();
  cloudState.chatRefreshTimer=setInterval(loadWorldChatHistory,20000);
  renderChatIfOpen(true);
}
function openWorldChat(){
  const dock=$('worldChatDock');if(dock)dock.scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(()=>$('worldChatInlineInput')?.focus(),350);
}
function renderChatIfOpen(forceBottom=false){
  const html=cloudState.chatMessages.map(m=>'<div class="chat-line '+esc(m.speaker_type==='ai'?'cultivator':m.speaker_type)+'"><span>['+new Date(m.created_at).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})+']</span><b>'+esc(m.player_name)+'</b><p>'+esc(m.message)+'</p></div>').join('')||'<div class="small">世界頻道尚無傳音。</div>';
  renderChatContainer($('worldChatInlineList'),html,forceBottom);
  renderChatContainer($('worldChatList'),html,forceBottom);
}
async function sendWorldChat(){
  if(!cloudState.enabled||!cloudState.user){toast('全服傳音需登入封測伺服器');return}
  const input=$('worldChatInlineInput')||$('worldChatInput'),message=(input?.value||'').trim();if(!message)return;
  if(message.length>160){toast('傳音最多 160 字');return}
  cloudState.chatPinnedToBottom=true;
  const {error}=await cloudState.client.from('world_chat').insert({user_id:cloudState.user.id,player_name:g?.name||cloudState.user.email.split('@')[0],speaker_type:'player',message});
  if(error){toast('傳音失敗：'+error.message);return}input.value='';
  setTimeout(loadWorldChatHistory,350);
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


// V12.1.3 神識動靜：同一大境界才能辨識；持續回報進入、離開、移動、行動改變、負傷與修為變化。
cloudState.senseEvents = cloudState.senseEvents || [];
cloudState.senseSnapshot = cloudState.senseSnapshot || new Map();
cloudState.sensePlayerCoord = cloudState.sensePlayerCoord || null;
cloudState.senseInitialized = !!cloudState.senseInitialized;

function cloneSenseRow(a){
  return {id:a.id,name:a.name,lv:a.lv,coord:a.coord,hp:a.hp,hpMax:a.hpMax,action:a.action,alive:a.alive};
}
function senseVisibleAt(a,playerCoord){
  return !!(g&&a&&a.alive&&sameMajorRealm(g.big,a.lv)&&distanceCoord(a.coord,playerCoord)<=senseRange(g.big));
}
function pushSenseEvent(text,type='normal'){
  if(!text)return;
  const last=cloudState.senseEvents[cloudState.senseEvents.length-1];
  if(last&&last.text===text&&Date.now()-last.at<3000)return;
  cloudState.senseEvents.push({text,type,at:Date.now()});
  cloudState.senseEvents=cloudState.senseEvents.slice(-40);
}
function updateSenseActivity(rows){
  if(!g)return;
  const nowCoord=coordOf(g.pos.r,g.pos.c);
  const previous=cloudState.senseSnapshot;
  const current=new Map((rows||[]).map(a=>[String(a.id),cloneSenseRow(a)]));
  if(!cloudState.senseInitialized){
    const count=Array.from(current.values()).filter(a=>senseVisibleAt(a,nowCoord)).length;
    pushSenseEvent(count?'神識展開，辨識到附近 '+count+' 道同階修士氣息。':'神識展開，附近暫無可辨識的同階修士氣息。');
    cloudState.senseInitialized=true;
  }else{
    const oldCoord=cloudState.sensePlayerCoord||nowCoord;
    for(const [id,a] of current){
      const old=previous.get(id);
      const wasVisible=!!(old&&senseVisibleAt(old,oldCoord));
      const isVisible=senseVisibleAt(a,nowCoord);
      if(isVisible&&!wasVisible){
        pushSenseEvent('感應到 '+a.name+' 進入神識範圍，正在'+(a.action||'修行')+'。','alert');
        continue;
      }
      if(!isVisible&&wasVisible){
        pushSenseEvent(a.name+' 的氣息離開神識範圍。');
        continue;
      }
      if(!isVisible||!old)continue;
      if(old.coord!==a.coord)pushSenseEvent(a.name+' 從 '+old.coord+' 移動至 '+a.coord+'。');
      if(old.action!==a.action)pushSenseEvent(a.name+' 停止'+(old.action||'原本行動')+'，轉為'+(a.action||'修行')+'。');
      if(Number(a.hp)<Number(old.hp))pushSenseEvent(a.name+' 氣息驟弱，似乎在附近受了傷。','danger');
      if(Number(a.lv)>Number(old.lv))pushSenseEvent(a.name+' 氣息攀升，修為有所精進。','alert');
    }
    for(const [id,old] of previous){
      if(current.has(id))continue;
      if(senseVisibleAt(old,oldCoord))pushSenseEvent(old.name+' 的氣息突然斷絕，生死難明。','danger');
    }
  }
  cloudState.senseSnapshot=current;
  cloudState.sensePlayerCoord=nowCoord;
}
function renderSenseFeed(){
  const el=$('senseFeed');if(!el)return;
  const rows=cloudState.senseEvents.slice(-12).reverse();
  el.innerHTML=rows.length?rows.map(e=>'<div class="sense-event '+esc(e.type||'normal')+'"><time>'+new Date(e.at).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})+'</time>'+esc(e.text)+'</div>').join(''):'<div class="sense-empty">附近暫無新的氣機變化。</div>';
}
renderAiIntel=function(){
  if(!g||!$('aiList'))return;
  updateSenseActivity(ai);
  const range=senseRange(g.big),playerCoord=coordOf(g.pos.r,g.pos.c);
  // 跨大境界完全無法辨識，因此不列入姓名、人數、強弱或動靜。
  const near=ai.filter(a=>senseVisibleAt(a,playerCoord)).sort((a,b)=>distanceCoord(a.coord,playerCoord)-distanceCoord(b.coord,playerCoord)).slice(0,8);
  $('nearbyCount').textContent=near.length+' 人';
  $('aiList').innerHTML=near.length?near.map(a=>{
    const intel=a.personality+' · '+relativePower(a)+' · 體力 '+Math.round(a.hp)+'/'+a.hpMax;
    return '<div class="ai-item ai-click" onclick="openAiInteract('+a.id+')"><div><b>'+esc(a.name)+'</b><br><span>'+esc(intel)+'</span></div><span>'+esc(a.action||'修行')+'</span></div>';
  }).join(''):'<div class="small">神識範圍內暫無可辨識的同階修士氣息。</div>';
  renderSenseFeed();
};

/* ============================================================
   V12.2 PATCH — 真人同圖相遇、安全區規則、轉身丹、手機傳音、世界後臺
   ============================================================ */
Object.assign(cloudState,{
  extraChannel:null,otherPlayers:[],playerTimer:null,playerLoadTimer:null,safeZoneTimer:null,
  pvpTimer:null,pvpCurrent:null,pvpPrompted:new Set(),pvpHandled:new Set(),
  worldControls:null,announcementIds:new Set(),playerAction:'修行',
  lastPresenceSync:0,lastPoisonTick:0,eventCombat:false
});

const V122_SAFE_COORD='A-6';
const V122_SAFE_LIMIT_SECONDS=7200;
const v122BaseInitRealtime=initRealtime;
const v122BaseTeardownRealtime=teardownRealtime;
const v122BaseStartLoops=startLoops;
const v122BaseRender=render;
const v122BaseNormalizeSave=normalizeSave;
const v122BaseMoveTo=moveTo;
const v122BaseToggleMeditate=toggleMeditate;
const v122BaseExplore=explore;
const v122BaseStartFightAi=startFightAi;
const v122BaseStartFightMonster=startFightMonster;
const v122BaseAttackTurn=attackTurn;
const v122BaseCanUseOutside=canUseOutside;
const v122BaseUseOutside=useOutside;
const v122BaseSendWorldChat=sendWorldChat;
const v122BaseLogout=logoutBeta;
const v122BaseBeginNewCharacter=beginNewCharacter;

function currentCoord(){return g?coordOf(g.pos.r,g.pos.c):''}
function isSafeZoneNow(){return currentCoord()===V122_SAFE_COORD}
function isEventOpen(){
  const c=cloudState.worldControls;
  return !!(c&&c.event_open&&(!c.event_ends_at||Date.parse(c.event_ends_at)>Date.now()));
}
function playerStatePayload(){
  if(!g)return null;
  return {
    character_id:g.characterId||'unknown',player_name:g.name||'無名散修',coord:currentCoord(),
    level:Number(g.lv||1),realm:g.big||'練氣期',hp:Math.max(0,Math.round(g.hp||0)),hp_max:Math.max(1,Math.round(g.hpMax||1)),
    mp:Math.max(0,Math.round(g.mp||0)),mp_max:Math.max(0,Math.round(g.mpMax||0)),attack:pAtk(),defense:pDef(),
    action:fight?'鬥法':g.meditating?'打坐':cloudState.playerAction||'修行',alive:!g.dead
  };
}
async function syncPlayerPresence(force=false){
  if(!cloudState.enabled||!cloudState.user||!g||g.dead)return;
  if(!force&&Date.now()-cloudState.lastPresenceSync<5000)return;
  cloudState.lastPresenceSync=Date.now();
  try{
    const {data,error}=await cloudState.client.rpc('upsert_player_presence',{p_state:playerStatePayload()});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    if(row?.safe_zone_entered_at&&isSafeZoneNow()){
      const serverAt=Date.parse(row.safe_zone_entered_at);
      if(Number.isFinite(serverAt)&&(!g.safeZoneEnteredAt||serverAt<g.safeZoneEnteredAt))g.safeZoneEnteredAt=serverAt;
    }
  }catch(e){console.warn('presence sync failed',e)}
}
async function loadPlayerPresence(){
  if(!cloudState.enabled||!cloudState.user)return;
  const since=new Date(Date.now()-60000).toISOString();
  const {data,error}=await cloudState.client.from('player_presence').select('user_id,character_id,player_name,coord,level,realm,hp,hp_max,mp,mp_max,attack,defense,action,alive,safe_zone_entered_at,updated_at').eq('alive',true).gt('updated_at',since);
  if(error){console.warn('presence load failed',error);return}
  cloudState.otherPlayers=(data||[]).filter(x=>x.user_id!==cloudState.user.id).map(x=>({
    userId:x.user_id,characterId:x.character_id,name:x.player_name,coord:x.coord,lv:Number(x.level),realm:x.realm,
    hp:Number(x.hp),hpMax:Number(x.hp_max),mp:Number(x.mp),mpMax:Number(x.mp_max),atk:Number(x.attack),def:Number(x.defense),
    action:x.action||'修行',alive:!!x.alive,updatedAt:x.updated_at,id:'human:'+x.user_id,personality:'真人修士'
  }));
  if(g){renderAiIntel();checkSameMapPlayers()}
}
function sameMajorHuman(p){return !!(g&&p&&p.alive&&p.realm===g.big)}
function humanVisibleAt(p,coord){return sameMajorHuman(p)&&distanceCoord(p.coord,coord)<=senseRange(g.big)}
function checkSameMapPlayers(){
  if(!g)return;
  cloudState.seenHumans=cloudState.seenHumans||new Set();
  for(const p of cloudState.otherPlayers.filter(x=>sameMajorHuman(x)&&x.coord===currentCoord())){
    const key=p.userId+':'+p.coord;
    if(cloudState.seenHumans.has(key))continue;
    cloudState.seenHumans.add(key);
    pushSenseEvent('神識捕捉到真人修士 '+p.name+' 與你落在同一地域。','alert');
    log('你與真人修士 <b>'+esc(p.name)+'</b> 在 '+esc(p.coord)+' 相遇。','la');
  }
}

async function loadWorldControls(){
  if(!cloudState.enabled||!cloudState.user)return;
  const {data,error}=await cloudState.client.from('world_controls').select('*').eq('id',1).maybeSingle();
  if(error){console.warn('world controls unavailable',error);return}
  cloudState.worldControls=data||null;renderWorldControls();
}
async function loadWorldAnnouncements(){
  if(!cloudState.enabled||!cloudState.user)return;
  const {data,error}=await cloudState.client.from('world_announcements').select('id,message,kind,created_at,active_until').order('created_at',{ascending:false}).limit(10);
  if(error)return;
  for(const a of (data||[]).reverse())showWorldAnnouncement(a);
}
function showWorldAnnouncement(a){
  if(!a||cloudState.announcementIds.has(String(a.id)))return;
  cloudState.announcementIds.add(String(a.id));
  log('<b>【全服公告】</b> '+esc(a.message),'la');toast('全服公告：'+a.message);
}
function renderWorldControls(){
  if(!g)return;
  const c=cloudState.worldControls||{};
  let status='天地氣機穩定，世界持續運行中。';
  if(c.great_tribulation_active)status='大天劫正在降臨，天地法則劇烈震盪。';
  else if(c.black_cloud_active)status='黑雲壓境，中心位於 '+c.black_cloud_coord+'。';
  else if(c.beast_tide_active)status='獸潮正在世界各地蔓延。';
  else if(isEventOpen())status=(c.event_name||'活動秘境')+' 已限時開放。';
  if($('worldStatus'))$('worldStatus').textContent=status;
  const btn=$('eventRealmBtn');if(btn){btn.hidden=!isEventOpen();$('eventRealmName').textContent=c.event_name||'活動秘境'}
  if(c.announcement&&c.announcement!==cloudState.lastControlAnnouncement){cloudState.lastControlAnnouncement=c.announcement;log('<b>【世界諭令】</b> '+esc(c.announcement),'la')}
}
async function initV122Realtime(){
  if(!cloudState.enabled||!cloudState.user)return;
  await Promise.all([loadWorldControls(),loadWorldAnnouncements(),loadPlayerPresence()]);
  if(cloudState.extraChannel)cloudState.client.removeChannel(cloudState.extraChannel);
  cloudState.extraChannel=cloudState.client.channel('xianxia-v122-'+cloudState.user.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'player_presence'},()=>{clearTimeout(cloudState.playerLoadTimer);cloudState.playerLoadTimer=setTimeout(loadPlayerPresence,250)})
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'world_controls'},p=>{cloudState.worldControls=p.new;renderWorldControls();render()})
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'world_announcements'},p=>showWorldAnnouncement(p.new))
    .on('postgres_changes',{event:'*',schema:'public',table:'pvp_duels'},()=>setTimeout(pollPvp,180))
    .subscribe();
}
initRealtime=async function(){await v122BaseInitRealtime();await initV122Realtime()};
teardownRealtime=function(){
  clearInterval(cloudState.playerTimer);clearInterval(cloudState.safeZoneTimer);clearInterval(cloudState.pvpTimer);
  clearTimeout(cloudState.playerLoadTimer);
  cloudState.playerTimer=cloudState.safeZoneTimer=cloudState.pvpTimer=cloudState.playerLoadTimer=null;
  if(cloudState.extraChannel&&cloudState.client)cloudState.client.removeChannel(cloudState.extraChannel);
  cloudState.extraChannel=null;cloudState.otherPlayers=[];v122BaseTeardownRealtime();
};

normalizeSave=function(){
  v122BaseNormalizeSave();
  if(currentCoord()===V122_SAFE_COORD){if(!g.safeZoneEnteredAt)g.safeZoneEnteredAt=Date.now()}
  else g.safeZoneEnteredAt=null;
};
startLoops=function(){
  v122BaseStartLoops();
  clearInterval(cloudState.playerTimer);clearInterval(cloudState.safeZoneTimer);clearInterval(cloudState.pvpTimer);
  cloudState.playerTimer=setInterval(()=>{syncPlayerPresence();loadPlayerPresence()},8000);
  cloudState.safeZoneTimer=setInterval(()=>{checkSafeZoneStay();applyWorldHazards()},1000);
  cloudState.pvpTimer=setInterval(pollPvp,2200);
  syncPlayerPresence(true);loadPlayerPresence();checkSafeZoneStay();pollPvp();
};
render=function(){v122BaseRender();renderWorldControls();renderSafeZoneTimer();syncPlayerPresence()};

function renderSafeZoneTimer(){
  if(!g||!isSafeZoneNow())return;
  if(!g.safeZoneEnteredAt)g.safeZoneEnteredAt=Date.now();
  const left=Math.max(0,V122_SAFE_LIMIT_SECONDS-Math.floor((Date.now()-g.safeZoneEnteredAt)/1000));
  const h=Math.floor(left/3600),m=Math.floor(left%3600/60),s=left%60;
  const base='萬寶交易所禁止任何鬥法。停留滿2小時將強制傳送；剩餘 '+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'。';
  if($('sceneCopy'))$('sceneCopy').innerHTML=base.replace(/(剩餘 .*)/,'<span class="safe-zone-timer">$1</span>');
}
function randomWorldCoord(exclude=[]){
  const banned=new Set(exclude);let arr=[];for(let r=0;r<10;r++)for(let c=0;c<10;c++){const co=coordOf(r,c);if(!banned.has(co))arr.push(co)}return rnd(arr);
}
function forceExitSafeZone(){
  if(!g||!isSafeZoneNow())return;
  const c=cloudState.worldControls||{};
  const blackOk=!!(c.black_cloud_active&&/^[A-J]-(10|[1-9])$/.test(c.black_cloud_coord)&&c.black_cloud_coord!==V122_SAFE_COORD);
  const target=blackOk&&Math.random()<0.20?c.black_cloud_coord:randomWorldCoord([V122_SAFE_COORD]);
  const p=coordRC(target);g.pos={r:p.r,c:p.c};g.safeZoneEnteredAt=null;cloudState.playerAction='被交易所陣法傳送';
  closeOv();log('萬寶交易所停留已滿2小時，守界陣法將你隨機排出至 <b>'+esc(target)+'</b>。','la');
  render();saveGame(false);syncPlayerPresence(true);
}
function checkSafeZoneStay(){
  if(!g||g.dead)return;
  if(!isSafeZoneNow()){if(g.safeZoneEnteredAt){g.safeZoneEnteredAt=null;saveGame(false)}return}
  if(!g.safeZoneEnteredAt)g.safeZoneEnteredAt=Date.now();
  renderSafeZoneTimer();
  if(Date.now()-g.safeZoneEnteredAt>=V122_SAFE_LIMIT_SECONDS*1000)forceExitSafeZone();
}
function applyWorldHazards(){
  if(!g||g.dead||fight)return;
  const c=cloudState.worldControls||{};
  if(!c.poison_active||!c.poison_zone_id)return;
  const z=zoneAt(g.pos.r,g.pos.c);if(!z||Number(z.id)!==Number(c.poison_zone_id))return;
  if(Date.now()-cloudState.lastPoisonTick<10000)return;cloudState.lastPoisonTick=Date.now();
  const poisonGear=(g.equipment||[]).filter(e=>e.element==='毒'||e.enchant==='毒'||e.poison===true).length;
  const damage=poisonGear>=2?0:poisonGear===1?15:30;
  if(!damage){log('毒域侵蝕被兩件毒屬性防具完全抵消。','lg');return}
  g.hp=Math.max(0,g.hp-damage);log('地圖毒域侵蝕，道體損失 '+damage+' 體力。','ld');render();
  if(g.hp<=0)finalizePermanentDeath('死於管理員開啟的地圖毒域');
}

moveTo=function(r,c){
  const before=currentCoord();v122BaseMoveTo(r,c);const after=currentCoord();
  if(before!==after){
    g.safeZoneEnteredAt=after===V122_SAFE_COORD?Date.now():null;cloudState.playerAction='御風移動';
    saveGame(false);syncPlayerPresence(true);setTimeout(()=>{loadPlayerPresence();checkSameMapPlayers()},350);
  }
};
toggleMeditate=function(){v122BaseToggleMeditate();cloudState.playerAction=g?.meditating?'打坐':'收功';syncPlayerPresence(true)};
explore=function(){cloudState.playerAction='探索';v122BaseExplore();syncPlayerPresence(true)};

startFightAi=function(id){
  if(isSafeZoneNow()&&!cloudState.eventCombat){toast('萬寶交易所禁止任何鬥法');return}
  return v122BaseStartFightAi(id);
};
startFightMonster=function(m){
  if(isSafeZoneNow()&&!cloudState.eventCombat){toast('萬寶交易所禁止任何戰鬥');return}
  return v122BaseStartFightMonster(m);
};
attackTurn=function(){if(isSafeZoneNow()&&!fight?.eventRealm){fight=null;closeOv();toast('萬寶交易所守界陣法中止鬥法');return}return v122BaseAttackTurn()};
openAiInteract=function(id){
  const a=ai.find(x=>x.id===id);if(!a)return;
  const same=sameMajorRealm(g.big,a.lv),intel=same?relativePower(a):'境界相隔，無法判斷其強弱與體力';
  const fightBtn=isSafeZoneNow()?'<button class="btn" disabled>安全區禁戰</button>':'<button class="btn red" onclick="startFightAi('+id+')">攔截鬥法</button>';
  sheet('<h3>修士互動 · '+esc(a.name)+'</h3><div class="ai-dialogue"><img src="assets/ai_cultivator.svg" alt="修士頭像"><div><b>'+esc(a.personality)+'</b><p>「'+esc(aiReply(a,'greet'))+'」</p><small>'+esc(intel)+'</small></div></div><div class="command-row"><button class="btn jade" onclick="talkToAi('+id+')">交談</button><button class="btn gold" onclick="tradeWithAi('+id+')">詢問交易</button>'+fightBtn+'</div><button class="btn" style="width:100%;margin-top:8px" onclick="closeOv()">離開</button>');
};
startAiEncounter=function(a){
  if(!a)return;
  const same=sameMajorRealm(g.big,a.lv);
  const detail=same?('<div class="money"><div><span>同階感知</span><b>'+esc(relativePower(a))+'</b></div><div><span>體力</span><b>'+Math.round(a.hp)+' / '+a.hpMax+'</b></div></div>'):'<div class="notice">對方與你跨越大境界。神識只能確認其存在，無法窺探強弱、等級與實際體力。</div>';
  const fightBtn=isSafeZoneNow()?'<button class="btn" disabled>安全區禁戰</button>':'<button class="btn red" onclick="startFightAi('+a.id+')">攔截鬥法</button>';
  sheet('<h3>神識遭遇</h3><div class="ai-dialogue"><img src="assets/ai_cultivator.svg"><div><b>'+esc(a.name)+'</b><p>「'+esc(aiReply(a,'greet'))+'」</p></div></div>'+detail+'<div class="row" style="margin-top:12px"><button class="btn jade" onclick="openAiInteract('+a.id+')">互動</button>'+fightBtn+'<button class="btn" onclick="closeOv()">避開</button></div>');
};

openWorldMap=function(){
  const rng=Math.max(1,Number(bigMove(g.big))||1),here=currentCoord(),playerCoord=here;
  let h='<h3>十方浮島地圖</h3><p class="small">御風距離：最多 '+rng+' 格。相鄰1格至最大距離內皆可前往。</p><div class="grid">';
  for(let r=0;r<10;r++)for(let c=0;c<10;c++){
    const co=coordOf(r,c),z=zoneAt(r,c),dist=mapMoveDistance(r,c),me=co===here,reachable=!me&&dist>=1&&dist<=rng;
    const ac=ai.filter(a=>a.alive&&a.coord===co&&sameMajorRealm(g.big,a.lv)).length;
    const hc=cloudState.otherPlayers.filter(p=>p.alive&&p.coord===co&&sameMajorHuman(p)&&distanceCoord(co,playerCoord)<=senseRange(g.big)).length;
    const count=ac+hc;
    h+='<button type="button" class="cell '+(me?'me ':'')+(!reachable&&!me?'block':'')+'" '+(reachable?'onclick="moveTo('+r+','+c+')"':'disabled')+'><b>'+(z?z.name:'荒野')+'</b><br>'+co+(count?'<br><span class="ai">可感知修士 '+count+'</span>':'')+'</button>';
  }
  h+='</div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">關閉地圖</button>';sheet(h);
};

function humanSenseRows(){return cloudState.otherPlayers.map(p=>({id:'human:'+p.userId,name:p.name,lv:p.lv,coord:p.coord,hp:p.hp,hpMax:p.hpMax,action:p.action,alive:p.alive,human:true,userId:p.userId,realm:p.realm,personality:'真人修士'}))}
renderAiIntel=function(){
  if(!g||!$('aiList'))return;
  const playerCoord=currentCoord(),allRows=[...ai,...humanSenseRows()];updateSenseActivity(allRows);
  const humans=cloudState.otherPlayers.filter(p=>humanVisibleAt(p,playerCoord)).sort((a,b)=>distanceCoord(a.coord,playerCoord)-distanceCoord(b.coord,playerCoord));
  const cultivators=ai.filter(a=>senseVisibleAt(a,playerCoord)).sort((a,b)=>distanceCoord(a.coord,playerCoord)-distanceCoord(b.coord,playerCoord));
  const rows=[];
  for(const p of humans)rows.push('<div class="ai-item ai-click human-item" onclick="openPlayerInteract(\''+p.userId+'\')"><div><b>'+esc(p.name)+'</b><br><span>真人修士 · '+esc(relativeHumanPower(p))+' · 體力 '+Math.round(p.hp)+'/'+p.hpMax+'</span></div><span>'+esc(p.action)+(p.coord===playerCoord?' · 同地':'')+'</span></div>');
  for(const a of cultivators.slice(0,Math.max(0,10-humans.length))){const intel=a.personality+' · '+relativePower(a)+' · 體力 '+Math.round(a.hp)+'/'+a.hpMax;rows.push('<div class="ai-item ai-click" onclick="openAiInteract('+a.id+')"><div><b>'+esc(a.name)+'</b><br><span>'+esc(intel)+'</span></div><span>'+esc(a.action||'修行')+'</span></div>')}
  $('nearbyCount').textContent=(humans.length+cultivators.length)+' 人';$('aiList').innerHTML=rows.join('')||'<div class="small">神識範圍內暫無可辨識的同階修士氣息。</div>';renderSenseFeed();
};
function relativeHumanPower(p){const d=Number(p.atk||1)+Number(p.def||0),me=pAtk()+pDef();return d>me*1.25?'氣息強於你':d<me*.75?'氣息弱於你':'與你相近'}
function preparePlayerChatByUserId(userId){
  const p=cloudState.otherPlayers.find(x=>x.userId===userId);if(!p)return;
  closeOv();openWorldChat();const i=$('worldChatInlineInput');if(i){i.value='@'+p.name+' ';i.focus()}
}
function openPlayerInteract(userId){
  const p=cloudState.otherPlayers.find(x=>x.userId===userId);if(!p)return;
  const samePlace=p.coord===currentCoord(),safe=isSafeZoneNow();
  const duel=samePlace&&!safe?'<button class="btn red" onclick="challengePlayer(\''+p.userId+'\')">發起真人鬥法</button>':'<button class="btn" disabled>'+(safe?'安全區禁戰':'必須同一地域')+'</button>';
  sheet('<h3>真人修士 · '+esc(p.name)+'</h3><div class="money"><div><span>位置</span><b>'+esc(p.coord)+(samePlace?' · 與你同地':'')+'</b></div><div><span>境界</span><b>'+esc(p.realm)+' Lv'+p.lv+'</b></div><div><span>氣息</span><b>'+esc(relativeHumanPower(p))+'</b></div></div><p class="notice">真人鬥法採伺服器回合判定；敗者永久死亡。萬寶交易所內完全禁戰。</p><div class="row"><button class="btn jade" onclick="preparePlayerChatByUserId(\''+p.userId+'\')">傳音招呼</button>'+duel+'</div><button class="btn" style="width:100%;margin-top:8px" onclick="closeOv()">離開</button>');
}
function pvpSnapshot(){return {characterId:g.characterId,name:g.name,level:g.lv,realm:g.big,hp:g.hp,hpMax:g.hpMax,mp:g.mp,mpMax:g.mpMax,attack:pAtk(),defense:pDef()}}
async function challengePlayer(userId){
  if(isSafeZoneNow()){toast('萬寶交易所禁止鬥法');return}
  const p=cloudState.otherPlayers.find(x=>x.userId===userId);if(!p||p.coord!==currentCoord()){toast('對方已離開此地');return}
  try{const {data,error}=await cloudState.client.rpc('create_pvp_challenge',{p_target:userId,p_snapshot:pvpSnapshot()});if(error)throw error;cloudState.pvpCurrent=Array.isArray(data)?data[0]:data;closeOv();toast('鬥法邀請已送出，60秒內有效');pollPvp()}catch(e){toast('無法發起鬥法：'+translatePvpError(e.message))}
}
function translatePvpError(m){const s=String(m||'');if(s.includes('SAFE_ZONE'))return'安全區禁止鬥法';if(s.includes('NOT_SAME'))return'對方已不在同一地域';if(s.includes('NOT_ONLINE'))return'對方已離線';if(s.includes('ALREADY_IN_DUEL'))return'其中一方已有鬥法';if(s.includes('NOT_YOUR_TURN'))return'尚未輪到你';if(s.includes('INSUFFICIENT_MP'))return'精力不足，僅能遁走';return s}
async function pollPvp(){
  if(!cloudState.enabled||!cloudState.user||!g||g.dead)return;
  const uid=cloudState.user.id;
  const {data,error}=await cloudState.client.from('pvp_duels').select('*').or('challenger_user_id.eq.'+uid+',target_user_id.eq.'+uid).order('updated_at',{ascending:false}).limit(5);
  if(error)return;
  const active=(data||[]).find(d=>d.status==='active');
  const pending=(data||[]).find(d=>d.status==='pending'&&d.target_user_id===uid&&Date.parse(d.expires_at)>Date.now());
  const finished=(data||[]).find(d=>d.status==='finished'&&!cloudState.pvpHandled.has(String(d.id)));
  if(finished)return handlePvpFinished(finished);
  if(active){cloudState.pvpCurrent=active;applyPvpLocalState(active);renderPvpDuel(active);return}
  if(pending&&!cloudState.pvpPrompted.has(String(pending.id))){cloudState.pvpPrompted.add(String(pending.id));showPvpChallenge(pending)}
}
function showPvpChallenge(d){
  sheet('<h3 style="color:var(--red)">真人鬥法邀請</h3><p><b>'+esc(d.challenger_name)+'</b> 在 '+esc(d.coord)+' 鎖定你的氣機。</p><div class="notice">接受後進入伺服器回合鬥法；敗者永久死亡。邀請60秒後失效。</div><div class="row" style="margin-top:12px"><button class="btn red" onclick="respondPvp('+d.id+',true)">接受鬥法</button><button class="btn" onclick="respondPvp('+d.id+',false)">拒絕</button></div>');
}
async function respondPvp(id,accept){
  try{const {data,error}=await cloudState.client.rpc('respond_pvp_challenge',{p_duel_id:id,p_accept:accept,p_snapshot:pvpSnapshot()});if(error)throw error;const d=Array.isArray(data)?data[0]:data;if(!accept){closeOv();toast('已拒絕鬥法')}else{cloudState.pvpCurrent=d;applyPvpLocalState(d);renderPvpDuel(d)}}catch(e){toast('回應失敗：'+translatePvpError(e.message))}
}
function applyPvpLocalState(d){
  const mine=d.challenger_user_id===cloudState.user.id?'challenger':'target';
  g.hp=Math.max(0,Number(mine==='challenger'?d.challenger_hp:d.target_hp));g.mp=Math.max(0,Number(mine==='challenger'?d.challenger_mp:d.target_mp));render();saveGame(false);
}
function renderPvpDuel(d){
  if(!d||d.status!=='active')return;
  const meCh=d.challenger_user_id===cloudState.user.id;
  const myName=meCh?d.challenger_name:d.target_name,otherName=meCh?d.target_name:d.challenger_name;
  const myHp=Number(meCh?d.challenger_hp:d.target_hp),otherHp=Number(meCh?d.target_hp:d.challenger_hp),myMp=Number(meCh?d.challenger_mp:d.target_mp);
  const myTurn=d.turn_user_id===cloudState.user.id;
  sheet('<div class="pvp-card"><h3>真人鬥法 · '+esc(d.coord)+'</h3><div class="pvp-bars"><div><span>'+esc(myName)+'</span><b>體力 '+myHp+'｜精力 '+myMp+'</b></div><div><span>'+esc(otherName)+'</span><b>體力 '+otherHp+'</b></div></div><div class="notice">'+esc(d.last_message||'氣機交鋒。')+'</div><div class="row"><button class="btn red" '+(myTurn&&myMp>=10?'':'disabled')+' onclick="pvpAttack('+d.id+')">攻擊 −10精力</button><button class="btn" onclick="pvpFlee('+d.id+')">遁走認敗</button></div><p class="small">'+(myTurn?'輪到你出手。':'等待對方出手，狀態會自動更新。')+'</p></div>');
}
async function pvpAttack(id){
  try{const {data,error}=await cloudState.client.rpc('pvp_attack',{p_duel_id:id});if(error)throw error;const d=Array.isArray(data)?data[0]:data;cloudState.pvpCurrent=d;applyPvpLocalState(d);if(d.status==='finished')handlePvpFinished(d);else renderPvpDuel(d)}catch(e){toast('攻擊失敗：'+translatePvpError(e.message))}
}
async function pvpFlee(id){
  if(!confirm('遁走認敗會使目前角色永久死亡，確定嗎？'))return;
  try{const {data,error}=await cloudState.client.rpc('pvp_flee',{p_duel_id:id});if(error)throw error;handlePvpFinished(Array.isArray(data)?data[0]:data)}catch(e){toast('遁走失敗：'+translatePvpError(e.message))}
}
function handlePvpFinished(d){
  if(!d||cloudState.pvpHandled.has(String(d.id)))return;cloudState.pvpHandled.add(String(d.id));
  const uid=cloudState.user.id,won=d.winner_user_id===uid;
  if(!won){
    clearInterval(tickTimer);clearInterval(aiTimer);clearInterval(cloudState.playerTimer);clearInterval(cloudState.safeZoneTimer);clearInterval(cloudState.pvpTimer);
    g.hp=0;g.dead=true;g.meditating=false;cloudState.remoteSave=null;cloudState.revision=0;localStorage.removeItem(V12_LOCAL_CACHE);localStorage.removeItem(SAVE_KEY);
    showDeathScreen('真人鬥法敗於 '+(d.winner_user_id===d.challenger_user_id?d.challenger_name:d.target_name),true);
  }else{
    applyPvpLocalState(d);log('真人鬥法勝利，對手已身隕道消。','lg');saveGame(false);sheet('<h3>鬥法勝利</h3><p>'+esc(d.last_message)+'</p><button class="btn gold" style="width:100%" onclick="closeOv()">收劍</button>');
  }
}

canUseOutside=function(it){return v122BaseCanUseOutside(it)||it?.eff==='遺忘功法'};
useOutside=function(id){if(String(id)==='9001')return openTechniqueRemoval();return v122BaseUseOutside(id)};
function openTechniqueRemoval(){
  if(!(g.inv['9001']>0)){toast('行囊中沒有轉身丹');return}
  if(!(g.techniques||[]).length){toast('目前沒有可卸除的功法');return}
  let h='<h3>轉身丹 · 卸除功法</h3><div class="notice">選定一門已研習功法後才會消耗1顆轉身丹。卸除立即生效。</div>';
  for(const id of g.techniques){const t=C.techniques.find(x=>x.id===id);if(t)h+='<div class="list-row"><div class="grow"><strong>'+esc(t.name)+'</strong><small>'+esc(techniqueDetail(t))+'</small></div><button class="btn red" onclick="forgetTechnique(\''+id+'\')">卸除</button></div>'}
  h+='<button class="btn" style="width:100%;margin-top:10px" onclick="openBag(\'bag\')">取消</button>';sheet(h);
}
function forgetTechnique(id){
  const t=C.techniques.find(x=>x.id===id);if(!t||!g.techniques.includes(id)||!(g.inv['9001']>0))return;
  g.techniques=g.techniques.filter(x=>x!==id);g.inv['9001']--;log('服用轉身丹，卸除功法 '+t.name+'。','la');saveGame(false);render();openBag('bag');
}

sendWorldChat=async function(){
  if(!g||!(g.inv?.['2004']>0)){toast('全服傳音需要持有傳訊玉符');return}
  const input=$('worldChatInlineInput')||$('worldChatInput');if(input&&document.activeElement===input)input.blur();
  return v122BaseSendWorldChat();
};
document.addEventListener('DOMContentLoaded',()=>{const f=$('worldChatInlineForm');if(f)f.addEventListener('submit',e=>{e.preventDefault();sendWorldChat()})});

function openEventRealm(){
  if(!isEventOpen()){toast('活動秘境尚未開放');return}
  const c=cloudState.worldControls||{},name=c.event_name||'秘境·未命名';
  let cells='';for(let i=0;i<9;i++)cells+='<button class="cell" onclick="eventExploreCell('+i+')"><b>秘境區域</b><br>'+String.fromCharCode(65+Math.floor(i/3))+'-'+(i%3+1)+'</button>';
  sheet('<h3>'+esc(name)+'</h3><p class="notice">'+esc(c.event_message||'限時活動場域已開啟。')+'</p><div class="grid" style="grid-template-columns:repeat(3,1fr)">'+cells+'</div><button class="btn" style="width:100%;margin-top:10px" onclick="closeOv()">離開秘境入口</button>');
}
function eventExploreCell(i){
  if(!isEventOpen()){toast('活動已結束');closeOv();return}
  if(g.mp<P.explore_stamina_cost){toast('精力不足');return}
  g.mp-=P.explore_stamina_cost;cloudState.playerAction='活動秘境探索';
  const pool=C.monsters.filter(m=>Number(m.id)>=9301&&Number(m.id)<=9305);const m=JSON.parse(JSON.stringify(rnd(pool.length?pool:C.monsters)));
  closeOv();cloudState.eventCombat=true;v122BaseStartFightMonster(m);if(fight)fight.eventRealm=true;cloudState.eventCombat=false;render();syncPlayerPresence(true);
}

logoutBeta=async function(){try{if(cloudState.client&&cloudState.user)await cloudState.client.rpc('leave_player_presence')}catch(_){}return v122BaseLogout()};
beginNewCharacter=function(){try{if(cloudState.client&&cloudState.user)cloudState.client.rpc('leave_player_presence')}catch(_){}return v122BaseBeginNewCharacter()};

openVersion=function(){
  sheet('<h3>V12.2 聯機與世界後臺版</h3><div class="list-row"><div class="grow"><strong>真人同圖相遇</strong><small>同一世界、同一地域且神識可辨識時，會顯示真人修士，可傳音或發起伺服器回合鬥法。</small></div></div><div class="list-row"><div class="grow"><strong>萬寶交易所規則恢復</strong><small>完全禁止戰鬥；停留上限2小時（含離線），逾時隨機傳送，黑雲存在時20%直送黑雲座標。</small></div></div><div class="list-row"><div class="grow"><strong>轉身丹</strong><small>可在行囊選擇一門已學功法卸除，確認卸除後才消耗。</small></div></div><div class="list-row"><div class="grow"><strong>手機傳音</strong><small>改用手機可提交表單；持有傳訊玉符即可傳音。</small></div></div><div class="list-row"><div class="grow"><strong>手機管理後臺</strong><small>可控制黑雲、大天劫、獸潮、活動秘境、全服公告與地圖毒域。</small></div></div><button class="btn" style="width:100%;margin-top:12px" onclick="closeOv()">關閉</button>');
};


/* V12.3 PATCH — 世界循環與煞氣反噬 */
cloudState.shaQi=null;cloudState.worldMaintenanceTimer=null;
async function loadShaQiStatus(){
  if(!cloudState.enabled||!cloudState.client||!cloudState.user)return;
  const {data,error}=await cloudState.client.rpc('sha_qi_status');
  if(!error){cloudState.shaQi=Array.isArray(data)?data[0]:data;renderShaQiBadge()}
}
function renderShaQiBadge(){
  if(!g||!cloudState.shaQi)return;
  let e=document.getElementById('shaQiBadge');
  if(!e){e=document.createElement('div');e.id='shaQiBadge';e.className='small';const host=document.getElementById('charStats')||document.querySelector('.character-card')||document.body;host.appendChild(e)}
  const q=cloudState.shaQi;e.textContent='煞氣｜同階 '+q.same_realm_kills+'（收益 '+Math.round(Number(q.same_reward_multiplier)*100)+'%）｜低階 '+q.lower_realm_kills+'（收益 '+Math.round(Number(q.lower_reward_multiplier)*100)+'%）';
}
async function runWorldMaintenance(){if(!cloudState.enabled||!cloudState.client||!cloudState.user)return;try{await cloudState.client.rpc('world_maintenance')}catch(_){}}
const v123BaseStartOnlineWorld=startOnlineWorld;
startOnlineWorld=async function(){const r=await v123BaseStartOnlineWorld();clearInterval(cloudState.worldMaintenanceTimer);cloudState.worldMaintenanceTimer=setInterval(runWorldMaintenance,30000);runWorldMaintenance();loadShaQiStatus();return r};
const v123BaseHandlePvpFinished=handlePvpFinished;
handlePvpFinished=function(d){
  const uid=cloudState.user?.id,won=d&&d.winner_user_id===uid,meCh=d&&d.challenger_user_id===uid;
  if(won&&!cloudState.pvpHandled.has(String(d.id))){
    const mine=meCh?d.challenger_snapshot:d.target_snapshot,foe=meCh?d.target_snapshot:d.challenger_snapshot;
    const myLv=Number(mine?.level||g?.lv||1),foeLv=Number(foe?.level||1);const rel=foeLv>myLv?'higher':foeLv<myLv?'lower':'same';
    cloudState.client.rpc('record_sha_qi_kill',{p_relation:rel}).then(()=>loadShaQiStatus());
  }
  return v123BaseHandlePvpFinished(d)
};

/* V12.4 PATCH — 獎勵式廣告、元寶收益、打坐雙倍 */
cloudState.adStatus=null;
cloudState.meditationAdBoost=null;
async function loadAdRewardStatus(){
  if(!cloudState.enabled||!cloudState.client||!cloudState.user)return null;
  const {data,error}=await cloudState.client.rpc('ad_reward_status');
  if(error){console.warn('ad_reward_status',error);return null}
  cloudState.adStatus=data;return data;
}
function adErrorText(m=''){
  if(m.includes('DAILY_YUANBAO_AD_LIMIT'))return '今天的元寶廣告次數已用完';
  if(m.includes('DAILY_MEDITATION_AD_LIMIT'))return '今天的打坐雙倍廣告次數已用完';
  if(m.includes('ADS_DISABLED'))return '獎勵式廣告目前暫停';
  if(m.includes('AD_SESSION_EXPIRED'))return '廣告工作階段已逾時，請重新觀看';
  if(m.includes('TEST_MODE_DISABLED'))return '正式廣告尚未完成伺服器驗證串接';
  return m;
}
function showTestRewardedAd(session){
  let left=5;
  sheet('<h3>封測獎勵式廣告</h3><div class="notice">這是封測模擬廣告，只用來測試流程；切換正式模式後才會播放真正廣告並累積廣告收益。</div><div class="money" style="margin-top:12px"><div><span>觀看倒數</span><b id="adCountdown">'+left+' 秒</b></div><div><span>完成獎勵</span><b>'+(session.reward_type==='yuanbao'?session.reward_amount+' 元寶':'本次打坐雙倍')+'</b></div></div><button id="adCancelBtn" class="btn" style="width:100%;margin-top:12px" onclick="cancelRewardedAd()">放棄觀看</button>');
  cloudState.activeAd={session,timer:setInterval(async()=>{left--;const e=$('adCountdown');if(e)e.textContent=Math.max(0,left)+' 秒';if(left<=0){clearInterval(cloudState.activeAd.timer);await completeTestRewardedAd(session)}},1000)};
}
function cancelRewardedAd(){if(cloudState.activeAd?.timer)clearInterval(cloudState.activeAd.timer);cloudState.activeAd=null;closeOv();toast('未完成廣告，因此沒有獎勵')}
async function watchRewardedAd(rewardType){
  if(!cloudState.enabled||!cloudState.client||!cloudState.user){toast('請先登入封測帳號');return}
  try{
    const {data,error}=await cloudState.client.rpc('start_rewarded_ad',{p_reward_type:rewardType});if(error)throw error;
    const session=data;
    if(session.test_mode){showTestRewardedAd(session);return}
    const provider=window.XIANXIA_REWARDED_AD_PROVIDER;
    if(!provider||typeof provider.show!=='function'){throw new Error('正式廣告商尚未設定')}
    await provider.show({adUnitId:session.ad_unit_id,sessionId:session.session_id,rewardType});
    const {data:done,error:doneError}=await cloudState.client.rpc('complete_rewarded_ad_web',{p_session_id:session.session_id});if(doneError)throw doneError;
    await applyCompletedAdReward(done);closeOv();
  }catch(e){toast(adErrorText(e.message||String(e)))}
}
async function applyCompletedAdReward(data){
  if(data.reward_type==='yuanbao'){
    setWallet(Number(data.yuanbao||cloudState.walletBalance),Number(data.revision||cloudState.walletRevision));
    log('完成正式獎勵式廣告，帳號元寶 +'+data.reward_amount+'。','lg');
    await loadAdRewardStatus();render();openShop('yuanbao');
  }else{
    cloudState.meditationAdBoost={minutes:Number(data.boost_minutes||120),armed:true,active:false,startedAt:null};
    await loadAdRewardStatus();startMeditationWithAdBoost();
  }
}
async function completeTestRewardedAd(session){
  try{
    const {data,error}=await cloudState.client.rpc('complete_rewarded_ad_test',{p_session_id:session.session_id});if(error)throw error;
    cloudState.activeAd=null;
    closeOv();await applyCompletedAdReward(data);
  }catch(e){cloudState.activeAd=null;closeOv();toast(adErrorText(e.message||String(e)))}
}
function meditationAdMultiplier(){return cloudState.meditationAdBoost?.active?2:1}
function meditationBoostRemaining(){
  const b=cloudState.meditationAdBoost;if(!b?.active||!b.startedAt)return 0;
  return Math.max(0,b.minutes*60000-(Date.now()-b.startedAt));
}
function activateMeditationAdBoost(){
  const b=cloudState.meditationAdBoost;if(!b?.armed)return;
  b.armed=false;b.active=true;b.startedAt=Date.now();
  g.meditationAdBoostUntil=Date.now()+b.minutes*60000;
  log('廣告加持已啟動：本次打坐收益 ×2，最長 '+b.minutes+' 分鐘。','lg');
}
function stopMeditationAdBoost(){
  if(cloudState.meditationAdBoost?.active){cloudState.meditationAdBoost.active=false;g.meditationAdBoostUntil=0;log('本次打坐的廣告雙倍加持已結束。','la')}
}
function startMeditationNormal(){closeOv();v124BaseToggleMeditate();cloudState.playerAction=g?.meditating?'打坐':'收功';syncPlayerPresence(true)}
function startMeditationWithAdBoost(){
  if(!g.meditating){activateMeditationAdBoost();v124BaseToggleMeditate();cloudState.playerAction='廣告加持打坐';syncPlayerPresence(true)}
}
function openMeditationAdChoice(){
  const a=cloudState.adStatus||{};
  sheet('<h3>開始打坐</h3><div class="list-row"><div class="grow"><strong>一般打坐</strong><small>直接開始，維持原本收益。</small></div><button class="btn" onclick="startMeditationNormal()">直接打坐</button></div><div class="list-row shop-rich"><div class="grow"><strong>觀看廣告，本次打坐收益 ×2</strong><small>完成廣告後啟動，最長 '+Number(a.meditation_boost_minutes||120)+' 分鐘；停止打坐即結束。</small></div><button class="btn gold" onclick="watchRewardedAd(\'meditation_double\')">看廣告打坐</button></div><button class="btn" style="width:100%;margin-top:8px" onclick="closeOv()">取消</button>');
}
var v124BaseToggleMeditate=toggleMeditate;
window.__v124BaseToggleMeditate=v124BaseToggleMeditate;
toggleMeditate=function(){
  if(g?.meditating){v124BaseToggleMeditate();stopMeditationAdBoost();cloudState.playerAction='收功';syncPlayerPresence(true);return}
  openMeditationAdChoice();
};
const v124BaseTickMeditation=tickMeditation;
tickMeditation=function(){
  if(cloudState.meditationAdBoost?.active&&meditationBoostRemaining()<=0)stopMeditationAdBoost();
  if(!g||!g.meditating||fight)return;
  g.meditateSec++;
  const z=zoneAt(g.pos.r,g.pos.c),novice=!!(z&&z.novice),mult=(g.techniques.includes('dust')?2:1)*meditationAdMultiplier();
  const expInterval=novice?P.meditate_novice_exp_interval_sec:P.meditate_exp_interval_sec;let changed=false;
  if(g.meditateSec%expInterval===0){gainExp(1*mult,false);changed=true}
  if(g.meditateSec%P.meditate_hp_interval_sec===0){g.hp=clamp(g.hp+P.meditate_hp_gain*mult,0,g.hpMax);changed=true}
  if(g.meditateSec%P.meditate_mp_interval_sec===0){g.mp=clamp(g.mp+P.meditate_mp_gain*mult,0,g.mpMax);changed=true}
  if(changed)render();
};
const v124BaseRender=render;
render=function(){v124BaseRender();const sub=$('meditateSub');if(sub&&g?.meditating&&cloudState.meditationAdBoost?.active)sub.textContent='廣告加持中：本次吐納收益 ×2'};
const v124BaseStartOnlineWorld=startOnlineWorld;
startOnlineWorld=async function(){const r=await v124BaseStartOnlineWorld();await loadAdRewardStatus();return r};
