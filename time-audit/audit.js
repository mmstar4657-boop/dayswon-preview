/* DaysWon Time Audit. Plain, deterministic JavaScript: no AI, no third-party trackers.
   Every number on the results screen comes from the visitor's own answers and the fixed
   RECOVERY_TABLE below, so each figure can be checked by hand. */
(function(){
"use strict";

var STORE_KEY = "dw_time_audit_v1";
var LEAD_API = "https://dayswon.sites.tab.bot/api/lead";
var WEEKS_PER_YEAR = 52;
var TOTAL_STEPS = 6;

/* Conservative share of each task's reported weekly hours that could be won back,
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
  { v: "professional", l: "Professional services", d: "Accounting, legal, consulting, agencies" },
  { v: "retail", l: "Retail or distribution", d: "Stores, wholesale, e-commerce" },
  { v: "other", l: "Other" }
];
var TASKS = [
  { v: "followups", l: "Customer follow-ups", s: "customer follow-ups", d: "Replying to leads, chasing quotes, checking in" },
  { v: "scheduling", l: "Scheduling", s: "scheduling", d: "Booking, rescheduling, reminders" },
  { v: "paperwork", l: "Invoices and paperwork", s: "invoices and paperwork", d: "Billing, forms, data entry" },
  { v: "systems", l: "Disconnected systems", s: "work across disconnected systems", d: "Copying information between apps and spreadsheets" }
];
var TOOL_GROUPS = [
  { g: "Talking to customers", items: [ { v: "email", l: "Email (Gmail, Outlook)" }, { v: "text", l: "Text or WhatsApp" } ] },
  { g: "Scheduling", items: [ { v: "calendar", l: "Google Calendar or Calendly" } ] },
  { g: "Records and money", items: [ { v: "sheets", l: "Excel or Google Sheets" }, { v: "accounting", l: "QuickBooks or Xero" }, { v: "paper", l: "Paper or whiteboard" } ] },
  { g: "Business software", items: [ { v: "crm", l: "A CRM (HubSpot, Salesforce, other)" }, { v: "industry", l: "Industry software" } ] },
  { g: "", items: [ { v: "none", l: "Nothing / mostly manual" } ] }
];
var METHODS = [
  { v: "manual", l: "Fully manual", s: "done fully manually" },
  { v: "partial", l: "Partly with a tool", s: "done partly with a tool" },
  { v: "automated", l: "Mostly automated already", s: "mostly automated already" }
];
var GOALS = [
  { v: "customers", l: "More time with customers" },
  { v: "growth", l: "More time to grow the business" },
  { v: "admin", l: "Less admin" },
  { v: "personal", l: "More personal time" }
];
var SCOPES = [ { v: "owner", l: "Just me (the owner)" }, { v: "team", l: "My whole team" } ];
var OPPS = {
  followups: { t: "Lead response and reminders", d: "Instant replies to new inquiries, automatic follow-ups on quotes, and reminders so no lead goes cold." },
  scheduling: { t: "Booking and confirmations", d: "Customers book and reschedule online, with automatic confirmations and reminders that cut no-shows." },
  paperwork: { t: "Invoice and data-entry workflow", d: "Invoices and records created from work you've already logged, so nothing gets typed twice." },
  systems: { t: "Connected operations", d: "Your apps share information automatically, so the whole business works from one up-to-date picture." }
};
var COMPANION = { followups: "scheduling", scheduling: "followups", paperwork: "systems", systems: "paperwork" };
var BEST_TIMES = ["Morning (9-12)", "Midday (12-2)", "Afternoon (2-5)", "Evening (5-7)", "Any time"];

function track(ev, data) { if (window.track) window.track(ev, data); else try { console.log("[track]", ev, data || {}); } catch (e) {} }
function byV(list, v) { for (var i = 0; i < list.length; i++) if (list[i].v === v) return list[i]; return null; }
function allTools() { var o = []; TOOL_GROUPS.forEach(function (g) { o = o.concat(g.items); }); return o; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function fmt(n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10); }
function num(n) { return n.toLocaleString("en-US"); }

/* ---------- state ---------- */
function fresh() {
  return { step: 0, business: "", tasks: [], hours: {}, notSure: {}, scope: "", tools: [], toolsOther: "", method: {}, goal: "",
           auditId: "", startedAt: "", completedAt: "", lead: null, maxStep: 0 };
}
var S = load();
function load() {
  try { var raw = sessionStorage.getItem(STORE_KEY); if (raw) { var o = JSON.parse(raw); var f = fresh(); for (var k in f) if (!(k in o)) o[k] = f[k]; return o; } } catch (e) {}
  return fresh();
}
function save() { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {} }
function newId() { return "TA-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }

/* ---------- calculations ---------- */
function hoursFor(t) {
  if (S.notSure[t]) return null;
  var h = parseFloat(S.hours[t]);
  return isFinite(h) && h > 0 ? h : null;
}
function reported() {
  var total = 0, known = 0, unsure = [];
  S.tasks.forEach(function (t) { var h = hoursFor(t); if (h === null) unsure.push(t); else { total += h; known++; } });
  total = Math.round(total * 10) / 10;
  return { weekly: total, yearly: Math.round(total * WEEKS_PER_YEAR * 10) / 10, known: known, unsure: unsure };
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
function pct(x) { return fmt(Math.round(x * 1000) / 10) + "%"; }
function opportunities(est) {
  var order = S.tasks.slice();
  var score = {}; est.rows.forEach(function (r) { score[r.task] = r.skipped ? -1 : r.hiRaw; });
  order.sort(function (a, b) { return (score[b] - score[a]) || ((hoursFor(b) || 0) - (hoursFor(a) || 0)) || (S.tasks.indexOf(a) - S.tasks.indexOf(b)); });
  var out = order.slice(0, 3).map(function (t) { return { task: t, picked: true }; });
  if (out.length === 1) out.push({ task: COMPANION[out[0].task], picked: false });
  return out;
}
window.DaysWonAudit = { RECOVERY_TABLE: RECOVERY_TABLE, _state: function () { return S; }, _estimateTask: estimateTask, _reported: reported };

/* ---------- rendering helpers ---------- */
var app = document.getElementById("app");
function progress(n) {
  var p = Math.round(n / TOTAL_STEPS * 100);
  return '<div class="prog"><div class="prog-top"><span>Step ' + n + ' of ' + TOTAL_STEPS + '</span><span>' + p + '%</span></div>' +
    '<div class="bar" role="progressbar" aria-label="Audit progress" aria-valuemin="0" aria-valuemax="' + TOTAL_STEPS + '" aria-valuenow="' + n + '" aria-valuetext="Step ' + n + ' of ' + TOTAL_STEPS + '"><i style="width:' + p + '%"></i></div></div>';
}
function radio(name, o, checked) {
  return '<label class="opt"><input type="radio" name="' + name + '" value="' + o.v + '"' + (checked ? " checked" : "") + '><span><span>' + esc(o.l) + (o.d ? '<small>' + esc(o.d) + '</small>' : '') + '</span></span></label>';
}
function check(name, o, checked) {
  return '<label class="opt"><input type="checkbox" name="' + name + '" value="' + o.v + '"' + (checked ? " checked" : "") + '><span><span>' + esc(o.l) + (o.d ? '<small>' + esc(o.d) + '</small>' : '') + '</span></span></label>';
}
function stepShell(n, q, help, inner) {
  return progress(n) + '<form id="stepForm" class="step-anim" novalidate>' +
    '<fieldset><legend><h1 class="q" id="qh" tabindex="-1">' + q + '</h1></legend>' + (help ? '<p class="q-help">' + help + '</p>' : '') + inner + '</fieldset>' +
    '<p class="err" id="err" role="alert"></p>' +
    '<div class="nav-btns"><button type="button" class="btn ghost" id="back">Back</button><button type="submit" class="btn next">' + (n === TOTAL_STEPS ? "See my results" : "Next") + '</button></div></form>';
}

function render(focus) {
  var h = "";
  if (S.step === 0) h = intro();
  else if (S.step === 1) h = stepShell(1, "What kind of business do you run?", "", '<div class="opts">' + BUSINESS.map(function (o) { return radio("business", o, S.business === o.v); }).join("") + '</div>');
  else if (S.step === 2) h = stepShell(2, "Where does your time disappear?", "Pick all that apply.", '<div class="opts">' + TASKS.map(function (o) { return check("tasks", o, S.tasks.indexOf(o.v) > -1); }).join("") + '</div>');
  else if (S.step === 3) h = stepHours();
  else if (S.step === 4) h = stepTools();
  else if (S.step === 5) h = stepMethod();
  else if (S.step === 6) h = stepShell(6, "What would you most like to get back?", "", '<div class="opts">' + GOALS.map(function (o) { return radio("goal", o, S.goal === o.v); }).join("") + '</div>');
  else h = results();
  app.innerHTML = h;
  bind();
  if (focus !== false) {
    var t = document.getElementById("qh");
    if (t) { t.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }
}

function intro() {
  var resume = S.maxStep > 0 && S.step === 0;
  return '<div class="intro-card step-anim"><span class="eyebrow">DaysWon Time Audit</span>' +
    '<h1 class="q" id="qh" tabindex="-1">How much time could you win back?</h1>' +
    '<p class="muted">Six quick questions about where your week goes. You\'ll see your reported weekly workload, a conservative estimate of the time you could win back, and where we\'d start. Your results come first. Contact details are optional.</p>' +
    '<div class="actions">' + (resume ? '<button class="btn" id="resume" type="button">Continue where you left off</button><button class="btn ghost" id="restart" type="button">Start over</button>'
      : '<button class="btn" id="start" type="button">Start the audit</button>') + '</div></div>';
}

function stepHours() {
  var rows = S.tasks.map(function (t) {
    var o = byV(TASKS, t), ns = !!S.notSure[t], id = "h_" + t;
    return '<div class="hrow"><label class="tn" for="' + id + '">' + esc(o.l) + '</label>' +
      '<span class="hin"><input id="' + id + '" name="h_' + t + '" data-task="' + t + '" type="number" inputmode="decimal" min="0.5" max="100" step="0.5" placeholder="0" value="' + esc(S.hours[t] || "") + '"' + (ns ? " disabled" : "") + ' aria-describedby="u_' + t + '"><span class="u" id="u_' + t + '">hrs / week</span></span>' +
      '<label class="ns"><input type="checkbox" name="ns_' + t + '" data-task="' + t + '"' + (ns ? " checked" : "") + '>I\'m not sure</label></div>';
  }).join("");
  var seg = '<p class="sublabel" id="scope-l">Whose time are you counting?</p><div class="seg" role="radiogroup" aria-labelledby="scope-l">' +
    SCOPES.map(function (o) { return '<label class="opt"><input type="radio" name="scope" value="' + o.v + '"' + (S.scope === o.v ? " checked" : "") + '><span>' + esc(o.l) + '</span></label>'; }).join("") + '</div>';
  return stepShell(3, "How much time does this take each week?", "Your best guess is fine. Enter hours per week for each task.", seg + '<div class="hours">' + rows + '</div>');
}

function stepTools() {
  var html = TOOL_GROUPS.map(function (g) {
    return (g.g ? '<p class="sublabel" style="margin-top:14px">' + esc(g.g) + '</p>' : '<div style="height:14px"></div>') +
      '<div class="opts">' + g.items.map(function (o) { return check("tools", o, S.tools.indexOf(o.v) > -1); }).join("") + '</div>';
  }).join("");
  html += '<div class="fld" style="margin-top:18px"><label for="toolsOther">Other <span class="opt-l">(optional)</span></label><input id="toolsOther" name="toolsOther" type="text" maxlength="200" placeholder="Anything else you use" value="' + esc(S.toolsOther) + '"></div>';
  return stepShell(4, "What do you use today?", "Pick everything you use to run the work.", html);
}

function stepMethod() {
  var html = S.tasks.map(function (t) {
    var o = byV(TASKS, t);
    return '<fieldset style="margin-bottom:18px"><legend class="sublabel">' + esc(o.l) + '</legend><div class="opts">' +
      METHODS.map(function (m) { return radio("m_" + t, m, S.method[t] === m.v); }).join("") + '</div></fieldset>';
  }).join("");
  return stepShell(5, "How is each task done today?", "", html);
}

/* ---------- results ---------- */
function scopeText() { return S.scope === "team" ? "across your team" : "for you alone"; }
function results() {
  var rep = reported(), est = estimate(), opps = opportunities(est);
  var allUnsure = rep.known === 0;
  var h = '<div class="step-anim"><span class="eyebrow">Your Time Audit results</span>' +
    '<h1 class="q" id="qh" tabindex="-1" style="margin-top:8px">Here\'s where your week goes.</h1>' +
    '<p class="q-help">Audit ' + esc(S.auditId) + ' · ' + esc(byV(BUSINESS, S.business).l) + ' · hours ' + scopeText() + '</p>';

  h += '<section class="res-hero" aria-labelledby="rep-h"><h2 class="h-sec" id="rep-h" style="margin-top:0">Reported workload</h2>';
  if (allUnsure) {
    h += '<p style="margin-top:10px">You weren\'t sure about the hours, so we\'re not putting a number on it yet. A short workflow review can measure where the time goes.</p>';
  } else {
    h += '<div class="stats"><div class="stat"><div class="v" data-weekly>' + num(rep.weekly) + '<small>hrs / week</small></div><div class="k">Reported weekly hours ' + scopeText() + '</div></div>' +
      '<div class="stat"><div class="v" data-yearly>' + num(rep.yearly) + '<small>hrs / year</small></div><div class="k">Weekly hours × ' + WEEKS_PER_YEAR + '. <b>Reported workload, not savings.</b></div></div></div>';
    if (rep.unsure.length) h += '<p class="note" style="margin-top:6px">Based on ' + rep.known + ' of ' + S.tasks.length + ' tasks. Not included because you weren\'t sure: ' + rep.unsure.map(function (t) { return byV(TASKS, t).s; }).join(", ") + '.</p>';
  }
  h += '<p class="callout">Time spent is not the same as time saved — recoverable hours need a quick workflow review.</p></section>';

  h += '<section class="res-hero" aria-labelledby="est-h"><h2 class="h-sec" id="est-h" style="margin-top:0">Estimated time you could win back</h2>';
  if (est.count === 0) {
    h += '<p style="margin-top:10px">We can\'t estimate this yet because the hours weren\'t entered. We\'d measure it with you in a free 20-minute workflow review.</p>';
  } else {
    h += '<div class="stats" style="grid-template-columns:1fr"><div class="stat"><div class="v" data-est>' + est.lo + '–' + est.hi + '<small>hrs / week</small></div><div class="k"><b>Estimate. We confirm the real number in a free 20-minute workflow review.</b></div></div></div>';
  }
  h += '<ul class="checks" style="margin-top:14px" data-est-rows>' + est.rows.map(function (r) {
    var o = byV(TASKS, r.task);
    if (r.skipped === "hours") return '<li class="skip">' + esc(o.l) + ': no estimate, because you weren\'t sure about the hours.</li>';
    if (r.skipped) return '<li class="skip">' + esc(o.l) + ': no estimate, because we don\'t know how it\'s done today.</li>';
    return '<li>' + fmt(r.hours) + ' hrs/wk of ' + esc(o.s) + ', ' + byV(METHODS, r.method).s + ' → est. ' + rangeText(r) + '</li>';
  }).join("") + '</ul>';
  h += '<details style="margin-top:14px"><summary class="linkbtn" style="list-style:none;display:inline">How this estimate works</summary><p class="note">For each task we take the hours you entered and apply a fixed share based on how it\'s done today. Fully manual: follow-ups and scheduling 40–60%, invoices and paperwork 30–50%, disconnected systems 25–40%. Partly with a tool: half of those. Mostly automated already: 0–10%. Each end of the range is rounded to whole hours, and the total adds up the rounded task ranges. This is not a guarantee: the real number depends on your workflows.</p></details>';
  h += '</section>';

  h += '<h2 class="h-sec">Where we\'d start</h2><div class="opps">' + opps.map(function (o, i) {
    var op = OPPS[o.task];
    return '<article class="opp"><div class="t"><h3>' + (i + 1) + '. ' + esc(op.t) + '</h3><span class="from">' + (o.picked ? "From: " + esc(byV(TASKS, o.task).l) : "Often goes with it") + '</span></div><p>' + esc(op.d) + '</p></article>';
  }).join("") + '</div>';

  h += '<section class="next-step" aria-labelledby="ns-h"><h2 id="ns-h" style="font-size:24px">Recommended next step</h2><p class="muted" style="margin-top:6px">Review these workflows with DaysWon in a free 20-minute call. You\'ll get a clear implementation plan and a real number for the time you could win back.</p>' +
    '<div class="actions"><button class="btn" type="button" data-mode="call">Book a call</button><button class="btn ghost" type="button" data-mode="email">Email me this report</button></div></section>';

  h += '<div id="leadBox">' + leadBox() + '</div>';
  h += '<h2 class="h-sec">Your answers</h2><dl class="summary">' +
    '<dt>Business</dt><dd>' + esc(byV(BUSINESS, S.business).l) + '</dd>' +
    '<dt>Time goes to</dt><dd>' + S.tasks.map(function (t) { return esc(byV(TASKS, t).l); }).join(", ") + '</dd>' +
    '<dt>Tools today</dt><dd>' + esc(toolsText()) + '</dd>' +
    '<dt>Goal</dt><dd>' + esc(byV(GOALS, S.goal).l) + '</dd></dl>';
  h += '<p style="margin-top:22px"><button type="button" class="linkbtn" id="edit">Change my answers</button> &nbsp;·&nbsp; <button type="button" class="linkbtn" id="restart">Start a new audit</button></p></div>';
  return h;
}
function toolsText() {
  var t = S.tools.map(function (v) { return byV(allTools(), v).l; });
  if (S.toolsOther.trim()) t.push("Other: " + S.toolsOther.trim());
  return t.join(", ") || "Not given";
}

/* ---------- lead form ---------- */
var leadMode = "";
function leadBox() {
  if (S.lead && S.lead.sent) {
    return '<div class="done" role="status"><strong>' + (S.lead.mode === "call" ? "Thanks, your call request is in." : "Thanks, your report request is in.") + '</strong> ' +
      (S.lead.mode === "call" ? "Mendel will call you back at the time you picked." : "We'll email you a copy of this report.") + '</div>';
  }
  if (!leadMode) return "";
  var call = leadMode === "call";
  return '<form class="lead step-anim" id="leadForm" novalidate>' +
    '<h2 id="lead-h" tabindex="-1">' + (call ? "Book a call" : "Email me this report") + '</h2>' +
    '<p class="muted">' + (call ? "Leave your details and Mendel will call you back." : "We'll send a copy of these results to your inbox.") + '</p>' +
    '<div class="two"><div class="fld"><label for="f_name">Name</label><input id="f_name" name="name" autocomplete="name" required maxlength="120"></div>' +
    '<div class="fld"><label for="f_company">Business name <span class="opt-l">(optional)</span></label><input id="f_company" name="company" autocomplete="organization" maxlength="160"></div></div>' +
    (call ? '<div class="two"><div class="fld"><label for="f_phone">Phone</label><input id="f_phone" name="phone" type="tel" autocomplete="tel" required maxlength="40"></div>' +
      '<div class="fld"><label for="f_time">Best time to call</label><select id="f_time" name="bestTime" required><option value="">Choose a time</option>' + BEST_TIMES.map(function (t) { return '<option>' + t + '</option>'; }).join("") + '</select></div></div>' : '') +
    '<div class="fld"><label for="f_email">Email' + (call ? ' <span class="opt-l">(optional)</span>' : '') + '</label><input id="f_email" name="email" type="email" autocomplete="email"' + (call ? '' : ' required') + ' maxlength="200"></div>' +
    '<div class="hp" aria-hidden="true"><label for="f_website">Website</label><input id="f_website" name="website" tabindex="-1" autocomplete="off"></div>' +
    '<label class="consent"><input type="checkbox" name="consent" id="f_consent" required><span>I agree that DaysWon may contact me about this audit and keep my answers to do so.</span></label>' +
    '<p class="err" id="leadErr" role="alert"></p>' +
    '<button class="btn" type="submit" id="leadSubmit" style="width:100%;margin-top:4px">' + (call ? "Request my call" : "Email me the report") + '</button>' +
    '<p class="status" id="leadStatus" role="status"></p>' +
    '<p class="privacy">Privacy: we use your answers and contact details only to follow up on this audit. We don\'t sell them or share them with advertisers, and we keep them only as long as we need to help you. To see or delete your information, email <a href="mailto:mendel@dayswon.com">mendel@dayswon.com</a>.</p>' +
    '</form>';
}
function summaryText(d) {
  var rep = reported(), est = estimate(), opps = opportunities(est);
  var L = [];
  L.push("Source: time-audit");
  L.push("Request: " + (d.mode === "call" ? "Book a call (best time: " + d.bestTime + ")" : "Email me this report"));
  L.push("Audit ID: " + S.auditId);
  L.push("Completed: " + S.completedAt + " | Submitted: " + d.at);
  L.push("Consent: yes, given " + d.at);
  L.push("");
  L.push("Business type: " + byV(BUSINESS, S.business).l);
  if (d.company) L.push("Business name: " + d.company);
  L.push("Tasks: " + S.tasks.map(function (t) { return byV(TASKS, t).l; }).join(", "));
  L.push("Team scope: " + (S.scope === "team" ? "Whole team" : "Owner only"));
  L.push("Hours per task (per week) and how it's done today:");
  S.tasks.forEach(function (t) {
    var h = hoursFor(t), m = byV(METHODS, S.method[t]);
    L.push("- " + byV(TASKS, t).l + ": " + (h === null ? "not sure" : fmt(h) + " hrs/wk") + ", " + (m ? m.l.toLowerCase() : "method not given"));
  });
  L.push("Current tools: " + toolsText());
  L.push("Desired outcome: " + byV(GOALS, S.goal).l);
  L.push("");
  if (rep.known === 0) L.push("Weekly total: not given (not sure)");
  else {
    L.push("Weekly total (reported): " + fmt(rep.weekly) + " hrs/wk" + (rep.unsure.length ? " (" + rep.known + " of " + S.tasks.length + " tasks; not sure on the rest)" : ""));
    L.push("Annualized total (x" + WEEKS_PER_YEAR + "): " + fmt(rep.yearly) + " hrs/yr (reported workload, not savings)");
  }
  if (est.count) {
    L.push("Estimated time to win back (estimate shown to visitor, to confirm in workflow review): " + est.lo + "-" + est.hi + " hrs/wk");
    est.rows.forEach(function (r) {
      var o = byV(TASKS, r.task);
      if (r.skipped) L.push("- " + o.l + ": no estimate (" + (r.skipped === "hours" ? "hours not sure" : "method not given") + ")");
      else L.push("- " + o.l + ": " + fmt(r.hours) + " hrs x " + pct(r.share[0]) + "-" + pct(r.share[1]) + " (" + byV(METHODS, r.method).l.toLowerCase() + ") = " + rangeText(r).replace("–", "-"));
    });
  } else L.push("Estimated time to win back: not estimated (hours not given)");
  L.push("Top opportunities: " + opps.map(function (o) { return OPPS[o.task].t; }).join("; "));
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
    service: leadMode === "call" ? "Time Audit: book a call" : "Time Audit: email report",
    message: summaryText(d), page: location.href, website: v("website")
  };
  var done = function (ok) {
    sending = false;
    if (ok) {
      S.lead = { sent: true, mode: leadMode, at: d.at }; save();
      track(leadMode === "call" ? "consultation_booked" : "email_requested", { auditId: S.auditId });
      document.getElementById("leadBox").innerHTML = leadBox();
    } else {
      b.disabled = false; b.textContent = leadMode === "call" ? "Request my call" : "Email me the report";
      st.className = "status bad";
      st.innerHTML = 'That didn\'t go through. Please try again, or email <a href="mailto:mendel@dayswon.com?subject=' + encodeURIComponent("Time Audit " + S.auditId) + '&body=' + encodeURIComponent(payload.message) + '">mendel@dayswon.com</a>.';
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
      var t = S.tasks[i]; if (S.notSure[t]) continue;
      var raw = S.hours[t], h = parseFloat(raw), el = document.getElementById("h_" + t);
      if (raw === "" || raw == null || !isFinite(h)) return showErr("Enter hours for " + byV(TASKS, t).s + ", or tick \"I'm not sure\".", el);
      if (h <= 0 || h > 100) return showErr("Hours for " + byV(TASKS, t).s + " should be between 0.5 and 100 per week.", el);
    }
  }
  if (S.step === 4 && !S.tools.length && !S.toolsOther.trim()) return showErr("Please pick at least one, or describe it under Other.", f.querySelector("input"));
  if (S.step === 5) for (var j = 0; j < S.tasks.length; j++) if (!S.method[S.tasks[j]]) return showErr("Please answer for " + byV(TASKS, S.tasks[j]).s + ".", f.querySelector("input[name=m_" + S.tasks[j] + "]"));
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

function bind() {
  var el;
  if ((el = document.getElementById("start"))) el.onclick = start;
  if ((el = document.getElementById("resume"))) el.onclick = function () { go(Math.min(S.maxStep, TOTAL_STEPS + 1) || 1); };
  [].forEach.call(document.querySelectorAll("#restart"), function (b) { b.onclick = function () { S = fresh(); leadMode = ""; save(); start(); }; });
  if ((el = document.getElementById("edit"))) el.onclick = function () { go(1); };
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
    };
  });
}
function onChange(e) {
  var t = e.target, n = t.name || "";
  var er = document.getElementById("err"); if (er && e.type === "change") er.textContent = "";
  if (n === "business") S.business = t.value;
  else if (n === "goal") S.goal = t.value;
  else if (n === "scope") S.scope = t.value;
  else if (n === "tasks") {
    S.tasks = [].map.call(document.querySelectorAll("input[name=tasks]:checked"), function (x) { return x.value; });
  }
  else if (n.indexOf("h_") === 0) S.hours[t.getAttribute("data-task")] = t.value;
  else if (n.indexOf("ns_") === 0) {
    var k = t.getAttribute("data-task"); S.notSure[k] = t.checked;
    var inp = document.getElementById("h_" + k); inp.disabled = t.checked; if (!t.checked) inp.focus();
  }
  else if (n === "tools") {
    if (t.value === "none" && t.checked) [].forEach.call(document.querySelectorAll("input[name=tools]"), function (x) { if (x.value !== "none") x.checked = false; });
    else if (t.value !== "none" && t.checked) { var nn = document.querySelector("input[name=tools][value=none]"); if (nn) nn.checked = false; }
    S.tools = [].map.call(document.querySelectorAll("input[name=tools]:checked"), function (x) { return x.value; });
  }
  else if (n === "toolsOther") S.toolsOther = t.value;
  else if (n.indexOf("m_") === 0) S.method[n.slice(2)] = t.value;
  save();
}

/* sanitize a restored state: steps beyond what's answered fall back */
if (S.step > TOTAL_STEPS + 1 || S.step < 0) S.step = 0;
if (S.step === TOTAL_STEPS + 1 && !S.goal) S.step = 0;
render(false);
})();
