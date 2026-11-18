import * as THREE from '../assets/vendor/three/three.module.min.js';

const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 700px)');
const areas = {
  Llengua: { center: -3.92, width: 3.6 },
  Matemàtiques: { center: -.6, width: 2.55 },
  Medi: { center: 1.9, width: 2.45 },
  Utilitats: { center: 4.66, width: 2.8 },
};

function noiseTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const image = context.createImageData(256, 256);
  let seed = 721;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = (seed / 4294967296 - .5) * 26;
      const weave = kind === 'cloth' ? ((x % 3 === 0 ? -18 : 0) + (y % 3 === 0 ? -10 : 0)) : 0;
      const index = (y * 256 + x) * 4;
      image.data[index] = image.data[index + 1] = image.data[index + 2] = 215 + grain + weave;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'cloth' ? 2 : 3, kind === 'cloth' ? 4 : 3);
  return texture;
}

function labelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f1e9d2';
  context.fillRect(0, 0, 256, 1024);
  context.strokeStyle = '#d6c9ae';
  context.lineWidth = 8;
  context.strokeRect(4, 4, 248, 1016);
  context.translate(128, 512);
  context.rotate(-Math.PI / 2);
  context.fillStyle = '#222a22';
  let size = 70;
  context.font = '600 ' + size + 'px "Segoe UI", Arial, sans-serif';
  while (context.measureText(text).width > 912) {
    size -= 1;
    context.font = '600 ' + size + 'px "Segoe UI", Arial, sans-serif';
  }
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function pageTexture(project) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fffaf0';
  context.fillRect(0, 0, 512, 768);
  context.fillStyle = '#294438';
  context.font = 'bold 48px Georgia';
  context.fillText(project.name, 54, 90, 410);
  context.font = '22px Georgia';
  context.fillText(project.purpose, 54, 132, 410);
  context.strokeStyle = '#c4c6b7';
  context.lineWidth = 1;
  for (let y = 195; y < 680; y += 40) {
    context.beginPath(); context.moveTo(54, y); context.lineTo(458, y); context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function createDesk(options) {
  const { canvas, projects } = options;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-7, 7, 4, -4, .1, 80);
  const cloth = noiseTexture('cloth');
  const plaster = noiseTexture('plaster');
  const woodTexture = await new THREE.TextureLoader().loadAsync('../assets/desk/oak.webp');
  woodTexture.colorSpace = THREE.SRGBColorSpace;
  woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(2, 1);
  woodTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture, color: '#b8c4cf', roughness: .75, bumpMap: woodTexture, bumpScale: .016 });
  const wall = new THREE.MeshStandardMaterial({ color: '#e1d8c5', roughness: 1, bumpMap: plaster, bumpScale: .022 });
  const paper = new THREE.MeshStandardMaterial({ color: '#f0e8d5', roughness: .95 });
  const silver = new THREE.MeshStandardMaterial({ color: '#ccc8b6', roughness: .26, metalness: .72 });
  const models = new Map();
  const motions = new Map();
  let frame = 0;
  let dark = options.dark;
  let active = null;
  let hovered = null;
  let currentArea = 'Llengua';
  let viewCenter = 0;
  let lastWidth = 0;
  let lastHeight = 0;

  function block(width, height, depth, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  block(25, 12, .16, wall, 0, 2, -1.65);
  block(19, .22, 8, wood, 0, -.65, 2.2);
  block(12.2, .16, 1.9, wood, 0, 1.14, -.7);
  block(12.2, .13, .35, wood, 0, 3.65, -1.43);
  for (const x of [-6, -1.7, .68, 3.2, 6]) block(.11, 2.55, 1.9, wood, x, 2.43, -.7);
  // The back strip and desk edge retain the thickness of real timber.
  block(12.2, .1, .1, wood, 0, 1.07, .28);
  block(19, .07, .09, wood, 0, -.54, 5.9);

  const ambient = new THREE.HemisphereLight('#fff9ed', '#8c8b76', 3.1);
  scene.add(ambient);
  const key = new THREE.DirectionalLight('#fff5e6', 2.1);
  key.position.set(-4.5, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 9, bottom: -6, far: 35 });
  key.shadow.normalBias = .025;
  key.shadow.bias = -.0003;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#d9e4ed', .8);
  fill.position.set(5, 4, 4);
  scene.add(fill);

  function makeBinder(project) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: project.color, roughness: .9, bumpMap: cloth, bumpScale: .016,
    });
    const width = .45, height = 2.08, depth = 1.55;
    block(width, height, .065, material, 0, 0, depth / 2, group);
    block(.035, height, depth, material, -width / 2, 0, 0, group);
    block(.35, height - .09, depth - .13, paper, 0, 0, -.015, group);
    const lid = new THREE.Group();
    lid.position.set(width / 2, 0, depth / 2);
    block(.035, height, depth, material, 0, 0, -depth / 2, lid);
    group.add(lid);
    const innerCover = new THREE.Mesh(new THREE.PlaneGeometry(depth - .11, height - .1),
      new THREE.MeshStandardMaterial({ map: pageTexture(project), roughness: .9 }));
    innerCover.rotation.y = -Math.PI / 2;
    innerCover.position.set(-.022, 0, -depth / 2);
    lid.add(innerCover);
    const visiblePage = new THREE.Mesh(new THREE.PlaneGeometry(depth - .16, height - .14),
      new THREE.MeshStandardMaterial({ map: pageTexture(project), roughness: .95 }));
    visiblePage.rotation.y = Math.PI / 2;
    visiblePage.position.set(.179, 0, -.02);
    group.add(visiblePage);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(.32, 1.42),
      new THREE.MeshStandardMaterial({ map: labelTexture(project.name + ' · ' + project.purpose), roughness: .85 }));
    label.position.set(0, .12, depth / 2 + .035);
    group.add(label);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(.077, 32), new THREE.MeshStandardMaterial({ color: '#252820', roughness: 1 }));
    hole.position.set(0, -.81, depth / 2 + .037);
    group.add(hole);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.079, .013, 8, 36), silver);
    rim.position.copy(hole.position); rim.position.z += .004;
    group.add(rim);
    for (const y of [-.97, .97]) block(.4, .008, .014, silver, 0, y, depth / 2 + .037, group);
    group.position.set(project.x, 2.27, -.55);
    scene.add(group);
    models.set(project.id, { group, lid, material, home: group.position.clone(), quaternion: group.quaternion.clone(), project });
  }
  projects.forEach(makeBinder);

  function plant() {
    const group = new THREE.Group();
    group.position.set(-5.7, -.51, 2.15);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.29, .23, .5, 32),
      new THREE.MeshStandardMaterial({ color: '#d8cebb', roughness: 1, bumpMap: plaster, bumpScale: .03 }));
    pot.position.y = .25;
    pot.castShadow = true; group.add(pot);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(.265, .265, .035, 28), new THREE.MeshStandardMaterial({ color: '#514334' }));
    soil.position.y = .49; group.add(soil);
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0); leafShape.bezierCurveTo(-.23, .15, -.2, .47, 0, .68);
    leafShape.bezierCurveTo(.2, .47, .23, .15, 0, 0);
    const leafMaterial = new THREE.MeshStandardMaterial({ color: '#54693a', roughness: .8, side: THREE.DoubleSide });
    for (let i = 0; i < 13; i++) {
      const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape, 14), leafMaterial);
      const angle = i * 2.4;
      leaf.position.set(Math.cos(angle) * .18, .48 + (i % 4) * .105, Math.sin(angle) * .18);
      leaf.rotation.set(.3 + (i % 4) * .14, angle, Math.sin(angle) * .6);
      leaf.castShadow = true;
      group.add(leaf);
    }
    scene.add(group);
  }
  plant();

  const cup = new THREE.Group();
  cup.position.set(5.4, -.55, 2.4);
  const ceramic = new THREE.MeshStandardMaterial({ color: '#ded5c3', roughness: .9, bumpMap: plaster, bumpScale: .02 });
  const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(.22, .19, .45, 28, 1, true), ceramic);
  cupBody.position.y = .225; cupBody.castShadow = true; cup.add(cupBody);
  for (let i = 0; i < 5; i++) {
    const pencil = new THREE.Group();
    const color = ['#455b3a', '#ae6e3b', '#786847', '#d4b763', '#635c54'][i];
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.023, .023, .77, 6), new THREE.MeshStandardMaterial({ color }));
    shaft.position.y = .385; shaft.castShadow = true; pencil.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.023, .09, 6), wood);
    tip.position.y = .815; pencil.add(tip);
    pencil.position.set((i % 3 - 1) * .08, .09, (i % 2 - .5) * .1);
    pencil.rotation.z = (i - 2) * .105; cup.add(pencil);
  }
  scene.add(cup);
  const notebook = new THREE.Group();
  notebook.position.set(3.65, -.47, 4);
  notebook.rotation.y = -.14;
  block(1.18, .07, 1.55, new THREE.MeshStandardMaterial({ color: '#b58155', roughness: .85, bumpMap: cloth, bumpScale: .01 }), 0, 0, 0, notebook);
  block(1.1, .045, 1.45, paper, .02, .04, 0, notebook);
  scene.add(notebook);

  function projectPoint(point) {
    const projected = point.clone().project(camera);
    return { x: (projected.x + 1) * lastWidth / 2, y: (1 - projected.y) * lastHeight / 2 };
  }

  function updateControls() {
    for (const model of models.values()) {
      const { project, home } = model;
      const visible = !narrow.matches || project.area === currentArea;
      project.button.hidden = !visible;
      project.button.tabIndex = visible ? 0 : -1;
      if (!visible) continue;
      // Reserve the full hover excursion so the target cannot slide out from under the pointer.
      const corners = [];
      for (const x of [-.27, .27]) for (const y of [-1.06, 1.06]) for (const z of [.82, 1.12]) {
        corners.push(projectPoint(home.clone().add(new THREE.Vector3(x, y, z))));
      }
      const left = Math.min(...corners.map(p => p.x)), top = Math.min(...corners.map(p => p.y));
      Object.assign(project.button.style, {
        left: left + 'px', top: top + 'px',
        width: (Math.max(...corners.map(p => p.x)) - left) + 'px',
        height: (Math.max(...corners.map(p => p.y)) - top) + 'px',
      });
    }
    for (const [area, settings] of Object.entries(areas)) {
      const label = projects.find(project => project.area === area).areaLabel;
      label.hidden = narrow.matches;
      const point = projectPoint(new THREE.Vector3(settings.center, 3.98, .0));
      label.style.left = point.x + 'px'; label.style.top = point.y + 'px';
    }
  }

  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    lastWidth = width; lastHeight = height;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const viewWidth = narrow.matches ? Math.max(4.1, aspect * 6.3) : Math.max(13.7, aspect * 6.7);
    const viewHeight = viewWidth / aspect;
    camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    viewCenter = narrow.matches ? areas[currentArea].center : 0;
    const targetHeight = narrow.matches && height < 600 ? 2.25 : 1.75;
    camera.position.set(viewCenter, targetHeight + 4.25, 12);
    camera.lookAt(viewCenter, targetHeight, .0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    updateControls();
    requestRender();
  }

  function requestRender() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  function render(time) {
    frame = 0;
    for (const [key, motion] of motions) {
      const ratio = Math.min(1, (time - motion.start) / motion.duration);
      const eased = ratio * ratio * (3 - 2 * ratio);
      motion.update(eased);
      if (ratio === 1) { motions.delete(key); motion.resolve(); }
    }
    renderer.render(scene, camera);
    if (motions.size) requestRender();
  }
  function animate(key, update) {
    const existing = motions.get(key);
    if (existing) { motions.delete(key); existing.resolve(); }
    if (motionPreference.matches) { update(1); requestRender(); return Promise.resolve(); }
    return new Promise(resolve => {
      motions.set(key, { start: performance.now(), duration: 220, update, resolve });
      requestRender();
    });
  }

  function highlight(id) {
    if (active || hovered === id) return;
    hovered = id;
    for (const [key, model] of models) {
      const start = model.group.position.z;
      const target = model.home.z + (key === id ? .36 : 0);
      const rotation = model.group.rotation.x;
      animate('hover-' + key, t => {
        model.group.position.z = THREE.MathUtils.lerp(start, target, t);
        model.group.rotation.x = THREE.MathUtils.lerp(rotation, key === id ? -.025 : 0, t);
      });
    }
  }

  async function select(id) {
    highlight(null);
    active = models.get(id);
    const model = active;
    const start = model.group.position.clone();
    const shelfFront = model.home.clone().add(new THREE.Vector3(0, 0, 2));
    model.group.rotation.set(0, 0, 0);
    await animate('flight', t => model.group.position.lerpVectors(start, shelfFront, t));
    const openRotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)));
    const destination = new THREE.Vector3(viewCenter + .6, -.25, 3.1);
    await animate('flight', t => {
      model.group.position.lerpVectors(shelfFront, destination, t);
      model.group.position.y += Math.sin(t * Math.PI) * .55;
      model.group.quaternion.slerpQuaternions(model.quaternion, openRotation, t);
    });
    await animate('lid', t => { model.lid.rotation.y = -Math.PI * t; });
    canvas.dataset.selected = id;
  }

  async function home() {
    if (!active) return;
    const model = active;
    await animate('lid', t => { model.lid.rotation.y = -Math.PI * (1 - t); });
    const start = model.group.position.clone(), rotation = model.group.quaternion.clone();
    const shelfFront = model.home.clone().add(new THREE.Vector3(0, 0, 2));
    await animate('flight', t => {
      model.group.position.lerpVectors(start, shelfFront, t);
      model.group.position.y += Math.sin(t * Math.PI) * .5;
      model.group.quaternion.slerpQuaternions(rotation, model.quaternion, t);
    });
    await animate('flight', t => model.group.position.lerpVectors(shelfFront, model.home, t));
    active = null; hovered = null;
    delete canvas.dataset.selected;
  }

  function setTheme(isDark) {
    dark = isDark;
    wall.color.set(dark ? '#6c6f60' : '#e1d8c5');
    ambient.intensity = dark ? 1.7 : 3.1;
    key.intensity = dark ? 1.1 : 2.1;
    fill.intensity = dark ? .35 : .8;
    renderer.toneMappingExposure = dark ? .9 : 1.05;
    scene.background = new THREE.Color(dark ? '#2b332b' : '#e1d8c5');
    requestRender();
  }
  function setArea(area) {
    highlight(null);
    currentArea = area;
    resize();
  }
  function setDetailVisible(visible) {
    if (active) active.group.visible = !visible;
    requestRender();
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  narrow.addEventListener('change', resize);
  motionPreference.addEventListener('change', () => {
    for (const motion of motions.values()) { motion.update(1); motion.resolve(); }
    motions.clear(); requestRender();
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    document.querySelector('#projectes').classList.add('is-open');
    document.querySelector('.list-toggle').setAttribute('aria-expanded', 'true');
    document.querySelector('#desk-status').textContent = 'L’escriptori s’ha pausat. Pots continuar des de Projectes.';
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    document.querySelector('#desk-status').textContent = '';
    requestRender();
  });
  resize(); setTheme(dark);
  return { highlight, select, home, setTheme, setArea, setDetailVisible };
}
