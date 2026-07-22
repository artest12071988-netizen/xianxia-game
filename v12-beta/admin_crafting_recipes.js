/* V14.8 FINAL2｜停用重複空白動態配方面板。正式配方統一由 admin_crafting.js / Config 管理。 */
(()=>{'use strict';
function removeLegacy(){
  document.getElementById('recipeFormCard')?.remove();
  const list=document.getElementById('recipeAdminList');
  list?.closest('section.card')?.remove();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',removeLegacy,{once:true});else removeLegacy();
new MutationObserver(removeLegacy).observe(document.documentElement,{childList:true,subtree:true});
})();
