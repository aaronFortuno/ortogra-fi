import * as THREE from 'three';

// Samples stay on physical paper. HTML supplies only hit areas and the external
// information panel; enlarging never replaces the scene with another picture.
export function createReadingPages(detail, paperMaterial) {
  const pages = [0, 1].map(() => ({ anchor: new THREE.Object3D() }));
  const hit = detail.querySelector('#sample-open');
  const secondHit = detail.querySelector('#sample-open-answers');
  const previous = detail.querySelector('#page-corner-previous');
  const next = detail.querySelector('#page-corner-next');
  let currentModel, currentIndex = 1, shown = [], turning = false;
  const sheet = (name, pageIndex, curved) => {
    const ink = new THREE.MeshBasicMaterial({ color: '#fbfdff', toneMapped: false, side: THREE.DoubleSide, transparent: true });
    ink.onBeforeCompile = shader => {
      shader.vertexShader = 'varying float leafLight;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nleafLight = .78 + .22 * abs(normal.z);');
      shader.fragmentShader = 'varying float leafLight;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(.94, .95, .92);\ndiffuseColor.rgb *= leafLight;');
    };
    ink.customProgramCacheKey = () => 'sample-leaf-v2';
    const geometry = new THREE.PlaneGeometry(1, 1, curved ? 30 : 1, curved ? 38 : 1);
    const mesh = new THREE.Mesh(geometry, ink);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = false;
    pages[pageIndex].anchor.add(mesh);
    return { mesh, ink, rest: geometry.attributes.position.array.slice() };
  };
  for (const [index, page] of pages.entries()) {
    page.under = sheet(index ? 'SecondAnswer' : 'SecondSample', index, false);
    page.top = sheet(index ? 'PrintedAnswer' : 'PrintedSample', index, true);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .004), paperMaterial);
    edge.castShadow = true; edge.receiveShadow = true; edge.position.z = .001;
    page.anchor.add(edge); page.edge = edge;
  }
  function mount(model) {
    currentModel = model; currentIndex = Math.min(1, model.project.examples.length - 1); turning = false;
    const kind = model.project.kind;
    const definitions = kind === 'binder' ? [
      { parent: model.lid, position: [-.029, 0, -.754], rotation: [0, -Math.PI / 2, 0], size: [1.33, 1.84] },
      { parent: model.group, position: [.174, 0, 0], rotation: [0, Math.PI / 2, 0], size: [1.33, 1.84] },
    ] : kind === 'folder' ? [
      { parent: model.lid, position: [.925, -.044, 0], rotation: [Math.PI / 2, 0, Math.PI], size: [1.56, 2.05] },
      { parent: model.group, position: [0, .008, 0], rotation: [-Math.PI / 2, 0, 0], size: [1.56, 2.05] },
    ] : [
      { parent: model.group, position: [0, -.225, 0], rotation: [-Math.PI / 2, 0, 0], size: [1.62, 1.03] },
      { parent: model.group, position: [2.05, -.328, 0], rotation: [-Math.PI / 2, 0, 0], size: [1.68, 1.11] },
    ];
    pages.forEach((page, index) => {
      const definition = definitions[index];
      definition.parent.add(page.anchor);
      page.anchor.position.set(...definition.position); page.anchor.rotation.set(...definition.rotation);
      page.size = definition.size;
    });
    detail.dataset.surface = kind;
    setIndex(currentIndex);
  }
  const examplePages = index => currentModel.sampleTextures.filter(sample => sample.exampleIndex === index).slice(0, 2);
  function paint(piece, sample, page) {
    piece.ink.map = sample.texture; piece.ink.needsUpdate = true;
    const aspect = sample.texture.image.width / sample.texture.image.height;
    const width = Math.min(page.size[0] * .985, page.size[1] * .995 * aspect);
    piece.mesh.scale.set(width, width / aspect, 1);
  }
  function resetLeaf(page) {
    page.top.mesh.position.set(0, 0, .009); page.top.mesh.rotation.set(0, 0, -.004);
    page.top.ink.opacity = 1; page.top.mesh.visible = true;
    bend(page.top, 0, 1);
  }
  function setIndex(index) {
    currentIndex = Math.max(0, Math.min(currentModel.project.examples.length - 1, index));
    shown = examplePages(currentIndex);
    for (const [index, page] of pages.entries()) {
      const sample = shown[index];
      page.anchor.visible = Boolean(sample);
      if (!sample) continue;
      paint(page.top, sample, page); paint(page.under, sample, page);
      page.under.mesh.position.set(.008, .008, .005); page.under.mesh.rotation.z = .009;
      page.edge.scale.set(page.top.mesh.scale.x, page.top.mesh.scale.y, 1);
      resetLeaf(page);
      const button = index ? secondHit : hit;
      button.setAttribute('aria-label', 'Amplia: ' + sample.title); button.dataset.index = String(index);
    }
    secondHit.hidden = !shown[1];
    detail.dataset.sampleCount = String(currentModel.project.examples.length);
    detail.dataset.sampleIndex = String(currentIndex);
    detail.dataset.paired = String(shown[1]?.role === 'answers');
  }
  function bend(piece, amount, direction) {
    const vertices = piece.mesh.geometry.attributes.position;
    const n = Math.SQRT1_2, radius = .32, curvature = amount * 3.4;
    for (let i = 0; i < vertices.count; i++) {
      const x = piece.rest[i * 3], y = piece.rest[i * 3 + 1];
      const d = Math.max(0, (direction * x - y) * n - (n - radius));
      const angle = d * curvature;
      const shorten = curvature ? d - Math.sin(angle) / curvature : 0;
      vertices.setXYZ(i, x - direction * n * shorten, y + n * shorten, curvature ? (1 - Math.cos(angle)) / curvature : 0);
    }
    vertices.needsUpdate = true; piece.mesh.geometry.computeVertexNormals();
    piece.mesh.geometry.computeBoundingSphere();
  }
  function curl(direction, amount, narrow) {
    if (turning || !currentModel) return;
    const page = pages[narrow || direction < 0 ? 0 : 1];
    if (page.anchor.visible) bend(page.top, amount, direction);
    detail.dataset.curl = amount ? String(direction) : '';
  }
  function startTurn(index) {
    turning = true;
    const incoming = examplePages(index);
    pages.forEach((page, i) => { if (incoming[i]) paint(page.under, incoming[i], page); });
  }
  function turn(progress, direction, narrow) {
    for (const [i, page] of pages.entries()) {
      if (!page.anchor.visible) continue;
      const lead = narrow ? 0 : direction > 0 ? 1 : 0;
      if (i === lead) {
        bend(page.top, Math.sin(progress * Math.PI) * 1.4, direction);
        page.top.mesh.rotation.y = direction * progress * 1.6;
        page.top.mesh.position.z = .009 + Math.sin(progress * Math.PI) * .2;
        page.top.mesh.position.x = -direction * progress * .22;
      }
      page.top.ink.opacity = 1 - progress;
    }
  }
  function finishTurn(index) { turning = false; setIndex(index); detail.dataset.curl = ''; }
  function corners(page) {
    const mesh = page.top.mesh;
    return [[-.5, .5], [.5, .5], [.5, -.5], [-.5, -.5]].map(([x, y]) => mesh.localToWorld(new THREE.Vector3(x, y, .001)));
  }
  function points(narrow) {
    return (narrow ? pages.slice(0, 1) : pages).filter(page => page.anchor.visible).flatMap(corners);
  }
  function sheetView(index) {
    const quad = corners(pages[index]);
    const right = quad[1].clone().sub(quad[0]); const up = quad[0].clone().sub(quad[3]);
    return { center: quad[0].clone().add(quad[2]).multiplyScalar(.5), width: right.length(), height: up.length(),
      right: right.normalize(), up: up.normalize(), normal: new THREE.Vector3().crossVectors(right, up).normalize() };
  }
  function project(camera, rect) {
    Object.assign(detail.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    const projectPoint = point => {
      point.project(camera);
      return { x: (point.x + 1) * rect.width / 2, y: (1 - point.y) * rect.height / 2 };
    };
    const quads = pages.map(page => page.anchor.visible ? corners(page).map(projectPoint) : null);
    for (const [index, button] of [hit, secondHit].entries()) {
      if (!quads[index]) continue;
      const mesh = pages[index].top.mesh;
      const height = 400 * mesh.scale.y / mesh.scale.x;
      button.style.width = '400px'; button.style.height = height + 'px';
      button.style.transform = planeTransform(quads[index], 400, height);
    }
    const mobile = rect.width <= 700;
    for (const [button, direction] of [[previous, -1], [next, 1]]) {
      const quad = quads[mobile || direction < 0 ? 0 : 1] || quads[0];
      const point = quad[direction < 0 ? 3 : 2];
      button.style.left = Math.max(0, Math.min(rect.width - 44, point.x - (direction < 0 ? 0 : 44))) + 'px';
      button.style.top = Math.max(0, Math.min(rect.height - 44, point.y - 44)) + 'px';
    }
  }
  function unmount() {
    for (const page of pages) {
      page.anchor.removeFromParent();
      for (const piece of [page.top, page.under]) { piece.ink.map = null; piece.ink.needsUpdate = true; }
    }
    currentModel = null; shown = [];
  }
  return { mount, unmount, points, project, setIndex, sheetView, curl, startTurn, turn, finishTurn,
    info: () => ({ index: currentIndex, count: currentModel?.project.examples.length || 0, pages: shown, paired: shown[1]?.role === 'answers' }) };
}

function planeTransform([p0, p1, p2, p3], width, height) {
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < 1e-9) return 'scale(0)';
  const g = (dx3 * dy2 - dx2 * dy3) / determinant, h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y;
  return `matrix3d(${a / width},${d / width},0,${g / width},${b / height},${e / height},0,${h / height},0,0,1,0,${p0.x},${p0.y},0,1)`;
}
