"use client";

import { useEffect } from "react";
import { isApkWebView, refreshCapacitorResumeToken } from "@/lib/capacitor-resume";
import { syncCapacitorOfflineQueueBadge } from "@/lib/capacitor-queue-badge";
import { countAllOfflineDrafts } from "@/lib/offline-draft-count";
import { subscribeMealDraftQueue } from "@/lib/meal-draft-queue";
import { subscribeWaterDraftQueue } from "@/lib/water-draft-queue";
import { subscribeWeightDraftQueue } from "@/lib/weight-draft-queue";
import { subscribeDiaryNoteDraftQueue } from "@/lib/diary-note-draft-queue";
import { subscribeLocalWorkoutSessions } from "@/lib/workout-local-session";
import { subscribeWorkoutExerciseDraftQueue } from "@/lib/workout-exercise-draft-queue";
import { subscribeWorkoutSetDraftQueue } from "@/lib/workout-set-draft-queue";

/**
 * Wave X — keep APK icon/notification badge in sync with offline drafts,
 * and refresh the resume token when the app returns to foreground.
 */
export function CapacitorQueueBadgeHost() {
  useEffect(() => {
    if (!isApkWebView()) return;

    const sync = () => {
      void syncCapacitorOfflineQueueBadge(countAllOfflineDrafts());
    };
    sync();

    const unsubs = [
      subscribeMealDraftQueue(sync),
      subscribeWaterDraftQueue(sync),
      subscribeWeightDraftQueue(sync),
      subscribeDiaryNoteDraftQueue(sync),
      subscribeLocalWorkoutSessions(sync),
      subscribeWorkoutExerciseDraftQueue(sync),
      subscribeWorkoutSetDraftQueue(sync),
    ];

    let removeAppListener: (() => void) | undefined;
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) return;
          sync();
          void refreshCapacitorResumeToken().catch(() => {
            // offline / not authenticated
          });
        });
        removeAppListener = () => {
          void handle.remove();
        };
      } catch {
        // web / plugin missing
      }
    })();

    return () => {
      for (const unsub of unsubs) unsub();
      removeAppListener?.();
    };
  }, []);

  return null;
}
