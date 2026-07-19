'use strict';
(() => {
  const VERSION='V13.5-FIX1-ADMIN-CRAFT-2';
  const cardId='craftConfigCardV135';
  const categories=new Set(['alchemy','equipment','legendary']);
  const finite=v=>Number.isFinite(Number(v));
  const rate=(v,name)=>{if(!finite(v)||Number(v)<0||Number(v)>1)throw new Error(name+'必須介於 0～1');return Number(v)};
  const positiveInt=(v,name)=>{if(!Number.isInteger(Number(v))||Number(v)<=0)throw new Error(name+'必須是正整數');return Number(v)};
  const nonNegative=(v,name)=>{if(!finite(v)||Number(v)<0)throw new Error(name+'不可小於 0');return Number(v)};

  function inject(){
    const main=document.getElementById('adminMain');if(!main||document.getElementById(cardId))return;
    const card=document.createElement('section');card.className='card';card.id=cardId;
    card.innerHTML='<h2>V13.5 煉造系統</h2><p class="small">設定煉丹、煉器、絕世工匠意願與材料消耗。配方儲存在遊戲 Config 草稿，需按原有「儲存／發布」流程才會生效。</p><div class="form"><label>材料消耗</label><select id="craftConsume"><option value="true">開啟</option><option value="false">關閉（封測）</option></select><label>工匠相遇率</label><input id="craftEncounter" type="number" min="0" max="1" step="0.001"><label>初始願意率</label><input id="craftWilling" type="number" min="0" max="1" step="0.001"><label>每次拒絕增加</label><input id="craftIncrement" type="number" min="0" max="1" step="0.001"><label>最高願意率</label><input id="craftMaxWilling" type="number" min="0" max="1" step="0.001"><label>煉丹預設成功率</label><input id="craftAlchemyRate" type="number" min="0" max="1" step="0.001"><label>煉器預設成功率</label><input id="craftEquipmentRate" type="number" min="0" max="1" step="0.001"><label>絕世鍛造預設成功率</label><input id="craftLegendaryRate" type="number" min="0" max="1" step="0.001"><label>配方 JSON</label><textarea id="craftRecipes" rows="12"></textarea><button class="btn gold" onclick="applyCraftConfigV135()">套用至目前草稿</button></div>';
    main.appendChild(card);refresh();
  }
  function api(){return window.V129_CONFIG_ADMIN||null}
  function draft(){return api()?.state?.draft||null}
  function refresh(){
    const d=draft();if(!d)return;
    const p=d.params||{};
    document.getElementById('craftConsume').value=String(p.craft_consume_materials!==false);
    document.getElementById('craftEncounter').value=Number(p.master_craftsman_encounter_rate??.10);
    document.getElementById('craftWilling').value=Number(p.master_craftsman_initial_willingness_rate??.02);
    document.getElementById('craftIncrement').value=Number(p.master_craftsman_rejection_increment??.01);
    document.getElementById('craftMaxWilling').value=Number(p.master_craftsman_max_willingness_rate??1);
    document.getElementById('craftAlchemyRate').value=Number(p.craft_alchemy_default_success_rate??.75);
    document.getElementById('craftEquipmentRate').value=Number(p.craft_equipment_default_success_rate??1);
    document.getElementById('craftLegendaryRate').value=Number(p.craft_legendary_default_success_rate??.35);
    document.getElementById('craftRecipes').value=JSON.stringify(d.craftingRecipes||[],null,2);
  }
  function validateRecipes(recipes,d){
    if(!Array.isArray(recipes))throw new Error('配方必須是陣列');
    const ids=new Set();const items=d.items||{};
    recipes.forEach((r,i)=>{
      const at='第 '+(i+1)+' 筆配方：';
      if(!r||typeof r!=='object'||Array.isArray(r))throw new Error(at+'格式錯誤');
      if(typeof r.id!=='string'||!r.id.trim())throw new Error(at+'缺少 ID');
      if(ids.has(r.id))throw new Error(at+'ID 重複：'+r.id);ids.add(r.id);
      if(!categories.has(r.category))throw new Error(at+'category 只允許 alchemy、equipment、legendary');
      if(typeof r.name!=='string'||!r.name.trim())throw new Error(at+'缺少名稱');
      nonNegative(r.stamina,at+'精力');
      if(r.successRate!==undefined)rate(r.successRate,at+'成功率');
      if(r.blueprint!==null&&r.blueprint!==undefined&&r.blueprint!==''&&!items[String(r.blueprint)])throw new Error(at+'圖譜不存在：'+r.blueprint);
      if(!r.materials||typeof r.materials!=='object'||Array.isArray(r.materials))throw new Error(at+'materials 必須是物件');
      for(const [itemId,qty] of Object.entries(r.materials)){
        if(!items[String(itemId)])throw new Error(at+'材料不存在：'+itemId);
        positiveInt(qty,at+'材料 '+itemId+' 數量');
      }
      const outputId=String(r.output?.itemId||'');
      if(!outputId||!items[outputId])throw new Error(at+'產物不存在：'+(outputId||'未填'));
      positiveInt(r.output?.qty??1,at+'產物數量');
      if(r.enabled!==undefined&&typeof r.enabled!=='boolean')throw new Error(at+'enabled 必須是 true 或 false');
    });
    return recipes;
  }
  function apply(){
    const d=draft();if(!d)return toast('請先載入或建立 Config 草稿');
    try{
      const recipes=validateRecipes(JSON.parse(document.getElementById('craftRecipes').value||'[]'),d);
      const encounter=rate(document.getElementById('craftEncounter').value,'工匠相遇率');
      const willing=rate(document.getElementById('craftWilling').value,'初始願意率');
      const increment=rate(document.getElementById('craftIncrement').value,'每次拒絕增加率');
      const maxWilling=rate(document.getElementById('craftMaxWilling').value,'最高願意率');
      if(maxWilling<willing)throw new Error('最高願意率不可小於初始願意率');
      d.params=d.params||{};d.params.craft_consume_materials=document.getElementById('craftConsume').value==='true';
      d.params.master_craftsman_encounter_rate=encounter;
      d.params.master_craftsman_initial_willingness_rate=willing;
      d.params.master_craftsman_rejection_increment=increment;
      d.params.master_craftsman_max_willingness_rate=maxWilling;
      d.params.craft_alchemy_default_success_rate=rate(document.getElementById('craftAlchemyRate').value,'煉丹預設成功率');
      d.params.craft_equipment_default_success_rate=rate(document.getElementById('craftEquipmentRate').value,'煉器預設成功率');
      d.params.craft_legendary_default_success_rate=rate(document.getElementById('craftLegendaryRate').value,'絕世鍛造預設成功率');
      d.craftingRecipes=recipes;
      api()?.setDirty?.(true);toast('煉造設定已驗證並套用至草稿，請再儲存並發布');
    }catch(e){toast('煉造設定錯誤：'+e.message)}
  }
  window.V135_ADMIN_CRAFTING={version:VERSION,validateRecipes};
  window.applyCraftConfigV135=apply;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,400));else setTimeout(inject,400);
})();
