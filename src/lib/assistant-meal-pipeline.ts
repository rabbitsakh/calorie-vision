/**
 * Конвейер карточки еды: проза модели → actions → строки карточки → тело сохранения.
 * Им его гоняют и роуты ассистента, и корпус фраз.
 */

import { createHash } from "node:crypto";
import { splitAssistantReply, type AssistantActions } from "@/lib/admin-assistant";
import { mealsPayloadFromActions } from "@/lib/assistant-apply";
import { resolveAssistantDate } from "@/lib/assistant-date";
import { enrichAssistantActionsMealMeta } from "@/lib/assistant-meal-time";
import {
  needsWriteRepair,
  parseStructuredMealsDetailed,
  preferMultiDishActions,
  preferSlotEditActions,
  pruneNoopAssistantActions,
  repairAssistantWriteActions,
  salvageNutrientLabelMeals,
} from "@/lib/assistant-repair";
import { enrichQuickMealsFromText, type QuickMeal } from "@/lib/quick-log";

export type AssistantMealParseEvent = {
  jsonDishCount: number;
  proseDishCount: number;
  cardDishCount: number;
  missed: string[];
  unparsedCount: number;
  repairLlmUsed: boolean;
  shorterThanProse: boolean;
  phraseHash: string;
};

export function hashMealPhrase(text: string): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 500);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export function shouldLogAssistantMealParse(event: AssistantMealParseEvent): boolean {
  return (
    event.shorterThanProse ||
    event.missed.length > 0 ||
    event.unparsedCount > 0 ||
    event.repairLlmUsed
  );
}

/** stdout JSON. ASSISTANT_MEAL_TELEMETRY=0 выключает. Фраза пользователя в лог не пишется. */
export function logAssistantMealParse(event: AssistantMealParseEvent): void {
  if (process.env.ASSISTANT_MEAL_TELEMETRY === "0") return;
  if (!shouldLogAssistantMealParse(event)) return;
  const payload = {
    ...event,
    missed: event.missed.slice(0, 8).map((name) => name.slice(0, 80)),
  };
  console.info("[assistant-meal]", JSON.stringify(payload));
}

function proseDishCensus(
  reply: string,
  userMessage: string,
): { total: number; missed: string[] } {
  const fromReply = parseStructuredMealsDetailed(reply);
  const fromUser = parseStructuredMealsDetailed(userMessage);
  const replyTotal = fromReply.meals.length + fromReply.missed.length;
  const userTotal = fromUser.meals.length + fromUser.missed.length;
  if (userTotal > replyTotal) return { total: userTotal, missed: fromUser.missed };
  return { total: replyTotal, missed: fromReply.missed };
}

export async function resolveAssistantTurnActions(opts: {
  rawReply: string;
  userMessage: string;
  today: string;
  date: string;
  previewPending?: boolean;
  allowRepairLlm?: boolean;
  onBeforeRepair?: () => void;
  completeRepairChat?: (
    messages: Array<{ role: string; content: string }>,
    temperature?: number,
  ) => Promise<string>;
}): Promise<{
  reply: string;
  actions: AssistantActions | null;
  parse: AssistantMealParseEvent;
}> {
  const split = splitAssistantReply(opts.rawReply.trim());
  const reply = split.reply;
  let actions = split.actions;
  const jsonDishCount = split.actions?.meals?.length ?? 0;
  let repairLlmUsed = false;

  if (opts.previewPending && actions?.meals?.length) {
    const { meals: _drop, ...rest } = actions;
    actions = rest;
  }

  if (!opts.previewPending && needsWriteRepair(opts.userMessage, actions, reply)) {
    opts.onBeforeRepair?.();
    const repaired = await repairAssistantWriteActions({
      userMessage: opts.userMessage,
      assistantReply: reply,
      today: opts.today,
      date: opts.date,
      allowRepairLlm: opts.allowRepairLlm !== false,
      onRepairLlm: () => {
        repairLlmUsed = true;
      },
      completeRepairChat: opts.completeRepairChat,
    });
    if (repaired) actions = repaired;
  }

  const repairFromLlm = actions?.repairVia === "llm";
  if (!opts.previewPending && !repairFromLlm) {
    actions = preferMultiDishActions(opts.userMessage, reply, actions);
  }
  if (!opts.previewPending) {
    actions = preferSlotEditActions(opts.userMessage, actions);
    actions = salvageNutrientLabelMeals(actions, opts.userMessage, reply);
  }
  if (actions?.repairVia) {
    const { repairVia: _via, ...rest } = actions;
    actions = rest;
  }

  if (
    !opts.previewPending &&
    (actions?.meals?.length || actions?.patchMeals?.length || actions?.deleteMeals?.length)
  ) {
    actions = enrichAssistantActionsMealMeta(actions, opts.userMessage);
  }

  if (!opts.previewPending) {
    actions = pruneNoopAssistantActions(actions);
  }

  if (actions?.targetDate) {
    const pinned = resolveAssistantDate(actions.targetDate, opts.today);
    if (pinned) actions = { ...actions, targetDate: pinned };
  }

  const prose = proseDishCensus(reply, opts.userMessage);
  const cardDishCount = actions?.meals?.length ?? 0;
  const unparsedCount = actions?.meals?.filter((meal) => meal.unparsed).length ?? 0;
  const parse: AssistantMealParseEvent = {
    jsonDishCount,
    proseDishCount: prose.total,
    cardDishCount,
    missed: prose.missed,
    unparsedCount,
    repairLlmUsed,
    shorterThanProse: prose.total >= 2 && cardDishCount < prose.total,
    phraseHash: hashMealPhrase(opts.userMessage),
  };
  if (actions && parse.shorterThanProse) {
    actions = {
      ...actions,
      mealGap: { prose: parse.proseDishCount, card: parse.cardDishCount },
    };
  }
  logAssistantMealParse(parse);
  return { reply, actions, parse };
}

/** Серверные actions → строки карточки → то, что уйдёт в MealEntry. */
export async function runAssistantMealFixture(opts: {
  rawReply: string;
  userMessage: string;
  today?: string;
  date?: string;
  allowRepairLlm?: boolean;
  completeRepairChat?: (
    messages: Array<{ role: string; content: string }>,
    temperature?: number,
  ) => Promise<string>;
}): Promise<{
  reply: string;
  actions: AssistantActions | null;
  card: QuickMeal[];
  payload: ReturnType<typeof mealsPayloadFromActions>;
  parse: AssistantMealParseEvent;
}> {
  const today = opts.today ?? "2026-11-04";
  const date = opts.date ?? today;
  const resolved = await resolveAssistantTurnActions({
    rawReply: opts.rawReply,
    userMessage: opts.userMessage,
    today,
    date,
    allowRepairLlm: opts.allowRepairLlm ?? false,
    completeRepairChat: opts.completeRepairChat,
  });
  const card = enrichQuickMealsFromText(
    resolved.actions?.meals ?? [],
    resolved.actions?.summary ?? "",
  );
  const payload = mealsPayloadFromActions({ ...(resolved.actions ?? {}), meals: card }, date);
  return { ...resolved, card, payload };
}
