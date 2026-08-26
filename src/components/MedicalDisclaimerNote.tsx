"use client";

import Link from "next/link";
import { withBasePath } from "@/lib/paths";

/** Short non-medical notice for profile / ration / diet targets. */
export function MedicalDisclaimerNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-slate-500 ${className}`.trim()}>
      Приложение не является медицинской консультацией. Нормы и калории — справочная оценка.{" "}
      <Link
        href={withBasePath("/disclaimer")}
        className="text-teal-800 underline-offset-2 hover:underline"
      >
        Подробнее
      </Link>
    </p>
  );
}
