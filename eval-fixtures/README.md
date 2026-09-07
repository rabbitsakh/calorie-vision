# Live recognition eval fixtures

Golden photos for `RECOGNITION_LIVE_EVAL=1` (see `src/lib/ai/recognition-live-eval.ts`).

## Setup

1. Put JPEG files here matching slot names (binaries are gitignored).
2. Keep `.gitkeep` so the folder exists in clone.
3. Run cron `/api/cron/recognition-eval-live` with `Authorization: Bearer $CRON_SECRET`.

Missing files skip without failing the suite.

## Seed cases (stricter expects)

| File | Expect |
|------|--------|
| `plate-borscht.jpg` | dish ~борщ, min kcal 150 |
| `label-yogurt.jpg` | `photoKind: label`, min kcal 50 |
| `drink-bottle.jpg` | drink-like name, min kcal 20 |
| `plate-oatmeal.jpg` | ~овсян/каша, min kcal 80 |
| `package-bar.jpg` | bar/snack name, min kcal 40 |

## Extra slots (min kcal 10)

Drop `{name}.jpg` for any of:

`plate-salad`, `plate-pasta`, `plate-soup`, `plate-steak`, `plate-sushi`, `plate-pizza`, `plate-rice-chicken`, `plate-pelmeni`, `plate-blini`, `label-juice`, `label-cheese`, `label-bread`, `label-cereal`, `label-chocolate`, `label-cottage`, `package-chips`, `package-cookies`, `barcode-milk`, `barcode-kefir`, `canteen-tray`, `canteen-soup`, `drink-smoothie`, `drink-coffee`, `snack-apple`, `snack-banana`, `multi-plate-2`, `multi-plate-3`, `ready-meal-sticker`, `cafe-salad`, `cafe-bowl`

Total catalog slots: **35** (5 seed + 30 extra).

## Tips

- Prefer real phone photos (plate / label / package), not stock collage.
- One clear subject; avoid heavy filters.
- Filename must match exactly (`.jpg`).
