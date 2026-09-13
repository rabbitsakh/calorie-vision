"use client";

import { useState } from "react";
import type { MealEntry } from "@/types";
import {
  formatDateTime,
  formatTimeShort,
} from "@/lib/dates";
import { getImageUrl } from "@/lib/paths";
import { decodeHtmlEntities } from "@/lib/html-text";
import type { MealListGroup, MealListItem } from "@/lib/meal-groups";
import { MealPhotoPicker } from "@/components/MealPhotoPicker";
import { AllergenHint } from "@/components/AllergenHint";
import type { AllergenId } from "@/lib/allergens";
import {
  sectionLabel,
  type MealTypeSection,
} from "@/lib/diary-meal-sections";
import {
  InlineEdit,
  MealTimeInlineEdit,
  MealTypeInlineChips,
  type EditPatch,
} from "@/components/DailyLogInlineEdit";

function formatMacros(
  entry: Pick<MealEntry, "protein" | "fat" | "carbs" | "fiber" | "sugar">,
  mode: "primary" | "secondary" = "primary",
): string {
  if (mode === "secondary") {
    const parts: string[] = [];
    if (entry.fiber) parts.push(`клетч. ${entry.fiber}`);
    if (entry.sugar) parts.push(`сахар ${entry.sugar}`);
    return parts.join(" · ");
  }
  const parts: string[] = [];
  if (entry.protein) parts.push(`Б ${entry.protein}`);
  if (entry.fat) parts.push(`Ж ${entry.fat}`);
  if (entry.carbs) parts.push(`У ${entry.carbs}`);
  return parts.join(" · ");
}

function MealEntryDetails({
  entry,
  timezone,
  compact = true,
  hideTime = false,
}: {
  entry: MealEntry;
  timezone?: string | null;
  compact?: boolean;
  hideTime?: boolean;
}) {
  const primary = formatMacros(entry, "primary");
  const secondary = formatMacros(entry, "secondary");
  const eatenWhen = entry.eatenAt ?? entry.createdAt;
  const when = hideTime
    ? ""
    : compact
      ? formatTimeShort(eatenWhen, timezone)
      : formatDateTime(eatenWhen, timezone);

  return (
    <>
      <p className="meal-card-meta">
        {entry.calories} ккал
        {entry.portionGrams ? ` · ${entry.portionGrams} г` : ""}
        {primary ? ` · ${primary}` : ""}
      </p>
      {secondary || when ? (
        <p className="meal-card-meta-secondary">
          {[secondary, when].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </>
  );
}

function mealStripeClass(mealType: string | null | undefined): string {
  if (mealType === "BREAKFAST") return "bg-amber-400";
  if (mealType === "LUNCH") return "bg-teal-500";
  if (mealType === "DINNER") return "bg-indigo-400";
  if (mealType === "SNACK") return "bg-rose-400";
  return "bg-slate-200";
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" strokeLinecap="round" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" strokeLinecap="round" />
      <path d="M14 11v6" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinejoin="round" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" strokeLinecap="round" />
    </svg>
  );
}

function PhotoSearchIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="M21 16l-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GroupedMealCard({
  group,
  timezone,
  onDelete,
  onDeleteGroup,
  onEdit,
  onMealTypeChange,
  onEatenAtChange,
  onDuplicate,
  onImageChange,
  userAllergens = [],
}: {
  group: MealListGroup;
  timezone?: string | null;
  onDelete: (id: string) => void;
  onDeleteGroup: (ids: string[]) => void;
  onEdit: (id: string, patch: EditPatch) => Promise<void>;
  onMealTypeChange: (id: string, mealType: string | null) => Promise<void>;
  onEatenAtChange: (id: string, eatenAt: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onImageChange: (id: string, imagePath: string | null) => void;
  userAllergens?: AllergenId[];
}) {
  const macros = formatMacros({
    protein: group.totalProtein,
    fat: group.totalFat,
    carbs: group.totalCarbs,
    fiber: group.totalFiber,
    sugar: group.totalSugar,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeBusyId, setTypeBusyId] = useState<string | null>(null);
  const [timeBusyId, setTimeBusyId] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [dupBusyId, setDupBusyId] = useState<string | null>(null);

  /** Prefer group photo; fall back to any entry photo so the header is never blank. */
  const headerImage =
    group.imagePath ?? group.entries.find((entry) => entry.imagePath)?.imagePath ?? null;

  return (
    <article className="meal-card overflow-hidden rounded-2xl border border-teal-100 bg-slate-50">
      <div className="flex items-start gap-2.5 p-2.5 md:gap-3 md:p-3">
        {headerImage ? (
          <div className="meal-card-thumb shrink-0 overflow-hidden rounded-xl bg-white md:h-20 md:w-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageUrl(headerImage, { w: 128 })}
              alt={group.entries.map((entry) => decodeHtmlEntities(entry.dishName)).join(", ")}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="meal-card-title">С одного фото</h3>
            <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
              {group.entries.length} {group.entries.length === 1 ? "блюдо" : group.entries.length < 5 ? "блюда" : "блюд"}
            </span>
          </div>
          <p className="meal-card-meta">
            {group.totalCalories} ккал
            {macros ? ` · ${macros}` : ""}
            {" · "}
            {formatTimeShort(group.createdAt, timezone)}
          </p>
        </div>

        <button
          type="button"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          title="Удалить все блюда с фото"
          onClick={() => onDeleteGroup(group.entries.map((e) => e.id))}
        >
          <TrashIcon />
        </button>
      </div>

      <div className="divide-y divide-slate-100 border-t border-slate-100 bg-white/70">
        {group.entries.map((entry) => {
          if (editingId === entry.id) {
            return (
              <div key={entry.id} className="p-2.5">
                <InlineEdit
                  entry={entry}
                  timezone={timezone}
                  onSave={async (patch) => {
                    await onEdit(entry.id, patch);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            );
          }

          if (photoId === entry.id) {
            return (
              <div key={entry.id} className="p-2.5">
                <MealPhotoPicker
                  mealId={entry.id}
                  dishName={decodeHtmlEntities(entry.dishName)}
                  imagePath={entry.imagePath}
                  onApplied={(imagePath) => onImageChange(entry.id, imagePath)}
                  onClose={() => setPhotoId(null)}
                />
              </div>
            );
          }

          const thumb = entry.imagePath ?? headerImage;

          return (
            <div key={entry.id} className="flex items-stretch gap-0">
              <span className={`meal-stripe ${mealStripeClass(entry.mealType)}`} aria-hidden />
              <div className="meal-card-body flex-1">
                <button
                  type="button"
                  className="meal-card-thumb relative bg-white"
                  title="Сменить фото"
                  onClick={() => setPhotoId(entry.id)}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(thumb, { w: 128 })}
                      alt={decodeHtmlEntities(entry.dishName)}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-slate-400">
                      <PhotoSearchIcon />
                      <span className="text-[8px] font-medium">фото</span>
                    </span>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="meal-card-title truncate">{decodeHtmlEntities(entry.dishName)}</h4>
                        {entry.wasCorrected ? (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            запомнили
                          </span>
                        ) : null}
                      </div>
                      <AllergenHint
                        text={decodeHtmlEntities(entry.dishName)}
                        allergens={userAllergens}
                      />
                      <MealEntryDetails entry={entry} timezone={timezone} hideTime />
                    </div>
                    <div className="meal-card-actions shrink-0">
                      <button
                        type="button"
                        title="Редактировать"
                        onClick={() => setEditingId(entry.id)}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        title="Дублировать"
                        disabled={dupBusyId === entry.id}
                        onClick={() => {
                          setDupBusyId(entry.id);
                          void onDuplicate(entry.id).finally(() => setDupBusyId(null));
                        }}
                      >
                        <DuplicateIcon />
                      </button>
                      <button
                        type="button"
                        className="danger"
                        title="Удалить"
                        onClick={() => onDelete(entry.id)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  <div className="meal-card-meta-row">
                    <MealTimeInlineEdit
                      entry={entry}
                      timezone={timezone}
                      disabled={timeBusyId === entry.id || typeBusyId === entry.id}
                      onChange={(eatenAt) => {
                        setTimeBusyId(entry.id);
                        void onEatenAtChange(entry.id, eatenAt).finally(() => setTimeBusyId(null));
                      }}
                    />
                    <MealTypeInlineChips
                      value={entry.mealType}
                      disabled={typeBusyId === entry.id || timeBusyId === entry.id}
                      onChange={(mealType) => {
                        setTypeBusyId(entry.id);
                        void onMealTypeChange(entry.id, mealType).finally(() => setTypeBusyId(null));
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function MealSectionHeader({
  section,
  collapsed,
  onToggle,
  count,
}: {
  section: MealTypeSection;
  collapsed?: boolean;
  onToggle?: () => void;
  count?: number;
}) {
  const content = (
    <>
      <span
        className={`h-3 w-1 shrink-0 rounded-full ${mealStripeClass(section === "UNTAGGED" ? null : section)}`}
        aria-hidden
      />
      <h3 className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {sectionLabel(section)}
        {count != null ? ` · ${count}` : ""}
      </h3>
      {onToggle ? (
        <span className="ml-auto text-[0.65rem] font-medium text-slate-400" aria-hidden>
          {collapsed ? "показать" : "скрыть"}
        </span>
      ) : null}
    </>
  );

  if (!onToggle) {
    return <div className="flex items-center gap-2 pt-0.5">{content}</div>;
  }

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 pt-0.5 text-left"
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      {content}
    </button>
  );
}

function SingleMealCard({
  entry,
  timezone,
  onDelete,
  onEdit,
  onMealTypeChange,
  onEatenAtChange,
  onDuplicate,
  onImageChange,
  userAllergens = [],
}: {
  entry: MealEntry;
  timezone?: string | null;
  onDelete: (id: string) => void;
  onEdit: (id: string, patch: EditPatch) => Promise<void>;
  onMealTypeChange: (id: string, mealType: string | null) => Promise<void>;
  onEatenAtChange: (id: string, eatenAt: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onImageChange: (id: string, imagePath: string | null) => void;
  userAllergens?: AllergenId[];
}) {
  const [editing, setEditing] = useState(false);
  const [typeBusy, setTypeBusy] = useState(false);
  const [timeBusy, setTimeBusy] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [dupBusy, setDupBusy] = useState(false);

  if (editing) {
    return (
      <InlineEdit
        entry={entry}
        timezone={timezone}
        onSave={async (patch) => { await onEdit(entry.id, patch); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (photoOpen) {
    return (
      <MealPhotoPicker
        mealId={entry.id}
        dishName={decodeHtmlEntities(entry.dishName)}
        imagePath={entry.imagePath}
        onApplied={(imagePath) => onImageChange(entry.id, imagePath)}
        onClose={() => setPhotoOpen(false)}
      />
    );
  }

  return (
    <article className="meal-card flex items-stretch gap-0 bg-slate-50">
      <span className={`meal-stripe ${mealStripeClass(entry.mealType)}`} aria-hidden />
      <div className="meal-card-body flex-1">
        <button
          type="button"
          className="meal-card-thumb relative bg-white"
          title="Сменить фото"
          onClick={() => setPhotoOpen(true)}
        >
          {entry.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getImageUrl(entry.imagePath, { w: 128 })}
              alt={decodeHtmlEntities(entry.dishName)}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-slate-400">
              <PhotoSearchIcon />
              <span className="text-[8px] font-medium">фото</span>
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="meal-card-title truncate">{decodeHtmlEntities(entry.dishName)}</h3>
                {entry.wasCorrected ? (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    запомнили
                  </span>
                ) : null}
              </div>
              <AllergenHint
                text={decodeHtmlEntities(entry.dishName)}
                allergens={userAllergens}
              />
              <MealEntryDetails entry={entry} timezone={timezone} hideTime />
            </div>
            <div className="meal-card-actions shrink-0">
              <button type="button" title="Редактировать" onClick={() => setEditing(true)}>
                <EditIcon />
              </button>
              <button
                type="button"
                title="Дублировать"
                disabled={dupBusy}
                onClick={() => {
                  setDupBusy(true);
                  void onDuplicate(entry.id).finally(() => setDupBusy(false));
                }}
              >
                <DuplicateIcon />
              </button>
              <button type="button" className="danger" title="Удалить" onClick={() => onDelete(entry.id)}>
                <TrashIcon />
              </button>
            </div>
          </div>
          <div className="meal-card-meta-row">
            <MealTimeInlineEdit
              entry={entry}
              timezone={timezone}
              disabled={timeBusy || typeBusy}
              onChange={(eatenAt) => {
                setTimeBusy(true);
                void onEatenAtChange(entry.id, eatenAt).finally(() => setTimeBusy(false));
              }}
            />
            <MealTypeInlineChips
              value={entry.mealType}
              disabled={typeBusy || timeBusy}
              onChange={(mealType) => {
                setTypeBusy(true);
                void onMealTypeChange(entry.id, mealType).finally(() => setTypeBusy(false));
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export function MealListRow({
  item,
  timezone,
  onDelete,
  onDeleteGroup,
  onEdit,
  onMealTypeChange,
  onEatenAtChange,
  onDuplicate,
  onImageChange,
  userAllergens = [],
}: {
  item: MealListItem;
  timezone?: string | null;
  onDelete: (id: string) => void;
  onDeleteGroup: (ids: string[]) => void;
  onEdit: (id: string, patch: EditPatch) => Promise<void>;
  onMealTypeChange: (id: string, mealType: string | null) => Promise<void>;
  onEatenAtChange: (id: string, eatenAt: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onImageChange: (id: string, imagePath: string | null) => void;
  userAllergens?: AllergenId[];
}) {
  if (item.kind === "group") {
    return (
      <GroupedMealCard
        group={item}
        timezone={timezone}
        onDelete={onDelete}
        onDeleteGroup={onDeleteGroup}
        onEdit={onEdit}
        onMealTypeChange={onMealTypeChange}
        onEatenAtChange={onEatenAtChange}
        onDuplicate={onDuplicate}
        onImageChange={onImageChange}
        userAllergens={userAllergens}
      />
    );
  }

  return (
    <SingleMealCard
      entry={item.entry}
      timezone={timezone}
      onDelete={onDelete}
      onEdit={onEdit}
      onMealTypeChange={onMealTypeChange}
      onEatenAtChange={onEatenAtChange}
      onDuplicate={onDuplicate}
      onImageChange={onImageChange}
      userAllergens={userAllergens}
    />
  );
}
