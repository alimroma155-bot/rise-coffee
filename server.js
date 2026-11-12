// RISE COFFEE — сервер: отдаёт сайт, хранит данные меню и принимает загрузку фото

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ===== КОНСТАНТЫ И НАСТРОЙКИ =====
const PORT = process.env.PORT || 3002;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'change-me';
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'content.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 МБ
const DEFAULT_CONTENT = { 
  brand: { name: 'RISE', tagline: 'specialty coffee' }, 
  categories: [] 
};

// Проверка пароля администратора
if (ADMIN_PASS === 'change-me') {
  console.warn('ВНИМАНИЕ: пароль админки по умолчанию. Задайте ADMIN_PASSWORD.');
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

// Инициализация директорий
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

const app = express();
app.disable('x-powered-by');

// ===== РАБОТА С ДАННЫМИ МЕНЮ =====
function readContent() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return DEFAULT_CONTENT;
  }
}

function writeContent(obj) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

// ===== РЕНДЕРИНГ ГЛАВНОЙ СТРАНИЦЫ =====
let pageCache = null;

function renderPage() {
  if (!pageCache) {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    const content = readContent();
    const jsonSafe = JSON.stringify(content).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    pageCache = html.replace('__DATA__', jsonSafe);
  }
  return pageCache;
}

function invalidateCache() {
  pageCache = null;
}

// Главная страница
app.get(['/', '/index.html'], (req, res) => {
  res.set('Cache-Control', 'no-cache');
  try {
    res.type('html').send(renderPage());
  } catch (err) {
    console.error('Ошибка рендеринга:', err);
    res.status(500).send('Ошибка загрузки страницы');
  }
});

// API для получения данных
app.get('/api/content', (req, res) => res.json(readContent()));

// ===== АУТЕНТИФИКАЦИЯ АДМИНКИ =====
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
  res.set('WWW-Authenticate', 'Basic realm="RISE admin"');
  res.status(401).send('Необходима авторизация');
}

app.use('/admin', auth);

// ===== СТАТИЧЕСКИЕ ФАЙЛЫ И API АДМИНКИ =====
app.use('/admin', express.static(path.join(ROOT, 'public', 'admin')));

app.get('/admin/api/content', (req, res) => res.json(readContent()));

app.put('/admin/api/content', express.json({ limit: '2mb' }), (req, res) => {
  const d = req.body;
  if (!d || typeof d !== 'object') {
    return res.status(400).json({ error: 'Неверный формат данных' });
  }
  if (!Array.isArray(d.categories)) {
    return res.status(400).json({ error: 'Отсутствует массив categories' });
  }
  
  writeContent(d);
  invalidateCache();
  res.json({ ok: true });
});

// Настройка загрузки изображений
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) =>
      cb(null, Date.now().toString(36) + crypto.randomBytes(4).toString('hex') + '.jpg')
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype))
});

app.post('/admin/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Нужен файл-картинка' });
  }
  res.json({ url: '/uploads/' + req.file.filename });
});

// ===== ПУБЛИЧНЫЕ СТАТИЧЕСКИЕ ФАЙЛЫ =====
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(ROOT, 'public'), { index: false, maxAge: '10m' }));

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(400).json({ error: err.message || 'Ошибка' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log('Сайт:    http://localhost:' + PORT);
  console.log('Админка: http://localhost:' + PORT + '/admin');
});
