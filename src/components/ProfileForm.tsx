"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { formatPhoneDisplay } from "@/lib/phone";
import { getImageUrl, withBasePath } from "@/lib/paths";

type AccountResponse = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  image: string | null;
  linkedProviders: string[];
  emailLocked: boolean;
  error?: string;
};

export function ProfileForm() {
  const { update } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [emailLocked, setEmailLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      setPhone(data.phone);
      setImage(data.image);
      setEmailLocked(data.emailLocked);
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
          email: email.trim() || null,
          image,
        }),
      });
      const data = (await response.json()) as AccountResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сохранить");
      }

      setFirstName(data.firstName);
      setLastName(data.lastName);
      setEmail(data.email ?? "");
      setPhone(data.phone);
      setImage(data.image);
      setMessage("Профиль сохранён");
      await update();
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

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Пользователь";

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
                onChange={(event) => setEmail(event.target.value)}
              />
              {emailLocked ? (
                <p className="text-xs text-slate-500">Email управляется через Google или VK</p>
              ) : null}
            </div>
            <div className="field sm:col-span-2">
              <label htmlFor="phone">Телефон</label>
              <input
                id="phone"
                value={phone ? formatPhoneDisplay(phone) : "Не указан"}
                disabled
                readOnly
              />
              <p className="text-xs text-slate-500">
                Смена телефона — через повторный вход по SMS на странице входа
              </p>
            </div>
          </div>

          {message ? <p className="text-sm text-teal-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button type="submit" className="btn btn-primary self-start" disabled={saving || uploading}>
            {saving ? "Сохраняем..." : "Сохранить профиль"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
