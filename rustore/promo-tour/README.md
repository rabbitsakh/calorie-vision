# Промо-тур Calorie Vision для RuStore

Готовый вертикальный ролик с описанием функционала (не скринкаст приложения).

## Файлы

| Файл | Назначение |
|------|------------|
| `calorie-vision-promo-tour.mp4` | готовый ролик ~38 с, 9:16 |
| `index.html` | анимированный тур (можно править тексты) |
| `promo-scene-*.png` | фоны сцен |
| `record.mjs` | перезапись через Playwright |

## Переснять

```bash
cd rustore/promo-tour && python3 -m http.server 8765 --bind 127.0.0.1
# в другом терминале, из корня репо:
node rustore/promo-tour/record.mjs
```

Результат: `rustore/promo-tour/calorie-vision-promo-tour.mp4`

## Загрузка в RuStore

В Консоли — медиафайлы / видео приложения (если поле доступно) или как доп. материал для модерации.  
Тексты витрины по-прежнему в `rustore/listing.ru.md`.
