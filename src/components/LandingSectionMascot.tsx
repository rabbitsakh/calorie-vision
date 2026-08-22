"use client";

import { Mascot, type MascotPose } from "@/components/Mascot";

type LandingSectionMascotProps = {
  pose?: MascotPose;
  align?: "left" | "right";
  className?: string;
};

export function LandingSectionMascot({
  pose = "idle",
  align = "right",
  className = "",
}: LandingSectionMascotProps) {
  const classes = [
    "landing-section-mascot",
    align === "left" ? "landing-section-mascot-left" : "landing-section-mascot-right",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`landing-section-mascot-wrap ${align === "left" ? "landing-section-mascot-wrap-left" : "landing-section-mascot-wrap-right"}`}
      aria-hidden
    >
      <div className={classes}>
        <Mascot pose={pose} size="lg" title="Талисман Calorie Vision" />
      </div>
    </div>
  );
}
