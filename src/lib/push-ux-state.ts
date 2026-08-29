import type { PushCapability, PushStatusKind } from "@/lib/push-client";

/** Combined client capability + server subscription — drives profile push UX. */
export type PushUxStateId =
  | "loading"
  | "install-needed"
  | "upgrade-ios"
  | "unsupported"
  | "permission-denied"
  | "ready-to-enable"
  | "needs-resync"
  | "active";

export type PushUxAction = "enable" | "resync" | "install" | "reinstall" | "none";

export type PushUxState = {
  id: PushUxStateId;
  /** Short step label for the matrix strip. */
  stepLabel: string;
  title: string;
  detail: string;
  primaryAction: PushUxAction;
  secondaryAction: PushUxAction;
  tone: "neutral" | "tip" | "warn" | "ok";
};

export type ResolvePushUxInput = {
  capability: PushCapability;
  serverSubscribed: boolean | null;
};

const MATRIX_ORDER: PushUxStateId[] = [
  "install-needed",
  "ready-to-enable",
  "active",
];

/** Ordered steps shown when the user is on an installable path (iOS/Android PWA). */
export function pushUxMatrixSteps(activeId: PushUxStateId): Array<{
  id: PushUxStateId;
  label: string;
  status: "done" | "current" | "todo" | "blocked";
}> {
  const blocked: PushUxStateId[] =
    activeId === "permission-denied" || activeId === "upgrade-ios" || activeId === "unsupported"
      ? [activeId]
      : [];

  if (blocked.length) {
    return [
      {
        id: activeId,
        label:
          activeId === "permission-denied"
            ? "Разрешение"
            : activeId === "upgrade-ios"
              ? "Обновить iOS"
              : "Недоступно",
        status: "blocked",
      },
    ];
  }

  const currentIndex =
    activeId === "needs-resync"
      ? 2
      : activeId === "loading"
        ? -1
        : MATRIX_ORDER.indexOf(activeId === "ready-to-enable" ? "ready-to-enable" : activeId);

  return MATRIX_ORDER.map((id, index) => {
    const label =
      id === "install-needed"
        ? "Ярлык"
        : id === "ready-to-enable"
          ? "Разрешение"
          : "Подписка";
    if (activeId === "needs-resync" && id === "active") {
      return { id, label: "Синхронизация", status: "current" as const };
    }
    if (currentIndex < 0) {
      return { id, label, status: "todo" as const };
    }
    if (index < currentIndex) {
      return { id, label, status: "done" as const };
    }
    if (index === currentIndex) {
      return { id, label, status: "current" as const };
    }
    return { id, label, status: "todo" as const };
  });
}

export function resolvePushUxState(input: ResolvePushUxInput): PushUxState {
  const { capability: cap, serverSubscribed } = input;

  if (cap.kind === "loading") {
    return {
      id: "loading",
      stepLabel: "…",
      title: "Проверяем…",
      detail: "",
      primaryAction: "none",
      secondaryAction: "none",
      tone: "neutral",
    };
  }

  if (cap.kind === "ios-browser") {
    return {
      id: "install-needed",
      stepLabel: "Ярлык",
      title: cap.title,
      detail: cap.detail,
      primaryAction: "install",
      secondaryAction: "none",
      tone: "tip",
    };
  }

  if (cap.kind === "ios-old") {
    return {
      id: "upgrade-ios",
      stepLabel: "iOS",
      title: cap.title,
      detail: cap.detail,
      primaryAction: "none",
      secondaryAction: "none",
      tone: "warn",
    };
  }

  if (cap.kind === "unsupported") {
    return {
      id: "unsupported",
      stepLabel: "—",
      title: cap.title,
      detail: cap.detail,
      primaryAction: "none",
      secondaryAction: "none",
      tone: "warn",
    };
  }

  if (cap.kind === "denied") {
    return {
      id: "permission-denied",
      stepLabel: "Разрешение",
      title: cap.title,
      detail: cap.isIos
        ? `${cap.detail} Если пункта нет — удалите иконку с экрана «Домой» и добавьте сайт заново.`
        : cap.detail,
      primaryAction: cap.isIos ? "reinstall" : "none",
      secondaryAction: "none",
      tone: "warn",
    };
  }

  if (cap.kind === "granted" && serverSubscribed === false) {
    return {
      id: "needs-resync",
      stepLabel: "Синхронизация",
      title: "Разрешение есть, подписки на сервере нет",
      detail:
        "Часто после обновления приложения или смены сети. Нажмите «Обновить подписку» — восстановим напоминания без повторной установки.",
      primaryAction: "resync",
      secondaryAction: cap.isIos ? "reinstall" : "install",
      tone: "tip",
    };
  }

  if (cap.kind === "granted" && serverSubscribed === true) {
    return {
      id: "active",
      stepLabel: "Готово",
      title: "Напоминания включены",
      detail: "Это устройство получает пуши. Можно проверить тестовым уведомлением или обновить подписку.",
      primaryAction: "resync",
      secondaryAction: "none",
      tone: "ok",
    };
  }

  // default permission, or granted while server status still loading
  if (cap.kind === "granted") {
    return {
      id: "ready-to-enable",
      stepLabel: "Подписка",
      title: "Разрешение выдано",
      detail: "Осталось сохранить подписку на сервере — нажмите «Включить напоминания».",
      primaryAction: "enable",
      secondaryAction: "none",
      tone: "tip",
    };
  }

  return {
    id: "ready-to-enable",
    stepLabel: "Разрешение",
    title: cap.title,
    detail: cap.detail,
    primaryAction: "enable",
    secondaryAction: "install",
    tone: "neutral",
  };
}

export function pushActionLabel(action: PushUxAction, active = false): string {
  switch (action) {
    case "enable":
      return "Включить напоминания";
    case "resync":
      return active ? "Обновить подписку" : "Обновить подписку";
    case "install":
      return "Как установить";
    case "reinstall":
      return "Переустановить приложение";
    default:
      return "";
  }
}

/** Exported for tests — maps capability kind without server. */
export function capabilityKindToUxHint(kind: PushStatusKind): PushUxStateId | "unknown" {
  switch (kind) {
    case "loading":
      return "loading";
    case "ios-browser":
      return "install-needed";
    case "ios-old":
      return "upgrade-ios";
    case "unsupported":
      return "unsupported";
    case "denied":
      return "permission-denied";
    case "default":
      return "ready-to-enable";
    case "granted":
      return "ready-to-enable";
    default:
      return "unknown";
  }
}
