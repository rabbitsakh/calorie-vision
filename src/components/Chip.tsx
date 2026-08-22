import type { ButtonHTMLAttributes, ReactNode } from "react";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
};

export function Chip({ active, className = "", type = "button", children, ...props }: ChipProps) {
  return (
    <button
      type={type}
      className={`chip ${active ? "chip-active" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
