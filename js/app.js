/* ==========================================================================
   Shared backend wiring for the E-12 network (the umbrella page and every
   gate site under it). Uses the one Supabase project and its existing tables
   - auth, site_links, trainings, leads, site_events - so the owner panel
   keeps working unchanged.

   Each page sets window.LYX_BASE ("" at the root, "../" one level down) and
   window.LYX_PAGE (the analytics label) before loading this file.
   ========================================================================== */
(function () {
  if (!window.supabase || !window.E12_CONFIG) return;

  var BASE = window.LYX_BASE || "";
  var PAGE = window.LYX_PAGE || "home";

  var sb = window.supabase.createClient(window.E12_CONFIG.url, window.E12_CONFIG.key);
  var $ = function (id) { return document.getElementById(id); };
  var T = window.__lyxT;
  var toast = window.__lyxToast;

  var session = null, signupMode = false, trainingsCache = [];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Image paths in the trainings table are written relative to the site root
     (e.g. "img/academy-travel.jpg"). Gate pages live a level down, so bare
     relative paths need lifting by LYX_BASE or they 404. */
  function assetUrl(u) {
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u) || u.charAt(0) === "/" || u.indexOf("../") === 0) return u;
    return BASE + u.replace(/^\.\//, "");
  }

  /* ---------------------------------------------------------------- links */
  async function loadLinks() {
    try {
      var r = await sb.from("site_links").select("key,url");
      if (r.data) {
        r.data.forEach(function (row) {
          if (row.url && row.key in LINKS) LINKS[row.key] = row.url;
        });
      }
    } catch (e) { /* defaults stand */ }
    renderIntro();
  }

  /* ------------------------------------------------------- video embedding */
  function embedUrlFor(src) {
    if (!src) return null;
    var yt = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    if (yt) return "https://www.youtube.com/embed/" + yt[1];
    var vm = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return "https://player.vimeo.com/video/" + vm[1];
    return null;
  }

  /* The Watch section only exists once there is something to watch. */
  function renderIntro() {
    var sec = $("watch"), frame = $("introFrame");
    if (!sec || !frame) return;
    /* The section always shows. Without a video it keeps its Coming soon
       panel, which is the promise; with one it swaps to the player. */
    var src = LINKS.introVideo;
    if (!src) return;
    var embed = embedUrlFor(src);
    var direct = embed ? null : window.__lyxSafeUrl(src);
    if (!embed && !direct) return;
    frame.innerHTML = embed
      ? '<iframe src="' + esc(embed) + '" title="Members briefing" allow="accelerometer; autoplay; ' +
        'clipboard-write; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>'
      : '<video controls playsinline preload="metadata" src="' + esc(direct) + '"></video>';
  }

  var vplayer = $("vplayer"), vvideo = $("vplayerVideo"), vframe = $("vplayerFrame");

  function playTraining(t) {
    var locked = t.badge !== "free" && !session;
    if (locked) {
      toast(T("That lesson is for members. Join or sign in to watch it.",
              "Esa lección es para miembros. Únete o entra para verla."));
      return;
    }
    var embed = embedUrlFor(t.video_url);
    if (embed) {
      vvideo.hidden = true; vvideo.removeAttribute("src");
      vframe.hidden = false;
      vframe.innerHTML = '<iframe src="' + esc(embed) + '" title="' + esc(t.title) + '" allow="accelerometer; ' +
        'autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    } else if (window.__lyxSafeUrl(t.video_url)) {
      vframe.hidden = true; vframe.innerHTML = "";
      vvideo.hidden = false; vvideo.src = window.__lyxSafeUrl(t.video_url);
      vvideo.play().catch(function () {});
    } else {
      toast(T("This lesson is being added.", "Esta lección se está agregando."));
      return;
    }
    vplayer.classList.add("open");
    $("vplayerClose").focus();
  }

  function closePlayer() {
    vplayer.classList.remove("open");
    try { vvideo.pause(); } catch (e) {}
    vvideo.removeAttribute("src");
    vframe.innerHTML = "";
  }
  $("vplayerClose").addEventListener("click", closePlayer);

  /* -------------------------------------------------------------- academy */
  async function renderAcademy() {
    var grid = $("academyGrid");
    if (!grid) return;
    var r;
    try {
      r = await sb.from("trainings").select("*").eq("published", true).order("sort");
    } catch (e) { return; }
    if (r.error || !r.data || !r.data.length) return;

    trainingsCache = r.data;
    grid.innerHTML = r.data.map(function (t) {
      /* A lesson with no video yet is promised, not broken: it gets a
         Coming soon tag and is not presented as playable. */
      var soon = !t.video_url;
      var pill = soon
        ? '<span class="pill pill-soon">' + T("Coming soon", "Próximamente") + "</span>"
        : t.badge === "free"
          ? '<span class="pill pill-free">' + T("Free to watch", "Gratis") + "</span>"
          : '<span class="pill pill-members">' + T("Members only", "Solo miembros") + "</span>";
      var img = assetUrl(t.image_url) || (BASE + "img/academy-travel.jpg");
      var attrs = soon
        ? 'class="card is-soon"'
        : 'class="card" tabindex="0" role="button" aria-label="' + esc(t.title) + '"';
      return "<article " + attrs + ' data-training-id="' + esc(t.id) + '">' +
        '<div class="card-img"><img src="' + esc(img) + '" alt="" loading="lazy">' +
        '<span class="card-play" aria-hidden="true"></span></div>' +
        '<div class="card-body">' + pill + "<h3>" + esc(t.title) + "</h3></div>" +
        "</article>";
    }).join("");

    grid.querySelectorAll(".card:not(.is-soon)").forEach(function (card) {
      function go() {
        var t = trainingsCache.find(function (x) { return x.id === card.getAttribute("data-training-id"); });
        if (t) playTraining(t);
      }
      card.addEventListener("click", go);
      card.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); }
      });
    });
  }

  /* ----------------------------------------------------------------- auth */
  var authModal = $("authModal"), authBtn = $("authBtn"), authMsg = $("authMsg");

  function msg(text, cls) { authMsg.textContent = text; authMsg.className = "msg" + (cls ? " " + cls : ""); }

  function setAuthUI() {
    authBtn.textContent = session ? T("Sign out", "Salir") : T("Sign in", "Entrar");
  }

  function setMode(signup) {
    signupMode = signup;
    $("authTitle").textContent = signup ? T("Create an account", "Crea una cuenta") : T("Sign in", "Entrar");
    $("authSubmit").textContent = signup ? T("Create account", "Crear cuenta") : T("Sign in", "Entrar");
    $("authPass").setAttribute("autocomplete", signup ? "new-password" : "current-password");
    $("authSwitch").innerHTML = signup
      ? T("Already a member?", "&iquest;Ya eres miembro?") + ' <a id="authToggle" tabindex="0" role="button">' +
        T("Sign in", "Entrar") + "</a>"
      : T("New here?", "&iquest;Nuevo por aqu&iacute;?") + ' <a id="authToggle" tabindex="0" role="button">' +
        T("Create an account", "Crea una cuenta") + "</a>";
  }

  document.addEventListener("lyxlang", function () {
    setAuthUI();
    setMode(signupMode);
    if (trainingsCache.length) renderAcademy();
    renderIntro();
  });

  function openAuth() {
    authModal.classList.add("open"); msg("");
    setTimeout(function () { $("authEmail").focus(); }, 60);
  }
  function closeAuth() { authModal.classList.remove("open"); }

  authBtn.addEventListener("click", async function () {
    if (session) {
      await sb.auth.signOut();
      session = null;
      setAuthUI();
      $("ownerLink").hidden = true;
      toast(T("Signed out.", "Sesión cerrada."));
      return;
    }
    setMode(false);
    openAuth();
  });

  $("authClose").addEventListener("click", closeAuth);
  authModal.addEventListener("click", function (ev) { if (ev.target === authModal) closeAuth(); });
  authModal.addEventListener("click", function (ev) {
    if (ev.target && ev.target.id === "authToggle") { setMode(!signupMode); msg(""); }
  });

  $("authSubmit").addEventListener("click", async function () {
    var email = $("authEmail").value.trim(), pass = $("authPass").value;
    if (!email || !pass) { msg(T("Enter your email and password.", "Escribe tu correo y contraseña."), "err"); return; }
    msg(T("One moment...", "Un momento..."));
    var r = signupMode
      ? await sb.auth.signUp({ email: email, password: pass })
      : await sb.auth.signInWithPassword({ email: email, password: pass });
    if (r.error) { msg(r.error.message, "err"); return; }
    if (signupMode && !r.data.session) {
      msg(T("Check your email to confirm your account.", "Revisa tu correo para confirmar tu cuenta."), "ok");
      return;
    }
    session = r.data.session;
    setAuthUI();
    closeAuth();
    await loadRole();
    renderAcademy();
    toast(T("You are signed in.", "Ya entraste."));
  });

  $("authPass").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") $("authSubmit").click();
  });

  async function loadRole() {
    if (!session) return;
    try {
      var r = await sb.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      $("ownerLink").hidden = !(r.data && r.data.role === "admin");
    } catch (e) {}
  }

  /* ----------------------------------------------------------------- lead */
  var leadModal = $("leadModal"), leadSource = "contact";

  window.__lyxOpenLead = function (source) {
    leadSource = source || "contact";
    $("leadMsg").textContent = "";
    leadModal.classList.add("open");
    setTimeout(function () { $("leadName").focus(); }, 60);
  };
  function closeLead() { leadModal.classList.remove("open"); }
  $("leadClose").addEventListener("click", closeLead);
  leadModal.addEventListener("click", function (ev) { if (ev.target === leadModal) closeLead(); });

  $("leadSubmit").addEventListener("click", async function () {
    var name = $("leadName").value.trim(), email = $("leadEmail").value.trim(), phone = $("leadPhone").value.trim();
    var out = $("leadMsg");
    if (!name || !email) {
      out.textContent = T("Please add your name and email.", "Escribe tu nombre y tu correo.");
      out.className = "msg err";
      return;
    }
    out.textContent = T("Sending...", "Enviando..."); out.className = "msg";
    var r = await sb.from("leads").insert({ name: name, email: email, phone: phone, source: leadSource });
    if (r.error) { out.textContent = r.error.message; out.className = "msg err"; return; }
    out.textContent = T("Thank you. We will be in touch.", "Gracias. Te contactaremos."); out.className = "msg ok";
    setTimeout(closeLead, 1600);
  });

  /* Escape closes whatever is open. */
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    if (vplayer.classList.contains("open")) return closePlayer();
    if (authModal.classList.contains("open")) return closeAuth();
    if (leadModal.classList.contains("open")) return closeLead();
  });

  /* ------------------------------------------------------------ analytics
     First-party, no cookies, no PII. Records only on the real hostnames so
     localhost and previews never pollute the numbers. */
  var host = location.hostname;
  var isProd = host === "e1212.com" || host === "www.e1212.com" ||
               host === "lyfestylex.com" || host === "www.lyfestylex.com";

  window.__lyxTrackClick = function (key) {
    if (!isProd) return;
    try { sb.from("site_events").insert({ type: "click", path: PAGE + ":" + key, referrer: "" }).then(function () {}); }
    catch (e) {}
  };

  if (isProd) {
    try {
      sb.from("site_events").insert({
        type: "view",
        path: PAGE,
        referrer: (document.referrer || "").slice(0, 300)
      }).then(function () {});
    } catch (e) {}
  }

  /* ----------------------------------------------------------------- boot */
  (async function boot() {
    try {
      var s = await sb.auth.getSession();
      session = s.data ? s.data.session : null;
    } catch (e) {}
    setAuthUI();
    setMode(false);
    await loadRole();
    await loadLinks();
    await renderAcademy();
  })();
})();
