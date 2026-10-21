/* Days Won page script: menu, inquiry form, journey illustration, measurement hooks. */
(function(){
"use strict";
/* Measurement hook. No analytics tool is connected; events are only dispatched on the page
   (event names only, never form text or contact details) so a tool can listen later. */
function track(ev){try{document.dispatchEvent(new CustomEvent("dayswon:track",{detail:{event:ev}}));}catch(e){}
 try{if(window.dataLayer&&typeof window.dataLayer.push==="function")window.dataLayer.push({event:"dayswon_"+ev});}catch(e){}}
window.DaysWonTrack=track;
document.getElementById("year").textContent=new Date().getFullYear();
/* Hero illustration: the moving dot stops at each step's icon (distances measured, since rows differ in height). */
function placeDot(){var l=document.querySelector(".jlist");if(!l)return;var ic=l.querySelectorAll(".ji");if(ic.length<4)return;
 function mid(x){return x.parentNode.offsetTop+x.offsetTop+x.offsetHeight/2;}
 var t0=mid(ic[0]);for(var i=1;i<4;i++)l.style.setProperty("--j"+i,(mid(ic[i])-t0)+"px");
 l.style.setProperty("--jtop",(t0-5)+"px");}
placeDot();window.addEventListener("resize",placeDot);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(placeDot);
var menu=document.getElementById("menu"),links=document.getElementById("navlinks");
function setMenu(open){links.classList.toggle("open",open);menu.setAttribute("aria-expanded",String(open));menu.setAttribute("aria-label",open?"Close menu":"Open menu");menu.textContent=open?"✕":"☰";}
menu.addEventListener("click",function(){setMenu(!links.classList.contains("open"));});
links.querySelectorAll("a").forEach(function(a){a.addEventListener("click",function(){setMenu(false);});});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&links.classList.contains("open")){setMenu(false);menu.focus();}});
[].slice.call(document.querySelectorAll("[data-track]")).forEach(function(a){a.addEventListener("click",function(){track(a.getAttribute("data-track"));});});
/* Move focus to the form's first field when a primary button is used, so keyboard users land in it. */
[].slice.call(document.querySelectorAll('a[href="#contact"]')).forEach(function(a){a.addEventListener("click",function(){setTimeout(function(){var n=document.getElementById("f-name");if(n)try{n.focus({preventScroll:true});}catch(e){}},window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:600);});});

var f=document.getElementById("contactForm");if(!f)return;
var loadedAt=Date.now(),started=false,sending=false;
var alertBox=document.getElementById("formAlert"),btn=document.getElementById("submitBtn");
var RULES=[
 ["name","e-name",function(v){return v?"":"Please enter your name.";}],
 ["email","e-email",function(v){return !v?"Please enter your email.":(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?"":"Please enter a valid email address, like name@business.com.");}],
 ["company","e-company",function(v){return v?"":"Please enter your business name.";}],
 ["business_type","e-btype",function(v){return v?"":"Please tell us what type of business you run.";}],
 ["message","e-msg",function(v){return v.length>=2?"":"Please tell us where leads slip through today.";}]
];
f.addEventListener("input",function(){if(!started){started=true;track("form_start");}},{once:false});
function val(n){var x=f.elements[n];return x?String(x.value||"").trim():"";}
function setErr(name,id,msg){var x=f.elements[name],e=document.getElementById(id);e.textContent=msg;if(msg)x.setAttribute("aria-invalid","true");else x.removeAttribute("aria-invalid");}
RULES.forEach(function(r){var x=f.elements[r[0]];x.addEventListener("blur",function(){if(x.getAttribute("aria-invalid")==="true")setErr(r[0],r[1],r[2](val(r[0])));});
 x.addEventListener("change",function(){if(x.getAttribute("aria-invalid")==="true")setErr(r[0],r[1],r[2](val(r[0])));});});
function validate(){var first=null;RULES.forEach(function(r){var m=r[2](val(r[0]));setErr(r[0],r[1],m);if(m&&!first)first=f.elements[r[0]];});return first;}
function showError(msg){alertBox.className="form-alert error";alertBox.textContent=msg;try{alertBox.focus();}catch(e){}}
var IDS={name:"e-name",email:"e-email",company:"e-company",business_type:"e-btype",message:"e-msg"};
f.addEventListener("submit",function(ev){
 ev.preventDefault();if(sending)return;
 alertBox.textContent="";alertBox.className="form-alert";
 var first=validate();
 if(first){showError("Please fix the highlighted fields below. Everything you typed is still here.");first.focus();return;}
 var d={type:"inquiry",form:"v3",name:val("name"),email:val("email"),company:val("company"),business_type:val("business_type"),message:val("message"),phone:val("phone"),website:val("website"),page:location.href,elapsed:Date.now()-loadedAt};
 sending=true;btn.disabled=true;btn.setAttribute("aria-busy","true");btn.textContent="Sending…";
 var done=function(){sending=false;btn.disabled=false;btn.removeAttribute("aria-busy");btn.textContent="Get Your Days Back";};
 var ctl=window.AbortController?new AbortController():null,timer=setTimeout(function(){if(ctl)ctl.abort();},20000);
 fetch("https://dayswon-preview.sites.tab.bot/api/lead",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(d),signal:ctl?ctl.signal:undefined})
 .then(function(r){return r.json().catch(function(){return {};}).then(function(j){return {status:r.status,ok:r.ok&&j&&j.ok===true,j:j||{}};});})
 .then(function(res){clearTimeout(timer);
  if(res.ok){track("form_submit_success");
   var wrap=document.getElementById("formWrap");
   wrap.innerHTML='<div class="form-success" role="status" tabindex="-1" id="formSuccess">Thanks, we’ve got it. We’ll look at where leads are slipping through for you and follow up using the contact details you gave us.</div>';
   try{document.getElementById("formSuccess").focus();}catch(e){}
   return;}
  track("form_submit_error");done();
  var fields=res.j.fields||[];
  if(fields.length){var firstBad=null;fields.forEach(function(n){if(IDS[n]){var r=RULES.filter(function(x){return x[0]===n;})[0];setErr(n,IDS[n],r[2](val(n))||"Please check this field.");if(!firstBad)firstBad=f.elements[n];}});
   showError("Please check the highlighted fields and press Get Your Days Back again. Everything you typed is still here.");if(firstBad)firstBad.focus();return;}
  if(res.status===429){showError("We’ve received several messages from this connection in the last hour. Please wait a few minutes, then press Get Your Days Back again. Everything you typed is still here.");return;}
  showError("Your inquiry didn’t go through. Everything you typed is still here: please press Get Your Days Back again in a moment. If it keeps failing, use the chat button at the bottom of the page.");
 })
 .catch(function(){clearTimeout(timer);track("form_submit_error");done();
  showError("We couldn’t reach our server, so your inquiry wasn’t sent. Everything you typed is still here: please check your connection and press Get Your Days Back again.");});
});
})();
