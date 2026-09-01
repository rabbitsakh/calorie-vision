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

## 2. Android SDK — два разных пути

| Инструмент | Путь |
|------------|------|
| **Bubblewrap** (`~/.bubblewrap/config.json`) | `...\Android\Sdk\cmdline-tools\latest` |
| **Gradle** (`ANDROID_HOME`, `local.properties`) | `...\Android\Sdk` (корень!) |

Пример `C:\Users\User\.bubblewrap\config.json`:

```json
{
  "jdkPath": "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot",
  "androidSdkPath": "C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\cmdline-tools\\latest"
}
```

Gradle **не** должен видеть `cmdline-tools\latest` как SDK root — иначе ошибка «licences have not been accepted».

## 3. Установка platform 36 и build-tools 35

**Вариант A — Android Studio:** SDK Manager → Android 16 (API 36) + Build-Tools 35.

**Вариант B — командная строка** (PowerShell):

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"

# Новый CLI (если установлен через Android Studio):
android sdk install build-tools/35.0.0 platforms/android-36

# Или классический sdkmanager:
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "build-tools;35.0.0" "platforms;android-36"
```

Проверка:

```powershell
Test-Path "$env:ANDROID_HOME\build-tools\35.0.0"
Test-Path "$env:ANDROID_HOME\platforms\android-36"
Test-Path "$env:ANDROID_HOME\licenses"
```

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

Скрипт `rustore-build.sh` сам пишет `rustore/android/local.properties` с правильным `sdk.dir`.

## 5. Ошибка «licences have not been accepted»

1. `ANDROID_HOME` = корень `Sdk`, не `cmdline-tools\latest`.
2. Запустите `sdkmanager.bat --licenses` и примите все (или `yes | sdkmanager --licenses` в Git Bash).
3. Убедитесь, что папка `Sdk\licenses\` существует и в ней есть файлы `*.txt`.

## 6. После APK

1. Установите APK на телефон — должен открываться сайт без адресной строки.
2. Проверьте логин и фото.
3. Загрузите в [RuStore Консоль](https://console.rustore.ru) — см. `rustore/CHECKLIST.md` и `listing.ru.md`.
