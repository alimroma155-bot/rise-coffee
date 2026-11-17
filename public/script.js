// RISE COFFEE — публичный сайт (Warm Minimalism / Organic Luxury)
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
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" width="100%" height="100%" loading="lazy" decoding="async">`
      : '<svg width="42" height="42" style="opacity:0.35"><use href="#cup"/></svg>';

    const itemId = `item-${categoryId}-${itemIndex}`;
    const hasDescription = item.desc && item.desc.trim();
    const newBadge = item.isNew ? '<span class="badge-new">NEW</span>' : '';

    return `
      <button class="it" data-item-id="${itemId}" data-item-json='${escapeHtml(JSON.stringify(item))}' ${hasDescription ? '' : 'disabled'}>
        ${newBadge}
        <span class="th">${imageHtml}</span>
        <span class="tx">
          <span class="n">${escapeHtml(item.name)}</span>
          <span class="p">${escapeHtml(item.price)}</span>
        </span>
      </button>`;
  }

  function renderContactCard(href, title, subtitle, iconId) {
    const isExternal = /^https?:\/\//.test(href);
    const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `
      <a class="cr" href="${escapeHtml(href)}"${attrs}>
        <span class="cr-left">
          <span class="cr-icon"><svg width="19" height="19"><use href="#${iconId}"/></svg></span>
          <span class="cr-text">
            <span class="cr-title">${escapeHtml(title)}</span>
            <span class="cr-sub">${escapeHtml(subtitle)}</span>
          </span>
        </span>
        <svg class="cr-arrow" width="18" height="18"><use href="#arrow-right"/></svg>
      </a>`;
  }

  // ===== РЕНДЕРИНГ СТРАНИЦЫ ИЗ ДАННЫХ =====
  function renderPage(data) {
    const brand = data.brand || {};
    const about = data.about || {};
    const contacts = data.contacts || {};

    document.title = (brand.name || 'RISE') + ' COFFEE';
    $('#brandName').textContent = brand.name || '';
    $('#tagline').textContent = brand.tagline || '';
    $('#address').textContent = brand.address || '';
    $('#foot').textContent = (brand.name || '') + ' COFFEE';

    // Фоновое изображение главного экрана
    const bannerUrl = isSafeUrl(data.banner?.image);
    if (bannerUrl) {
      $('#top').style.backgroundImage = `url("${data.banner.image}")`;
    }

    // Разделы меню без иконок
    const categories = data.categories || [];
    $('#chips').innerHTML = categories
      .map((cat, index) => {
        const isFirst = index === 0;
        return `<button class="chip" data-t="${escapeHtml(cat.id)}"${isFirst ? ' aria-current="true"' : ''}>${escapeHtml(cat.title)}</button>`;
      })
      .join('');

    // Карточки блюд по категориям
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

    // Карточки контактов с иконками
    const contactRows = [];
    const phoneRaw = String(contacts.phone || '').trim();
    const phoneTel = phoneRaw.replace(/[^\d+]/g, '');
    const whatsappNumber = String(contacts.whatsapp || '').replace(/\D/g, '');
    const instagramUsername = String(contacts.instagram || '')
      .replace(/^.*instagram\.com\//i, '')
      .replace(/^@/, '')
      .split(/[/?]/)[0];

    if (phoneTel) {
      contactRows.push(renderContactCard('tel:' + phoneTel, 'Позвонить нам', phoneRaw, 'phone'));
    }

    if (whatsappNumber && contacts.preorderText) {
      const waUrl = `https://wa.me{whatsappNumber}?text=${encodeURIComponent(contacts.preorderText)}`;
      contactRows.push(renderContactCard(waUrl, 'Предзаказ в WhatsApp', 'Забронировать столик', 'whatsapp'));
    }

    if (contacts.wifi && contacts.wifiPassword) {
      contactRows.push(
        `<button class="cr" id="wifiBtn" data-pass="${escapeHtml(contacts.wifiPassword)}">
          <span class="cr-left">
            <span class="cr-icon"><svg width="19" height="19"><use href="#wifi"/></svg></span>
            <span class="cr-text">
              <span class="cr-title">Гостевой Wi-Fi</span>
              <span class="cr-sub">${escapeHtml(contacts.wifi)} • Нажмите для копирования</span>
            </span>
          </span>
          <svg class="cr-arrow" width="18" height="18"><use href="#arrow-right"/></svg>
        </button>`
      );
    }

    if (instagramUsername) {
      contactRows.push(
        renderContactCard(`https://instagram.com{instagramUsername}`, 'Наш Instagram', '@' + instagramUsername, 'insta')
      );
    }

    if (contacts.mapQuery && brand.address) {
      const mapUrl = `https://yandex.ru{encodeURIComponent(contacts.mapQuery)}`;
      contactRows.push(renderContactCard(mapUrl, 'Проложить маршрут', brand.address, 'pin'));
    }

    $('#contactsList').innerHTML = contactRows.join('');
  }
  // ===== МОДАЛЬНОЕ ОКНО ТОВАРА =====
  function openItemModal(item) {
    const modal = $('#itemModal');
    const modalCard = $('#modalCard');
    const modalDesc = $('#modalDesc');

    const imageUrl = isSafeUrl(item.image) ? item.image : '';
    const imageHtml = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" width="100%" height="100%" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:20px">`
      : '<svg width="56" height="56" style="opacity:0.35"><use href="#cup"/></svg>';

    modalCard.innerHTML = `
      <div class="modal-image">${imageHtml}</div>
      <div class="modal-info">
        <h3 class="modal-name" id="modalName">${escapeHtml(item.name)}</h3>
        <p class="modal-price">${escapeHtml(item.price)}</p>
      </div>`;

    modalDesc.textContent = item.desc || '';

    modal.removeAttribute('hidden');
    requestAnimationFrame(() => {
      modal.classList.add('modal-open');
    });
    document.body.style.overflow = 'hidden';

    const closeBtn = $('#modalClose');
    if (closeBtn) {
      setTimeout(() => closeBtn.focus(), 150);
    }
  }

  function closeItemModal() {
    const modal = $('#itemModal');
    modal.classList.remove('modal-open');

    setTimeout(() => {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }, 300);
  }

  // ===== ИНТЕРАКТИВНОСТЬ =====
  function setupInteractivity(data) {
    const toastEl = $('#toast');
    let toastTimer;

    function showToast(message) {
      toastEl.textContent = message;
      toastEl.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('on'), 1800);
    }

    // Плавный скролл к выбранному разделу
    $$('[data-t]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.t);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    function isAtBottom() {
      return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24;
    }

    function observeSections(sel, btnSel, margin) {
      if (!('IntersectionObserver' in window)) return;
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            if (btnSel === '.nb' && isAtBottom()) return;
            $$(btnSel).forEach((btn) => {
              const active = btn.dataset.t === entry.target.id;
              btn.setAttribute('aria-current', active);
            });
          });
        },
        { rootMargin: margin }
      );
      $$(sel).forEach((sec) => io.observe(sec));
    }

    observeSections('[data-cat]', '.chip', '-30% 0px -65% 0px');
    observeSections('[data-main]', '.nb', '-45% 0px -50% 0px');
    // Подсветка контактов внизу и кнопка возврата наверх
    const scrollTopBtn = $('#scrollTopBtn');

    window.addEventListener(
      'scroll',
      () => {
        if (isAtBottom()) {
          const navBtns = $$('.nb');
          if (navBtns.length) {
            navBtns.forEach((b, i) => {
              b.setAttribute('aria-current', i === navBtns.length - 1 ? 'true' : 'false');
            });
          }
        }

        if (scrollTopBtn) {
          const nearBottom =
            window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120;
          scrollTopBtn.classList.toggle('show', nearBottom);
        }
      },
      { passive: true }
    );

    if (scrollTopBtn) {
      scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Открытие и закрытие модального окна товара
    $('#cats').addEventListener('click', (e) => {
      const btn = e.target.closest('.it[data-item-json]');
      if (!btn || btn.disabled) return;
      try {
        const item = JSON.parse(btn.getAttribute('data-item-json'));
        openItemModal(item);
      } catch (err) {}
    });

    const modalEl = $('#itemModal');
    const modalCloseBtn = $('#modalClose');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeItemModal);
    }
    if (modalEl) {
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl || e.target.classList.contains('item-modal-backdrop')) {
          closeItemModal();
        }
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl && !modalEl.hasAttribute('hidden')) {
        closeItemModal();
      }
    });

    // Автоматический статус работы кофейни
    const hours = data.hours || {};
    const openHour = Number(hours.open);
    const closeHour = Number(hours.close);
    const currentHour = new Date().getHours();
    const isOpen = currentHour >= openHour && currentHour < closeHour;
    const badge = $('#status');
    if (badge) {
      badge.classList.toggle('open', isOpen);
      badge.lastChild.textContent = isOpen
        ? `Открыто до ${padZero(closeHour)}:00`
        : `Откроемся в ${padZero(openHour)}:00`;
    }

    // Копирование адреса
    const addrBtn = $('#addr');
    if (addrBtn) {
      addrBtn.addEventListener('click', () => {
        const text = String((data.brand || {}).address || '').replace('•', ',');
        try {
          navigator.clipboard.writeText(text).then(
            () => showToast('Адрес скопирован'),
            () => showToast(text)
          );
        } catch (e) {
          showToast(text);
        }
      });
    }

    // Копирование пароля Wi-Fi
    const wifiBtn = $('#wifiBtn');
    if (wifiBtn) {
      wifiBtn.addEventListener('click', () => {
        const pass = wifiBtn.getAttribute('data-pass') || '';
        try {
          navigator.clipboard.writeText(pass).then(
            () => showToast('Пароль от Wi-Fi скопирован'),
            () => showToast('Пароль: ' + pass)
          );
        } catch (e) {
          showToast('Пароль: ' + pass);
        }
      });
    }
  }

  // ===== ЗАПУСК ПРИЛОЖЕНИЯ =====
  function init(data) {
    renderPage(data);
    setupInteractivity(data);
  }

  const rawData = $('#data').textContent.trim();
  if (rawData.charAt(0) === '{') {
    init(JSON.parse(rawData));
  } else {
    fetch('/api/content')
      .then((res) => res.json())
      .then(init)
      .catch(() => {
        document.body.insertAdjacentHTML(
          'afterbegin',
          '<p style="padding:20px;color:#2b211a;text-align:center">Запустите сайт командой npm start</p>'
        );
      });
  }
})();
