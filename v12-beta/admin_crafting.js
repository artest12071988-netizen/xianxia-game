'use strict';
(() => {
  const VERSION='V14.8-ADMIN-CRAFT-CONFIG-RESTORE-FINAL2';
  const cardId='craftConfigCardV145B';
  const categories=['alchemy','equipment','legendary'];
  const categoryLabel={alchemy:'煉丹',equipment:'煉器',legendary:'絕世鍛造'};
  let rows=[];
  let localDirty=false;
  let draftStamp='';
  let refreshTimer=null;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const finite=v=>Number.isFinite(Number(v));
  const toastMsg=m=>typeof window.toast==='function'?window.toast(m):alert(m);
  const api=()=>window.V129_CONFIG_ADMIN||null;
  const draft=()=>api()?.state?.draft||null;
  const itemMap=()=>draft()?.items||{};
  const itemName=id=>itemMap()?.[String(id)]?.name||String(id||'');
  const rate=(v,name)=>{if(!finite(v)||Number(v)<0||Number(v)>1)throw new Error(name+'必須介於 0～1');return Number(v)};
  const positiveInt=(v,name)=>{if(!Number.isInteger(Number(v))||Number(v)<=0)throw new Error(name+'必須是正整數');return Number(v)};
  const nonNegative=(v,name)=>{if(!finite(v)||Number(v)<0)throw new Error(name+'不可小於 0');return Number(v)};

  function injectStyle(){
    if(document.getElementById('v145bAdminCraftStyle'))return;
    const style=document.createElement('style');style.id='v145bAdminCraftStyle';style.textContent=`
      #${cardId} .v145b-admin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      #${cardId} .v145b-admin-actions{display:flex;gap:7px;flex-wrap:wrap}
      #${cardId} .v145b-param-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
      #${cardId} .v145b-param-grid .field{min-width:0}
      #${cardId} .v145b-recipe-list{display:grid;gap:10px;margin-top:12px}
      #${cardId} .v145b-recipe-editor{border:1px solid var(--line);border-radius:12px;padding:11px;background:#ffffff05}
      #${cardId} .v145b-recipe-title{display:grid;grid-template-columns:1.2fr 1fr .8fr auto;gap:8px;align-items:end}
      #${cardId} .v145b-recipe-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:8px}
      #${cardId} .v145b-materials{margin-top:9px;border-top:1px solid #ffffff0d;padding-top:9px}
      #${cardId} .v145b-material-row{display:grid;grid-template-columns:1fr 110px auto;gap:7px;align-items:end;margin-top:6px}
      #${cardId} .v145b-switches{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:8px 0}
      #${cardId} .v145b-switches label{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted)}
      #${cardId} .v145b-note{font-size:11px;color:var(--muted);line-height:1.6}
      #${cardId} .v145b-empty{padding:20px;text-align:center;border:1px dashed var(--line);border-radius:10px;color:var(--muted)}
      #${cardId} select,#${cardId} input{width:100%}
      @media(max-width:900px){#${cardId} .v145b-param-grid,#${cardId} .v145b-recipe-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#${cardId} .v145b-recipe-title{grid-template-columns:1fr 1fr}}
      @media(max-width:620px){#${cardId} .v145b-param-grid,#${cardId} .v145b-recipe-grid,#${cardId} .v145b-recipe-title{grid-template-columns:1fr}#${cardId} .v145b-material-row{grid-template-columns:1fr 86px auto}}
    `;document.head.appendChild(style);
  }
  function normalizeRecipe(r={}){
    return {
      raw:clone(r),id:String(r.id||''),name:String(r.name||''),category:categories.includes(r.category)?r.category:'alchemy',
      blueprint:r.blueprint===null||r.blueprint===undefined?'':String(r.blueprint),stamina:Number(r.stamina??0),successRate:Number(r.successRate??.75),
      outputItemId:String(r.output?.itemId||''),outputQty:Number(r.output?.qty??1),enabled:r.enabled!==false,public:r.public!==false,
      materials:Object.entries(r.materials||{}).map(([itemId,qty])=>({itemId:String(itemId),qty:Number(qty)}))
    };
  }
  function stampOf(d){return d?String(api()?.state?.draftId||'local')+'|'+String(api()?.state?.draftVersion||0)+'|'+JSON.stringify(d.craftingRecipes||[]):''}
  function loadFromDraft(force=false){
    const d=draft();if(!d)return false;const stamp=stampOf(d);
    if(!force&&localDirty)return true;
    if(force||stamp!==draftStamp){rows=(d.craftingRecipes||[]).map(normalizeRecipe);draftStamp=stamp;localDirty=false;render()}
    return true;
  }
  function options(selected='',allowBlank=false){
    const entries=Object.entries(itemMap()).sort((a,b)=>String(a[1]?.name||'').localeCompare(String(b[1]?.name||''),'zh-Hant'));
    return (allowBlank?'<option value="">不需要</option>':'')+entries.map(([id,it])=>`<option value="${esc(id)}" ${String(id)===String(selected)?'selected':''}>${esc(it?.name||id)}｜${esc(id)}</option>`).join('');
  }
  function parameterHtml(){
    const p=draft()?.params||{};
    const field=(id,label,value,min='0',max='1',step='.001')=>`<div class="field"><label>${label}</label><input id="${id}" type="number" min="${min}" max="${max}" step="${step}" value="${esc(value)}"></div>`;
    return `<div class="v145b-param-grid">
      <div class="field"><label>材料消耗</label><select id="craftConsume"><option value="true" ${p.craft_consume_materials!==false?'selected':''}>開啟</option><option value="false" ${p.craft_consume_materials===false?'selected':''}>關閉（封測）</option></select></div>
      ${field('craftEncounter','神匠相遇率',p.master_craftsman_encounter_rate??.10)}
      ${field('craftWilling','初始願意率',p.master_craftsman_initial_willingness_rate??.02)}
      ${field('craftIncrement','拒絕後增加',p.master_craftsman_rejection_increment??.01)}
      ${field('craftMaxWilling','最高願意率',p.master_craftsman_max_willingness_rate??1)}
      ${field('craftAlchemyRate','煉丹預設成功率',p.craft_alchemy_default_success_rate??.75)}
      ${field('craftEquipmentRate','煉器預設成功率',p.craft_equipment_default_success_rate??1)}
      ${field('craftLegendaryRate','絕世鍛造預設成功率',p.craft_legendary_default_success_rate??.35)}
    </div>`;
  }
  function recipeHtml(r,i){
    const mats=r.materials.length?r.materials.map((m,j)=>`<div class="v145b-material-row" data-material-row><div class="field"><label>材料 ${j+1}</label><select data-row="${i}" data-mat="${j}" data-field="itemId">${options(m.itemId)}</select></div><div class="field"><label>數量</label><input type="number" min="1" step="1" value="${esc(m.qty)}" data-row="${i}" data-mat="${j}" data-field="qty"></div><button class="btn red" type="button" data-action="remove-material" data-row="${i}" data-mat="${j}">移除</button></div>`).join(''):'<div class="v145b-note">尚未設定材料。至少新增一項材料。</div>';
    return `<article class="v145b-recipe-editor" data-recipe="${i}">
      <div class="v145b-recipe-title">
        <div class="field"><label>配方名稱</label><input value="${esc(r.name)}" data-row="${i}" data-field="name"></div>
        <div class="field"><label>配方 ID</label><input value="${esc(r.id)}" data-row="${i}" data-field="id"></div>
        <div class="field"><label>分類</label><select data-row="${i}" data-field="category">${categories.map(c=>`<option value="${c}" ${r.category===c?'selected':''}>${categoryLabel[c]}</option>`).join('')}</select></div>
        <button class="btn red" type="button" data-action="remove-recipe" data-row="${i}">刪除配方</button>
      </div>
      <div class="v145b-recipe-grid">
        <div class="field"><label>圖譜</label><select data-row="${i}" data-field="blueprint">${options(r.blueprint,true)}</select></div>
        <div class="field"><label>消耗精力</label><input type="number" min="0" step="1" value="${esc(r.stamina)}" data-row="${i}" data-field="stamina"></div>
        <div class="field"><label>成功率（0～1）</label><input type="number" min="0" max="1" step=".01" value="${esc(r.successRate)}" data-row="${i}" data-field="successRate"></div>
        <div class="field"><label>合成產物</label><select data-row="${i}" data-field="outputItemId">${options(r.outputItemId)}</select></div>
        <div class="field"><label>產物數量</label><input type="number" min="1" step="1" value="${esc(r.outputQty)}" data-row="${i}" data-field="outputQty"></div>
      </div>
      <div class="v145b-switches"><label><input type="checkbox" ${r.enabled?'checked':''} data-row="${i}" data-field="enabled">啟用此配方</label><label><input type="checkbox" ${r.public?'checked':''} data-row="${i}" data-field="public">顯示於玩家萬法譜</label></div>
      <div class="v145b-materials"><div class="v145b-admin-head"><div><b>材料組合</b><div class="v145b-note">可自由改成 1＋2＋3＝4，或 1＋2＋5＝4；材料數不限。</div></div><button class="btn jade" type="button" data-action="add-material" data-row="${i}">＋新增材料</button></div>${mats}</div>
    </article>`;
  }
  function render(){
    const card=document.getElementById(cardId);if(!card)return;
    if(!draft()){card.innerHTML='<h2>萬法煉造與合成控制台</h2><div class="notice">請先登入並載入 Config 草稿。</div>';return}
    card.innerHTML=`<div class="v145b-admin-head"><div><h2>萬法煉造與合成控制台</h2><p class="small">可視化調整材料、產物、成功率、公開狀態與絕世神匠參數。套用後仍須使用原本 Config「儲存草稿／發布」流程才會進入遊戲。</p></div><div class="v145b-admin-actions"><button class="btn" type="button" data-action="reload">重新載入草稿</button><button class="btn jade" type="button" data-action="add-recipe">＋新增配方</button><button class="btn gold" type="button" data-action="apply">套用全部到草稿</button></div></div>${parameterHtml()}<div class="v145b-recipe-list">${rows.length?rows.map(recipeHtml).join(''):'<div class="v145b-empty">目前沒有配方。請按「新增配方」。</div>'}</div>`;
  }
  function markDirty(){localDirty=true;const status=document.getElementById('configDirty');if(status)status.textContent='煉造設定尚未套用'}
  function updateField(el){
    const i=Number(el.dataset.row),field=el.dataset.field;if(!Number.isInteger(i)||!rows[i]||!field)return;
    let value=el.type==='checkbox'?el.checked:el.value;
    if(['stamina','successRate','outputQty'].includes(field))value=Number(value);
    if(el.dataset.mat!==undefined){const j=Number(el.dataset.mat);if(!rows[i].materials[j])return;rows[i].materials[j][field]=field==='qty'?Number(value):String(value)}
    else rows[i][field]=value;
    markDirty();
  }
  function addRecipe(){
    const firstItem=Object.keys(itemMap())[0]||'';rows.push(normalizeRecipe({id:'CRAFT_'+Date.now().toString(36).toUpperCase(),name:'新配方',category:'alchemy',blueprint:null,materials:firstItem?{[firstItem]:1}:{},stamina:10,successRate:.75,output:{itemId:firstItem,qty:1},enabled:true,public:true}));markDirty();render();
  }
  function validateRecipeRows(source,d){
    if(!d)throw new Error('尚無 Config 草稿');const ids=new Set(),items=d.items||{};
    return source.map((r,i)=>{
      const at='第 '+(i+1)+' 筆配方：';
      if(!r.id.trim())throw new Error(at+'缺少配方 ID');if(ids.has(r.id.trim()))throw new Error(at+'配方 ID 重複');ids.add(r.id.trim());
      if(!r.name.trim())throw new Error(at+'缺少名稱');if(!categories.includes(r.category))throw new Error(at+'分類錯誤');
      nonNegative(r.stamina,at+'精力');rate(r.successRate,at+'成功率');positiveInt(r.outputQty,at+'產物數量');
      if(r.blueprint&&!items[String(r.blueprint)])throw new Error(at+'圖譜不存在：'+r.blueprint);
      if(!r.outputItemId||!items[String(r.outputItemId)])throw new Error(at+'產物不存在');
      if(!Array.isArray(r.materials)||!r.materials.length)throw new Error(at+'至少需要一項材料');
      const materialObj={},seen=new Set();
      r.materials.forEach((m,j)=>{if(!m.itemId||!items[String(m.itemId)])throw new Error(at+'材料 '+(j+1)+' 不存在');if(seen.has(String(m.itemId)))throw new Error(at+'材料重複：'+itemName(m.itemId));seen.add(String(m.itemId));materialObj[String(m.itemId)]=positiveInt(m.qty,at+'材料 '+itemName(m.itemId)+' 數量')});
      return {...r.raw,id:r.id.trim(),name:r.name.trim(),category:r.category,blueprint:r.blueprint||null,materials:materialObj,stamina:nonNegative(r.stamina,at+'精力'),successRate:rate(r.successRate,at+'成功率'),output:{...(r.raw.output||{}),itemId:String(r.outputItemId),qty:positiveInt(r.outputQty,at+'產物數量')},enabled:!!r.enabled,public:!!r.public};
    });
  }
  function validateRows(){return validateRecipeRows(rows,draft())}
  function apply(){
    const d=draft();if(!d){toastMsg('請先載入或建立 Config 草稿');return false;}
    try{
      const recipes=validateRows(),p=d.params||(d.params={});
      p.craft_consume_materials=document.getElementById('craftConsume').value==='true';
      p.master_craftsman_encounter_rate=rate(document.getElementById('craftEncounter').value,'神匠相遇率');
      p.master_craftsman_initial_willingness_rate=rate(document.getElementById('craftWilling').value,'初始願意率');
      p.master_craftsman_rejection_increment=rate(document.getElementById('craftIncrement').value,'拒絕後增加率');
      p.master_craftsman_max_willingness_rate=rate(document.getElementById('craftMaxWilling').value,'最高願意率');
      if(p.master_craftsman_max_willingness_rate<p.master_craftsman_initial_willingness_rate)throw new Error('最高願意率不可小於初始願意率');
      p.craft_alchemy_default_success_rate=rate(document.getElementById('craftAlchemyRate').value,'煉丹預設成功率');
      p.craft_equipment_default_success_rate=rate(document.getElementById('craftEquipmentRate').value,'煉器預設成功率');
      p.craft_legendary_default_success_rate=rate(document.getElementById('craftLegendaryRate').value,'絕世鍛造預設成功率');
      d.craftingRecipes=recipes;rows=recipes.map(normalizeRecipe);localDirty=false;draftStamp=stampOf(d);api()?.setDirty?.(true);toastMsg('煉造設定已套用');render();return true;
    }catch(e){toastMsg('煉造設定錯誤：'+e.message);return false;}
  }
  function handleClick(e){
    const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,i=Number(b.dataset.row),j=Number(b.dataset.mat);
    if(action==='add-recipe')return addRecipe();
    if(action==='reload'){if(localDirty&&!confirm('尚有未套用的修改，確定重新載入草稿？'))return;return loadFromDraft(true)}
    if(action==='apply')return apply();
    if(action==='remove-recipe'){if(confirm('確定刪除此配方？')){rows.splice(i,1);markDirty();render()}return}
    if(action==='add-material'){const first=Object.keys(itemMap())[0]||'';rows[i].materials.push({itemId:first,qty:1});markDirty();render();return}
    if(action==='remove-material'){rows[i].materials.splice(j,1);markDirty();render();return}
  }
  function inject(){
    injectStyle();const main=document.getElementById('adminMain');if(!main)return false;let card=document.getElementById(cardId);
    const old=document.getElementById('craftConfigCardV135');if(old)old.remove();
    if(!card){card=document.createElement('section');card.className='card';card.id=cardId;card.dataset.uiGroup='craft';card.addEventListener('click',handleClick);card.addEventListener('input',e=>{if(e.target.closest?.('.v145b-param-grid'))markDirty();else updateField(e.target)});card.addEventListener('change',e=>{if(e.target.closest?.('.v145b-param-grid'))markDirty();else updateField(e.target)});(document.querySelector('#adminMain .admin-ui-pane[data-group="craft"]')||main).appendChild(card);window.dispatchEvent(new CustomEvent('xianxia:admin-card-added',{detail:{id:cardId,group:'craft'}}))}
    loadFromDraft(false);if(!draft())render();return true;
  }
  function boot(){inject();clearInterval(refreshTimer);refreshTimer=setInterval(()=>{inject();loadFromDraft(false)},900)}
  window.V145B_ADMIN_CRAFTING={version:VERSION,refresh:()=>loadFromDraft(true),validate:validateRows,validateRecipes:(source,d)=>validateRecipeRows(source,d),getRows:()=>clone(rows)};
  window.applyCraftConfigV135=apply;
  window.addEventListener('xianxia:config-admin-ready',()=>{inject();loadFromDraft(true)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
