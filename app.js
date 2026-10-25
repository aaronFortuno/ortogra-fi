(function () {
  'use strict';
  const dialog = document.querySelector('#about-dialog');
  const opener = document.querySelector('#about-open');
  let closing = false;
  opener.addEventListener('click', () => {
    if (dialog.open || closing) return;
    dialog.showModal();
    requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-visible')));
  });
  function close() {
    if (!dialog.open || closing) return;
    closing = true;
    dialog.classList.remove('is-visible');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      dialog.close();
      closing = false;
      opener.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 220);
  }
  dialog.querySelector('[data-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  let pointerStartedOutside = false;
  const outside = event => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  dialog.addEventListener('pointerdown', event => { pointerStartedOutside = outside(event); });
  dialog.addEventListener('click', event => { if (pointerStartedOutside && outside(event)) close(); });
  document.querySelector('#copy-lightning').addEventListener('click', async () => {
    const address = document.querySelector('#lightning-address');
    const status = document.querySelector('#copy-status');
    try {
      await navigator.clipboard.writeText(address.textContent);
      status.textContent = 'Adreça copiada.';
    } catch {
      const selection = getSelection();
      const range = document.createRange();
      range.selectNodeContents(address);
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = 'Adreça seleccionada. Copia-la amb el menú del dispositiu.';
    }
  });
})();
