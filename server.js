// RISE COFFEE — сервер: отдаёт сайт, хранит данные меню в SQLite и принимает загрузку фото

const express = require('express');
const multer = require('multer');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ===== КОНСТАНТЫ И НАСТРОЙКИ =====
const PORT = process.env.PORT || 3002;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'change-me';
const ROOT = __dirname;

// Используем постоянное хранилище /data на сервере, если оно доступно
const HAS_PERSISTENT_DISK = fs.existsSync('/data');
const STORAGE_DIR = HAS_PERSISTENT_DISK ? '/data' : path.join(ROOT, 'data');

const DB_FILE = path.join(STORAGE_DIR, 'rise.sqlite');
const UPLOADS_DIR = HAS_PERSISTENT_DISK
  ? path.join('/data', 'uploads')
  : path.join(ROOT, 'uploads');

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
fs.mkdirSync(STORAGE_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Копирование стартовых фотографий в постоянное хранилище при первом запуске на сервере
if (HAS_PERSISTENT_DISK) {
  const seedUploadsDir = path.join(ROOT, 'uploads');
  if (fs.existsSync(seedUploadsDir)) {
    for (const file of fs.readdirSync(seedUploadsDir)) {
      const destFile = path.join(UPLOADS_DIR, file);
      if (!fs.existsSync(destFile)) {
        fs.copyFileSync(path.join(seedUploadsDir, file), destFile);
      }
    }
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ SQLITE =====
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL'); // Повышенная надёжность и скорость записи

db.exec(`
  CREATE TABLE IF NOT EXISTS site_content (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS content_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Автоматическая миграция данных из content.json при первом запуске
const existingRow = db.prepare('SELECT data FROM site_content WHERE id = 1').get();
if (!existingRow) {
  let initialData = DEFAULT_CONTENT;
  const seedJsonPaths = [
    path.join(STORAGE_DIR, 'content.json'),
    path.join(ROOT, 'data', 'content.json')
  ];

  for (const jsonPath of seedJsonPaths) {
    if (fs.existsSync(jsonPath)) {
      try {
        initialData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        console.log('Импортированы начальные данные из:', jsonPath);
        break;
      } catch (err) {
        console.error('Ошибка чтения стартового JSON:', err);
      }
    }
  }

  db.prepare('INSERT INTO site_content (id, data) VALUES (1, ?)').run(
    JSON.stringify(initialData)
  );
}

// ===== РАБОТА С ДАННЫМИ МЕНЮ В SQLITE =====
const selectContentStmt = db.prepare('SELECT data FROM site_content WHERE id = 1');
const updateContentStmt = db.prepare(
  'UPDATE site_content SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
);
const insertHistoryStmt = db.prepare('INSERT INTO content_history (data) VALUES (?)');
const trimHistoryStmt = db.prepare(
  'DELETE FROM content_history WHERE id NOT IN (SELECT id FROM content_history ORDER BY id DESC LIMIT 20)'
);

const saveContentTransaction = db.transaction((jsonStr) => {
  const prev = selectContentStmt.get();
  if (prev && prev.data) {
    insertHistoryStmt.run(prev.data);
    trimHistoryStmt.run();
  }
  updateContentStmt.run(jsonStr);
});

function readContent() {
  try {
    const row = selectContentStmt.get();
    return row ? JSON.parse(row.data) : DEFAULT_CONTENT;
  } catch (err) {
    console.error('Ошибка чтения из SQLite:', err);
    return DEFAULT_CONTENT;
  }
}

function writeContent(obj) {
  saveContentTransaction(JSON.stringify(obj));
}

const app = express();
app.disable('x-powered-by');

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

// Корректное закрытие базы при остановке сервера
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});

// Запуск сервера
app.listen(PORT, () => {
  console.log('База SQLite:', DB_FILE);
  console.log('Сайт:       http://localhost:' + PORT);
  console.log('Админка:    http://localhost:' + PORT + '/admin');
});
