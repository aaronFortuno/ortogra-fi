import { referenceTime, referenceDate } from './solar.js?v=1.6.0';

export function createLightControls(getScene) {
  const panel = document.querySelector('#light-panel'), button = document.querySelector('#light-toggle');
  const day = document.querySelector('#light-date'), time = document.querySelector('#light-time');
  const reset = document.querySelector('#light-now'), status = document.querySelector('#light-status');
  function choose() {
    const date = referenceDate(day.value, time.value);
    if (!date || !day.checkValidity() || !time.checkValidity()) { status.textContent = 'Tria una data i una hora vàlides. Aquesta hora pot no existir amb el canvi d’horari.'; return; }
    getScene()?.setMoment(date);
  }
  day.addEventListener('change', choose); time.addEventListener('change', choose);
  reset.addEventListener('click', () => getScene()?.setMoment(null));
  panel.querySelector('.light-close').addEventListener('click', () => { panel.hidePopover(); button.focus(); });
  return {
    update(state) {
      const fields = referenceTime(state.date);
      if (document.activeElement !== day) day.value = fields.date;
      if (document.activeElement !== time) time.value = fields.time;
      reset.disabled = state.automatic;
      const label = `${state.automatic ? 'Automàtica' : 'Prova manual'} · ${state.label} · ${fields.time}`;
      status.textContent = label;
      button.title = 'Llum de l’escriptori · ' + label;
      button.setAttribute('aria-label', 'Ajusta la llum de l’escriptori. ' + label);
    },
  };
}
