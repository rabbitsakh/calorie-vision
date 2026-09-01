# RuStore TWA на Windows

Сборка APK делается **на вашем ПК** (не на VPS). Типичные ошибки — неверный путь к SDK и Java 25.

## 1. JDK 17 (обязательно)

Gradle/Android **не** работают с Java 25 из Android Studio. Установите [Eclipse Temurin 17](https://adoptium.net/temurin/releases/?version=17).

PowerShell (на время сессии):

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version   # должно быть 17.x
```

## 2. Android SDK — один путь для всего

И **Bubblewrap**, и **Gradle** должны видеть **корень SDK**:

`C:\Users\User\AppData\Local\Android\Sdk`

**Не** указывайте `cmdline-tools\latest` в `androidSdkPath`.

Bubblewrap проверяет папку **`Sdk\bin`**, а в новых SDK она лежит в `cmdline-tools\latest\bin`. Создайте junction **один раз**:

```powershell
cmd /c mklink /J "$env:LOCALAPPDATA\Android\Sdk\bin" "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin"
```

После этого `androidSdkPath` = корень `Sdk` — Gradle и Bubblewrap работают вместе.

Пример `C:\Users\User\.bubblewrap\config.json`:

```json
{
  "jdkPath": "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot",
  "androidSdkPath": "C:\\Users\\User\\AppData\\Local\\Android\\Sdk"
}
```

Или одной командой:

```powershell
npx @bubblewrap/cli updateConfig `
  --jdkPath="C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot" `
  --androidSdkPath="$env:LOCALAPPDATA\Android\Sdk"
```

## 3. Установка platform 36 и build-tools

Bubblewrap для подписи APK использует **Build-Tools 36.1.0** (отдельно от Gradle). Нужны **оба**, если Gradle тянет другую версию.

**Вариант A — Android Studio (рекомендуется):** SDK Manager → Android 16 (API 36) + Build-Tools **36.1.0**.

**Вариант B — новый CLI `android`** (PowerShell):

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$android = "$env:ANDROID_HOME\cmdline-tools\latest\bin\android.bat"

& $android sdk licenses
& $android sdk install build-tools/36.1.0 platforms/android-36 platform-tools
```

**Не используйте** `sdkmanager "build-tools;36.1.0"` на новых CLI — он разбивает строку и пишет «Package not found».

Проверка:

```powershell
Test-Path "$env:ANDROID_HOME\build-tools\36.1.0\zipalign.exe"
Test-Path "$env:ANDROID_HOME\platforms\android-36"
```

Обе команды — **`True`**.

## 4. Сборка (Git Bash)

```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-17.0.20.101-hotspot"
export ANDROID_HOME="/c/Users/User/AppData/Local/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

cd /c/Users/User/calorie-vision
git pull origin main
bash scripts/rustore-init.sh    # если ещё не делали
bash scripts/rustore-build.sh   # пароль keystore → rustore/dist/app-release.apk
```

Скрипт `rustore-build.sh` сам пишет `local.properties` и при необходимости чинит `~/.bubblewrap/config.json`.

## 5. Частые ошибки

### «licences have not been accepted»

1. `ANDROID_HOME` = корень `Sdk`, не `cmdline-tools\latest`.
2. `sdkmanager.bat --licenses` → на всё `y`.
3. Папка `Sdk\licenses\` с файлами `*.txt`.

### «The provided androidSdk isn't correct»

Bubblewrap ищет папку `Sdk\bin`, а у вас она только в `cmdline-tools\latest\bin`.

```powershell
cmd /c mklink /J "$env:LOCALAPPDATA\Android\Sdk\bin" "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin"
npx @bubblewrap/cli updateConfig --androidSdkPath="$env:LOCALAPPDATA\Android\Sdk"
```

### «zipalign» / «Системе не удается найти указанный путь»

Bubblewrap ищет **`Sdk\build-tools\36.1.0\zipalign.exe`**. У вас может быть только 35.0.0.

1. Установите **Build-Tools 36.1.0** (Android Studio или `android sdk install build-tools/36.1.0`).
2. Проверьте: `Test-Path "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.1.0\zipalign.exe"` → **True**.
3. Снова `bash scripts/rustore-build.sh`.

## 6. После APK

1. Установите APK на телефон — должен открываться сайт без адресной строки.
2. Проверьте логин и фото.
3. Загрузите в [RuStore Консоль](https://console.rustore.ru) — см. `rustore/CHECKLIST.md` и `listing.ru.md`.
