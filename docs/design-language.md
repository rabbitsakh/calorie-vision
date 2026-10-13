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
- In-scene: `SceneSkeleton` / existing hero skeletons — not DaisyLoading or bare «Загрузка…» on product routes.

## Assistant
- Same visual language as ration/gym (`assistant-scene`), not an admin chat denseness.
- Never claim a diary write without a tool/confirm card.
- Photo + text apply cards use `.confirm-family` (hero → skim → facts → sticky CTA), same family as `ConfirmationCard`.
