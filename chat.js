/* Days Won Assistant — scripted answers about the Days Won Lead Recovery & Booking System + inquiry form + human follow-up.
   No AI: every answer below is fixed text. It never quotes prices, numbers, integrations, dates or bookings. */
(function(){
"use strict";
var API="https://dayswon-preview.sites.tab.bot/api/lead";
/* Live chat (tawk.to, free plan). Loaded only when a visitor asks for a person, so the page shows
   one chat bubble at a time: ours first, then tawk takes over (our launcher hides, tawk opens). */
var TAWK_SRC="https://embed.tawk.to/6ad218e0c724b834c3da83da/1k52b2bgm", LIVE_KEY="dw_live";
var LIVE={loading:false,loaded:false,pending:null,
 open:function(d){LIVE.pending=d||LIVE.pending;try{localStorage.setItem(LIVE_KEY,"1");}catch(e){}LIVE.load();},
 load:function(){
  if(LIVE.loaded){LIVE.apply();return;}
  if(LIVE.loading)return;LIVE.loading=true;
  window.Tawk_API=window.Tawk_API||{};window.Tawk_LoadStart=new Date();
  window.Tawk_API.onLoad=function(){LIVE.loaded=true;LIVE.apply();};
  window.Tawk_API.onChatEnded=function(){try{localStorage.removeItem(LIVE_KEY);}catch(e){}};
  var s=document.createElement("script");s.async=true;s.src=TAWK_SRC;s.charset="UTF-8";
  s.onerror=function(){LIVE.loading=false;LIVE.loaded=false;};
  document.head.appendChild(s);
 },
 apply:function(){
  var T=window.Tawk_API,d=LIVE.pending;LIVE.pending=null;
  try{document.documentElement.classList.add("nxc-live");}catch(e){}
  if(!T)return;
  try{if(typeof close==="function")close();}catch(e){}
  if(d){
   /* one attribute per call: tawk rejects the whole call if any value is invalid (e.g. an email it dislikes) */
   var attrs=[];if(d.name)attrs.push({name:d.name.slice(0,50)});if(d.email)attrs.push({email:d.email});if(d.phone)attrs.push({phone:d.phone});
   if(d.message)attrs.push({question:d.message.replace(/\s+/g," ").slice(0,250)});
   attrs.forEach(function(a){try{T.setAttributes(a,function(){});}catch(e){}});
   try{T.addTags(["website handoff"],function(){});}catch(e){}
   try{T.addEvent("talk-to-a-person",{name:d.name||"",email:d.email||"",phone:d.phone||"",question:(d.message||"").slice(0,500)},function(){});}catch(e){}
  }
  try{T.showWidget();}catch(e){}
  try{if(d)T.maximize();}catch(e){}
 }};
(function(){var on=false;try{on=localStorage.getItem(LIVE_KEY)==="1";}catch(e){}if(on){document.documentElement.classList.add("nxc-live");LIVE.load();}})();
var transcript=[], state={busy:false,started:false};
var LOGO='<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="clg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop stop-color="#a46bff"/><stop offset="1" stop-color="#4f8dff"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="16" fill="url(#clg)"/><path d="M18 15.5H31a16.5 16.5 0 0 1 0 33H18Z" fill="none" stroke="#fff" stroke-width="5.6" stroke-linejoin="round"/><path d="M25 32.3l5 5 9.6-10.4" fill="none" stroke="#fff" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var I={
 chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
 x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 send:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>'
};

var PROMPTS=["Missed calls and slow replies","Follow-ups that fall through","Booking and reminders"];
var NEXT=["Get Your Days Back","Talk to a person"];
var FORMLINE="Get Your Days Back";
var ASK="\n\nWhere do leads slip through for you today?";

/* ---------- knowledge (fixed answers only) ---------- */
var K=[
 {id:"missed",k:["missed call","missed calls","miss calls","missing calls","voicemail","phone","calls","call back","callback","slow","reply","replies","respond","response","answer","unanswered","inquiry","inquiries","enquir","leads","lead","after hours","busy","on a job","text","texts","messages","dm"],
  a:"That's exactly what the Days Won Lead Recovery & Booking System is for. When a new inquiry comes in, it gets a response right away, even when you're on a job or with a client. Then it follows up automatically and helps turn it into a booked appointment, estimate or callback."+ASK,
  c:NEXT.concat(["How it works"])},
 {id:"followup",k:["follow up","follow-up","followup","follow ups","follow-ups","chase","chasing","estimate","estimates","quote","quotes","proposal","go quiet","ghost","no reply","forgot","forget","fall through","slip"],
  a:"Follow-up is built in. If someone doesn't reply, the system follows up with them automatically, so opportunities don't go quiet just because your week got busy."+ASK,
  c:NEXT.concat(["How it works"])},
 {id:"booking",k:["book","booking","booked","schedul","appointment","appointments","calendar","reminder","reminders","confirm","confirmation","no-show","no show","no-shows"],
  a:"The system helps turn inquiries into booked appointments, estimates or callbacks, and sends confirmations and reminders.\n\nIt's not just a scheduling tool, though. It responds to new inquiries, follows up and keeps track of every opportunity, so more of them end up on your calendar.",
  c:NEXT.concat(["How it works"])},
 {id:"what",k:["what is days won","what is dayswon","what do you do","who are you","what does days won","what does dayswon","services","service","offer","help with","what can you","what is this"],
  a:"Days Won installs a done-for-you system that responds to leads, follows up automatically, and turns more opportunities into booked business, while giving you back hours of your week.\n\nYou run your business. We make sure opportunities don't slip away.",
  c:PROMPTS.concat(["How it works"])},
 {id:"process",k:["how it works","how does it work","process","steps","get started","start","begin","how do you work","onboard","set up","setup","install"],
  a:"Every new opportunity follows the same path:\n\n1. New inquiry\n2. Instant response\n3. Automatic follow-up\n4. Booked appointment\n\nIt's done for you: we set the system up for your business, so there's nothing for you to build or manage. To start, tell us where leads slip through today.",
  c:NEXT},
 {id:"price",k:["price","pricing","cost","costs","how much","budget","expensive","cheap","fee","fees","monthly","subscription","rate","rates","charge"],
  a:"Pricing depends on your business and what the system needs to cover, so I can't give you a number here.\n\nTell us a bit about your business and a person will talk it through with you.",
  c:NEXT},
 {id:"tools",k:["integrat","connect","quickbooks","jobber","housecall","servicetitan","google","gmail","outlook","calendly","crm","software","app ","apps","tool","tools","spreadsheet","excel","replace"],
  a:"I can't confirm here whether a specific tool can be connected. A person from Days Won can check that with you.",
  c:NEXT},
 {id:"ai",k:["ai","a.i","artificial","chatgpt","gpt","robot","bot","tech","technical","computer","automation","automate"],
  a:"You don't need to know anything about the technology. Days Won is done for you: you get the result, which is faster replies, consistent follow-ups and more booked business, without managing any software.",
  c:PROMPTS},
 {id:"control",k:["approve","approval","review","control","my voice","sound like","what does it say","what will it say","messages say","customize","customise"],
  a:"Good question for a person. Someone from Days Won can walk you through how the replies and follow-ups would work for your business.",
  c:NEXT},
 {id:"time",k:["how long","timeline","when can","when will","deadline","weeks","months","how soon","asap","quickly","launch date","ready by"],
  a:"I can't give a date here. Tell us about your business and a person will talk timing through with you.",
  c:NEXT},
 {id:"save",k:["save","saving","savings","hours","how much time","roi","worth it","guarantee","results","proof","case stud","testimonial","reviews","more customers"],
  a:"I can't promise specific numbers here. The goal is simple: every inquiry gets a fast response and consistent follow-up, so fewer opportunities slip away and you get hours of your week back.",
  c:NEXT},
 {id:"meet",k:["book a call","book a meeting","meeting","call me","schedule a call","demo","consultation","zoom","appointment with you"],
  a:"I can't book calls or meetings from here. Leave your details and a person will follow up with you to arrange a time.",
  c:NEXT},
 {id:"who",k:["plumb","hvac","electric","clean","landscap","roof","pest","handyman","contractor","consult","coach","therap","counsel","clinic","practice","salon","spa","dentist","chiro","agency","home service","trade","trades","who is it for","who do you work","small business","my business","industry","industries"],
  a:"Days Won is for service businesses: contractors, plumbers, HVAC companies, consultants, therapists and other appointment-based professionals.\n\nIf you lose opportunities when you're too busy to respond, follow up or keep track of every customer, the system is built for that."+ASK,
  c:PROMPTS},
 {id:"support",k:["support","maintain","maintenance","after launch","help after","update","updates","broken","bug"],
  a:"A person from Days Won can go through support with you. Leave your details and they'll follow up.",
  c:NEXT},
 {id:"other",k:["website","web site","mobile app","erp","inventory","warehouse","ecommerce","e-commerce","online store","dashboard","custom software"],
  a:"Days Won focuses on one thing: a done-for-you system that responds to leads, follows up, and helps you book more business. For anything else, leave your details and a person will let you know.",
  c:NEXT},
 {id:"privacy",k:["privacy","secure","security","data","confidential","nda","gdpr","safe"],
  a:"That's a good question for a person. Leave your details and someone from Days Won will go through it with you.",
  c:["Talk to a person"]},
 {id:"hello",k:["hi","hello","hey","good morning","good evening","shalom","yo"],
  a:"Hi! Days Won helps you stop losing business to missed inquiries and forgotten follow-ups."+ASK,c:PROMPTS},
 {id:"thanks",k:["thanks","thank you","thx","great","perfect","awesome","appreciate"],
  a:"You're welcome. Anything else I can help with?",c:NEXT}
];

function norm(s){return " "+String(s||"").toLowerCase().replace(/[^\w\s.&'-]/g," ").replace(/\s+/g," ")+" ";}
function has(t,w){w=w.toLowerCase();return w.length<=3?(t.indexOf(" "+w.trim()+" ")>-1):t.indexOf(w)>-1;}
function match(text){
 var t=norm(text);
 if(/talk to (a|an|some)|speak (to|with)|real person|human|representative|live (agent|person|chat)|someone/.test(t))return {id:"human"};
 if(/inquiry|enquiry|form|sign up|hire you|work with you/.test(t))return {id:"form"};
 if(/\b(can|could|will) you (book|schedule|set up|arrange)\b|\bbook (me|us|a|an)\b|\b(meeting|demo|consultation)\b|call me/.test(t))return K.filter(function(x){return x.id==="book";})[0];
 var best=null,score=0;
 K.forEach(function(e){var s=0;e.k.forEach(function(w){if(has(t,w))s+=w.length>4?2:1;});if(s>score){score=s;best=e;}});
 return score?best:null;
}

/* ---------- DOM ---------- */
function el(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
var root=el("div","nxc");
var launch=el("button","nxc-launch",I.chat+'<span class="nxc-dot"></span><span class="nxc-ltxt">Chat with us</span>');
launch.type="button";launch.setAttribute("aria-label","Open Days Won Assistant chat");
var panel=el("section","nxc-panel");panel.setAttribute("role","dialog");panel.setAttribute("aria-label","Days Won Assistant");
panel.innerHTML='<header class="nxc-head"><div class="nxc-av">'+LOGO+'</div><div class="nxc-title"><b>Days Won Assistant</b><span>Automated answers · a person follows up</span></div><button class="nxc-x" type="button" aria-label="Close chat">'+I.x+'</button></header><div class="nxc-body" aria-live="polite"></div><footer class="nxc-foot"><form class="nxc-input"><textarea rows="1" placeholder="Type your question…" aria-label="Your message" maxlength="1000"></textarea><button class="nxc-send" type="submit" aria-label="Send">'+I.send+'</button></form><div class="nxc-meta"><span>Days Won · More Customers. Less Chasing.</span><button type="button" class="nxc-person">Talk to a person</button></div></footer>';
root.appendChild(launch);root.appendChild(panel);
document.body.appendChild(root);
var body=panel.querySelector(".nxc-body"),ta=panel.querySelector("textarea"),inForm=panel.querySelector(".nxc-input");

function scroll(){body.scrollTop=body.scrollHeight;}
function add(who,text){var m=el("div","nxc-msg "+(who==="me"?"nxc-me":"nxc-bot"));m.textContent=text;body.appendChild(m);transcript.push((who==="me"?"Visitor: ":"Assistant: ")+text);scroll();return m;}
function chips(list){var c=el("div","nxc-chips");list.forEach(function(l){var b=el("button","nxc-chip"+(l==="Talk to a person"?" nxc-human":""));b.type="button";b.textContent=l;b.onclick=function(){c.remove();user(l);};c.appendChild(b);});body.appendChild(c);scroll();}
function clearChips(){[].slice.call(body.querySelectorAll(".nxc-chips")).forEach(function(c){c.remove();});}
function bot(text,ch,delay){state.busy=true;var t=el("div","nxc-msg nxc-bot nxc-typing","<i></i><i></i><i></i>");body.appendChild(t);scroll();
 setTimeout(function(){t.remove();add("bot",text);if(ch)chips(ch);state.busy=false;},delay==null?Math.min(1100,350+text.length*3):delay);}

function user(text){clearChips();add("me",text);route(text);}
var ALIAS={"Missed calls and slow replies":"missed","Follow-ups that fall through":"followup","Booking and reminders":"booking","How it works":"process"};
var misses=0,lastTask="",said=[];
/* Chat-to-inquiry: close the chat and carry what the visitor typed into "Where do leads slip through today?". */
function toInquiry(){
 try{if(window.DaysWonTrack)window.DaysWonTrack("chat_to_inquiry");}catch(e){}
 var msg=document.getElementById("f-msg");
 if(msg&&!msg.value&&said.length)msg.value=said.join("\n").slice(0,1000);
 add("bot","Taking you to the form now.");
 setTimeout(function(){close(true);var c=document.getElementById("contact");if(c)c.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  setTimeout(function(){var n=document.getElementById("f-name");if(n)try{n.focus({preventScroll:true});}catch(e){}},500);},400);
}
function route(text){
 if(text===FORMLINE)return toInquiry();
 if(text==="Talk to a person")return setTimeout(function(){showForm(text);},300);
 var isChip=!!ALIAS[text];
 var e=isChip?K.filter(function(x){return x.id===ALIAS[text];})[0]:match(text);
 if(!isChip&&PROMPTS.indexOf(text)<0)said.push(text);
 if(e&&e.id==="human")return setTimeout(function(){showForm();},300);
 if(e&&e.id==="form")return toInquiry();
 if(e){misses=0;if(e.task)lastTask=e.task;return bot(e.a,e.c);}
 misses++;
 bot(misses>1?"That's a good one for a person at Days Won. Leave your details and they'll follow up with you.":"I can only answer a few common questions here. Pick a topic below, use the form to get your days back, or talk to a person.",
   misses>1?null:PROMPTS.concat(NEXT));
 if(misses>1)setTimeout(function(){showForm(null,text);},1300);
}

/* ---------- talk to a person (saved as a lead, then live chat opens) ---------- */
function field(label,name,type,req,extra){return '<label>'+label+(req?' *':'')+(type==="textarea"?'<textarea name="'+name+'" '+(req?'required ':'')+(extra||'')+'></textarea>':'<input name="'+name+'" type="'+type+'" '+(req?'required ':'')+(extra||'')+'>')+'</label>';}
function showForm(_x,question){
 clearChips();
 add("bot","Sure. A person from Days Won will take it from here. Share how to reach you and where leads slip through for you.");
 var f=el("form","nxc-form");f.noValidate=true;
 f.innerHTML='<h4>Talk to a person</h4>'+
  field("Name","name","text",true,'autocomplete="name" maxlength="120"')+
  '<div class="nxc-row">'+field("Email","email","email",false,'autocomplete="email" maxlength="200"')+field("Phone","phone","tel",false,'autocomplete="tel" maxlength="40"')+'</div><p>Email or phone, whichever you prefer.</p>'+
  field("Where do leads slip through today?","message","textarea",true,'maxlength="4000" placeholder="For example: I miss calls while I\'m on jobs"')+
  '<input class="nxc-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">'+
  '<div class="nxc-err" role="alert"></div><button class="nxc-btn" type="submit">Send to Days Won</button>'+
  '<p>Prefer the full form? <a href="#contact" class="nxc-tofrm" style="color:#c9d0ff;text-decoration:underline">Get Your Days Back</a></p>';
 var q=question||said.join("\n");if(q)f.querySelector('[name=message]').value=q.slice(0,1000);
 f.querySelector(".nxc-tofrm").onclick=function(ev){ev.preventDefault();f.remove();toInquiry();};
 f.onsubmit=function(ev){ev.preventDefault();submit(f);};
 body.appendChild(f);scroll();
 setTimeout(function(){var n=f.querySelector("[name=name]");if(window.innerWidth>520)n.focus();},50);
}
function submit(f){
 if(f.dataset.sending==="1")return;
 var d={};[].slice.call(f.elements).forEach(function(x){if(x.name)d[x.name]=x.value.trim();});
 var err=f.querySelector(".nxc-err");err.textContent="";
 var emailOk=!d.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email);
 if(!d.name)return err.textContent="Please add your name.";
 if(!d.email&&!d.phone)return err.textContent="Please add an email or phone number so we can reach you.";
 if(!emailOk)return err.textContent="That email doesn't look right. Please check it.";
 if(!d.message||d.message.length<2)return err.textContent="Please tell us where leads slip through for you.";
 var btn=f.querySelector(".nxc-btn");btn.disabled=true;btn.textContent="Sending…";f.dataset.sending="1";
 d.type="handoff";d.transcript=transcript.join("\n").slice(-6000);d.page=location.href;
 send(d).then(function(ok){
  f.dataset.sending="";
  if(ok){f.remove();var first=d.name.split(" ")[0];
   add("bot","Thanks, "+first+". Your message has been received. Opening live chat now: if someone is available you can talk right here. Otherwise a person will follow up using the contact details you gave.");
   if(typeof LIVE.open==="function"){try{LIVE.open(d);}catch(e){}}
  }else{btn.disabled=false;btn.textContent="Try again";
   err.textContent="That didn't go through. Your details are still here: please press Try again in a moment, or use the form on this page.";}
 });
}
function send(d){
 if(!window.fetch)return Promise.resolve(false);
 return fetch(API,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(d)})
  .then(function(r){return r.json().then(function(j){return !!(r.ok&&j.ok);});}).catch(function(){return false;});
}
window.DaysWonLead={send:send};

/* ---------- open / close ---------- */
function open(){document.documentElement.classList.add("nxc-open");root.classList.add("on");
 if(!state.started){state.started=true;
  bot("Hi! Days Won helps you stop losing business to missed inquiries and forgotten follow-ups. Where do leads slip through for you?",PROMPTS,500);}
 if(window.innerWidth>520)setTimeout(function(){ta.focus();},250);
 try{if(window.innerWidth<=520)document.body.style.overflow="hidden";}catch(e){}}
function close(noFocus){document.documentElement.classList.remove("nxc-open");document.body.style.overflow="";if(noFocus!==true)launch.focus();}
launch.onclick=open;panel.querySelector(".nxc-x").onclick=close;
panel.querySelector(".nxc-person").onclick=function(){if(!state.busy)showForm();};
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&document.documentElement.classList.contains("nxc-open"))close();});
inForm.onsubmit=function(e){e.preventDefault();var v=ta.value.trim();if(!v)return;ta.value="";ta.style.height="";user(v);};
ta.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();inForm.requestSubmit?inForm.requestSubmit():inForm.onsubmit(e);}});
ta.addEventListener("input",function(){ta.style.height="auto";ta.style.height=Math.min(110,ta.scrollHeight)+"px";});
[].slice.call(document.querySelectorAll('[data-chat]')).forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();open();});});
if(/[?&#]chat\b/.test(location.search+location.hash))open();
})();
