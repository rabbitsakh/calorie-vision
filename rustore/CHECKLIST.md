# Чеклист публикации Calorie Vision в RuStore

## Аккаунт и юрлицо

- [ ] Регистрация в [console.rustore.ru](https://console.rustore.ru)
- [ ] Компания / ИП / самозанятый (как требует Консоль)
- [ ] Роль **Владелец** для создания приложения
- [ ] Контакт поддержки: `support@calorievision.ru`

## Техника

- [ ] Package name: `ru.calorievision.app` (уникален, не менять после первой версии)
- [ ] Keystore создан, backup в сейфе (не в git)
- [ ] `bash scripts/rustore-init.sh` отработал
- [ ] `TWA_SHA256_FINGERPRINTS` на проде → `/.well-known/assetlinks.json` отдаёт JSON
- [ ] `bash scripts/rustore-build.sh` → APK (и опционально AAB)
- [ ] Windows: JDK 17 + `ANDROID_HOME` = корень SDK (см. `WINDOWS.md`)
- [ ] Установка APK на телефон: открывается calorievision.ru без адресной строки
- [ ] Логин (Google / VK / Telegram / email)
- [ ] Фото → распознавание → сохранение
- [ ] Web Push из TWA (если доступно на устройстве)
- [ ] Офлайн-очередь фото

## Витрина

Подробный гайд: [`PUBLISH.md`](PUBLISH.md). Тексты: [`listing.ru.md`](listing.ru.md).

- [ ] Название: Calorie Vision
- [ ] Краткое и полное описание (скопировать из `listing.ru.md`)
- [ ] Иконка: `rustore/icon-512-store.png` (512×512, без прозрачности)
- [ ] Скриншоты: `rustore/screenshots/submit/` (≥3; дописать реальные кадры рациона с телефона)
- [ ] Категория: Здоровье и фитнес / Еда
- [ ] Возрастной рейтинг
- [ ] Ссылка на политику: `https://calorievision.ru/privacy`
- [ ] Ссылка на условия: `https://calorievision.ru/terms`
- [ ] В описании: не медуслуга, оценка калорий — не лабораторный анализ

## Модерация

- [ ] Черновик версии отправлен
- [ ] Ответы на замечания модерации
- [ ] Публикация в проде
- [ ] Ссылка RuStore сохранена (для лендинга /#install позже)

## После релиза

- [ ] Увеличить `appVersionCode` перед следующим билдом
- [ ] При желании — альфа-тестирование в RuStore перед продом
