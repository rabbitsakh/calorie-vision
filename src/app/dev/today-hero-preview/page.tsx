import { Suspense } from "react";
import { TodayHeroPreview } from "./TodayHeroPreview";
import "./preview.css";

export const metadata = {
  title: "Макет карточки «Сегодня»",
  robots: { index: false, follow: false },
};

/** Стенд новой карточки дня. В прод не входит: страница только для просмотра. */
export default function TodayHeroPreviewPage() {
  return (
    <Suspense>
      <TodayHeroPreview />
    </Suspense>
  );
}
