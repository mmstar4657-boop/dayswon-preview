/* DaysWon Busywork Calculator. Plain, deterministic JavaScript: no AI, no third-party trackers.
   Every number on the results screen comes from the visitor's own answers (hours chips -> fixed
   midpoints, hourly value chip) and the fixed RECOVERY_TABLE below, so each figure can be checked by hand.
   Works standalone (/time-audit/), embedded (<div id="app" data-embed="1">) and inside an iframe. */
(function(){
"use strict";

/* Booking: leave empty to use the callback form. Paste a calendar link (Calendly, Cal.com...) to switch
   the "Book My Free Time Audit" button to that link instead. Nothing else needs to change. */
var BOOKING_URL = "";

var VERSION = "20261026v4";
var STORE_KEY = "dw_busywork_v1";
var LEAD_API = "https://dayswon.sites.tab.bot/api/lead";
var WEEKS_PER_YEAR = 52;
var TOTAL_STEPS = 6;

/* Hours chips and the midpoint each one counts as in the math. */
var HOUR_BUCKETS = [
  { v: "u2", l: "Under 2", mid: 1 },
  { v: "2-5", l: "2–5", mid: 3.5 },
  { v: "5-10", l: "5–10", mid: 7.5 },
  { v: "10-20", l: "10–20", mid: 15 },
  { v: "20p", l: "20+", mid: 25 }
];
var RATES = [ { v: 50, l: "$50" }, { v: 100, l: "$100" }, { v: 150, l: "$150" }, { v: 250, l: "$250+" } ];

/* Conservative share of each task's weekly hours that could be won back,
   as [low, high], by how the task is done today. "partial" is exactly half of "manual".
   Rounding: low and high are each rounded to whole hours. If both round to the same value,
   the range is shown as that value to the next whole hour (e.g. 1-2), or as "under 1 hr/wk"
   when the high end is below half an hour. Totals add the rounded per-task ranges. */
var RECOVERY_TABLE = {
  manual:    { followups: [0.40, 0.60], scheduling: [0.40, 0.60], paperwork: [0.30, 0.50], systems: [0.25, 0.40] },
  partial:   { followups: [0.20, 0.30], scheduling: [0.20, 0.30], paperwork: [0.15, 0.25], systems: [0.125, 0.20] },
  automated: { followups: [0.00, 0.10], scheduling: [0.00, 0.10], paperwork: [0.00, 0.10], systems: [0.00, 0.10] }
};
var BUSINESS = [
  { v: "field", l: "Field services", d: "Trades, home services, cleaning, landscaping" },
  { v: "realestate", l: "Real estate or lending", d: "Agents, brokers, mortgage and loan officers" },
  { v: "retail", l: "Retail or distribution", d: "Stores, wholesale, e-commerce" },
  { v: "professional", l: "Professional services", d: "Accounting, legal, consulting, agencies" },
  { v: "other", l: "Something else", d: "We'll keep the questions general" }
];
/* The four underlying categories never change (they key the fixed RECOVERY_TABLE).
   Only the wording shown to the visitor is tailored to their industry. */
var CATS = ["followups", "scheduling", "paperwork", "systems"];
var CAT_NAME = { followups: "Follow-ups", scheduling: "Scheduling", paperwork: "Paperwork and invoices", systems: "Disconnected systems" };
var TASKS_BY = {
  other: {
    followups: { l: "Customer follow-ups", s: "customer follow-ups", d: "Replying to leads, chasing quotes, checking in" },
    scheduling: { l: "Scheduling", s: "scheduling", d: "Booking, rescheduling, reminders" },
    paperwork: { l: "Invoices and paperwork", s: "invoices and paperwork", d: "Billing, forms, data entry" },
    systems: { l: "Disconnected systems", s: "work across disconnected systems", d: "Copying information between apps and spreadsheets" }
  },
  field: {
    followups: { l: "Following up on leads", s: "lead follow-ups", d: "Calling back new inquiries, chasing quotes you've sent" },
    scheduling: { l: "Dispatch and job scheduling", s: "dispatch and job scheduling", d: "Booking jobs, assigning crews, reschedules, reminders" },
    paperwork: { l: "Quotes, invoices and chasing payments", s: "quotes, invoices and payment chasing", d: "Writing estimates, invoicing after the job, chasing unpaid bills" },
    systems: { l: "Re-entering job details", s: "re-entering job details between apps", d: "Copying job info from calls and texts into your software and books" }
  },
  realestate: {
    followups: { l: "Lead follow-up", s: "lead follow-up", d: "Answering new inquiries, nurturing past clients and referrals" },
    scheduling: { l: "Showings and appointments", s: "showing and appointment scheduling", d: "Booking showings, calls and closings, confirming, rescheduling" },
    paperwork: { l: "Document collection", s: "document collection", d: "Chasing pay stubs, disclosures, signatures and missing files" },
    systems: { l: "CRM updates", s: "CRM updates", d: "Logging notes and moving deals through your CRM by hand" }
  },
  retail: {
    followups: { l: "Customer follow-ups", s: "customer follow-ups", d: "Order status questions, reorders, reviews, win-backs" },
    scheduling: { l: "Deliveries, pickups and shifts", s: "delivery, pickup and shift scheduling", d: "Coordinating drivers, pickups and the staff schedule" },
    paperwork: { l: "Orders and invoicing", s: "orders and invoicing", d: "Entering orders, sending invoices, matching payments" },
    systems: { l: "Inventory counts", s: "inventory counts and stock updates", d: "Counting stock and updating it across store, site and sheets" }
  },
  professional: {
    followups: { l: "Client intake and follow-ups", s: "client intake and follow-ups", d: "Answering inquiries, sending intake forms, chasing replies" },
    scheduling: { l: "Scheduling", s: "scheduling", d: "Booking meetings, reschedules, reminders" },
    paperwork: { l: "Billing", s: "billing", d: "Time entries, invoices, chasing payments" },
    systems: { l: "Reporting", s: "reporting", d: "Pulling numbers from different apps into reports" }
  }
};
var FIXES_BY = {
  other: {
    followups: { t: "Lead response and reminders", d: "Instant replies to new inquiries, automatic follow-ups on quotes, and reminders so no lead goes cold." },
    scheduling: { t: "Booking and confirmations", d: "Customers book and reschedule online, with automatic confirmations and reminders that cut no-shows." },
    paperwork: { t: "Invoice and data-entry workflow", d: "Invoices and records created from work you've already logged, so nothing gets typed twice." },
    systems: { t: "Connected operations", d: "Your apps share information automatically, so the whole business works from one up-to-date picture." }
  },
  field: {
    followups: { t: "Instant lead replies and quote follow-ups", d: "Every new call, form or text gets an answer in minutes, and open quotes get automatic follow-ups until the customer says yes or no." },
    scheduling: { t: "Online booking with automatic job reminders", d: "Customers pick a slot, the job lands on the right crew's calendar, and confirmations and \u201con our way\u201d texts go out on their own." },
    paperwork: { t: "Estimate-to-invoice in one step", d: "An approved estimate becomes the invoice when the job is done, with a payment link and automatic reminders for late payers." },
    systems: { t: "One job record across your tools", d: "Job details entered once flow into scheduling, invoicing and your books, so nobody retypes addresses and line items." }
  },
  realestate: {
    followups: { t: "Speed-to-lead follow-up", d: "New inquiries get a reply within minutes, then a text and email follow-up sequence, so no lead sits overnight." },
    scheduling: { t: "Self-serve showing and appointment booking", d: "Clients book showings and calls from your real availability, with confirmations and reminders that cut no-shows." },
    paperwork: { t: "Automated document collection", d: "A checklist that requests each document, reminds the client until it arrives, and tells you the moment a file is complete." },
    systems: { t: "CRM that updates itself", d: "Calls, emails and form fills log to the right contact and deal stage automatically, so your pipeline stays current." }
  },
  retail: {
    followups: { t: "Order updates and reorder reminders", d: "Customers get status updates without calling, and repeat buyers get a nudge when it's time to reorder." },
    scheduling: { t: "Delivery and pickup scheduling", d: "Customers choose a slot, drivers and staff see the day's plan, and confirmations go out automatically." },
    paperwork: { t: "Orders to invoices without retyping", d: "Orders flow straight into invoices and your accounting, and incoming payments get matched for you." },
    systems: { t: "Live inventory in one place", d: "Stock levels sync across your store, website and spreadsheets, with low-stock alerts instead of manual counts." }
  },
  professional: {
    followups: { t: "Client intake on autopilot", d: "Inquiries get an instant reply with your intake form, and missing answers are chased before the first meeting." },
    scheduling: { t: "Booking links with reminders", d: "Clients book from your real calendar, with confirmations, reminders and easy rescheduling." },
    paperwork: { t: "Billing from your time entries", d: "Invoices built from logged time, sent on schedule, with payment links and polite automatic reminders." },
    systems: { t: "Reports that build themselves", d: "Numbers pulled from your apps into a ready-to-send report, on whatever schedule you need." }
  }
};

/* Tools: tap chips. cats = which fixes a tool plugs into; n = how a fix names it; r = order when named. */
var COMMON_TOOLS = [
  { g: "Email and messages", items: [
    { v: "gmail", l: "Gmail", n: "Gmail", cats: ["followups", "scheduling", "paperwork"], r: 6 },
    { v: "outlook", l: "Outlook", n: "Outlook", cats: ["followups", "scheduling", "paperwork"], r: 6 },
    { v: "text", l: "Text or WhatsApp", n: "texts", cats: ["followups", "scheduling"], r: 7 } ] },
  { g: "Calendar", items: [
    { v: "gcal", l: "Google Calendar", n: "Google Calendar", cats: ["scheduling"], r: 4 },
    { v: "calendly", l: "Calendly", n: "Calendly", cats: ["scheduling"], r: 4 } ] },
  { g: "Money and records", items: [
    { v: "quickbooks", l: "QuickBooks", n: "QuickBooks", cats: ["paperwork", "systems"], r: 2 },
    { v: "xero", l: "Xero", n: "Xero", cats: ["paperwork", "systems"], r: 2 },
    { v: "excel", l: "Excel", n: "Excel", cats: ["paperwork", "systems"], r: 3 },
    { v: "gsheets", l: "Google Sheets", n: "Google Sheets", cats: ["paperwork", "systems"], r: 3 },
    { v: "paper", l: "Paper or whiteboard", n: "", paper: true, cats: ["paperwork", "scheduling", "systems"], r: 9 } ] },
  { g: "CRM", items: [
    { v: "hubspot", l: "HubSpot", n: "HubSpot", cats: ["followups", "systems"], r: 1 },
    { v: "salesforce", l: "Salesforce", n: "Salesforce", cats: ["followups", "systems"], r: 1 },
    { v: "crm", l: "Another CRM", n: "CRM", cats: ["followups", "systems"], r: 1 } ] }
];
var INDUSTRY_TOOLS = {
  field: [ { v: "jobber", l: "Jobber", n: "Jobber", cats: CATS, r: 0 }, { v: "servicetitan", l: "ServiceTitan", n: "ServiceTitan", cats: CATS, r: 0 }, { v: "housecall", l: "Housecall Pro", n: "Housecall Pro", cats: CATS, r: 0 } ],
  realestate: [ { v: "fub", l: "Follow Up Boss", n: "Follow Up Boss", cats: ["followups", "scheduling", "systems"], r: 0 }, { v: "kvcore", l: "kvCORE", n: "kvCORE", cats: ["followups", "scheduling", "systems"], r: 0 }, { v: "encompass", l: "Encompass", n: "Encompass", cats: ["paperwork", "systems"], r: 0 } ],
  retail: [ { v: "shopify", l: "Shopify", n: "Shopify", cats: ["followups", "paperwork", "systems"], r: 0 }, { v: "square", l: "Square", n: "Square", cats: ["scheduling", "paperwork", "systems"], r: 0 }, { v: "netsuite", l: "NetSuite", n: "NetSuite", cats: ["paperwork", "systems"], r: 0 } ],
  professional: [ { v: "clio", l: "Clio", n: "Clio", cats: CATS, r: 0 }, { v: "karbon", l: "Karbon", n: "Karbon", cats: ["followups", "paperwork", "systems"], r: 0 }, { v: "taxdome", l: "TaxDome", n: "TaxDome", cats: ["followups", "paperwork", "systems"], r: 0 } ]
};
var NONE_TOOL = { v: "none", l: "Nothing / mostly manual", cats: [] };
var METHODS = [
  { v: "manual", l: "By hand" },
  { v: "partial", l: "Partly with a tool" },
  { v: "automated", l: "Mostly automated" }
];
var GOALS = [
  { v: "customers", l: "More time with customers", put: "you could spend with your customers instead" },
  { v: "growth", l: "More time to grow the business", put: "you could put back into growing the business" },
  { v: "admin", l: "Less admin", put: "of admin you could take off your plate" },
  { v: "personal", l: "More personal time", put: "you could get back for yourself" }
];
var SCOPES = [ { v: "owner", l: "Just me (the owner)" }, { v: "team", l: "My whole team" } ];
var BEST_TIMES = ["Morning (9-12)", "Midday (12-2)", "Afternoon (2-5)", "Evening (5-7)", "Any time"];

function biz() { return TASKS_BY[S.business] ? S.business : "other"; }
function taskInfo(t) { var o = TASKS_BY[biz()][t]; return { v: t, l: o.l, s: o.s, d: o.d }; }
function fixFor(t) { return FIXES_BY[biz()][t]; }
function toolGroups() {
  var g = COMMON_TOOLS.slice();
  if (INDUSTRY_TOOLS[biz()]) g = [{ g: "Your industry software", items: INDUSTRY_TOOLS[biz()] }].concat(g);
  return g.concat([{ g: "", items: [NONE_TOOL] }]);
}
function allTools() { var o = []; toolGroups().forEach(function (g) { o = o.concat(g.items); }); return o; }
function pickedTools() { var all = allTools(); return S.tools.map(function (v) { return byV(all, v); }).filter(Boolean); }

function track(ev, data) { if (window.track) window.track(ev, data); else try { console.log("[track]", ev, data || {}); } catch (e) {} }
function byV(list, v) { for (var i = 0; i < list.length; i++) if (list[i].v === v) return list[i]; return null; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function fmt(n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10); }
function num(n) { return n.toLocaleString("en-US"); }
function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
function andList(a) { return a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

/* ---------- state ---------- */
function fresh() {
  return { step: 0, business: "", tasks: [], hours: {}, scope: "", method: {}, rate: 0, tools: [], toolsOther: "", goal: "",
           auditId: "", startedAt: "", completedAt: "", lead: null, maxStep: 0 };
}
var S = load();
function load() {
  try { var raw = sessionStorage.getItem(STORE_KEY); if (raw) { var o = JSON.parse(raw); var f = fresh(); for (var k in f) if (!(k in o)) o[k] = f[k]; return o; } } catch (e) {}
  return fresh();
}
function save() { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {} }
function newId() { return "BC-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }

/* ---------- calculations ---------- */
function bucketFor(t) { return byV(HOUR_BUCKETS, S.hours[t]); }
function hoursFor(t) { var b = bucketFor(t); return b ? b.mid : null; }   /* null = "I'm not sure" or unanswered */
function reported() {
  var total = 0, known = 0, unsure = [];
  S.tasks.forEach(function (t) { var h = hoursFor(t); if (h === null) unsure.push(t); else { total += h; known++; } });
  total = Math.round(total * 10) / 10;
  var yearly = Math.round(total * WEEKS_PER_YEAR * 10) / 10;
  return { weekly: total, yearly: yearly, known: known, unsure: unsure, rate: S.rate || 0, cost: Math.round(total * (S.rate || 0) * WEEKS_PER_YEAR) };
}
function estimateTask(t) {
  var h = hoursFor(t), m = S.method[t];
  if (h === null) return { task: t, skipped: "hours" };
  if (!m || !RECOVERY_TABLE[m]) return { task: t, skipped: "method" };
  var share = RECOVERY_TABLE[m][t];
  var loRaw = h * share[0], hiRaw = h * share[1];
  var lo = Math.round(loRaw), hi = Math.round(hiRaw), under1 = false;
  if (hi <= lo) { if (hiRaw < 0.5) { lo = 0; hi = 1; under1 = true; } else { hi = lo + 1; } }
  return { task: t, hours: h, method: m, share: share, loRaw: loRaw, hiRaw: hiRaw, lo: lo, hi: hi, under1: under1 };
}
function estimate() {
  var rows = S.tasks.map(estimateTask), lo = 0, hi = 0, n = 0;
  rows.forEach(function (r) { if (!r.skipped) { lo += r.lo; hi += r.hi; n++; } });
  return { rows: rows, lo: lo, hi: hi, count: n };
}
function rangeText(r) { return r.under1 ? "under 1 hr/wk" : r.lo + "–" + r.hi + " hrs/wk"; }
function winBackText(est) { return est.lo === 0 ? "up to " + est.hi + " hour" + (est.hi === 1 ? "" : "s") : est.lo + "–" + est.hi + " hours"; }
function pct(x) { return fmt(Math.round(x * 1000) / 10) + "%"; }
/* Fixes: only for tasks they picked, biggest win-back first, at most 3. No filler. */
function opportunities(est) {
  var order = S.tasks.slice();
  var score = {}; est.rows.forEach(function (r) { score[r.task] = r.skipped ? -1 : r.hiRaw; });
  order.sort(function (a, b) { return (score[b] - score[a]) || ((hoursFor(b) || 0) - (hoursFor(a) || 0)) || (S.tasks.indexOf(a) - S.tasks.indexOf(b)); });
  return order.slice(0, 3).map(function (t) { return { task: t }; });
}
/* One sentence per fix that names only tools the visitor picked. */
function toolLine(task, n) {
  var picked = pickedTools();
  if (picked.some(function (o) { return o.v === "none"; })) return "You said it's mostly manual today, so Fix #" + n + " starts from scratch, with nothing to migrate.";
  var rel = picked.filter(function (o) { return o.cats.indexOf(task) > -1; });
  var paper = rel.some(function (o) { return o.paper; });
  var names = rel.filter(function (o) { return !o.paper; }).sort(function (a, b) { return a.r - b.r; }).slice(0, 3).map(function (o) { return o.n; });
  if (!names.length && !paper) return "";
  var verb = names.length === 0 ? "gets this off paper and the whiteboard" :
    (names.length === 1 ? "plugs into your " + names[0] : "connects your " + andList(names)) + (paper ? " and gets the paper out of the loop" : "");
  var end = { followups: ", so every new lead gets a fast reply and follow-ups go out on their own.",
              scheduling: ", so bookings, confirmations and reminders happen without the back-and-forth.",
              paperwork: ", so nothing gets retyped.",
              systems: ", so information moves on its own instead of being copied by hand." }[task];
  return "Fix #" + n + " " + verb + end;
}
function workWeeks(yearly) { return Math.round(yearly / 40); }
window.DaysWonAudit = { RECOVERY_TABLE: RECOVERY_TABLE, HOUR_BUCKETS: HOUR_BUCKETS, BOOKING_URL: BOOKING_URL, _state: function () { return S; }, _estimate: estimate, _estimateTask: estimateTask, _reported: reported, _workWeeks: workWeeks, _taskInfo: taskInfo, _fixFor: fixFor, _toolLine: toolLine, _opportunities: function () { return opportunities(estimate()); } };

/* ---------- page modes ---------- */
var app = document.getElementById("app");
if (!app) return;
/* Embed mode (used on /offer/): <div id="app" data-embed="1" data-share-url="../time-audit/">. */
var EMBED = !!app.getAttribute("data-embed");
var SHARE_URL = app.getAttribute("data-share-url") || "./";
var FRAMED = false; try { FRAMED = window.self !== window.top; } catch (e) { FRAMED = true; }
if (FRAMED && !EMBED) document.documentElement.className += " dw-framed";
/* Load the calculator's own stylesheet next to this script, so embeds get it too. */
(function () {
  if (document.querySelector("link[data-dw-audit-css]")) return;
  var me = document.currentScript || document.querySelector("script[src*='audit.js']");
  if (!me || !me.src) return;
  var l = document.createElement("link"); l.rel = "stylesheet"; l.setAttribute("data-dw-audit-css", "1");
  l.href = me.src.replace(/audit\.js(\?.*)?$/, "audit.css?v=" + VERSION);
  document.head.appendChild(l);
})();
/* In an iframe: tell the parent page our height (message {type:"dayswon-audit:height", height}). */
function postHeight() {
  if (!FRAMED) return;
  try { window.parent.postMessage({ type: "dayswon-audit:height", height: Math.ceil(document.documentElement.scrollHeight) }, "*"); } catch (e) {}
}
if (FRAMED) {
  window.addEventListener("load", postHeight); window.addEventListener("resize", postHeight);
  if (window.ResizeObserver) try { new ResizeObserver(postHeight).observe(document.body); } catch (e) {}
}

/* ---------- rendering helpers ---------- */
function progress(n) {
  var p = Math.round(n / TOTAL_STEPS * 100);
  return '<div class="prog"><div class="prog-top"><span>Step ' + n + ' of ' + TOTAL_STEPS + '</span><span>' + p + '%</span></div>' +
    '<div class="bar" role="progressbar" aria-label="Calculator progress" aria-valuemin="0" aria-valuemax="' + TOTAL_STEPS + '" aria-valuenow="' + n + '" aria-valuetext="Step ' + n + ' of ' + TOTAL_STEPS + '"><i style="width:' + p + '%"></i></div></div>';
}
function radio(name, o, checked) {
  return '<label class="opt"><input type="radio" name="' + name + '" value="' + o.v + '"' + (checked ? " checked" : "") + '><span><span>' + esc(o.l) + (o.d ? '<small>' + esc(o.d) + '</small>' : '') + '</span></span></label>';
}
function check(name, o, checked) {
  return '<label class="opt"><input type="checkbox" name="' + name + '" value="' + o.v + '"' + (checked ? " checked" : "") + '><span><span>' + esc(o.l) + (o.d ? '<small>' + esc(o.d) + '</small>' : '') + '</span></span></label>';
}
function chip(type, name, v, label, checked, extra) {
  return '<label class="chip"><input type="' + type + '" name="' + name + '" value="' + esc(v) + '"' + (checked ? " checked" : "") + (extra || "") + '><span>' + esc(label) + '</span></label>';
}
function stepShell(n, q, help, inner) {
  return progress(n) + '<form id="stepForm" class="step-anim" novalidate>' +
    '<fieldset><legend><h1 class="q" id="qh" tabindex="-1">' + q + '</h1></legend>' + (help ? '<p class="q-help">' + help + '</p>' : '') + inner + '</fieldset>' +
    '<p class="err" id="err" role="alert"></p>' +
    '<div class="nav-btns"><button type="button" class="btn ghost" id="back">Back</button><button type="submit" class="btn next">' + (n === TOTAL_STEPS ? "See my number" : "Next") + '</button></div></form>';
}

function render(focus) {
  var h = "";
  if (S.step === 0) h = intro();
  else if (S.step === 1) h = stepShell(1, "What kind of business do you run?", "", '<div class="opts">' + BUSINESS.map(function (o) { return radio("business", o, S.business === o.v); }).join("") + '</div>');
  else if (S.step === 2) h = stepShell(2, "Where does your time disappear?", "Pick all that apply. Tailored to " + esc(byV(BUSINESS, S.business).l.toLowerCase()) + ".", '<div class="opts">' + CATS.map(function (c) { var o = taskInfo(c); return check("tasks", o, S.tasks.indexOf(o.v) > -1); }).join("") + '</div>');
  else if (S.step === 3) h = stepHours();
  else if (S.step === 4) h = stepRate();
  else if (S.step === 5) h = stepTools();
  else if (S.step === 6) h = stepShell(6, "What would you most like to get back?", "", '<div class="opts">' + GOALS.map(function (o) { return radio("goal", o, S.goal === o.v); }).join("") + '</div>');
  else h = results();
  if (EMBED) h = h.replace(/<h1 /g, "<h2 ").replace(/<\/h1>/g, "</h2>"); /* one h1 per page when embedded */
  app.innerHTML = h;
  bind();
  if (S.step === TOTAL_STEPS + 1) {
    var rep = reported();
    if (rep.known && rep.rate) countUp(document.querySelector("[data-cost]"), rep.cost, "$");
  }
  if (focus !== false) {
    var t = document.getElementById("qh");
    if (t) { t.focus({ preventScroll: true }); }
    if (EMBED) { var shell = app.parentNode || app; window.scrollTo(0, Math.max(0, shell.getBoundingClientRect().top + (window.pageYOffset || 0) - 84)); }
    else window.scrollTo(0, 0);
    if (FRAMED) try { var fe = window.frameElement; if (fe && fe.getBoundingClientRect().top < 0) fe.scrollIntoView({ block: "start" }); } catch (e) {}
  }
  postHeight();
}

function intro() {
  var resume = S.maxStep > 0 && S.step === 0;
  return '<div class="intro-card step-anim"><span class="eyebrow">DaysWon Busywork Calculator</span>' +
    '<h1 class="q" id="qh" tabindex="-1">Find out what busywork is really costing you.</h1>' +
    '<p class="intro-sub">2 minutes. Your number, your fixes, no email required.</p>' +
    '<div class="actions">' + (resume ? '<button class="btn" id="resume" type="button">Continue where you left off</button><button class="btn ghost" id="restart" type="button">Start over</button>'
      : '<button class="btn" id="start" type="button">Find my number</button>') + '</div></div>';
}

function stepHours() {
  var cards = S.tasks.map(function (t) {
    var o = taskInfo(t), cur = S.hours[t] || "", ns = cur === "ns";
    var hrs = HOUR_BUCKETS.map(function (b) { return chip("radio", "h_" + t, b.v, b.l, cur === b.v); }).join("") + chip("radio", "h_" + t, "ns", "I'm not sure", ns);
    var meth = METHODS.map(function (m) { return chip("radio", "m_" + t, m.v, m.l, S.method[t] === m.v); }).join("");
    return '<div class="tcard" id="card_' + t + '" role="group" aria-labelledby="tt_' + t + '"><p class="tcard-t" id="tt_' + t + '">' + esc(o.l) + '</p>' +
      '<p class="chip-l" id="hl_' + t + '">Hours a week</p><div class="chips hrs" role="radiogroup" aria-labelledby="tt_' + t + ' hl_' + t + '">' + hrs + '</div>' +
      '<p class="chip-l" id="ml_' + t + '">How it\'s done today' + (ns ? ' <span class="opt-l">(optional)</span>' : '') + '</p><div class="chips meth" role="radiogroup" aria-labelledby="tt_' + t + ' ml_' + t + '">' + meth + '</div></div>';
  }).join("");
  var seg = '<p class="sublabel" id="scope-l">Whose time are you counting?</p><div class="seg" role="radiogroup" aria-labelledby="scope-l">' +
    SCOPES.map(function (o) { return '<label class="opt"><input type="radio" name="scope" value="' + o.v + '"' + (S.scope === o.v ? " checked" : "") + '><span>' + esc(o.l) + '</span></label>'; }).join("") + '</div>';
  return stepShell(3, "How much time does each take a week?", "Tap your best guess for each task.", seg + '<div class="tcards">' + cards + '</div>');
}

function stepRate() {
  var team = S.scope === "team";
  var html = '<div class="chips rate" role="radiogroup" aria-labelledby="qh">' + RATES.map(function (r) { return chip("radio", "rate", r.v, r.l, S.rate === r.v); }).join("") + '</div>';
  return stepShell(4, team ? "What's an hour of your team's time worth?" : "What's an hour of your time worth?",
    team ? "A rough average per hour across your team is fine." : "Your best guess. Think of what you bill, or what your time is worth to the business.", html);
}

function stepTools() {
  var html = toolGroups().map(function (g) {
    return (g.g ? '<p class="chip-l">' + esc(g.g) + '</p>' : '<div style="height:6px"></div>') +
      '<div class="chips tools">' + g.items.map(function (o) { return chip("checkbox", "tools", o.v, o.l, S.tools.indexOf(o.v) > -1); }).join("") + '</div>';
  }).join("");
  html += '<div class="fld" style="margin-top:18px"><label for="toolsOther">Something else? <span class="opt-l">(optional)</span></label><input id="toolsOther" name="toolsOther" type="text" maxlength="200" placeholder="Anything else you use" value="' + esc(S.toolsOther) + '"></div>';
  return stepShell(5, "What do you use today?", "Tap everything you use to run the work.", html);
}

/* ---------- results ---------- */
function scopeText() { return S.scope === "team" ? "across your team" : "for you"; }
function results() {
  var rep = reported(), est = estimate(), opps = opportunities(est), goal = byV(GOALS, S.goal);
  var allUnsure = rep.known === 0, team = S.scope === "team";
  var h = '<div class="step-anim res"><span class="eyebrow">Your Busywork Calculator results</span>';

  /* (a) the big number */
  h += '<section class="res-hero cost-hero" aria-labelledby="qh">';
  if (allUnsure) {
    h += '<h1 class="q" id="qh" tabindex="-1">Here\'s where your week goes.</h1>' +
      '<p class="muted" style="margin-top:8px">You weren\'t sure about the hours, so we won\'t guess a number. On a free Time Audit we\'ll measure it with you.</p>';
  } else {
    h += '<h1 class="cost-h" id="qh" tabindex="-1">Busywork is costing ' + (team ? 'your business' : 'you') + ' about <span class="cost-n" data-cost>' + money(rep.cost) + '</span> a year</h1>' +
      '<div class="cost-sub"><div class="cs"><b>' + num(rep.weekly) + '</b> hrs a week</div><div class="cs"><b>' + num(rep.yearly) + '</b> hrs a year</div><div class="cs"><b>' + money(rep.rate) + (rep.rate === 250 ? '+' : '') + '</b> an hour</div></div>';
    if (est.count && goal) h += '<p class="goal-line">That\'s about <strong>' + winBackText(est) + ' a week</strong> ' + esc(goal.put) + '.</p>';
    h += '<p class="disclaim">Estimate based on your answers. We confirm the real number on a free call. <button type="button" class="linkbtn" id="openHow">How this estimate works</button></p>';
  }
  h += '<p class="res-brand"><span>Days<em>Won</em> Busywork Calculator</span><span>Software that wins back your days.</span></p></section>';

  /* (b) their fixes: only for tasks they picked */
  h += '<h2 class="h-sec">' + (opps.length === 1 ? 'Your fix' : 'Your ' + opps.length + ' fixes') + '</h2><div class="opps">' + opps.map(function (o, i) {
    var op = fixFor(o.task), tl = toolLine(o.task, i + 1);
    return '<article class="opp"><div class="t"><h3>' + (i + 1) + '. ' + esc(op.t) + '</h3><span class="from">From: ' + esc(taskInfo(o.task).l) + '</span></div><p>' + esc(op.d) + '</p>' +
      (tl ? '<p class="tool-line">' + esc(tl) + '</p>' : '') + '</article>';
  }).join("") + '</div>';

  /* (c) the offer and booking */
  var bookBtn = BOOKING_URL ? '<a class="btn" id="bookLink" href="' + esc(BOOKING_URL) + '" target="_blank" rel="noopener">Book My Free Time Audit</a>'
    : '<button class="btn" type="button" data-mode="call">Book My Free Time Audit</button>';
  h += '<section class="next-step offer-box" aria-labelledby="ns-h"><h2 id="ns-h">Get these hours back</h2>' +
    '<p class="muted" style="margin-top:6px">Book a free 30-minute Time Audit. We\'ll map your week and show you exactly what we\'d build first.</p>' +
    '<ul class="promise"><li><strong>Your system goes live in 7 days, or setup is free.</strong></li><li><strong>We work until it works.</strong></li></ul>' +
    '<p class="spots"><span class="dot" aria-hidden="true"></span>Only a few founding spots left.</p>' +
    '<div class="actions">' + bookBtn + '<button class="btn ghost" type="button" data-mode="email">Email me a copy</button></div></section>';
  h += '<div id="leadBox">' + leadBox() + '</div>';

  /* (d) the breakdown and the math, collapsed */
  h += '<details class="how" id="how"><summary>How this estimate works</summary><div class="how-in">';
  if (!allUnsure) h += '<p>Yearly cost = weekly hours × your hourly value × ' + WEEKS_PER_YEAR + ': ' + fmt(rep.weekly) + ' × ' + money(rep.rate) + ' × ' + WEEKS_PER_YEAR + ' = <strong>' + money(rep.cost) + '</strong>. Weekly hours add up the middle of each range you tapped (Under 2 = 1, 2–5 = 3.5, 5–10 = 7.5, 10–20 = 15, 20+ = 25)' + (rep.rate === 250 ? '; $250+ counts as $250' : '') + '.</p>';
  h += '<div class="task-bars" data-est-rows aria-label="Task-by-task breakdown">' + est.rows.map(function (r) {
    var o = taskInfo(r.task), hh = hoursFor(r.task), b = bucketFor(r.task), w = rep.weekly ? Math.round((hh || 0) / rep.weekly * 100) : 0;
    var label = '<div class="task-bar-title"><strong>' + esc(o.l) + '</strong><b>' + (hh === null ? 'Not sure' : esc(b.l) + ' hrs/wk') + '</b></div>';
    var visual = hh === null ? '' : '<div class="task-track" role="img" aria-label="' + esc(o.l) + ': ' + fmt(hh) + ' of ' + fmt(rep.weekly) + ' weekly hours"><i style="width:' + w + '%"></i></div>';
    var math = hh === null ? 'Not counted (you weren\'t sure).' :
      'Cost: ' + fmt(hh) + ' hrs/wk × ' + money(rep.rate) + ' × ' + WEEKS_PER_YEAR + ' = <strong>' + money(hh * rep.rate * WEEKS_PER_YEAR) + '/yr</strong><br>' +
      (r.skipped ? 'Win-back: no estimate (method not given).' : 'Win-back: ' + fmt(r.hours) + ' hrs/wk × ' + pct(r.share[0]) + '–' + pct(r.share[1]) + ' (' + byV(METHODS, r.method).l.toLowerCase() + ') = <strong>' + rangeText(r) + '</strong>');
    return '<div class="task-bar-item">' + label + visual + '<p class="task-math">' + math + '</p></div>';
  }).join("") + '</div>';
  h += '<ul class="how-list">' +
    '<li>The yearly cost is the time busywork takes now, at the hourly value you picked. Time spent is not the same as time saved.</li>' +
    '<li>The hours you could get back use one fixed table, by how each task is done today. By hand: follow-ups and scheduling 40–60%, paperwork 30–50%, re-entering data between systems 25–40%. Partly with a tool: half of those. Mostly automated: 0–10%. Each end is rounded to whole hours and the total adds the rounded ranges.</li>' +
    (rep.unsure.length ? '<li>Not counted because you weren\'t sure: ' + rep.unsure.map(function (t) { return taskInfo(t).s; }).join(", ") + '.</li>' : '') +
    (team ? '<li>Hours are for your whole team, as you chose.</li>' : '<li>Hours are for you alone, as you chose.</li>') +
    '<li>This is an estimate, not a guarantee. The real number depends on your workflows, and we confirm it with you on the free Time Audit.</li></ul>';
  h += '</div></details>';

  h += '<div class="share-row"><button class="btn ghost" type="button" id="shareAudit">Share the calculator</button><span id="shareStatus" class="share-status" role="status" aria-live="polite"></span></div>';
  h += '<h2 class="h-sec">Your answers</h2><dl class="summary">' +
    '<dt>Business</dt><dd>' + esc(byV(BUSINESS, S.business).l) + '</dd>' +
    '<dt>Time goes to</dt><dd>' + S.tasks.map(function (t) { var b = bucketFor(t); return esc(taskInfo(t).l) + ' (' + (b ? esc(b.l) + ' hrs/wk' : 'not sure') + ')'; }).join(", ") + '</dd>' +
    '<dt>Hourly value</dt><dd>' + (S.rate ? money(S.rate) + (S.rate === 250 ? '+' : '') : 'Not given') + '</dd>' +
    '<dt>Tools today</dt><dd>' + esc(toolsText()) + '</dd>' +
    '<dt>Goal</dt><dd>' + esc(goal ? goal.l : "") + '</dd></dl>';
  h += '<p style="margin-top:22px"><button type="button" class="linkbtn" id="edit">Change my answers</button> &nbsp;·&nbsp; <button type="button" class="linkbtn" id="restart">Start over</button></p></div>';
  return h;
}
function toolsText() {
  var t = pickedTools().map(function (o) { return o.l; });
  if (S.toolsOther.trim()) t.push("Other: " + S.toolsOther.trim());
  return t.join(", ") || "Not given";
}

/* ---------- lead form (callback or "email me a copy"; nothing is emailed automatically) ---------- */
var leadMode = "";
function leadBox() {
  if (S.lead && S.lead.sent) {
    return '<div class="done" role="status"><strong>' + (S.lead.mode === "call" ? "Thanks, your Time Audit request is in." : "Thanks, your request is in.") + '</strong> ' +
      (S.lead.mode === "call" ? "Mendel will call you at the time you picked to set up your free 30-minute Time Audit." : "Mendel will email you a copy of your results.") + '</div>';
  }
  if (!leadMode) return "";
  var call = leadMode === "call";
  return '<form class="lead step-anim" id="leadForm" novalidate>' +
    '<h2 id="lead-h" tabindex="-1">' + (call ? "Book My Free Time Audit" : "Email me a copy") + '</h2>' +
    '<p class="muted">' + (call ? "Leave your details and Mendel will call you to set up your free 30-minute Time Audit." : "Leave your email and Mendel will email you a copy of your results.") + '</p>' +
    '<div class="two"><div class="fld"><label for="f_name">Name</label><input id="f_name" name="name" autocomplete="name" required maxlength="120"></div>' +
    '<div class="fld"><label for="f_company">Business name <span class="opt-l">(optional)</span></label><input id="f_company" name="company" autocomplete="organization" maxlength="160"></div></div>' +
    (call ? '<div class="two"><div class="fld"><label for="f_phone">Phone</label><input id="f_phone" name="phone" type="tel" autocomplete="tel" required maxlength="40"></div>' +
      '<div class="fld"><label for="f_time">Best time to call</label><select id="f_time" name="bestTime" required><option value="">Choose a time</option>' + BEST_TIMES.map(function (t) { return '<option>' + t + '</option>'; }).join("") + '</select></div></div>' : '') +
    '<div class="fld"><label for="f_email">Email' + (call ? ' <span class="opt-l">(optional)</span>' : '') + '</label><input id="f_email" name="email" type="email" autocomplete="email"' + (call ? '' : ' required') + ' maxlength="200"></div>' +
    '<div class="hp" aria-hidden="true"><label for="f_website">Website</label><input id="f_website" name="website" tabindex="-1" autocomplete="off"></div>' +
    '<label class="consent"><input type="checkbox" name="consent" id="f_consent" required><span>I agree that DaysWon may contact me about my results and keep my answers to do so.</span></label>' +
    '<p class="err" id="leadErr" role="alert"></p>' +
    '<button class="btn" type="submit" id="leadSubmit" style="width:100%;margin-top:4px">' + (call ? "Request my Time Audit" : "Email me a copy") + '</button>' +
    '<p class="status" id="leadStatus" role="status"></p>' +
    '<p class="privacy">Privacy: we use your answers and contact details only to follow up with you. We don\'t sell them or share them with advertisers, and we keep them only as long as we need to help you. To see or delete your information, email <a href="mailto:hello@dayswon.com">hello@dayswon.com</a>.</p>' +
    '</form>';
}
function summaryText(d) {
  var rep = reported(), est = estimate(), opps = opportunities(est), goal = byV(GOALS, S.goal);
  var L = [];
  L.push("Source: time-audit (Busywork Calculator)");
  L.push("Request: " + (d.mode === "call" ? "Book My Free Time Audit, callback (best time: " + d.bestTime + ")" : "Email me a copy (visitor was told Mendel will email a copy; nothing is sent automatically)"));
  L.push("Calculator ID: " + S.auditId);
  L.push("Completed: " + S.completedAt + " | Submitted: " + d.at);
  L.push("Consent: yes, given " + d.at);
  L.push("");
  L.push("Business type: " + byV(BUSINESS, S.business).l);
  if (d.company) L.push("Business name: " + d.company);
  L.push("Tasks: " + S.tasks.map(function (t) { return taskInfo(t).l; }).join(", "));
  L.push("Team scope: " + (S.scope === "team" ? "Whole team" : "Owner only"));
  L.push("Hours per task (per week, chip -> midpoint used) and how it's done today:");
  S.tasks.forEach(function (t) {
    var b = bucketFor(t), m = byV(METHODS, S.method[t]);
    L.push("- " + taskInfo(t).l + " [" + CAT_NAME[t] + "]: " + (b ? b.l + " hrs/wk -> " + fmt(b.mid) : "not sure") + ", " + (m ? m.l.toLowerCase() : "method not given"));
  });
  L.push("Hourly value: " + (S.rate ? "$" + S.rate + (S.rate === 250 ? "+ (counted as $250)" : "") + "/hr" : "not given"));
  L.push("Current tools: " + toolsText());
  L.push("Desired outcome: " + (goal ? goal.l : "not given"));
  L.push("");
  if (rep.known === 0) L.push("Weekly total: not given (not sure)");
  else {
    L.push("Weekly total: " + fmt(rep.weekly) + " hrs/wk" + (rep.unsure.length ? " (" + rep.known + " of " + S.tasks.length + " tasks; not sure on the rest)" : ""));
    L.push("Annualized total (x" + WEEKS_PER_YEAR + "): " + fmt(rep.yearly) + " hrs/yr");
    L.push("Yearly cost shown (weekly hrs x $" + rep.rate + " x " + WEEKS_PER_YEAR + "): " + money(rep.cost) + "/yr");
  }
  if (est.count) {
    L.push("Estimated hours to win back (shown as an estimate): " + est.lo + "-" + est.hi + " hrs/wk");
    est.rows.forEach(function (r) {
      var o = taskInfo(r.task);
      if (r.skipped) L.push("- " + o.l + ": no estimate (" + (r.skipped === "hours" ? "hours not sure" : "method not given") + ")");
      else L.push("- " + o.l + ": " + fmt(r.hours) + " hrs x " + pct(r.share[0]) + "-" + pct(r.share[1]) + " (" + byV(METHODS, r.method).l.toLowerCase() + ") = " + rangeText(r).replace("–", "-"));
    });
  } else L.push("Estimated hours to win back: not estimated (hours not given)");
  L.push("Fixes shown: " + opps.map(function (o) { return fixFor(o.task).t; }).join("; "));
  L.push("");
  L.push("Page: " + location.href);
  return L.join("\n");
}
var sending = false;
function submitLead(f) {
  if (sending || (S.lead && S.lead.sent)) return;
  var err = document.getElementById("leadErr"), st = document.getElementById("leadStatus"), b = document.getElementById("leadSubmit");
  err.textContent = ""; st.textContent = ""; st.className = "status";
  var v = function (n) { var x = f.elements[n]; return x ? String(x.value || "").trim() : ""; };
  var d = { mode: leadMode, name: v("name"), company: v("company"), email: v("email"), phone: v("phone"), bestTime: v("bestTime"), at: new Date().toISOString() };
  var bad = null;
  if (!d.name) bad = ["f_name", "Please enter your name."];
  else if (leadMode === "call" && d.phone.replace(/\D/g, "").length < 7) bad = ["f_phone", "Please enter a phone number we can call."];
  else if (leadMode === "call" && !d.bestTime) bad = ["f_time", "Please pick a good time to call."];
  else if ((leadMode === "email" || d.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) bad = ["f_email", "Please enter a valid email address."];
  else if (!f.elements.consent.checked) bad = ["f_consent", "Please tick the box so we can contact you."];
  if (bad) { err.textContent = bad[1]; var el = document.getElementById(bad[0]); if (el) { el.setAttribute("aria-invalid", "true"); el.focus(); } return; }
  sending = true; b.disabled = true; b.textContent = "Sending…";
  var payload = {
    type: "inquiry", source: "time-audit",
    name: d.name, email: d.email, phone: d.phone, company: d.company,
    service: leadMode === "call" ? "Busywork Calculator: book a free Time Audit" : "Busywork Calculator: email a copy",
    message: summaryText(d), page: location.href, website: v("website")
  };
  var done = function (ok) {
    sending = false;
    if (ok) {
      S.lead = { sent: true, mode: leadMode, at: d.at }; save();
      track(leadMode === "call" ? "consultation_booked" : "email_requested", { auditId: S.auditId });
      document.getElementById("leadBox").innerHTML = leadBox(); postHeight();
    } else {
      b.disabled = false; b.textContent = leadMode === "call" ? "Request my Time Audit" : "Email me a copy";
      st.className = "status bad";
      st.innerHTML = 'That didn\'t go through. Please try again, or email <a href="mailto:hello@dayswon.com?subject=' + encodeURIComponent("Busywork Calculator " + S.auditId) + '&body=' + encodeURIComponent(payload.message) + '">hello@dayswon.com</a>.';
    }
  };
  if (!window.fetch) return done(false);
  fetch(LEAD_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
    .then(function (r) { return r.json().then(function (j) { return !!(r.ok && j.ok); }); })
    .catch(function () { return false; }).then(done);
}

/* ---------- validation + navigation ---------- */
function showErr(msg, focusEl) { var e = document.getElementById("err"); if (e) e.textContent = msg; if (focusEl) focusEl.focus(); return false; }
function validate() {
  var f = document.getElementById("stepForm");
  if (S.step === 1 && !S.business) return showErr("Please choose one option.", f.querySelector("input"));
  if (S.step === 2 && !S.tasks.length) return showErr("Please pick at least one.", f.querySelector("input"));
  if (S.step === 3) {
    if (!S.scope) return showErr("Please say whose time you're counting.", f.querySelector("input[name=scope]"));
    for (var i = 0; i < S.tasks.length; i++) {
      var t = S.tasks[i];
      if (!S.hours[t]) return showErr("Tap the hours for " + taskInfo(t).s + ", or \"I'm not sure\".", f.querySelector("input[name=h_" + t + "]"));
      if (S.hours[t] !== "ns" && !S.method[t]) return showErr("Tap how " + taskInfo(t).s + " is done today.", f.querySelector("input[name=m_" + t + "]"));
    }
  }
  if (S.step === 4 && !S.rate) return showErr("Please tap one. A rough guess is fine.", f.querySelector("input"));
  if (S.step === 5 && !S.tools.length && !S.toolsOther.trim()) return showErr("Please tap at least one, or type it under \"Something else\".", f.querySelector("input"));
  if (S.step === 6 && !S.goal) return showErr("Please choose one option.", f.querySelector("input"));
  return true;
}
function go(n) { S.step = n; if (n > S.maxStep) S.maxStep = n; save(); render(); }
function next() {
  if (!validate()) return;
  track("step_completed", { step: S.step });
  if (S.step === TOTAL_STEPS) {
    S.completedAt = new Date().toISOString();
    track("audit_completed", { auditId: S.auditId });
    go(TOTAL_STEPS + 1);
    track("results_viewed", { auditId: S.auditId });
  } else go(S.step + 1);
}
function start() { if (!S.auditId) S.auditId = newId(); if (!S.startedAt) S.startedAt = new Date().toISOString(); track("audit_start", { auditId: S.auditId }); go(1); }

function countUp(el, target, prefix) {
  if (!el) return;
  prefix = prefix || "";
  function show(n) { el.textContent = prefix + num(n); }
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { show(target); return; }
  var t0 = 0, duration = 1000;
  function frame(ts) {
    if (!t0) t0 = ts;
    var t = Math.min(1, (ts - t0) / duration), eased = 1 - Math.pow(1 - t, 3);
    show(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(frame); else show(target);
  }
  if (window.requestAnimationFrame) { show(0); requestAnimationFrame(frame); setTimeout(function () { show(target); }, duration + 400); } else show(target);
}
function shareAudit() {
  var url = new URL(SHARE_URL, location.href).href; /* the calculator page only: never an ID or answers */
  var text = "What is busywork really costing you? Try the 2-minute DaysWon Busywork Calculator.";
  var st = document.getElementById("shareStatus");
  track("audit_shared", {});
  function copied(ok) { st.textContent = ok ? "Link copied. Paste it anywhere to share." : "Copy this link: " + url; }
  function fallback() {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(url).then(function () { copied(true); }, legacy);
    legacy();
  }
  function legacy() {
    var box = document.createElement("textarea"); box.value = url; box.setAttribute("readonly", ""); box.style.position = "fixed"; box.style.opacity = "0";
    document.body.appendChild(box); box.select(); var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(box); copied(ok);
  }
  if (navigator.share) navigator.share({ title: "DaysWon Busywork Calculator", text: text, url: url }).catch(function (e) { if (!e || e.name !== "AbortError") fallback(); });
  else fallback();
}
function bind() {
  var el;
  if ((el = document.getElementById("shareAudit"))) el.onclick = shareAudit;
  if ((el = document.getElementById("start"))) el.onclick = start;
  if ((el = document.getElementById("resume"))) el.onclick = function () { go(Math.min(S.maxStep, TOTAL_STEPS + 1) || 1); };
  [].forEach.call(document.querySelectorAll("#restart"), function (b) { b.onclick = function () { S = fresh(); leadMode = ""; save(); start(); }; });
  if ((el = document.getElementById("edit"))) el.onclick = function () { go(1); };
  if ((el = document.getElementById("openHow"))) el.onclick = function () { var d = document.getElementById("how"); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); postHeight(); } };
  if ((el = document.getElementById("how"))) el.addEventListener("toggle", postHeight);
  if ((el = document.getElementById("bookLink"))) el.onclick = function () { track("consultation_booked", { auditId: S.auditId, via: "calendar" }); };
  var f = document.getElementById("stepForm");
  if (f) {
    f.onsubmit = function (e) { e.preventDefault(); next(); };
    document.getElementById("back").onclick = function () { go(S.step - 1); };
    f.addEventListener("change", onChange); f.addEventListener("input", onChange);
  }
  [].forEach.call(document.querySelectorAll("[data-mode]"), function (b) {
    b.onclick = function () {
      if (S.lead && S.lead.sent) return;
      leadMode = b.getAttribute("data-mode");
      document.getElementById("leadBox").innerHTML = leadBox();
      var lf = document.getElementById("leadForm");
      lf.onsubmit = function (e) { e.preventDefault(); submitLead(lf); };
      lf.addEventListener("input", function (e) { if (e.target.removeAttribute) e.target.removeAttribute("aria-invalid"); });
      var hd = document.getElementById("lead-h"); hd.focus({ preventScroll: true }); lf.scrollIntoView({ behavior: "smooth", block: "start" });
      postHeight();
    };
  });
}
function onChange(e) {
  var t = e.target, n = t.name || "";
  var er = document.getElementById("err"); if (er && e.type === "change") er.textContent = "";
  if (n === "business") S.business = t.value;
  else if (n === "goal") S.goal = t.value;
  else if (n === "scope") S.scope = t.value;
  else if (n === "rate") S.rate = parseInt(t.value, 10) || 0;
  else if (n === "tasks") {
    S.tasks = [].map.call(document.querySelectorAll("input[name=tasks]:checked"), function (x) { return x.value; });
  }
  else if (n.indexOf("h_") === 0) {
    var k = n.slice(2); S.hours[k] = t.value;
    var ml = document.getElementById("ml_" + k);
    if (ml) ml.innerHTML = "How it's done today" + (t.value === "ns" ? ' <span class="opt-l">(optional)</span>' : '');
  }
  else if (n.indexOf("m_") === 0) S.method[n.slice(2)] = t.value;
  else if (n === "tools") {
    if (t.value === "none" && t.checked) [].forEach.call(document.querySelectorAll("input[name=tools]"), function (x) { if (x.value !== "none") x.checked = false; });
    else if (t.value !== "none" && t.checked) { var nn = document.querySelector("input[name=tools][value=none]"); if (nn) nn.checked = false; }
    S.tools = [].map.call(document.querySelectorAll("input[name=tools]:checked"), function (x) { return x.value; });
  }
  else if (n === "toolsOther") S.toolsOther = t.value;
  save();
}

/* sanitize a restored state: steps beyond what's answered fall back */
if (S.step > TOTAL_STEPS + 1 || S.step < 0) S.step = 0;
if (S.step === TOTAL_STEPS + 1 && (!S.goal || !S.rate)) S.step = 0;
render(false);
})();
