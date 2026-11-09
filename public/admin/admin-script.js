const $ = s => document.querySelector(s);
let S = null;          
let dirty = false;     
let tab = 'menu';      
let sel = 0;           // Индекс выбранной категории
let openItem = null;   // Стринг вида "индекс_категории:индекс_товара"

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CAM = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

function toast(t) {
  const el = $('#toast');
  el.textContent = t;
  el.classList.add('on');
  clearTimeout(window.tT);
  window.tT = setTimeout(() => el.classList.remove('on'), 2500);
}

function updSave() {
  $('#savebar').classList.toggle('on', dirty);
}

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
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Не удалось обработать фото');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Не удалось обработать фото'));
        }, 'image/jpeg', 0.82);
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

async function responseError(response) {
  try {
    const body = await response.json();
    if (body.error) return body.error;
  } catch (e) {
    // Non-JSON responses are reported by status below.
  }
  return `HTTP ${response.status}`;
}

function setTab(v) {
  tab = v;
  document.querySelectorAll('[data-a="tab"]').forEach(b => {
    b.setAttribute('aria-selected', b.getAttribute('data-v') === v);
  });
  render();
}

async function load() {
  try {
    const r = await fetch('/admin/api/content');
    if (!r.ok) throw new Error(await responseError(r));
    S = await r.json();
    render();
  } catch(e) {
    console.error('Не удалось загрузить данные кофейни:', e);
    $('#app').innerHTML = `<p class="empty"><b>Ошибка</b>Не удалось загрузить данные кофейни: ${esc(e.message)}. Обновите страницу.</p>`;
  }
}

function render() {
  if (!S) return;
  const h = $('#app');
  
  if (tab === 'info') {
    h.innerHTML = `
      <div class="card">
        <h2>Часы и контакты</h2>
        <label class="fl">Название бренда<input type="text" id="i_brand" value="${esc(S.brand?.name)}"></label>
        <label class="fl">Адрес<input type="text" id="i_address" value="${esc(S.brand?.address)}"></label>
        <div class="two">
          <label class="fl">Открытие (ч)<input type="number" id="i_open" value="${S.hours?.open || 8}"></label>
          <label class="fl">Закрытие (ч)<input type="number" id="i_close" value="${S.hours?.close || 22}"></label>
        </div>
      </div>`;
    
    $('#i_brand').oninput = (e) => { S.brand.name = e.target.value; dirty = true; updSave(); };
    $('#i_address').oninput = (e) => { S.brand.address = e.target.value; dirty = true; updSave(); };
    $('#i_open').oninput = (e) => { S.hours.open = parseInt(e.target.value) || 8; dirty = true; updSave(); };
    $('#i_close').oninput = (e) => { S.hours.close = parseInt(e.target.value) || 22; dirty = true; updSave(); };
    return;
  }
  
  // Вкладка Меню
  const currentCategory = S.categories[sel];
  
  let catsHtml = S.categories.map((c, i) => `
    <button class="chip" data-a="cat" data-i="${i}" aria-pressed="${sel === i}">${esc(c.title)}</button>
  `).join('');
  
  catsHtml += '<button class="chip add" data-a="add-cat">+ Раздел</button>';
  
  let itemsHtml = '';
  if (currentCategory && currentCategory.items) {
    itemsHtml = currentCategory.items.map((it, i) => {
      const id = `${sel}:${i}`;
      const isOpen = openItem === id;
      const bg = it.image ? `style="background-image:url(${esc(it.image)})"` : '';
      
      return `
        <div class="it ${isOpen ? 'open' : ''}">
          <button class="ih" data-a="toggle" data-id="${id}">
            <div class="th" ${bg}>${it.image ? '' : CAM}</div>
            <div class="im"><b>${esc(it.name || 'Без названия')}</b><small>${esc(it.price)}</small></div>
            <svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></polyline></svg>
          </button>
          ${isOpen ? `
            <div class="ib">
              <label class="drop ${it.image ? 'has' : ''}" ${it.image ? `style="background-image:linear-gradient(transparent 55%,rgba(0,0,0,.45)),url('${esc(it.image)}')"` : ''}>
                ${it.image ? '<span>Нажмите, чтобы заменить фото</span>' : `${CAM}<span>Добавить фото (оно уменьшится автоматически)</span>`}
                <input class="photo-input" type="file" accept="image/*" data-upload-category="${sel}" data-upload-item="${i}">
              </label>
              ${it.image ? `<div class="row" style="margin-top:8px"><button class="btn ghost" data-a="clear-image" data-i="${i}">Убрать фото</button></div>` : ''}
              <label class="fl">Название<input type="text" data-k="name" value="${esc(it.name)}"></label>
              <label class="fl">Описание<textarea data-k="desc" rows="2">${esc(it.desc)}</textarea></label>
              <label class="fl">Цена<input type="text" data-k="price" value="${esc(it.price)}"></label>
              <div class="row">
                <button class="btn danger" data-a="del-item" data-i="${i}">Удалить</button>
              </div>
            </div>
          ` : ''}
        </div>`;
    }).join('');
  }
  
  if (!currentCategory || !currentCategory.items || !currentCategory.items.length) {
    itemsHtml = '<p class="empty"><b>В этом разделе пусто</b>Добавьте первый товар кнопкой ниже</p>';
  }
  
  h.innerHTML = `
    <div class="chips">${catsHtml}</div>
    <div class="list">${itemsHtml}</div>
    <div style="margin-top:20px"><button class="btn wide" data-a="add-item">+ Добавить позицию</button></div>
    <div style="margin-top:40px" class="row">
      <button class="btn danger ghost grow" data-a="ren-cat">Переименовать раздел</button>
      <button class="btn danger grow" data-a="del-cat">Удалить раздел</button>
    </div>`;
    
  // Обработка инпутов внутри раскрытого товара
  if (openItem && openItem.startsWith(`${sel}:`)) {
    const itemIdx = parseInt(openItem.split(':')[1]);
    const it = S.categories[sel].items[itemIdx];
    if (it) {
      h.querySelectorAll('.ib input, .ib textarea').forEach(el => {
        el.oninput = (e) => {
          it[el.getAttribute('data-k')] = el.value;
          dirty = true;
          updSave();
          if(el.getAttribute('data-k') === 'name') {
            h.querySelector(`[data-id="${openItem}"] b`).textContent = el.value || 'Без названия';
          }
          if(el.getAttribute('data-k') === 'price') {
            h.querySelector(`[data-id="${openItem}"] small`).textContent = el.value;
          }
        };
      });
    }
  }
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-a], [data-id]');
  if (!t) return;
  
  if (t.getAttribute('data-a') === 'tab') {
    setTab(t.getAttribute('data-v'));
  }
  
  if (t.getAttribute('data-a') === 'cat') {
    sel = parseInt(t.getAttribute('data-i'));
    openItem = null;
    render();
  }
  
  if (t.getAttribute('data-id')) {
    const id = t.getAttribute('data-id');
    openItem = openItem === id ? null : id;
    render();
  }
  
  if (t.getAttribute('data-a') === 'add-cat') {
    const n = prompt('Название нового раздела:');
    if (n) { 
      const id = n.toLowerCase().replace(/[^a-z0-9]/g, '-');
      S.categories.push({ id: id || 'custom', title: n, subtitle: '', items: [] });
      sel = S.categories.length - 1; 
      openItem = null; 
      dirty = true; 
      render(); 
      updSave(); 
    }
  }
  
  if (t.getAttribute('data-a') === 'ren-cat') {
    const n = prompt('Новое название раздела:', S.categories[sel].title);
    if (n) { S.categories[sel].title = n; dirty = true; render(); updSave(); }
  }
  
  if (t.getAttribute('data-a') === 'del-cat') {
    if (confirm(`Удалить раздел "${S.categories[sel].title}" и все его товары?`)) {
      S.categories.splice(sel, 1);
      sel = 0; openItem = null; dirty = true; render(); updSave();
    }
  }
  
  if (t.getAttribute('data-a') === 'add-item') {
    if(!S.categories[sel].items) S.categories[sel].items = [];
    S.categories[sel].items.push({ name: 'Новая позиция', desc: '', price: '0 р.', image: '' });
    openItem = `${sel}:${S.categories[sel].items.length - 1}`;
    dirty = true; render(); updSave();
  }
  
  if (t.getAttribute('data-a') === 'del-item') {
    const idx = parseInt(t.getAttribute('data-i'));
    if (confirm('Удалить эту позицию?')) {
      S.categories[sel].items.splice(idx, 1); openItem = null; dirty = true; render(); updSave();
    }
  }

  if (t.getAttribute('data-a') === 'clear-image') {
    const item = S.categories[sel].items[parseInt(t.getAttribute('data-i'))];
    if (item) {
      item.image = '';
      dirty = true;
      render();
      updSave();
    }
  }
  
  if (t.getAttribute('data-a') === 'save') {
    const btn = $('#saveBtn');
    btn.disabled = true; btn.textContent = 'Сохранение...';
    try {
      const r = await fetch('/admin/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(S)
      });
      if (!r.ok) throw new Error(await responseError(r));
      dirty = false; updSave(); toast('Изменения успешно сохранены!');
    } catch(e) {
      console.error('Не удалось сохранить данные кофейни:', e);
      toast(`Ошибка при сохранении: ${e.message}`);
    } finally {
      btn.disabled = false; btn.textContent = 'Сохранить';
    }
  }
});

document.addEventListener('change', async e => {
  const input = e.target;
  if (!input.matches('.photo-input')) return;
  const file = input.files[0];
  if (!file) return;

  const categoryIndex = parseInt(input.getAttribute('data-upload-category'));
  const itemIndex = parseInt(input.getAttribute('data-upload-item'));
  const item = S.categories[categoryIndex]?.items[itemIndex];
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
    if (!S.categories[categoryIndex]?.items.includes(item)) {
      throw new Error('Товар изменён во время загрузки. Выберите фото ещё раз');
    }

    item.image = result.url;
    dirty = true;
    render();
    updSave();
    toast('Фото добавлено. Нажмите «Сохранить», чтобы обновить сайт');
  } catch (error) {
    console.error('Не удалось загрузить фото:', error);
    toast(`Ошибка загрузки фото: ${error.message}`);
  } finally {
    input.value = '';
  }
});

load();
