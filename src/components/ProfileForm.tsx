"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AvatarFrame } from "@/components/AvatarFrame";
import { BugReportSheet } from "@/components/BugReportSheet";
import { SceneSkeleton } from "@/components/SceneSkeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { ACCOUNT_DELETE_CONFIRM } from "@/lib/account-delete-confirm";
import { clearCapacitorResumeToken } from "@/lib/capacitor-resume";
import { isLikelyOfflineError } from "@/lib/connectivity";
import { resolvePlanNorm } from "@/lib/day-norm";
import {
  ACTIVITY_OPTIONS,
  SEX_OPTIONS,
  isActivityLevel,
  isSex,
  isWeightGoal,
  type ActivityLevel,
  type Sex,
} from "@/lib/diet";
import { WATER_DAILY_TARGET_ML } from "@/lib/water-target";
import { detectDeviceTimezone } from "@/lib/device-timezone";
import {
  clearOfflineAccountCache,
  readOfflineAccountCache,
  writeOfflineAccountCache,
} from "@/lib/offline-account-cache";
import { clearOfflineSessionCache } from "@/lib/offline-session";
import { formatPhoneDisplay } from "@/lib/phone";
import { withBasePath } from "@/lib/paths";
import { notifyDietTargetsChanged } from "@/lib/diet-refresh";
import {
  buildReferralShareUrl,
  telegramShareUrl,
  vkShareUrl,
} from "@/lib/referral";
import { clearTimezoneCache } from "@/lib/use-timezone";
import { ExportSettings } from "@/components/ExportSettings";
import { MedicalDisclaimerNote } from "@/components/MedicalDisclaimerNote";
import { ALLERGEN_OPTIONS } from "@/lib/allergens";

type AccountResponse = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  image: string | null;
  timezone: string | null;
  sex: Sex | null;
  heightCm: number | null;
  birthYear: number | null;
  activityLevel: ActivityLevel | null;
  fiberTargetG: number | null;
  sugarTargetG: number | null;
  waterTargetMl: number | null;
  weeklyDigestEmail?: boolean;
  allergens?: string[];
  linkedProviders: string[];
  emailLocked: boolean;
  referralCode?: string;
  error?: string;
};

/** D4: nested settings rows — hairline, not stacked cards. */
function ProfileCollapse({
  id,
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  id?: string;
  title: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="profile-settings__nested scroll-mt-3">
      <button
        type="button"
        className="profile-settings__row"
        aria-expanded={open}
        onClick={onToggle}
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">{hint}</p>
        </div>
        <span
          className={`shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? <div className="profile-settings__nested-body">{children}</div> : null}
    </section>
  );
}

const COMMON_TIMEZONES = [
  { label: "Калининград (UTC+2)", value: "Europe/Kaliningrad" },
  { label: "Москва, Санкт-Петербург (UTC+3)", value: "Europe/Moscow" },
  { label: "Самара (UTC+4)", value: "Europe/Samara" },
  { label: "Екатеринбург (UTC+5)", value: "Asia/Yekaterinburg" },
  { label: "Омск (UTC+6)", value: "Asia/Omsk" },
  { label: "Бишкек (UTC+6)", value: "Asia/Bishkek" },
  { label: "Красноярск (UTC+7)", value: "Asia/Krasnoyarsk" },
  { label: "Иркутск (UTC+8)", value: "Asia/Irkutsk" },
  { label: "Якутск (UTC+9)", value: "Asia/Yakutsk" },
  { label: "Владивосток (UTC+10)", value: "Asia/Vladivostok" },
  { label: "Сахалин, Южно-Сахалинск (UTC+11)", value: "Asia/Sakhalin" },
  { label: "Магадан (UTC+11)", value: "Asia/Magadan" },
  { label: "Камчатка (UTC+12)", value: "Asia/Kamchatka" },
  { label: "Минск (UTC+3)", value: "Europe/Minsk" },
  { label: "Киев (UTC+2/3)", value: "Europe/Kyiv" },
  { label: "Алматы (UTC+5)", value: "Asia/Almaty" },
  { label: "Ташкент (UTC+5)", value: "Asia/Tashkent" },
  { label: "Баку (UTC+4)", value: "Asia/Baku" },
  { label: "Тбилиси (UTC+4)", value: "Asia/Tbilisi" },
  { label: "Лондон (UTC+0/1)", value: "Europe/London" },
  { label: "Берлин, Варшава (UTC+1/2)", value: "Europe/Berlin" },
  { label: "Дубай (UTC+4)", value: "Asia/Dubai" },
];

export function ProfileForm() {
  const { update } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | "">("");
  const [fiberTargetG, setFiberTargetG] = useState("");
  const [sugarTargetG, setSugarTargetG] = useState("");
  const [waterTargetMl, setWaterTargetMl] = useState("");
  const [weeklyDigestEmail, setWeeklyDigestEmail] = useState(false);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [emailLocked, setEmailLocked] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [exportAckChecked, setExportAckChecked] = useState(false);
  const [deleteRiskChecked, setDeleteRiskChecked] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineView, setOfflineView] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);

  const applyAccount = useCallback((data: AccountResponse) => {
    setFirstName(data.firstName);
    setLastName(data.lastName);
    setEmail(data.email ?? "");
    setPhone(data.phone ? formatPhoneDisplay(data.phone) : "");
    setImage(data.image);
    const savedTz = data.timezone?.trim() || "";
    setTimezone(savedTz || detectDeviceTimezone() || "");
    setSex(isSex(data.sex) ? data.sex : "");
    setHeightCm(data.heightCm ? String(data.heightCm) : "");
    setBirthYear(data.birthYear ? String(data.birthYear) : "");
    setActivityLevel(isActivityLevel(data.activityLevel) ? data.activityLevel : "");
    setFiberTargetG(data.fiberTargetG != null ? String(data.fiberTargetG) : "");
    setSugarTargetG(data.sugarTargetG != null ? String(data.sugarTargetG) : "");
    setWaterTargetMl(data.waterTargetMl != null ? String(data.waterTargetMl) : "");
    setWeeklyDigestEmail(Boolean(data.weeklyDigestEmail));
    setAllergens(data.allergens ?? []);
    setEmailLocked(data.emailLocked);
    setReferralCode(data.referralCode?.trim() || "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOfflineView(false);

    try {
      const response = await fetch(withBasePath("/api/account"));
      const data = (await response.json()) as AccountResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось загрузить профиль");
      }

      applyAccount(data);
      writeOfflineAccountCache(data as unknown as Record<string, unknown>);
    } catch (err) {
      const cached = readOfflineAccountCache<AccountResponse>();
      if (cached && isLikelyOfflineError(err)) {
        applyAccount(cached);
        setOfflineView(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    } finally {
      setLoading(false);
    }
  }, [applyAccount]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(withBasePath("/api/profile"));
        if (!response.ok) return;
        const data = (await response.json()) as {
          goal?: string | null;
          goalPace?: string | null;
          currentWeightKg?: number | null;
        };
        if (cancelled) return;
        if (!isWeightGoal(data.goal) || data.currentWeightKg == null) {
          setPlanNormText(null);
          return;
        }
        const norm = resolvePlanNorm(data.currentWeightKg, {
          goal: data.goal,
          goalPace: data.goalPace,
          sex: sex || null,
          heightCm: heightCm.trim() ? Number(heightCm) : null,
          birthYear: birthYear.trim() ? Number(birthYear) : null,
          activityLevel: activityLevel || null,
          fiberTargetG: fiberTargetG.trim() ? Number(fiberTargetG) : null,
          sugarTargetG: sugarTargetG.trim() ? Number(sugarTargetG) : null,
          waterTargetMl: waterTargetMl.trim() ? Number(waterTargetMl) : null,
        });
        setPlanNormText(
          norm
            ? `${norm.target.calories} ккал · белок ${norm.target.protein} г · вода ${norm.target.waterMl} мл`
            : null,
        );
      } catch {
        if (!cancelled) setPlanNormText(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sex, heightCm, birthYear, activityLevel, fiberTargetG, sugarTargetG, waterTargetMl]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (offlineView) {
      setError("Нет сети — сохранение недоступно. Изменения появятся после связи.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(withBasePath("/api/account"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          ...(emailLocked ? {} : { email: email.trim() || null }),
          phone: phone.trim() || null,
          image,
          timezone: timezone.trim() || detectDeviceTimezone() || null,
          sex: sex || null,
          heightCm: heightCm && Number.isFinite(Number(heightCm)) ? Math.round(Number(heightCm)) : null,
          birthYear: birthYear && Number.isFinite(Number(birthYear)) ? Math.round(Number(birthYear)) : null,
          activityLevel: activityLevel || null,
          fiberTargetG:
            fiberTargetG.trim() && Number.isFinite(Number(fiberTargetG))
              ? Number(fiberTargetG)
              : null,
          sugarTargetG:
            sugarTargetG.trim() && Number.isFinite(Number(sugarTargetG))
              ? Number(sugarTargetG)
              : null,
          waterTargetMl:
            waterTargetMl.trim() && Number.isFinite(Number(waterTargetMl))
              ? Math.round(Number(waterTargetMl))
              : null,
          weeklyDigestEmail,
          allergens,
        }),
      });
      const data = (await response.json()) as AccountResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сохранить");
      }

      applyAccount(data);
      writeOfflineAccountCache(data as unknown as Record<string, unknown>);
      setMessage("Профиль сохранён");
      clearTimezoneCache(data.timezone ?? null);
      await update();
      notifyDietTargetsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch(withBasePath("/api/account"), {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { image?: string; error?: string };
      if (!response.ok || !data.image) {
        throw new Error(data.error ?? "Не удалось загрузить фото");
      }

      setImage(data.image);
      setMessage("Фото обновлено");
      await update();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки фото");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const referralUrl = useMemo(() => {
    if (!referralCode) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return buildReferralShareUrl(referralCode, origin);
  }, [referralCode]);

  const shareText = "Присоединяйся к Calorie Vision — считай калории по фото";

  async function handleCopyReferral() {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopyStatus("Ссылка скопирована");
    } catch {
      setCopyStatus("Не удалось скопировать");
    }
    window.setTimeout(() => setCopyStatus(null), 2500);
  }

  async function handleDeleteAccount() {
    if (!exportAckChecked || !deleteRiskChecked) {
      setError("Отметьте все пункты чеклиста. Если данные нужны, сначала выгрузите их в разделе «Экспорт»");
      return;
    }
    if (deleteTyped.trim() !== ACCOUNT_DELETE_CONFIRM) {
      setError(`Введите ${ACCOUNT_DELETE_CONFIRM}, чтобы подтвердить удаление`);
      return;
    }

    setDeleting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(withBasePath("/api/account"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: ACCOUNT_DELETE_CONFIRM }),
      });
      const data = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось удалить аккаунт");
      }

      clearOfflineSessionCache();
      clearOfflineAccountCache();
      await clearCapacitorResumeToken();
      await signOut({ callbackUrl: withBasePath("/login") });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления аккаунта");
      setDeleting(false);
    }
  }

  const deleteChecklistReady = exportAckChecked && deleteRiskChecked;
  const canConfirmDelete =
    deleteChecklistReady && deleteTyped.trim() === ACCOUNT_DELETE_CONFIRM && !deleting;

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Пользователь";
  const [openContacts, setOpenContacts] = useState(false);
  const [openNorm, setOpenNorm] = useState(false);
  const [planNormText, setPlanNormText] = useState<string | null>(null);
  const [openNutrients, setOpenNutrients] = useState(false);
  const [openTimezone, setOpenTimezone] = useState(false);
  const [openExport, setOpenExport] = useState(false);
  const [openInstall, setOpenInstall] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  const knownValues = COMMON_TIMEZONES.map((tz) => tz.value);
  const deviceTz = typeof window !== "undefined" ? detectDeviceTimezone() : null;
  const timezoneOptions = [
    ...(deviceTz && !knownValues.includes(deviceTz)
      ? [{ label: `Устройство (${deviceTz})`, value: deviceTz }]
      : []),
    ...COMMON_TIMEZONES,
    ...(timezone && !knownValues.includes(timezone) && timezone !== deviceTz
      ? [{ label: timezone, value: timezone }]
      : []),
  ];

  return (
    <>
      {loading ? (
        <section className="px-1 py-2">
          <SceneSkeleton compact label="Загрузка профиля…" />
        </section>
      ) : null}

      {!loading && offlineView ? (
        <p
          className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
        >
          Офлайн — показан последний сохранённый профиль. Редактирование и сохранение недоступны до
          появления сети.
        </p>
      ) : null}

      {!loading ? (
        <form className="flex flex-col gap-3 md:gap-4" onSubmit={handleSave}>
          <section className="profile-settings__identity">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <label className={`relative ${offlineView ? "pointer-events-none opacity-80" : "cursor-pointer"}`}>
                <AvatarFrame>
                  <UserAvatar
                    image={image}
                    label={displayName}
                    className="h-24 w-24 rounded-full border border-[var(--border-quiet)] object-cover bg-[var(--accent-soft)]"
                    fallbackClassName="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--accent-soft)] text-2xl font-bold text-[var(--accent-ink)]"
                  />
                </AvatarFrame>
                <span className="absolute inset-x-0 bottom-0 rounded-b-full bg-black/45 py-1 text-center text-xs text-white">
                  {uploading ? "..." : "Фото"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading || offlineView}
                  onChange={handleAvatarChange}
                />
              </label>

              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Аккаунт</h2>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  Имя, email и фото видны в шапке приложения
                </p>
                <p className="mt-1 text-base font-semibold text-[var(--foreground)]">{displayName}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="firstName">Имя</label>
                <input id="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="lastName">Фамилия</label>
                <input id="lastName" value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </div>
            </div>

            {message ? <p className="mt-3 text-sm text-[var(--accent)]">{message}</p> : null}
            {error && !openDelete ? (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : null}
            <div className="mt-4">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || uploading || deleting || offlineView}
              >
                {saving ? "Сохраняем..." : offlineView ? "Нет сети" : "Сохранить профиль"}
              </button>
            </div>
          </section>

          <ProfileCollapse
            title="Контакты"
            hint={email || phone ? [email, phone].filter(Boolean).join(" · ") : "Email и телефон"}
            open={openContacts}
            onToggle={() => setOpenContacts((v) => !v)}
          >
            <div className="grid gap-4">
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  disabled={emailLocked}
                  readOnly={emailLocked}
                  className={emailLocked ? "cursor-not-allowed opacity-60" : undefined}
                  onChange={(event) => setEmail(event.target.value)}
                />
                {emailLocked ? (
                  <p className="text-xs text-[var(--muted)]">Email привязан к Google или VK</p>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="phone">Телефон</label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+7 (900) 123-45-67"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </div>
          </ProfileCollapse>

          <ProfileCollapse
            title="Расчёт нормы"
            hint="Пол, рост и активность — для калорийной нормы"
            open={openNorm}
            onToggle={() => setOpenNorm((v) => !v)}
          >
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="field min-w-0 sm:col-span-2">
                <label htmlFor="sex">Пол</label>
                <select
                  id="sex"
                  value={sex}
                  onChange={(event) => setSex(isSex(event.target.value) ? event.target.value : "")}
                  className="input"
                >
                  <option value="">Не указан</option>
                  {SEX_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="heightCm">Рост, см</label>
                <input
                  id="heightCm"
                  type="number"
                  min="100"
                  max="250"
                  placeholder="170"
                  value={heightCm}
                  onChange={(event) => setHeightCm(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="birthYear">Год рождения</label>
                <input
                  id="birthYear"
                  type="number"
                  min="1920"
                  max={new Date().getFullYear() - 10}
                  placeholder="1990"
                  value={birthYear}
                  onChange={(event) => setBirthYear(event.target.value)}
                />
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="activityLevel">Уровень активности</label>
                <select
                  id="activityLevel"
                  value={activityLevel}
                  onChange={(event) =>
                    setActivityLevel(
                      isActivityLevel(event.target.value) ? event.target.value : "",
                    )
                  }
                  className="input"
                >
                  <option value="">Лёгкая (по умолчанию)</option>
                  {ACTIVITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} — {option.hint}
                    </option>
                  ))}
                </select>
              </div>
              {planNormText ? (
                <p className="sm:col-span-2 text-sm font-semibold text-[var(--accent-ink)]" data-testid="profile-day-norm">
                  Норма дня: {planNormText}
                </p>
              ) : null}
              <div className="sm:col-span-2">
                <MedicalDisclaimerNote />
              </div>
            </div>
          </ProfileCollapse>

          <ProfileCollapse
            id="nutrient-goals"
            title="Цели нутриентов"
            hint="Вода, клетчатка и мягкий лимит сахара"
            open={openNutrients}
            onToggle={() => setOpenNutrients((v) => !v)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="waterTargetMl">Цель по воде, мл/день</label>
                <input
                  id="waterTargetMl"
                  type="number"
                  min="500"
                  max="6000"
                  step="50"
                  placeholder={String(WATER_DAILY_TARGET_ML)}
                  value={waterTargetMl}
                  onChange={(event) => setWaterTargetMl(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="fiberTargetG">Цель по клетчатке, г/день</label>
                <input
                  id="fiberTargetG"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  placeholder="28"
                  value={fiberTargetG}
                  onChange={(event) => setFiberTargetG(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="sugarTargetG">Лимит сахара, г/день</label>
                <input
                  id="sugarTargetG"
                  type="number"
                  min="1"
                  max="150"
                  step="1"
                  placeholder="50"
                  value={sugarTargetG}
                  onChange={(event) => setSugarTargetG(event.target.value)}
                />
              </div>
            </div>
          </ProfileCollapse>

          <ProfileCollapse
            title="Часовой пояс и письма"
            hint="Напоминания и недельный дайджест"
            open={openTimezone}
            onToggle={() => setOpenTimezone((v) => !v)}
          >
            <div className="grid gap-4">
              <div className="field">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-[var(--border-quiet)] text-[var(--accent)] focus:ring-[var(--accent)]"
                    checked={weeklyDigestEmail}
                    onChange={(event) => setWeeklyDigestEmail(event.target.checked)}
                    disabled={!email.trim()}
                  />
                  <span>
                    <span className="block text-sm font-medium text-[var(--foreground)]">
                      Недельный итог на email
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      Короткий дайджест раз в неделю. Нужен email
                      {!email.trim() ? " — сначала укажите адрес выше" : ""}.
                    </span>
                  </span>
                </label>
              </div>
              <div className="field">
                <label htmlFor="timezone">Часовой пояс</label>
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="input"
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Аллергены</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {ALLERGEN_OPTIONS.map((option) => {
                    const checked = allergens.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-center gap-2 text-sm text-[var(--muted-strong)]"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--border-quiet)] text-[var(--accent)] focus:ring-[var(--accent)]"
                          checked={checked}
                          onChange={() => {
                            setAllergens((prev) =>
                              checked
                                ? prev.filter((id) => id !== option.id)
                                : [...prev, option.id],
                            );
                          }}
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </ProfileCollapse>

          <ProfileCollapse
            id="export"
            title="Экспорт"
            hint="Рацион, тренировки, вес"
            open={openExport}
            onToggle={() => setOpenExport((v) => !v)}
          >
            <ExportSettings />
          </ProfileCollapse>

          <ProfileCollapse
            id="install"
            title="Установка"
            hint="PWA или APK"
            open={openInstall}
            onToggle={() => setOpenInstall((v) => !v)}
          >
            <Link href={withBasePath("/install")} className="profile-settings__door">
              <span className="min-w-0">
                <span className="block font-semibold text-[var(--foreground)]">Установить приложение</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">PWA или APK</span>
              </span>
              <span className="shrink-0 text-[var(--muted)]" aria-hidden>
                →
              </span>
            </Link>
          </ProfileCollapse>
        </form>
      ) : null}

      {!loading ? (
        <div className="profile-bug-report">
          <button
            type="button"
            className="profile-bug-report__btn"
            onClick={() => setBugReportOpen(true)}
          >
            <span className="min-w-0 text-left">
              <span className="block font-semibold">Сообщить об ошибке</span>
              <span className="mt-0.5 block text-xs opacity-80">
                Описание и скриншот на support@calorievision.ru
              </span>
            </span>
            <span className="profile-bug-report__chev" aria-hidden>
              →
            </span>
          </button>
        </div>
      ) : null}

      {!loading && referralCode ? (
        <ProfileCollapse
          title="Пригласить друзей"
          hint="Ссылка и мягкий бонус к сундуку"
          open={openInvite}
          onToggle={() => setOpenInvite((v) => !v)}
        >
          <p className="text-sm text-[var(--muted)]">
            Поделитесь ссылкой — друзья откроют Calorie Vision с вашего приглашения, а вам
            начислится мягкий бонус к сундуку, когда они присоединятся.
          </p>
          <p className="mt-3 break-all rounded-xl bg-[var(--surface-mist)] px-3 py-2 font-mono text-xs text-[var(--muted-strong)]">
            {referralUrl}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary text-sm" onClick={() => void handleCopyReferral()}>
              Копировать
            </button>
            <a
              className="btn btn-secondary text-sm"
              href={telegramShareUrl(referralUrl, shareText)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram
            </a>
            <a
              className="btn btn-secondary text-sm"
              href={vkShareUrl(referralUrl)}
              target="_blank"
              rel="noopener noreferrer"
            >
              VK
            </a>
          </div>
          {copyStatus ? <p className="mt-2 text-sm text-[var(--accent)]">{copyStatus}</p> : null}
        </ProfileCollapse>
      ) : null}

      {!loading ? (
        <ProfileCollapse
          title="Удаление аккаунта"
          hint="Необратимо"
          open={openDelete}
          onToggle={() => setOpenDelete((v) => !v)}
        >
          <p className="text-sm text-[var(--muted)]">
            Удалим профиль, дневник, тренировки, вес, воду, напоминания и загруженные фото. Это
            необратимо. Если данные нужны, сначала выгрузите их в разделе «Экспорт».
          </p>
          {!deleteConfirmOpen ? (
            <button
              type="button"
              className="btn btn-danger mt-3"
              onClick={() => {
                setDeleteConfirmOpen(true);
                setDeleteTyped("");
                setExportAckChecked(false);
                setDeleteRiskChecked(false);
                setError(null);
              }}
            >
              Удалить аккаунт
            </button>
          ) : (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-900">Чеклист перед удалением</p>
              <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-red-900">
                <li>
                  <label className="flex items-start gap-2 text-[var(--muted-strong)]">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={exportAckChecked}
                      onChange={(event) => setExportAckChecked(event.target.checked)}
                      disabled={deleting}
                    />
                    <span>Я выгрузил(а) данные в разделе «Экспорт» или они мне не нужны</span>
                  </label>
                </li>
                <li>
                  <label className="flex items-start gap-2 text-[var(--muted-strong)]">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={deleteRiskChecked}
                      onChange={(event) => setDeleteRiskChecked(event.target.checked)}
                      disabled={deleting}
                    />
                    <span>
                      Понимаю: после удаления данные нельзя восстановить через поддержку
                    </span>
                  </label>
                </li>
              </ol>

              <p className="text-sm text-red-800">
                Затем введите <span className="font-mono font-semibold">{ACCOUNT_DELETE_CONFIRM}</span>{" "}
                для подтверждения:
              </p>
              <input
                value={deleteTyped}
                onChange={(event) => setDeleteTyped(event.target.value)}
                autoComplete="off"
                placeholder={ACCOUNT_DELETE_CONFIRM}
                className="input"
                disabled={deleting || !deleteChecklistReady}
              />
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={!canConfirmDelete}
                  onClick={() => void handleDeleteAccount()}
                >
                  {deleting ? "Удаляем..." : "Удалить навсегда"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDeleteTyped("");
                    setExportAckChecked(false);
                    setDeleteRiskChecked(false);
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </ProfileCollapse>
      ) : null}

      {!loading ? (
        <footer className="px-1 pt-1 text-sm text-[var(--muted)]">
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Правовая информация">
            <Link
              href={withBasePath("/privacy")}
              className="text-[var(--accent-ink)] underline-offset-2 hover:underline"
            >
              Конфиденциальность
            </Link>
            <Link
              href={withBasePath("/terms")}
              className="text-[var(--accent-ink)] underline-offset-2 hover:underline"
            >
              Условия
            </Link>
            <Link
              href={withBasePath("/disclaimer")}
              className="text-[var(--accent-ink)] underline-offset-2 hover:underline"
            >
              Дисклеймер
            </Link>
          </nav>
        </footer>
      ) : null}

      <BugReportSheet open={bugReportOpen} onClose={() => setBugReportOpen(false)} />
    </>
  );
}
