import * as THREE from 'three';
import { deskLayout } from './desk-layout.js?v=1.10.0';
import { createPropContacts } from './prop-contact.js?v=1.22.0';

// Local ambient occlusion at actual furniture joints. The GLB already contains
// broad static AO; these narrow gradients restore the contact that its shared
// lightmap cannot resolve. No screen-space pass or extra light is involved.
export function createContactShadows(room,bodies=()=>[]) {
  room.updateMatrixWorld(true);
  const root = new THREE.Group();
  root.name = 'ContactOcclusion';
  room.add(root);
  const positions = [], uvs = [], indices = [];
  const addStrip = ({ width, height, position, horizontal = false, across = false, reverse = false }) => {
    const geometry = new THREE.PlaneGeometry(width, height);
    if (horizontal) geometry.rotateX(-Math.PI / 2);
    geometry.translate(...position);
    const p = geometry.attributes.position, uv = geometry.attributes.uv;
    const start = positions.length / 3;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      let u = uv.getX(i), v = uv.getY(i);
      if (across) [u, v] = [v, u];
      uvs.push(u, reverse ? 1 - v : v);
    }
    for (const index of geometry.index.array) indices.push(index + start);
    geometry.dispose();
  };
  const organizer = deskLayout.organizer, table = deskLayout.table;
  const backingContactZ = organizer.backingFrontZ + .0035;
  // All gradients lie at actual organiser/desktop joints. There is no ceiling
  // board or raised base: never draw their former horizontal shadow strips.
  addStrip({ width: 12.02, height: .13, position: [0, table.surfaceY + .065, backingContactZ] });
  for (const x of organizer.dividerXs) {
    if (x > -6) addStrip({ width: .115, height: 2.32, position: [x - .1175, .6, backingContactZ], across: true, reverse: true });
    if (x < 6) addStrip({ width: .115, height: 2.32, position: [x + .1175, .6, backingContactZ], across: true });
  }
  // A few centimetres of recess beside/below the furniture, rather than a
  // single large dark patch behind the entire shelf.
  addStrip({ width: .11, height: 2.38, position: [-6.115, .61, deskLayout.wallFrontZ + .004], across: true, reverse: true });
  addStrip({ width: .11, height: 2.38, position: [6.115, .61, deskLayout.wallFrontZ + .004], across: true });
  addStrip({ width: 15.42, height: .14, position: [0, table.surfaceY + .07, deskLayout.wallFrontZ + .004] });
  // On the table the same contact fades forward from the back edge.
  addStrip({ width: 15.42, height: .14, position: [0, table.contactY, table.backEdgeZ + .07], horizontal: true, reverse: true });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const strips = new THREE.Mesh(geometry, shadowMaterial(stripTexture(), .24));
  strips.name = 'FurnitureJointOcclusion';
  root.add(strips);

  const contacts = [];
  const objects = [];
  room.traverse(object => { if (object.name.startsWith('Item_')) objects.push(object); });
  for (const object of objects) {
    const footprint = contactFootprint(object);
    if (!footprint) continue;
    const inOrganizer = !['Item_pauta', 'Item_pentagrama'].includes(object.name);
    const material = shadowMaterial(footprint.texture, .24);
    clipToSupport(material, inOrganizer ? organizer.contactBounds : table.bounds);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(footprint.width, footprint.depth), material);
    mesh.name = 'Contact_' + object.name;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(footprint.x, table.contactY, footprint.z);
    root.add(mesh);
    contacts.push({ object, mesh, home: object.getWorldPosition(new THREE.Vector3()), rotation: object.quaternion.clone(), x: footprint.x, z: footprint.z });
  }
  const propContacts=createPropContacts(root,bodies);
  const current = new THREE.Vector3();
  let tableContact = null;
  function clearTableContact() {
    if (!tableContact) return;
    root.remove(tableContact);
    tableContact.geometry.dispose();
    tableContact.material.map.dispose();
    tableContact.material.dispose();
    tableContact = null;
  }
  // Call once after the object has finished opening, and with null before it
  // returns to the organiser. This is a local ambient-contact approximation, not a
  // solar shadow: it stays beneath the actual support footprint at any hour.
  function onTable(object) {
    clearTableContact();
    if (!object) return;
    object.updateWorldMatrix(true, true);
    const footprint = contactFootprint(object, { padding: .12, blur: 9, band: .035, separate: true });
    if (!footprint) return;
    const gap = Math.max(0, footprint.low - table.surfaceY);
    const opacity = .18 * (1 - smooth(.025, .16, gap));
    if (opacity < .001) { footprint.texture.dispose(); return; }
    const material = shadowMaterial(footprint.texture, opacity);
    clipToSupport(material, table.bounds);
    tableContact = new THREE.Mesh(new THREE.PlaneGeometry(footprint.width, footprint.depth), material);
    tableContact.name = 'OpenMaterialTableContact';
    tableContact.rotation.x = -Math.PI / 2;
    tableContact.position.set(footprint.x, table.contactY + .0005, footprint.z);
    root.add(tableContact);
  }
  function update() {
    propContacts.update();
    for (const item of contacts) {
      item.object.getWorldPosition(current).sub(item.home);
      const lifted = smooth(.018, .14, Math.abs(current.y));
      const displaced = smooth(.18, .48, Math.hypot(current.x, current.z));
      const rotated = smooth(.001, .02, 1 - Math.abs(item.object.quaternion.dot(item.rotation)));
      const opacity = .24 * (1 - lifted) * (1 - displaced) * (1 - rotated);
      item.mesh.visible = opacity > .001;
      item.mesh.material.opacity = opacity;
      item.mesh.position.x = item.x + current.x;
      item.mesh.position.z = item.z + current.z;
    }
  }
  update();
  return { update, onTable, root, stats:propContacts.stats };
}

function clipToSupport(material, [minX, maxX, minZ, maxZ]) {
  // A tilted book can overhang the shelf; its shadow must never float beyond it.
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 contactPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncontactPosition = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = 'varying vec2 contactPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (contactPosition.x < ${minX.toFixed(4)} || contactPosition.x > ${maxX.toFixed(4)} || contactPosition.y < ${minZ.toFixed(4)} || contactPosition.y > ${maxZ.toFixed(4)}) discard;`);
  };
  material.customProgramCacheKey = () => 'contact-support-' + [minX, maxX, minZ, maxZ].join('-');
}

function shadowMaterial(texture, opacity) {
  return new THREE.MeshBasicMaterial({ map: texture, color: '#000000', transparent: true,
    opacity, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
}

function stripTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
  const context = canvas.getContext('2d'), pixels = context.createImageData(128, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    const u = (x + .5) / 128, v = (y + .5) / 64;
    const end = smooth(0, .045, u) * smooth(0, .045, 1 - u);
    pixels.data[(y * 128 + x) * 4 + 3] = Math.round(255 * end * v * v);
  }
  context.putImageData(pixels, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function contactFootprint(object, { padding = .08, blur = 5, band = .04, separate = false } = {}) {
  const vertices = [], point = new THREE.Vector3();
  const pieces = [];
  let low = Infinity;
  object.traverseVisible(mesh => {
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry?.attributes.position) return;
    const piece = [];
    const position = mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      low = Math.min(low, point.y);
      const vertex = [point.x, point.y, point.z];
      vertices.push(vertex); piece.push(vertex);
    }
    pieces.push(piece);
  });
  if (!vertices.length) return null;
  const bottomHull = points => convexHull(points.filter(p => p[1] <= low + band).map(p => [p[0], p[2]]));
  const hull = bottomHull(vertices);
  if (hull.length < 3) return null;
  const minX = Math.min(...hull.map(p => p[0])) - padding, maxX = Math.max(...hull.map(p => p[0])) + padding;
  const minZ = Math.min(...hull.map(p => p[1])) - padding, maxZ = Math.max(...hull.map(p => p[1])) + padding;
  const width = maxX - minX, depth = maxZ - minZ;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#000'; context.shadowColor = '#000'; context.shadowBlur = blur;
  // Separate lower components keep an open gutter or the gap beside a box's
  // sample card clear, instead of filling a convex shadow across empty space.
  const outlines = separate ? pieces.map(bottomHull).filter(piece => piece.length >= 3) : [hull];
  for (const outline of outlines) {
    context.beginPath();
    outline.forEach(([x, z], i) => {
      // PlaneGeometry rotated towards the ceiling maps canvas top to negative z.
      const px = (x - minX) / width * 256, py = (z - minZ) / depth * 256;
      if (i) context.lineTo(px, py); else context.moveTo(px, py);
    });
    context.closePath(); context.fill();
  }
  return { texture: new THREE.CanvasTexture(canvas), width, depth, low, x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
}

function convexHull(points) {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const point of points) {
    while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i];
    while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop(); upper.pop(); return lower.concat(upper);
}

function smooth(low, high, value) {
  const t = THREE.MathUtils.clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}
