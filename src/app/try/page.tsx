import type { Metadata } from "next";
import { GuestTryClient } from "@/components/GuestTryClient";

export const metadata: Metadata = {
  title: "Попробовать без входа",
  description: "1–2 фото еды без регистрации: порция и КБЖУ за секунды.",
};

export default function TryPage() {
  return <GuestTryClient />;
}
