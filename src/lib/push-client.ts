/** Client-only helpers for Web Push / iOS PWA diagnostics. */

export const PUSH_PROMPT_DISMISS_KEY = "push-prompt-dismissed";

export type PushStatusKind =
  | "loading"
  | "unsupported"
  | "ios-browser"
  | "ios-old"
  | "denied"
  | "default"
  | "granted";

export type PushCapability = {
  kind: PushStatusKind;
  /** True when the browser can open a permission prompt and subscribe. */
  canSubscribe: boolean;
  isIos: boolean;
  isStandalone: boolean;
  permission: NotificationPermission | "unknown";
  title: string;
  detail: string;
};

function readUa(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

export function isLikelyIos(userAgent = readUa()): boolean {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return true;
  // iPadOS 13+ may report as Mac
  if (typeof navigator !== "undefined") {
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  }
  return false;
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return Boolean(media || iosStandalone);
}

export function isPushApiAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function getPushPromptDismissed(): boolean {
  try {
    return localStorage.getItem(PUSH_PROMPT_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPushPromptDismissed(dismissed: boolean): void {
  try {
    if (dismissed) {
      localStorage.setItem(PUSH_PROMPT_DISMISS_KEY, "1");
    } else {
      localStorage.removeItem(PUSH_PROMPT_DISMISS_KEY);
    }
  } catch {
    // ignore
  }
}

export function getPushCapability(): PushCapability {
  const isIos = isLikelyIos();
  const isStandalone = isStandalonePwa();

  if (typeof window === "undefined") {
    return {
      kind: "loading",
      canSubscribe: false,
      isIos,
      isStandalone,
      permission: "unknown",
      title: "Проверяем…",
      detail: "",
    };
  }

  // iPhone/iPad: Web Push only works for Home Screen PWAs (iOS 16.4+).
  if (isIos && !isStandalone) {
    return {
      kind: "ios-browser",
      canSubscribe: false,
      isIos,
      isStandalone,
      permission: "Notification" in window ? Notification.permission : "unknown",
      title: "Нужен ярлык на Home Screen",
      detail:
        "На iPhone уведомления работают только если приложение открыто с иконки на экране «Домой», а не из Safari. Добавьте сайт на Home Screen и откройте его оттуда.",
    };
  }

  if (!isPushApiAvailable()) {
    if (isIos) {
      return {
        kind: "ios-old",
        canSubscribe: false,
        isIos,
        isStandalone,
        permission: "unknown",
        title: "Нужен iOS 16.4 или новее",
        detail:
          "Web Push для приложений с Home Screen появился в iOS 16.4. Обновите систему или пользуйтесь напоминаниями на Android / компьютере.",
      };
    }
    return {
      kind: "unsupported",
      canSubscribe: false,
      isIos,
      isStandalone,
      permission: "unknown",
      title: "Уведомления недоступны",
      detail: "Этот браузер не поддерживает Web Push.",
    };
  }

  const permission = Notification.permission;

  if (permission === "denied") {
    return {
      kind: "denied",
      canSubscribe: false,
      isIos,
      isStandalone,
      permission,
      title: "Уведомления запрещены",
      detail: isIos
        ? "Разрешите уведомления в Настройки → [Calorie Vision] → Уведомления, затем вернитесь и нажмите «Включить»."
        : "Разрешите уведомления в настройках браузера для этого сайта, затем нажмите «Включить».",
    };
  }

  if (permission === "granted") {
    return {
      kind: "granted",
      canSubscribe: true,
      isIos,
      isStandalone,
      permission,
      title: "Разрешение выдано",
      detail:
        "Можно подключить или обновить подписку, чтобы получать напоминания о завтраке, воде и серии.",
    };
  }

  return {
    kind: "default",
    canSubscribe: true,
    isIos,
    isStandalone,
    permission,
    title: "Напоминания выключены",
    detail: "Утром — про завтрак, днём — про воду, вечером — про серию записей.",
  };
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
