import { createSampleBrowser } from './samples.js?v=1.11.0';
import { createLoadingIndicator, createResourceLoader } from './loading.js?v=1.6.0';
import { createLightControls } from './light-controls.js?v=1.11.0';
import { createAmbientAudio } from './ambient-audio.js?v=1.15.0';

const workspace = document.querySelector('#workspace');
const controls = document.querySelector('#shelf-controls');
const status = document.querySelector('#desk-status');
const caption = document.querySelector('#hover-caption');
const detail = document.querySelector('#project-detail');
const list = document.querySelector('#projectes');
const listToggle = document.querySelector('.list-toggle');
const areaButtons = [...document.querySelectorAll('[data-area]')];
const base = new URL('../', import.meta.url);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let scene;
let selected = null;
let busy = false;
let openingButton;
const samples = createSampleBrowser({ getScene: () => scene, track });
const loading = createLoadingIndicator(document.querySelector('#desk-loading'));
const lightControls = createLightControls(() => scene);
const ambience = createAmbientAudio(document.querySelector('#ambient-toggle'));

const presentation = [
  { id: 'plec', name: 'Plec', kind: 'binder', purpose: 'Dictats', color: '#36523c', area: 'Llengua',
    description: 'Prepara un dictat amb un full plegable. L’alumnat pot escoltar els mots al seu ritme i desplegar el paper per corregir-los.' },
  { id: 'trama', name: 'Trama', kind: 'binder', purpose: 'Comprensió lectora', color: '#36523c', area: 'Llengua',
    description: 'Tria una lectura il·lustrada, adapta la presentació de la fitxa i imprimeix les preguntes i el solucionari.' },
  { id: 'resso', name: 'Ressò', kind: 'binder', purpose: 'Lectura en veu alta', color: '#36523c', area: 'Llengua',
    description: 'Practica la lectura en veu alta en català, amb seguiment del text i transcripció al dispositiu.' },
  { id: 'sentit', name: 'Sentit', kind: 'binder', purpose: 'Comprensió oral', color: '#36523c', area: 'Llengua',
    description: 'Escolta un àudio en català i treballa la comprensió al paper, amb fitxes i solucionaris imprimibles.' },
  { id: 'fil-i-compte', name: 'Fil i Compte', kind: 'binder', purpose: 'Problemes', color: '#a67b31', area: 'Matemàtiques',
    description: 'Prepara fitxes de problemes de matemàtiques. Tria els continguts, deixa espai per resoldre’ls i imprimeix el solucionari.' },
  { id: 'relleu-obert', name: 'Relleu Obert', kind: 'box', purpose: 'Maquetes 3D', color: '#52636d', area: 'Medi',
    description: 'Tria un lloc al mapa i converteix-lo en una maqueta de relleu per imprimir en 3D.' },
  { id: 'pentagrama', name: 'Pentagrama', kind: 'folder', purpose: 'Paper de música', color: '#9c573f', area: 'Utilitats',
    description: 'Genera paper de música a mida amb pentagrames, claus i compassos, a punt per imprimir.' },
  { id: 'pauta', name: 'Pauta', kind: 'folder', purpose: 'Paper pautat', color: '#868767', area: 'Utilitats',
    description: 'Crea fulls A4 o A5 per escriure i practicar cal·ligrafia. Ajusta les línies, els marges i les guies.' },
];

function track(name, data) {
  if (location.protocol !== 'https:' || location.hostname !== 'ortogra.fi') return;
  try { window.umami?.track?.(name, data)?.catch?.(() => {}); } catch { /* Analytics is optional. */ }
}

function setList(open) {
  list.classList.toggle('is-open', open);
  listToggle.setAttribute('aria-expanded', String(open));
}
listToggle.addEventListener('click', () => setList(!list.classList.contains('is-open')));
document.addEventListener('pointerdown', event => {
  if (!list.contains(event.target) && !listToggle.contains(event.target)) setList(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && list.classList.contains('is-open')) {
    setList(false);
    listToggle.focus();
  }
});
document.querySelector('.skip-link').addEventListener('click', () => setList(true));

async function loadProjects() {
  const response = await fetch(new URL('index.html', base));
  if (!response.ok) throw new Error('No s’ha pogut carregar el catàleg.');
  const portal = new DOMParser().parseFromString(await response.text(), 'text/html');
  const sampleBase = new URL('assets/desk/samples/', base);
  const sampleCatalogue = await fetch(new URL('examples.json?v=1.11.0', sampleBase)).then(response => {
    if (!response.ok) throw new Error('No s’han pogut carregar les mostres.');
    return response.json();
  });
  const reliefBase = new URL('assets/desk/reliefs/', base);
  const reliefCatalogue = await fetch(new URL('manifest.json?v=1.11.0', reliefBase)).then(response => {
    if (!response.ok) throw new Error('No s’han pogut carregar les maquetes.');
    return response.json();
  });
  for (const project of presentation) {
    const link = [...portal.querySelectorAll('.project-link')].find(link => {
      const domain = new URL(link.href).hostname;
      return domain === (project.id === 'pentagrama' ? 'pentagrama.page'
        : project.id === 'fil-i-compte' ? 'filicompte.ortogra.fi'
        : project.id === 'relleu-obert' ? 'relleu.ortogra.fi' : project.id + '.ortogra.fi');
    });
    if (!link) throw new Error('El projecte ha canviat al catàleg.');
    project.href = link.href;
    const symbol = link.querySelector('.project-brand svg');
    const imageSymbol = link.querySelector('.project-brand img');
    if (symbol) {
      const copy = symbol.cloneNode(true);
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('fill', 'none');
      copy.setAttribute('stroke', '#2d493a'); copy.setAttribute('color', '#2d493a'); copy.setAttribute('stroke-width', '1.8');
      copy.setAttribute('stroke-linecap', 'round'); copy.setAttribute('stroke-linejoin', 'round');
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = '.brand-dot{color:#ad6245;stroke:#ad6245}'; copy.prepend(style);
      project.logo = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(copy.outerHTML);
    } else if (imageSymbol) project.logo = new URL(imageSymbol.getAttribute('src'), base).href;
    project.preview = link.querySelector('.project-preview')?.getAttribute('src');
    if (project.preview) project.preview = new URL(project.preview, base).href;
    project.examples = sampleCatalogue[project.id];
    if (project.id === 'relleu-obert') {
      project.reliefs = reliefCatalogue.models.map(model => ({ ...model, url: new URL(model.url + '?v=' + model.sha256.slice(0, 12), reliefBase).href }));
      const byId = new Map(project.reliefs.map(model => [model.id, model]));
      const ids = ['agulles-montserrat', 'tamariu', 'sant-maurici'];
      const shortTitles = ['Montserrat', 'Tamariu', 'Sant Maurici'];
      project.examples = [{ title: 'Tres maquetes de Relleu Obert',
        pages: ids.map((id, index) => ({ title: byId.get(id).title, shortTitle: shortTitles[index], modelId: id, role: 'model', image: id.includes('montserrat') ? 'relleu-montserrat.webp' : 'relleu-' + id + '.webp' })),
      }];
    }
    const valid = project.reliefs?.length
      ? project.examples.length === 1 && project.examples[0].pages.length === 3
      : project.examples?.length === 3 && project.examples.every(example => example.pages.length === 2);
    if (!valid) throw new Error('Falten exemples de ' + project.name);
    project.samples = project.examples.flatMap((example, exampleIndex) => example.pages.map((sample, pageIndex) => ({
      ...sample, exampleIndex, pageIndex, image: new URL(sample.image, sampleBase).href,
      pdf: sample.pdf ? new URL(sample.pdf, sampleBase).href : null,
    })));
  }
  const about = portal.querySelector('#about-dialog');
  if (about) {
    const credits = document.createElement('p');
    credits.className = 'ambient-credits';
    credits.innerHTML = 'Enregistraments d’ambient de <a href="https://freesound.org/people/ecfike/sounds/183496/" target="_blank" rel="noopener noreferrer">ecfike</a>, <a href="https://freesound.org/people/ValentinPetiteau/sounds/563547/" target="_blank" rel="noopener noreferrer">ValentinPetiteau</a>, <a href="https://freesound.org/people/WhisperingEarth/sounds/798842/" target="_blank" rel="noopener noreferrer">WhisperingEarth</a> i <a href="https://freesound.org/people/TSP-Talk/sounds/846301/" target="_blank" rel="noopener noreferrer">TSP-Talk</a> · <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">CC0</a>. Pati: <a href="https://mixkit.co/free-sound-effects/children/" target="_blank" rel="noopener noreferrer">Playground with kids playing · Mixkit</a>.';
    (about.querySelector('.credits') || about.querySelector('.dialog-content') || about).append(credits);
    about.querySelectorAll('[src],[href]').forEach(element => {
      for (const attribute of ['src', 'href']) {
        if (element.hasAttribute(attribute)) element.setAttribute(attribute, new URL(element.getAttribute(attribute), base).href);
      }
    });
    document.body.append(about);
    const script = document.createElement('script');
    script.src = new URL('app.js?v=1.1.0', base).href;
    document.body.append(script);
  }
  if (location.hostname === 'ortogra.fi' && location.protocol === 'https:') {
    const source = portal.querySelector('script[data-website-id]');
    if (source) document.head.append(source.cloneNode(true));
  }
}

function sampleFor(project) {
  const sample = document.querySelector('#project-sample');
  sample.replaceChildren();
  if (project.samples?.length || project.preview) {
    const image = document.createElement('img');
    image.src = project.samples?.[0]?.image || project.preview;
    image.alt = 'Mostra de ' + project.name;
    sample.append(image);
    return;
  }
  const sheet = document.createElement('div');
  sheet.className = 'sample-sheet';
  const title = document.createElement('h3');
  title.textContent = 'Escolta i decideix';
  const instruction = document.createElement('p');
  instruction.textContent = 'Escolta el missatge i respon al paper.';
  const question = document.createElement('p');
  question.textContent = 'On s’ha de trobar el grup?';
  const lines = document.createElement('div');
  lines.className = 'sample-lines';
  sheet.append(title, instruction, question, lines);
  sample.append(sheet);
}

async function openProject(project, button) {
  if (busy || selected) return;
  busy = true;
  openingButton = button;
  selected = project;
  setList(false);
  document.querySelector('#project-title').textContent = project.name;
  document.querySelector('#project-area').textContent = project.area;
  document.querySelector('#project-purpose').textContent = project.purpose;
  document.querySelector('#project-description').textContent = project.description;
  document.querySelector('#project-credits').hidden = project.id !== 'relleu-obert';
  document.querySelector('#project-credits').open = false;
  document.querySelector('#sample-caption').textContent = project.id === 'sentit' ? 'Exemple de fitxa' : 'Una mirada al projecte';
  const entry = document.querySelector('#project-enter');
  entry.href = project.href;
  entry.querySelector('.project-entry-name').textContent = 'Obre ' + project.name;
  entry.setAttribute('aria-label', 'Obre ' + project.name);
  detail.style.setProperty('--binder-color', project.color);
  detail.dataset.kind = project.kind;
  detail.dataset.preparing = 'true';
  sampleFor(project);
  caption.classList.remove('visible');
  controls.inert = true;
  try {
    status.textContent = '';
    await scene.select(project.id);
    samples.setProject(project);
    delete detail.dataset.preparing;
    detail.showModal();
    detail.querySelector('.description-page').scrollTop = 0;
    scene.setDetailVisible(true);
    requestAnimationFrame(() => detail.classList.add('is-visible'));
    track('obre_fitxa_escriptori', { projecte: project.id });
  } catch (error) {
    if (detail.open) detail.close();
    await scene.home().catch(() => {});
    selected = null; controls.inert = false;
    status.textContent = 'No s’ha pogut carregar la mostra. Torna-ho a provar.';
    console.error('Mostra:', error);
  } finally {
    delete detail.dataset.preparing;
    busy = false;
  }
}

async function closeProject() {
  if (busy || samples.isBusy() || !detail.open) return;
  if (samples.isInspecting()) { await samples.closeInspection(); return; }
  busy = true;
  detail.classList.remove('is-visible');
  await new Promise(resolve => setTimeout(resolve, reduced.matches ? 0 : 220));
  detail.close();
  scene.setDetailVisible(false);
  await scene.home();
  selected = null;
  controls.inert = false;
  busy = false;
  openingButton?.focus({ preventScroll: true });
}
detail.querySelector('.binder-close').addEventListener('click', closeProject);
detail.addEventListener('cancel', event => { event.preventDefault(); closeProject(); });
detail.addEventListener('click', event => { if (event.target === detail) closeProject(); });
document.querySelector('#project-enter').addEventListener('click', () => track('obre_projecte', { projecte: selected?.id, origen: 'escriptori' }));

function makeControls() {
  for (const project of presentation) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'binder-target';
    button.dataset.project = project.id;
    button.setAttribute('aria-label', project.name + ' · ' + project.purpose);
    button.setAttribute('aria-haspopup', 'dialog');
    const label = document.createElement('span');
    label.className = 'sr-label';
    label.textContent = project.name + ' · ' + project.purpose;
    button.append(label);
    button.addEventListener('pointerenter', () => {
      if (selected || busy) return;
      scene.highlight(project.id);
      caption.textContent = project.name + ' · ' + project.purpose;
      caption.classList.add('visible');
    });
    button.addEventListener('pointerleave', () => {
      if (!selected) scene.highlight(null);
      caption.classList.remove('visible');
    });
    button.addEventListener('focus', () => {
      if (!selected && !busy) scene.highlight(project.id);
    });
    button.addEventListener('blur', () => { if (!selected) scene.highlight(null); });
    button.addEventListener('click', () => openProject(project, button));
    controls.append(button);
    project.button = button;
  }
  for (const area of ['Llengua', 'Matemàtiques', 'Medi', 'Utilitats']) {
    const title = document.createElement('span');
    title.className = 'shelf-title';
    title.textContent = area;
    title.setAttribute('aria-hidden', 'true');
    controls.append(title);
    presentation.filter(project => project.area === area).forEach(project => { project.areaLabel = title; });
  }
}

areaButtons.forEach(button => button.addEventListener('click', () => {
  if (!scene || busy || selected) return;
  const area = button.dataset.area;
  areaButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  presentation.forEach(project => { project.button.tabIndex = area === 'Taula' || project.area === area ? 0 : -1; });
  scene.setArea(area);
}));

async function start() {
  try {
    loading.update(0, 'Preparant l’escriptori…');
    const [manifest] = await Promise.all([
      fetch(new URL('assets/desk/loading.json?v=1.15.0', base)).then(response => {
        if (!response.ok) throw new Error('No s’ha pogut carregar el pla de recursos.');
        return response.json();
      }),
      loadProjects(),
    ]);
    loading.update(5, 'Carregant el motor 3D…');
    makeControls();
    const { createDesk } = await import('./scene.js?v=1.15.1');
    loading.update(10, 'Carregant els models i les textures…');
    const resources = createResourceLoader(manifest, base, loading.update);
    scene = await createDesk({
      canvas: document.querySelector('#desk-canvas'), projects: presentation,
      dark: document.documentElement.dataset.theme === 'dark',
      resources,
      onStage: (percent, label) => loading.update(percent ?? 0, label),
      onLightingChange: lightControls.update,
      onWindowChange: ambience.setWindow,
      onObjectSound: ambience.playObject,
    });
    status.textContent = '';
    workspace.dataset.ready = 'true';
    workspace.setAttribute('aria-busy', 'false');
    for (const element of [controls, document.querySelector('#wall-light-switch'), document.querySelector('#window-latch'), document.querySelector('.desk-view-tools'), document.querySelector('.mobile-areas')]) element.inert = false;
    ambience.start();
    loading.finish();
    const view = new URLSearchParams(location.search).get('vista');
    if (view === 'finestra') scene.moveView('window');
    else if (['fulls', 'estoig', 'potus'].includes(view)) scene.moveView(view);
    document.querySelectorAll('[data-view]').forEach(button => {
      const activate = () => { if (!busy && !selected) scene.moveView(button.dataset.view); };
      let touch = null, touchReturn = null;
      button.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'mouse' && event.isPrimary) {
          touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }
      });
      button.addEventListener('pointerup', event => {
        if (!touch || event.pointerId !== touch.id) return;
        const tapped = Math.hypot(event.clientX - touch.x, event.clientY - touch.y) <= 6;
        touch = null;
        // As in the enlarged sheet, a tap after a drag may have no click.
        touchReturn = { pointer: event.pointerId, time: performance.now() };
        event.preventDefault();
        if (tapped) activate();
      });
      button.addEventListener('pointercancel', () => { touch = null; });
      button.addEventListener('click', event => {
        if (touchReturn && event.pointerId === touchReturn.pointer && performance.now() - touchReturn.time < 700) {
          touchReturn = null; event.preventDefault(); return;
        }
        activate();
      });
    });
    new MutationObserver(() => scene.setTheme(document.documentElement.dataset.theme === 'dark'))
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (error) {
    loading.fail();
    workspace.setAttribute('aria-busy', 'false');
    workspace.classList.add('failed');
    status.textContent = 'Pots accedir a totes les eines des de la llista de projectes.';
    controls.replaceChildren();
    setList(true);
    console.error('Escriptori:', error);
  }
}
start();
