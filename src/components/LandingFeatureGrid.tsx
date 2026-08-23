const FEATURES = [
  {
    icon: "📸",
    title: "Фото за секунды",
    text: "Камера или галерея — результат сразу на экране проверки, можно сохранить не дожидаясь уточнения из базы.",
    tone: "teal",
  },
  {
    icon: "🎯",
    title: "Кольцо дня",
    text: "Калории и белок относительно вашей цели: похудение, набор или поддержание веса.",
    tone: "mint",
  },
  {
    icon: "💧",
    title: "Вода и привычки",
    text: "Трекер воды, серия записей, недельный челлендж и мягкие напоминания — без давления.",
    tone: "sky",
  },
  {
    icon: "📈",
    title: "Статистика и вес",
    text: "Графики калорий и макросов, календарь веса, недельный отчёт и динамика к цели.",
    tone: "amber",
  },
  {
    icon: "🔔",
    title: "Умные push",
    text: "Завтрак, обед, вода, сводка дня и вечерний чек-ин — только если вы включили уведомления.",
    tone: "violet",
  },
  {
    icon: "🧠",
    title: "Запоминает правки",
    text: "Исправили название или порцию — в следующий раз подставим ваш вариант автоматически.",
    tone: "rose",
  },
] as const;

export function LandingFeatureGrid() {
  return (
    <ul className="landing-bento">
      {FEATURES.map((item) => (
        <li key={item.title} className={`landing-bento-card landing-bento-${item.tone}`}>
          <span className="landing-bento-icon" aria-hidden>
            {item.icon}
          </span>
          <h3 className="landing-bento-title">{item.title}</h3>
          <p className="landing-bento-text">{item.text}</p>
        </li>
      ))}
    </ul>
  );
}
