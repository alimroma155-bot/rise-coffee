// RISE COFFEE — панель управления сайтом

const $ = (selector) => document.querySelector(selector);

// ===== СОСТОЯНИЕ ПРИЛОЖЕНИЯ =====
let contentData = null;
let hasUnsavedChanges = false;
let currentTab = 'menu';
let selectedCategoryIndex = 0;
let openItemId = null;

// ===== УТИЛИТЫ =====
function escapeHtml(str) {
  const text = String(str == null ? '' : str);
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

const CAMERA_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

function showToast(message) {
  const toastEl = $('#toast');
  toastEl.textContent = message;
  toastEl.classList.add('on');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2500);
}

function markDirty() {
  hasUnsavedChanges = true;
  updateSaveBar();
}

function updateSaveBar() {
  $('#savebar').classList.toggle('on', hasUnsavedChanges);
}

// ===== ОБРАБОТКА ИЗОБРАЖЕНИЙ =====
async function convertToJpeg(file, maxSize) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Не удалось обработать фото');
        
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Не удалось обработать фото'));
          },
          'image/jpeg',
          0.85
        );
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось открыть выбранное фото'));
    };

    image.src = objectUrl;
  });
}

async function getErrorMessage(response) {
  try {
    const body = await response.json();
    if (body.error) return body.error;
  } catch {}
  return `HTTP ${response.status}`;
}

// ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('[data-a="tab"]').forEach((btn) => {
    btn.setAttribute('aria-selected', String(btn.getAttribute('data-v') === tabName));
  });
  render();
}

// ===== ЗАГРУЗКА ДАННЫХ С СЕРВЕРА =====
async function loadContent() {
  try {
    const response = await fetch('/admin/api/content');
    if (!response.ok) throw new Error(await getErrorMessage(response));
    
    contentData = await response.json();
    
    if (!Array.isArray(contentData.categories)) {
      contentData.categories = [];
    }
    if (!contentData.brand) {
      contentData.brand = {};
    }
    if (!contentData.hours) {
      contentData.hours = { open: 8, close: 22 };
    }
    
    render();
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    $('#app').innerHTML = `<p class="empty"><b>Ошибка</b>Не удалось загрузить данные: ${escapeHtml(error.message)}. Обновите страницу.</p>`;
  }
}

// ===== РЕНДЕРИНГ ИНТЕРФЕЙСА =====
function render() {
  if (!contentData) return;

  const appContainer = $('#app');

  // Вкладка "Часы и контакты"
  if (currentTab === 'info') {
    appContainer.innerHTML = `
      <div class="card">
        <h2>Часы и контакты</h2>
        <label class="fl">Название бренда<input type="text" id="i_brand" value="${escapeHtml(contentData.brand?.name || '')}"></label>
        <label class="fl">Слоган<input type="text" id="i_tag" value="${escapeHtml(contentData.brand?.tagline || '')}"></label>
        <label class="fl">Адрес<input type="text" id="i_address" value="${escapeHtml(contentData.brand?.address || '')}"></label>
        <div class="two">
          <label class="fl">Открытие (ч)<input type="number" id="i_open" value="${contentData.hours?.open || 8}"></label>
          <label class="fl">Закрытие (ч)<input type="number" id="i_close" value="${contentData.hours?.close || 22}"></label>
        </div>
      </div>`;

    $('#i_brand').oninput = (e) => { contentData.brand.name = e.target.value; markDirty(); };
    $('#i_tag').oninput = (e) => { contentData.brand.tagline = e.target.value; markDirty(); };
    $('#i_address').oninput = (e) => { contentData.brand.address = e.target.value; markDirty(); };
    $('#i_open').oninput = (e) => { contentData.hours.open = parseInt(e.target.value) || 8; markDirty(); };
    $('#i_close').oninput = (e) => { contentData.hours.close = parseInt(e.target.value) || 22; markDirty(); };
    return;
  }

  // Вкладка "Меню"
  if (selectedCategoryIndex >= contentData.categories.length) {
    selectedCategoryIndex = Math.max(0, contentData.categories.length - 1);
  }

  const hasCategories = contentData.categories.length > 0;

  if (!hasCategories) {
    appContainer.innerHTML = `
      <p class="empty">
        <b>Меню пусто</b>
        Добавьте первый раздел, чтобы начать работу.
      </p>
      <div class="chips">
        <button class="chip add" data-a="add-cat">+ Раздел</button>
      </div>`;
    return;
  }

  const currentCategory = contentData.categories[selectedCategoryIndex];
  const items = currentCategory.items || [];

  // Кнопки категорий
  const categoryChipsHtml = contentData.categories
    .map((cat, index) => {
      const isActive = index === selectedCategoryIndex;
      return `<button class="chip" data-a="cat" data-i="${index}" aria-pressed="${isActive}">${escapeHtml(cat.title)}</button>`;
    })
    .join('');

  // Карточки товаров
  const itemsHtml = items
    .map((item, index) => {
      const itemId = `${selectedCategoryIndex}:${index}`;
      const isOpen = openItemId === itemId;
      const imageUrl = item.image || '';

      return `
        <div class="it ${isOpen ? 'open' : ''}" data-item-container="${itemId}">
          <button class="ih" data-toggle-item="${itemId}">
            <span class="th" style="${imageUrl ? `background-image:url('${escapeHtml(imageUrl)}')` : ''}">
              ${imageUrl ? '' : CAMERA_ICON}
            </span>
            <span class="im">
              <b>${escapeHtml(item.name || 'Без названия')}</b>
              <small>${escapeHtml(item.price || '')}</small>
            </span>
            <svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          ${isOpen ? `
            <div class="ib">
              <label class="fl">Название<input type="text" data-edit="name" data-item-idx="${index}" value="${escapeHtml(item.name || '')}"></label>
              <label class="fl">Описание<input type="text" data-edit="desc" data-item-idx="${index}" value="${escapeHtml(item.desc || '')}"></label>
              <label class="fl">Цена<input type="text" data-edit="price" data-item-idx="${index}" value="${escapeHtml(item.price || '')}"></label>
              <label class="fl">
                Фотография
                <label class="drop ${imageUrl ? 'has' : ''}" style="${imageUrl ? `background-image:url('${escapeHtml(imageUrl)}')` : ''}">
                  ${imageUrl ? 'Заменить фото' : `${CAMERA_ICON} Загрузить фото`}
                  <input type="file" class="photo-input" accept="image/*" data-upload-cat="${selectedCategoryIndex}" data-upload-item="${index}">
                </label>
              </label>
              <div class="row">
                ${imageUrl ? `<button class="btn ghost" data-a="clear-image" data-i="${index}">Удалить фото</button>` : ''}
                <span class="grow"></span>
                <button class="btn danger" data-a="del-item" data-i="${index}">Удалить позицию</button>
              </div>
            </div>` : ''}
        </div>`;
    })
    .join('');

  appContainer.innerHTML = `
    <div class="chips">
      ${categoryChipsHtml}
      <button class="chip add" data-a="add-cat">+ Раздел</button>
    </div>
    <div class="card">
      <h2>${escapeHtml(currentCategory.title)}</h2>
      <p class="lead">${items.length} поз.</p>
      <label class="fl">Подзаголовок<input type="text" id="i_subtitle" value="${escapeHtml(currentCategory.subtitle || '')}"></label>
      <div class="row">
        <button class="btn ghost" data-a="ren-cat">Переименовать</button>
        <span class="grow"></span>
        <button class="btn danger" data-a="del-cat">Удалить раздел</button>
      </div>
    </div>
    ${itemsHtml}
    <button class="btn wide" data-a="add-item">+ Добавить позицию</button>`;

  // Привязка событий для редактирования подзаголовка
  const subtitleInput = $('#i_subtitle');
  if (subtitleInput) {
    subtitleInput.oninput = (e) => {
      currentCategory.subtitle = e.target.value;
      markDirty();
    };
  }

  // Привязка событий для редактирования полей товаров
  document.querySelectorAll('[data-edit]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const field = e.target.getAttribute('data-edit');
      const itemIdx = parseInt(e.target.getAttribute('data-item-idx'), 10);
      
      contentData.categories[selectedCategoryIndex].items[itemIdx][field] = e.target.value;
      markDirty();

      // Обновление превью в заголовке
      const itemId = `${selectedCategoryIndex}:${itemIdx}`;
      const container = document.querySelector(`[data-item-container="${itemId}"]`);
      if (!container) return;

      if (field === 'name') {
        const nameEl = container.querySelector('b');
        if (nameEl) nameEl.textContent = e.target.value || 'Без названия';
      }
      if (field === 'price') {
        const priceEl = container.querySelector('small');
        if (priceEl) priceEl.textContent = e.target.value;
      }
    });
  });
}

// ===== ОБРАБОТКА ЗАГРУЗКИ ФОТОГРАФИЙ =====
document.addEventListener('change', async (e) => {
  const input = e.target.closest('input[type="file"]');
  if (!input || !input.files || !input.files[0]) return;

  const categoryIndex = parseInt(input.getAttribute('data-upload-cat'), 10);
  const itemIndex = parseInt(input.getAttribute('data-upload-item'), 10);
  const file = input.files[0];

  showToast('Обработка и загрузка фото...');

  try {
    const jpegBlob = await convertToJpeg(file, 900);
    const formData = new FormData();
    formData.append('image', jpegBlob, 'photo.jpg');

    const response = await fetch('/admin/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error(await getErrorMessage(response));
    
    const data = await response.json();
    contentData.categories[categoryIndex].items[itemIndex].image = data.url;
    markDirty();
    render();
    showToast('Фото загружено! Не забудьте нажать «Сохранить»');
  } catch (error) {
    console.error(error);
    showToast('Ошибка загрузки: ' + error.message);
  }
});

// ===== ОБРАБОТКА КЛИКОВ =====
document.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-a], [data-toggle-item]');
  if (!target) return;

  const action = target.getAttribute('data-a');

  // Переключение вкладок
  if (action === 'tab') {
    switchTab(target.getAttribute('data-v'));
    return;
  }

  // Переключение категории
  if (action === 'cat') {
    selectedCategoryIndex = parseInt(target.getAttribute('data-i'), 10);
    openItemId = null;
    render();
    return;
  }

  // Разворачивание карточки товара
  if (target.hasAttribute('data-toggle-item')) {
    const itemId = target.getAttribute('data-toggle-item');
    openItemId = openItemId === itemId ? null : itemId;
    render();
    return;
  }

  // Удаление фото
  if (action === 'clear-image') {
    const itemIndex = parseInt(target.getAttribute('data-i'), 10);
    contentData.categories[selectedCategoryIndex].items[itemIndex].image = '';
    markDirty();
    render();
    return;
  }

  // Добавление категории
  if (action === 'add-cat') {
    const categoryName = prompt('Название нового раздела:');
    if (categoryName && categoryName.trim()) {
      const newId = 'cat-' + Date.now().toString(36);
      contentData.categories.push({
        id: newId,
        title: categoryName.trim(),
        subtitle: '',
        items: []
      });
      selectedCategoryIndex = contentData.categories.length - 1;
      openItemId = null;
      markDirty();
      render();
    }
    return;
  }

  // Переименование категории
  if (action === 'ren-cat') {
    const currentTitle = contentData.categories[selectedCategoryIndex].title;
    const newName = prompt('Новое название раздела:', currentTitle);
    if (newName && newName.trim()) {
      contentData.categories[selectedCategoryIndex].title = newName.trim();
      markDirty();
      render();
    }
    return;
  }

  // Удаление категории
  if (action === 'del-cat') {
    const categoryTitle = contentData.categories[selectedCategoryIndex].title;
    if (confirm(`Удалить раздел "${categoryTitle}" и все его товары?`)) {
      contentData.categories.splice(selectedCategoryIndex, 1);
      selectedCategoryIndex = 0;
      openItemId = null;
      markDirty();
      render();
    }
    return;
  }

  // Добавление товара
  if (action === 'add-item') {
    if (!contentData.categories[selectedCategoryIndex].items) {
      contentData.categories[selectedCategoryIndex].items = [];
    }
    contentData.categories[selectedCategoryIndex].items.push({
      name: 'Новая позиция',
      desc: '',
      price: '0 р.',
      image: ''
    });
    openItemId = `${selectedCategoryIndex}:${contentData.categories[selectedCategoryIndex].items.length - 1}`;
    markDirty();
    render();
    return;
  }

  // Удаление товара
  if (action === 'del-item') {
    const itemIndex = parseInt(target.getAttribute('data-i'), 10);
    if (confirm('Удалить эту позицию?')) {
      contentData.categories[selectedCategoryIndex].items.splice(itemIndex, 1);
      openItemId = null;
      markDirty();
      render();
    }
    return;
  }

  // Сохранение изменений
  if (action === 'save') {
    const saveButton = $('#saveBtn');
    saveButton.disabled = true;
    saveButton.textContent = 'Сохранение...';

    try {
      const response = await fetch('/admin/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentData)
      });

      if (!response.ok) throw new Error(await getErrorMessage(response));

      hasUnsavedChanges = false;
      updateSaveBar();
      showToast('Изменения успешно сохранены!');
    } catch (error) {
      showToast('Ошибка сохранения: ' + error.message);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Сохранить';
    }
  }
});

// ===== ИНИЦИАЛИЗАЦИЯ =====
loadContent();
