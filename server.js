// RISE COFFEE — сервер: отдаёт сайт, хранит меню (data/content.json) и принимает фото
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'change-me';

if (ADMIN_PASS === 'change-me') {
  console.warn('ВНИМАНИЕ: пароль админки по умолчанию. Задайте ADMIN_PASSWORD.');
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'content.json');
const UPLOADS = path.join(ROOT, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

const app = express();
app.disable('x-powered-by');

// ===== 1. ДАННЫЕ =====
const readContent = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// FIX: асинхронный fs.writeFile во временный файл + rename — файл не повредится при сбое
async function writeContent(obj) {
  const tmp = DATA_FILE + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await fs.promises.rename(tmp, DATA_FILE);
}

// FIX: проверяем структуру до записи, чтобы кривые данные не сломали сайт
function validate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return 'Неверный формат данных';
  if (!Array.isArray(d.categories)) return 'Нет списка categories';
  for (const c of d.categories) {
    if (!c || typeof c.id !== 'string' || typeof c.title !== 'string' || !Array.isArray(c.items)) {
      return 'Неверный формат раздела меню';
    }
    if (c.items.some(it => !it || typeof it !== 'object')) return 'Неверный формат позиции меню';
  }
  if (new Set(d.categories.map(c => c.id)).size !== d.categories.length) {
    return 'Идентификаторы разделов повторяются';
  }
  return null;
}

// ===== 2. ГЛАВНАЯ СТРАНИЦА (данные вставляются прямо в HTML) =====
let pageCache = null;
function renderPage() {
  if (!pageCache) {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    const json = JSON.stringify(readContent()).replace(/</g, '\\u003c');
    pageCache = html.replace('__DATA__', () => json);
  }
  return pageCache;
}
app.get(['/', '/index.html'], (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(renderPage());
});

// ===== 3. ЗАЩИТА (Basic Auth) =====
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
app.use('/admin', auth);

// ===== 4. API =====
// Чтение — публично (его же использует админка)
app.get('/api/content', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(readContent());
});

// FIX: единый роут сохранения POST /api/content (под паролем — иначе любой смог бы переписать меню)
app.post('/api/content', auth, express.json({ limit: '1mb' }), async (req, res, next) => {
  const problem = validate(req.body);
  if (problem) return res.status(400).json({ error: problem });
  try {
    await writeContent(req.body);
    pageCache = null; // сайт сразу покажет изменения
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Загрузка фото (админка заранее уменьшает фото и превращает в JPEG)
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) =>
      cb(null, Date.now().toString(36) + crypto.randomBytes(4).toString('hex') + '.jpg')
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'image/jpeg')
});
app.post('/admin/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Нужен файл-картинка (JPEG, до 5 МБ)' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// ===== 5. ФАЙЛЫ =====
app.use('/admin', express.static(path.join(ROOT, 'public', 'admin')));
app.use('/uploads', express.static(UPLOADS, { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(ROOT, 'public'), { index: false, maxAge: '10m' }));

// FIX: нормальные коды ошибок (раньше всё было 400) и без утечки внутренних сообщений
app.use((err, req, res, next) => {
  const status = err.name === 'MulterError' ? 400 : err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Ошибка сервера' : err.message });
});

app.listen(PORT, () => {
  console.log('Сайт:    http://localhost:' + PORT);
  console.log('Админка: http://localhost:' + PORT + '/admin');
});