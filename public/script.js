// RISE COFFEE — публичный сайт: берёт данные из админки, рисует страницу и включает интерактив
(function () {
  'use strict';

  // ===== УТИЛИТЫ =====
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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

  function padZero(num) {
    return num < 10 ? '0' + num : String(num);
  }

  function isSafeUrl(url) {
    return /^(\/uploads\/|https?:\/\/)/.test(url || '');
  }

  // ===== РЕНДЕРИНГ ЭЛЕМЕНТОВ МЕНЮ =====
  function renderMenuItem(item, categoryId, itemIndex) {
    const imageUrl = isSafeUrl(item.image) ? item.image : '';
    const imageHtml = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" width="100%" height="100%" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover">`
      : '<svg width="40" height="40" style="color:var(--wood);opacity:0.3"><use href="#cup"/></svg>';

    const itemId = `item-${categoryId}-${itemIndex}`;
    const hasDescription = item.desc && item.desc.trim();

    return `
      <button class="it" data-item-id="${itemId}" aria-expanded="false" ${hasDescription ? '' : 'disabled'}>
        <span class="th">${imageHtml}</span>
        <span class="tx">
          <span class="n">${escapeHtml(item.name)}</span>
          <span class="p">${escapeHtml(item.price)}</span>
        </span>
        ${hasDescription ? `
          <div class="it-detail" hidden>
            <p class="it-desc">${escapeHtml(item.desc)}</p>
          </div>
        ` : ''}
      </button>`;
  }

  function renderContactLink(href, title, subtitle) {
    const isExternal = /^https?:\/\//.test(href);
    const attrs = isExternal ? ' target="_blank" rel="noopener"' : '';
    return `
      <a class="cr" href="${escapeHtml(href)}"${attrs}>
        <span>
          ${escapeHtml(title)}
          <small>${escapeHtml(subtitle)}</small>
        </span>
        <svg width="20" height="20"><use href="#go"/></svg>
      </a>`;
  }

  // ===== РЕНДЕРИНГ СТРАНИЦЫ ИЗ ДАННЫХ =====
  function renderPage(data) {
    const brand = data.brand || {};
    const about = data.about || {};
    const theme = data.theme || {};
    const contacts = data.contacts || {};

    // Применяем пользовательскую тему
    ['ink', 'milk', 'wood'].forEach((key) => {
      if (/^#[0-9a-f]{6}$/i.test(theme[key])) {
        document.documentElement.style.setProperty('--' + key, theme[key]);
      }
    });

    // Заполняем основные элементы
    document.title = (brand.name || 'RISE') + ' COFFEE';
    $('#brandName').textContent = brand.name || '';
    $('#tagline').textContent = brand.tagline || '';
    $('#address').textContent = brand.address || '';
    $('#foot').textContent = (brand.name || '') + ' COFFEE';

    // Фоновое изображение шапки
    const bannerUrl = isSafeUrl(data.banner?.image);
    if (bannerUrl) {
      const heroStyle = $('#top').style;
      heroStyle.backgroundImage = `linear-gradient(rgba(22,21,19,.62),rgba(22,21,19,.82)),url("${data.banner.image}")`;
      heroStyle.backgroundSize = 'cover';
      heroStyle.backgroundPosition = 'center';
    }

    // Рендерим категории меню
    const categories = data.categories || [];
    $('#chips').innerHTML = categories
      .map((cat, index) => {
        const isFirst = index === 0;
        return `<button class="chip" data-t="${escapeHtml(cat.id)}"${isFirst ? ' aria-current="true"' : ''}>${escapeHtml(cat.title)}</button>`;
      })
      .join('');

    $('#cats').innerHTML = categories
      .map((cat) => {
        const items = cat.items || [];
        const itemsHtml = items.length
          ? items.map((item, idx) => renderMenuItem(item, cat.id, idx)).join('')
          : '<p class="sub">Скоро здесь появится меню</p>';

        return `
          <div class="cat" id="${escapeHtml(cat.id)}" data-cat>
            <h2>${escapeHtml(cat.title)}</h2>
            ${cat.subtitle ? `<p class="sub">${escapeHtml(cat.subtitle)}</p>` : ''}
            <div class="items-grid">${itemsHtml}</div>
          </div>`;
      })
      .join('');

    // Блок "О нас"
    $('#aboutTitle').textContent = about.title || 'О нас';
    $('#aboutText').textContent = about.text || '';
    $('#facts').innerHTML = (about.facts || [])
      .filter((fact) => fact.title || fact.text)
      .map((fact) => `<div class="f"><b>${escapeHtml(fact.title)}</b><span>${escapeHtml(fact.text)}</span></div>`)
      .join('');

    // Контакты
    const contactRows = [];
    const phoneRaw = String(contacts.phone || '').trim();
    const phoneTel = phoneRaw.replace(/[^\d+]/g, '');
    const whatsappNumber = String(contacts.whatsapp || '').replace(/\D/g, '');
    const instagramUsername = String(contacts.instagram || '')
      .replace(/^.*instagram\.com\//i, '')
      .replace(/^@/, '')
      .split(/[/?]/)[0];

    if (phoneTel) {
      contactRows.push(renderContactLink('tel:' + phoneTel, 'Позвонить нам', phoneRaw));
    }

    if (whatsappNumber && contacts.preorderText) {
      const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(contacts.preorderText)}`;
      contactRows.push(renderContactLink(waUrl, 'Предзаказ через WhatsApp', 'Забронируйте столик'));
    }

    if (contacts.wifi && contacts.wifiPassword) {
      contactRows.push(
        `<button class="cr" id="wifiBtn" data-pass="${escapeHtml(contacts.wifiPassword)}">
          <span>Wi-Fi<small>${escapeHtml(contacts.wifi)}</small></span>
          <svg width="20" height="20"><use href="#go"/></svg>
        </button>`
      );
    }

    if (instagramUsername) {
      contactRows.push(
        renderContactLink(`https://instagram.com/${instagramUsername}`, 'Наш Instagram', '@' + instagramUsername)
      );
    }

    if (contacts.mapQuery && brand.address) {
      const mapUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(contacts.mapQuery)}`;
      contactRows.push(renderContactLink(mapUrl, 'Проложить маршрут', brand.address));
    }

    $('#contactsList').innerHTML = contactRows.join('');
  }

  // ===== ИНТЕРАКТИВНОСТЬ =====
  function setupInteractivity(data) {
    const toastEl = $('#toast');
    const chipsEl = $('#chips');
    let toastTimer;

    function showToast(message) {
      toastEl.textContent = message;
      toastEl.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('on'), 1800);
    }

    // Адаптация ширины чипов для мобильных
    function adjustChipsWidth() {
      if (!chipsEl) return;
      const buttons = $$('.chip');
      if (window.innerWidth >= 768) {
        buttons.forEach((btn) => {
          btn.style.width = '';
          btn.style.flex = '';
        });
        return;
      }
      const sheet = $('.sheet');
      const containerWidth = sheet ? sheet.clientWidth : document.documentElement.clientWidth;
      const chipWidth = Math.floor((containerWidth - 60) / 4);
      buttons.forEach((btn) => {
        btn.style.flex = `0 0 ${chipWidth}px`;
        btn.style.width = `${chipWidth}px`;
      });
    }

    adjustChipsWidth();
    window.addEventListener('resize', adjustChipsWidth);

    // Навигация по якорям
    $$('[data-t]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.t);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Раскрытие карточек товаров
    $$('.it[data-item-id]').forEach((itemButton) => {
      itemButton.addEventListener('click', () => {
        const isExpanded = itemButton.getAttribute('aria-expanded') === 'true';
        const detailEl = itemButton.querySelector('.it-detail');
        
        if (!detailEl) return;

        if (isExpanded) {
          itemButton.setAttribute('aria-expanded', 'false');
          detailEl.hidden = true;
        } else {
          itemButton.setAttribute('aria-expanded', 'true');
          detailEl.hidden = false;
        }
      });
    });

    // Определение достижения конца страницы
    function isAtBottom() {
      return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24;
    }

    // Отслеживание видимых секций (Intersection Observer)
    function observeSections(selector, buttonSelector, margin, onVisible) {
      if (!('IntersectionObserver' in window)) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            if (buttonSelector === '.nb' && isAtBottom()) return;

            $$(buttonSelector).forEach((btn, index) => {
              const isActive = btn.dataset.t === entry.target.id;
              btn.setAttribute('aria-current', String(isActive));
              if (isActive && onVisible) {
                onVisible(btn, index);
              }
            });
          });
        },
        { rootMargin: margin }
      );

      $$(selector).forEach((section) => observer.observe(section));
    }

    // Отслеживание категорий меню
    observeSections('[data-cat]', '.chip', '-30% 0px -65% 0px', (activeBtn, index) => {
      try {
        const pageStartIndex = Math.floor(index / 4) * 4;
        const targetButton = $$('.chip')[pageStartIndex] || activeBtn;
        chipsEl.scrollTo({ left: targetButton.offsetLeft - 20, behavior: 'smooth' });
      } catch (err) {
        console.warn('Chip scroll failed:', err);
      }
    });

    // Отслеживание основных секций
    observeSections('[data-main]', '.nb', '-45% 0px -50% 0px');

    // Подсветка последней кнопки навигации при достижении конца
    window.addEventListener('scroll', () => {
      if (!isAtBottom()) return;
      const navButtons = $$('.nb');
      if (!navButtons.length) return;
      navButtons.forEach((btn, index) => {
        btn.setAttribute('aria-current', String(index === navButtons.length - 1));
      });
    }, { passive: true });

    // Индикатор режима работы (открыто/закрыто)
    const hours = data.hours || {};
    const openHour = Number(hours.open) || 0;
    const closeHour = Number(hours.close) || 24;
    const currentHour = new Date().getHours();
    const isOpen = currentHour >= openHour && currentHour < closeHour;

    const statusBadge = $('#status');
    statusBadge.classList.toggle('open', isOpen);
    statusBadge.lastChild.textContent = isOpen
      ? `Открыто до ${padZero(closeHour)}:00`
      : `Откроемся в ${padZero(openHour)}:00`;

    // Копирование адреса
    $('#addr').addEventListener('click', () => {
      const addressText = String(brand.address || '').replace('•', ',');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(addressText).then(
          () => showToast('Адрес скопирован'),
          () => showToast(addressText)
        );
      } else {
        showToast(addressText);
      }
    });

    // Копирование пароля Wi-Fi
    const wifiButton = $('#wifiBtn');
    if (wifiButton) {
      wifiButton.addEventListener('click', () => {
        const password = wifiButton.getAttribute('data-pass') || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(password).then(
            () => showToast('Пароль от Wi-Fi скопирован'),
            () => showToast('Пароль: ' + password)
          );
        } else {
          showToast('Пароль: ' + password);
        }
      });
    }
  }

  // ===== ЗАПУСК ПРИЛОЖЕНИЯ =====
  function init(data) {
    renderPage(data);
    setupInteractivity(data);
  }

  // Загрузка данных
  const dataScript = $('#data');
  const inlineData = dataScript ? dataScript.textContent.trim() : '';

  if (inlineData && inlineData.charAt(0) === '{') {
    try {
      init(JSON.parse(inlineData));
    } catch (err) {
      console.error('Ошибка парсинга встроенных данных:', err);
    }
  } else {
    fetch('/api/content')
      .then((response) => response.json())
      .then(init)
      .catch(() => {
        document.body.insertAdjacentHTML(
          'afterbegin',
          '<p style="padding:20px;color:#fff;text-align:center">Запустите сайт командой npm start</p>'
        );
      });
  }
})();
