import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

/** Primary, secondary, or destructive action. Danger is only for irreversible steps. */
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`ds-btn ds-btn--${variant} ${className}`.trim()}
      {...props}
    />
  );
}

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`ds-card ${className}`.trim()} {...props} />;
}

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean };

export function Chip({ on = false, className = "", type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      className={`ds-chip${on ? " is-on" : ""} ${className}`.trim()}
      aria-pressed={on}
      {...props}
    />
  );
}

export function Field({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ds-field ${className}`.trim()} {...props} />;
}

type RowProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  hint?: string;
};

export function ListRow({ title, hint, className = "", type = "button", ...props }: RowProps) {
  return (
    <button type={type} className={`ds-row ${className}`.trim()} {...props}>
      <span className="min-w-0 text-left">
        <span className="block font-semibold">{title}</span>
        {hint ? <span className="mt-0.5 block text-xs text-[var(--muted)]">{hint}</span> : null}
      </span>
      <span aria-hidden className="shrink-0 text-[var(--muted)]">
        →
      </span>
    </button>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  className = "",
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ds-empty ${className}`.trim()}>
      <p className="scene-empty__title">{title}</p>
      {hint ? <p className="scene-empty__hint">{hint}</p> : null}
      {action}
    </div>
  );
}

/** Presentational bottom sheet. The caller owns open state and the backdrop. */
export function BottomSheet({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`gym-sheet ds-sheet ${className}`.trim()} role="dialog" aria-label={title}>
      {title ? <p className="ds-eyebrow">{title}</p> : null}
      {children}
    </div>
  );
}
