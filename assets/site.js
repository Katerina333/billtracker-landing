/* Bill Tracker site script: language memory, language menu, App Store campaign links. */
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
    el.addEventListener("click", function () {
      if (window.plausible) plausible("appstore_click", { props: { lang: pageLang(), location: badgeLocation(el) } });
    });
  });

  document.querySelectorAll(".js-year").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  // Remember an explicit language pick so the home page stops auto-redirecting.
  document.querySelectorAll("[data-lang]").forEach(function (a) {
    a.addEventListener("click", function () {
      try { localStorage.setItem("bt_lang", a.getAttribute("data-lang")); } catch (e) {}
    });
  });
  document.addEventListener("click", function (ev) {
    document.querySelectorAll(".lang-menu[open]").forEach(function (d) {
      if (!d.contains(ev.target)) d.removeAttribute("open");
    });
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") document.querySelectorAll(".lang-menu[open]").forEach(function (d) { d.removeAttribute("open"); });
  });
})();
