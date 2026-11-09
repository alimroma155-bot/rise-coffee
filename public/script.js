// RISE COFFEE — публичный сайт: берёт данные из админки, рисует страницу и включает интерактив
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };

  // Защита: любой текст из админки превращается в безопасный текст страницы
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // Разрешаем только свои загруженные фото и обычные ссылки http(s)
  function safeUrl(u) { return /^(\/uploads\/|https?:\/\/)/.test(u || '') ? u : ''; }

  // ===== 1. ОДНА ПОЗИЦИЯ МЕНЮ =====
  function itemHtml(it) {
    var src = safeUrl(it.image);
    var pic = src
      ? '<img src="' + esc(src) + '" alt="' + esc(it.name) + '" width="68" height="68" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover">'
      : '<svg width="30" height="30"><use href="#cup"/></svg>';
    return '<div class="it"><span class="th">' + pic + '</span><span class="tx"><span class="n">' + esc(it.name) + '</span>' +
      (it.desc ? '<span class="ds">' + esc(it.desc) + '</span>' : '') +
      '</span><span class="p">' + esc(it.price) + '</span></div>';
  }

  // Строка в блоке «Контакты»
  function linkRow(href, title, sub) {
    return '<a class="cr" href="' + esc(href) + '" target="_blank" rel="noopener"><span>' + esc(title) +
      '<small>' + esc(sub) + '</small></span><svg width="20" height="20"><use href="#go"/></svg></a>';
  }

  // ===== 2. ОТРИСОВКА СТРАНИЦЫ ИЗ ДАННЫХ =====
  function render(d) {
    var b = d.brand || {}, a = d.about || {}, t = d.theme || {}, c = d.contacts || {};

    // Цвета сайта (меняются в админке)
    ['ink', 'milk', 'wood'].forEach(function (k) {
      if (/^#[0-9a-f]{6}$/i.test(t[k])) document.documentElement.style.setProperty('--' + k, t[k]);
    });

    // Шапка
    document.title = (b.name || 'RISE') + ' COFFEE';
    $('#brandName').textContent = b.name || '';
    $('#tagline').textContent = b.tagline || '';
    $('#address').textContent = b.address || '';
    $('#foot').textContent = (b.name || '') + ' COFFEE';

    // Фото в шапке (если загружено): поверх него тёмная вуаль для читаемости текста
    var bg = safeUrl(d.banner && d.banner.image);
    if (bg) {
      var st = $('#top').style;
      st.backgroundImage = 'linear-gradient(rgba(22,21,19,.62),rgba(22,21,19,.82)),url("' + bg + '")';
      st.backgroundSize = 'cover';
      st.backgroundPosition = 'center';
    }

    // Вкладки и разделы меню
    var cats = d.categories || [];
    $('#chips').innerHTML = cats.map(function (k, i) {
      return '<button class="chip" data-t="' + esc(k.id) + '"' + (i === 0 ? ' aria-current="true"' : '') + '>' + esc(k.title) + '</button>';
    }).join('');
    $('#cats').innerHTML = cats.map(function (k) {
      var items = k.items || [];
      return '<div class="cat" id="' + esc(k.id) + '" data-cat><h2>' + esc(k.title) + '</h2>' +
        (k.subtitle ? '<p class="sub">' + esc(k.subtitle) + '</p>' : '') +
        (items.length ? items.map(itemHtml).join('') : '<p class="sub">Скоро здесь появится меню</p>') +
        '</div>';
    }).join('');

    // О нас
    $('#aboutTitle').textContent = a.title || 'О нас';
    $('#aboutText').textContent = a.text || '';
    $('#facts').innerHTML = (a.facts || []).filter(function (f) { return f.title || f.text; }).map(function (f) {
      return '<div class="f"><b>' + esc(f.title) + '</b><span>' + esc(f.text) + '</span></div>';
    }).join('');

    // Контакты: строка показывается, только если поле заполнено в админке
    var rows = [];
    var phone = String(c.whatsapp || '').replace(/\D/g, '');
    var insta = String(c.instagram || '').replace(/^.*instagram\.com\//i, '').replace(/^@/, '').split(/[/?]/)[0];
    if (phone) rows.push(linkRow('https://wa.me/' + phone, 'WhatsApp', 'Написать нам'));
    if (insta) rows.push(linkRow('https://instagram.com/' + encodeURIComponent(insta), 'Instagram', 'Наши новости'));
    if (c.mapQuery) rows.push(linkRow('https://yandex.ru/maps/?text=' + encodeURIComponent(c.mapQuery), 'Проложить маршрут', b.address || ''));
    $('#foot').insertAdjacentHTML('beforebegin', rows.join(''));
  }

  // ===== 3. ИНТЕРАКТИВ =====
  function wire(d) {
    var toast = $('#toast'), chips = $('#chips'), tt;

    // Уведомление на 1,8 секунды
    function say(m) {
      toast.textContent = m;
      toast.classList.add('on');
      clearTimeout(tt);
      tt = setTimeout(function () { toast.classList.remove('on'); }, 1800);
    }

    // Плавный скролл к разделу по кнопкам (вкладки меню и нижняя навигация)
    $$('[data-t]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = document.getElementById(btn.dataset.t);
        if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Подсветка активного раздела при прокрутке
    function spy(sel, btnSel, margin, after) {
      if (!('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          $$(btnSel).forEach(function (b) {
            var on = b.dataset.t === e.target.id;
            b.setAttribute('aria-current', on);
            if (on && after) after(b);
          });
        });
      }, { rootMargin: margin });
      $$(sel).forEach(function (s) { io.observe(s); });
    }
    spy('[data-cat]', '.chip', '-30% 0px -65% 0px', function (b) {
      try { chips.scrollTo({ left: b.offsetLeft - 20, behavior: 'smooth' }); } catch (e) {}
    });
    spy('[data-main]', '.nb', '-45% 0px -50% 0px');

    // Бейдж «Открыто / Закрыто» по часам работы из админки
    var h = d.hours || {}, o = Number(h.open), c = Number(h.close);
    var hour = new Date().getHours(), isOpen = hour >= o && hour < c;
    var badge = $('#status');
    badge.classList.toggle('open', isOpen);
    badge.lastChild.textContent = isOpen ? 'Открыто до ' + pad(c) + ':00' : 'Откроемся в ' + pad(o) + ':00';

    // Копирование адреса по нажатию
    $('#addr').addEventListener('click', function () {
      var text = String((d.brand || {}).address || '').replace('•', ',');
      try {
        navigator.clipboard.writeText(text).then(
          function () { say('Адрес скопирован'); },
          function () { say(text); }
        );
      } catch (e) { say(text); }
    });
  }

  // ===== 4. ЗАПУСК =====
  function start(d) { render(d); wire(d); }

  var raw = $('#data').textContent.trim();
  if (raw.charAt(0) === '{') {
    start(JSON.parse(raw)); // данные уже вставлены сервером
  } else {
    // Страница открыта не через сервер: пробуем запросить данные отдельно
    fetch('/api/content').then(function (r) { return r.json(); }).then(start).catch(function () {
      document.body.insertAdjacentHTML('afterbegin', '<p style="padding:20px;color:#fff">Запустите сайт командой npm start</p>');
    });
  }
})();
