import type { CapacitorConfig } from "@capacitor/cli";

/**
 * RuStore Android shell — **local-first** (webDir), not a remote WebView redirect.
 *
 * Previous Capacitor builds used `server.url → calorievision.ru`, which RuStore
 * still classified as “WebView / перенаправление на сайт”. The APK now opens
 * bundled screens (welcome + demo diary + device camera). Account sync may
 * navigate to the product origin later; cold start never opens the marketing site.
 *
 * OAuth IdP hosts must be in `allowNavigation`, otherwise Capacitor opens them
 * in the system browser (ACTION_VIEW) and login leaves the app.
 */
const config: CapacitorConfig = {
  appId: "ru.calorievision.app",
  appName: "Calorie Vision",
  webDir: "rustore/cap-www",
  // No server.url — launch from APK assets only.
  server: {
    androidScheme: "https",
    allowNavigation: [
      "calorievision.ru",
      "*.calorievision.ru",
      // Google
      "accounts.google.com",
      "accounts.google.ru",
      "*.google.com",
      "*.google.ru",
      // Yandex
      "oauth.yandex.ru",
      "passport.yandex.ru",
      "login.yandex.ru",
      "*.yandex.ru",
      // VK ID
      "id.vk.ru",
      "oauth.vk.com",
      "login.vk.com",
      "*.vk.ru",
      "*.vk.com",
      // Telegram Login / OIDC
      "oauth.telegram.org",
      "*.telegram.org",
    ],
    // Branded stub instead of Android WebView “webpage not available”.
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#F4F7FB",
    // Spoof Chrome Mobile — Google blocks default WebView UA (disallowed_useragent).
    // Keep this looking like stock Chrome (no custom token).
    overrideUserAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 350,
      launchAutoHide: true,
      backgroundColor: "#0F766E",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#F4F7FB",
    },
  },
};

export default config;
