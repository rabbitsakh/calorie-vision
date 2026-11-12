import { Suspense } from "react";
import { GymActivePreview } from "./GymActivePreview";

/** Стенд активной тренировки: те же компоненты, что в зале, без базы. */
export default function GymActivePreviewPage() {
  return (
    <Suspense>
      <GymActivePreview />
    </Suspense>
  );
}
