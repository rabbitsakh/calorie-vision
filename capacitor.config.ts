import type { CapacitorConfig } from "@capacitor/cli";

/**
 * RuStore Android shell (Capacitor) — standalone app chrome around the product.
 * Remote origin is the same product as the website (API + UI), not a marketing redirect.
 * Native: splash, status bar, camera, app lifecycle.
 *
 * Google OAuth must NOT run inside the WebView (HTTP 400 disallowed_useragent).
 * Login opens Chrome Custom Tabs; App Links return /api/auth/callback/* into the app.
 */
const config: CapacitorConfig = {
  appId: "ru.calorievision.app",
  appName: "Calorie Vision",
  webDir: "rustore/cap-www",
  server: {
    // First-run welcome slider, then /login. Never marketing landing.
    url: "https://calorievision.ru/welcome",
    cleartext: false,
    // Keep only our origin in-WebView. Do NOT list accounts.google.com —
    // OAuth goes through @capacitor/browser (Custom Tabs).
    allowNavigation: ["calorievision.ru", "*.calorievision.ru"],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#F4F7FB",
    // Avoid "; wv)" in UA for any accidental in-WebView Google hits.
    overrideUserAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 400,
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
