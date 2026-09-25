/* Local Capacitor shell — works offline inside the APK (no remote redirect on launch). */
(function () {
  "use strict";

  var PRODUCT_ORIGIN = "https://calorievision.ru";
  var WELCOME_KEY = "cv_cap_shell_welcome_v1";
  var MEALS_KEY = "cv_cap_shell_meals_v1";
  /** Must match src/lib/capacitor-login-flag.ts / capacitor-resume.ts */
  var LOGGED_IN_KEY = "cv_cap_logged_in_v1";
  var RESUME_TOKEN_KEY = "cv_cap_resume_token_v1";
  var SKIP_AUTO_RESTORE_KEY = "cv_cap_skip_auto_restore";
  var KCAL_GOAL = 2000;

  var SLIDES = [
    {
      emoji: "📷",
      title: "Сфотографируйте еду",
      body: "Тарелка, этикетка или штрихкод — оценка порции и КБЖУ прямо на телефоне.",
    },
    {
      emoji: "📒",
      title: "Дневник под рукой",
      body: "Рацион, вода, вес и серия дней — цельный продукт, а не вкладка браузера.",
    },
    {
      emoji: "🏋️",
      title: "Тренировки в зале",
      body: "Подходы, шаблоны, суперсеты и прогрессия — журнал тренировок в том же приложении.",
    },
    {
      emoji: "📶",
      title: "Не теряется офлайн",
      body: "Локальный черновик на устройстве. После входа — полный дневник и зал в облаке.",
    },
    {
      emoji: "✨",
      title: "Полностью бесплатно",
      body: "Ведите дневник и тренировки без подписки. Веб — зеркало, не замена приложению.",
    },
  ];

  var DEMO_MEALS = [
    { name: "Овсянка с ягодами", kcal: 320, p: 12, f: 8, c: 48 },
    { name: "Куриный салат", kcal: 410, p: 38, f: 14, c: 22 },
    { name: "Греческий йогурт", kcal: 150, p: 14, f: 4, c: 12 },
  ];

  var state = {
    slide: 0,
    meals: [],
  };

  function $(id) {
    return document.getElementById(id);
  }

  function show(id) {
    ["screen-boot", "screen-welcome", "screen-home", "screen-stats"].forEach(function (sid) {
      var el = $(sid);
      if (!el) return;
      var on = sid === id;
      el.classList.toggle("hidden", !on);
      el.hidden = !on;
    });
  }

  function readMeals() {
    try {
      var raw = localStorage.getItem(MEALS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeMeals(list) {
    state.meals = list;
    try {
      localStorage.setItem(MEALS_KEY, JSON.stringify(list));
    } catch (e) {
      /* ignore */
    }
    renderMeals();
  }

  function totals() {
    return state.meals.reduce(
      function (acc, m) {
        acc.kcal += Number(m.kcal) || 0;
        acc.p += Number(m.p) || 0;
        acc.f += Number(m.f) || 0;
        acc.c += Number(m.c) || 0;
        return acc;
      },
      { kcal: 0, p: 0, f: 0, c: 0 },
    );
  }

  function renderMeals() {
    var list = $("meal-list");
    var empty = $("meal-empty");
    var t = totals();
    $("kcal-eaten").textContent = String(Math.round(t.kcal));
    $("kcal-goal").textContent = String(KCAL_GOAL);
    $("m-p").textContent = String(Math.round(t.p));
    $("m-f").textContent = String(Math.round(t.f));
    $("m-c").textContent = String(Math.round(t.c));
    $("stats-count").textContent = String(state.meals.length);

    var circ = 2 * Math.PI * 52;
    var pct = Math.min(1, t.kcal / KCAL_GOAL);
    $("kcal-ring").style.strokeDasharray = String(circ);
    $("kcal-ring").style.strokeDashoffset = String(circ * (1 - pct));

    list.innerHTML = "";
    state.meals.forEach(function (m) {
      var li = document.createElement("li");
      li.innerHTML =
        "<div><strong></strong><span></span></div><span class='kcal'></span>";
      li.querySelector("strong").textContent = m.name;
      li.querySelector("span").textContent =
        "Б " + Math.round(m.p) + " · Ж " + Math.round(m.f) + " · У " + Math.round(m.c);
      li.querySelector(".kcal").textContent = Math.round(m.kcal) + " ккал";
      list.appendChild(li);
    });
    empty.classList.toggle("hidden", state.meals.length > 0);
    empty.hidden = state.meals.length > 0;
  }

  function renderWelcome() {
    var s = SLIDES[state.slide] || SLIDES[0];
    $("welcome-emoji").textContent = s.emoji;
    $("welcome-title").textContent = s.title;
    $("welcome-body").textContent = s.body;
    var dots = $("welcome-dots");
    dots.innerHTML = "";
    SLIDES.forEach(function (_s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", i === state.slide ? "true" : "false");
      b.addEventListener("click", function () {
        state.slide = i;
        renderWelcome();
      });
      dots.appendChild(b);
    });
    $("welcome-next").textContent =
      state.slide >= SLIDES.length - 1 ? "В дневник" : "Дальше";
  }

  function markWelcomeSeen() {
    try {
      localStorage.setItem(WELCOME_KEY, "1");
    } catch (e) {
      /* ignore */
    }
  }

  function hasWelcomeSeen() {
    try {
      return localStorage.getItem(WELCOME_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function openHome() {
    markWelcomeSeen();
    show("screen-home");
    renderMeals();
  }

  /**
   * Android WebView often reports navigator.onLine=false even with working network.
   * Never gate navigation on onLine alone — probe the product origin.
   * Prefer mode:no-cors so opaque success still means the host was reached.
   */
  function probeOnline(timeoutMs) {
    var ms = typeof timeoutMs === "number" ? timeoutMs : 4000;
    return new Promise(function (resolve) {
      var done = false;
      function finish(ok) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(ok);
      }
      var timer = setTimeout(function () {
        finish(false);
      }, ms);
      var url = PRODUCT_ORIGIN + "/favicon.ico?cv_probe=" + Date.now();
      // no-cors: opaque 200 still resolves — proves connectivity without CORS headers.
      fetch(url, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        mode: "no-cors",
      })
        .then(function () {
          finish(true);
        })
        .catch(function () {
          var img = new Image();
          img.onload = function () {
            finish(true);
          };
          img.onerror = function () {
            finish(false);
          };
          img.src = PRODUCT_ORIGIN + "/favicon.ico?cv_img=" + Date.now();
        });
    });
  }

  function goOfflineStub() {
    try {
      sessionStorage.setItem(SKIP_AUTO_RESTORE_KEY, "1");
    } catch (e) {
      /* ignore */
    }
    window.location.replace("./offline.html");
  }

  function consumeSkipAutoRestore() {
    try {
      if (sessionStorage.getItem(SKIP_AUTO_RESTORE_KEY) === "1") {
        sessionStorage.removeItem(SKIP_AUTO_RESTORE_KEY);
        return true;
      }
    } catch (e) {
      /* ignore */
    }
    return false;
  }

  async function openProductLogin() {
    var hint = $("demo-hint");
    if (hint) hint.textContent = "Проверяем сеть…";
    var ok = await probeOnline(4500);
    if (!ok) {
      goOfflineStub();
      return;
    }
    window.location.href = PRODUCT_ORIGIN + "/login/";
  }

  async function openProductRation() {
    var ok = await probeOnline(4500);
    if (!ok) {
      goOfflineStub();
      return;
    }
    // Top-level navigation so calorievision.ru session cookies are sent.
    window.location.replace(PRODUCT_ORIGIN + "/ration/");
  }

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  /** Wait until Capacitor Preferences is injectable (bridge can lag after splash). */
  async function waitForPreferences(timeoutMs) {
    var started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        var Cap = window.Capacitor;
        if (Cap) {
          var Prefs =
            (Cap.Plugins && Cap.Plugins.Preferences) ||
            (typeof Cap.registerPlugin === "function" ? Cap.registerPlugin("Preferences") : null);
          if (Prefs && typeof Prefs.get === "function") return Prefs;
        }
      } catch (e) {
        /* retry */
      }
      await sleep(50);
    }
    return null;
  }

  async function prefsGet(Prefs, key) {
    try {
      var result = await Prefs.get({ key: key });
      return result && result.value != null ? String(result.value) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Previously logged-in users: re-mint session cookies via resume token, then /ration.
   * Prefer window.CvSession (works even before Capacitor Preferences is ready).
   * Soft-fail to local shell when the network probe fails — do not dump on offline.html
   * during boot. After errorPath/offline stub we skip one auto-restore to break the bounce.
   */
  async function tryRestoreSession() {
    if (consumeSkipAutoRestore()) {
      var skipHint = $("demo-hint");
      if (skipHint) {
        skipHint.textContent =
          "Облако не открылось — локальный черновик. Нажмите «Войти», когда будете готовы.";
      }
      return false;
    }

    function cvGet(key) {
      try {
        if (window.CvSession && typeof window.CvSession.get === "function") {
          var v = window.CvSession.get(key);
          return v != null && v !== "" ? String(v) : null;
        }
      } catch (e) {
        /* ignore */
      }
      return null;
    }

    var resume = cvGet(RESUME_TOKEN_KEY);
    var flagged = cvGet(LOGGED_IN_KEY) === "1";

    var Prefs = null;
    if (!(resume && resume.length > 10) && !flagged) {
      Prefs = await waitForPreferences(2500);
      if (Prefs) {
        resume = await prefsGet(Prefs, RESUME_TOKEN_KEY);
        flagged = (await prefsGet(Prefs, LOGGED_IN_KEY)) === "1";
      }
    }

    if (!(resume && resume.length > 10) && !flagged) {
      return false;
    }

    // Have credentials — only leave the shell when the product is reachable.
    var ok = await probeOnline(5000);
    if (!ok) {
      var hint = $("demo-hint");
      if (hint) {
        hint.textContent =
          "Сеть пока недоступна — локальный черновик. Войдите снова, когда появится интернет.";
      }
      return false;
    }

    if (resume && resume.length > 10) {
      // Mark skip so a failed navigation → offline → back to shell does not loop.
      try {
        sessionStorage.setItem(SKIP_AUTO_RESTORE_KEY, "1");
      } catch (e) {
        /* ignore */
      }
      window.location.replace(
        PRODUCT_ORIGIN + "/api/auth/capacitor-resume?token=" + encodeURIComponent(resume),
      );
      return true;
    }
    try {
      sessionStorage.setItem(SKIP_AUTO_RESTORE_KEY, "1");
    } catch (e) {
      /* ignore */
    }
    await openProductRation();
    return true;
  }

  function wireConnectivity() {
    window.addEventListener("offline", function () {
      var hint = $("demo-hint");
      if (hint) {
        hint.textContent =
          "Похоже, сеть пропала — локальный черновик доступен. Вход и облако — после подключения.";
      }
    });
    window.addEventListener("online", function () {
      var hint = $("demo-hint");
      if (hint) {
        hint.textContent = "Черновик на телефоне. Войдите для полного дневника и зала.";
      }
    });
  }

  async function getCameraPlugin() {
    var Cap = window.Capacitor;
    if (!Cap) return null;
    if (Cap.Plugins && Cap.Plugins.Camera) return Cap.Plugins.Camera;
    if (typeof Cap.registerPlugin === "function") {
      try {
        return Cap.registerPlugin("Camera");
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async function takePhoto() {
    // Real recognition needs the product account — send user to login instead of fake 0 kcal.
    var wrap = $("photo-preview-wrap");
    var img = $("photo-preview");
    var cam = await getCameraPlugin();
    if (cam && typeof cam.getPhoto === "function") {
      try {
        var photo = await cam.getPhoto({
          quality: 88,
          resultType: "dataUrl",
          source: "CAMERA",
          correctOrientation: true,
          width: 1600,
        });
        if (photo && photo.dataUrl) {
          img.src = photo.dataUrl;
          wrap.classList.remove("hidden");
          wrap.hidden = false;
          $("demo-hint").textContent = "Чтобы распознать фото — войдите в аккаунт.";
          return;
        }
      } catch (e) {
        /* fall through */
      }
    }
    void openProductLogin();
  }

  function addDemoMeal() {
    var next = DEMO_MEALS[state.meals.length % DEMO_MEALS.length];
    writeMeals(state.meals.concat([Object.assign({}, next)]));
  }

  function addDemoWorkout() {
    var card = $("workout-card");
    var n = (Number(card.getAttribute("data-sets") || "0") || 0) + 1;
    card.setAttribute("data-sets", String(n));
    card.classList.remove("hidden");
    card.hidden = false;
    $("workout-sets").textContent = n + " подход" + (n === 1 ? "" : n < 5 ? "а" : "ов");
    $("workout-line").textContent =
      "Жим лёжа · " + (80 + (n - 1) * 2.5) + "×8 · отдых 1:30";
  }

  function wire() {
    $("welcome-next").addEventListener("click", function () {
      if (state.slide >= SLIDES.length - 1) {
        openHome();
        return;
      }
      state.slide += 1;
      renderWelcome();
    });
    $("welcome-skip").addEventListener("click", openHome);
    $("btn-camera").addEventListener("click", function () {
      void takePhoto();
    });
    $("btn-demo-meal").addEventListener("click", addDemoMeal);
    $("btn-demo-workout").addEventListener("click", addDemoWorkout);
    $("btn-sync").addEventListener("click", function () {
      void openProductLogin();
    });
    $("btn-sync-stats").addEventListener("click", function () {
      void openProductLogin();
    });
    $("btn-back-home").addEventListener("click", function () {
      show("screen-home");
    });
    $("tab-add").addEventListener("click", function () {
      void takePhoto();
    });
    $("tab-add-2").addEventListener("click", function () {
      show("screen-home");
      void takePhoto();
    });
    document.querySelectorAll(".tab[data-tab='diary']").forEach(function (el) {
      el.addEventListener("click", function () {
        show("screen-home");
      });
    });
    document.querySelectorAll(".tab[data-tab='stats']").forEach(function (el) {
      el.addEventListener("click", function () {
        show("screen-stats");
        renderMeals();
      });
    });
  }

  async function boot() {
    wire();
    wireConnectivity();
    state.meals = readMeals();
    renderWelcome();

    // Brief branded splash, then restore cloud session or local welcome/home.
    await new Promise(function (r) {
      setTimeout(r, 700);
    });

    if (await tryRestoreSession()) {
      return;
    }

    if (hasWelcomeSeen()) {
      openHome();
    } else {
      show("screen-welcome");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      void boot();
    });
  } else {
    void boot();
  }
})();
