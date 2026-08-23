const TYPES = [
  {
    emoji: "🍽️",
    title: "Тарелка и контейнер",
    text: "Несколько блюд с одного кадра — салат, гарнир и мясо отдельными позициями.",
    tag: "meal",
  },
  {
    emoji: "🏷️",
    title: "Этикетка КБЖУ",
    text: "Читаем таблицу с упаковки: калории, белки, жиры, углеводы, клетчатка и сахар.",
    tag: "label",
  },
  {
    emoji: "📦",
    title: "Упаковка и напитки",
    text: "Лицевая сторона пачки, бутылка сока или стакан молока — с объёмом порции.",
    tag: "package",
  },
  {
    emoji: "📊",
    title: "Штрихкод",
    text: "Сканируете EAN — подтягиваем продукт из Open Food Facts и уточняем порцию.",
    tag: "barcode",
  },
  {
    emoji: "✍️",
    title: "Текстом",
    text: "«Гречка с курицей» или «творог 5%» — поиск по названию без камеры.",
    tag: "text",
  },
] as const;

export function LandingRecognitionShowcase() {
  return (
    <section id="recognition" className="landing-section">
      <p className="landing-kicker">Распознавание</p>
      <h2 className="landing-section-title">Понимает не только тарелку</h2>
      <p className="landing-section-text landing-section-text-wide">
        Calorie Vision подстраивается под то, что вы реально фотографируете в магазине, дома или в
        кафе — и не заставляет вбивать граммы вручную.
      </p>
      <ul className="landing-recog-grid">
        {TYPES.map((item) => (
          <li key={item.tag} className="landing-recog-card">
            <span className="landing-recog-emoji" aria-hidden>
              {item.emoji}
            </span>
            <h3 className="landing-recog-title">{item.title}</h3>
            <p className="landing-section-text">{item.text}</p>
            <span className="landing-recog-tag">{item.tag}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
