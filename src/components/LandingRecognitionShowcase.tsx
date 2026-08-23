const TYPES = [
  {
    index: "01",
    title: "Тарелка и контейнер",
    text: "Несколько блюд с одного кадра — салат, гарнир и мясо отдельными позициями с порциями.",
    tag: "meal",
  },
  {
    index: "02",
    title: "Этикетка КБЖУ",
    text: "Читаем таблицу с упаковки: калории, белки, жиры, углеводы, клетчатка и сахар.",
    tag: "label",
  },
  {
    index: "03",
    title: "Упаковка и напитки",
    text: "Лицевая сторона пачки, бутылка или стакан — с объёмом порции и пересчётом на граммы.",
    tag: "package",
  },
  {
    index: "04",
    title: "Штрихкод",
    text: "Скан EAN → продукт из базы; если кода нет — оценка по номеру штрихкода с проверкой порции.",
    tag: "barcode",
  },
  {
    index: "05",
    title: "Текстом",
    text: "«Гречка с курицей» или «творог 5%» — поиск по названию без камеры, за пару секунд.",
    tag: "text",
  },
] as const;

export function LandingRecognitionShowcase() {
  return (
    <section id="recognition" className="landing-section">
      <div className="landing-section-head">
        <p className="landing-kicker">Распознавание</p>
        <h2 className="landing-section-title">Понимает не только тарелку</h2>
        <p className="landing-section-text landing-section-text-wide">
          Подстраивается под то, что вы реально снимаете в магазине, дома или в кафе — и не
          заставляет вбивать граммы вручную.
        </p>
      </div>
      <ol className="landing-spec-list landing-stagger">
        {TYPES.map((item) => (
          <li key={item.tag} className="landing-spec-row">
            <span className="landing-spec-index" aria-hidden>
              {item.index}
            </span>
            <div className="landing-spec-body">
              <h3 className="landing-spec-title">{item.title}</h3>
              <p className="landing-spec-text">{item.text}</p>
            </div>
            <span className="landing-spec-meta">{item.tag}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
