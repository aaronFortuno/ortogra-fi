import * as THREE from 'three';
import { deskLayout } from './desk-layout.js?v=1.9.0';

const dimensions = [64, 16, 8];
const organizer = deskLayout.organizer;
const minimum = new THREE.Vector3(...organizer.minimum);
const maximum = new THREE.Vector3(...organizer.maximum);
const span = maximum.clone().sub(minimum);
const support = new THREE.Box3(minimum, maximum);
// Inner faces of the real dividers, from tools/build-desk-assets.py.
const openings = organizer.openings;
const base = organizer.baseY, top = organizer.topY, front = organizer.frontZ;
let visibilityGeometry;

// Small, world-space ambient-visibility volume for the real cabinet surfaces.
// It estimates the frontal aperture's diffuse form factor and the fraction of
// that opening blocked by the closed volumes of the movable binders/box. It is
// not a baked solar shadow or full global illumination. Direct light and its
// shadow maps remain untouched; the local lost indirect light is the correction.
export function createShelfOcclusion(room, materials, { topOpen = organizer.topOpen } = {}) {
  room.updateMatrixWorld(true);
  const blockers = [];
  room.traverse(object => {
    if (!object.name.startsWith('Item_') || ['Item_pauta', 'Item_pentagrama'].includes(object.name)) return;
    const bounds = localBounds(object);
    if (!bounds.isEmpty()) blockers.push({ object, bounds });
  });
  const data = new Uint8Array(dimensions[0] * dimensions[1] * dimensions[2]);
  // Aperture form factors depend on furniture dimensions, not the moving books.
  // Cache those trigonometric calculations once (96 KiB of CPU-side data).
  const geometry = visibilityGeometry ||= prepareGeometry();
  const texture = new THREE.Data3DTexture(data, ...dimensions);
  texture.name = 'ShelfIndirectVisibility';
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  const strength = { value: 1 };
  const restores = [];
  for (const material of materials) {
    if (!material.name.endsWith('_Room') || !/^(Oak|Plaster)/.test(material.name)) continue;
    restores.push(install(material, texture, strength));
  }
  let lastSignature = '', lastBake = -Infinity, disposed = false;
  const stats = { bakes: 0, milliseconds: 0, blockers: 0, bytes: data.byteLength };
  function update(force = false) {
    if (disposed) return false;
    const current = [], signatures = [];
    for (const blocker of blockers) {
      blocker.object.updateWorldMatrix(true, false);
      const world = blocker.bounds.clone().applyMatrix4(blocker.object.matrixWorld);
      if (!world.intersectsBox(support)) { signatures.push(blocker.object.name + ':outside'); continue; }
      // Quantisation avoids a rebuild for sub-millimetre changes. The final
      // explicit update(true) still captures the exact completed journey pose.
      signatures.push(blocker.object.name + ':' + blocker.object.matrixWorld.elements.map(value => Math.round(value * 64)).join(','));
      current.push({ ...blocker, world });
    }
    const signature = signatures.join('|'), now = performance.now();
    if (!force && (signature === lastSignature || now - lastBake < 250)) return false;
    const started = performance.now();
    const obstacles = current.map(blocker => ({
      inverse: blocker.object.matrixWorld.clone().invert().elements,
      low: blocker.bounds.min.toArray(), high: blocker.bounds.max.toArray(),
      world: blocker.world,
    }));
    const groups = openings.map(([left, right]) => obstacles.filter(obstacle => obstacle.world.max.x > left && obstacle.world.min.x < right));
    let index = 0;
    for (let iz = 0; iz < dimensions[2]; iz++) {
      const z = minimum.z + span.z * iz / (dimensions[2] - 1);
      for (let iy = 0; iy < dimensions[1]; iy++) {
        const y = minimum.y + span.y * iy / (dimensions[1] - 1);
        for (let ix = 0; ix < dimensions[0]; ix++) {
          const x = minimum.x + span.x * ix / (dimensions[0] - 1);
          const cell = openingFor(x);
          data[index] = Math.round(255 * visibility(x, y, z, openings[cell], groups[cell], topOpen, geometry.front[index], geometry.top[index], geometry.blend[index]));
          index++;
        }
      }
    }
    texture.needsUpdate = true;
    lastSignature = signature; lastBake = now;
    stats.bakes++; stats.blockers = current.length; stats.milliseconds = performance.now() - started;
    return true;
  }
  update(true);
  return {
    update,
    stats,
    setStrength(value) { strength.value = THREE.MathUtils.clamp(value, 0, 1); },
    // The same trilinear lookup as the shader, useful for local verification.
    visibilityAt(point) { return sampleVolume(data, point); },
    dispose() { if (!disposed) { disposed = true; restores.forEach(restore => restore()); texture.dispose(); } },
  };
}

function install(material, texture, strength) {
  const before = material.onBeforeCompile, cacheKey = material.customProgramCacheKey;
  const previousKey = cacheKey.call(material);
  material.onBeforeCompile = function (shader, renderer) {
    before.call(this, shader, renderer);
    shader.uniforms.shelfIndirectVisibility = { value: texture };
    shader.uniforms.shelfOcclusionStrength = strength;
    shader.uniforms.shelfVolumeMinimum = { value: minimum };
    shader.uniforms.shelfVolumeMaximum = { value: maximum };
    shader.uniforms.shelfVolumeSpan = { value: span };
    shader.uniforms.shelfVolumeDimensions = { value: new THREE.Vector3(...dimensions) };
    shader.vertexShader = 'varying vec3 shelfPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nshelfPosition = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = `
      uniform highp sampler3D shelfIndirectVisibility;
      uniform float shelfOcclusionStrength;
      uniform vec3 shelfVolumeMinimum;
      uniform vec3 shelfVolumeMaximum;
      uniform vec3 shelfVolumeSpan;
      uniform vec3 shelfVolumeDimensions;
      varying vec3 shelfPosition;
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `
      #include <aomap_fragment>
      if (all(greaterThanEqual(shelfPosition, shelfVolumeMinimum)) && all(lessThanEqual(shelfPosition, shelfVolumeMaximum))) {
        vec3 shelfUV = (shelfPosition - shelfVolumeMinimum) / shelfVolumeSpan;
        shelfUV = (shelfUV * (shelfVolumeDimensions - 1.0) + .5) / shelfVolumeDimensions;
        float shelfVisibility = mix(1.0, texture(shelfIndirectVisibility, shelfUV).r, shelfOcclusionStrength);
        reflectedLight.indirectDiffuse *= shelfVisibility;
        reflectedLight.indirectSpecular *= shelfVisibility;
      }
    `);
  };
  material.customProgramCacheKey = () => previousKey + '|shelf-indirect-volume-v2';
  material.needsUpdate = true;
  return () => { material.onBeforeCompile = before; material.customProgramCacheKey = cacheKey; material.needsUpdate = true; };
}

function visibility(x, y, z, opening, obstacles, topOpen, aperture, upperAperture, blend) {
  if (!blend) return 1;
  const [left, right] = opening;
  let total = 0, clear = 0;
  for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
    const targetX = left + (sx + .5) / 4 * (right - left);
    const targetY = base + (sy + .5) / 4 * (top - base);
    const dx = targetX - x, dy = targetY - y, dz = front - z;
    const squared = dx * dx + dy * dy + dz * dz;
    const weight = dz * dz / (squared * squared);
    total += weight;
    let blocked = false;
    for (const obstacle of obstacles) {
      if (intersects(obstacle, x, y, z, dx, dy, dz)) { blocked = true; break; }
    }
    if (!blocked) clear += weight;
  }
  const openFraction = total > 0 ? clear / total : 1;
  // A small residual stands for higher-order room bounce, rather than absolute
  // black. Surfaces nearest the open front recover the room's ambient light.
  const above = topOpen ? topVisibility(x, y, z, opening, obstacles, upperAperture) : 0;
  const enclosed = THREE.MathUtils.clamp(.055 + .945 * aperture * openFraction + above, 0, 1);
  return THREE.MathUtils.lerp(1, enclosed, blend);
}

function topVisibility(x, y, z, [left, right], obstacles, aperture) {
  const back = organizer.backingFrontZ;
  let total = 0, clear = 0;
  for (let sz = 0; sz < 2; sz++) for (let sx = 0; sx < 2; sx++) {
    const dx = left + (sx + .5) / 2 * (right - left) - x;
    const dy = organizer.topOpeningY - y;
    const dz = back + (sz + .5) / 2 * (front - back) - z;
    const squared = dx * dx + dy * dy + dz * dz;
    const weight = dy * dy / (squared * squared);
    total += weight;
    let blocked = false;
    for (const obstacle of obstacles) {
      if (intersects(obstacle, x, y, z, dx, dy, dz)) { blocked = true; break; }
    }
    if (!blocked) clear += weight;
  }
  // Open organisers admit some overhead ambient light. Keep this a small
  // secondary term: a binder still blocks the upward paths behind its covers.
  return .10 * aperture * (total > 0 ? clear / total : 1);
}

function prepareGeometry() {
  const count = dimensions[0] * dimensions[1] * dimensions[2];
  const result = { front: new Float32Array(count), top: new Float32Array(count), blend: new Float32Array(count) };
  let index = 0;
  for (let iz = 0; iz < dimensions[2]; iz++) {
    const z = minimum.z + span.z * iz / (dimensions[2] - 1);
    for (let iy = 0; iy < dimensions[1]; iy++) {
      const y = minimum.y + span.y * iy / (dimensions[1] - 1);
      for (let ix = 0; ix < dimensions[0]; ix++) {
        const x = minimum.x + span.x * ix / (dimensions[0] - 1);
        const [left, right] = openings[openingFor(x)];
        const depth = Math.max(.012, front - z), height = Math.max(.012, organizer.topOpeningY - y);
        result.front[index] = rectangleFactor(left - x, right - x, base - y, top - y, depth);
        result.top[index] = rectangleFactor(left - x, right - x, organizer.backingFrontZ - z, front - z, height);
        result.blend[index] = smooth(.08, .4, depth);
        index++;
      }
    }
  }
  return result;
}

function intersects(obstacle, x, y, z, dx, dy, dz) {
  const m = obstacle.inverse;
  const ox = m[0] * x + m[4] * y + m[8] * z + m[12];
  const oy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const oz = m[2] * x + m[6] * y + m[10] * z + m[14];
  const vx = m[0] * dx + m[4] * dy + m[8] * dz;
  const vy = m[1] * dx + m[5] * dy + m[9] * dz;
  const vz = m[2] * dx + m[6] * dy + m[10] * dz;
  let near = .001, far = .999;
  // Scalar slab tests deliberately avoid allocating a Vector3/array per ray.
  if (Math.abs(vx) < 1e-9) { if (ox < obstacle.low[0] || ox > obstacle.high[0]) return false; }
  else {
    const a = (obstacle.low[0] - ox) / vx, b = (obstacle.high[0] - ox) / vx;
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    if (far < near) return false;
  }
  if (Math.abs(vy) < 1e-9) { if (oy < obstacle.low[1] || oy > obstacle.high[1]) return false; }
  else {
    const a = (obstacle.low[1] - oy) / vy, b = (obstacle.high[1] - oy) / vy;
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    if (far < near) return false;
  }
  if (Math.abs(vz) < 1e-9) { if (oz < obstacle.low[2] || oz > obstacle.high[2]) return false; }
  else {
    const a = (obstacle.low[2] - oz) / vz, b = (obstacle.high[2] - oz) / vz;
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    if (far < near) return false;
  }
  return true;
}

function rectangleFactor(x0, x1, y0, y1, distance) {
  const corner = (x, y) => {
    const rx = Math.hypot(x, distance), ry = Math.hypot(y, distance);
    return (x / rx * Math.atan(y / rx) + y / ry * Math.atan(x / ry)) / (2 * Math.PI);
  };
  return THREE.MathUtils.clamp(corner(x1, y1) - corner(x0, y1) - corner(x1, y0) + corner(x0, y0), 0, 1);
}

function localBounds(object) {
  const box = new THREE.Box3(), inverse = object.matrixWorld.clone().invert();
  const point = new THREE.Vector3(), transform = new THREE.Matrix4();
  object.traverseVisible(mesh => {
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    transform.multiplyMatrices(inverse, mesh.matrixWorld);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      point.set(x, y, z).applyMatrix4(transform); box.expandByPoint(point);
    }
  });
  return box;
}

function openingFor(x) {
  for (let i = 0; i < openings.length; i++) if (x <= openings[i][1] + .06) return i;
  return openings.length - 1;
}

function sampleVolume(data, point) {
  if (!support.containsPoint(point)) return 1;
  const p = [(point.x - minimum.x) / span.x, (point.y - minimum.y) / span.y, (point.z - minimum.z) / span.z].map((v, i) => v * (dimensions[i] - 1));
  const low = p.map(Math.floor), high = low.map((v, i) => Math.min(dimensions[i] - 1, v + 1));
  const t = p.map((v, i) => v - low[i]);
  let value = 0;
  for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const ix = x ? high[0] : low[0], iy = y ? high[1] : low[1], iz = z ? high[2] : low[2];
    value += data[ix + dimensions[0] * (iy + dimensions[1] * iz)] / 255 * (x ? t[0] : 1 - t[0]) * (y ? t[1] : 1 - t[1]) * (z ? t[2] : 1 - t[2]);
  }
  return value;
}

function smooth(low, high, value) {
  const t = THREE.MathUtils.clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}
