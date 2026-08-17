# Calorie Vision

Веб-приложение для учёта калорий по фото еды.

## Возможности

- загрузка фото еды;
- распознавание блюда и калорийности через GigaChat (Сбер);
- экран подтверждения с возможностью исправить название и калории;
- сохранение приёмов пищи в MySQL по дням;
- дневник с итогом калорий за выбранный день;
- вход по телефону (SMS-код), email (magic link) или Google — у каждого пользователя свой дневник.

## Стек

- **Frontend + API:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **База данных:** MySQL + Prisma ORM
- **Авторизация:** NextAuth.js (телефон, email, Google)
- **Распознавание:** GigaChat API (Сбер, поддержка фото)

## Расположение проекта

```text
C:\Apache24\htdocs\calorie-vision
```

Apache может проксировать запросы к Next.js. Само приложение всё равно запускается через Node.js (`npm run dev` или `npm run start`).

## Что нужно установить

1. [Node.js 20+](https://nodejs.org/)
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
NEXTAUTH_URL=http://localhost:3000/calorie-vision/api/auth

EMAIL_SERVER=smtp://user:pass@smtp.example.com:587
EMAIL_FROM=noreply@calorievision.ru
SMS_RU_API_ID=

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

1. Вы входите по телефону, email или Google.
2. Выбираете дату и загружаете фото.
3. API `/api/recognize` сохраняет фото и возвращает предполагаемое блюдо.
4. Вы подтверждаете или исправляете данные.
5. API `/api/meals` записывает приём пищи в таблицу `MealEntry` для вашего аккаунта.
6. Блок «Дневник за день» показывает только ваши записи и сумму калорий.

## Настройка авторизации

### Телефон (SMS)

1. Зарегистрируйтесь на [sms.ru](https://sms.ru/) и получите `api_id`.
2. Добавьте в `.env`: `SMS_RU_API_ID=ваш-ключ`.
3. Без ключа код выводится в лог сервера (режим разработки).

### Email (magic link)

1. Настройте SMTP в `.env`:
   ```env
   EMAIL_SERVER=smtp://user:pass@smtp.yandex.ru:465
   EMAIL_FROM=noreply@calorievision.ru
   ```
2. Пользователь вводит email → получает ссылку для входа.

### Google (опционально)

1. Откройте [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Создайте OAuth 2.0 Client ID (тип «Web application»).
3. Добавьте **Authorized redirect URIs**:
   - `http://localhost:3000/calorie-vision/api/auth/callback/google`
   - `http://localhost/calorie-vision/api/auth/callback/google` (если через Apache)
4. Скопируйте Client ID и Client Secret в `.env`.

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
├── src/app/api/auth/         # NextAuth + SMS OTP
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
NEXTAUTH_URL=https://calorievision.ru/api/auth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GIGACHAT_CREDENTIALS=...
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat-2-Max
GIGACHAT_API_BASE=https://api.giga.chat/v1
```

### 3. Запуск приложения

```bash
cd /var/www/calorie-vision
git pull
bash deploy/deploy.sh
```

### 4. Nginx

```bash
# Ubuntu/Debian
cp deploy/nginx-calorievision.ru.conf /etc/nginx/sites-available/calorievision.ru
mkdir -p /etc/nginx/sites-enabled
ln -sf /etc/nginx/sites-available/calorievision.ru /etc/nginx/sites-enabled/calorievision.ru
nginx -t && systemctl reload nginx

# Или CentOS/без sites-enabled:
# cp deploy/nginx-calorievision.ru.conf /etc/nginx/conf.d/calorievision.ru.conf
```

### 5. HTTPS

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d calorievision.ru -d www.calorievision.ru
```

### 6. Google OAuth

- **Origins:** `https://calorievision.ru`
- **Redirect URI:** `https://calorievision.ru/api/auth/callback/google`

**Важно:**
- Используйте `npm run db:push`, а не `npx prisma` — `npx` может подтянуть Prisma 7.
- Prisma зафиксирована в `package.json` (6.19.3).
- Спецсимволы в пароле MySQL кодируйте в URL (`@` → `%40`).

## Полезные команды

```powershell
npm run dev          # dev-сервер
npm run build        # production-сборка
npm run db:studio    # просмотр БД в Prisma Studio
```
