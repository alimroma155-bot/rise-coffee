// RISE COFFEE — публичный сайт: берёт данные из админки, рисует страницу и включает интерактив
(function () {
  var $ = function (s) {
    return document.querySelector(s);
  };
  var $$ = function (s) {
    return Array.from(document.querySelectorAll(s));
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function safeUrl(u) {
    return /^(\/uploads\/|https?:\/\/)/.test(u || "") ? u : "";
  }

  // ===== 1. ОДНА ПОЗИЦИЯ МЕНЮ =====
  function itemHtml(it) {
    var src = safeUrl(it.image);
    var pic = src
      ? '<img src="' +
        esc(src) +
        '" alt="' +
        esc(it.name) +
        '" width="100%" height="100%" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover">'
      : '<svg width="40" height="40" style="color:var(--wood);opacity:0.3"><use href="#cup"/></svg>';

    return (
      '<div class="it">' +
        '<span class="th">' + pic + '</span>' +
        '<span class="tx">' +
          '<span class="n">' + esc(it.name) + '</span>' +
          '<span class="p">' + esc(it.price) + '</span>' +
        '</span>' +
      '</div>'
    );
  }

  function linkRow(href, title, sub) {
    return (
      '<a class="cr" href="' +
      esc(href) +
      '" target="_blank" rel="noopener"><span>' +
      esc(title) +
      "<small>" +
      esc(sub) +
      '</small></span><svg width="20" height="20"><use href="#go"/></svg></a>'
    );
  }

  // ===== 2. ОТРИСОВКА СТРАНИЦЫ ИЗ ДАННЫХ =====
  function render(d) {
    var b = d.brand || {},
      a = d.about || {},
      t = d.theme || {},
      c = d.contacts || {};

    ["ink", "milk", "wood"].forEach(function (k) {
      if (/^#[0-9a-f]{6}$/i.test(t[k])) {
        document.documentElement.style.setProperty("--" + k, t[k]);
      }
    });

    document.title = (b.name || "RISE") + " COFFEE";
    $("#brandName").textContent = b.name || "";
    $("#tagline").textContent = b.tagline || "";
    $("#address").textContent = b.address || "";
    $("#foot").textContent = (b.name || "") + " COFFEE";

    var bg = safeUrl(d.banner && d.banner.image);
    if (bg) {
      var st = $("#top").style;
      st.backgroundImage =
        'linear-gradient(rgba(22,21,19,.62),rgba(22,21,19,.82)),url("' +
        bg +
        '")';
      st.backgroundSize = "cover";
      st.backgroundPosition = "center";
    }

    var cats = d.categories || [];
    $("#chips").innerHTML = cats
      .map(function (k, i) {
        return (
          '<button class="chip" data-t="' +
          esc(k.id) +
          '"' +
          (i === 0 ? ' aria-current="true"' : "") +
          ">" +
          esc(k.title) +
          "</button>"
        );
      })
      .join("");

    $("#cats").innerHTML = cats
      .map(function (k) {
        var items = k.items || [];
        return (
          '<div class="cat" id="' + esc(k.id) + '" data-cat>' +
            '<h2>' + esc(k.title) + '</h2>' +
            (k.subtitle ? '<p class="sub">' + esc(k.subtitle) + '</p>' : '') +
            '<div class="items-grid">' +
              (items.length
                ? items.map(itemHtml).join("")
                : '<p class="sub">Скоро здесь появится меню</p>') +
            '</div>' +
          '</div>'
        );
      })
      .join("");

    $("#aboutTitle").textContent = a.title || "О нас";
    $("#aboutText").textContent = a.text || "";
    $("#facts").innerHTML = (a.facts || [])
      .filter(function (f) {
        return f.title || f.text;
      })
      .map(function (f) {
        return (
          '<div class="f"><b>' +
          esc(f.title) +
          "</b><span>" +
          esc(f.text) +
          "</span></div>"
        );
      })
      .join("");

    var rows = [];
    var phone = String(c.whatsapp || "").replace(/\D/g, "");
    var insta = String(c.instagram || "")
      .replace(/^.*instagram\.com\//i, "")
      .replace(/^@/, "")
      .split(/[/?]/);

    if (phone) {
      rows.push(linkRow("https://wa.me" + phone, "WhatsApp", "Написать нам"));
    }
    if (insta) {
      rows.push(
        linkRow(
          "https://instagram.com" + encodeURIComponent(insta),
          "Instagram",
          "Наши новости"
        )
      );
    }
    if (c.mapQuery) {
      rows.push(
        linkRow(
          "https://yandex.ru" + encodeURIComponent(c.mapQuery),
          "Проложить маршрут",
          b.address || ""
        )
      );
    }

    $("#contactsList").innerHTML = rows.join("");
  }

  // ===== 3. ИНТЕРАКТИВ =====
  function wire(d) {
    var toast = $("#toast"),
      chips = $("#chips"),
      tt;

    function say(m) {
      toast.textContent = m;
      toast.classList.add("on");
      clearTimeout(tt);
      tt = setTimeout(function () {
        toast.classList.remove("on");
      }, 1800);
    }

    function fitChips() {
      if (!chips) return;
      var btns = $$(".chip");
      if (window.innerWidth >= 768) {
        btns.forEach(function (c) {
          c.style.width = "";
          c.style.flex = "";
        });
        return;
      }
      var sheet = $(".sheet");
      var w = sheet ? sheet.clientWidth : document.documentElement.clientWidth;
      var exactW = Math.floor((w - 60) / 4);
      btns.forEach(function (c) {
        c.style.flex = "0 0 " + exactW + "px";
        c.style.width = exactW + "px";
      });
    }

    fitChips();
    window.addEventListener("resize", fitChips);

    $$("[data-t]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var s = document.getElementById(btn.dataset.t);
        if (s) s.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    function spy(sel, btnSel, margin, after) {
      if (!("IntersectionObserver" in window)) return;
      var io = new IntersectionObserver(
        function (es) {
          es.forEach(function (e) {
            if (!e.isIntersecting) return;
            $$(btnSel).forEach(function (b, idx) {
              var on = b.dataset.t === e.target.id;
              b.setAttribute("aria-current", on);
              if (on && after) after(b, idx);
            });
          });
        },
        { rootMargin: margin }
      );
      $$(sel).forEach(function (s) {
        io.observe(s);
      });
    }

    spy("[data-cat]", ".chip", "-30% 0px -65% 0px", function (b, idx) {
      try {
        var pageStartIdx = Math.floor(idx / 4) * 4;
        var targetBtn = $$(".chip")[pageStartIdx] || b;
        chips.scrollTo({ left: targetBtn.offsetLeft - 20, behavior: "smooth" });
      } catch (e) {}
    });
    spy("[data-main]", ".nb", "-45% 0px -50% 0px");

    var h = d.hours || {},
      o = Number(h.open),
      c = Number(h.close);
    var hour = new Date().getHours(),
      isOpen = hour >= o && hour < c;
    var badge = $("#status");
    badge.classList.toggle("open", isOpen);
    badge.lastChild.textContent = isOpen
      ? "Открыто до " + pad(c) + ":00"
      : "Откроемся в " + pad(o) + ":00";

    $("#addr").addEventListener("click", function () {
      var text = String((d.brand || {}).address || "").replace("•", ",");
      try {
        navigator.clipboard.writeText(text).then(
          function () {
            say("Адрес скопирован");
          },
          function () {
            say(text);
          }
        );
      } catch (e) {
        say(text);
      }
    });
  }

  // ===== 4. ЗАПУСК =====
  function start(d) {
    render(d);
    wire(d);
  }

  var raw = $("#data").textContent.trim();
  if (raw.charAt(0) === "{") {
    start(JSON.parse(raw));
  } else {
    fetch("/api/content")
      .then(function (r) {
        return r.json();
      })
      .then(start)
      .catch(function () {
        document.body.insertAdjacentHTML(
          "afterbegin",
          '<p style="padding:20px;color:#fff;text-align:center">Запустите сайт командой npm start</p>'
        );
      });
  }
})();
