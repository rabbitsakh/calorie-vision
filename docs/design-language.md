# Design language (Calorie Vision)

Wave C0 — short contract for product UI. Prefer this over inventing a new look.

## Brand & surface
- Cream surfaces (`--background`, `--surface-*`), teal accent (`--accent` / `#0d7377`).
- Shared plane wash: `--panel-wash` on day/gym/assistant scenes.
- Gym depth (Wave D4): `.gym-day` / `.gym-session-scene` / `.gym-hub-scene` as one atmospheric plane; nested blocks use `.gym-plane` (hairline, no card cascade).
- Display: Unbounded; body: Manrope. No Inter/Roboto/system stacks on hero text.
- No purple/indigo themes, no glow stacks, no emoji decoration.
- Accent on product UI: prefer `var(--accent)` / `--accent-soft` / `--accent-ink` / `--border-quiet` / `--on-ink` over Tailwind `teal-*` (Wave D2).

## Composition
- One job per section; one composition in the first viewport (not a dashboard).
- Cards only when they wrap an interaction. Prefer hairlines / wash planes.
- Confirm flows (photo, macros, AI apply) are one family: hero → facts → sticky action (`.confirm-family` / `.confirm-card-section`).
- Offline queue banner + assistant offline share `.offline-chrome` glass tokens; queue sheet rows use confirm-family CTAs (Wave D3).

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
- Boot chrome (Wave D5): `AppSplash` wordmark is Unbounded hero on accent-token stage; tip swap + ready beat; AuthGate → product uses `.boot-enter`; skeletons fade with the same language.
- Stats scene (Wave D6): `.stats-page-scene` is one wash plane (no card shadow); empty state and chart blocks sit as dividers on the wash, not nested white cards.
- Daily chrome (Wave D7): ration `.ration-day-more` and water sit as hairline bands on the day wash; `+` utility tiles share one cream plane (hue on icons only); confirm inside `.food-add-sheet` drops the second `.card` shadow; profile nested blocks use `.profile-settings__nested`, not white card shells.
- Plan rail (Wave D8): challenge / week report / shopping stay on accent tokens — no emerald second palette; stat tiles are surface-mist dividers on the wash.
- Weight scene (Wave D9): `.weight-page-scene` mirrors stats wash; history/goal use `.weight-page-block`, not stacked `.card`.
- Quick log + gym start (Wave D10): QuickAdd / RecipeBuilder / create-session chips use `--accent*`; morning nudge drops card shadow on the day wash.
- Day retention (Wave D12): habits sheet uses `.habits-sheet-panel` wash; push/share/aha/profile-complete/install prompts on accent tokens (no teal/sky/emerald walls).
- Assistant + empties (Wave D13): `.assistant-scene` drops card shadow; toolbar chips prefer `.assistant-scene-chip`; shared `.scene-empty` for diary filter / favorites / templates / gym history.
- Water + streak (Wave D14): daily water/freeze use `--accent-water*` / `--accent-ink` (no Tailwind `sky-*`); weight chart marks follow `--accent-water`.
- First hour (Wave D15): onboarding + PWA wizard share habits/food-add wash panels; auth avatar/menu and stage screens use accent tokens (no `teal-*` shells).
