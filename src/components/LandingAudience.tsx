const AUDIENCES = [
  {
    title: "Снижение веса",
    text: "Видите дефицит за день, темп по весу и подсказки, когда дневник уходит слишком низко или высоко.",
    points: ["норма по цели", "бюджет по приёмам", "мягкие напоминания"],
  },
  {
    title: "Набор массы",
    text: "Следите за белком и калориями, чтобы не недобирать — особенно после тренировок и плотных дней.",
    points: ["белок на кольце", "быстрое повторение", "избранные блюда"],
  },
  {
    title: "Баланс и привычка",
    text: "Не обязательно «диета» — просто понимать, что вы едите, и не бросать дневник через три дня.",
    points: ["серия без штрафов", "заметка о дне", "вода и БЖУ"],
  },
] as const;

export function LandingAudience() {
  return (
    <section id="for-whom" className="landing-section landing-section-band">
      <div className="landing-section-head">
        <p className="landing-kicker">Для кого</p>
        <h2 className="landing-section-title">Под вашу цель — без лишней сложности</h2>
        <p className="landing-section-text landing-section-text-wide">
          Один дневник для разных задач: укажите цель в профиле — нормы, подсказки и статистика
          подстроятся.
        </p>
      </div>
      <ul className="landing-audience-columns landing-stagger">
        {AUDIENCES.map((item) => (
          <li key={item.title} className="landing-audience-col">
            <h3 className="landing-audience-title">{item.title}</h3>
            <p className="landing-audience-text">{item.text}</p>
            <p className="landing-audience-points">{item.points.join(" · ")}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
