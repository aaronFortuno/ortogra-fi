import * as THREE from 'three';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from '../assets/vendor/three/addons/environments/RoomEnvironment.js';
import { DeskNavigation } from './navigation.js?v=1.2.0';
import { createAtmosphere, surfaceRelief } from './atmosphere.js?v=1.2.0';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 700px)');
const areas = {
  Llengua: { center: [-3.92, 2.05, -.2], width: 3.65, label: [-3.92, 3.99, .0] },
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

function plasterNormalMap() {
  const side = 128;
  const data = new Uint8Array(side * side * 4);
  const height = (x, y) => {
    const grain = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const random = grain - Math.floor(grain);
    return random * .1;
  };
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const normal = new THREE.Vector3(height(x - 1, y) - height(x + 1, y),
        height(x, y - 1) - height(x, y + 1), 1).normalize();
      const offset = (y * side + x) * 4;
      data[offset] = (normal.x * .5 + .5) * 255;
      data[offset + 1] = (normal.y * .5 + .5) * 255;
      data[offset + 2] = (normal.z * .5 + .5) * 255;
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, side, side);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function folderPaper(project) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffdf3';
  ctx.fillRect(0, 0, 512, 768);
  ctx.fillStyle = '#334837';
  ctx.font = '32px Georgia';
  ctx.fillText(project.name, 42, 65);
  ctx.strokeStyle = project.id === 'pentagrama' ? '#5a6259' : '#a4b2a1';
  ctx.lineWidth = 3;
  for (let y = 120; y < 710; y += project.id === 'pentagrama' ? 105 : 35) {
    const lines = project.id === 'pentagrama' ? 5 : 1;
    for (let i = 0; i < lines; i++) {
      ctx.beginPath(); ctx.moveTo(42, y + i * 10); ctx.lineTo(470, y + i * 10); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function createDesk({ canvas, projects, dark: initialDark }) {
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
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment, .025).texture;
  environment.dispose();
  pmrem.dispose();
  const ambient = new THREE.HemisphereLight('#e6edf1', '#9b947c', .42);
  scene.add(ambient);
  const daylight = new THREE.DirectionalLight('#fff8eb', 2.5);
  daylight.position.set(-9, 7.5, 4);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  Object.assign(daylight.shadow.camera, { left: -9, right: 9, top: 8, bottom: -5, near: .5, far: 30 });
  daylight.shadow.normalBias = .009;
  daylight.shadow.bias = -.0002;
  daylight.shadow.radius = 3.2;
  scene.add(daylight);
  const fill = new THREE.DirectionalLight('#e0ebf2', .45);
  fill.position.set(5, 5, 4);
  scene.add(fill);
  const bounce = new THREE.PointLight('#ded0ad', 4, 18, 2);
  bounce.position.set(-5, 2, 3.5);
  scene.add(bounce);

  const asset = await new GLTFLoader().loadAsync(new URL('../assets/desk/escriptori.glb?v=1.2.0', import.meta.url).href);
  const room = asset.scene;
  scene.add(room);
  const cloth = await new THREE.TextureLoader().loadAsync(new URL('../assets/desk/bookcloth.webp', import.meta.url).href);
  // A neutral linear mask tints each cover without changing its catalogue colour.
  cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping;
  cloth.flipY = false;
  cloth.repeat.set(2, 3);
  const clothNormal = surfaceRelief(cloth.image).normal;
  clothNormal.repeat.copy(cloth.repeat);
  const plasterNormal = plasterNormalMap();
  const woodMaterial = room.getObjectsByProperty('isMesh', true)
    .flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    .find(material => material.name.startsWith('Oak') && material.map);
  const oak = surfaceRelief(woodMaterial.map.image);
  const materials = new Set();
  room.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (materials.has(material)) continue;
      materials.add(material);
      if (material.name.startsWith('Cloth_') || material.name === 'BoxFabric') {
        material.normalMap = clothNormal;
        material.normalScale.set(.44, .44);
        material.roughnessMap = cloth;
        material.roughness = .91;
        material.map = cloth;
        material.color.multiplyScalar(.84);
      }
      if (material.name.startsWith('Plaster') || material.name.startsWith('Ceramic')) {
        material.normalMap = plasterNormal;
        material.normalScale.set(.07, .07);
      }
      if (material.name.startsWith('Oak')) {
        material.normalMap = oak.normal;
        material.normalScale.set(.28, .28);
        material.roughnessMap = oak.rough;
        material.roughness = 1;
      }
      if (material.name.startsWith('Leaves') || material.name.startsWith('LeafLight')) material.side = THREE.DoubleSide;
      if (material.aoMap) material.aoMapIntensity = .65;
      if (material.map) material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
  });

  const models = new Map();
  const motions = new Map();
  let frame = 0;
  let active = null;
  let hovered = null;
  let currentArea = 'Llengua';
  let lastWidth = 0;
  let lastHeight = 0;
  let presenting = false;
  let ambientTimer;
  let contextLost = false;
  let controlsDirty = true;
  const atmosphere = await createAtmosphere(scene);
  for (const material of materials) if (material.name.startsWith('Leaves') || material.name.startsWith('LeafLight')) {
    material.map = atmosphere.leafTexture;
    material.color.set('#b5ba8f');
    material.roughness = .68;
  }

  function addPlane(parent, size, position, texture, horizontal = false) {
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const material = new THREE.MeshBasicMaterial({
      map: texture, side: THREE.DoubleSide, toneMapped: false,
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
      axis = 'y'; angle = -Math.PI;
    } else if (project.kind === 'box') {
      addPlane(group, [1.4, .26], [0, -.01, .731], label);
      bounds = [[-.96, -.34, .72], [.96, .4, .92]];
      axis = 'x'; angle = -Math.PI * .57;
      if (project.preview) {
        const image = await new THREE.TextureLoader().loadAsync(project.preview);
        image.colorSpace = THREE.SRGBColorSpace;
        addPlane(group, [1.63, 1.05], [0, -.217, 0], image, true);
      }
    } else {
      addPlane(lid, [1.37, .285], [.925, .051, -.81], label, true);
      addPlane(lid, [1.22, 1.13], [.925, .042, .2], folderPaper(project), true);
      addPlane(group, [1.64, 2.08], [0, .011, 0], folderPaper(project), true);
      bounds = [[-.93, -.03, -1.17], [.93, .08, 1.18]];
      axis = 'z'; angle = Math.PI;
    }
    models.set(project.id, {
      group, lid, project, bounds, axis, angle,
      home: group.position.clone(), rotation: group.quaternion.clone(),
    });
  }

  function requestRender(geometryChanged = true) {
    if (geometryChanged) controlsDirty = true;
    if (!frame) frame = requestAnimationFrame(render);
  }
  function render(time) {
    frame = 0;
    for (const [key, motion] of motions) {
      const ratio = Math.min(1, (time - motion.start) / 220);
      motion.update(ratio * ratio * (3 - 2 * ratio));
      if (ratio === 1) { motions.delete(key); motion.resolve(); }
    }
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    if (controlsDirty) { updateControls(); controlsDirty = false; }
    if ([...motions.keys()].some(key => key !== 'view')) renderer.shadowMap.needsUpdate = true;
    const living = !reducedMotion.matches && !document.hidden && !presenting && !contextLost && atmosphere.visible(camera);
    if (living) atmosphere.update(time);
    renderer.render(scene, camera);
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
  function animate(key, update) {
    cancelMotion(key);
    if (reducedMotion.matches) { update(1); requestRender(); return Promise.resolve(); }
    return new Promise(resolve => {
      motions.set(key, { start: performance.now(), update, resolve });
      requestRender();
    });
  }
  function projectPoint(point) {
    const projected = point.clone().project(camera);
    return { x: (projected.x + 1) * lastWidth / 2, y: (1 - projected.y) * lastHeight / 2, depth: projected.z };
  }
  function updateControls() {
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
    const view = initialView();
    camera.position.copy(view.position);
    navigation.target.copy(view.target);
    navigation.update();
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
    highlight(null);
    active = models.get(id);
    navigation.enabled = false;
    const model = active;
    const from = model.group.position.clone();
    const lifted = model.home.clone().add(new THREE.Vector3(0, .2, 2));
    await animate('flight', t => model.group.position.lerpVectors(from, lifted, t));
    const flatRotation = model.project.kind === 'binder'
      ? new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)))
      : new THREE.Quaternion();
    const destination = new THREE.Vector3(THREE.MathUtils.clamp(navigation.target.x, -5.3, 5.3) + .5, model.project.kind === 'folder' ? -.48 : -.2, 3);
    await animate('flight', t => {
      model.group.position.lerpVectors(lifted, destination, t);
      model.group.position.y += Math.sin(t * Math.PI) * .5;
      model.group.quaternion.slerpQuaternions(model.rotation, flatRotation, t);
    });
    await animate('lid', t => { model.lid.rotation[model.axis] = model.angle * t; });
    canvas.dataset.selected = id;
  }
  async function home() {
    if (!active) return;
    const model = active;
    await animate('lid', t => { model.lid.rotation[model.axis] = model.angle * (1 - t); });
    const from = model.group.position.clone(), rotation = model.group.quaternion.clone();
    const lifted = model.home.clone().add(new THREE.Vector3(0, .2, 2));
    await animate('flight', t => {
      model.group.position.lerpVectors(from, lifted, t);
      model.group.quaternion.slerpQuaternions(rotation, model.rotation, t);
    });
    await animate('flight', t => model.group.position.lerpVectors(lifted, model.home, t));
    active = null; hovered = null;
    navigation.enabled = true;
    delete canvas.dataset.selected;
  }
  function setDetailVisible(visible) {
    presenting = visible;
    if (active) active.group.visible = !visible;
    renderer.shadowMap.needsUpdate = true;
    requestRender();
  }
  function setArea(area) {
    currentArea = area;
    highlight(null);
    resize();
  }
  function setTheme(dark) {
    scene.background = new THREE.Color(dark ? '#42463e' : '#e7e1d3');
    scene.environmentIntensity = dark ? .4 : .75;
    daylight.intensity = dark ? 1.0 : 2.5;
    ambient.intensity = dark ? .18 : .42;
    fill.intensity = dark ? .18 : .45;
    bounce.intensity = dark ? 1.2 : 4;
    renderer.toneMappingExposure = dark ? .85 : .95;
    atmosphere.setTheme(dark);
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
    });
    navigation.enabled = !active;
    navigation.update();
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
    if (active) active.group.visible = !presenting;
    document.querySelector('#desk-status').textContent = '';
    requestRender();
  });
  resize();
  setTheme(initialDark);
  return { highlight, select, home, setTheme, setArea, setDetailVisible, moveView };
}
