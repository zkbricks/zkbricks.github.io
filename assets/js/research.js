/* zkBricks — research page: publication wall, area filters, search. */
(function () {
  'use strict';

  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var wall = document.querySelector('[data-wall]');
  var tip = document.querySelector('[data-wall-tip]');
  var chips = $$('.chip[data-area]');
  var search = document.querySelector('[data-pub-search]');
  var countEl = document.querySelector('[data-pub-count]');
  var emptyEl = document.querySelector('[data-pub-empty]');
  var pubs = $$('.pub');
  var groups = $$('[data-year-group]');
  var bricks = wall ? $$('.brick', wall) : [];

  var wallScroll = document.querySelector('.wall-scroll');
  if (wallScroll) {
    // Show recent years first when the larger towers need horizontal scrolling.
    wallScroll.scrollLeft = wallScroll.scrollWidth - wallScroll.clientWidth;
    wallScroll.addEventListener('scroll', function () {
      var active = document.activeElement;
      if (active && wall.contains(active) && active.classList.contains('brick')) {
        var r = active.getBoundingClientRect();
        var viewport = wallScroll.getBoundingClientRect();
        if (r.right > viewport.left && r.left < viewport.right) { showTip(active); return; }
      }
      hideTip();
    }, { passive: true });
  }

  /* ----- Tooltip ----- */
  function showTip(b) {
    if (!tip) return;
    tip.querySelector('.wall-tip-meta').textContent = b.getAttribute('data-meta');
    tip.querySelector('.wall-tip-title').textContent = b.getAttribute('data-title');
    var wrap = tip.parentElement.getBoundingClientRect();
    var r = b.getBoundingClientRect();
    tip.classList.add('is-on');
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = r.left - wrap.left + r.width / 2 - tw / 2;
    x = Math.max(0, Math.min(wrap.width - tw, x));
    var y = r.top - wrap.top - th - 12;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.classList.remove('is-on'); }

  bricks.forEach(function (b) {
    b.addEventListener('mouseenter', function () { showTip(b); });
    b.addEventListener('focus', function () { showTip(b); });
    b.addEventListener('mouseleave', hideTip);
    b.addEventListener('blur', hideTip);
    b.addEventListener('click', function (e) {
      var target = document.getElementById(b.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      // Make sure the paper is visible even if filters would hide it.
      if (target.hidden) { activeArea = null; if (search) search.value = ''; apply(); }
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      target.classList.add('is-flash');
      setTimeout(function () { target.classList.remove('is-flash'); }, 1600);
      var link = target.querySelector('a');
      if (link) link.focus({ preventScroll: true });
    });
  });

  /* ----- Filters & search ----- */
  var activeArea = null;

  function apply() {
    var q = search ? search.value.trim().toLowerCase() : '';
    var terms = q ? q.split(/\s+/) : [];
    var shown = 0;
    pubs.forEach(function (p) {
      var hay = p.getAttribute('data-search');
      var ok = (!activeArea || p.getAttribute('data-area') === activeArea) &&
        terms.every(function (t) { return hay.indexOf(t) !== -1; });
      p.hidden = !ok;
      if (ok) shown++;
    });
    groups.forEach(function (g) {
      g.hidden = !$$('.pub', g).some(function (p) { return !p.hidden; });
    });
    if (emptyEl) emptyEl.hidden = shown > 0;
    if (countEl) countEl.textContent = shown === pubs.length ? pubs.length + ' papers' : shown + ' of ' + pubs.length + ' papers';

    var filtering = !!activeArea || terms.length > 0;
    if (wall) {
      wall.classList.toggle('is-filtered', filtering);
      bricks.forEach(function (b) {
        var target = document.getElementById(b.getAttribute('href').slice(1));
        b.classList.toggle('is-match', !!target && !target.hidden);
      });
    }
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-area') === activeArea)); });
  }

  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var a = c.getAttribute('data-area');
      activeArea = activeArea === a ? null : a;
      apply();
    });
  });
  if (search) search.addEventListener('input', apply);
})();
