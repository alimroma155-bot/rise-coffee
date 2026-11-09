# RISE COFFEE

## Запуск локально

```powershell
npm install
$env:PORT=3002
npm start
```

Откройте сайт по адресу `http://localhost:3002`, админку — `http://localhost:3002/admin`.

Локальные данные меню находятся в `data/content.json`. Фотографии, загруженные через админку, сохраняются в `uploads/`.

Пароль для локального входа по умолчанию: `admin` / `change-me`. Для публикации в интернете задайте `ADMIN_PASSWORD` и `ADMIN_USER` через переменные окружения.
