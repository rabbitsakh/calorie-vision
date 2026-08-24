"use client";

import { useEffect, useMemo, useState, type KeyboardEventHandler, type MouseEventHandler } from "react";
import { useRive, EventType, Layout, Fit, Alignment } from "@rive-app/react-canvas";
import { MascotSvg, type MascotSvgProps } from "@/components/MascotSvg";
import type { MascotGesture } from "@/lib/mascot-liveness";
import type { MascotPose } from "@/components/MascotSvg";
import { mascotRivUrl, type MascotSkinId } from "@/lib/mascot-skin";

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

export type MascotRiveProps = Omit<MascotSvgProps, "skin"> & {
  skin: MascotSkinId;
};

/**
 * Optional Rive renderer — loads /mascot/{skin}.riv when present.
 * Falls back to MascotSvg on missing asset or runtime error.
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

  if (assetOk === false) {
    return <MascotSvg {...props} skin={skin} size={size} className={className} />;
  }

  if (assetOk !== true) {
    return <MascotSvg {...props} skin={skin} size={size} className={className} />;
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
  const sizePx = { sm: 44, md: 72, lg: 112, xl: 220 } as const;
  const px = sizePx[size];

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

  const wrapperClass = ["mascot-rive-wrap", entrance ? "mascot-entrance" : "", className].filter(Boolean).join(" ");
  const label = ariaLabel ?? title;

  return (
    <div
      className={wrapperClass}
      style={{ width: px, height: px }}
      role={role ?? "img"}
      aria-label={label}
      tabIndex={tabIndex}
      onClick={onClick as MouseEventHandler<HTMLDivElement> | undefined}
      onKeyDown={onKeyDown as KeyboardEventHandler<HTMLDivElement> | undefined}
    >
      <RiveComponent style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
