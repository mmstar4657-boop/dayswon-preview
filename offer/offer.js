/* DaysWon offer page: CTA scroll + callback form. Plain JS, no trackers. */
(function () {
"use strict";
var LEAD_API = "https://dayswon.sites.tab.bot/api/lead";
var form = document.getElementById("bookForm");
if (!form) return;
var interest = "audit", sending = false, sent = false;
function track(ev, d) { if (window.track) window.track(ev, d); }
document.addEventListener("click", function (e) {
  var a = e.target.closest && e.target.closest("[data-cta]");
  if (!a) return;
  interest = a.getAttribute("data-cta") || "audit";
  if (interest === "founding") document.getElementById("b_founding").checked = true;
  e.preventDefault();
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("book").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  if (history.replaceState) history.replaceState(null, "", "#book");
  setTimeout(function () { var n = document.getElementById("b_name"); if (n && !sent) n.focus({ preventScroll: true }); }, reduce ? 0 : 550);
});
form.addEventListener("input", function (e) { if (e.target && e.target.removeAttribute) e.target.removeAttribute("aria-invalid"); });
form.addEventListener("submit", function (e) {
  e.preventDefault();
  if (sending || sent) return;
  var err = document.getElementById("bookErr"), st = document.getElementById("bookStatus"), b = document.getElementById("bookSubmit");
  err.textContent = ""; st.textContent = ""; st.className = "status";
  var v = function (n) { var x = form.elements[n]; return x ? String(x.value || "").trim() : ""; };
  var d = { name: v("name"), phone: v("phone"), email: v("email"), bestTime: v("bestTime"), founding: form.elements.founding.checked, at: new Date().toISOString() };
  var bad = null;
  if (!d.name) bad = ["b_name", "Please enter your name."];
  else if (d.phone.replace(/\D/g, "").length < 7) bad = ["b_phone", "Please enter a phone number we can call."];
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) bad = ["b_email", "Please enter a valid email address."];
  else if (!d.bestTime) bad = ["b_time", "Please pick a good time to call."];
  else if (!form.elements.consent.checked) bad = ["b_consent", "Please tick the box so we can contact you."];
  if (bad) { err.textContent = bad[1]; var el = document.getElementById(bad[0]); if (el) { el.setAttribute("aria-invalid", "true"); el.focus(); } return; }
  sending = true; b.disabled = true; b.textContent = "Sending…";
  var wants = d.founding ? "Claim My Founding Spot" : "Book My Free Time Audit";
  var message = [
    "Source: offer",
    "Request: " + wants + " (callback)",
    "Best time to call: " + d.bestTime,
    "Interested in a founding spot: " + (d.founding ? "yes" : "no"),
    "Button clicked: " + (interest === "founding" ? "Claim My Founding Spot" : "Book My Free Time Audit"),
    "Consent: yes, given " + d.at
  ].join("\n");
  var payload = {
    type: "inquiry", source: "offer",
    name: d.name, email: d.email, phone: d.phone, company: "",
    service: "Offer page: " + wants,
    message: message, page: location.href, website: v("website")
  };
  var done = function (ok) {
    sending = false;
    if (ok) {
      sent = true;
      track(d.founding ? "founding_spot_requested" : "time_audit_booked", {});
      form.innerHTML = '<div class="done" role="status" tabindex="-1" id="bookDone"><strong>Thanks, your request is in.</strong> We\'ll call you back at the time you picked.</div>';
      var dn = document.getElementById("bookDone"); if (dn) dn.focus();
    } else {
      b.disabled = false; b.textContent = "Request my call";
      st.className = "status bad";
      st.innerHTML = 'That didn\'t go through. Please try again, or email <a href="mailto:hello@dayswon.com?subject=' + encodeURIComponent("Free Time Audit") + '&body=' + encodeURIComponent("Name: " + d.name + "\nPhone: " + d.phone + "\nBest time: " + d.bestTime) + '">hello@dayswon.com</a>.';
    }
  };
  if (!window.fetch) return done(false);
  fetch(LEAD_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
    .then(function (r) { return r.json().then(function (j) { return !!(r.ok && j.ok); }); })
    .catch(function () { return false; }).then(done);
});
})();
