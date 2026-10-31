import { RustoreShotsClient } from "./RustoreShotsClient";

type Props = { searchParams: Promise<{ shot?: string }> };

/** Store-ready phone frames for RuStore (no auth). Capture via `npm run rustore:screenshots`. */
export default async function RustoreShotsPage({ searchParams }: Props) {
  const { shot } = await searchParams;
  return <RustoreShotsClient shot={shot ?? "01"} />;
}
