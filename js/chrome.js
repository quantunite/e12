/* ==========================================================================
   Shared page chrome for the E-12 network: language, toast, tab highlighting
   and partner-link routing.

   Each page sets these before loading this file:
     window.LYX_BASE  - path back to the site root ("" or "../")
     window.LYX_PAGE  - short name used in analytics ("home", "lifestyle")
     window.LYX_I18N  - Spanish dictionary keyed by data-i18n
     window.LINKS     - partner link map, defaults overridden by site_links
   ========================================================================== */
(function () {
  var I18N_ES = window.LYX_I18N || {};

  /* ------------------------------------------------------------- language */
  window.__lyxT = function (en, es) { return (window.__lyxLang === "es" && es) ? es : en; };

  var langBtn = document.getElementById("langBtn");

  function applyLang(lang) {
    window.__lyxLang = lang;
    document.documentElement.lang = lang;
    if (langBtn) langBtn.textContent = lang === "es" ? "English" : "Español";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      if (!el.dataset.enSrc) el.dataset.enSrc = el.innerHTML;
      el.innerHTML = (lang === "es" && I18N_ES[k]) ? I18N_ES[k] : el.dataset.enSrc;
    });
    try { localStorage.setItem("lyx_lang", lang); } catch (e) {}
    document.dispatchEvent(new CustomEvent("lyxlang"));
  }

  var saved = "en";
  try {
    saved = new URLSearchParams(location.search).get("lang") || localStorage.getItem("lyx_lang") ||
      ((navigator.language || "").toLowerCase().indexOf("es") === 0 ? "es" : "en");
  } catch (e) {}
  applyLang(saved === "es" ? "es" : "en");

  if (langBtn) {
    langBtn.addEventListener("click", function () {
      applyLang(window.__lyxLang === "es" ? "en" : "es");
    });
  }

  /* ---------------------------------------------------------------- toast */
  var toastEl = document.getElementById("toast"), toastTimer;
  window.__lyxToast = function (m) {
    if (!toastEl) return;
    toastEl.textContent = m;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3200);
  };

  /* ---------------------------------------------------- tab highlighting
     Only same-page anchor tabs participate. Tabs that link to another page
     are left alone. */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab[href^="#"]'));
  var sections = tabs
    .map(function (t) { return document.querySelector(t.getAttribute("href")); })
    .filter(Boolean);

  if (sections.length) {
    var markCurrent = function () {
      var best = null, bestTop = Infinity;
      sections.forEach(function (s) {
        if (s.hasAttribute("hidden")) return;
        var top = Math.abs(s.getBoundingClientRect().top - 160);
        if (top < bestTop) { bestTop = top; best = s; }
      });
      tabs.forEach(function (t) {
        if (best && t.getAttribute("href") === "#" + best.id) t.setAttribute("aria-current", "true");
        else t.removeAttribute("aria-current");
      });
    };
    markCurrent();
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { markCurrent(); ticking = false; });
    }, { passive: true });
  }

  /* ------------------------------------------------------------- link safety
     site_links is admin-writable, so only ever hand http(s) to window.open
     or to a media src. A stray javascript: or data: value must stay inert. */
  window.__lyxSafeUrl = function (u) {
    try {
      var p = new URL(u, location.href);
      return (p.protocol === "http:" || p.protocol === "https:") ? p.href : null;
    } catch (e) { return null; }
  };

  /* ------------------------------------------------------- partner routing */
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-link]");
    if (!el) return;
    var key = el.getAttribute("data-link");
    if (!window.LINKS || !(key in window.LINKS)) return;
    ev.preventDefault();

    if (key === "contact") {
      var url = window.LINKS.contact;
      if (!url) { window.__lyxOpenLead && window.__lyxOpenLead("contact"); return; }
      if (/^mailto:/i.test(url)) { location.href = url; return; }
      var safeContact = window.__lyxSafeUrl(url);
      if (safeContact) window.open(safeContact, "_blank", "noopener");
      else window.__lyxOpenLead && window.__lyxOpenLead("contact");
      return;
    }

    var safe = window.LINKS[key] ? window.__lyxSafeUrl(window.LINKS[key]) : null;
    if (!safe) {
      window.__lyxToast(window.__lyxT("This link goes live soon.", "Este enlace estará activo pronto."));
      return;
    }
    window.__lyxTrackClick && window.__lyxTrackClick(key);
    window.open(safe, "_blank", "noopener");
  });
})();
