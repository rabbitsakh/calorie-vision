const STATS = [
  { value: "фото · EAN · текст", label: "три быстрых входа" },
  { value: "проверка", label: "порция и уверенность" },
  { value: "офлайн", label: "фото ждёт сеть" },
  { value: "0 ₽", label: "весь дневник сейчас" },
] as const;

/** Dense typographic proof line — not a card strip. */
export function LandingStatsStrip() {
  return (
    <section className="landing-proof" aria-label="Ключевые факты">
      <ul className="landing-proof-list">
        {STATS.map((item) => (
          <li key={item.label} className="landing-proof-item">
            <span className="landing-proof-value">{item.value}</span>
            <span className="landing-proof-label">{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
