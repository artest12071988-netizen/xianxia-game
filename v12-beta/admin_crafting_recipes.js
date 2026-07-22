/* V14.8 FINAL3｜只移除舊版空白動態配方面板，不影響正式 Config 配方控制台。 */
(()=>{'use strict';
function removeLegacy(){
  document.getElementById('recipeFormCard')?.remove();
  const list=document.getElementById('recipeAdminList');
  const legacyCard=list?.closest('section.card');
  if(legacyCard && legacyCard.id!=='craftConfigCardV145B') legacyCard.remove();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',removeLegacy,{once:true});else removeLegacy();
setTimeout(removeLegacy,800);setTimeout(removeLegacy,2200);
})();
