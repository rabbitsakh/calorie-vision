import { withBasePath } from "@/lib/paths";
import { workoutExportFilename, workoutExportPath } from "@/lib/workouts/export-href";

type Props = {
  from?: string | null;
  to?: string | null;
  /** Profile doors vs the compact buttons used in stats and the gym. */
  variant?: "buttons" | "doors";
};

/**
 * Same download as the meal diary: an authenticated same-origin `<a download>`.
 * The Capacitor WebView (calorievision.ru after login, no Capacitor JS) saves
 * that attachment the same way it saves `/api/export`.
 */
export function WorkoutExportLinks({ from, to, variant = "buttons" }: Props) {
  const csvHref = withBasePath(workoutExportPath("csv", from, to));
  const pdfHref = withBasePath(workoutExportPath("pdf", from, to));
  const csvName = workoutExportFilename("csv", from, to);
  const pdfName = workoutExportFilename("pdf", from, to);

  if (variant === "doors") {
    return (
      <>
        <a href={csvHref} download={csvName} className="profile-settings__door">
          <span className="min-w-0">
            <span className="block font-semibold text-[var(--foreground)]">Выгрузить тренировки</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              CSV: подходы, вес, повторы
            </span>
          </span>
          <span className="shrink-0 text-[var(--muted)]" aria-hidden>
            ↓
          </span>
        </a>
        <a href={pdfHref} download={pdfName} className="profile-settings__door">
          <span className="min-w-0">
            <span className="block font-semibold text-[var(--foreground)]">Выгрузить тренировки PDF</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">Краткая выгрузка зала</span>
          </span>
          <span className="shrink-0 text-[var(--muted)]" aria-hidden>
            ↓
          </span>
        </a>
      </>
    );
  }

  return (
    <>
      <a href={csvHref} download={csvName} className="btn btn-secondary text-sm">
        Выгрузить тренировки
      </a>
      <a href={pdfHref} download={pdfName} className="btn btn-secondary text-sm">
        Выгрузить тренировки PDF
      </a>
    </>
  );
}
