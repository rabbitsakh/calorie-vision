export function DaisyLoading({ label = "Загрузка..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-4 text-sm text-slate-500">
      <span className="daisy-loading" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span>{label}</span>
    </div>
  );
}
