import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { withBasePath } from "@/lib/paths";

type LegalDocumentProps = {
  title: string;
  updated: string;
  children: ReactNode;
};

/** Shared shell for /privacy, /terms, /disclaimer — on-brand teal/slate, not purple/cream. */
export function LegalDocument({ title, updated, children }: LegalDocumentProps) {
  return (
    <main className="legal-page mx-auto min-h-screen max-w-3xl px-4 py-8 md:py-12">
      <header className="legal-page-header mb-8">
        <Link
          href={withBasePath("/")}
          className="inline-flex items-center gap-2 text-teal-800 no-underline hover:opacity-90"
        >
          <BrandMark size={36} decorative={false} />
          <span className="font-display text-lg font-semibold tracking-tight">Calorie Vision</span>
        </Link>
        <h1 className="font-display mt-6 text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Обновлено: {updated}</p>
      </header>

      <article className="legal-prose card p-5 md:p-8">{children}</article>

      <nav className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600" aria-label="Юридические документы">
        <Link href={withBasePath("/privacy")} className="text-teal-800 underline-offset-2 hover:underline">
          Конфиденциальность
        </Link>
        <Link href={withBasePath("/terms")} className="text-teal-800 underline-offset-2 hover:underline">
          Условия использования
        </Link>
        <Link href={withBasePath("/disclaimer")} className="text-teal-800 underline-offset-2 hover:underline">
          Медицинский дисклеймер
        </Link>
        <Link href={withBasePath("/")} className="text-slate-500 underline-offset-2 hover:underline">
          На главную
        </Link>
      </nav>
    </main>
  );
}
