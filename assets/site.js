/* Bill Tracker site script: language memory, language menu, App Store campaign links, Android waitlist. */
(function () {
  "use strict";

  // Apple counts a web visit as a campaign only in this full form, with the developer account's
  // provider token (pt). App Store Connect → Analytics → Acquisition → Campaigns lists each ct
  // once it has 5 installs. The HTML keeps the plain URL as the no-JS fallback.
  var CAMPAIGN_URL = "https://apps.apple.com/app/apple-store/id6787081411?pt=128983894";

  function source() {
    try {
      var p = new URLSearchParams(location.search), found = {};
      ["utm_source", "utm_campaign"].forEach(function (k) { if (p.get(k)) found[k] = p.get(k); });
      if (found.utm_source || found.utm_campaign) sessionStorage.setItem("bt_src", JSON.stringify(found));
      return JSON.parse(sessionStorage.getItem("bt_src") || "{}");
    } catch (e) { return {}; }
  }
  function pageLang() { return (document.documentElement.lang || "en").toLowerCase(); }
  function badgeLocation(el) {
    if (el.dataset.location) return el.dataset.location;          // "blog" on articles
    if (el.closest(".site-header")) return "nav";
    return el.closest(".cta-box") ? "footer" : "hero";
  }

  var src = source();
  document.querySelectorAll("[data-app-store]").forEach(function (el) {
    // A tagged visit keeps its own campaign; everyone else is split by page language and badge,
    // e.g. web_de_hero. Apple's limit for ct is 30 characters.
    var ct = src.utm_campaign || src.utm_source || ("web_" + pageLang() + "_" + badgeLocation(el));
    el.setAttribute("href", CAMPAIGN_URL + "&ct=" + encodeURIComponent(ct.slice(0, 30)) + "&mt=8");
  });

  // Android waitlist: the "Google Play — coming soon" badge opens #waitlist, which inserts one row
  // into Supabase `waitlist_signups` (app repo migration 0009). The key is the publishable one the
  // iOS app already ships; the table is insert-only for it, nobody can read the list from outside.
  // 201 = added, 409 = already on the list — both show the same thank-you.
  var WL_URL = "https://eyrnbvqoxireqvfcqqks.supabase.co/rest/v1/waitlist_signups";
  var WL_KEY = "sb_publishable_ji-GB2VUssSa8ssW7DsKRQ_dRQ9N5Xa";
  var WL_LANGS = ["en", "uk", "hu", "nb", "de", "fr", "pt", "es"];
  var wl = document.getElementById("waitlist");
  if (wl && typeof wl.showModal === "function") {
    var form = wl.querySelector("form"), email = form.elements.email, consent = form.elements.consent;
    var errorEl = wl.querySelector(".wl-error"), submit = wl.querySelector(".wl-submit");
    var formView = wl.querySelector("[data-wl-form]"), doneView = wl.querySelector("[data-wl-done]");
    var wlSource = "hero";

    wl.querySelectorAll(".wl-consent a").forEach(function (a) { a.target = "_blank"; a.rel = "noopener"; });
    function showError(msg, field) {
      errorEl.textContent = msg;
      errorEl.hidden = !msg;
      email.setAttribute("aria-invalid", field === email ? "true" : "false");
      if (field) field.focus();
    }
    function showDone() { formView.hidden = true; doneView.hidden = false; doneView.querySelector("button").focus(); }

    document.querySelectorAll("[data-waitlist]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        wlSource = badgeLocation(btn);
        showError("");
        wl.showModal();
        if (!formView.hidden) email.focus();
      });
    });
    wl.querySelectorAll("[data-wl-close]").forEach(function (b) { b.addEventListener("click", function () { wl.close(); }); });
    // A click on the backdrop lands on the <dialog> itself.
    wl.addEventListener("click", function (ev) { if (ev.target === wl) wl.close(); });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var value = email.value.trim().toLowerCase();
      if (value.length < 6 || value.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
        return showError(wl.dataset.errEmail, email);
      }
      if (!consent.checked) return showError(wl.dataset.errConsent, consent);
      if (form.elements.website.value) return showDone();          // honeypot: a bot, pretend it worked
      showError("");
      submit.disabled = true;
      var lang = pageLang();
      fetch(WL_URL, {
        method: "POST",
        headers: { apikey: WL_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          email: value, platform: "android", consent: true,
          language: WL_LANGS.indexOf(lang) !== -1 ? lang : "en",
          source: ("web_" + wlSource).slice(0, 40),
        }),
      }).then(function (res) {
        if (res.status === 201 || res.status === 409) showDone();
        else showError(wl.dataset.errNetwork);
      }).catch(function () {
        showError(wl.dataset.errNetwork);
      }).then(function () { submit.disabled = false; });
    });
  }

  document.querySelectorAll(".js-year").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  // Remember an explicit language pick so the home page stops auto-redirecting.
  document.querySelectorAll("[data-lang]").forEach(function (a) {
    a.addEventListener("click", function () {
      try { localStorage.setItem("bt_lang", a.getAttribute("data-lang")); } catch (e) {}
    });
  });
  // Section menu (phones): a button toggles .open on its .nav-menu.
  function closeNav() {
    document.querySelectorAll(".nav-menu.open").forEach(function (m) {
      m.classList.remove("open");
      var btn = m.querySelector(".nav-toggle");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }
  document.querySelectorAll(".nav-toggle").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var menu = btn.closest(".nav-menu");
      var open = menu.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  // Close any open menu on an outside click, on Escape, or when a link inside the section menu is
  // followed (so a same-page anchor on a phone doesn't leave the menu hanging open).
  document.addEventListener("click", function (ev) {
    document.querySelectorAll(".lang-menu[open]").forEach(function (d) {
      if (!d.contains(ev.target)) d.removeAttribute("open");
    });
    var menu = document.querySelector(".nav-menu.open");
    if (menu && (!menu.contains(ev.target) || ev.target.closest(".nav-panel a"))) closeNav();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    document.querySelectorAll(".lang-menu[open]").forEach(function (d) { d.removeAttribute("open"); });
    closeNav();
  });
})();
