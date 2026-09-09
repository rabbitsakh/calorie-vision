import { notFound } from "next/navigation";
import { OnboardingStackPreviewClient } from "./OnboardingStackPreviewClient";

/** Dev-only: verify onboarding sheet stacks above MobileTabBar. */
export default function OnboardingStackPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <OnboardingStackPreviewClient />;
}
