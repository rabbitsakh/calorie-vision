import type { ReactNode } from "react";
import { LiveMascot } from "@/components/LiveMascot";
import type { MascotPose } from "@/components/Mascot";

type MascotCompanionTone = "teal" | "orange" | "amber";

const TONE_CLASS: Record<MascotCompanionTone, string> = {
  teal: "border-slate-200 bg-gradient-to-r from-slate-50 to-teal-50/40",
  orange: "border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50",
  amber: "border-amber-200 bg-amber-50/90",
};

const TITLE_CLASS: Record<MascotCompanionTone, string> = {
  teal: "text-teal-700",
  orange: "text-orange-900",
  amber: "text-amber-950",
};

type MascotCompanionCardProps = {
  pose?: MascotPose;
  size?: "sm" | "md";
  tone?: MascotCompanionTone;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  onHide?: () => void;
  hideLabel?: string;
  className?: string;
  animate?: boolean;
};

/** Small in-app companion panel with the mascot (tips, nudges, push hints). */
export function MascotCompanionCard({
  pose = "tip",
  size = "sm",
  tone = "teal",
  title,
  children,
  actions,
  onHide,
  hideLabel = "Скрыть",
  className = "",
  animate = true,
}: MascotCompanionCardProps) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${TONE_CLASS[tone]} ${className}`.trim()}>
      <div className="flex items-start gap-3">
        <LiveMascot
          pose={pose}
          size={size}
          className="mt-0.5 shrink-0"
          idleReel={animate && pose === "idle"}
          interactive={animate && size !== "sm"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-xs font-medium uppercase tracking-wide ${TITLE_CLASS[tone]}`}>{title}</p>
            {onHide ? (
              <button type="button" className="btn-quiet shrink-0 text-xs text-slate-500" onClick={onHide}>
                {hideLabel}
              </button>
            ) : null}
          </div>
          <div className="mt-1 text-sm text-slate-800">{children}</div>
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
