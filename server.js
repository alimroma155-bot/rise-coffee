// RISE COFFEE — сервер: отдаёт сайт, хранит данные меню и принимает загрузку фото
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
// Логин и пароль админки задаются переменными окружения (см. инструкцию)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'change-me';

if (ADMIN_PASS === 'change-me') {
  console.warn('ВНИМАНИЕ: пароль админки по умолчанию. Задайте ADMIN_PASSWORD.');
  if (process.env.NODE_ENV === 'production') process.exit(1); // в боевом режиме не запускаемся без пароля
}

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'content.json'); // здесь лежит всё содержимое сайта
const UPLOADS = path.join(ROOT, 'uploads');                // здесь лежат загруженные фото
fs.mkdirSync(UPLOADS, { recursive: true });

const app = express();
app.disable('x-powered-by');

// ===== 1. ДАННЫЕ =====
function readContent() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeContent(obj) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, DATA_FILE); // запись через временный файл: данные не испортятся при сбое
}

// ===== 2. ГЛАВНАЯ СТРАНИЦА =====
// Данные вставляются прямо в HTML: сайту не нужен отдельный запрос, он открывается быстрее
let pageCache = null;
function renderPage() {
  if (!pageCache) {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    const json = JSON.stringify(readContent()).replace(/</g, '\\u003c'); // защита от </script> в тексте
    pageCache = html.replace('__DATA__', () => json);
  }
  return pageCache;
}
app.get(['/', '/index.html'], (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(renderPage());
});

// Публичные данные (запасной путь, если страница открыта без вставки данных)
app.get('/api/content', (req, res) => res.json(readContent()));

// ===== 3. ЗАЩИТА АДМИНКИ (логин и пароль в окошке браузера) =====
function same(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function auth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme === 'Basic' && token) {
    const [user, ...rest] = Buffer.from(token, 'base64').toString().split(':');
    if (same(user, ADMIN_USER) && same(rest.join(':'), ADMIN_PASS)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="RISE admin", charset="UTF-8"');
  res.status(401).send('Нужен вход');
}
app.use('/admin', auth); // всё, что начинается с /admin, требует пароль

// ===== 4. API АДМИНКИ =====
// Страница админки
app.use('/admin', express.static(path.join(ROOT, 'public', 'admin')));

// Прочитать данные
app.get('/admin/api/content', (req, res) => res.json(readContent()));

// Сохранить данные
app.put('/admin/api/content', express.json({ limit: '1mb' }), (req, res) => {
  const d = req.body;
  if (!d || typeof d !== 'object' || !Array.isArray(d.categories)) {
    return res.status(400).json({ error: 'Неверный формат данных' });
  }
  writeContent(d);
  pageCache = null; // сбрасываем кэш, чтобы сайт сразу показал изменения
  res.json({ ok: true });
});

// Загрузка фото (админка заранее уменьшает фото и превращает в JPEG)
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) =>
      cb(null, Date.now().toString(36) + crypto.randomBytes(4).toString('hex') + '.jpg')
  }),
  limits: { fileSize: 5 * 1024 * 1024 },                      // не больше 5 МБ
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'image/jpeg')
});
app.post('/admin/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Нужен файл-картинка' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// ===== 5. ФАЙЛЫ САЙТА =====
// У каждого фото уникальное имя, поэтому его можно кэшировать надолго
app.use('/uploads', express.static(UPLOADS, { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(ROOT, 'public'), { index: false, maxAge: '10m' }));

// Ошибки отдаём в виде понятного сообщения
app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || 'Ошибка' });
});

app.listen(PORT, () => {
  console.log('Сайт:    http://localhost:' + PORT);
  console.log('Админка: http://localhost:' + PORT + '/admin');
});
