/* DaysWon conversion events. Logs to the console only; no third-party trackers.
   Wire a real analytics call inside track() later. */
(function(){
"use strict";
function track(event,data){
  try{console.log("[track]",event,data||{});}catch(e){}
}
window.track=track;
document.addEventListener("click",function(e){
  var a=e.target.closest&&e.target.closest("[data-track]");
  if(a)track(a.getAttribute("data-track"),{href:a.getAttribute("href")||""});
});
var y=document.querySelectorAll("[data-year]");for(var i=0;i<y.length;i++)y[i].textContent=String(new Date().getFullYear());
})();
