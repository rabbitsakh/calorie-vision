const TRUST = [
  {
    title: "Уверенность на виду",
    text: "На карточке проверки — процент и подсказка: сохранить, проверить порцию или уточнить название.",
  },
  {
    title: "Правки запоминаются",
    text: "Исправили блюдо один раз — в следующий раз подставим ваш вариант автоматически.",
  },
  {
    title: "Сеть не обязательна",
    text: "Сняли фото в метро — оно в очереди на устройстве. Распознаем, когда появится интернет.",
  },
] as const;

/** Editorial trust band — product waves C/D without card chrome. */
export function LandingTrustBand() {
  return (
    <section id="trust" className="landing-section landing-section-band">
      <div className="landing-section-head">
        <p className="landing-kicker">Доверие</p>
        <h2 className="landing-section-title">Вы решаете — ИИ только предлагает</h2>
        <p className="landing-section-text landing-section-text-wide">
          Калории по фото — оценка, не лаборатория. Поэтому каждая запись проходит через проверку,
          а сбои сети не теряют ваш снимок.
        </p>
      </div>
      <ul className="landing-trust-columns landing-stagger">
        {TRUST.map((item) => (
          <li key={item.title} className="landing-trust-col">
            <h3 className="landing-trust-title">{item.title}</h3>
            <p className="landing-trust-text">{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
