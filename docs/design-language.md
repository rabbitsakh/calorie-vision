# Design language (Calorie Vision)

Wave C0 — short contract for product UI. Prefer this over inventing a new look.

## Brand & surface
- Cream surfaces (`--background`, `--surface-*`), teal accent (`--accent` / `#0d7377`).
- Shared plane wash: `--panel-wash` on day/gym/assistant scenes.
- Display: Unbounded; body: Manrope. No Inter/Roboto/system stacks on hero text.
- No purple/indigo themes, no glow stacks, no emoji decoration.

## Composition
- One job per section; one composition in the first viewport (not a dashboard).
- Cards only when they wrap an interaction. Prefer hairlines / wash planes.
- Confirm flows (photo, macros, AI apply) are one family: hero → facts → sticky action.

## Loading
- Boot: one branded `AppSplash` per cold start (AuthGate may mark session; ration skips a second fullscreen).
- In-scene: `SceneSkeleton` (full / compact / inline) and `SceneBusy` in buttons — not DaisyLoading or bare «Загрузка…» on product routes. DaisyLoading stays admin-only.

## Assistant
- Same visual language as ration/gym (`assistant-scene`), not an admin chat denseness.
- Never claim a diary write without a tool/confirm card.
- Photo + text apply cards use `.confirm-family` (hero → skim → facts → sticky CTA), same family as `ConfirmationCard`.
- Day voice: at most **one** soft next step from snapshot (morning/evening); no LLM inventing todos.
- Memory chip shows only saved prefs («не предлагаю» / likes) — empty means empty, never filler.
- Offline: glass banner; chat blocked; already-recognized confirms may queue apply (no LLM offline).

## Motion & brand
- Prefer existing `ration-scene-in` / `meal-row-in` / day-voice / apply-flash — not decorative noise.
- Landing accents alias product `--accent` (C5) so install → app is one teal family.
