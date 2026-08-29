const PULSE = [
  {
    title: "Вода",
    text: "Быстрые +мл в рационе — привычка рядом с едой, без отдельного приложения.",
  },
  {
    title: "Серия",
    text: "Мягкий стрик и заморозка дня — без штрафов, если пропустили один день.",
  },
  {
    title: "Неделя",
    text: "Челлендж, сводка и лучший/сложный день — чтобы видеть прогресс, а не только граммы.",
  },
] as const;

/** Soft day-loop strip between features and audience. */
export function LandingDayPulse() {
  return (
    <section id="day" className="landing-section">
      <div className="landing-section-head">
        <p className="landing-kicker">День с вами</p>
        <h2 className="landing-section-title">Привычка, а не контроль</h2>
        <p className="landing-section-text landing-section-text-wide">
          Вода, серия и недельный ритм помогают возвращаться в дневник — спокойно, без давления.
        </p>
      </div>
      <ul className="landing-pulse-row landing-stagger">
        {PULSE.map((item) => (
          <li key={item.title} className="landing-pulse-item">
            <h3 className="landing-pulse-title">{item.title}</h3>
            <p className="landing-pulse-text">{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
