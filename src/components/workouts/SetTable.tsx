"use client";

import { useEffect, useRef, useState } from "react";
import {
  pickEditorRowKey,
  stepNumericField,
  withPreviousValues,
  type SetTableRowModel,
} from "@/lib/workouts/active-set-table";
import { fieldsForKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import { SET_TYPE_LABELS, type SetType } from "@/lib/workouts/set-meta";

export type SetTableFields = {
  kg: string;
  reps: string;
  km: string;
  time: string;
};

type FieldKey = keyof SetTableFields;

type Props = {
  kind: ExerciseKind;
  rows: SetTableRowModel[];
  busy?: boolean;
  addLabel: string;
  onFieldChange: (row: SetTableRowModel, fields: SetTableFields) => void;
  onCommit: (row: SetTableRowModel, fields: SetTableFields) => void;
  onLog: (row: SetTableRowModel, fields: SetTableFields) => void;
  onCycleType: (row: SetTableRowModel) => void;
  onAddSet: () => void;
  onMoveSet?: (setId: string, direction: "up" | "down") => void;
  onDeleteSet?: (setId: string) => void;
};

type MenuActions = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
};

function fieldsOf(row: SetTableRowModel): SetTableFields {
  return { kg: row.kg, reps: row.reps, km: row.km, time: row.time };
}

function sameFields(a: SetTableFields, b: SetTableFields): boolean {
  return a.kg === b.kg && a.reps === b.reps && a.km === b.km && a.time === b.time;
}

function chipClass(setType: string): string {
  if (setType === "warmup") return "gym-set-chip gym-set-chip--warm";
  if (setType === "working") return "gym-set-chip";
  return "gym-set-chip gym-set-chip--other";
}

function typeLabel(setType: string): string {
  return SET_TYPE_LABELS[setType as SetType] ?? "Рабочий";
}

function summaryOf(kind: ExerciseKind, fields: SetTableFields): string {
  if (kind === "cardio") {
    const parts = [fields.km ? `${fields.km} км` : null, fields.time ? `${fields.time} мин` : null].filter(
      Boolean,
    );
    return parts.join(" · ") || "—";
  }
  if (kind === "duration") return fields.time ? `${fields.time} мин` : "—";
  if (kind === "bodyweight") return fields.reps ? `${fields.reps} повт` : "—";
  const prefix = kind === "assisted" ? "−" : kind === "weighted_bw" ? "+" : "";
  if (!fields.kg && !fields.reps) return "—";
  return `${prefix}${fields.kg || "0"} × ${fields.reps || "0"}`;
}

export function SetTable({
  kind,
  rows,
  busy,
  addLabel,
  onFieldChange,
  onCommit,
  onLog,
  onCycleType,
  onAddSet,
  onMoveSet,
  onDeleteSet,
}: Props) {
  const withMenu = Boolean(onMoveSet && onDeleteSet);
  const persisted = rows.filter((row) => row.source === "set" && row.setId);
  const [preferred, setPreferred] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const editorKey = pickEditorRowKey(rows, preferred);
  const menuRow = rows.find((row) => row.key === menuKey && row.setId) ?? null;

  return (
    <div className="gym-sets">
      <ul className="gym-sets__list">
        {rows.map((row) => (
          <SetTableRow
            key={row.key}
            kind={kind}
            row={row}
            busy={busy}
            editor={row.key === editorKey}
            onFocus={() => setPreferred(row.key)}
            onFieldChange={onFieldChange}
            onCommit={onCommit}
            onLog={onLog}
            onCycleType={onCycleType}
            onOpenMenu={
              withMenu && row.source === "set" && row.setId ? () => setMenuKey(row.key) : null
            }
          />
        ))}
      </ul>
      <button
        type="button"
        disabled={busy}
        className="gym-sets__add"
        onClick={onAddSet}
      >
        {addLabel}
      </button>
      {menuRow && withMenu ? (
        <SetMenu
          row={menuRow}
          busy={busy}
          actions={{
            canMoveUp: persisted[0]?.setId !== menuRow.setId,
            canMoveDown: persisted.at(-1)?.setId !== menuRow.setId,
            onUp: () => onMoveSet?.(menuRow.setId!, "up"),
            onDown: () => onMoveSet?.(menuRow.setId!, "down"),
            onDelete: () => onDeleteSet?.(menuRow.setId!),
          }}
          onCycleType={() => onCycleType(menuRow)}
          onClose={() => setMenuKey(null)}
        />
      ) : null}
    </div>
  );
}

function SetTableRow({
  kind,
  row,
  busy,
  editor,
  onFocus,
  onFieldChange,
  onCommit,
  onLog,
  onCycleType,
  onOpenMenu,
}: {
  kind: ExerciseKind;
  row: SetTableRowModel;
  busy?: boolean;
  editor: boolean;
  onFocus: () => void;
  onFieldChange: Props["onFieldChange"];
  onCommit: Props["onCommit"];
  onLog: Props["onLog"];
  onCycleType: Props["onCycleType"];
  onOpenMenu: (() => void) | null;
}) {
  const [fields, setFields] = useState<SetTableFields>(() => fieldsOf(row));
  const [pop, setPop] = useState(false);
  const pending = useRef<SetTableFields | null>(null);

  useEffect(() => {
    const next = fieldsOf(row);
    if (pending.current) {
      if (sameFields(pending.current, next)) pending.current = null;
      return;
    }
    setFields((prev) => (sameFields(prev, next) ? prev : next));
  }, [row]);

  const publish = (next: SetTableFields) => {
    pending.current = next;
    setFields(next);
    if (row.source === "draft" || row.extraId) onFieldChange(row, next);
    else if (row.setId) onCommit(row, next);
  };

  const applyPrevious = () => {
    const next = withPreviousValues(fields, row.previous);
    if (!next) return;
    publish(next);
  };

  const step = (key: FieldKey, delta: number) => {
    publish({ ...fields, [key]: stepNumericField(fields[key], delta) });
  };

  const summary = summaryOf(kind, fields);
  const label = typeLabel(row.setType);

  if (!editor) {
    return (
      <li className={`gym-set-line${row.completed ? " is-done" : ""}${row.pendingLocal ? " is-pending" : ""}`}>
        <button
          type="button"
          className="gym-set-line__main"
          disabled={busy || row.completed}
          onClick={onFocus}
        >
          <span className="gym-set-line__n">{row.number}</span>
          <span className={chipClass(row.setType)}>{label}</span>
          <span className="gym-set-line__mid">{summary}</span>
        </button>
        {onOpenMenu ? (
          <button
            type="button"
            className="gym-set-more"
            aria-label={`Действия подхода ${row.number}`}
            disabled={busy}
            onClick={onOpenMenu}
          >
            ⋮
          </button>
        ) : null}
        <button
          type="button"
          className={`gym-set-check${row.completed ? " is-on" : ""}${pop ? " is-pop" : ""}`}
          disabled={busy}
          aria-label={row.completed ? `Снять подход ${row.number}` : `Записать подход ${row.number}`}
          onClick={() => {
            if (!row.completed) setPop(true);
            onLog(row, fields);
          }}
        >
          {row.completed ? "✓" : ""}
        </button>
      </li>
    );
  }

  const spec = fieldsForKind(kind);
  const steps: { key: FieldKey; label: string; delta: number }[] = [];
  if (spec.usesWeight) steps.push({ key: "kg", label: "Килограммы", delta: 2.5 });
  if (spec.usesReps) steps.push({ key: "reps", label: "Повторения", delta: 1 });
  if (spec.usesDistance) steps.push({ key: "km", label: "Километры", delta: 0.1 });
  if (spec.usesDuration) steps.push({ key: "time", label: "Минуты", delta: 1 });
  const previousText =
    row.previousLabel && row.previousLabel !== "—" ? row.previousLabel.replace("×", " × ") : null;

  return (
    <li className={`gym-set-editor${row.pendingLocal ? " is-pending" : ""}`}>
      <div className="gym-set-editor__top">
        <button
          type="button"
          className={chipClass(row.setType)}
          disabled={busy}
          title={label}
          onClick={() => onCycleType(row)}
        >
          {label} · подход {row.number}
        </button>
        {onOpenMenu ? (
          <button
            type="button"
            className="gym-set-more"
            aria-label={`Действия подхода ${row.number}`}
            disabled={busy}
            onClick={onOpenMenu}
          >
            ⋮
          </button>
        ) : null}
      </div>
      {previousText ? (
        <button type="button" className="gym-set-prev" disabled={busy} onClick={applyPrevious}>
          <span>Прошлый {previousText}</span>
          <span>подставить</span>
        </button>
      ) : null}
      {steps.map((item) => (
        <div key={item.key}>
          <p className="gym-set-label">
            {item.label}
            {item.key === "kg" && row.progressionUp ? (
              <i className="gym-set-up">↑ к прошлому</i>
            ) : null}
          </p>
          <div className="gym-stepper">
            <button
              type="button"
              aria-label={`Меньше, ${item.label}`}
              disabled={busy}
              onClick={() => step(item.key, -item.delta)}
            >
              −
            </button>
            <div className="gym-stepper__val">{fields[item.key] || "0"}</div>
            <button
              type="button"
              aria-label={`Больше, ${item.label}`}
              disabled={busy}
              onClick={() => step(item.key, item.delta)}
            >
              +
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="gym-set-log"
        disabled={busy}
        onClick={() => {
          setPop(true);
          onLog(row, fields);
        }}
      >
        {summary === "—" ? "Записать подход" : `Записать ${summary}`}
      </button>
    </li>
  );
}

function SetMenu({
  row,
  busy,
  actions,
  onCycleType,
  onClose,
}: {
  row: SetTableRowModel;
  busy?: boolean;
  actions: MenuActions;
  onCycleType: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <>
      <button type="button" className="gym-set-sheet__backdrop" aria-label="Закрыть меню" onClick={onClose} />
      <div className="gym-set-sheet" role="dialog" aria-label={`Подход ${row.number}`}>
        <div className="gym-set-sheet__handle" aria-hidden />
        <p className="gym-set-sheet__title">
          Подход {row.number} · {typeLabel(row.setType).toLowerCase()}
        </p>
        <button type="button" disabled={!actions.canMoveUp || busy} onClick={() => run(actions.onUp)}>
          Выше
        </button>
        <button type="button" disabled={!actions.canMoveDown || busy} onClick={() => run(actions.onDown)}>
          Ниже
        </button>
        <button type="button" disabled={busy} onClick={() => run(onCycleType)}>
          Тип: {typeLabel(row.setType).toLowerCase()}
        </button>
        <button type="button" className="is-danger" disabled={busy} onClick={() => run(actions.onDelete)}>
          Удалить подход
        </button>
      </div>
    </>
  );
}
