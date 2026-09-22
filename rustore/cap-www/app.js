/* Local Capacitor shell — works offline inside the APK (no remote redirect on launch). */
(function () {
  "use strict";

  var PRODUCT_ORIGIN = "https://calorievision.ru";
  var WELCOME_KEY = "cv_cap_shell_welcome_v1";
  var MEALS_KEY = "cv_cap_shell_meals_v1";
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

  function openProductLogin() {
    // After local shell, open the same product for account sync (in-app WebView navigation).
    window.location.href = PRODUCT_ORIGIN + "/login/";
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
    openProductLogin();
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
    $("btn-sync").addEventListener("click", openProductLogin);
    $("btn-sync-stats").addEventListener("click", openProductLogin);
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
    state.meals = readMeals();
    renderWelcome();

    // Brief branded splash, then local welcome or home — never bounce to a website first.
    await new Promise(function (r) {
      setTimeout(r, 700);
    });

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
