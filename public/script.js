// RISE COFFEE — публичный сайт: рисует страницу из данных (content.json) и включает интерактив
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  const pad = n => (n < 10 ? '0' : '') + n;

  // Разрешаем только свои фото (/uploads/, /img/) и ссылки http(s)
  const safeUrl = u => (/^(\/uploads\/|\/img\/|https?:\/\/)/.test(u || '') ? u : '');
  const cssUrl = u => u.replace(/['"()\\\s]/g, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));

  function isOpenNow(hours, hour) {
    const open = Number(hours.open);
    const close = Number(hours.close);
    if (!Number.isFinite(open) || !Number.isFinite(close)) return false;
    if (open === close) return true; // круглосуточно
    return open < close ? hour >= open && hour < close : hour >= open || hour < close;
  }

  let CATS = []; // нужно окну с подробностями

  // Картинка с запасным вариантом: если файла нет — прячем арку, а не показываем битую иконку
  function showPhoto(figure, img, url) {
    if (!url) return;
    img.onerror = () => { figure.hidden = true; };
    img.src = url;
    figure.hidden = false;
  }

  // ===== 1. ШАБЛОНЫ =====
  function itemHtml(it, ci, ii) {
    const src = safeUrl(it.image);
    const pic = src
      ? `<img src="${esc(src)}" alt="${esc(it.name)}" loading="lazy" decoding="async">`
      : '<svg aria-hidden="true"><use href="#cup"/></svg>';
    return (
      `<button class="it" type="button" data-c="${ci}" data-i="${ii}">` +
        `<span class="th${src ? '' : ' empty'}">${pic}${it.isNew ? '<span class="badge">Новинка</span>' : ''}</span>` +
        '<span class="tx">' +
          `<span class="n">${esc(it.name)}</span>` +
          `<span class="p">${esc(it.price)}</span>` +
        '</span>' +
      '</button>'
    );
  }

  const linkRow = (href, title) =>
    `<a class="cr" href="${esc(href)}" target="_blank" rel="noopener">${esc(title)}</a>`;

  // ===== 2. ОТРИСОВКА =====
  function render(d) {
    const b = d.brand || {};
    const a = d.about || {};
    const c = d.contacts || {};
    const h = d.hours || {};
    CATS = Array.isArray(d.categories) ? d.categories : [];

    // Первый экран
    document.title = (b.name || 'RISE') + ' COFFEE';
    $('#brandName').textContent = b.name || '';
    $('#tagline').textContent = b.tagline || '';
    $('#address').textContent = b.address || '';
    $('#foot').textContent = '© ' + (b.name || '') + ' COFFEE';

    const open = Number(h.open);
    const close = Number(h.close);
    $('#hours').textContent = open === close ? 'Круглосуточно' : `Ежедневно с ${open}:00 до ${close}:00`;

    const phoneRaw = String(c.whatsapp || '').trim();
    const phoneDigits = phoneRaw.replace(/\D/g, '');
    if (phoneDigits) {
      const link = $('#phone');
      link.hidden = false;
      link.href = 'tel:' + phoneDigits;
      link.textContent = phoneRaw;
    }

    if (c.mapQuery) {
      const route = $('#routeBtn');
      route.href = 'https://yandex.ru/maps/?text=' + encodeURIComponent(c.mapQuery);
      route.hidden = false;
    }

    showPhoto($('#heroArch'), $('#heroImg'), safeUrl(d.banner && d.banner.image));

    // Вкладки разделов и сами разделы (читаем d.categories[].items[])
    $('#chips').innerHTML = CATS
      .map((k, i) => `<button class="chip" type="button" data-t="${esc(k.id)}"${i === 0 ? ' aria-current="true"' : ''}>${esc(k.title)}</button>`)
      .join('');

    $('#cats').innerHTML = CATS
      .map((k, ci) => {
        const items = Array.isArray(k.items) ? k.items : [];
        return (
          `<div class="cat" id="${esc(k.id)}" data-cat>` +
            '<div class="cat-head">' +
              `<h2>${esc(k.title)}</h2>` +
              (k.subtitle ? `<p class="sub">${esc(k.subtitle)}</p>` : '') +
            '</div>' +
            (items.length
              ? `<div class="items-grid">${items.map((it, ii) => itemHtml(it, ci, ii)).join('')}</div>`
              : '<p class="soon">Скоро здесь появится меню</p>') +
          '</div>'
        );
      })
      .join('');

    $('#note').hidden = !CATS.some(k => (k.items || []).some(it => String(it.desc || '').trim()));

    // О нас
    $('#aboutTitle').textContent = a.title || 'О нас';
    $('#aboutText').textContent = a.text || '';
    const aboutSrc = safeUrl(a.image);
    showPhoto($('#aboutArch'), $('#aboutImg'), aboutSrc);
    $('#aboutIn').classList.toggle('no-photo', !aboutSrc);
    $('#facts').innerHTML = (a.facts || [])
      .filter(f => f.title || f.text)
      .map(f => `<div class="f"><b>${esc(f.title)}</b><span>${esc(f.text)}</span></div>`)
      .join('');

    // Контакты
    const rows = [];
    const insta = String(c.instagram || '').replace(/^.*instagram\.com\//i, '').replace(/^@/, '').split(/[/?]/)[0];
    if (phoneDigits) rows.push(linkRow('https://wa.me/' + phoneDigits, 'WhatsApp'));
    if (insta) rows.push(linkRow('https://instagram.com/' + encodeURIComponent(insta), 'Instagram'));
    if (c.mapQuery) rows.push(linkRow('https://yandex.ru/maps/?text=' + encodeURIComponent(c.mapQuery), 'Проложить маршрут'));
    $('#contactsList').innerHTML = rows.join('');
    $('#contacts').hidden = !rows.length;
  }

  // ===== 3. ИНТЕРАКТИВ =====
  function wire(d) {
    const toast = $('#toast');
    const dlg = $('#dlg');
    const chips = $('#chips');
    let timer;

    function say(msg) {
      toast.textContent = msg;
      toast.classList.add('on');
      clearTimeout(timer);
      timer = setTimeout(() => toast.classList.remove('on'), 1800);
    }

    // Прокрутка: вкладки, кнопка «Смотреть меню», «наверх»
    $$('[data-t]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.t);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Подсветка вкладки текущего раздела
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          $$('.chip').forEach(b => {
            const on = b.dataset.t === e.target.id;
            b.setAttribute('aria-current', String(on));
            if (on) chips.scrollTo({ left: b.offsetLeft - 20, behavior: 'smooth' });
          });
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      $$('[data-cat]').forEach(s => io.observe(s));
    }

    // Кнопка «наверх»
    const up = $('#up');
    const onScroll = () => up.classList.toggle('on', window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Окно с подробностями блюда
    $('#cats').addEventListener('click', e => {
      const card = e.target.closest('.it');
      if (!card || !dlg.showModal) return;
      const it = (CATS[Number(card.dataset.c)] || {}).items?.[Number(card.dataset.i)];
      if (!it) return;

      const src = safeUrl(it.image);
      $('#dlgImg').style.backgroundImage = src ? `url("${cssUrl(src)}")` : '';
      $('#dlgBody').classList.toggle('no-img', !src);
      $('#dlgName').textContent = it.name || '';
      $('#dlgPrice').textContent = it.price || '';
      $('#dlgDesc').textContent = it.desc || '';
      $('#dlgDesc').hidden = !String(it.desc || '').trim();
      dlg.showModal();
    });
    dlg.addEventListener('click', e => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });

    // Статус «открыто / закрыто»
    const h = d.hours || {};
    const open = isOpenNow(h, new Date().getHours());
    $('#status').classList.toggle('open', open);
    $('#status span').textContent = open
      ? 'Открыто до ' + pad(Number(h.close)) + ':00'
      : 'Откроемся в ' + pad(Number(h.open)) + ':00';

    // Копирование адреса
    $('#addr').addEventListener('click', () => {
      const text = String((d.brand || {}).address || '').replace('•', ',');
      if (!navigator.clipboard) return say(text);
      navigator.clipboard.writeText(text).then(() => say('Адрес скопирован'), () => say(text));
    });
  }

  function start(d) {
    render(d);
    wire(d);
  }

  // ===== 4. ЗАПУСК =====
  function loadFromApi() {
    fetch('/api/content')
      .then(r => r.json())
      .then(start)
      .catch(() => {
        document.body.insertAdjacentHTML(
          'afterbegin',
          '<p style="padding:20px;text-align:center">Запустите сайт командой npm start</p>'
        );
      });
  }

  const raw = ($('#data').textContent || '').trim();
  if (raw.charAt(0) === '{') {
    try { start(JSON.parse(raw)); } catch (e) { loadFromApi(); }
  } else {
    loadFromApi();
  }
})();