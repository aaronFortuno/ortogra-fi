const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function createSampleBrowser({ detail, getScene, track }) {
  const viewer = document.querySelector('#sample-viewer');
  const stage = document.querySelector('#sample-stage');
  const image = document.querySelector('#sample-document');
  const lens = document.querySelector('#sample-lens');
  const hit = document.querySelector('#sample-open');
  const download = document.querySelector('#sample-pdf');
  let project, items = [], index = 0, zoom = 1, previousFocus, closing = false;

  function hideLens() { lens.classList.remove('is-visible'); }
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
    document.querySelector('#sample-counter').textContent = `${index + 1} / ${items.length}`;
    for (const id of ['sample-previous', 'sample-next']) document.getElementById(id).disabled = items.length < 2;
    download.hidden = !item.pdf;
    if (item.pdf) download.href = item.pdf; else download.removeAttribute('href');
    zoom = 1; stage.scrollTop = stage.scrollLeft = 0;
    lens.style.backgroundImage = `url("${item.image}")`;
    hideLens();
    if (image.complete) { image.classList.remove('is-loading'); fit(); }
  }
  function show() {
    if (!items.length || closing) return;
    previousFocus = document.activeElement;
    hideLens();
    viewer.showModal();
    select(index);
    requestAnimationFrame(() => { viewer.classList.add('is-visible'); fit(); });
    track('amplia_mostra_escriptori', { projecte: project.id });
  }
  async function close() {
    if (!viewer.open || closing) return;
    closing = true; viewer.classList.remove('is-visible');
    await new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? 0 : 220));
    viewer.close(); closing = false;
    previousFocus?.focus({ preventScroll: true });
  }
  function changeZoom(factor) { zoom = Math.min(3, Math.max(.75, zoom * factor)); fit(true); }
  hit.addEventListener('click', show);
  document.querySelector('#sample-open-inline').addEventListener('click', show);
  document.querySelector('#sample-close').addEventListener('click', close);
  viewer.addEventListener('cancel', event => { event.preventDefault(); close(); });
  viewer.addEventListener('click', event => { if (event.target === viewer) close(); });
  document.querySelector('#sample-previous').addEventListener('click', () => select(index - 1));
  document.querySelector('#sample-next').addEventListener('click', () => select(index + 1));
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
  hit.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !items.length || viewer.open) return;
    const quad = getScene().sampleProjection();
    if (!quad) return;
    const rect = detail.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const point = unproject(quad, x, y);
    if (!point || point.u < 0 || point.u > 1 || point.v < 0 || point.v > 1) { hideLens(); return; }
    const width = (Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y) + Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y)) * 1.2;
    const texture = items[index].texture.image;
    const height = width * texture.height / texture.width;
    Object.assign(lens.style, {
      left: Math.min(rect.width - 156, Math.max(4, x - 76)) + 'px',
      top: Math.min(rect.height - 156, Math.max(4, y - 76)) + 'px',
      backgroundSize: `${width}px ${height}px`, backgroundPosition: `${76 - point.u * width}px ${76 - point.v * height}px`,
    });
    lens.classList.add('is-visible');
  });
  hit.addEventListener('pointerleave', hideLens);
  hit.addEventListener('blur', hideLens);
  return {
    setProject(value) {
      project = value;
      ({ samples: items, index } = getScene().sampleInfo());
      // A generated fallback remains viewable even when a future project has no thumbnail.
      for (const item of items) if (!item.image) item.image = item.texture.image.toDataURL();
      lens.style.backgroundImage = `url("${items[index].image}")`;
    },
    hideLens,
  };
}

// Invert the paper's projective transform instead of treating its bounding box
// as a rectangle: the lens follows the ink even on a sloping cover.
function unproject([p0, p1, p2, p3], x, y) {
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < 1e-9) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant, h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const a = p1.x - p0.x + g * p1.x - x * g, b = p3.x - p0.x + h * p3.x - x * h;
  const d = p1.y - p0.y + g * p1.y - y * g, e = p3.y - p0.y + h * p3.y - y * h;
  const divisor = a * e - b * d;
  if (Math.abs(divisor) < 1e-9) return null;
  return { u: ((x - p0.x) * e - b * (y - p0.y)) / divisor, v: (a * (y - p0.y) - (x - p0.x) * d) / divisor };
}
