import { EveningSummaryPreview } from "./EveningSummaryPreview";

export const metadata = {
  title: "Итог дня",
  robots: { index: false, follow: false },
};

/** Стенд карточки вечернего итога. В прод-навигацию не входит. */
export default function EveningSummaryPreviewPage() {
  return <EveningSummaryPreview />;
}
