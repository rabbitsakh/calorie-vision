"use client";

import { useCallback, useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { MASCOT_COPY } from "@/lib/mascot-copy";
import { PwaInstallWizard } from "@/components/PwaInstallWizard";
import {
  getPushCapability,
  getPushPromptDismissed,
  setPushPromptDismissed,
} from "@/lib/push-client";
import { subscribeBrowserPush } from "@/lib/push-subscribe";
import { trackPushEnabledGoal } from "@/lib/metrika-funnel";

export function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hintOnly, setHintOnly] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cap = getPushCapability();

    if (cap.kind === "ios-browser" && !getPushPromptDismissed()) {
      setHintOnly(true);
      setHintText(cap.detail);
      setVisible(true);
      return;
    }

    if (!cap.canSubscribe || cap.permission !== "default") return;
    if (getPushPromptDismissed()) return;

    setHintOnly(false);
    setHintText(null);
    setVisible(true);
  }, []);

  const subscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await subscribeBrowserPush();
      if (result.ok) {
        trackPushEnabledGoal();
        setPushPromptDismissed(false);
        setVisible(false);
      } else {
        setError(result.error || "Не удалось подключить уведомления. Попробуйте ещё раз.");
      }
    } catch {
      setError("Не удалось подключить уведомления. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }, []);

  function dismiss() {
    setPushPromptDismissed(true);
    setVisible(false);
  }

  if (!visible && !wizardOpen) return null;

  return (
    <>
      {visible ? (
        hintOnly ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
            <div className="flex items-start gap-3">
              <Mascot pose="tip" size="sm" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-amber-950">{MASCOT_COPY.pushIosHint.title}</p>
                <p className="mt-1 text-sm text-amber-900">
                  {hintText ?? MASCOT_COPY.pushIosHint.fallbackBody}
                </p>
                <p className="mt-1 text-sm text-amber-800">{MASCOT_COPY.pushIosHint.statusHint}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-on-tint text-sm text-amber-900"
                    onClick={() => setWizardOpen(true)}
                  >
                    {MASCOT_COPY.pushIosHint.install}
                  </button>
                  <button type="button" className="btn-quiet text-sm text-amber-800" onClick={dismiss}>
                    {MASCOT_COPY.pushIosHint.dismiss}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-teal-100 bg-teal-50/80 p-4">
            <div className="flex items-start gap-3">
              <Mascot pose="idle" size="sm" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-teal-900">{MASCOT_COPY.pushPrompt.title}</p>
                <p className="mt-1 text-sm text-teal-700">{MASCOT_COPY.pushPrompt.body}</p>
                {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-on-tint text-sm text-teal-800"
                    disabled={loading}
                    onClick={() => void subscribe()}
                  >
                    {loading ? MASCOT_COPY.pushPrompt.enabling : MASCOT_COPY.pushPrompt.enable}
                  </button>
                  <button
                    type="button"
                    className="btn-quiet text-sm text-teal-700"
                    onClick={() => setWizardOpen(true)}
                  >
                    {MASCOT_COPY.pushPrompt.install}
                  </button>
                  <button type="button" className="btn-quiet text-sm text-teal-700" onClick={dismiss}>
                    {MASCOT_COPY.pushPrompt.later}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      ) : null}

      <PwaInstallWizard
        open={wizardOpen}
        prefer="auto"
        onClose={() => setWizardOpen(false)}
      />
    </>
  );
}
