const STATS = [
  { value: "фото · текст · EAN", label: "три входа в дневник" },
  { value: "~10 с", label: "от снимка до записи" },
  { value: "0 ₽", label: "на этапе запуска" },
  { value: "PWA", label: "иконка на «Домой»" },
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
