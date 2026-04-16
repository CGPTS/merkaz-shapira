'use strict';

const THEME_STORAGE_KEY = 'ms-hall-theme';

/**
 * @param {'light'|'dark'} theme
 * @param {boolean} [persist]  שמירה ב-localStorage — רק אחרי בחירה מפורשת של המשתמש
 */
function applyTheme(theme, persist) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#f1f5f9' : '#07080f');
  }

  const btn = document.getElementById('themeToggle');
  if (btn) {
    const isLight = theme === 'light';
    btn.setAttribute('aria-checked', isLight ? 'true' : 'false');
    btn.setAttribute(
      'aria-label',
      isLight ? 'מצב בהיר פעיל — עבור למצב כהה' : 'מצב כהה פעיל — עבור למצב בהיר',
    );
    btn.title = isLight
      ? 'מצב בהיר — לחצו למעבר למצב כהה'
      : 'מצב כהה — לחצו למעבר למצב בהיר';
    const label = btn.querySelector('.theme-toggle__label');
    if (label) label.textContent = isLight ? 'בהיר' : 'כהה';
  }

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) { /* מצב פרטי */ }
  }
}

function resolveInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (_) { /* */ }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function initThemeToggle() {
  applyTheme(resolveInitialTheme(), false);

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(cur === 'light' ? 'dark' : 'light', true);
  });

  window
    .matchMedia('(prefers-color-scheme: light)')
    .addEventListener('change', (e) => {
      try {
        if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      } catch (_) {
        return;
      }
      applyTheme(e.matches ? 'light' : 'dark', false);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeToggle);
} else {
  initThemeToggle();
}
