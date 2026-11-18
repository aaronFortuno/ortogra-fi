export function createSampleBrowser({ getScene, track }) {
  const detail = document.querySelector('#project-detail');
  const inspection = document.querySelector('#sample-inspection');
  const tools = detail.querySelector('.inspection-tools');
  const download = document.querySelector('#sample-pdf');
  const previous = document.querySelector('#sample-previous');
  const next = document.querySelector('#sample-next');
  const previousCorner = document.querySelector('#page-corner-previous');
  const nextCorner = document.querySelector('#page-corner-next');
  let project, inspecting = false, busy = false, previousFocus, drag, suppressClick = false, touchReturn;

  function update() {
    const { index, count, pages, paired } = getScene().sampleInfo();
    document.querySelector('#sample-counter').textContent = `${index + 1} / ${count}`;
    document.querySelector('#sample-counter').title = project.examples[index].title;
    for (const button of [previous, previousCorner]) button.disabled = busy || index === 0;
    for (const button of [next, nextCorner]) button.disabled = busy || index === count - 1;
    document.querySelector('#sample-open-inline').textContent = paired ? 'Amplia la fitxa' : 'Amplia el primer full';
    const second = document.querySelector('#sample-open-second');
    second.textContent = paired ? 'Amplia el solucionari' : 'Amplia el segon full'; second.hidden = !pages[1];
  }
  async function show(index = 0) {
    if (busy || inspecting) return;
    busy = true; inspecting = true; previousFocus = document.activeElement;
    detail.dataset.inspecting = 'true'; inspection.hidden = tools.hidden = false;
    const sample = getScene().sampleInfo().pages[index];
    document.querySelector('#inspection-title').textContent = sample.title;
    download.hidden = !sample.pdf;
    if (sample.pdf) download.href = sample.pdf; else download.removeAttribute('href');
    await getScene().inspectSheet(index);
    inspection.focus({ preventScroll: true }); busy = false;
    track('amplia_mostra_escriptori', { projecte: project.id });
  }
  async function closeInspection() {
    if (busy || !inspecting) return;
    busy = true;
    await getScene().leaveInspection();
    inspecting = false; busy = false; drag = null;
    inspection.hidden = tools.hidden = true; delete detail.dataset.inspecting;
    previousFocus?.focus({ preventScroll: true }); update();
  }
  async function step(direction) {
    if (busy || inspecting) return;
    const { index, count } = getScene().sampleInfo();
    const destination = index + direction;
    if (destination < 0 || destination >= count) return;
    busy = true; update();
    await getScene().setSample(destination);
    busy = false; update();
    track('passa_mostra_escriptori', { projecte: project.id, mostra: destination + 1 });
  }
  for (const [id, index] of [['sample-open', 0], ['sample-open-answers', 1], ['sample-open-inline', 0], ['sample-open-second', 1]]) {
    document.getElementById(id).addEventListener('click', () => show(index));
  }
  for (const [button, direction] of [[previous, -1], [next, 1], [previousCorner, -1], [nextCorner, 1]]) {
    button.addEventListener('click', () => step(direction));
  }
  for (const [button, direction] of [[previousCorner, -1], [nextCorner, 1]]) {
    const curl = amount => { if (!busy && !inspecting && !button.disabled) getScene().curlSample(direction, amount); };
    button.addEventListener('pointerenter', () => curl(1)); button.addEventListener('pointerleave', () => curl(0));
    button.addEventListener('focus', () => curl(1)); button.addEventListener('blur', () => curl(0));
  }
  document.querySelector('#sample-close').addEventListener('click', closeInspection);
  inspection.addEventListener('click', () => { if (!suppressClick) closeInspection(); suppressClick = false; });
  inspection.addEventListener('pointerdown', event => {
    if (busy) return;
    suppressClick = false;
    const { panX, panY } = getScene().inspectionInfo();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX, panY, moved: false };
    inspection.setPointerCapture(event.pointerId);
  });
  inspection.addEventListener('pointermove', event => {
    if (busy) return;
    const rect = inspection.getBoundingClientRect();
    if (drag) {
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved) getScene().panInspection(drag.panX - dx * 3 / rect.width, drag.panY + dy * 3 / rect.height);
    } else if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      const edge = value => Math.abs(value) < .2 ? 0 : Math.sign(value) * Math.min(1, (Math.abs(value) - .2) / .65);
      getScene().panInspection(edge((event.clientX - rect.left) / rect.width * 2 - 1), edge(1 - (event.clientY - rect.top) / rect.height * 2));
    }
  });
  inspection.addEventListener('pointerup', event => {
    const tapped = drag && !drag.moved;
    suppressClick = Boolean(drag?.moved); drag = null;
    // A touch tap can omit its synthetic click immediately after a drag. Treat
    // pointerup as the activation and consume any later click from this pointer.
    if (tapped && event.pointerType !== 'mouse') {
      event.preventDefault(); suppressClick = true;
      touchReturn = { pointer: event.pointerId, time: performance.now() };
      closeInspection();
    }
  });
  detail.addEventListener('click', event => {
    if (touchReturn && event.pointerId === touchReturn.pointer && performance.now() - touchReturn.time < 700) {
      event.preventDefault(); event.stopImmediatePropagation(); touchReturn = null;
    }
  }, true);
  inspection.addEventListener('pointercancel', () => { drag = null; suppressClick = true; });
  inspection.addEventListener('wheel', event => {
    event.preventDefault(); if (!busy) getScene().scrollInspection(event.deltaX, event.deltaY);
  }, { passive: false });
  detail.addEventListener('keydown', event => {
    if (!detail.open) return;
    if (inspecting && event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); closeInspection(); return;
    }
    if (event.target.closest('a')) return;
    if (inspecting && event.key.startsWith('Arrow')) {
      event.preventDefault();
      getScene().scrollInspection(event.key === 'ArrowLeft' ? -100 : event.key === 'ArrowRight' ? 100 : 0,
        event.key === 'ArrowUp' ? -100 : event.key === 'ArrowDown' ? 100 : 0);
    } else if (!inspecting && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  download.addEventListener('click', () => track('descarrega_mostra_escriptori', { projecte: project.id }));
  return { setProject(value) { project = value; inspecting = false; busy = false; delete detail.dataset.inspecting; update(); },
    closeInspection, isInspecting: () => inspecting, isBusy: () => busy };
}
