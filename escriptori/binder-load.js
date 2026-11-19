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
  for (const cut of [-.62, .08, .68]) {
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
  const fullness = [.94, 1.04, .98, 1.08, 1][variant % 5];
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
      const side = THREE.MathUtils.clamp(v.x / .225, -1, 1);
      const spine = THREE.MathUtils.smoothstep(v.z, .50, .79);
      // A slight waist and a convex cloth spine, rather than shearing the
      // entire book sideways. Rigid-body lean/contact is arranged separately.
      const pressure = fullness * (.023 * bow + .033 * free * height ** 2);
      const sag = -.016 * fullness * bow + .006 * Math.sin(2 * Math.PI * height);
      v.x += sag + side * pressure;
      v.z += spine * (.027 * fullness * bow - .010 * height ** 7)
        + (1 - spine) * .007 * side * bow;
      v.y -= height ** 3 * (.008 + .018 * free) * fullness;
      if (paperBlock || sheetEdge) {
        const gutter = Math.max(0, 1 - side * side);
        const layers = .004 * Math.sin(43 * local.x + .9 * variant + 2 * free);
        v.y += height ** 5 * (-fullness * (.036 + .020 * free) * gutter + layers);
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

// Project the real closed geometry onto the shelf's vertical plane. The convex
// outline is conservative across depth: covers cannot pass through a neighbour
// even when the books have slightly different yaw/depth. This runs only at load.
function standingProfile(group) {
  group.updateWorldMatrix(true, true);
  const points = [], p = new THREE.Vector3();
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      points.push({ x: p.x, y: p.y });
    }
  });
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a, b, c) => (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x);
  const half = ordered => {
    const hull = [];
    for (const p of ordered) {
      while (hull.length > 1 && cross(hull.at(-2), hull.at(-1), p) <= 0) hull.pop();
      hull.push(p);
    }
    hull.pop(); return hull;
  };
  return [...half(points), ...half(points.reverse())];
}

function profileSpan(profile, y) {
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i], b = profile[(i+1) % profile.length];
    if (y < Math.min(a.y, b.y) || y > Math.max(a.y, b.y)) continue;
    if (Math.abs(a.y-b.y) < 1e-9) {
      low = Math.min(low, a.x, b.x); high = Math.max(high, a.x, b.x);
    } else {
      const x = THREE.MathUtils.lerp(a.x, b.x, (y-a.y)/(b.y-a.y));
      low = Math.min(low, x); high = Math.max(high, x);
    }
  }
  return { low, high };
}

export function arrangeBinderRow(groups, { left, surface, gap = .004 }) {
  let previous;
  for (const [index, group] of groups.entries()) {
    // Five degrees against the wooden cheek; each following base is slightly
    // further away, while its upper board comes to rest against the last book.
    group.rotation.z = THREE.MathUtils.degToRad(5 + 2.5 * index);
    group.position.x = group.position.y = 0;
    let profile = standingProfile(group);
    const lift = surface - Math.min(...profile.map(p => p.y)) + .001;
    group.position.y += lift;
    profile.forEach(p => { p.y += lift; });
    let offset = left + gap - Math.min(...profile.map(p => p.x));
    if (previous) {
      const bottom = Math.max(Math.min(...previous.map(p=>p.y)), Math.min(...profile.map(p=>p.y)));
      const top = Math.min(Math.max(...previous.map(p=>p.y)), Math.max(...profile.map(p=>p.y)));
      const heights = [bottom, top, ...previous.map(p=>p.y), ...profile.map(p=>p.y)]
        .filter(y => y >= bottom && y <= top);
      offset = Math.max(...heights.map(y => profileSpan(previous, y).high - profileSpan(profile, y).low + gap));
    }
    group.position.x += offset;
    profile.forEach(p => { p.x += offset; });
    previous = profile;
    group.updateWorldMatrix(true, true);
  }
}
