"use client";

import { SceneBusy } from "@/components/SceneSkeleton";
import { trackConfirmLookupGoal } from "@/lib/metrika-funnel";
import type { ConfirmReviewCta } from "@/lib/confirm-review-cta";
import type { DishDraft } from "@/lib/confirm-card-draft";

type ConfirmStickyActionsProps = {
  multi: boolean;
  dishesLength: number;
  totalCalories: number;
  needsReview: boolean;
  reviewCta: ConfirmReviewCta | null;
  formDisabled: boolean;
  reviewTargetDish: DishDraft | null;
  searchingId: string | null;
  bulkLookupRunning: boolean;
  dishes: DishDraft[];
  onSetActiveDish: (index: number) => void;
  onLookupAll: (opts?: { forceAll?: boolean }) => void;
  onLookup: (dish: DishDraft) => void;
  saving: boolean;
  searching: boolean;
  anyMissingCalories: boolean;
  enriching: boolean;
  /** T2: after enrich timeout, allow save even if kcal still missing. */
  enrichmentTimedOut?: boolean;
  saveLabel: string;
  onSave: () => void;
  onCancel: () => void;
};

export function ConfirmStickyActions({
  multi,
  dishesLength,
  totalCalories,
  needsReview,
  reviewCta,
  formDisabled,
  reviewTargetDish,
  searchingId,
  bulkLookupRunning,
  dishes,
  onSetActiveDish,
  onLookupAll,
  onLookup,
  saving,
  searching,
  anyMissingCalories,
  enriching,
  enrichmentTimedOut = false,
  saveLabel,
  onSave,
  onCancel,
}: ConfirmStickyActionsProps) {
  const blockSaveForMissingKcal =
    anyMissingCalories && !enriching && !enrichmentTimedOut;
  return (
    <div className="confirm-card-actions">
      {multi ? (
        <p className="w-full text-center text-xs font-medium text-[var(--muted)]">
          {dishesLength} позиций · {totalCalories || "—"} ккал
        </p>
      ) : null}
      {needsReview && reviewCta ? (
        <button
          type="button"
          className="btn btn-primary inline-flex items-center justify-center gap-2"
          disabled={
            formDisabled ||
            (reviewCta.mode === "lookup-one"
              ? !reviewTargetDish || searchingId === reviewTargetDish.id
              : bulkLookupRunning)
          }
          onClick={() => {
            trackConfirmLookupGoal();
            if (reviewCta.mode === "force-all") {
              void onLookupAll({ forceAll: true });
              return;
            }
            if (reviewCta.mode === "lookup-all") {
              void onLookupAll();
              return;
            }
            if (!reviewTargetDish) return;
            const idx = dishes.findIndex((d) => d.id === reviewTargetDish.id);
            if (idx >= 0) onSetActiveDish(idx);
            void onLookup(reviewTargetDish);
          }}
        >
          {reviewCta.mode === "force-all" || reviewCta.mode === "lookup-all"
            ? bulkLookupRunning
              ? reviewCta.busyLabel
              : reviewCta.label
            : searchingId === reviewTargetDish?.id || bulkLookupRunning
              ? reviewCta.busyLabel
              : reviewCta.label}
        </button>
      ) : null}
      <button
        type="button"
        className={`inline-flex w-full items-center justify-center gap-2 ${
          needsReview && reviewCta ? "btn btn-secondary" : "quick-save"
        }`}
        disabled={saving || searching || blockSaveForMissingKcal}
        onClick={() => void onSave()}
      >
        {saving ? (
          <>
            <SceneBusy />
            Сохраняем...
          </>
        ) : (
          saveLabel
        )}
      </button>
      <button type="button" className="quick-cancel" disabled={saving} onClick={onCancel}>
        Отмена
      </button>
    </div>
  );
}
