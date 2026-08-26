"use client";

import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ACCOUNT_DELETE_CONFIRM } from "@/lib/account-delete-confirm";
import {
  ACTIVITY_OPTIONS,
  SEX_OPTIONS,
  isActivityLevel,
  isSex,
  type ActivityLevel,
  type Sex,
} from "@/lib/diet";
import { WATER_DAILY_TARGET_ML } from "@/lib/water-target";
import { detectDeviceTimezone } from "@/lib/device-timezone";
import { formatPhoneDisplay } from "@/lib/phone";
import { getImageUrl, withBasePath } from "@/lib/paths";
import { notifyDietTargetsChanged } from "@/lib/diet-refresh";
import {
  buildReferralShareUrl,
  telegramShareUrl,
  vkShareUrl,
} from "@/lib/referral";
import { clearTimezoneCache } from "@/lib/use-timezone";

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
  linkedProviders: string[];
  emailLocked: boolean;
  referralCode?: string;
  error?: string;
};

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
  { label: "Сахалин (UTC+11)", value: "Asia/Sakhalin" },
  { label: "Магадан, Южно-Сахалинск (UTC+11)", value: "Asia/Magadan" },
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
  const [emailLocked, setEmailLocked] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(withBasePath("/api/account"));
      const data = (await response.json()) as AccountResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось загрузить профиль");
      }

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
      setEmailLocked(data.emailLocked);
      setReferralCode(data.referralCode?.trim() || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
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
        }),
      });
      const data = (await response.json()) as AccountResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сохранить");
      }

      setFirstName(data.firstName);
      setLastName(data.lastName);
      setEmail(data.email ?? "");
      setPhone(data.phone ? formatPhoneDisplay(data.phone) : "");
      setImage(data.image);
      setTimezone(data.timezone ?? "");
      setSex(isSex(data.sex) ? data.sex : "");
      setHeightCm(data.heightCm ? String(data.heightCm) : "");
      setBirthYear(data.birthYear ? String(data.birthYear) : "");
      setActivityLevel(isActivityLevel(data.activityLevel) ? data.activityLevel : "");
      setFiberTargetG(data.fiberTargetG != null ? String(data.fiberTargetG) : "");
      setSugarTargetG(data.sugarTargetG != null ? String(data.sugarTargetG) : "");
      setWaterTargetMl(data.waterTargetMl != null ? String(data.waterTargetMl) : "");
      setWeeklyDigestEmail(Boolean(data.weeklyDigestEmail));
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

      await signOut({ callbackUrl: withBasePath("/login") });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления аккаунта");
      setDeleting(false);
    }
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Пользователь";

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
    <section className="card p-4 md:p-6">
      {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}

      {!loading ? (
        <form className="flex flex-col gap-5" onSubmit={handleSave}>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <label className="relative cursor-pointer">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getImageUrl(image)}
                  alt=""
                  className="h-24 w-24 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-teal-100 text-2xl font-bold text-teal-800">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 rounded-b-full bg-black/45 py-1 text-center text-xs text-white">
                {uploading ? "..." : "Фото"}
              </span>
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleAvatarChange} />
            </label>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Я</p>
              <h2 className="text-xl font-bold">{displayName}</h2>
              <p className="text-sm text-slate-500">Имя, email и фото видны в шапке приложения</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="firstName">Имя</label>
              <input id="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="lastName">Фамилия</label>
              <input id="lastName" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
            <div className="field sm:col-span-2">
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
                <p className="text-xs text-slate-500">🔒 Email привязан к Google или VK — изменить нельзя</p>
              ) : null}
            </div>
            <div className="field sm:col-span-2">
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
              <p className="text-xs text-slate-500">
                Можно указать вручную — для профиля и напоминаний.
              </p>
            </div>
            <div className="field sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Цель и расчёт</p>
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
              <p className="text-xs text-slate-500">
                Нужен для расчёта нормы калорий: у женщин базовый обмен ниже, чем у мужчин
              </p>
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
              <p className="text-xs text-slate-500">Для точного расчёта базового обмена</p>
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
              <p className="text-xs text-slate-500">Возраст влияет на расход калорий</p>
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
              <p className="text-xs text-slate-500">
                Множитель к базовому обмену (BMR → TDEE). По умолчанию 1.25 — как раньше.
              </p>
            </div>
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
              <p className="text-xs text-slate-500">
                Пусто — {WATER_DAILY_TARGET_ML} мл. Влияет на трекер и напоминания.
              </p>
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
              <p className="text-xs text-slate-500">Пусто — авто ~28 г (ВОЗ/EFSA)</p>
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
              <p className="text-xs text-slate-500">Мягкий потолок; пусто — ~10% калорий</p>
            </div>
            <div className="field sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  checked={weeklyDigestEmail}
                  onChange={(event) => setWeeklyDigestEmail(event.target.checked)}
                  disabled={!email.trim()}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">
                    Недельный итог на email
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Короткий дайджест раз в неделю. Нужен email
                    {!email.trim() ? " — сначала укажите адрес выше" : ""}.
                  </span>
                </span>
              </label>
            </div>
            <div className="field sm:col-span-2">
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
              <p className="text-xs text-slate-500">
                Нужен для push-напоминаний: завтрак в 8:00, чек-ин в 21:00 — по этому поясу, не по
                Москве. Если пусто — подставим пояс устройства при открытии приложения.
              </p>
            </div>
          </div>

          {message ? <p className="text-sm text-teal-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary" disabled={saving || uploading || deleting}>
              {saving ? "Сохраняем..." : "Сохранить профиль"}
            </button>
            <a
              href="/api/export"
              download="calorie-vision-export.csv"
              className="btn btn-secondary"
            >
              📥 Скачать CSV
            </a>
            <a href={withBasePath("/#install")} className="btn btn-secondary">
              Установить приложение
            </a>
          </div>
        </form>
      ) : null}

      {!loading && referralCode ? (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="font-display text-base font-semibold text-slate-800">Пригласить друзей</h3>
          <p className="mt-1 text-sm text-slate-500">
            Поделитесь ссылкой — друзья откроют Calorie Vision с вашего приглашения.
          </p>
          <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
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
          {copyStatus ? <p className="mt-2 text-sm text-teal-700">{copyStatus}</p> : null}
        </div>
      ) : null}

      {!loading ? (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="font-display text-base font-semibold text-red-700">Удаление аккаунта</h3>
          <p className="mt-1 text-sm text-slate-500">
            Удалим профиль, дневник, вес, воду, напоминания и загруженные фото. Это необратимо.
          </p>
          {!deleteConfirmOpen ? (
            <button
              type="button"
              className="btn btn-danger mt-3"
              onClick={() => {
                setDeleteConfirmOpen(true);
                setDeleteTyped("");
                setError(null);
              }}
            >
              Удалить аккаунт
            </button>
          ) : (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">
                Введите <span className="font-mono font-semibold">{ACCOUNT_DELETE_CONFIRM}</span> для
                подтверждения:
              </p>
              <input
                value={deleteTyped}
                onChange={(event) => setDeleteTyped(event.target.value)}
                autoComplete="off"
                placeholder={ACCOUNT_DELETE_CONFIRM}
                className="input"
                disabled={deleting}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deleting || deleteTyped.trim() !== ACCOUNT_DELETE_CONFIRM}
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
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
