(() => {
  'use strict';
  const root = document.documentElement;
  // Directory-scoped, independent of shared trip data. Exports retain this scope.
  const scope = root.dataset.themeScope || new URL('.', location.href).pathname;
  root.dataset.themeScope = scope;
  const key = 'westbound:theme:' + scope;
  const valid = value => ['light', 'dark', 'system'].includes(value) ? value : 'light';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'light', storageFailed = false;
  try { preference = valid(localStorage.getItem(key)); } catch (_) { storageFailed = true; }
  function apply() {
    const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    document.querySelector('meta[name="color-scheme"]').content = theme === 'dark' ? 'dark' : 'only light';
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#101923' : '#142b3d';
    document.querySelectorAll('input[name="themePreference"]').forEach(input => { input.checked = input.value === preference; });
    const button = document.getElementById('themeToggle');
    if (button) {
      button.dataset.appliedTheme = theme;
      button.querySelector('svg').innerHTML = theme === 'dark'
        ? '<path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z"/>'
        : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>';
    }
    const status = document.getElementById('themeStorageStatus');
    if (status) {
      status.hidden = !storageFailed;
      status.textContent = storageFailed ? '설정을 저장할 수 없어 이번 실행에만 적용됩니다.' : '';
    }
  }
  apply(); // Before styles and the first paint; no dependency on the trip or SDK.
  document.addEventListener('trip-theme-controls-ready', apply, { once: true });
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  document.addEventListener('change', event => {
    if (event.target.name !== 'themePreference') return;
    preference = valid(event.target.value);
    try { localStorage.setItem(key, preference); storageFailed = false; } catch (_) { storageFailed = true; }
    apply();
    closeMenu(true);
  });
  function closeMenu(restoreFocus = false) {
    const menu = document.getElementById('themeMenu'), button = document.getElementById('themeToggle');
    if (!menu || menu.hidden) return;
    menu.hidden = true; button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus({ preventScroll: true });
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.('#themeToggle'), menu = document.getElementById('themeMenu');
    if (button && menu) {
      if (!menu.hidden) { closeMenu(); return; }
      menu.hidden = false; button.setAttribute('aria-expanded', 'true');
      menu.querySelector('input:checked')?.focus({ preventScroll: true });
    } else if (event.target.name === 'themePreference') closeMenu(true);
    else if (!event.target.closest?.('.theme-choice')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('themeMenu')?.hidden) {
      event.preventDefault(); closeMenu(true);
    }
  });
  document.addEventListener('focusin', event => { if (!event.target.closest?.('.theme-choice')) closeMenu(); });
  media.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => {
    try { if (event.storageArea !== localStorage) return; } catch (_) { return; }
    if (event.key === key || event.key === null) { preference = valid(event.newValue); apply(); }
  });
})();
