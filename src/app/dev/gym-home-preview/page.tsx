import { Suspense } from "react";
import { GymHomePreview } from "./GymHomePreview";

/** Стенд главной зала и итога: те же компоненты, без базы. */
export default function GymHomePreviewPage() {
  return (
    <Suspense>
      <GymHomePreview />
    </Suspense>
  );
}
