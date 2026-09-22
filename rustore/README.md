# Calorie Vision → RuStore (только RuStore, без Google Play)

Цель: бесплатное Android-приложение в [RuStore](https://www.rustore.ru/).

> **Модерация:** чистый TWA и Capacitor с `server.url` отклоняли как WebView-обёртку.
> Актуальный путь: **локальный Capacitor shell** (`rustore/cap-www`, без `server.url`) →
> `npm run rustore:cap:init` → `npm run rustore:cap:build`.
> Ответ модератору: [`MODERATION.md`](MODERATION.md).

Package: `ru.calorievision.app`

## Что уже в репо

| Путь | Назначение |
|------|------------|
| `capacitor.config.ts` | Capacitor appId / server / splash |
| `scripts/rustore-cap-init.sh` | `cap add android` + packageId |
| `scripts/rustore-cap-build.sh` | signed APK → `rustore/dist/` |
| `rustore/MODERATION.md` | ответ модерации RuStore |
| `rustore/twa-manifest.json` | **legacy** Bubblewrap TWA (не для повторной подачи) |
| `rustore/listing.ru.md` | тексты карточки витрины |
| `rustore/PUBLISH.md` | пошаговая публикация в Консоли |
| `src/lib/capacitor-bridge.ts` | native camera bridge |

Каталог `android/` **не коммитится** — генерируется локально (`rustore:cap:init`).

## Сборка Capacitor (рекомендуется)

```bash
# JDK 21, ANDROID_HOME = корень Sdk, rustore/android.keystore на месте
npm run rustore:cap:init
npm run rustore:cap:build
# → rustore/dist/app-release.apk
```

## Legacy TWA (не использовать после отказа)

```bash
bash scripts/rustore-init.sh
bash scripts/rustore-build.sh
```

## Требования на машине сборки

- **JDK 21** для Capacitor (Temurin 21 или Android Studio `jbr` 21). JDK 17 — только legacy TWA; Java 25 часто ломает toolchain.
- Android SDK (cmdline-tools) или Android Studio
- Node.js 22+ (Capacitor 8; в проекте обычно 24+)
- `@bubblewrap/cli` — только для legacy TWA

**Windows:** пошагово в [`rustore/WINDOWS.md`](WINDOWS.md). Частые ошибки: нет JDK 21; `ANDROID_HOME` = `cmdline-tools\latest` вместо корня `...\Android\Sdk`.

```bash
# один раз
npm i -g @bubblewrap/cli
# или npx — скрипты умеют оба варианта
```

## Иконка приложения (APK / ярлык)

Сайт и PWA могут уже показывать новый логотип, а **установленный APK — нет**:
Bubblewrap зашивает иконки в mipmap при сборке. На Android 8+ ярлык берёт **`ic_maskable`**, не только `ic_launcher`.

1. Убедитесь, что `rustore/icon-512-store.png` — актуальный непрозрачный A2.
2. Поднимите `appVersionCode` в `rustore/twa-manifest.json` (обязательно для RuStore).
3. Пересоберите:

```bash
git pull origin main
bash scripts/rustore-build.sh
# → rustore/dist/app-release.apk
# → public/downloads/calorie-vision.apk  (кнопка на лендинге и /install)
```

Скрипт:
- отдаёт локальный A2 в `bubblewrap update` (без CDN-кэша);
- пишет все размеры Bubblewrap (`ic_launcher`, `ic_maskable`, splash, store_icon);
- фиксирует `manifest-checksum.txt`, чтобы `bubblewrap build` не перетёр иконки;
- проверяет, что в APK угол иконки — teal A2, не чёрный CV;
- кладёт APK в `public/downloads/` для кнопки «Скачать APK» на сайте (файл в gitignore).
4. Загрузите новый APK **и** иконку витрины (`icon-512-store.png`) в [RuStore Консоль](https://console.rustore.ru).
5. На телефоне: обновление из RuStore **или удалите приложение и поставьте снова** — лаунчер часто кэширует старый ярлык.
6. На проде: задеплойте сайт вместе с `public/downloads/calorie-vision.apk` (или задайте `NEXT_PUBLIC_APK_URL`).

## Быстрый старт

1. Заведите компанию в [RuStore Консоль](https://console.rustore.ru) (роль Владелец).
2. Создайте keystore (храните backup вне git):

```bash
keytool -genkeypair -v \
  -keystore rustore/android.keystore \
  -alias calorievision \
  -keyalg RSA -keysize 2048 -validity 10000
```

3. Инициализируйте Android-проект:

```bash
bash scripts/rustore-init.sh
```

4. Снимите SHA-256 сертификата и пропишите в env на проде:

```bash
keytool -list -v -keystore rustore/android.keystore -alias calorievision
# скопируйте SHA256: XX:XX:...
```

В `.env` / на сервере:

```bash
TWA_SHA256_FINGERPRINTS="AB:CD:..."
```

После деплоя проверьте:

`https://calorievision.ru/.well-known/assetlinks.json`

5. Соберите артефакты:

```bash
bash scripts/rustore-build.sh
# → rustore/dist/app-release.apk
# → rustore/dist/app-release.aab  (если bundle успешен)
```

6. В RuStore Консоль: **Приложения → Добавить → Загрузить версию**  
   - формат: **APK** (проще для старта) или **AAB** (+ сертификат загрузки)  
   - тип: **Универсальный** (телефон)  
   - заполните карточку из `listing.ru.md`

## Версии

- Web: `package.json` → `1.7.x` (как сейчас)
- Android: `appVersionCode` / `appVersionName` в `rustore/twa-manifest.json`  
  Каждая публикация в RuStore: **увеличивайте `appVersionCode`**.

После публикации карточки в RuStore задайте на сайте:

```bash
NEXT_PUBLIC_RUSTORE_URL=https://www.rustore.ru/catalog/app/...
```

Кнопка «Открыть в RuStore» появится на `/install`. Fingerprint для Digital Asset Links по-прежнему через `TWA_SHA256_FINGERPRINTS`.

## Монетизация

Сейчас приложение **бесплатное**. RuStore Pay / подписки — отдельный этап, не блокирует первую публикацию.

## Google Play

**Не делаем** в этой ветке. Play Console из РФ для бесплатных приложений доступен, Billing — нет; когда понадобится — отдельный трек.
