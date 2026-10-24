/** D23 — five product beats, not a nine-cell catalog. */
const FEATURES = [
  {
    title: "Фото за секунды",
    text: "Камера или галерея — карточка проверки сразу. Можно сохранить, не дожидаясь уточнения из базы.",
  },
  {
    title: "Офлайн-очередь",
    text: "Нет сети — фото и сохранения остаются на устройстве. Когда интернет вернётся, распознаем и отправим.",
  },
  {
    title: "Кольцо дня",
    text: "Калории, белок, клетчатка и сахар относительно цели: похудение, набор или поддержание.",
  },
  {
    title: "Тренировки в зале",
    text: "Силовые и кардио: подходы, шаблоны на неделю, отдых и итог тренировки.",
  },
  {
    title: "Мягкие push",
    text: "Еда и вода — только если включили. На iPhone — с иконки на «Домой».",
  },
] as const;

export function LandingFeatureGrid() {
  return (
    <dl className="landing-feature-matrix landing-stagger">
      {FEATURES.map((item) => (
        <div key={item.title} className="landing-feature-cell">
          <dt className="landing-feature-title">{item.title}</dt>
          <dd className="landing-feature-text">{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}
