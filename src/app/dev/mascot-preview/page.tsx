import { Suspense } from "react";
import MascotFuturePreviewPage from "./MascotFuturePreviewClient";

export default function MascotPreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-100" />}>
      <MascotFuturePreviewPage />
    </Suspense>
  );
}
