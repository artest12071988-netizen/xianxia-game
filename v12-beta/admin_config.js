'use strict';

/* V12.9 遊戲數值營運後台：草稿、發布、回復、Excel 匯入匯出。 */
(() => {
  const state={draft:null,draftId:null,draftVersion:0,published:null,versions:[],tab:'items',breakCfg:null,dirty:false};
  const baseLoadAllV129=loadAll;
  const COMBAT_KEYS=[
    ['normal_attack_mp_cost','普通攻擊精力消耗'],['base_crit_rate','基礎暴擊率'],['base_crit_min','暴擊倍率下限'],['base_crit_max','暴擊倍率上限'],
    ['encounter_miss_rate','閃避／落空率'],['encounter_flee_success','遁走成功率'],['block_damage_multiplier','格擋後承傷倍率'],['defense_coeff','防禦係數'],
    ['npc_sell_rate','NPC回收倍率'],['meditate_hp_gain','打坐體力恢復'],['meditate_mp_gain','打坐精力恢復'],['meditate_exp_interval_sec','一般打坐修為間隔秒數']
  ];

  /* V15.4 後台固定物品建立器：只提供遊戲已支援的資料結構，不允許自由輸入類別或效果名稱。 */
  const FIXED_ITEM_KINDS={
    equipment:{label:'裝備',idRange:[2000,3999]},
    material:{label:'材料',idRange:[4000,4999]},
    herb:{label:'藥材',idRange:[4100,4999]},
    recipe:{label:'丹方',idRange:[7000,7999]},
    medicine:{label:'藥品',idRange:[1000,1999]},
    enchant:{label:'附魔材料',idRange:[8600,8699]}
  };
  const EQUIPMENT_TYPES={
    weapon:{label:'武器',cat:'法器',eff:'攻擊',types:['長劍','飛劍']},
    armor:{label:'防具',cat:'防具',eff:'防禦',types:['法袍','重甲']}
  };
  const MEDICINE_EFFECTS={
    hp:{label:'體力回復',eff:'體力回復',unit:'點'},
    mp:{label:'精力回復',eff:'精力回復',unit:'點'},
    heal:{label:'解除外傷',eff:'療傷',unit:'固定'},
    breakthrough:{label:'突破成功率',eff:'突破增益',unit:'%'}
  };
  const ENCHANT_EFFECTS={
    fire:{label:'火性追加傷害',type:'火',unit:'%',defaultValue:20},
    water:{label:'水性削減法力',type:'水',unit:'%',defaultValue:3},
    wood:{label:'木性吸血',type:'木',unit:'%',defaultValue:20},
    metal:{label:'金性暴擊',type:'金',unit:'%',defaultValue:25},
    earth:{label:'土性減傷',type:'土',unit:'%',defaultValue:25}
  };
  const ITEM_EDITOR_BUILD='V15.4-ADMIN-FIXED-ITEM-BUILDER-PHASE1-20260724';

  function h(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function clone(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x))}
  function plainObject(x){return !!x&&typeof x==='object'&&!Array.isArray(x)}
  function deepServerPriority(base,server){
    if(server===undefined)return clone(base);
    if(!plainObject(base)||!plainObject(server))return clone(server);
    const out={};for(const k of new Set([...Object.keys(base),...Object.keys(server)]))out[k]=deepServerPriority(base[k],server[k]);return out;
  }
  function mergeKeyed(base,server,keyOf){
    if(!Array.isArray(server))return clone(Array.isArray(base)?base:[]);
    if(!Array.isArray(base))return clone(server);
    const baseMap=new Map();for(const row of base){const key=keyOf(row);if(key!==null&&key!==undefined&&key!=='')baseMap.set(String(key),row)}
    const seen=new Set(),out=[];
    for(const row of server){const key=keyOf(row),normalized=key===null||key===undefined||key===''?null:String(key);out.push(normalized!==null&&baseMap.has(normalized)?deepServerPriority(baseMap.get(normalized),row):clone(row));if(normalized!==null)seen.add(normalized)}
    for(const row of base){const key=keyOf(row),normalized=key===null||key===undefined||key===''?null:String(key);if(normalized===null||!seen.has(normalized))out.push(clone(row))}
    return out;
  }
  function mergeV135Config(base,server){
    if(!plainObject(server))return clone(base);
    if(!plainObject(base))return clone(server);
    const out=deepServerPriority(base,server),specs={realms:x=>x?.lv,monsters:x=>x?.id,zones:x=>x?.coord,shop:x=>x?.id,npcShop:x=>x?.id,paymentPackages:x=>x?.id,techniques:x=>x?.id,aiCultivators:x=>x?.id,heavenlyTreasures:x=>x?.itemId,craftingRecipes:x=>x?.id};
    for(const [field,keyOf] of Object.entries(specs))out[field]=mergeKeyed(base[field],server[field],keyOf);
    return out;
  }
  let staticConfigPromise=null;
  function loadStaticV135(){
    if(!staticConfigPromise)staticConfigPromise=fetch('xianxia_config_V12.json?v=20260719-fix2-1',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('靜態 Config '+r.status);return r.json()}).catch(e=>{console.warn('V13.5 static config fallback unavailable',e);return null});
    return staticConfigPromise;
  }
  function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
  function setDirty(v=true){state.dirty=v;const e=document.getElementById('configDirty');if(e)e.textContent=v?'尚未儲存':'已同步'}
  function injectStyles(){
    if(document.getElementById('v129AdminStyle'))return;
    const s=document.createElement('style');s.id='v129AdminStyle';s.textContent=`
      .cfg-toolbar{display:flex;gap:8px;flex-wrap:wrap}.cfg-toolbar .btn{flex:1;min-width:130px}.cfg-tabs{display:flex;gap:6px;overflow:auto;margin:12px 0;padding-bottom:4px}.cfg-tabs button{white-space:nowrap;border:1px solid var(--line);background:#08101a;color:var(--muted);border-radius:8px;padding:9px 12px}.cfg-tabs button.on{color:var(--gold);border-color:#8f713d;background:#211a0e}.cfg-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px}.cfg-table{width:100%;border-collapse:collapse;min-width:850px}.cfg-table th,.cfg-table td{border-bottom:1px solid #ffffff0d;padding:6px;vertical-align:top}.cfg-table th{position:sticky;top:0;background:#0d1723;color:var(--muted);font-size:11px;z-index:1}.cfg-table input,.cfg-table textarea,.cfg-table select{padding:8px;font-size:13px;min-width:85px}.cfg-table textarea{min-height:54px}.cfg-table .id{min-width:80px;color:var(--jade)}.cfg-mini{font-size:11px;color:var(--muted)}.fixed-item-builder{border:1px solid rgba(73,210,199,.34);background:linear-gradient(180deg,rgba(7,26,34,.96),rgba(7,13,21,.98));border-radius:12px;padding:14px;margin-bottom:14px}.fixed-item-builder h3{margin:0 0 5px;color:var(--jade)}.fixed-item-builder .builder-note{font-size:12px;color:var(--muted);line-height:1.7;margin-bottom:12px}.fixed-item-grid{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:9px;align-items:end}.fixed-item-grid .field{margin:0}.fixed-item-grid label{display:block;font-size:11px;color:var(--muted);margin-bottom:5px}.fixed-item-grid input,.fixed-item-grid select{width:100%;min-width:0}.fixed-item-preview{margin-top:10px;padding:10px 12px;border-left:3px solid var(--gold);background:#ffffff08;color:#e7e1d3;line-height:1.65}.fixed-lock{display:inline-flex;align-items:center;border:1px solid #ffffff1c;border-radius:999px;padding:4px 8px;background:#07111a;color:#cbd4dc;font-size:11px;white-space:nowrap}.fixed-lock.legacy{color:#d8b96a}.fixed-item-actions{display:flex;gap:8px;margin-top:10px}.fixed-item-actions .btn{flex:1}.fixed-value-wrap{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center}.fixed-value-unit{color:var(--gold);font-weight:800;min-width:28px;text-align:center}.fixed-item-list-note{margin:8px 0 10px;color:var(--muted);font-size:12px}.fixed-item-filter{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.fixed-item-filter button{border:1px solid var(--line);background:#08101a;color:var(--muted);border-radius:999px;padding:6px 10px}.fixed-item-filter button.on{border-color:#8f713d;color:var(--gold);background:#211a0e}@media(max-width:1100px){.fixed-item-grid{grid-template-columns:repeat(3,minmax(130px,1fr))}}@media(max-width:700px){.fixed-item-grid{grid-template-columns:1fr 1fr}.fixed-item-actions{flex-direction:column}}.cfg-version{display:grid;grid-template-columns:75px 90px 1fr auto;gap:8px;align-items:center;padding:8px;border-bottom:1px solid #ffffff0d}.cfg-version:last-child{border-bottom:0}.cfg-status{border:1px solid var(--line);border-radius:99px;padding:3px 7px;text-align:center;font-size:10px}.cfg-status.published{color:#77d89c}.cfg-status.draft{color:var(--gold)}.cfg-status.archived{color:var(--muted)}.cfg-json{min-height:420px;font-family:ui-monospace,Consolas,monospace;font-size:12px}.cfg-break-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.cfg-break-grid .field{background:#070d15;border:1px solid var(--line);border-radius:9px;padding:8px}@media(max-width:700px){.cfg-break-grid{grid-template-columns:1fr 1fr}.cfg-version{grid-template-columns:60px 78px 1fr}.cfg-version .btn{grid-column:1/-1}.cfg-toolbar .btn{min-width:46%}}
    `;document.head.appendChild(s);
  }

  function injectCard(){
    if(document.getElementById('gameConfigAdmin'))return;
    injectStyles();
    const main=document.getElementById('adminMain');if(!main)return;
    const section=document.createElement('section');section.id='gameConfigAdmin';section.className='card';
    section.innerHTML=`
      <div class="head"><div><h2 style="margin:0">遊戲數值營運後台</h2><small>物品、商店、怪物、功法、戰鬥與突破參數</small></div><span id="configDirty" class="pill">尚未載入</span></div>
      <div class="status"><div><span>正式版本</span><b id="publishedConfigVersion">Config 0</b></div><div><span>目前草稿</span><b id="draftConfigVersion">無</b></div><div><span>最後發布</span><b id="publishedConfigAt">尚未發布</b></div><div><span>驗證</span><b id="configValidation">待檢查</b></div></div>
      <div class="field" style="margin-top:10px"><label>版本備註</label><input id="configNotes" placeholder="例如：調整元嬰怪物傷害與萬寶坊市價格"></div>
      <div class="cfg-toolbar" style="margin-top:10px"><button class="btn jade" onclick="createConfigDraftV129()">從目前正式版建立草稿</button><button class="btn" onclick="saveConfigDraftV129()">儲存草稿</button><button class="btn gold" onclick="publishConfigDraftV129()">發布草稿</button><button class="btn" onclick="exportConfigExcelV129()">匯出 Excel</button><button class="btn" onclick="document.getElementById('configExcelInput').click()">匯入 Excel</button><input id="configExcelInput" type="file" accept=".xlsx,.xls" hidden onchange="importConfigExcelV129(this.files[0])"></div>
      <div class="cfg-tabs" id="configTabs"></div><div id="configEditor"><div class="notice">正在載入設定…</div></div>
      <h3 style="margin-top:18px">突破事件即時參數</h3><div id="breakthroughConfigEditor"></div>
      <h3 style="margin-top:18px">版本紀錄與回復</h3><div id="configVersions" class="cfg-table-wrap"></div>`;
    const cards=Array.from(main.children).filter(el=>el.matches?.('section.card'));const last=cards[cards.length-1];if(last)main.insertBefore(section,last);else main.appendChild(section);
  }

  function tabs(){return [['items','物品'],['shop','NPC商店'],['monsters','怪物'],['techniques','功法'],['combat','戰鬥參數'],['breakthrough','突破成功率'],['raw','完整JSON']]}
  function renderTabs(){const e=document.getElementById('configTabs');if(!e)return;e.innerHTML=tabs().map(([id,label])=>`<button class="${state.tab===id?'on':''}" onclick="setConfigTabV129('${id}')">${label}</button>`).join('')}
  function input(value,path,type='text',attrs=''){return `<input type="${type}" value="${h(value)}" data-cfg-path="${h(path)}" ${attrs}>`}
  function textarea(value,path){return `<textarea data-cfg-path="${h(path)}">${h(value)}</textarea>`}

  function select(value,path,options,attrs=''){
    return `<select data-cfg-path="${h(path)}" ${attrs}>${options.map(([v,l])=>`<option value="${h(v)}" ${String(value??'')===String(v)?'selected':''}>${h(l)}</option>`).join('')}</select>`;
  }
  function signed(v){const x=n(v);return x>0?'+'+x:String(x)}
  function kindFromItem(x){
    const cat=String(x?.cat||''),eff=String(x?.eff||'');
    if(cat==='法器'||cat==='防具')return 'equipment';
    if(cat==='丹藥')return 'medicine';
    if(cat==='丹方')return 'recipe';
    if(cat==='藥材')return 'herb';
    if(cat==='附魔材料'&&eff==='五行附魔')return 'enchant';
    if(cat==='材料')return 'material';
    return 'legacy';
  }
  function fixedItemLabel(x){
    const kind=kindFromItem(x);
    if(kind==='equipment')return x.cat==='防具'?'裝備／防具':'裝備／武器';
    if(kind==='medicine')return '藥品／'+(x.eff||'未設定');
    if(kind==='recipe')return '丹方／習得配方';
    if(kind==='herb')return '藥材／合成材料';
    if(kind==='enchant')return '附魔材料／'+(x.type||'五行');
    if(kind==='material')return '材料／合成材料';
    return (x.cat||'既有特殊項目')+'／'+(x.eff||'固定功能');
  }
  function nextFixedItemId(kind,subtype){
    const items=state.draft?.items||{};let range=FIXED_ITEM_KINDS[kind]?.idRange||[8700,8999];
    if(kind==='equipment')range=subtype==='armor'?[3000,3999]:[2000,2999];
    for(let i=range[0];i<=range[1];i++)if(!items[String(i)])return String(i);
    return '';
  }
  function builderDetail(kind,subtype,effect,value){
    const v=n(value);
    if(kind==='equipment')return subtype==='armor'?`裝備後防禦力 ${signed(v)}。`:`裝備後攻擊力 ${signed(v)}。`;
    if(kind==='material')return '可作為煉丹或煉器材料。';
    if(kind==='herb')return '藥材，可作為煉丹材料。';
    if(kind==='recipe')return `使用後習得配方編號 ${Math.max(0,Math.floor(v))}。`;
    if(kind==='medicine'){
      if(effect==='hp')return `使用後恢復 ${v} 點體力。`;
      if(effect==='mp')return `使用後恢復 ${v} 點精力。`;
      if(effect==='heal')return '使用後解除一項外傷狀態。';
      if(effect==='breakthrough')return `突破成功率增加 ${v}%。`;
    }
    if(kind==='enchant'){
      if(effect==='fire')return `火性附魔：追加 ${v}% 火性傷害。`;
      if(effect==='water')return `水性附魔：削減對方最大法力 ${v}%。`;
      if(effect==='wood')return `木性附魔：實際傷害 ${v}% 轉為自身體力。`;
      if(effect==='metal')return `金性附魔：暴擊率增加 ${v}%。`;
      if(effect==='earth')return `土性附魔：最終承傷降低 ${v}%。`;
    }
    return '';
  }

  function renderFixedItemBuilder(){
    return `<div class="fixed-item-builder">
      <h3>固定物品建立器</h3>
      <div class="builder-note">先建立唯一 ID，再依固定分類、固定效果與數值建立物品。類別與效果不能自由輸入，避免產生遊戲無法辨識的資料。</div>
      <div class="fixed-item-grid">
        <div class="field"><label>物品 ID</label><input id="fixedItemId" inputmode="numeric" placeholder="不可重複"></div>
        <div class="field"><label>名稱</label><input id="fixedItemName" placeholder="輸入物品名稱"></div>
        <div class="field"><label>分類</label><select id="fixedItemKind" onchange="refreshFixedItemBuilderV154()">${Object.entries(FIXED_ITEM_KINDS).map(([id,x])=>`<option value="${id}">${x.label}</option>`).join('')}</select></div>
        <div class="field" id="fixedItemSubtypeField"><label>種類</label><select id="fixedItemSubtype" onchange="refreshFixedItemBuilderV154()"></select></div>
        <div class="field" id="fixedItemEffectField"><label>效果</label><select id="fixedItemEffect" onchange="refreshFixedItemBuilderV154()"></select></div>
        <div class="field"><label>數值</label><div class="fixed-value-wrap"><input id="fixedItemValue" type="number" step="0.01" value="0" oninput="refreshFixedItemBuilderV154(false)"><span id="fixedItemValueUnit" class="fixed-value-unit">點</span></div></div>
      </div>
      <div id="fixedItemPreview" class="fixed-item-preview">請選擇分類。</div>
      <div class="fixed-item-actions"><button class="btn" onclick="assignNextFixedItemIdV154()">取得未使用 ID</button><button class="btn jade" onclick="createFixedConfigItemV154()">建立物品</button></div>
    </div>`;
  }
  function renderItems(){
    const rows=Object.entries(state.draft.items||{}).sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'zh-Hant')).map(([id,x])=>{
      const kind=kindFromItem(x),legacy=kind==='legacy';
      return `<tr><td class="id">${h(id)}</td><td>${input(x.name,`items.${id}.name`)}</td><td><span class="fixed-lock ${legacy?'legacy':''}">${h(fixedItemLabel(x))}</span></td><td>${input(x.val??0,`items.${id}.val`,'number','step="0.01"')}</td><td>${textarea(x.detail||'',`items.${id}.detail`)}</td><td><button class="btn red" onclick="deleteConfigItemV129('${h(id)}')">刪除</button></td></tr>`;
    }).join('');
    return renderFixedItemBuilder()+`<div class="fixed-item-list-note">既有物品的分類與效果已鎖定；只開放名稱、數值與說明，避免誤改功能名稱。特殊既有物品會標示為「固定功能」並原樣保留。</div><div class="cfg-table-wrap"><table class="cfg-table"><thead><tr><th>ID</th><th>名稱</th><th>固定分類／效果</th><th>數值</th><th>說明</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function renderShop(){
    const rows=(state.draft.npcShop||[]).map((x,i)=>`<tr><td>${input(x.id,`npcShop.${i}.id`)}</td><td>${input(x.name,`npcShop.${i}.name`)}</td><td>${input(x.price??0,`npcShop.${i}.price`,'number','min="0"')}</td><td>${input(x.daily??9999,`npcShop.${i}.daily`,'number','min="0"')}</td><td><button class="btn red" onclick="deleteConfigArrayRowV129('npcShop',${i})">刪除</button></td></tr>`).join('');
    return `<div class="row" style="margin-bottom:8px"><button class="btn jade" onclick="addConfigArrayRowV129('npcShop')">新增商品</button></div><div class="cfg-table-wrap"><table class="cfg-table"><thead><tr><th>物品ID</th><th>顯示名稱</th><th>售價</th><th>每日限購</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function renderMonsters(){
    const rows=(state.draft.monsters||[]).map((x,i)=>`<tr><td>${input(x.id,`monsters.${i}.id`,'number')}</td><td>${input(x.name,`monsters.${i}.name`)}</td><td>${input(x.cat,`monsters.${i}.cat`)}</td><td>${input(x.lv??1,`monsters.${i}.lv`,'number')}</td><td>${input(x.hp??1,`monsters.${i}.hp`,'number','min="1"')}</td><td>${input(x.atk??0,`monsters.${i}.atk`,'number','min="0"')}</td><td>${input(x.def??0,`monsters.${i}.def`,'number','min="0"')}</td><td>${input(x.exp??0,`monsters.${i}.exp`,'number','min="0"')}</td><td>${input(x.spawn||'',`monsters.${i}.spawn`)}</td><td>${textarea(JSON.stringify(x.drops||[]),`monsters.${i}.drops`)}</td><td><button class="btn red" onclick="deleteConfigArrayRowV129('monsters',${i})">刪除</button></td></tr>`).join('');
    return `<div class="row" style="margin-bottom:8px"><button class="btn jade" onclick="addConfigArrayRowV129('monsters')">新增怪物</button></div><div class="cfg-table-wrap"><table class="cfg-table"><thead><tr><th>ID</th><th>名稱</th><th>分類</th><th>Lv</th><th>HP</th><th>攻擊</th><th>防禦</th><th>經驗</th><th>出沒</th><th>掉落JSON</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function renderTechniques(){
    const rows=(state.draft.techniques||[]).map((x,i)=>`<tr><td>${input(x.id,`techniques.${i}.id`)}</td><td>${input(x.name,`techniques.${i}.name`)}</td><td>${input(x.category,`techniques.${i}.category`)}</td><td>${input(x.price??0,`techniques.${i}.price`,'number','min="0"')}</td><td>${textarea(x.desc||'',`techniques.${i}.desc`)}</td><td>${textarea(x.details||'',`techniques.${i}.details`)}</td><td><button class="btn red" onclick="deleteConfigArrayRowV129('techniques',${i})">刪除</button></td></tr>`).join('');
    return `<div class="row" style="margin-bottom:8px"><button class="btn jade" onclick="addConfigArrayRowV129('techniques')">新增功法</button></div><div class="cfg-table-wrap"><table class="cfg-table"><thead><tr><th>ID</th><th>名稱</th><th>類別</th><th>元寶價格</th><th>摘要</th><th>詳細效果</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function renderCombat(){return `<div class="cfg-break-grid">${COMBAT_KEYS.map(([k,label])=>`<div class="field"><label>${h(label)}<br><span class="cfg-mini">params.${h(k)}</span></label>${input(state.draft.params?.[k]??0,`params.${k}`,'number','step="0.001"')}</div>`).join('')}</div>`}
  function renderBreakthroughBase(){return `<div class="cfg-break-grid">${['5','10','15'].map(lv=>{const x=state.draft.breakthrough?.[lv]||{};return `<div class="field"><label>Lv${lv}｜${h(x.stage||'突破')}</label>${input(x.base??0,`breakthrough.${lv}.base`,'number','min="0" max="1" step="0.01"')}<span class="cfg-mini">0.05 代表 5%</span></div>`}).join('')}</div>`}
  function renderRaw(){return `<div class="notice">直接修改完整 JSON 後按「套用 JSON」，仍需通過伺服器驗證才能儲存與發布。</div><textarea id="rawConfigJson" class="cfg-json">${h(JSON.stringify(state.draft,null,2))}</textarea><button class="btn jade" style="width:100%;margin-top:8px" onclick="applyRawConfigV129()">套用 JSON</button>`}

  function renderEditor(){
    injectCard();renderTabs();const e=document.getElementById('configEditor');if(!e)return;
    if(!state.draft){e.innerHTML='<div class="notice">尚無草稿。可從目前正式版或 GitHub 靜態設定建立草稿。</div>';return}
    const map={items:renderItems,shop:renderShop,monsters:renderMonsters,techniques:renderTechniques,combat:renderCombat,breakthrough:renderBreakthroughBase,raw:renderRaw};
    e.innerHTML=(map[state.tab]||renderItems)();bindInputs();if(state.tab==='items')setTimeout(()=>refreshFixedItemBuilder(true),0);
  }
  function pathSet(obj,path,value){
    const parts=path.split('.');let cur=obj;
    for(let i=0;i<parts.length-1;i++){const key=/^\d+$/.test(parts[i])?Number(parts[i]):parts[i];cur=cur[key]}
    const last=/^\d+$/.test(parts.at(-1))?Number(parts.at(-1)):parts.at(-1);cur[last]=value;
  }
  function bindInputs(){
    document.querySelectorAll('[data-cfg-path]').forEach(el=>el.addEventListener('change',()=>{
      let v=el.value;if(el.type==='number')v=n(v);
      if(el.tagName==='TEXTAREA'&&el.dataset.cfgPath.endsWith('.drops')){try{v=JSON.parse(v||'[]')}catch(_){toast('掉落欄位必須是合法 JSON');return}}
      pathSet(state.draft,el.dataset.cfgPath,v);setDirty(true);
    }));
  }

  function renderBreakCfg(){
    const e=document.getElementById('breakthroughConfigEditor');if(!e)return;const c=state.breakCfg||{};
    const defs=[['foundation_seconds','築基停靈秒數',15],['core_seconds','結丹停靈秒數',20],['nascent_seconds','元嬰停靈秒數',30],['event_radius','異變半徑（1即3×3）',1],['qi_deviation_multiplier','走火入魔倍率',.75],['rebirth_foundation_rate','三重轉生訣築基成功率',1],['rebirth_core_bonus','三重轉生訣結丹加成',.30],['rebirth_nascent_bonus','三重轉生訣元嬰加成',.05],['battle_tick_seconds','事件攻擊間隔秒數',3],['base_attack_damage','事件基礎傷害',7]];
    const flags=[['enabled','啟用突破事件',true]];
    const fixed=[['中立者強制排出','固定啟用'],['本次事件陣營鎖定','固定啟用'],['襲擊優先攻擊護法人','固定啟用']];
    e.innerHTML=`<div class="cfg-break-grid">${defs.map(([k,l,d])=>`<div class="field"><label>${h(l)}</label><input id="btcfg_${k}" type="number" step="0.01" value="${h(c[k]??d)}"></div>`).join('')}${flags.map(([k,l,d])=>`<div class="field"><label>${h(l)}</label><select id="btcfg_${k}"><option value="true" ${(c[k]??d)?'selected':''}>是</option><option value="false" ${!(c[k]??d)?'selected':''}>否</option></select></div>`).join('')}${fixed.map(([l,v])=>`<div class="field"><label>${h(l)}</label><b>${h(v)}</b></div>`).join('')}</div><div class="row" style="margin-top:8px"><button class="btn gold" onclick="saveBreakthroughConfigV129()">儲存突破參數</button></div>`;
  }
  function renderVersions(){
    const e=document.getElementById('configVersions');if(!e)return;
    e.innerHTML=(state.versions||[]).map(v=>`<div class="cfg-version"><b>Config ${v.version}</b><span class="cfg-status ${v.status}">${h(v.status)}</span><div><div>${h(v.notes||'無備註')}</div><small>${h(v.published_at?new Date(v.published_at).toLocaleString('zh-TW'):new Date(v.updated_at).toLocaleString('zh-TW'))}</small></div>${v.status==='draft'?`<button class="btn red" onclick="deleteConfigDraftV129('${v.id}')">刪除草稿</button>`:v.status==='published'?`<button class="btn" onclick="rollbackConfigV129(${v.version})">目前正式／回復</button>`:`<button class="btn red" onclick="deleteConfigVersionV148('${v.id}',${v.version})">刪除此版</button>`}</div>`).join('')||'<div class="notice">尚無版本紀錄。</div>';
  }
  function renderStatus(){
    const p=state.published;document.getElementById('publishedConfigVersion').textContent='Config '+Number(p?.version||0);document.getElementById('draftConfigVersion').textContent=state.draftId?'Config '+state.draftVersion:'本機草稿';document.getElementById('publishedConfigAt').textContent=p?.published_at?new Date(p.published_at).toLocaleString('zh-TW'):'尚未發布';setDirty(state.dirty);
  }

  async function loadConfigAdmin(){
    injectCard();
    try{
      const [base,{data:pub,error:pe},{data:vers,error:ve},{data:bc,error:be}]=await Promise.all([loadStaticV135(),sb.rpc('get_published_game_config'),sb.rpc('admin_list_game_config_versions'),sb.rpc('get_breakthrough_config')]);
      if(pe||ve)throw pe||ve;
      state.published=pub?{...pub,config:pub.config?mergeV135Config(base,pub.config):pub.config}:null;state.versions=vers||[];state.breakCfg=be?null:bc;
      state.draft=null;state.draftId=null;state.draftVersion=0;
      let rawDraft=null,compatAdded=false;
      const draftMeta=state.versions.find(v=>v.status==='draft');
      if(draftMeta){const {data,error}=await sb.from('game_config_versions').select('id,version,config,notes').eq('id',draftMeta.id).single();if(!error&&data){rawDraft=clone(data.config);state.draft=mergeV135Config(base,data.config);state.draftId=data.id;state.draftVersion=data.version;document.getElementById('configNotes').value=data.notes||''}}
      if(!state.draft&&pub?.config){rawDraft=clone(pub.config);state.draft=mergeV135Config(base,pub.config);state.draftId=null;state.draftVersion=0}
      if(!state.draft){state.draft=clone(base);if(!state.draft){const r=await fetch('xianxia_config_V12.json?v=20260719-fix2-1',{cache:'no-store'});state.draft=await r.json()}}
      if(rawDraft&&state.draft)compatAdded=JSON.stringify(rawDraft)!==JSON.stringify(state.draft);
      state.dirty=compatAdded;renderStatus();renderEditor();renderBreakCfg();renderVersions();
      window.dispatchEvent(new CustomEvent('xianxia:config-admin-ready',{detail:{draftVersion:state.draftVersion,compatAdded}}));
    }catch(e){document.getElementById('configEditor').innerHTML='<div class="notice">V12.9 後台尚未安裝或載入失敗：'+h(e.message||e)+'</div>'}
  }

  async function validateDraft(){
    if(!state.draft)throw new Error('尚無草稿');
    const {data,error}=await sb.rpc('validate_game_config',{p_config:state.draft});if(error)throw error;
    const e=document.getElementById('configValidation');e.textContent=data?.valid?'PASS':'FAIL';e.style.color=data?.valid?'#77d89c':'var(--red)';
    if(!data?.valid)throw new Error((data?.errors||[]).join('；'));
    return true;
  }
  async function chooseReplaceSlot(){
    const all=state.versions||[];
    if(all.length<5)return null;
    const eligible=all.filter(v=>v.status==='archived');
    if(!eligible.length)throw new Error('版本已達 5 個，沒有可覆蓋的封存版本。請先刪除一個草稿。');
    const msg='版本最多 5 個。請輸入要覆蓋的 Config 編號：\n'+eligible.map(v=>'Config '+v.version+'｜'+(v.notes||'無備註')).join('\n');
    const n=Number(prompt(msg));const hit=eligible.find(v=>Number(v.version)===n);
    if(!hit)throw new Error('未選擇有效的封存版本');return hit.id;
  }
  async function createDraft(){
    try{
      if(!state.draft){const r=await fetch('xianxia_config_V12.json',{cache:'no-store'});state.draft=await r.json()}
      await validateDraft();const replaceId=await chooseReplaceSlot();const rpc=replaceId?'admin_replace_game_config_slot':'admin_create_game_config_draft';const args=replaceId?{p_replace_id:replaceId,p_config:state.draft,p_notes:document.getElementById('configNotes').value.trim(),p_publish:false}:{p_config:state.draft,p_notes:document.getElementById('configNotes').value.trim()};const {data,error}=await sb.rpc(rpc,args);if(error)throw error;
      state.draftId=data.id;state.draftVersion=data.version;state.dirty=false;toast('已建立 Config '+data.version+' 草稿');addLog('建立 Config '+data.version+' 草稿');await loadConfigAdmin();
    }catch(e){toast('建立草稿失敗：'+e.message)}
  }
  async function saveDraft(){
    try{if(!state.draftId){await createDraft();return !!state.draftId}await validateDraft();const {error}=await sb.rpc('admin_update_game_config_draft',{p_id:state.draftId,p_config:state.draft,p_notes:document.getElementById('configNotes').value.trim()});if(error)throw error;state.dirty=false;setDirty(false);toast('草稿已儲存');addLog('儲存 Config '+state.draftVersion+' 草稿');return true}
    catch(e){toast('儲存失敗：'+e.message);return false}
  }
  async function publishDraft(){
    try{if(!state.draftId)throw new Error('請先建立並儲存草稿');if(!await saveDraft())return;const {data,error}=await sb.rpc('admin_publish_game_config',{p_id:state.draftId});if(error)throw error;toast('Config '+data.version+' 已發布');addLog('發布 Config '+data.version);state.draftId=null;await loadConfigAdmin()}
    catch(e){toast('發布失敗：'+e.message)}
  }
  async function rollback(version){if(!confirm('確定回復至 Config '+version+'？系統會建立一個新的正式版本，不會刪除歷史。'))return;try{const {data,error}=await sb.rpc('admin_rollback_game_config',{p_version:version,p_notes:'後台回復自 Config '+version});if(error)throw error;toast('已回復並發布 Config '+data.version);addLog('回復自 Config '+version);await loadConfigAdmin()}catch(e){toast('回復失敗：'+e.message)}}

  async function deleteVersionV148(id,version){if(!confirm('確定刪除封存 Config '+version+'？此動作不可復原。'))return;const {error}=await sb.rpc('admin_delete_archived_game_config',{p_id:id});if(error)return toast('刪除失敗：'+error.message);toast('已刪除 Config '+version);await loadConfigAdmin()}
  async function deleteDraft(id){if(!confirm('確定刪除此草稿？'))return;const {error}=await sb.rpc('admin_delete_game_config_draft',{p_id:id});if(error)return toast(error.message);state.draftId=null;state.draft=null;toast('草稿已刪除');await loadConfigAdmin()}

  function refreshFixedItemBuilder(resetDefaults=true){
    const kind=document.getElementById('fixedItemKind')?.value||'equipment';
    const subtypeEl=document.getElementById('fixedItemSubtype'),effectEl=document.getElementById('fixedItemEffect');
    if(!subtypeEl||!effectEl)return;
    const currentSubtype=subtypeEl.value,currentEffect=effectEl.value;
    let subtypes=[],effects=[],unit='點',defaultValue=0;
    if(kind==='equipment'){
      subtypes=Object.entries(EQUIPMENT_TYPES).map(([id,x])=>[id,x.label]);
      const subtype=(currentSubtype&&EQUIPMENT_TYPES[currentSubtype])?currentSubtype:'weapon';
      const spec=EQUIPMENT_TYPES[subtype];effects=[[spec.eff,spec.eff]];defaultValue=10;
    }else if(kind==='material'){
      subtypes=[['general','一般材料']];effects=[['craft','合成材料']];unit='固定';defaultValue=0;
    }else if(kind==='herb'){
      subtypes=[['herb','煉丹藥材']];effects=[['craft','合成材料']];unit='固定';defaultValue=0;
    }else if(kind==='recipe'){
      subtypes=[['alchemy','丹方']];effects=[['learn','習得配方']];unit='配方ID';defaultValue=1;
    }else if(kind==='medicine'){
      subtypes=[['pill','丹藥']];effects=Object.entries(MEDICINE_EFFECTS).map(([id,x])=>[id,x.label]);
      const effect=(currentEffect&&MEDICINE_EFFECTS[currentEffect])?currentEffect:'hp';unit=MEDICINE_EFFECTS[effect].unit;defaultValue=effect==='heal'?0:20;
    }else if(kind==='enchant'){
      subtypes=[['five_element','五行附魔']];effects=Object.entries(ENCHANT_EFFECTS).map(([id,x])=>[id,x.label]);
      const effect=(currentEffect&&ENCHANT_EFFECTS[currentEffect])?currentEffect:'fire';unit=ENCHANT_EFFECTS[effect].unit;defaultValue=ENCHANT_EFFECTS[effect].defaultValue;
    }
    subtypeEl.innerHTML=subtypes.map(([v,l])=>`<option value="${h(v)}">${h(l)}</option>`).join('');
    if(subtypes.some(([v])=>v===currentSubtype))subtypeEl.value=currentSubtype;
    effectEl.innerHTML=effects.map(([v,l])=>`<option value="${h(v)}">${h(l)}</option>`).join('');
    if(effects.some(([v])=>v===currentEffect))effectEl.value=currentEffect;
    const effect=effectEl.value,subtype=subtypeEl.value;
    if(kind==='medicine')unit=MEDICINE_EFFECTS[effect]?.unit||unit;
    if(kind==='enchant')unit=ENCHANT_EFFECTS[effect]?.unit||unit;
    const valueEl=document.getElementById('fixedItemValue');
    if(resetDefaults&&valueEl)valueEl.value=kind==='enchant'?(ENCHANT_EFFECTS[effect]?.defaultValue??defaultValue):(kind==='medicine'&&effect==='heal'?0:defaultValue);
    const unitEl=document.getElementById('fixedItemValueUnit');if(unitEl)unitEl.textContent=unit;
    const idEl=document.getElementById('fixedItemId');if(resetDefaults&&idEl&&!idEl.value)idEl.value=nextFixedItemId(kind,subtype);
    const preview=document.getElementById('fixedItemPreview');if(preview)preview.textContent=builderDetail(kind,subtype,effect,valueEl?.value||0)||'固定資料將由系統自動帶入。';
  }
  function assignNextFixedItemId(){
    const kind=document.getElementById('fixedItemKind')?.value||'equipment',subtype=document.getElementById('fixedItemSubtype')?.value||'';
    const id=nextFixedItemId(kind,subtype);if(!id)return toast('此分類的建議 ID 範圍已無空位');document.getElementById('fixedItemId').value=id;
  }
  function createFixedItem(){
    if(!state.draft?.items)return toast('設定尚未載入');
    const id=String(document.getElementById('fixedItemId')?.value||'').trim(),name=String(document.getElementById('fixedItemName')?.value||'').trim();
    const kind=document.getElementById('fixedItemKind')?.value||'',subtype=document.getElementById('fixedItemSubtype')?.value||'',effect=document.getElementById('fixedItemEffect')?.value||'',value=n(document.getElementById('fixedItemValue')?.value);
    if(!/^\d+$/.test(id))return toast('物品 ID 必須是純數字');
    if(state.draft.items[id])return toast('物品 ID '+id+' 已存在，禁止重複');
    if(!name)return toast('請輸入物品名稱');
    let item={name,cat:'材料',type:null,eff:'合成材料',val:value,stack:999,rarity:'普通',detail:builderDetail(kind,subtype,effect,value)};
    if(kind==='equipment'){
      const spec=EQUIPMENT_TYPES[subtype]||EQUIPMENT_TYPES.weapon;item={...item,cat:spec.cat,type:spec.types[0],eff:spec.eff,stack:1,detail:builderDetail(kind,subtype,effect,value)};
    }else if(kind==='material')item={...item,cat:'材料',type:null,eff:'合成材料',val:0};
    else if(kind==='herb')item={...item,cat:'藥材',type:null,eff:'合成材料',val:0};
    else if(kind==='recipe')item={...item,cat:'丹方',type:null,eff:'習得配方',val:Math.max(0,Math.floor(value)),stack:1};
    else if(kind==='medicine'){
      const spec=MEDICINE_EFFECTS[effect]||MEDICINE_EFFECTS.hp;item={...item,cat:'丹藥',type:null,eff:spec.eff,val:effect==='heal'?0:value};
    }else if(kind==='enchant'){
      const spec=ENCHANT_EFFECTS[effect]||ENCHANT_EFFECTS.fire;item={...item,cat:'附魔材料',type:spec.type,eff:'五行附魔',val:value};
    }else return toast('不支援的物品分類');
    state.draft.items[id]=item;setDirty(true);renderEditor();toast('已建立 '+name+'（'+id+'），請儲存並發布');
  }
  function addItem(){document.getElementById('fixedItemId')?.focus()}
  function delItem(id){if(!confirm('刪除物品 '+id+'？'))return;delete state.draft.items[id];state.draft.npcShop=(state.draft.npcShop||[]).filter(x=>String(x.id)!==String(id));setDirty(true);renderEditor()}
  function addArrayRow(cat){const defaults={npcShop:{id:'',name:'新商品',price:0,daily:9999},monsters:{id:9999,name:'新妖獸',cat:'普通妖獸',lv:1,hp:100,mp:0,atk:10,def:5,exp:10,drops:[],spawn:'荒野'},techniques:{id:'new_technique',name:'新功法',category:'靈修',price:0,desc:'',details:''}};state.draft[cat]=state.draft[cat]||[];state.draft[cat].push(defaults[cat]);setDirty(true);renderEditor()}
  function delArrayRow(cat,i){state.draft[cat].splice(i,1);setDirty(true);renderEditor()}
  function applyRaw(){try{state.draft=JSON.parse(document.getElementById('rawConfigJson').value);setDirty(true);renderEditor();toast('JSON已套用，發布前仍會驗證')}catch(e){toast('JSON格式錯誤：'+e.message)}}

  async function saveBreakCfg(){
    const keys=['foundation_seconds','core_seconds','nascent_seconds','event_radius','qi_deviation_multiplier','rebirth_foundation_rate','rebirth_core_bonus','rebirth_nascent_bonus','battle_tick_seconds','base_attack_damage'];const patch={};for(const k of keys)patch[k]=n(document.getElementById('btcfg_'+k).value);
    patch.enabled=document.getElementById('btcfg_enabled').value==='true';
    const {data,error}=await sb.rpc('admin_set_breakthrough_config',{p_patch:patch});if(error)return toast('突破參數儲存失敗：'+error.message);state.breakCfg=data;toast('突破參數已儲存');addLog('更新突破事件參數');renderBreakCfg();
  }

  function exportExcel(){
    if(!window.XLSX)return toast('Excel元件尚未載入');if(!state.draft)return;
    const X=window.XLSX,wb=X.utils.book_new();
    const sheets={Items:Object.entries(state.draft.items||{}).map(([id,x])=>({id,...x})),NPCShop:state.draft.npcShop||[],Monsters:state.draft.monsters||[],Techniques:state.draft.techniques||[],Params:Object.entries(state.draft.params||{}).map(([key,value])=>({key,value})),Breakthrough:Object.entries(state.draft.breakthrough||{}).map(([level,x])=>({level,...x})),BreakthroughRuntime:[state.breakCfg||{}]};
    for(const [name,rows] of Object.entries(sheets))X.utils.book_append_sheet(wb,X.utils.json_to_sheet(rows),name.slice(0,31));
    X.writeFile(wb,'xianxia_config_draft_'+(state.draftVersion||'local')+'.xlsx');
  }
  async function importExcel(file){
    if(!file||!window.XLSX)return;try{const X=window.XLSX,ab=await file.arrayBuffer(),wb=X.read(ab),read=n=>wb.Sheets[n]?X.utils.sheet_to_json(wb.Sheets[n],{defval:''}):null;const next=clone(state.draft);
      const items=read('Items');if(items){next.items={};for(const row of items){const id=String(row.id);delete row.id;next.items[id]=row}}
      const shop=read('NPCShop');if(shop)next.npcShop=shop;const monsters=read('Monsters');if(monsters)next.monsters=monsters.map(x=>({...x,drops:typeof x.drops==='string'&&x.drops.trim().startsWith('[')?JSON.parse(x.drops):x.drops||[]}));
      const tech=read('Techniques');if(tech)next.techniques=tech;const params=read('Params');if(params){next.params=next.params||{};for(const row of params)next.params[row.key]=row.value}
      const bt=read('Breakthrough');if(bt){next.breakthrough={};for(const row of bt){const lv=String(row.level);delete row.level;next.breakthrough[lv]=row}}
      const runtime=read('BreakthroughRuntime');if(runtime?.[0])state.breakCfg={...(state.breakCfg||{}),...runtime[0]};
      state.draft=next;setDirty(true);renderEditor();renderBreakCfg();toast('Excel已匯入草稿，尚未發布');
    }catch(e){toast('Excel匯入失敗：'+e.message)}finally{document.getElementById('configExcelInput').value=''}}

  loadAll=async function(){await baseLoadAllV129();await loadConfigAdmin()};

  window.setConfigTabV129=id=>{state.tab=id;renderEditor()};
  window.createConfigDraftV129=createDraft;window.saveConfigDraftV129=saveDraft;window.publishConfigDraftV129=publishDraft;window.rollbackConfigV129=rollback;window.deleteConfigDraftV129=deleteDraft;window.deleteConfigVersionV148=deleteVersionV148;
  window.addConfigItemV129=addItem;window.deleteConfigItemV129=delItem;window.addConfigArrayRowV129=addArrayRow;window.deleteConfigArrayRowV129=delArrayRow;window.applyRawConfigV129=applyRaw;
  window.refreshFixedItemBuilderV154=refreshFixedItemBuilder;window.assignNextFixedItemIdV154=assignNextFixedItemId;window.createFixedConfigItemV154=createFixedItem;
  window.saveBreakthroughConfigV129=saveBreakCfg;window.exportConfigExcelV129=exportExcel;window.importConfigExcelV129=importExcel;
  window.V129_CONFIG_ADMIN={state,setDirty,renderEditor,refresh:loadConfigAdmin,mergeV135Config};

  console.info('[V15.4 ADMIN FIXED ITEM BUILDER PHASE1] installed',ITEM_EDITOR_BUILD);
  injectCard();setTimeout(()=>{if(!document.getElementById('adminMain')?.classList.contains('hidden'))loadConfigAdmin()},800);
})();
