import * as THREE from 'three';

// Project the readable HTML onto the actual paper, in CSS pixels. Keeping the
// projection in canvas coordinates also supports browser and display scaling.
export function createReadingPages(detail, paperMaterial) {
  const elements = [detail.querySelector('.sample-page'), detail.querySelector('.description-page')];
  const pages = elements.map(element => ({ element, anchor: new THREE.Object3D() }));
  const sheet = (name, pageIndex = 0) => {
    // Preserve the PDF's ink contrast; light still shades the physical paper edges.
    const ink = new THREE.MeshBasicMaterial({ color: '#fbfdff', toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .0015), [paperMaterial, paperMaterial, paperMaterial, paperMaterial, ink, paperMaterial]);
    mesh.name = name; mesh.castShadow = true;
    // Millimetre-thin stacked sheets must not cast self-shadow stripes on ink.
    mesh.receiveShadow = false;
    pages[pageIndex].anchor.add(mesh);
    return { mesh, ink };
  };
  const front = sheet('PrintedSample'), back = sheet('SecondSample');
  const answerFront = sheet('PrintedAnswer', 1), answerBack = sheet('SecondAnswer', 1);
  const hit = detail.querySelector('#sample-open');
  const answerHit = detail.querySelector('#sample-open-answers');
  let kind;
  let currentModel, currentIndex = 0, paired = false, shown = [0, 0];
  function mount(model) {
    kind = model.project.kind;
    currentModel = model; currentIndex = 0;
    const definitions = kind === 'binder' ? [
      { parent: model.lid, position: [-.029, 0, -.754], rotation: [0, -Math.PI / 2, 0], size: [1.33, 1.84] },
      { parent: model.group, position: [.174, 0, 0], rotation: [0, Math.PI / 2, 0], size: [1.33, 1.84] },
    ] : kind === 'folder' ? [
      { parent: model.lid, position: [.925, -.044, 0], rotation: [Math.PI / 2, 0, Math.PI], size: [1.56, 2.05] },
      { parent: model.group, position: [0, .008, 0], rotation: [-Math.PI / 2, 0, 0], size: [1.56, 2.05] },
    ] : [
      { parent: model.group, position: [0, -.225, 0], rotation: [-Math.PI / 2, 0, 0], size: [1.62, 1.03] },
      { parent: model.group, position: [2.05, -.328, 0], rotation: [-Math.PI / 2, 0, 0], size: [1.43, 1.99] },
    ];
    pages.forEach((page, index) => {
      const definition = definitions[index];
      definition.parent.add(page.anchor);
      page.anchor.position.set(...definition.position);
      page.anchor.rotation.set(...definition.rotation);
      page.size = definition.size;
      page.width = 400;
      page.height = Math.round(page.width * definition.size[1] / definition.size[0]);
      page.element.style.width = page.width + 'px';
      page.element.style.height = page.height + 'px';
    });
    if (!model.sampleTextures?.length) model.sampleTextures = [{ texture: model.previewTexture ||= fallbackSample(detail), image: model.project.preview, title: 'Mostra de ' + model.project.name }];
    paired = model.sampleTextures.some(sample => sample.role === 'answers');
    shown = [0, Math.max(0, model.sampleTextures.findIndex(sample => sample.role === 'answers'))];
    detail.dataset.paired = String(paired);
    answerFront.mesh.visible = paired;
    answerBack.mesh.visible = paired;
    answerHit.hidden = !paired;
    if (paired) drawPage(1);
    setIndex(0);
  }
  function drawPage(pageIndex) {
    const samples = currentModel.sampleTextures;
    const role = pageIndex ? 'answers' : 'worksheet';
    const group = samples.filter(sample => (sample.role || 'worksheet') === role);
    const selected = samples[shown[pageIndex]];
    const next = group[(group.indexOf(selected) + 1) % group.length];
    const [top, under] = pageIndex ? [answerFront, answerBack] : [front, back];
    for (const [piece, sample] of [[top, selected], [under, next]]) {
      piece.ink.map = sample.texture; piece.ink.needsUpdate = true;
      const aspect = sample.texture.image.width / sample.texture.image.height;
      const width = Math.min(pages[pageIndex].size[0] * .985, pages[pageIndex].size[1] * .995 * aspect);
      piece.mesh.scale.set(width, width / aspect, 1);
    }
    under.mesh.visible = group.length > 1;
    under.mesh.position.set(.012, .012, .004);
    under.mesh.rotation.z = .012;
    top.mesh.position.set(0, 0, .008);
    top.mesh.rotation.z = -.004;
    const button = pageIndex ? answerHit : hit;
    button.setAttribute('aria-label', 'Amplia ' + (pageIndex ? 'el solucionari' : 'la fitxa') + ': ' + selected.title);
    button.dataset.index = String(shown[pageIndex]);
  }
  function setIndex(index) {
    const samples = currentModel.sampleTextures;
    currentIndex = (index + samples.length) % samples.length;
    const pageIndex = samples[currentIndex].role === 'answers' ? 1 : 0;
    shown[pageIndex] = currentIndex;
    drawPage(pageIndex);
    detail.dataset.sampleCount = String(samples.length);
  }
  function corners(page) {
    const [w, h] = page.size;
    return [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]]
      .map(([x, y]) => page.anchor.localToWorld(new THREE.Vector3(x, y, 0)));
  }
  function points(narrow) {
    return (narrow ? (paired ? pages.slice(0, 1) : pages.slice(1)) : pages).flatMap(corners);
  }
  function project(camera, rect) {
    Object.assign(detail.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    for (const [index, page] of pages.entries()) {
      if (!page.size) continue;
      if (paired && index === 1) continue;
      const quad = corners(page).map(point => {
        point.project(camera);
        return { x: (point.x + 1) * rect.width / 2, y: (1 - point.y) * rect.height / 2 };
      });
      page.element.style.transform = planeTransform(quad, page.width, page.height);
    }
    for (const [piece, button, role] of [[front, hit, 'worksheet'], [answerFront, answerHit, 'answers']]) {
      if (role === 'answers' && !paired) continue;
      const quad = [[-.5, .5], [.5, .5], [.5, -.5], [-.5, -.5]].map(([x, y]) => {
        const point = piece.mesh.localToWorld(new THREE.Vector3(x, y, .001)).project(camera);
        return { x: (point.x + 1) * rect.width / 2, y: (1 - point.y) * rect.height / 2 };
      });
      const aspect = piece.mesh.scale.x / piece.mesh.scale.y;
      button.style.width = '400px'; button.style.height = (400 / aspect) + 'px';
      button.style.transform = planeTransform(quad, 400, 400 / aspect);
    }
    detail.dataset.surface = kind;
  }
  return { mount, points, project, setIndex, info: () => ({ index: currentIndex, paired, samples: currentModel?.sampleTextures || [] }) };
}

function fallbackSample(detail) {
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 560;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, 400, 560);
  context.fillStyle = '#293c31'; context.font = 'bold 29px Georgia';
  context.fillText(detail.querySelector('.sample-sheet h3').textContent, 22, 54);
  context.font = '17px Georgia';
  [...detail.querySelectorAll('.sample-sheet p')].forEach((element, index) => context.fillText(element.textContent, 22, 110 + index * 65));
  context.strokeStyle = '#bcc3b3';
  for (let y = 240; y < 510; y += 38) { context.beginPath(); context.moveTo(22, y); context.lineTo(378, y); context.stroke(); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function planeTransform([p0, p1, p2, p3], width, height) {
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < 1e-9) return 'scale(0)';
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y;
  return `matrix3d(${a / width},${d / width},0,${g / width},${b / height},${e / height},0,${h / height},0,0,1,0,${p0.x},${p0.y},0,1)`;
}
