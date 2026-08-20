import { formatBalanceLabel, sexNoun, type NutrientComparison, type Sex } from "@/lib/diet";

type DietTargetsProps = {
  comparison: {
    calories: NutrientComparison;
    protein: NutrientComparison;
    fat: NutrientComparison;
    carbs: NutrientComparison;
  };
  calorieTone: "good" | "warn" | "ok";
  weightKg: number;
  dietLabel?: string | null;
  sex?: Sex | null;
};

function Meter({
  label,
  unit,
  comparison,
  tone = "ok",
}: {
  label: string;
  unit: string;
  comparison: NutrientComparison;
  tone?: "good" | "warn" | "ok";
}) {
  const percent = comparison.target <= 0 ? 0 : (comparison.actual / comparison.target) * 100;
  const capped = Math.min(100, percent);
  const overflow = percent > 105;
  const barClass = tone === "warn" ? "bg-amber-500" : tone === "good" ? "bg-teal-600" : "bg-slate-500";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">
          {comparison.actual} / {comparison.target} {unit}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-3 rounded-full ${barClass} transition-all`} style={{ width: `${capped}%` }} />
        {overflow ? (
          <div className="absolute inset-y-0 right-0 w-2 rounded-r-full bg-red-400" />
        ) : null}
      </div>
      <p className={`text-xs ${tone === "warn" ? "text-amber-700" : "text-slate-500"}`}>
        {formatBalanceLabel(comparison, unit)}
      </p>
    </div>
  );
}

export function DietTargets({ comparison, calorieTone, weightKg, dietLabel, sex }: DietTargetsProps) {
  const sexText = sexNoun(sex);
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-700">Рекомендуемый рацион на день</p>
      <p className="mt-1 text-xs text-slate-500">
        Норма для {weightKg} кг
        {sexText ? ` · ${sexText}` : ""}
        {dietLabel ? ` · ${dietLabel}` : ""}
      </p>
      {!sex ? (
        <p className="mt-1 text-xs text-amber-700">Укажите пол в профиле — норма станет точнее</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3">
        <Meter label="Калории" unit="ккал" comparison={comparison.calories} tone={calorieTone} />
        <Meter label="Белки" unit="г" comparison={comparison.protein} />
        <Meter label="Жиры" unit="г" comparison={comparison.fat} />
        <Meter label="Углеводы" unit="г" comparison={comparison.carbs} />
      </div>
    </div>
  );
}
