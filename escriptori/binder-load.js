import * as THREE from 'three';

// Add cross-sections through the long faces. The original bevelled boards only
// have vertices at their ends, so a bend there alone would still look straight.
function sectionGeometry(source, toBinder) {
  const attributes = Object.entries(source.attributes);
  const values = Object.fromEntries(attributes.map(([name, attr]) => [name, Array.from(attr.array)]));
  let triangles = source.index ? Array.from(source.index.array) : Array.from({length: source.attributes.position.count}, (_, i) => i);
  const point = new THREE.Vector3();
  const heights = [];
  for (let i = 0; i < values.position.length; i += 3) heights.push(point.fromArray(values.position, i).applyMatrix4(toBinder).y);
  for (const cut of [-.45, .37]) {
    const split = new Map(), next = [];
    function crossing(a, b) {
      const key = Math.min(a, b) + '/' + Math.max(a, b);
      if (split.has(key)) return split.get(key);
      const t = (cut - heights[a]) / (heights[b] - heights[a]);
      const idx = heights.length;
      for (const [name, attr] of attributes) {
        const data = values[name], n = attr.itemSize;
        for (let j = 0; j < n; j++) data.push(THREE.MathUtils.lerp(data[a*n+j], data[b*n+j], t));
      }
      heights.push(cut); split.set(key, idx);
      return idx;
    }
    for (let k = 0; k < triangles.length; k += 3) {
      const face = triangles.slice(k, k + 3);
      if (!face.some(i => heights[i] > cut + .00001) || !face.some(i => heights[i] < cut - .00001)) {
        next.push(...face); continue;
      }
      const above = [], below = [];
      face.forEach((a, j) => {
        const b = face[(j+1)%3], da = heights[a] - cut, db = heights[b] - cut;
        if (da >= -.00001) above.push(a);
        if (da <= .00001) below.push(a);
        if ((da > .00001 && db < -.00001) || (da < -.00001 && db > .00001)) {
          const c = crossing(a, b); above.push(c); below.push(c);
        }
      });
      for (const side of [above, below]) for (let j=1; j+1<side.length; j++) next.push(side[0], side[j], side[j+1]);
    }
    triangles = next;
  }
  const geom = new THREE.BufferGeometry();
  for (const [name, attr] of attributes) geom.setAttribute(name, new THREE.BufferAttribute(new attr.array.constructor(values[name]), attr.itemSize, attr.normalized));
  geom.setIndex(triangles);
  return geom;
}

export function prepareBinderLoad(group, variant) {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert(), parts = [];
  const lean = [.093, .048, -.067, .076, -.085][variant % 5];
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const toBinder = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    const fromBinder = toBinder.clone().invert();
    const paperBlock = mesh.name.startsWith('Pages_'), sheetEdge = mesh.name.startsWith('PageEdge');
    let geo;
    if (paperBlock || sheetEdge || /Liner|LeftPaper/.test(mesh.name)) {
      // Regular sections keep the paper and the inner linings lighter than
      // subdividing the tiny bevels on every individual sheet.
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox, size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      geo = new THREE.BoxGeometry(size.x, size.y, size.z, paperBlock ? 8 : 1, 4, 3);
      geo.translate(center.x, center.y, center.z); geo.clearGroups();
    } else if (/Cover|Spine_|Tape_/.test(mesh.name)) {
      geo = sectionGeometry(mesh.geometry, toBinder);
    } else geo = mesh.geometry.clone();
    const pos = geo.getAttribute('position'), offset = new Float32Array(pos.count * 3);
    const local = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i=0; i<pos.count; i++) {
      local.fromBufferAttribute(pos, i); v.copy(local).applyMatrix4(toBinder);
      const height = THREE.MathUtils.clamp((v.y + 1.04) / 2.08, 0, 1);
      const free = THREE.MathUtils.clamp((.80-v.z)/1.55, 0, 1);
      const bow = Math.sin(Math.PI * height);
      // The foot stays planted. A full block spreads the boards most at the
      // free edge, and the head of the paper settles below the cloth.
      const side = THREE.MathUtils.clamp(v.x / .225, -1, 1);
      v.x += lean * (height * height + .66 * bow) + side * (.027 * bow + .052 * free * height);
      v.y -= height ** 3 * free * (.014 + .033 * (1-side*side));
      if (paperBlock || sheetEdge) {
        const gutter = Math.max(0, 1 - (v.x / .23) ** 2);
        const layers = .008 * Math.sin(43 * local.x + .9 * variant + 2 * free);
        v.y += height ** 5 * (-.052 * gutter + layers + (sheetEdge ? .015 : 0));
      }
      v.applyMatrix4(fromBinder).sub(local).toArray(offset, i * 3);
    }
    const rest = pos.array.slice();
    geo.computeBoundingBox(); const flatBounds = geo.boundingBox.clone();
    for (let i = 0; i < rest.length; i++) pos.array[i] = rest[i] + offset[i];
    let shading;
    if (paperBlock || sheetEdge || /Cover|Liner|Spine_|LeftPaper/.test(mesh.name)) {
      const normal = geo.getAttribute('normal'), flat = normal.array.slice();
      geo.computeVertexNormals();
      const change = normal.array.map((value, i) => value - flat[i]);
      normal.setUsage(THREE.DynamicDrawUsage); shading = { normal, flat, change };
    }
    geo.computeBoundingBox(); geo.boundingBox.union(flatBounds);
    geo.boundingSphere = geo.boundingBox.getBoundingSphere(new THREE.Sphere());
    pos.setUsage(THREE.DynamicDrawUsage); mesh.geometry = geo;
    parts.push({ pos, rest, offset, shading });
  });
  let applied = 1;
  return weight => {
    if (weight === applied) return;
    applied = weight;
    for (const { pos, rest, offset, shading } of parts) {
      for (let i = 0; i < rest.length; i++) pos.array[i] = rest[i] + offset[i] * weight;
      pos.needsUpdate = true;
      if (shading) {
        const { normal, flat, change } = shading;
        for (let i=0; i<flat.length; i++) normal.array[i] = flat[i] + change[i] * weight;
        normal.needsUpdate = true;
      }
    }
  };
}
