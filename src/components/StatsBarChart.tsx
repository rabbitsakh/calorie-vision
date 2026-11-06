import { formatDateShort } from "@/lib/dates";
import {
  axisLabelIndices,
  calorieBarHeightPx,
  planCalorieBarChart,
  yAxisTicks,
  type CalorieBarChartModel,
} from "@/lib/stats-chart-layout";

export type StatsBarDay = {
  date: string;
  calories: number;
};

type StatsBarChartProps = {
  days: StatsBarDay[];
  period: "week" | "month" | "quarter";
  targetValue?: number | null;
  unit?: string;
};

function formatChartTick(value: number): string {
  return String(Math.round(value));
}

/** Day number on dense axes; full short date when the column has room. */
function formatAxisDate(dateKey: string, compact: boolean): string {
  if (!compact) return formatDateShort(dateKey);
  const short = formatDateShort(dateKey);
  const day = short.match(/\d+/)?.[0];
  return day ?? short;
}

function tickTopPx(model: CalorieBarChartModel, index: number, count: number): number {
  if (count <= 1) return model.labelAreaHeightPx;
  return model.labelAreaHeightPx + (index / (count - 1)) * model.plotHeightPx;
}

/**
 * «Калории по дням». Each logged day has a visible kcal number above the bar
 * (or inside it, if the bar would otherwise push the text out of the chart).
 * Narrow periods scroll sideways instead of dropping or clipping labels.
 */
export function StatsBarChart({
  days,
  period,
  targetValue,
  unit = "ккал",
}: StatsBarChartProps) {
  const model = planCalorieBarChart({
    values: days.map((day) => day.calories),
    target: targetValue,
  });
  const ticks = yAxisTicks(model.min, model.max);
  const xLabels = axisLabelIndices(days.length, period);
  const compactAxis = days.length > 5;
  const targetY =
    targetValue != null && targetValue > 0
      ? model.totalHeightPx -
        calorieBarHeightPx(targetValue, model.min, model.max, model.plotHeightPx)
      : null;

  const columnStyle = {
    flex: "1 0 auto",
    minWidth: model.columnMinPx,
  } as const;

  return (
    <div className="flex gap-2 sm:gap-3" data-chart-height={model.totalHeightPx}>
      <div
        className="relative shrink-0 text-right text-xs font-medium text-[var(--muted)]"
        style={{ height: model.totalHeightPx, width: "2.75rem" }}
        aria-hidden="true"
      >
        {ticks.map((tick, index) => (
          <span
            key={`${tick}-${index}`}
            className="absolute right-0 -translate-y-1/2 leading-none"
            style={{ top: `${tickTopPx(model, index, ticks.length)}px` }}
          >
            {formatChartTick(tick)}
          </span>
        ))}
      </div>

      <div
        className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden border-l border-[var(--border-quiet)] pl-2 sm:pl-3"
        data-calorie-scroll
      >
        <div style={{ minWidth: model.contentMinWidthPx }}>
          <div className="relative" style={{ height: model.totalHeightPx }}>
            {ticks.map((tick, index) => (
              <div
                key={`grid-${tick}-${index}`}
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-[var(--border-hairline)]"
                style={{ top: `${tickTopPx(model, index, ticks.length)}px` }}
              />
            ))}

            <div
              className="absolute inset-0 flex"
              style={{ gap: model.columnGapPx }}
            >
              {days.map((day, index) => {
                const bar = model.bars[index];
                const value = bar?.value ?? 0;
                const heightPx = bar?.heightPx ?? 0;
                const barColor = bar?.overTarget ? "bg-rose-500" : "bg-[var(--accent)]";
                return (
                  <div key={day.date} className="relative h-full overflow-hidden" style={columnStyle}>
                    {value > 0 ? (
                      <div
                        className={`absolute bottom-0 left-1/2 w-[70%] max-w-8 -translate-x-1/2 rounded-t-md ${barColor}`}
                        style={{ height: `${heightPx}px` }}
                        data-over-target={bar?.overTarget ? "true" : "false"}
                        title={`${formatDateShort(day.date)}: ${bar?.label?.text ?? value} ${unit}`}
                      />
                    ) : (
                      <div className="absolute bottom-0 left-1/2 h-0.5 w-[70%] max-w-8 -translate-x-1/2 rounded bg-[var(--accent-soft)]" />
                    )}
                  </div>
                );
              })}
            </div>

            {targetY != null ? (
              <div
                className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-dashed border-amber-400"
                style={{ top: `${targetY}px` }}
              />
            ) : null}

            <div
              className="pointer-events-none absolute inset-0 z-20 flex"
              style={{ gap: model.columnGapPx }}
            >
              {days.map((day, index) => {
                const label = model.bars[index]?.label;
                return (
                  <div key={`${day.date}-value`} className="relative h-full overflow-hidden" style={columnStyle}>
                    {label ? (
                      <div
                        className="absolute inset-x-0 flex justify-center"
                        style={{
                          bottom: `${label.bottomPx}px`,
                          height: `${label.heightPx}px`,
                          alignItems: label.inside ? "flex-start" : "flex-end",
                        }}
                        data-calorie-value={label.text}
                        data-label-bottom={label.bottomPx}
                        data-label-height={label.heightPx}
                        data-label-inside={label.inside ? "true" : "false"}
                      >
                        <span
                          className={`font-semibold leading-none ${
                            label.inside ? "text-white" : "text-[var(--muted-strong)]"
                          }`}
                          style={{
                            writingMode: "vertical-lr",
                            transform: "rotate(180deg)",
                            fontSize: 12,
                            lineHeight: 1,
                          }}
                        >
                          {label.text}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="mt-1 flex"
            style={{ gap: model.columnGapPx }}
            aria-hidden="true"
          >
            {days.map((day, index) => (
              <div
                key={`${day.date}-lbl`}
                className="flex h-4 items-center justify-center overflow-hidden"
                style={columnStyle}
              >
                {xLabels.has(index) ? (
                  <span className="block w-full truncate text-center text-[10px] font-medium leading-none text-[var(--muted)] sm:text-xs">
                    {formatAxisDate(day.date, compactAxis && index !== 0 && index !== days.length - 1)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
