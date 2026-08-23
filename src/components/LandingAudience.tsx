const AUDIENCES = [
  {
    title: "Снижение веса",
    text: "Видите дефицит калорий за день, темп по весу и подсказки, когда дневник уходит слишком низко или высоко.",
    bullets: ["норма по цели", "бюджет по приёмам", "мягкие напоминания"],
  },
  {
    title: "Набор массы",
    text: "Следите за белком и калориями, чтобы не недобирать — особенно после тренировок и плотных дней.",
    bullets: ["белок на кольце", "быстрое повторение", "избранные блюда"],
  },
  {
    title: "Баланс и привычка",
    text: "Не обязательно «диета» — просто понимать, что вы едите, и не бросать дневник через три дня.",
    bullets: ["серия без штрафов", "заметка о дне", "вода и БЖУ"],
  },
] as const;

export function LandingAudience() {
  return (
    <section id="for-whom" className="landing-section landing-section-band">
      <p className="landing-kicker">Для кого</p>
      <h2 className="landing-section-title">Под вашу цель — без лишней сложности</h2>
      <p className="landing-section-text landing-section-text-wide">
        Один дневник для разных задач: укажите цель в профиле — и подсказки, нормы и статистика
        подстроятся под вас.
      </p>
      <ul className="landing-audience-grid">
        {AUDIENCES.map((item) => (
          <li key={item.title} className="landing-audience-card">
            <h3 className="landing-audience-title">{item.title}</h3>
            <p className="landing-section-text">{item.text}</p>
            <ul className="landing-audience-bullets">
              {item.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
