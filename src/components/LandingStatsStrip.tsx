const STATS = [
  { value: "3", label: "способа добавить еду", detail: "фото · текст · штрихкод" },
  { value: "~10 с", label: "от снимка до записи", detail: "с проверкой порции" },
  { value: "0 ₽", label: "на этапе запуска", detail: "без подписки" },
  { value: "PWA", label: "как приложение", detail: "иконка на экране «Домой»" },
] as const;

export function LandingStatsStrip() {
  return (
    <section className="landing-stats" aria-label="Ключевые факты">
      <ul className="landing-stats-grid">
        {STATS.map((item) => (
          <li key={item.label} className="landing-stat-card">
            <p className="landing-stat-value">{item.value}</p>
            <p className="landing-stat-label">{item.label}</p>
            <p className="landing-stat-detail">{item.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
