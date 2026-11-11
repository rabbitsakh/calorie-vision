import { isApkWebView } from "@/lib/capacitor-resume";
import {
  trackGamReviewShow,
} from "@/lib/metrika-funnel";
import { RUSTORE_PACKAGE_ID } from "@/lib/android-install";

/**
 * Soft RuStore rating ask.
 *
 * In-app Review SDK (`ru.rustore.sdk:review`) needs a new native APK and only
 * runs when the build was installed from RuStore. The diary itself is the live
 * site inside the existing WebView, so a store link works in already shipped
 * APKs: Capacitor forwards unknown URLs to an Android intent.
 *
 * Deep link and https fallback match RuStore deeplink docs
 * (https://www.rustore.ru/help/sdk/rustore-deeplinks):
 * `rustore://apps.rustore.ru/app/{package}` opens the client;
 * `https://www.rustore.ru/catalog/app/{package}` opens the client when RuStore
 * is installed and the catalog page otherwise.
 */

export const REVIEW_MIN_SUCCESS_DAYS = 3;
export const REVIEW_COOLDOWN_DAYS = 30;
export const REVIEW_MAX_SHOWS = 3;
export const REVIEW_STORAGE_KEY = "cv_rustore_review_v1";
export const REVIEW_MOMENT_EVENT = "cv-rustore-review-moment";

const COOLDOWN_MS = REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export const RUSTORE_REVIEW_COPY = {
  title: "Нравится Calorie Vision?",
  body: "Если дневник помогает, можно оценить приложение в RuStore. Это по желанию.",
  rate: "Оценить в RuStore",
  already: "Уже оценил",
  later: "Позже",
  never: "Не предлагать",
} as const;

export type ReviewMoment = "day-closed" | "chest-opened" | "badge-unlocked";

export type ReviewPromptRecord = {
  shownCount: number;
  lastShownAt: number | null;
  /** «Уже оценил» or «Не предлагать». */
  disabled: boolean;
};

export type ReviewMomentDetail = {
  moment: ReviewMoment;
  /** Calm days credited to the chest. Negative = publisher does not know yet. */
  successDays: number;
};

export function emptyReviewPromptRecord(): ReviewPromptRecord {
  return { shownCount: 0, lastShownAt: null, disabled: false };
}

/** RuStore APK WebView (CvSession / persisted shell). Browser and /try guest are not this. */
export function isAndroidAppShell(): boolean {
  return isApkWebView();
}

export function rustoreReviewLinks(packageId = RUSTORE_PACKAGE_ID): {
  deepLink: string;
  webUrl: string;
} {
  return {
    deepLink: `rustore://apps.rustore.ru/app/${packageId}`,
    webUrl: `https://www.rustore.ru/catalog/app/${packageId}`,
  };
}

function localStore(): Storage | null {
  try {
    const win = (globalThis as { window?: Window }).window;
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function parseReviewPromptRecord(raw: string | null): ReviewPromptRecord {
  if (!raw) return emptyReviewPromptRecord();
  try {
    const data = JSON.parse(raw) as Partial<ReviewPromptRecord>;
    const shownCount = Number(data.shownCount);
    const lastRaw = data.lastShownAt == null ? null : Number(data.lastShownAt);
    return {
      shownCount:
        Number.isFinite(shownCount) && shownCount > 0 ? Math.min(100, Math.floor(shownCount)) : 0,
      lastShownAt:
        lastRaw != null && Number.isFinite(lastRaw) && lastRaw > 0 ? lastRaw : null,
      disabled: data.disabled === true,
    };
  } catch {
    return emptyReviewPromptRecord();
  }
}

export function loadReviewPromptRecord(): ReviewPromptRecord {
  return parseReviewPromptRecord(localStore()?.getItem(REVIEW_STORAGE_KEY) ?? null);
}

export function saveReviewPromptRecord(record: ReviewPromptRecord): void {
  try {
    localStore()?.setItem(REVIEW_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // private mode / quota
  }
}

export function recordReviewShown(record: ReviewPromptRecord, now: number): ReviewPromptRecord {
  return {
    ...record,
    shownCount: record.shownCount + 1,
    lastShownAt: now,
  };
}

export function disableReviewPrompt(record: ReviewPromptRecord): ReviewPromptRecord {
  return { ...record, disabled: true };
}

/**
 * Show only in the Android app, after 3 chest-credited days, at a positive
 * moment, not while food entry is open, at most once per 30 days and 3 times
 * total. A permanent opt-out wins over everything else.
 */
export function shouldShowReviewPrompt(input: {
  androidApp: boolean;
  authenticated: boolean;
  successDays: number;
  moment: ReviewMoment | null;
  foodEntryOpen: boolean;
  record: ReviewPromptRecord;
  now: number;
  cooldownMs?: number;
}): boolean {
  if (!input.androidApp || !input.authenticated) return false;
  if (input.foodEntryOpen || input.moment == null) return false;
  if (!Number.isFinite(input.successDays) || input.successDays < REVIEW_MIN_SUCCESS_DAYS) {
    return false;
  }
  if (input.record.disabled) return false;
  if (input.record.shownCount >= REVIEW_MAX_SHOWS) return false;
  if (input.record.lastShownAt != null) {
    const cooldown = input.cooldownMs ?? COOLDOWN_MS;
    if (input.now - input.record.lastShownAt < cooldown) return false;
  }
  return true;
}

let knownSuccessDays: number | null = null;
let showClaimed = false;
let claimedIndex: number | null = null;

export function rememberSuccessDays(days: number): void {
  if (!Number.isFinite(days) || days < 0) return;
  knownSuccessDays = Math.floor(days);
}

export function getKnownSuccessDays(): number | null {
  return knownSuccessDays;
}

export function publishReviewMoment(detail: ReviewMomentDetail): void {
  if (detail.successDays >= 0) rememberSuccessDays(detail.successDays);
  const win = (globalThis as { window?: Window }).window;
  win?.dispatchEvent(new CustomEvent(REVIEW_MOMENT_EVENT, { detail }));
}

/**
 * Persist one impression. A second call before {@link releaseReviewPromptClaim}
 * returns the same index so React strict-mode remounts do not double-count.
 */
export function claimReviewPromptShow(
  now: number,
  successDays: number,
  moment: ReviewMoment,
): number | null {
  if (showClaimed && claimedIndex != null) return claimedIndex;
  const record = loadReviewPromptRecord();
  const ok = shouldShowReviewPrompt({
    androidApp: true,
    authenticated: true,
    successDays,
    moment,
    foodEntryOpen: false,
    record,
    now,
  });
  if (!ok) return null;
  const next = recordReviewShown(record, now);
  saveReviewPromptRecord(next);
  showClaimed = true;
  claimedIndex = next.shownCount;
  trackGamReviewShow(next.shownCount);
  return next.shownCount;
}

export function releaseReviewPromptClaim(): void {
  showClaimed = false;
  claimedIndex = null;
}

/** Open the RuStore card. https is the fallback when the deep link does not leave the page. */
export function openRuStoreReviewCard(): void {
  const { deepLink, webUrl } = rustoreReviewLinks();
  const doc = (globalThis as { document?: Document }).document;
  const win = (globalThis as { window?: Window }).window;
  if (!doc?.body || !win) return;

  let leftApp = false;
  const onVisibility = () => {
    if (doc.visibilityState === "hidden") leftApp = true;
  };
  doc.addEventListener("visibilitychange", onVisibility);

  const link = doc.createElement("a");
  link.href = deepLink;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  doc.body.appendChild(link);
  link.click();
  link.remove();

  win.setTimeout(() => {
    doc.removeEventListener("visibilitychange", onVisibility);
    if (leftApp || doc.visibilityState === "hidden") return;
    const web = doc.createElement("a");
    web.href = webUrl;
    web.target = "_blank";
    web.rel = "noopener noreferrer";
    web.style.display = "none";
    doc.body.appendChild(web);
    web.click();
    web.remove();
  }, 1500);
}

export function resetReviewPromptForTests(): void {
  knownSuccessDays = null;
  showClaimed = false;
  claimedIndex = null;
  try {
    localStore()?.removeItem(REVIEW_STORAGE_KEY);
  } catch {
    // ignore
  }
}
