import { Suspense } from "react";
import { NarrowLayoutPreview } from "./NarrowLayoutPreview";

export const metadata = {
  title: "Узкая вёрстка",
  robots: { index: false, follow: false },
};

/** Стенд для автотеста узких экранов. В дневник ничего не пишет. */
export default function NarrowLayoutPage() {
  return (
    <Suspense>
      <NarrowLayoutPreview />
    </Suspense>
  );
}
