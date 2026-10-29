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
- Day chrome leftovers (Wave D16): next-step / diary note / shopping chip / referral / diet meters / day-calendar dots / meal photo picker / food-add tiles use accent wash — no mint hex walls or nested `.card` shadow.
- Trust confirm + stats (Wave D17): confidence badges and calorie heatmap on `--accent*` / `--accent-water*`; carbs legend uses `--accent-carbs` (no `cyan-*` / `emerald-*` / `sky-*`).
- Celebration + companion (Wave D18): fullscreen / soft celeb stages stay teal–amber (no purple badge stage); mascot companion drops card shadow and `teal-*` Tailwind.
- Ration first viewport (Wave D19): day scene = date + hero + pending/offline/queue + meal feed; morning / next-step / chest sit in `.ration-day-soft` after the diary; «Ещё на сегодня» keeps habits/plan.
- Scene tokens (Wave D20): `:root --line` aliases hairline; product UI prefers `--accent*` (no Tailwind `teal-*`); login uses `.login-panel` on `--panel-wash`; share canvases use Unbounded/Manrope; leftover violet celeb glow maps to teal.
- Landing + auth (Wave D21): hero budget = brand + one headline + short lead + one CTA group; competitor / RuStore / APK below fold; Capacitor welcome uses product `--panel-wash`.
- Motion (Wave D22): keep `ration-scene-in` / `meal-row-in` / landing sheen + soft-stack enter — presence, not noise.
- Landing rhythm (Wave D23): below-fold = stats → how → recognition → trust → inside (≤5 features) → install → FAQ — no pulse/audience/free catalog stack.
- No competitor names (Wave D24): differentiate without CalZen/FatSecret (or other brand) headlines; soft “не ручной справочник” in trust/how.
- One install path (Wave D25): RuStore → APK → iPhone only under `#install`; nav/footer/FAQ link there, no duplicate badges above.
- Confirm sheet (Wave D26): FoodAdd sheet owns elevation; `.confirm-family` / sticky actions flat inside sheet; standalone confirm is hairline plane (no teal shadow stack).
- Gym planes (Wave D27): library/create/add-exercise/PR toast/rest dock use `.gym-plane` or quiet chrome — no `rounded-2xl` + heavy shadow cascade on scene CTAs.
- First-hour nudges (Wave D28): tips and install prompts each use one `MotivationQueue` slot (aha with tip/referral; share → PWA → push).
- Stats/plan/profile wash (Wave D29): `.plan-week` drops card shadow; profile items + stats tiles are mist/hairline on the wash (not opaque cream cards).
- Tab + «+» chrome (Wave D30): quiet dock (no card shadow); one active tab cue; flat accent «+»/split and FoodAdd primary tile (no lift/glow).
- RuStore shell (Wave D31): `rustore/cap-www` `:root` matches product cream/teal (`#f5f3ee` / `#0d7377`); Manrope stack.
- Recognition-first chrome (Wave D32): bottom composer camera is the thumb-zone primary; confirm dish rows show S/M/L · ½ · ×2 + confidence; «Как вчера»/favorites strip sits above the meal feed; moment ring/macros ≥15–16px; cookie consent is a thin strip; landing mobile keeps «Войти» in the header.
