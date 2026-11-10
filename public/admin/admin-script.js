// RISE — логика админки. Состояние S = содержимое data/content.json:
// { brand, hours, banner, theme, about, contacts, categories: [{ id, title, subtitle, items: [{ name, desc, price, image }] }] }
const $ = s => document.querySelector(s);
const API = '/api/content';

let S = null;          // актуальные данные
let dirty = false;     // есть несохранённые изменения
let tab = 'menu';
let sel = 0;           // индекс выбранного раздела
let openItem = null;   // раскрытая позиция: "индекс_раздела:индекс_позиции"
let toastTimer;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
const cssUrl = u => esc(String(u).replace(/['"()\\\s]/g, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')));

const CAM = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
// FIX: в старой иконке был лишний закрывающий тег </polyline>
const CHEV = '<svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

// ===== УТИЛИТЫ =====
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2500);
}

function setDirty(v) {
  dirty = v;
  $('#savebar').classList.toggle('on', dirty);
}

async function responseError(response) {
  try {
    const body = await response.json();
    if (body.error) return body.error;
  } catch (e) { /* ответ не JSON — покажем статус */ }
  return `HTTP ${response.status}`;
}

// FIX: данные приводятся к ожидаемой структуре — админка не падает на пустых полях
function normalize(d) {
  d.brand = d.brand || {};
  d.hours = d.hours || {};
  if (!Number.isFinite(Number(d.hours.open))) d.hours.open = 8;
  if (!Number.isFinite(Number(d.hours.close))) d.hours.close = 22;
  d.categories = Array.isArray(d.categories) ? d.categories : [];
  d.categories.forEach(c => { if (!Array.isArray(c.items)) c.items = []; });
  return d;
}

// FIX: id раздела уникален и не совпадает с id блоков страницы (menu, about, contacts…).
// Раньше для кириллицы получалось "-----", и разделы склеивались.
function makeId(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const base = 'cat-' + (slug || Date.now().toString(36));
  let id = base;
  let n = 2;
  while (S.categories.some(c => c.id === id)) id = base + '-' + n++;
  return id;
}

// FIX: фото загружаются, но не теряются молча при уходе со страницы
window.addEventListener('beforeunload', e => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

// Уменьшаем фото и превращаем в JPEG до отправки на сервер
function toJpeg(file, maxSide) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Не удалось обработать фото');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Не удалось обработать фото'))), 'image/jpeg', 0.82);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось открыть выбранное фото'));
    };
    image.src = url;
  });
}

// ===== ЗАГРУЗКА И СОХРАНЕНИЕ =====
async function load() {
  try {
    const r = await fetch(API, { cache: 'no-store' });
    if (!r.ok) throw new Error(await responseError(r));
    S = normalize(await r.json());
    render();
  } catch (e) {
    console.error('Не удалось загрузить данные кофейни:', e);
    $('#app').innerHTML = `<p class="empty"><b>Ошибка</b>Не удалось загрузить данные кофейни: ${esc(e.message)}. Обновите страницу.</p>`;
  }
}

async function save() {
  const btn = $('#saveBtn');
  btn.disabled = true;
  btn.textContent = 'Сохранение…';
  try {
    const snapshot = JSON.stringify(S);
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: snapshot
    });
    if (!r.ok) throw new Error(await responseError(r));
    // если пока шло сохранение что-то изменили — панель остаётся
    if (JSON.stringify(S) === snapshot) setDirty(false);
    toast('Изменения сохранены. Сайт обновлён');
  } catch (e) {
    console.error('Не удалось сохранить данные кофейни:', e);
    toast(`Ошибка при сохранении: ${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Сохранить';
  }
}

// ===== ОТРИСОВКА =====
function setTab(v) {
  tab = v;
  document.querySelectorAll('[data-a="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === v)));
  render();
}

function renderInfo(h) {
  h.innerHTML = `
    <div class="card">
      <h2>Часы и контакты</h2>
      <label class="fl">Название бренда<input type="text" data-info="name" value="${esc(S.brand.name)}"></label>
      <label class="fl">Адрес<input type="text" data-info="address" value="${esc(S.brand.address)}"></label>
      <div class="two">
        <label class="fl">Открытие (ч)<input type="number" min="0" max="24" data-info="open" value="${esc(S.hours.open)}"></label>
        <label class="fl">Закрытие (ч)<input type="number" min="0" max="24" data-info="close" value="${esc(S.hours.close)}"></label>
      </div>
    </div>`;
}

function itemHtml(it, i) {
  const id = `${sel}:${i}`;
  const isOpen = openItem === id;
  const bg = it.image ? `style="background-image:url('${cssUrl(it.image)}')"` : '';
  const dropBg = it.image ? `style="background-image:linear-gradient(transparent 55%,rgba(0,0,0,.45)),url('${cssUrl(it.image)}')"` : '';

  return `
    <div class="it ${isOpen ? 'open' : ''}">
      <button class="ih" type="button" data-a="toggle" data-id="${id}">
        <div class="th" ${bg}>${it.image ? '' : CAM}</div>
        <div class="im"><b>${esc(it.name || 'Без названия')}</b><small>${esc(it.price)}</small></div>
        ${CHEV}
      </button>
      ${isOpen ? `
        <div class="ib">
          <label class="drop ${it.image ? 'has' : ''}" ${dropBg}>
            ${it.image ? '<span>Нажмите, чтобы заменить фото</span>' : `${CAM}<span>Добавить фото (оно уменьшится автоматически)</span>`}
            <input class="photo-input" type="file" accept="image/*" data-upload-category="${sel}" data-upload-item="${i}">
          </label>
          ${it.image ? '<div class="row" style="margin-top:8px"><button class="btn ghost" type="button" data-a="clear-image">Убрать фото</button></div>' : ''}
          <label class="fl">Название<input type="text" data-k="name" value="${esc(it.name)}"></label>
          <label class="fl">Описание<textarea data-k="desc" rows="2">${esc(it.desc)}</textarea></label>
          <label class="fl">Цена<input type="text" data-k="price" value="${esc(it.price)}"></label>
          <label class="chk"><input type="checkbox" data-k="isNew" ${it.isNew ? 'checked' : ''}> Значок «new» на карточке</label>
          <div class="row"><button class="btn danger" type="button" data-a="del-item">Удалить</button></div>
        </div>` : ''}
    </div>`;
}

function renderMenu(h) {
  const cat = S.categories[sel];
  const chips = S.categories
    .map((c, i) => `<button class="chip" type="button" data-a="cat" data-i="${i}" aria-pressed="${sel === i}">${esc(c.title)}</button>`)
    .join('') + '<button class="chip add" type="button" data-a="add-cat">+ Раздел</button>';

  if (!cat) {
    h.innerHTML = `<div class="chips">${chips}</div><p class="empty"><b>Меню пустое</b>Добавьте первый раздел кнопкой «+ Раздел»</p>`;
    return;
  }

  const list = cat.items.length
    ? cat.items.map(itemHtml).join('')
    : '<p class="empty"><b>В этом разделе пусто</b>Добавьте первый товар кнопкой ниже</p>';

  h.innerHTML = `
    <div class="chips">${chips}</div>
    <div class="list">${list}</div>
    <div style="margin-top:20px"><button class="btn wide" type="button" data-a="add-item">+ Добавить позицию</button></div>
    <div style="margin-top:40px" class="row">
      <button class="btn ghost grow" type="button" data-a="ren-cat">Переименовать раздел</button>
      <button class="btn danger grow" type="button" data-a="del-cat">Удалить раздел</button>
    </div>`;
}

function render() {
  if (!S) return;
  const h = $('#app');
  if (tab === 'info') renderInfo(h);
  else renderMenu(h);
}

// Текущая раскрытая позиция
function currentItem() {
  if (!openItem) return null;
  const [ci, ii] = openItem.split(':').map(Number);
  return S.categories[ci]?.items[ii] || null;
}

// ===== РЕДАКТИРОВАНИЕ ПОЛЕЙ =====
document.addEventListener('input', e => {
  const el = e.target;
  if (!S) return;

  // вкладка «Часы и контакты»
  if (el.dataset.info) {
    const k = el.dataset.info;
    if (k === 'name') S.brand.name = el.value;
    else if (k === 'address') S.brand.address = el.value;
    else {
      // FIX: раньше `|| 8` превращал час «0» в 8; теперь пустое поле просто игнорируется
      const n = parseInt(el.value, 10);
      if (!Number.isFinite(n)) return;
      S.hours[k] = Math.min(24, Math.max(0, n));
    }
    return setDirty(true);
  }

  // поля позиции меню
  if (el.dataset.k) {
    const it = currentItem();
    if (!it) return;
    it[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
    setDirty(true);
    if (el.dataset.k === 'name') $('.it.open .im b').textContent = el.value || 'Без названия';
    if (el.dataset.k === 'price') $('.it.open .im small').textContent = el.value;
  }
});

// ===== ДЕЙСТВИЯ =====
const actions = {
  tab: t => setTab(t.dataset.v),

  cat: t => {
    sel = parseInt(t.dataset.i, 10);
    openItem = null;
    render();
  },

  toggle: t => {
    openItem = openItem === t.dataset.id ? null : t.dataset.id;
    render();
  },

  'add-cat': () => {
    const title = (prompt('Название нового раздела:') || '').trim();
    if (!title) return;
    S.categories.push({ id: makeId(title), title, subtitle: '', items: [] });
    sel = S.categories.length - 1;
    openItem = null;
    setDirty(true);
    render();
  },

  'ren-cat': () => {
    const title = (prompt('Новое название раздела:', S.categories[sel].title) || '').trim();
    if (!title) return;
    S.categories[sel].title = title;
    setDirty(true);
    render();
  },

  'del-cat': () => {
    if (!confirm(`Удалить раздел «${S.categories[sel].title}» и все его товары?`)) return;
    S.categories.splice(sel, 1);
    sel = 0;
    openItem = null;
    setDirty(true);
    render();
  },

  'add-item': () => {
    const items = S.categories[sel].items;
    items.push({ name: 'Новая позиция', desc: '', price: '0 р.', image: '', isNew: false });
    openItem = `${sel}:${items.length - 1}`;
    setDirty(true);
    render();
  },

  'del-item': () => {
    const it = currentItem();
    if (!it || !confirm('Удалить эту позицию?')) return;
    S.categories[sel].items.splice(S.categories[sel].items.indexOf(it), 1);
    openItem = null;
    setDirty(true);
    render();
  },

  'clear-image': () => {
    const it = currentItem();
    if (!it) return;
    it.image = '';
    setDirty(true);
    render();
  },

  save
};

document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]');
  if (!t || !S) return;
  const fn = actions[t.dataset.a];
  if (fn) fn(t);
});

// ===== ЗАГРУЗКА ФОТО =====
document.addEventListener('change', async e => {
  const input = e.target;
  if (!input.matches('.photo-input')) return;
  const file = input.files[0];
  if (!file) return;

  const item = S.categories[Number(input.dataset.uploadCategory)]?.items[Number(input.dataset.uploadItem)];
  if (!item) return;

  input.disabled = true;
  try {
    toast('Уменьшаем и загружаем фото…');
    const image = await toJpeg(file, 800);
    const form = new FormData();
    form.append('image', image, 'photo.jpg');
    const response = await fetch('/admin/api/upload', { method: 'POST', body: form });
    if (!response.ok) throw new Error(await responseError(response));
    const result = await response.json();
    if (!result.url) throw new Error('Сервер не вернул адрес фото');

    // пока грузилось фото, позицию могли удалить
    if (!S.categories.some(c => c.items.includes(item))) {
      throw new Error('Товар изменён во время загрузки. Выберите фото ещё раз');
    }
    item.image = result.url;
    setDirty(true);
    render();
    toast('Фото добавлено. Нажмите «Сохранить», чтобы обновить сайт');
  } catch (error) {
    console.error('Не удалось загрузить фото:', error);
    toast(`Ошибка загрузки фото: ${error.message}`);
  } finally {
    input.value = '';
    input.disabled = false;
  }
});

load();
