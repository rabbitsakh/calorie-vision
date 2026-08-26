"use client";

import { useEffect, useMemo, useState } from "react";
import { useRive, EventType, Layout, Fit, Alignment } from "@rive-app/react-canvas";
import { MascotArt } from "@/components/MascotArt";
import type { MascotGesture } from "@/lib/mascot-liveness";
import { mascotRivUrl, type MascotSkinId } from "@/lib/mascot-skin";
import { MASCOT_SIZE_PX, type MascotBaseProps, type MascotPose } from "@/lib/mascot-types";

const POSE_INDEX: Record<MascotPose, number> = {
  idle: 0,
  cheer: 1,
  streak: 2,
  goal: 3,
  empty: 4,
  tip: 5,
};

const GESTURE_TRIGGER: Partial<Record<MascotGesture, string>> = {
  look: "gestureLook",
  yawn: "gestureYawn",
  stretch: "gestureStretch",
  wave: "gestureWave",
  pet: "gesturePet",
  react: "gestureReact",
};

export type MascotRiveProps = Omit<MascotBaseProps, "skin"> & {
  skin: MascotSkinId;
};

/**
 * Optional Rive renderer — loads /mascot/{skin}.riv when present.
 * Falls back to illustrated art on missing asset or runtime error.
 */
export function MascotRive({ skin, size = "md", className, ...props }: MascotRiveProps) {
  const src = mascotRivUrl(skin);
  const [assetOk, setAssetOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAssetOk(null);
    fetch(src, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setAssetOk(res.ok);
      })
      .catch(() => {
        if (!cancelled) setAssetOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (assetOk !== true) {
    return <MascotArt {...props} skin={skin} size={size} className={className} />;
  }

  return (
    <MascotRiveCanvas
      {...props}
      skin={skin}
      size={size}
      className={className}
      src={src}
      onFail={() => setAssetOk(false)}
    />
  );
}

function MascotRiveCanvas({
  src,
  skin: _skin,
  pose = "idle",
  gesture = "none",
  size = "md",
  className,
  title = "Талисман Calorie Vision",
  animate = true,
  entrance = false,
  onFail,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  "aria-label": ariaLabel,
}: MascotRiveProps & { src: string; onFail: () => void }) {
  const px = MASCOT_SIZE_PX[size];

  const layout = useMemo(() => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }), []);

  const { rive, RiveComponent } = useRive({
    src,
    stateMachines: "State Machine 1",
    layout,
    autoplay: true,
    onLoadError: onFail,
  });

  useEffect(() => {
    if (!rive) return;
    const poseInput = rive.stateMachineInputs("State Machine 1")?.find((i) => i.name === "pose");
    if (poseInput && "value" in poseInput) {
      poseInput.value = POSE_INDEX[pose];
    }
  }, [rive, pose]);

  useEffect(() => {
    if (!rive || gesture === "none" || !animate) return;
    const triggerName = GESTURE_TRIGGER[gesture];
    if (!triggerName) return;
    const trigger = rive.stateMachineInputs("State Machine 1")?.find((i) => i.name === triggerName);
    trigger?.fire();
  }, [rive, gesture, animate]);

  useEffect(() => {
    if (!rive || !entrance) return;
    const trigger = rive.stateMachineInputs("State Machine 1")?.find((i) => i.name === "entrance");
    trigger?.fire();
  }, [rive, entrance]);

  useEffect(() => {
    if (!rive) return;
    rive.on(EventType.LoadError, onFail);
  }, [rive, onFail]);

  const wrapperClass = ["mascot-rive-wrap", entrance ? "mascot-entrance" : "", className]
    .filter(Boolean)
    .join(" ");
  const label = ariaLabel ?? title;

  return (
    <div
      className={wrapperClass}
      style={{ width: px, height: px }}
      role={role ?? "img"}
      aria-label={label}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <RiveComponent style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
