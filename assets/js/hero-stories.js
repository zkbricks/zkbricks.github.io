/* Three explorable stories. Switching is deliberate; scenes never auto-advance. */
(function () {
  'use strict';
  var root = document.querySelector('[data-hero-stories]');
  if (!root) return;
  var tabs = Array.from(root.querySelectorAll('[data-story-tab]'));
  var panels = Array.from(root.querySelectorAll('[data-story-panel]'));
  var motion = root.querySelector('[data-story-motion]');
  var preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  var active = 'build', paused = false, visible = true;

  function sync(reset) {
    var frozen = paused || preference.matches;
    root.classList.toggle('is-paused', frozen);
    root.classList.toggle('is-suspended', !visible || document.hidden);
    motion.textContent = preference.matches ? 'Motion off' : paused ? 'Play motion' : 'Pause motion';
    motion.disabled = preference.matches;
    motion.setAttribute('aria-pressed', String(frozen));
    window.dispatchEvent(new CustomEvent('herofigurechange', { detail: {
      active: active, paused: frozen || !visible || document.hidden,
      reduceMotion: preference.matches, reset: !!reset
    } }));
  }
  function select(tab) {
    active = tab.dataset.storyTab;
    tabs.forEach(function (t) {
      var selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.dataset.storyPanel !== active;
      panel.classList.toggle('is-playing', !panel.hidden);
    });
    sync(true);
  }
  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { select(tab); });
    tab.addEventListener('keydown', function (e) {
      var next;
      if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      else return;
      e.preventDefault();
      tabs[next].focus();
      select(tabs[next]);
    });
  });
  motion.addEventListener('click', function () { paused = !paused; sync(false); });
  preference.addEventListener('change', function () { sync(true); });
  document.addEventListener('visibilitychange', function () { sync(false); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync(false);
    }).observe(root);
  }
  select(tabs[0]);
})();
