/* zkBricks — site interactions. No dependencies. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------- Theme ---------- */

  function effectiveTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  $$('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      window.dispatchEvent(new CustomEvent('themechange'));
    });
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    window.dispatchEvent(new CustomEvent('themechange'));
  });

  /* ---------- Header: scrolled state, hide on scroll down ---------- */

  var header = $('[data-header]');
  var lastY = window.scrollY;
  function onScrollHeader() {
    var y = window.scrollY;
    if (!header) return;
    header.classList.toggle('is-scrolled', y > 8);
    var menuOpen = root.classList.contains('menu-open');
    header.classList.toggle('is-hidden', !menuOpen && y > 400 && y > lastY + 4);
    if (y < lastY - 4 || y < 400) header.classList.remove('is-hidden');
    lastY = y;
  }

  /* ---------- Mobile menu ---------- */

  var menuBtn = $('[data-menu-toggle]');
  if (menuBtn) {
    var setMenu = function (open) {
      root.classList.toggle('menu-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    menuBtn.addEventListener('click', function () { setMenu(!root.classList.contains('menu-open')); });
    $$('#site-nav a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* ---------- Count-up numbers ---------- */

  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (!target || reduceMotion) return;
    var start = performance.now();
    var dur = 1600;
    function frame(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(frame);
    }
    el.textContent = '0';
    requestAnimationFrame(frame);
  }

  /* ---------- Reveal on scroll ---------- */

  function reveal(el) {
    el.classList.add('is-in');
    $$('[data-count]', el).forEach(countUp);
    if (el.hasAttribute('data-count')) countUp(el);
  }

  var revealables = $$('[data-reveal], .person');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          reveal(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Reading progress ---------- */

  var progress = $('[data-progress]');
  var article = $('[data-toc-content]');
  function updateProgress() {
    if (!progress || !article) return;
    var r = article.getBoundingClientRect();
    var total = r.height - window.innerHeight * 0.6;
    var p = Math.max(0, Math.min(1, -r.top / Math.max(1, total)));
    progress.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }

  /* ---------- Scroll loop ---------- */

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      onScrollHeader();
      updateProgress();
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Post: table of contents ---------- */

  (function toc() {
    var tocRoot = $('[data-toc-root]');
    if (!tocRoot) return;
    var container = $('[data-toc-container]', tocRoot);
    var list = $('[data-toc-list]', tocRoot);
    var toggle = $('[data-toc-toggle]', tocRoot);
    var content = $('[data-toc-content]', tocRoot);
    if (!container || !list || !toggle || !content) return;

    var headings = $$('h2, h3', content).filter(function (h) {
      return h.textContent.trim().length > 0 && !h.closest('.footnotes');
    });
    if (!headings.length) {
      container.hidden = true;
      tocRoot.classList.add('no-toc');
      return;
    }

    var used = {};
    function slugify(text) {
      return text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'section';
    }
    var ul = document.createElement('ul');
    ul.className = 'toc-items';
    var links = {};
    headings.forEach(function (h) {
      if (!h.id || used[h.id]) {
        var base = slugify(h.textContent), id = base, i = 2;
        while (used[id] || (document.getElementById(id) && document.getElementById(id) !== h)) id = base + '-' + i++;
        h.id = id;
      }
      used[h.id] = true;
      var li = document.createElement('li');
      li.className = 'toc-item' + (h.tagName === 'H3' ? ' is-child' : '');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.trim();
      links[h.id] = a;
      li.appendChild(a);
      ul.appendChild(li);
    });
    list.appendChild(ul);

    function setCollapsed(c) {
      container.classList.toggle('is-collapsed', c);
      toggle.setAttribute('aria-expanded', String(!c));
    }
    toggle.addEventListener('click', function () { setCollapsed(!container.classList.contains('is-collapsed')); });
    if (window.matchMedia('(max-width: 999px)').matches) setCollapsed(true);

    var current = null;
    function setActive() {
      var best = headings[0];
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= 160) best = headings[i];
        else break;
      }
      if (best.id === current) return;
      if (current && links[current]) { links[current].classList.remove('is-active'); links[current].removeAttribute('aria-current'); }
      current = best.id;
      links[current].classList.add('is-active');
      links[current].setAttribute('aria-current', 'location');
    }
    window.addEventListener('scroll', function () { requestAnimationFrame(setActive); }, { passive: true });
    setActive();
  })();
})();
