import * as THREE from 'three';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import { DeskNavigation } from './navigation.js?v=1.2.0';
import { createAtmosphere } from './atmosphere.js?v=1.6.0';
import { prepareMaterials } from './materials.js?v=1.8.0';
import { createReadingPages } from './reading.js?v=1.8.0';
import { createDaylight } from './daylight.js?v=1.8.0';
import { createPaperView } from './paper-view.js?v=1.8.0';
import { createContactShadows } from './contact-shadows.js?v=1.8.0';
import { createObjectJourney } from './journey.js?v=1.7.0';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 700px)');
const journeyDuration = 2500;
const areas = {
  Llengua: { center: [-4.48, 2.05, -.2], width: 3.8, label: [-3.92, 3.99, .0] },
  Matemàtiques: { center: [-.6, 2.05, -.2], width: 3.15, label: [-.6, 3.99, .0] },
  Medi: { center: [1.93, 1.8, -.2], width: 3.15, label: [1.93, 3.99, .0] },
  Utilitats: { center: [4.5, -.2, 1.1], width: 3.3, label: [4.5, .25, 1.25] },
};

function tapeTexture(project) {
  const vertical = project.kind === 'binder';
  const canvas = document.createElement('canvas');
  canvas.width = vertical ? 256 : 1024;
  canvas.height = vertical ? 1024 : 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f5edda';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  if (vertical) context.rotate(-Math.PI / 2);
  const text = project.name + ' · ' + project.purpose;
  let size = 68;
  context.font = '600 ' + size + 'px "Segoe UI", Arial, sans-serif';
  while (context.measureText(text).width > 950) {
    context.font = '600 ' + (--size) + 'px "Segoe UI", Arial, sans-serif';
  }
  context.fillStyle = '#253022';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function createDesk({ canvas, projects, dark: initialDark, resources, onStage = () => {}, onLightingChange }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .06, 75);
  const navigation = new DeskNavigation(camera, canvas.parentElement, {
    change: requestRender,
    start(type) {
      canvas.parentElement.classList.add('is-exploring');
      if (type === 'pointerdown') canvas.parentElement.classList.add('is-navigating');
      canvas.parentElement.querySelector('#hover-caption').classList.remove('visible');
      highlight(null);
    },
    animate: update => animate('view', update),
    cancel: () => cancelMotion('view'),
  });
  const ambient = new THREE.HemisphereLight('#e6edf1', '#9b947c', .42);
  scene.add(ambient);
  const daylight = new THREE.DirectionalLight('#fff8eb', 2.5);
  daylight.position.set(-9, 7.5, 4);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  Object.assign(daylight.shadow.camera, { left: -9, right: 9, top: 8, bottom: -5, near: .5, far: 30 });
  // Avoid self-shadow stripes when the camera reads the pages up close.
  daylight.shadow.normalBias = .025;
  daylight.shadow.bias = -.001;
  daylight.shadow.radius = 5;
  scene.add(daylight);
  const fill = new THREE.DirectionalLight('#e0ebf2', .45);
  fill.position.set(5, 5, 4);
  scene.add(fill);
  const bounce = new THREE.PointLight('#ded0ad', 4, 18, 2);
  bounce.position.set(-5, 2, 3.5);
  scene.add(bounce);
  // A neutral-cool desk light comes on for reading, without another shadow map.
  const readingLight = new THREE.DirectionalLight('#e8f2ff', 0);
  readingLight.position.set(-1.5, 6.5, 5);
  readingLight.target.position.set(.4, -.4, 2.5);
  scene.add(readingLight, readingLight.target);
  let darkTheme = initialDark;
  const readingIntensity = () => darkTheme ? 2.4 : 1.8;

  const modelURL = new URL('../assets/desk/escriptori.glb?v=1.4.0', import.meta.url);
  const modelBytes = await resources.buffer(modelURL.href);
  onStage(null, 'Preparant els arxivadors…');
  const asset = await new GLTFLoader().parseAsync(modelBytes, new URL('.', modelURL).href);
  const room = asset.scene;
  scene.add(room);
  const materials = await prepareMaterials(room, scene, renderer, resources);
  const reading = createReadingPages(document.querySelector('#project-detail'), [...materials].find(material => material.name === 'Paper'));

  const models = new Map();
  const motions = new Map();
  const curlAmounts = new Map();
  let frame = 0;
  let active = null;
  let hovered = null;
  let currentArea = 'Llengua';
  let lastWidth = 0;
  let lastHeight = 0;
  let presenting = false;
  let phase = 'shelf';
  let returnView;
  let ambientTimer;
  let contextLost = false;
  let controlsDirty = true;
  let ambientShadowTime = -Infinity;
  let firstFrame;
  const paperView = createPaperView({ camera, target: navigation.target, reading,
    animate, requestRender, getSize: () => ({ width: lastWidth, height: lastHeight }) });
  const outline = createHoverOutline(canvas.parentElement);
  const atmosphere = await createAtmosphere(scene, room, resources);
  for (const material of materials) if (material.name.startsWith('Leaves') || material.name.startsWith('LeafLight')) {
    material.map = atmosphere.leafTexture;
    material.color.set('#b5ba8f');
    material.roughness = .68;
    material.side = THREE.DoubleSide;
  }

  function addPlane(parent, size, position, texture, horizontal = false) {
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const material = new THREE.MeshStandardMaterial({
      map: texture, side: THREE.DoubleSide, roughness: .88, color: '#fffdf6',
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
    plane.position.set(...position);
    if (horizontal) plane.rotation.x = -Math.PI / 2;
    parent.add(plane);
    return plane;
  }
  for (const project of projects) {
    const group = room.getObjectByName('Item_' + project.id);
    const lid = room.getObjectByName('Lid_' + project.id);
    if (!group || !lid) throw new Error('Falta el model de ' + project.name);
    const label = tapeTexture(project);
    let bounds, axis, angle;
    if (project.kind === 'binder') {
      addPlane(group, [.293, 1.41], [0, .12, .824], label);
      bounds = [[-.25, -1.06, .82], [.25, 1.06, 1.18]];
      axis = 'y'; angle = -Math.PI - .28;
    } else if (project.kind === 'box') {
      addPlane(group, [1.4, .26], [0, -.01, .731], label);
      bounds = [[-.96, -.34, .72], [.96, .4, .92]];
      axis = 'x'; angle = -Math.PI * .57;
      const card = new THREE.Mesh(new THREE.BoxGeometry(1.75, .017, 1.17), [...materials].find(material => material.name === 'Paper'));
      card.position.set(2.05, -.35, 0);
      card.castShadow = card.receiveShadow = true;
      card.visible = false;
      card.name = 'ProjectCard';
      group.add(card);
    } else {
      addPlane(lid, [1.37, .285], [.925, .051, -.81], label, true);
      bounds = [[-.93, -.03, -1.17], [.93, .08, 1.18]];
      axis = 'z'; angle = Math.PI;
    }
    models.set(project.id, {
      group, lid, project, bounds, axis, angle,
      home: group.position.clone(), rotation: group.quaternion.clone(), outlineBounds: localBounds(group),
    });
  }
  await Promise.all([...models.values()].map(async model => {
    if (!model.project.preview) return;
    model.previewTexture = await resources.load(model.project.preview, objectURL => new THREE.TextureLoader().loadAsync(objectURL));
    model.previewTexture.colorSpace = THREE.SRGBColorSpace;
  }));
  const contactShadows = createContactShadows(room);
  const lighting = createDaylight({ scene, renderer, canvas, atmosphere, ambient, daylight, fill, bounce,
    animate: update => animate('daylight', update), requestRender, dark: initialDark, onChange: onLightingChange });

  function requestRender(geometryChanged = true) {
    if (geometryChanged) controlsDirty = true;
    if (!frame) frame = requestAnimationFrame(render);
  }
  function render(time) {
    frame = 0;
    for (const [key, motion] of motions) {
      if (motion.start === null) motion.start = time;
      const ratio = Math.min(1, (time - motion.start) / motion.duration);
      motion.update(ratio * ratio * (3 - 2 * ratio));
      if (ratio === 1) { motions.delete(key); motion.resolve(); }
    }
    scene.updateMatrixWorld();
    contactShadows.update();
    camera.updateMatrixWorld();
    if (controlsDirty) { updateControls(); controlsDirty = false; }
    if (active) reading.project(camera, canvas.getBoundingClientRect());
    outline.update(active ? null : models.get(hovered), camera, lastWidth, lastHeight);
    if ([...motions.keys()].some(key => key !== 'view')) renderer.shadowMap.needsUpdate = true;
    const living = !reducedMotion.matches && !document.hidden && !presenting && !contextLost && atmosphere.visible(camera);
    if (living) {
      atmosphere.update(time);
      if (lighting.hasShadows() && time - ambientShadowTime > 250) {
        renderer.shadowMap.needsUpdate = true;
        ambientShadowTime = time;
      }
    }
    renderer.render(scene, camera);
    if (firstFrame) { const resolve = firstFrame; firstFrame = null; requestAnimationFrame(resolve); }
    clearTimeout(ambientTimer);
    canvas.dataset.ambience = living ? 'moving' : 'still';
    if (living) ambientTimer = setTimeout(() => requestRender(false), 1000 / 24);
    if (motions.size) requestRender();
  }
  function cancelMotion(key) {
    if (!motions.has(key)) return;
    motions.get(key).resolve();
    motions.delete(key);
  }
  function animate(key, update, duration = 220) {
    cancelMotion(key);
    if (reducedMotion.matches) { update(1); requestRender(); return Promise.resolve(); }
    return new Promise(resolve => {
      motions.set(key, { start: key === 'journey' ? null : performance.now(), update, resolve, duration });
      requestRender();
    });
  }
  function projectPoint(point) {
    const projected = point.clone().project(camera);
    return { x: (projected.x + 1) * lastWidth / 2, y: (1 - projected.y) * lastHeight / 2, depth: projected.z };
  }
  function updateControls() {
    if (active) {
      for (const project of projects) { project.button.hidden = true; project.areaLabel.hidden = true; }
      return;
    }
    for (const model of models.values()) {
      const { project, bounds, home, rotation } = model;
      if (narrow.matches && project.area !== currentArea) {
        project.button.hidden = true;
        continue;
      }
      const points = [];
      for (const x of [bounds[0][0], bounds[1][0]]) {
        for (const y of [bounds[0][1], bounds[1][1]]) {
          for (const z of [bounds[0][2], bounds[1][2]]) {
            const local = new THREE.Vector3(x, y, z).applyQuaternion(rotation).add(home);
            points.push(projectPoint(local));
          }
        }
      }
      const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y));
      const right = Math.max(...points.map(p => p.x)), bottom = Math.max(...points.map(p => p.y));
      project.button.hidden = points.every(point => point.depth > 1 || point.depth < -1) || right < 0 || left > lastWidth || bottom < 0 || top > lastHeight;
      project.button.tabIndex = project.button.hidden ? -1 : 0;
      Object.assign(project.button.style, {
        left: left + 'px', top: top + 'px', width: (right - left) + 'px', height: (bottom - top) + 'px',
      });
    }
    for (const [area, settings] of Object.entries(areas)) {
      const label = projects.find(project => project.area === area).areaLabel;
      const point = projectPoint(new THREE.Vector3(...settings.label));
      label.hidden = narrow.matches || point.depth > 1 || point.depth < -1 || point.x < 0 || point.x > lastWidth;
      label.style.left = point.x + 'px';
      label.style.top = point.y + 'px';
    }
  }
  function initialView() {
    const aspect = lastWidth / lastHeight;
    const target = narrow.matches ? new THREE.Vector3(...areas[currentArea].center) : new THREE.Vector3(0, 1.55, -.15);
    const width = narrow.matches ? areas[currentArea].width : 13.8;
    const distance = Math.max(narrow.matches ? 7 : 13.3, width / (2 * Math.tan(THREE.MathUtils.degToRad(16)) * aspect));
    const direction = narrow.matches && currentArea === 'Utilitats'
      ? new THREE.Vector3(0, .68, .73).normalize()
      : new THREE.Vector3(0, .21, .978).normalize();
    return { target, position: target.clone().addScaledVector(direction, distance) };
  }
  function resize() {
    lastWidth = canvas.clientWidth; lastHeight = canvas.clientHeight;
    if (!lastWidth || !lastHeight) return;
    renderer.setSize(lastWidth, lastHeight, false);
    camera.aspect = lastWidth / lastHeight;
    camera.updateProjectionMatrix();
    if (phase === 'inspecting') { cancelMotion('inspection'); paperView.resize(); }
    else if (!active || phase === 'reading') {
      const view = active ? readingView() : initialView();
      camera.position.copy(view.position);
      navigation.target.copy(view.target);
      navigation.update();
    }
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    updateControls();
    requestRender();
  }
  canvas.parentElement.addEventListener('pointermove', () => {
    if (!navigation.pointers.size) canvas.parentElement.classList.remove('is-navigating');
  });
  canvas.parentElement.addEventListener('pointerup', () => canvas.parentElement.classList.remove('is-navigating'));
  canvas.parentElement.addEventListener('pointercancel', () => canvas.parentElement.classList.remove('is-navigating'));

  function highlight(id) {
    if (active || hovered === id) return;
    hovered = id;
    for (const [key, model] of models) {
      const start = model.group.position.clone();
      const destination = model.home.clone();
      if (key === id) {
        if (model.project.kind === 'folder') destination.y += .11;
        else destination.z += .3;
      }
      animate('hover-' + key, t => model.group.position.lerpVectors(start, destination, t));
    }
  }
  async function select(id) {
    const selected = models.get(id);
    if (selected.project.samples?.length && !selected.sampleTextures) {
      selected.sampleTextures = await Promise.all(selected.project.samples.map(async sample => {
        const texture = await new THREE.TextureLoader().loadAsync(sample.image);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return { ...sample, texture };
      }));
    }
    highlight(null);
    active = models.get(id);
    navigation.enabled = false;
    phase = 'preparing';
    returnView = { position: camera.position.clone(), target: navigation.target.clone(), rotation: camera.quaternion.clone(), aspect: camera.aspect };
    const model = active;
    cancelMotion('hover-' + id);
    reading.mount(model);
    // Upload and compile newly loaded samples before the animation clock starts.
    for (const sample of model.sampleTextures) renderer.initTexture(sample.texture);
    await renderer.compileAsync(scene, camera);
    // Warm the actual shadow/material passes as well as the shader programs.
    // A GPU fence keeps queued uploads out of the first moving frame, without
    // blocking the main thread with gl.finish().
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    const gl = renderer.getContext(), fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (fence) {
      gl.flush();
      await new Promise(resolve => {
        const ready = () => {
          const result = gl.clientWaitSync(fence, 0, 0);
          if (result === gl.TIMEOUT_EXPIRED) { requestAnimationFrame(ready); return; }
          gl.deleteSync(fence); resolve();
        };
        requestAnimationFrame(ready);
      });
    }
    phase = 'opening';
    canvas.parentElement.classList.add('is-reading');
    const from = model.group.position.clone();
    const journey = prepareJourney(model, from, returnView);
    await animate('journey', journey, journeyDuration);
    contactShadows.onTable(model.group);
    phase = 'reading';
    canvas.dataset.selected = id;
    canvas.dataset.presentation = 'table';
    requestRender();
  }
  function prepareJourney(model, from, startView) {
    const saved = { position: model.group.position.clone(), rotation: model.group.quaternion.clone(), lid: model.lid.rotation[model.axis] };
    const card = model.group.getObjectByName('ProjectCard');
    const savedCard = card && { x: card.position.x, visible: card.visible };
    const flatRotation = model.project.kind === 'binder'
      ? new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)))
      : new THREE.Quaternion();
    const destination = new THREE.Vector3(model.project.kind === 'box' ? -.95 : .78, model.project.kind === 'folder' ? -.53 : model.project.kind === 'box' ? -.205 : -.34, 2.5);
    // Measure the final reading pose, then restore the actual pose before moving.
    model.group.position.copy(destination); model.group.quaternion.copy(flatRotation);
    model.lid.rotation[model.axis] = model.angle;
    if (card) { card.visible = true; card.position.x = 2.05; }
    model.group.updateWorldMatrix(true, true);
    const view = readingView();
    const endFocus = new THREE.Box3().setFromPoints(reading.points(narrow.matches)).getCenter(new THREE.Vector3());
    model.group.position.copy(saved.position); model.group.quaternion.copy(saved.rotation); model.lid.rotation[model.axis] = saved.lid;
    if (card) { card.visible = savedCard.visible; card.position.x = savedCard.x; }
    model.group.updateWorldMatrix(true, true);
    return createObjectJourney({
      model, from, to: destination, flatRotation, startView, endView: view, endFocus,
      camera, target: navigation.target, focusPoints: () => reading.points(narrow.matches),
      onLid: opening => { readingLight.intensity = readingIntensity() * opening; },
    });
  }
  async function home() {
    if (!active) return;
    if (paperView.info().open) await leaveInspection();
    phase = 'closing';
    contactShadows.onTable(null);
    const model = active;
    const view = Math.abs(returnView.aspect - camera.aspect) < .01 ? returnView : initialView();
    const journey = prepareJourney(model, model.home, view);
    await animate('journey', t => journey(1 - t), journeyDuration);
    reading.unmount();
    for (const sample of model.sampleTextures || []) sample.texture.dispose();
    model.sampleTextures = null;
    active = null; hovered = null;
    phase = 'shelf';
    navigation.enabled = true;
    navigation.update();
    delete canvas.dataset.selected;
    delete canvas.dataset.presentation;
    canvas.parentElement.classList.remove('is-reading');
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); updateControls(); requestRender();
  }
  function readingView() {
    const points = reading.points(narrow.matches);
    if (active.project.kind === 'box' && !narrow.matches) {
      const bounds = new THREE.Box3().setFromObject(active.group);
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        points.push(new THREE.Vector3(x, y, z));
      }
    }
    const target = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    const direction = new THREE.Vector3(0, .975, .22).normalize();
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(direction, right);
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const panel = document.querySelector('.description-page');
    const reserved = panel.offsetHeight ? panel.offsetHeight + 30 : narrow.matches ? 244 : 152;
    const verticalTangent = tangent * Math.max(.4, (lastHeight - reserved) / lastHeight);
    let distance = 0;
    for (const point of points) {
      const local = point.clone().sub(target);
      distance = Math.max(distance, Math.abs(local.dot(right)) / (tangent * camera.aspect) + local.dot(direction), Math.abs(local.dot(up)) / verticalTangent + local.dot(direction));
    }
    distance *= narrow.matches ? 1.06 : 1.09;
    target.addScaledVector(up, -reserved / lastHeight * distance * tangent);
    return { target, position: target.clone().addScaledVector(direction, distance) };
  }
  function setDetailVisible(visible) {
    presenting = visible;
    renderer.shadowMap.needsUpdate = true;
    requestRender();
  }
  function setArea(area) {
    currentArea = area;
    highlight(null);
    resize();
  }
  function setTheme(dark) {
    darkTheme = dark;
    if (active) readingLight.intensity = readingIntensity();
    lighting.setTheme(dark);
    requestRender();
  }
  async function moveView(action) {
    if (active) return;
    canvas.parentElement.classList.toggle('is-exploring', action !== 'home');
    if (action === 'in' || action === 'out') {
      await navigation.zoom(action === 'in' ? -150 : 150);
      return;
    }
    const from = camera.position.clone(), previousTarget = navigation.target.clone();
    let target = previousTarget.clone(), position = from.clone();
    const fromRotation = camera.quaternion.clone();
    if (action === 'home') {
      ({ target, position } = initialView());
    } else {
      navigation.look(action === 'left' ? .2 : action === 'right' ? -.2 : 0,
        action === 'up' ? .12 : action === 'down' ? -.12 : 0);
      target.copy(navigation.target);
    }
    const viewCamera = camera.clone();
    viewCamera.position.copy(position);
    viewCamera.lookAt(target);
    const rotation = viewCamera.quaternion.clone();
    camera.quaternion.copy(fromRotation);
    navigation.enabled = false;
    await animate('view', t => {
      camera.position.lerpVectors(from, position, t);
      navigation.target.lerpVectors(previousTarget, target, t);
      camera.quaternion.slerpQuaternions(fromRotation, rotation, t);
    }, 420);
    navigation.enabled = !active;
    navigation.update();
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); updateControls(); requestRender();
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  narrow.addEventListener('change', resize);
  reducedMotion.addEventListener('change', () => {
    for (const motion of motions.values()) { motion.update(1); motion.resolve(); }
    motions.clear(); requestRender();
  });
  document.addEventListener('visibilitychange', () => {
    clearTimeout(ambientTimer);
    if (document.hidden) canvas.dataset.ambience = 'still';
    if (!document.hidden) requestRender();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    clearTimeout(ambientTimer);
    document.querySelector('#projectes').classList.add('is-open');
    document.querySelector('.list-toggle').setAttribute('aria-expanded', 'true');
    document.querySelector('#desk-status').textContent = 'L’escriptori s’ha pausat. Pots continuar des de Projectes.';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    document.querySelector('#desk-status').textContent = '';
    requestRender();
  });
  resize();
  onStage(94, 'Preparant la llum i els materials…');
  await new Promise(resolve => requestAnimationFrame(resolve));
  await renderer.compileAsync(scene, camera);
  onStage(98, 'Dibuixant l’escriptori…');
  await new Promise(resolve => { firstFrame = resolve; requestRender(); });
  async function setSample(index) {
    const info = reading.info();
    if (phase !== 'reading' || index === info.index || index < 0 || index >= info.count) return;
    phase = 'turning';
    for (const direction of [-1, 1]) { cancelMotion('curl-' + direction); curlAmounts.set(direction, 0); }
    const direction = Math.sign(index - info.index);
    reading.startTurn(index);
    await animate('pages', t => reading.turn(t, direction, narrow.matches));
    reading.finishTurn(index); phase = 'reading'; resize();
  }
  function curlSample(direction, amount) {
    if (phase !== 'reading') return;
    const from = curlAmounts.get(direction) || 0;
    animate('curl-' + direction, t => {
      const value = THREE.MathUtils.lerp(from, amount, t);
      curlAmounts.set(direction, value); reading.curl(direction, value, narrow.matches);
    });
  }
  async function inspectSheet(index) {
    if (phase !== 'reading' || !reading.info().pages[index]) return;
    for (const direction of [-1, 1]) { cancelMotion('curl-' + direction); curlAmounts.set(direction, 0); }
    reading.curl(-1, 0, narrow.matches); reading.curl(1, 0, narrow.matches);
    phase = 'zooming';
    await paperView.open(index); phase = 'inspecting'; paperView.resize();
    canvas.dataset.presentation = 'sheet'; requestRender();
  }
  async function leaveInspection() {
    if (!paperView.info().open || phase === 'zooming') return;
    cancelMotion('inspection'); phase = 'zooming';
    await paperView.close(readingView); phase = 'reading';
    canvas.dataset.presentation = 'table'; requestRender();
  }
  function panInspection(x, y) { if (phase === 'inspecting') return paperView.pan(x, y); }
  function scrollInspection(x, y) { if (phase === 'inspecting') return paperView.scroll(x, y); }
  new ResizeObserver(() => { if (active && phase === 'reading') resize(); }).observe(document.querySelector('.description-page'));
  return { highlight, select, home, setTheme, setArea, setDetailVisible, moveView, setSample, curlSample,
    inspectSheet, leaveInspection, panInspection, scrollInspection, inspectionInfo: paperView.info,
    sampleInfo: reading.info, setMoment: lighting.setMoment };
}

function localBounds(group) {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  group.traverse(mesh => {
    if (!mesh.isMesh || !mesh.visible || mesh.name === 'ProjectCard') return;
    mesh.geometry.computeBoundingBox();
    bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)));
  });
  return bounds;
}

function createHoverOutline(surface) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.classList.add('object-outline'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(namespace, 'path'); svg.append(path); surface.append(svg);
  return {
    update(model, camera, width, height) {
      svg.classList.toggle('is-visible', Boolean(model));
      if (!model) return;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const bounds = model.outlineBounds, points = [];
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = model.group.localToWorld(new THREE.Vector3(x, y, z)).project(camera);
        points.push({ x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 });
      }
      const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      points.sort((a, b) => a.x - b.x || a.y - b.y);
      const half = values => { const hull = []; for (const point of values) { while (hull.length > 1 && cross(hull.at(-2), hull.at(-1), point) <= 0) hull.pop(); hull.push(point); } return hull.slice(0, -1); };
      const hull = [...half(points), ...half([...points].reverse())];
      path.setAttribute('d', hull.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ') + ' Z');
    },
  };
}
