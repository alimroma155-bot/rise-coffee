// RISE COFFEE — сервер: отдаёт сайт, хранит данные меню и принимает загрузку фото
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3002;
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
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

const app = express();
app.disable('x-powered-by');

// ===== 1. ДАННЫЕ =====
function readContent() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { brand: { name: 'RISE', tagline: 'specialty coffee' }, categories: [] };
  }
}

function writeContent(obj) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

// ===== 2. ГЛАВНАЯ СТРАНИЦА =====
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

app.get('/api/content', (req, res) => res.json(readContent()));

// ===== 3. ЗАЩИТА АДМИНКИ =====
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

// ===== 4. API АДМИНКИ =====
app.use('/admin', express.static(path.join(ROOT, 'public', 'admin')));

app.get('/admin/api/content', (req, res) => res.json(readContent()));

app.put('/admin/api/content', express.json({ limit: '2mb' }), (req, res) => {
  const d = req.body;
  if (!d || typeof d !== 'object' || !Array.isArray(d.categories)) {
    return res.status(400).json({ error: 'Неверный формат данных' });
  }
  writeContent(d);
  pageCache = null; // сбрасываем кэш главной страницы
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) =>
      cb(null, Date.now().toString(36) + crypto.randomBytes(4).toString('hex') + '.jpg')
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype))
});

app.post('/admin/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Нужен файл-картинка' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// ===== 5. ФАЙЛЫ САЙТА =====
app.use('/uploads', express.static(UPLOADS, { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(ROOT, 'public'), { index: false, maxAge: '10m' }));

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || 'Ошибка' });
});

app.listen(PORT, () => {
  console.log('Сайт:    http://localhost:' + PORT);
  console.log('Админка: http://localhost:' + PORT + '/admin');
});
