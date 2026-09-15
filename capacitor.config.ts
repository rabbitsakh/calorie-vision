import type { CapacitorConfig } from "@capacitor/cli";

/**
 * RuStore Android shell (Capacitor) — standalone app chrome around the product.
 * Remote origin is the same product as the website (API + UI), not a marketing redirect.
 * Native: splash, status bar, camera, app lifecycle.
 */
const config: CapacitorConfig = {
  appId: "ru.calorievision.app",
  appName: "Calorie Vision",
  webDir: "rustore/cap-www",
  server: {
    // Product entry — login (or /ration after session). Never marketing landing.
    url: "https://calorievision.ru/login",
    cleartext: false,
    allowNavigation: [
      "calorievision.ru",
      "*.calorievision.ru",
      "accounts.google.com",
      "*.google.com",
      "oauth.telegram.org",
      "id.vk.com",
      "*.vk.com",
      "appleid.apple.com",
    ],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#F4F7FB",
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
