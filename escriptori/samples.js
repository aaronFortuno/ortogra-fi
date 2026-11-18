const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function createSampleBrowser({ getScene, track }) {
  const viewer = document.querySelector('#sample-viewer');
  const stage = document.querySelector('#sample-stage');
  const image = document.querySelector('#sample-document');
  const hit = document.querySelector('#sample-open');
  const answerHit = document.querySelector('#sample-open-answers');
  const documentSwitch = document.querySelector('#sample-document-switch');
  const download = document.querySelector('#sample-pdf');
  let project, items = [], index = 0, zoom = 1, previousFocus, closing = false;

  const role = item => item.role || 'worksheet';
  const indices = () => items.flatMap((item, i) => role(item) === role(items[index]) ? [i] : []);
  function fit(center = false) {
    if (!viewer.open || !image.naturalWidth) return;
    const scale = Math.min((stage.clientWidth - 40) / image.naturalWidth, (stage.clientHeight - 40) / image.naturalHeight);
    image.style.width = Math.max(1, image.naturalWidth * scale * zoom) + 'px';
    document.querySelector('#sample-scale').textContent = Math.round(zoom * 100) + '%';
    if (center) requestAnimationFrame(() => {
      stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
      stage.scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
    });
  }
  function select(next) {
    index = (next + items.length) % items.length;
    const item = items[index];
    getScene().setSample(index);
    image.classList.add('is-loading');
    image.src = item.image;
    image.alt = item.title;
    document.querySelector('#sample-viewer-title').textContent = project.name;
    const group = indices();
    document.querySelector('#sample-counter').textContent = `${group.indexOf(index) + 1} / ${group.length}`;
    for (const id of ['sample-previous', 'sample-next']) document.getElementById(id).disabled = group.length < 2;
    documentSwitch.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.document === role(item))));
    download.hidden = !item.pdf;
    if (item.pdf) download.href = item.pdf; else download.removeAttribute('href');
    zoom = 1; stage.scrollTop = stage.scrollLeft = 0;
    if (image.complete) { image.classList.remove('is-loading'); fit(); }
  }
  function show(documentRole) {
    if (!items.length || closing || viewer.open) return;
    if (documentRole) index = Number((documentRole === 'answers' ? answerHit : hit).dataset.index);
    previousFocus = document.activeElement;
    viewer.showModal();
    select(index);
    requestAnimationFrame(() => { viewer.classList.add('is-visible'); fit(); });
    track('amplia_mostra_escriptori', { projecte: project.id });
  }
  function step(direction) {
    const group = indices();
    select(group[(group.indexOf(index) + direction + group.length) % group.length]);
  }
  async function close() {
    if (!viewer.open || closing) return;
    closing = true; viewer.classList.remove('is-visible');
    await new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? 0 : 220));
    viewer.close(); closing = false;
    previousFocus?.focus({ preventScroll: true });
  }
  function changeZoom(factor) { zoom = Math.min(3, Math.max(.75, zoom * factor)); fit(true); }
  hit.addEventListener('click', () => show('worksheet'));
  answerHit.addEventListener('click', () => show('answers'));
  document.querySelector('#sample-open-inline').addEventListener('click', () => show());
  document.querySelector('#sample-close').addEventListener('click', close);
  viewer.addEventListener('cancel', event => { event.preventDefault(); close(); });
  viewer.addEventListener('click', event => { if (event.target === viewer) close(); });
  document.querySelector('#sample-previous').addEventListener('click', () => step(-1));
  document.querySelector('#sample-next').addEventListener('click', () => step(1));
  documentSwitch.addEventListener('click', event => {
    const button = event.target.closest('button[data-document]');
    if (button) select(items.findIndex(item => role(item) === button.dataset.document));
  });
  document.querySelector('#sample-zoom-in').addEventListener('click', () => changeZoom(1.25));
  document.querySelector('#sample-zoom-out').addEventListener('click', () => changeZoom(.8));
  document.querySelector('#sample-fit').addEventListener('click', () => { zoom = 1; fit(true); });
  download.addEventListener('click', () => track('descarrega_mostra_escriptori', { projecte: project.id }));
  image.addEventListener('load', () => { image.classList.remove('is-loading'); fit(); });
  new ResizeObserver(() => fit()).observe(stage);
  stage.addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault(); changeZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });
  return {
    setProject(value) {
      project = value;
      ({ samples: items, index } = getScene().sampleInfo());
      // A generated fallback remains viewable even when a future project has no thumbnail.
      for (const item of items) if (!item.image) item.image = item.texture.image.toDataURL();
      documentSwitch.hidden = !items.some(item => role(item) === 'answers');
      viewer.dataset.paired = String(!documentSwitch.hidden);
      document.querySelector('#sample-open-inline').lastChild.textContent = documentSwitch.hidden ? 'Amplia la mostra' : 'Fitxa i solucionari';
    },
  };
}
