# RuStore APK на Windows (Capacitor)

Сборка APK делается **на вашем ПК** (не на VPS). Типичные ошибки — нет JDK 21, неверный путь к SDK, Java 25.

## 1. JDK 21 (обязательно для Capacitor)

Capacitor 8 / Android Gradle Plugin требуют **Java 21**.  
JDK 17 подходит только для legacy Bubblewrap TWA; Java 25 из свежей Studio часто ломает toolchain.

Установите [Eclipse Temurin 21](https://adoptium.net/temurin/releases/?version=21) (или используйте `jbr` из Android Studio, если это уже 21).

PowerShell (на время сессии):

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.6+7-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version   # должно быть 21.x
```

Git Bash:

```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.6+7-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
java -version
```

Ошибка `Cannot find a Java installation … languageVersion=21` = JDK 21 не найден.  
`npm run rustore:cap:build` сам ищет Temurin/Microsoft/Android Studio `jbr` и пишет `org.gradle.java.home`.

## 2. Android SDK — два разных пути

| Инструмент | Путь |
|------------|------|
| **Bubblewrap** (`~/.bubblewrap/config.json`) | `...\Android\Sdk\cmdline-tools\latest` |
| **Gradle** (`ANDROID_HOME`, `local.properties`) | `...\Android\Sdk` (корень!) |

Пример `C:\Users\User\.bubblewrap\config.json`:

```json
{
  "jdkPath": "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.6+7-hotspot",
  "androidSdkPath": "C:\\Users\\User\\AppData\\Local\\Android\\Sdk\\cmdline-tools\\latest"
}
```

(Для legacy Bubblewrap можно оставить JDK 17 в `jdkPath`; для Capacitor нужен 21.)

Gradle **не** должен видеть `cmdline-tools\latest` как SDK root — иначе ошибка «licences have not been accepted».

## 3. Установка platform 36 и build-tools 35

**Вариант A — Android Studio:** SDK Manager → Android 16 (API 36) + Build-Tools 35.

**Вариант B — командная строка** (PowerShell):

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.6+7-hotspot"

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

## 4. Python 3.9+ и Pillow (обязательно для иконки APK)

Скрипт сборки вызывает Python после проверки SDK. Если в консоли после
`Android SDK OK` появляется только `Python` и всё зависает — это
**псевдоним Microsoft Store**, а не настоящий Python.

В Git Bash проверьте:

```bash
command -v python3
py -3 -c "import sys; print(sys.executable)"
```

Если путь содержит `WindowsApps` — отключите псевдонимы:
**Параметры → Приложения → Доп. параметры → Псевдонимы выполнения приложений** →
`python.exe` и `python3.exe` = **Выкл**.

Установите Python с https://www.python.org/downloads/ (галочка **Add to PATH**), затем:

```bash
py -3 -m pip install pillow
# или явно:
export RUSTORE_PYTHON="/c/Users/User/AppData/Local/Programs/Python/Python312/python.exe"
"$RUSTORE_PYTHON" -m pip install pillow
```

## 5. Сборка Capacitor (Git Bash)

```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.6+7-hotspot"
export ANDROID_HOME="/c/Users/User/AppData/Local/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

cd /c/Users/User/calorie-vision
git checkout cursor/rustore-standalone-app-d07a   # или main после merge
git pull
npm install

# Подпись обязательна — без неё Android: «пакет недействителен / повреждён»
export RUSTORE_KEYSTORE_PASSWORD="пароль-от-android.keystore"
# export RUSTORE_KEY_ALIAS="calorievision"   # если alias другой

npm run rustore:cap:init    # один раз — создаёт android/ + иконки A2
npm run rustore:cap:build   # → rustore/dist/app-release.apk
```

Успех: в логе `Capacitor launcher icons`, `BUILD SUCCESSFUL`, `apksigner sign`, `APK signing OK`, файл `rustore/dist/app-release.apk`.

Приложение открывает **`/login`** (не маркетинговый сайт). После входа — `/ration`.

### Нет иконки / «робот Android»

Пересоберите после `git pull`: `rustore:cap:build` заново пишет `ic_launcher*` из `rustore/icon-512-store.png`. Удалите старое приложение с телефона перед установкой (лаунчер кэширует ярлык).

### «Пакет недействителен / повреждён»

1. Пересоберите **с** `RUSTORE_KEYSTORE_PASSWORD` (после `git pull` скрипт сам подписывает через `apksigner`).
2. В логе должны быть строки `apksigner sign` и `APK signing OK`. Если их нет — APK не ставить.
3. Не пересылайте APK через Telegram/WhatsApp — файл портится. Копируйте по USB или:
   ```bash
   adb install -r rustore/dist/app-release.apk
   ```
4. Удалите старое приложение Calorie Vision (TWA) перед установкой.
5. Проверка подписи:
   ```bash
   "$ANDROID_HOME/build-tools/35.0.0/apksigner.bat" verify -v --print-certs rustore/dist/app-release.apk
   ```

## 6. Ошибка «licences have not been accepted»

1. `ANDROID_HOME` = корень `Sdk`, не `cmdline-tools\latest`.
2. Запустите `sdkmanager.bat --licenses` и примите все (или `yes | sdkmanager --licenses` в Git Bash).
3. Убедитесь, что папка `Sdk\licenses\` существует и в ней есть файлы `*.txt`.

## 7. После APK

1. Установите APK на телефон — должен открываться сайт без адресной строки.
2. Проверьте логин и фото.
3. Загрузите в [RuStore Консоль](https://console.rustore.ru) — см. `rustore/CHECKLIST.md` и `listing.ru.md`.
