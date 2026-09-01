# Calorie Vision → RuStore (только RuStore, без Google Play)

Цель: бесплатное Android-приложение в [RuStore](https://www.rustore.ru/) как **TWA** (Trusted Web Activity) вокруг `https://calorievision.ru`.

Package: `ru.calorievision.app`

## Что уже в репо

| Путь | Назначение |
|------|------------|
| `rustore/twa-manifest.json` | Конфиг Bubblewrap / TWA |
| `rustore/listing.ru.md` | Черновик карточки витрины |
| `rustore/CHECKLIST.md` | Чеклист аккаунта и модерации |
| `scripts/rustore-init.sh` | Первичная генерация Android-проекта |
| `scripts/rustore-build.sh` | Сборка signed APK/AAB |
| `src/app/.well-known/assetlinks.json/route.ts` | Digital Asset Links (после fingerprint) |

Каталог `rustore/android/` **не коммитится** — генерируется локально/на CI (см. `.gitignore`).

## Требования на машине сборки

- **JDK 17** (не Java 21/25 из Android Studio — Gradle падает)
- Android SDK (cmdline-tools) или Android Studio
- Node.js 24+ (как у проекта)
- `@bubblewrap/cli` (ставится скриптом)

**Windows:** пошагово в [`rustore/WINDOWS.md`](WINDOWS.md) — типичная ошибка: `ANDROID_HOME` указывает на `cmdline-tools\latest` вместо корня `...\Android\Sdk`.

```bash
# один раз
npm i -g @bubblewrap/cli
# или npx — скрипты умеют оба варианта
```

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

## Монетизация

Сейчас приложение **бесплатное**. RuStore Pay / подписки — отдельный этап, не блокирует первую публикацию.

## Google Play

**Не делаем** в этой ветке. Play Console из РФ для бесплатных приложений доступен, Billing — нет; когда понадобится — отдельный трек.
