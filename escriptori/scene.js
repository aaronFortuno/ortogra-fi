import * as THREE from 'three';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from '../assets/vendor/three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from '../assets/vendor/three/addons/controls/OrbitControls.js';

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

function surfaceNormal(kind) {
  const side = 128;
  const data = new Uint8Array(side * side * 4);
  const height = (x, y) => {
    const grain = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const random = grain - Math.floor(grain);
    return kind === 'cloth'
      ? Math.sin(x * Math.PI / 2) * .22 + Math.sin(y * Math.PI / 2) * .18 + random * .06
      : random * .1;
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
  texture.repeat.set(kind === 'cloth' ? 3 : 6, kind === 'cloth' ? 7 : 6);
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 75);
  const navigation = new OrbitControls(camera, canvas);
  navigation.enableDamping = false;
  navigation.enablePan = false;
  navigation.minAzimuthAngle = -.43;
  navigation.maxAzimuthAngle = .43;
  navigation.minPolarAngle = .72;
  navigation.maxPolarAngle = 1.5;
  navigation.minDistance = 7;
  navigation.maxDistance = 23;
  navigation.rotateSpeed = .45;
  navigation.zoomSpeed = .65;
  navigation.touches.ONE = THREE.TOUCH.ROTATE;
  navigation.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment, .08).texture;
  environment.dispose();
  pmrem.dispose();
  const ambient = new THREE.HemisphereLight('#fff8e9', '#92957f', .3);
  scene.add(ambient);
  const daylight = new THREE.DirectionalLight('#fff4df', 3.2);
  daylight.position.set(-5.5, 8, 5);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  Object.assign(daylight.shadow.camera, { left: -9, right: 9, top: 8, bottom: -5, near: .5, far: 30 });
  daylight.shadow.normalBias = .025;
  daylight.shadow.bias = -.0002;
  daylight.shadow.radius = 4;
  scene.add(daylight);
  const fill = new THREE.DirectionalLight('#e0ebf2', .45);
  fill.position.set(5, 5, 4);
  scene.add(fill);

  const asset = await new GLTFLoader().loadAsync(new URL('../assets/desk/escriptori.glb?v=1.1.0', import.meta.url).href);
  const room = asset.scene;
  scene.add(room);
  const clothNormal = surfaceNormal('cloth');
  const plasterNormal = surfaceNormal('plaster');
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
        material.normalScale.set(.36, .36);
        material.roughness = .66;
        material.color.multiplyScalar(.78);
      }
      if (material.name.startsWith('Plaster') || material.name.startsWith('Ceramic')) {
        material.normalMap = plasterNormal;
        material.normalScale.set(.22, .22);
      }
      if (material.name.startsWith('Oak')) material.roughness = .65;
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

  function requestRender() {
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
    updateControls();
    renderer.render(scene, camera);
    if (motions.size) requestRender();
  }
  function animate(key, update) {
    if (motions.has(key)) {
      motions.get(key).resolve();
      motions.delete(key);
    }
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
      project.button.hidden = right < 0 || left > lastWidth || bottom < 0 || top > lastHeight;
      project.button.tabIndex = project.button.hidden ? -1 : 0;
      Object.assign(project.button.style, {
        left: left + 'px', top: top + 'px', width: (right - left) + 'px', height: (bottom - top) + 'px',
      });
    }
    for (const [area, settings] of Object.entries(areas)) {
      const label = projects.find(project => project.area === area).areaLabel;
      const point = projectPoint(new THREE.Vector3(...settings.label));
      label.hidden = narrow.matches || point.x < 0 || point.x > lastWidth;
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
    navigation.maxDistance = Math.max(23, camera.position.distanceTo(navigation.target) * 1.4);
    navigation.minDistance = narrow.matches ? 5 : 7;
    navigation.update();
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    updateControls();
    requestRender();
  }
  navigation.addEventListener('change', requestRender);
  navigation.addEventListener('start', () => {
    canvas.parentElement.classList.add('is-exploring');
    highlight(null);
  });

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
    const destination = new THREE.Vector3(navigation.target.x + .5, model.project.kind === 'folder' ? -.48 : -.2, 3);
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
    daylight.intensity = dark ? 1.0 : 2.7;
    ambient.intensity = dark ? .18 : .3;
    fill.intensity = dark ? .18 : .45;
    renderer.toneMappingExposure = dark ? .85 : .95;
    requestRender();
  }
  async function moveView(action) {
    if (active) return;
    canvas.parentElement.classList.toggle('is-exploring', action !== 'home');
    const from = camera.position.clone(), previousTarget = navigation.target.clone();
    let target = previousTarget.clone(), position = from.clone();
    if (action === 'home') {
      ({ target, position } = initialView());
    } else if (action === 'in' || action === 'out') {
      const direction = from.clone().sub(target);
      const distance = THREE.MathUtils.clamp(direction.length() * (action === 'in' ? .83 : 1.2), navigation.minDistance, navigation.maxDistance);
      position = target.clone().add(direction.setLength(distance));
    } else {
      const offset = from.clone().sub(target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta = THREE.MathUtils.clamp(spherical.theta + (action === 'left' ? -.2 : .2), -.43, .43);
      position = target.clone().add(new THREE.Vector3().setFromSpherical(spherical));
    }
    navigation.enabled = false;
    await animate('view', t => {
      camera.position.lerpVectors(from, position, t);
      navigation.target.lerpVectors(previousTarget, target, t);
      camera.lookAt(navigation.target);
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
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    document.querySelector('#projectes').classList.add('is-open');
    document.querySelector('.list-toggle').setAttribute('aria-expanded', 'true');
    document.querySelector('#desk-status').textContent = 'L’escriptori s’ha pausat. Pots continuar des de Projectes.';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (active) active.group.visible = !presenting;
    document.querySelector('#desk-status').textContent = '';
    requestRender();
  });
  resize();
  setTheme(initialDark);
  return { highlight, select, home, setTheme, setArea, setDetailVisible, moveView };
}
