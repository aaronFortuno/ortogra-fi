import * as THREE from 'three';

// Samples stay on physical paper. HTML supplies only hit areas and the external
// information panel; enlarging never replaces the scene with another picture.
export function createReadingPages(detail, paperMaterial) {
  const pages = [0, 1].map(() => ({ anchor: new THREE.Object3D() }));
  const hit = detail.querySelector('#sample-open');
  const secondHit = detail.querySelector('#sample-open-answers');
  const previous = detail.querySelector('#page-corner-previous');
  const next = detail.querySelector('#page-corner-next');
  let currentModel, currentIndex = 1, shown = [], turning = false, leaf;
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
      page.size = definition.size;
      if (model.project.reliefs?.length) { page.anchor.removeFromParent(); return; }
      definition.parent.add(page.anchor);
      page.anchor.position.set(...definition.position); page.anchor.rotation.set(...definition.rotation);
    });
    detail.dataset.surface = kind;
    setIndex(currentIndex);
  }
  const examplePages = index => currentModel.sampleTextures.filter(sample => sample.exampleIndex === index).slice(0, currentModel.project.reliefs?.length ? 3 : 2);
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
      // Keep the printed layers aligned; startTurn raises the exposed page to
      // the same visible surface as the sheet that is being lifted.
      page.under.mesh.position.set(0, 0, .006); page.under.mesh.rotation.z = -.004;
      page.edge.scale.set(page.top.mesh.scale.x, page.top.mesh.scale.y, 1);
      resetLeaf(page);
      if (currentModel.project.reliefs?.length) {
        page.top.mesh.visible = page.under.mesh.visible = page.edge.visible = false;
      } else page.under.mesh.visible = page.edge.visible = true;
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
    if (currentModel.project.reliefs?.length) return;
    // A sheet is attached to the binding throughout its journey. Work in world
    // coordinates because the two covers have different parents and rotations.
    pages.forEach(resetLeaf);
    currentModel.group.updateWorldMatrix(true, true);
    const direction = Math.sign(index - currentIndex), source = direction > 0 ? 1 : 0, destination = 1 - source;
    const quads = pages.map(corners), from = quads[source], to = quads[destination];
    const midpoint = (a, b) => a.clone().add(b).multiplyScalar(.5);
    const spineTop = midpoint(quads[0][1], quads[1][0]);
    const spineBottom = midpoint(quads[0][2], quads[1][3]);
    const hinge = midpoint(spineTop, spineBottom), axis = spineTop.clone().sub(spineBottom).normalize();
    const outward = (quad, side) => midpoint(quad[side ? 1 : 0], quad[side ? 2 : 3])
      .sub(midpoint(quad[side ? 0 : 1], quad[side ? 3 : 2])).normalize();
    const startOut = outward(from, source), endOut = outward(to, destination);
    let angle = Math.atan2(axis.dot(new THREE.Vector3().crossVectors(startOut, endOut)), startOut.dot(endOut));
    // Right-to-left rises over the rings; the reverse follows the same arc.
    if (direction > 0 && angle >= 0) angle -= Math.PI * 2;
    if (direction < 0 && angle <= 0) angle += Math.PI * 2;
    const geometry = new THREE.PlaneGeometry(1, 1, 32, 40);
    const material = new THREE.MeshBasicMaterial({ map: shown[source].texture, side: THREE.DoubleSide, toneMapped: false });
    material.onBeforeCompile = shader => {
      shader.uniforms.leafBack = { value: incoming[destination].texture };
      shader.fragmentShader = 'uniform sampler2D leafBack;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor *= texture2D(leafBack, vec2(1.0 - vMapUv.x, vMapUv.y));');
      // Replace, rather than multiply by, the front print on the reverse.
      shader.fragmentShader = shader.fragmentShader.replace('diffuseColor *= texture2D(leafBack,', 'diffuseColor = vec4(diffuse, opacity) * texture2D(leafBack,');
    };
    material.customProgramCacheKey = () => 'bound-leaf-front-back-v1';
    const mesh = new THREE.Mesh(geometry, material); mesh.name = 'TurningLeaf'; mesh.castShadow = true;
    currentModel.group.add(mesh);
    const inverse = currentModel.group.matrixWorld.clone().invert();
    const vertices = geometry.attributes.position, starts = [], corrections = [], distances = [];
    const fullRotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i);
      const start = pages[source].top.mesh.localToWorld(new THREE.Vector3(x, y, .002));
      const end = pages[destination].top.mesh.localToWorld(new THREE.Vector3(-x, y, .002));
      starts.push(start.clone().sub(hinge));
      corrections.push(end.sub(start.clone().sub(hinge).applyQuaternion(fullRotation).add(hinge)));
      distances.push(source ? x + .5 : .5 - x);
    }
    const normal = sheetView(source).normal;
    leaf = { mesh, starts, corrections, distances, hinge, axis, angle, inverse, normal, direction, progress: 0 };
    // The exposed page uses the same surface as the sheet being lifted, above
    // every cover/paper mesh. It is present from the very first turning frame.
    pages[source].under.mesh.position.copy(pages[source].top.mesh.position);
    pages[source].under.mesh.rotation.copy(pages[source].top.mesh.rotation);
    pages[source].under.mesh.position.z -= .0001;
    pages[source].under.mesh.visible = true;
    pages[source].top.mesh.visible = false;
    turn(0);
  }
  function turn(progress) {
    if (!leaf) return;
    const rotation = new THREE.Quaternion().setFromAxisAngle(leaf.axis, leaf.angle * progress);
    const normal = leaf.normal.clone().applyQuaternion(rotation), vertices = leaf.mesh.geometry.attributes.position;
    const settle = THREE.MathUtils.smoothstep(progress, .6, 1);
    for (let i = 0; i < vertices.count; i++) {
      const flex = Math.sin(Math.PI * progress) * Math.sin(Math.PI * leaf.distances[i]) * .105;
      const point = leaf.starts[i].clone().applyQuaternion(rotation).add(leaf.hinge)
        .addScaledVector(leaf.corrections[i], settle).addScaledVector(normal, flex).applyMatrix4(leaf.inverse);
      vertices.setXYZ(i, point.x, point.y, point.z);
    }
    vertices.needsUpdate = true; leaf.mesh.geometry.computeVertexNormals(); leaf.mesh.geometry.computeBoundingSphere();
    leaf.progress = progress;
  }
  function discardLeaf() {
    if (!leaf) return;
    leaf.mesh.removeFromParent(); leaf.mesh.geometry.dispose(); leaf.mesh.material.dispose(); leaf = null;
  }
  function finishTurn(index) { discardLeaf(); turning = false; setIndex(index); detail.dataset.curl = ''; }
  function corners(page) {
    const mesh = page.top.mesh;
    return [[-.5, .5], [.5, .5], [.5, -.5], [-.5, -.5]].map(([x, y]) => mesh.localToWorld(new THREE.Vector3(x, y, .001)));
  }
  function points(narrow) {
    if (currentModel?.project.reliefs?.length) return [];
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
    if (currentModel?.project.reliefs?.length) return;
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
    discardLeaf();
    for (const page of pages) {
      page.anchor.removeFromParent();
      for (const piece of [page.top, page.under]) { piece.ink.map = null; piece.ink.needsUpdate = true; }
    }
    currentModel = null; shown = [];
  }
  return { mount, unmount, points, project, setIndex, sheetView, curl, startTurn, turn, finishTurn,
    info: () => ({ index: currentIndex, count: currentModel?.project.examples.length || 0, pages: shown, paired: shown[1]?.role === 'answers',
      turn: leaf ? { progress: leaf.progress, direction: leaf.direction, hinge: leaf.hinge.toArray(), angle: leaf.angle, opacity: leaf.mesh.material.opacity } : null }) };
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
