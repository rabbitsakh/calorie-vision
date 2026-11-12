import { Suspense } from "react";
import { GymMorePreview } from "./GymMorePreview";

/** Стенд графика, шаблонов и истории без базы. */
export default function GymMorePreviewPage() {
  return (
    <Suspense>
      <GymMorePreview />
    </Suspense>
  );
}
