# Calorie Vision

Веб-приложение для учёта калорий по фото еды.

## Возможности

- загрузка фото еды;
- распознавание блюда и калорийности через GigaChat (Сбер);
- экран подтверждения с возможностью исправить название и калории;
- сохранение приёмов пищи в MySQL по дням;
- дневник с итогом калорий за выбранный день;
- вход через Google, VK, Telegram или email (magic link) — у каждого пользователя свой дневник.

## Стек

- **Frontend + API:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **База данных:** MySQL + Prisma ORM
- **Авторизация:** NextAuth.js (Google, VK, Telegram, email)
- **Распознавание:** GigaChat API (Сбер, поддержка фото)

## Расположение проекта

```text
C:\Apache24\htdocs\calorie-vision
```

Apache может проксировать запросы к Next.js. Само приложение всё равно запускается через Node.js (`npm run dev` или `npm run start`).

## Что нужно установить

1. [Node.js 24 LTS](https://nodejs.org/) (`node -v` должен быть `v24.x`)
2. [MySQL 8+](https://dev.mysql.com/downloads/mysql/)
3. Apache 2.4 (у вас уже установлен)
4. (Опционально) [Git](https://git-scm.com/)

## Быстрый старт

### 1. Создайте базу данных

```sql
CREATE DATABASE calorie_vision CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Настройте окружение

```powershell
cd C:\Apache24\htdocs\calorie-vision
copy .env.example .env
```

Отредактируйте `.env`:

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/calorie_vision"
UPLOAD_DIR="public/uploads"
NEXT_PUBLIC_BASE_PATH=/calorie-vision

# Секрет для сессий (PowerShell: [Convert]::ToBase64String((1..32|%{Get-Random -Max 256})))
NEXTAUTH_SECRET=ваш-секрет
NEXTAUTH_URL=http://localhost:3000/calorie-vision

EMAIL_SERVER=smtp://user:pass@smtp.example.com:587
EMAIL_FROM=noreply@calorievision.ru

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 3. Установите зависимости

```powershell
npm install
```

### 4. Примените схему БД

```powershell
npm run db:generate
npm run db:push
```

### 5. Запустите приложение

```powershell
npm run dev
```

Откройте [http://localhost/calorie-vision/](http://localhost/calorie-vision/) (со слэшем в конце).

Apache автоматически перенаправит `/calorie-vision` → `/calorie-vision/`.

### 6. (Опционально) Прокси через Apache

Включите модули `proxy` и `proxy_http` в Apache, затем добавьте в конфиг:

```apache
<Location /calorie-vision>
    ProxyPreserveHost On
    ProxyPass http://127.0.0.1:3000/calorie-vision
    ProxyPassReverse http://127.0.0.1:3000/calorie-vision
    LimitRequestBody 20971520
</Location>
```

Открывайте: http://localhost/calorie-vision/ (Apache сам добавит слэш, если его нет)

В `next.config.ts` включены `basePath` и `trailingSlash: true` — это обязательно для Apache.

После перезапуска Apache приложение будет доступно по адресу:
[http://localhost/calorie-vision](http://localhost/calorie-vision)

Для production-сборки:

```powershell
npm run build
npm run start
```

## Как это работает

1. Вы входите через Google, VK, Telegram или email (если настроен SMTP).
2. Выбираете дату и загружаете фото.
3. API `/api/recognize` сохраняет фото и возвращает предполагаемое блюдо.
4. Вы подтверждаете или исправляете данные.
5. API `/api/meals` записывает приём пищи в таблицу `MealEntry` для вашего аккаунта.
6. Блок «Дневник за день» показывает только ваши записи и сумму калорий.

## Настройка авторизации

На странице входа показываются только **настроенные** способы. Email без SMTP скрыт.

### Telegram (вход)

1. Создайте бота у [@BotFather](https://t.me/BotFather) (продакшен: **@CalorieVisionAppBot**).
2. Команда `/setdomain` → укажите `calorievision.ru` (для локалки — временный HTTPS-туннель, например ngrok).
3. В `.env`:
   ```env
   NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=CalorieVisionAppBot
   TELEGRAM_BOT_TOKEN=123456:AA...
   ```
4. Перезапустите приложение. На `/login` появится кнопка «Войти через Telegram».

### Email (magic link)

Нужен пакет `nodemailer` (уже в зависимостях проекта) и рабочий SMTP.

1. Настройте SMTP в `.env` — один из вариантов:

   **A. Connection string** (спецсимволы в пароле кодируйте: `@` → `%40`, `:` → `%3A`):
   ```env
   EMAIL_SERVER=smtp://user:pass@smtp.yandex.ru:465
   EMAIL_FROM=noreply@calorievision.ru
   ```

   **B. Отдельные поля** (удобнее для сложных паролей):
   ```env
   EMAIL_SERVER_HOST=smtp.yandex.ru
   EMAIL_SERVER_PORT=465
   EMAIL_SERVER_USER=noreply@calorievision.ru
   EMAIL_SERVER_PASSWORD=ваш-пароль-приложения
   EMAIL_SERVER_SECURE=1
   EMAIL_FROM=noreply@calorievision.ru
   ```

2. Для Яндекса / Mail.ru: `EMAIL_FROM` должен совпадать с ящиком, от которого идёт SMTP; часто нужен **пароль приложения**, не обычный пароль.
3. `NEXTAUTH_URL=https://calorievision.ru` — без `/api/auth`, иначе ссылка в письме будет битой.
4. Пользователь вводит email → получает письмо «Вход в Calorie Vision» → клик по ссылке → сессия.
5. Без SMTP вкладка Email на `/login` скрыта.

### Google (опционально)

1. Откройте [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Создайте OAuth 2.0 Client ID (тип «Web application»).
3. Добавьте **Authorized JavaScript origins**:
   - `https://calorievision.ru`
   - `http://localhost:3000`
4. Добавьте **Authorized redirect URIs**:
   - `https://calorievision.ru/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
   - `http://localhost:3000/calorie-vision/api/auth/callback/google` (локально с `NEXT_PUBLIC_BASE_PATH`)
5. Скопируйте Client ID и Client Secret в `.env` и перезапустите сервер. Без этих переменных кнопка Google скрывается.

### VK (опционально)

1. Откройте [кабинет VK ID](https://id.vk.com/about/business/go) и создайте приложение типа «Веб-сайт».
2. Укажите базовый домен: `calorievision.ru`.
3. Добавьте доверенный Redirect URL:
   - `https://calorievision.ru/api/auth/callback/vk`
   - `http://localhost:3000/api/auth/callback/vk` (для локальной разработки)
4. Скопируйте ID приложения и **сервисный ключ** (или защищённый ключ) в `.env`:
   ```env
   VK_CLIENT_ID=...
   VK_CLIENT_SECRET=...
   ```
   Redirect URL должен совпадать **байт в байт**, без слэша на конце:
   `https://calorievision.ru/api/auth/callback/vk`
5. Перезапустите сервер. Без `VK_CLIENT_ID` кнопка VK скрывается.

После обновления схемы БД (поля `phone`, `phoneVerified` у `User`) выполните:

```powershell
npm run db:generate
npx prisma db push --accept-data-loss
```

## Настройка GigaChat

1. Зарегистрируйтесь: https://developers.sber.ru/studio/workspaces
2. Получите ключ авторизации (Base64)
3. Добавьте в `.env`:

```env
GIGACHAT_CREDENTIALS=ваш-ключ-base64
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat-2-Max
```

После изменения `.env` перезапустите сервер:

```powershell
npm run dev
```

## Структура проекта

```text
calorie-vision/
├── prisma/schema.prisma      # User, Account, Session, MealEntry
├── src/app/api/auth/         # NextAuth (Google, VK, Telegram, email)
├── src/components/           # UI-компоненты
├── src/lib/                  # Prisma, распознавание, даты
└── public/uploads/           # загруженные фото
```

## Деплой на VPS (calorievision.ru)

### 1. DNS
A-записи `@` и `www` → IP сервера.

### 2. `.env` на сервере (`/var/www/calorie-vision/.env`)

```env
DATABASE_URL="mysql://calorie:пароль%40@localhost:3306/calorie_vision"
UPLOAD_DIR="public/uploads"
NEXT_PUBLIC_BASE_PATH=
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://calorievision.ru
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
VK_CLIENT_ID=...
VK_CLIENT_SECRET=...
EMAIL_SERVER_HOST=smtp.yandex.ru
EMAIL_SERVER_PORT=465
EMAIL_SERVER_USER=noreply@calorievision.ru
EMAIL_SERVER_PASSWORD=...
EMAIL_SERVER_SECURE=1
EMAIL_FROM=noreply@calorievision.ru
GIGACHAT_CREDENTIALS=...
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat-2-Max
GIGACHAT_API_BASE=https://api.giga.chat/v1
YANDEX_METRIKA_ID=12345678
```

### 3. Node.js 24 на VPS

Нужен **Node.js 24 LTS** (`node -v` → `v24.x`). Debian/Ubuntu, под root или через `sudo`.

Сначала посмотрите, что стоит сейчас:

```bash
node -v
which node
command -v nvm || true
```

**Если Node ставили через apt / NodeSource** (часто `/usr/bin/node`):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
hash -r
node -v   # v24.…
npm -v
```

**Если пользуетесь nvm** (`which node` вроде `/home/.../.nvm/versions/node/...`):

```bash
source ~/.nvm/nvm.sh
nvm install 24
nvm alias default 24
hash -r
node -v
```

Потом перепривяжите pm2 к новому бинарнику и перезапустите приложение:

```bash
which node
sudo npm install -g pm2
cd /var/www/calorie-vision
pm2 restart calorie-vision --update-env
pm2 save
```

Один раз после смены Node — чтобы systemd поднимал тот же node после ребута:

```bash
pm2 save
pm2 unstartup
pm2 startup
# выполните команду, которую напечатает pm2 startup
```

`pm2 startup` часто поднимает **новый пустой** демон (`not managing any process`). Сразу верните приложение:

```bash
cd /var/www/calorie-vision
pm2 resurrect || pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 status
```

В `pm2 status` процесс `calorie-vision` должен быть `online`. Проверка Node: `node -v` и `pm2 show calorie-vision` — в `node.js version` тоже 24. Дальше обычный деплой.

### 4. Запуск приложения

```bash
cd /var/www/calorie-vision
git pull
bash deploy/deploy.sh
```

Если `next build` падает с `SIGKILL` (OOM на маленьком VPS): `deploy.sh` сам останавливает pm2 перед сборкой, ставит `experimental.cpus=1` и подбирает `--max-old-space-size` по `MemAvailable`. Принудительно: `NODE_OPTIONS='--max-old-space-size=2048' NEXT_BUILD_CPUS=1 bash deploy/deploy.sh`. На VPS ≤2 ГБ RAM полезен swap (`fallocate -l 2G /swapfile …`).

### 5. Nginx

```bash
# Ubuntu/Debian
cp deploy/nginx-calorievision.ru.conf /etc/nginx/sites-available/calorievision.ru
mkdir -p /etc/nginx/sites-enabled
ln -sf /etc/nginx/sites-available/calorievision.ru /etc/nginx/sites-enabled/calorievision.ru
nginx -t && systemctl reload nginx

# Или CentOS/без sites-enabled:
# cp deploy/nginx-calorievision.ru.conf /etc/nginx/conf.d/calorievision.ru.conf
```

### 6. HTTPS

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d calorievision.ru -d www.calorievision.ru
```

### 7. Google OAuth

- **Origins:** `https://calorievision.ru`
- **Redirect URI:** `https://calorievision.ru/api/auth/callback/google`
- `NEXTAUTH_URL` должен быть `https://calorievision.ru` **без** суффикса `/api/auth`.

### 8. VK ID

- **Redirect URL (точно, без `/` на конце):** `https://calorievision.ru/api/auth/callback/vk`
- Базовый домен: `calorievision.ru` (без `www`)
- В `.env` на сервере: `VK_CLIENT_ID` и `VK_CLIENT_SECRET` (сервисный ключ), затем `bash deploy/deploy.sh`.

После обновления nginx (`www` → основной домен) снова примените конфиг и при необходимости перевыпустите сертификат:

```bash
cp deploy/nginx-calorievision.ru.conf /etc/nginx/sites-available/calorievision.ru
nginx -t && systemctl reload nginx
```

**Важно:**
- Используйте `npm run db:push`, а не `npx prisma` — `npx` может подтянуть Prisma 7.
- Prisma зафиксирована в `package.json` (6.19.3).
- Спецсимволы в пароле MySQL кодируйте в URL (`@` → `%40`).

### SQL-миграции (`deploy/migrate-*.sql`)

Помимо `prisma db push`, деплой применяет файлы `deploy/migrate-*.sql` через `npm run db:migrate-sql` (см. `deploy/deploy.sh`). Порядок — **лексикографический** по имени файла (`sort`), поэтому префиксы/имена важны. Скрипты идемпотентны (проверки `INFORMATION_SCHEMA` / `IF NOT EXISTS`). Список без применения:

```bash
ls deploy/migrate-*.sql | sort
```

## Полезные команды

```powershell
npm run dev          # dev-сервер
npm run build        # production-сборка
npm run db:studio    # просмотр БД в Prisma Studio
npm run db:migrate-sql  # применить deploy/migrate-*.sql по имени
```
