/*! Bootstrap 5.3 color mode toggle - minimal version */
(function () {
  'use strict';
  var getStoredTheme = function () { return localStorage.getItem('theme'); };
  var setStoredTheme = function (theme) { localStorage.setItem('theme', theme); };
  var getPreferredTheme = function () {
    var stored = getStoredTheme();
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  var setTheme = function (theme) {
    if (theme === 'auto') {
      document.documentElement.setAttribute('data-bs-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-bs-theme', theme);
    }
  };
  setTheme(getPreferredTheme());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (getStoredTheme() !== 'light' && getStoredTheme() !== 'dark') setTheme(getPreferredTheme());
  });
  window.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-bs-theme-value]').forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        var theme = toggle.getAttribute('data-bs-theme-value');
        setStoredTheme(theme);
        setTheme(theme);
      });
    });
  });
})();
