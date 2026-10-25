(function () {
  'use strict';
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try { const saved = localStorage.getItem('ortografi-theme'); if (['dark', 'light'].includes(saved)) preference = saved; } catch {}
  function apply() {
    const dark = preference === 'system' ? system.matches : preference === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    const button = document.querySelector('[data-theme-toggle]');
    if (button) {
      button.setAttribute('aria-label', dark ? 'Activa el tema clar' : 'Activa el tema fosc');
      button.setAttribute('aria-pressed', String(dark));
    }
    document.querySelector('meta[name="theme-color"]').content = dark ? '#101a17' : '#f8f6ef';
  }
  apply();
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelector('[data-theme-toggle]').addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('ortografi-theme', preference); } catch {}
      apply();
    });
  });
})();
