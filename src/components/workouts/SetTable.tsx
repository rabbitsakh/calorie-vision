"use client";

import { useEffect, useRef, useState } from "react";
import {
  SET_TABLE_COLUMN_LABEL,
  inputModeForColumn,
  setTableColumns,
  setTableGridTemplate,
  type SetTableColumn,
  type SetTableRowModel,
} from "@/lib/workouts/active-set-table";
import type { ExerciseKind } from "@/lib/workouts/exercise-kind";
import { SET_TYPE_LABELS, SET_TYPE_SHORT, type SetType } from "@/lib/workouts/set-meta";
import { OverflowMenu } from "@/components/workouts/OverflowMenu";

export type SetTableFields = {
  kg: string;
  reps: string;
  km: string;
  time: string;
};

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

function fieldsOf(row: SetTableRowModel): SetTableFields {
  return { kg: row.kg, reps: row.reps, km: row.km, time: row.time };
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
  const columns = setTableColumns(kind);
  const withMenu = Boolean(onMoveSet && onDeleteSet);
  const template = withMenu
    ? `${setTableGridTemplate(columns)} 40px`
    : setTableGridTemplate(columns);
  const persisted = rows.filter((row) => row.source === "set" && row.setId);

  return (
    <div className="border-t border-[var(--border-quiet)]">
      <div
        className="grid items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]"
        style={{ gridTemplateColumns: template }}
      >
        {columns.map((col) => (
          <span key={col} className={col === "check" ? "sr-only" : "px-0.5 text-center"}>
            {col === "check" ? "Готово" : SET_TABLE_COLUMN_LABEL[col]}
          </span>
        ))}
        {withMenu ? <span className="sr-only">Меню</span> : null}
      </div>
      <ul>
        {rows.map((row) => (
          <SetTableRow
            key={row.key}
            row={row}
            columns={columns}
            template={template}
            busy={busy}
            onFieldChange={onFieldChange}
            onCommit={onCommit}
            onLog={onLog}
            onCycleType={onCycleType}
            reserveMenu={withMenu}
            menu={
              withMenu && row.source === "set" && row.setId
                ? {
                    canMoveUp: persisted[0]?.setId !== row.setId,
                    canMoveDown: persisted.at(-1)?.setId !== row.setId,
                    onUp: () => onMoveSet?.(row.setId!, "up"),
                    onDown: () => onMoveSet?.(row.setId!, "down"),
                    onDelete: () => onDeleteSet?.(row.setId!),
                  }
                : null
            }
          />
        ))}
      </ul>
      <button
        type="button"
        disabled={busy}
        className="flex min-h-[44px] w-full items-center justify-center text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-40"
        onClick={onAddSet}
      >
        {addLabel}
      </button>
    </div>
  );
}

function SetTableRow({
  row,
  columns,
  template,
  busy,
  onFieldChange,
  onCommit,
  onLog,
  onCycleType,
  reserveMenu,
  menu,
}: {
  row: SetTableRowModel;
  columns: SetTableColumn[];
  template: string;
  busy?: boolean;
  onFieldChange: Props["onFieldChange"];
  onCommit: Props["onCommit"];
  onLog: Props["onLog"];
  onCycleType: Props["onCycleType"];
  reserveMenu: boolean;
  menu: {
    canMoveUp: boolean;
    canMoveDown: boolean;
    onUp: () => void;
    onDown: () => void;
    onDelete: () => void;
  } | null;
}) {
  const [fields, setFields] = useState<SetTableFields>(() => fieldsOf(row));
  const focused = useRef(false);

  useEffect(() => {
    if (focused.current) return;
    const next = fieldsOf(row);
    setFields((prev) =>
      prev.kg === next.kg &&
      prev.reps === next.reps &&
      prev.km === next.km &&
      prev.time === next.time
        ? prev
        : next,
    );
  }, [row]);

  const patch = (key: keyof SetTableFields, value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    if (row.source === "draft") onFieldChange(row, next);
  };

  const type = (SET_TYPE_SHORT[row.setType as SetType] ?? row.setType) || "";

  return (
    <li
      className={`grid items-center gap-1 border-t border-[var(--border-quiet)] px-2 ${
        row.pendingLocal ? "bg-amber-50/80" : row.completed ? "bg-[var(--surface-mist)]/70" : ""
      }`}
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((col) => {
        if (col === "index") {
          return (
            <button
              key={col}
              type="button"
              disabled={busy}
              title={SET_TYPE_LABELS[row.setType as SetType] ?? "Тип подхода"}
              className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center text-[var(--muted-strong)] disabled:opacity-40"
              onClick={() => onCycleType(row)}
            >
              <span className="text-sm font-semibold tabular-nums">{row.number}</span>
              {type ? <span className="text-[10px] font-bold uppercase">{type}</span> : null}
            </button>
          );
        }
        if (col === "previous") {
          return (
            <span
              key={col}
              className="flex min-h-[44px] items-center justify-center px-1 text-center text-sm tabular-nums text-[var(--muted-strong)]"
            >
              {row.previousLabel}
            </span>
          );
        }
        if (col === "check") {
          return (
            <button
              key={col}
              type="button"
              disabled={busy}
              aria-label={
                row.completed ? `Снять подход ${row.number}` : `Записать подход ${row.number}`
              }
              className={`gym-check mx-auto flex items-center justify-center rounded-full border-2 text-lg font-bold disabled:opacity-40 ${
                row.completed
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border-quiet)] bg-white text-[var(--muted)]"
              }`}
              onClick={() => onLog(row, fields)}
            >
              {row.completed ? "✓" : ""}
            </button>
          );
        }
        const mode = inputModeForColumn(col);
        const value = fields[col];
        return (
          <label key={col} className="relative block min-h-[44px]">
            <span className="sr-only">{SET_TABLE_COLUMN_LABEL[col]}</span>
            <input
              inputMode={mode}
              enterKeyHint="done"
              autoComplete="off"
              disabled={busy}
              aria-label={
                col === "kg" && row.progressionUp
                  ? `${SET_TABLE_COLUMN_LABEL[col]}, прогрессия вверх`
                  : SET_TABLE_COLUMN_LABEL[col]
              }
              className="h-11 w-full rounded-lg border border-[var(--border-quiet)] bg-white px-2 text-center text-base tabular-nums text-[var(--foreground)] disabled:opacity-50"
              value={value}
              onFocus={(event) => {
                focused.current = true;
                if (col !== "time") return;
                const field = event.currentTarget;
                window.setTimeout(() => {
                  field.scrollIntoView({ block: "center", inline: "nearest" });
                }, 50);
              }}
              onBlur={() => {
                focused.current = false;
                if (row.source === "set") onCommit(row, fields);
              }}
              onChange={(e) => patch(col, e.target.value)}
            />
            {col === "kg" && row.progressionUp ? (
              <span
                className="pointer-events-none absolute right-1 top-1 text-[11px] font-bold text-[var(--accent)]"
                aria-hidden
              >
                ↑
              </span>
            ) : null}
          </label>
        );
      })}
      {menu ? (
        <OverflowMenu
          label={`Действия подхода ${row.number}`}
          glyph="⋮"
          items={[
            { key: "up", label: "Выше", disabled: !menu.canMoveUp || busy, onClick: menu.onUp },
            { key: "down", label: "Ниже", disabled: !menu.canMoveDown || busy, onClick: menu.onDown },
            { key: "delete", label: "Удалить", danger: true, disabled: busy, onClick: menu.onDelete },
          ]}
        />
      ) : reserveMenu ? (
        <span />
      ) : null}
    </li>
  );
}
