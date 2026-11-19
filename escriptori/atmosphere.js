import * as THREE from 'three';
import { mergeGeometries } from '../assets/vendor/three/addons/utils/BufferGeometryUtils.js';

export async function createAtmosphere(scene, room, resources) {
  const window = new THREE.Group();
  window.position.set(-8.1, 3.25, 2);
  window.rotation.y = Math.PI / 2;
  scene.add(window);
  const garden = await resources.load(new URL('../assets/desk/garden.webp', import.meta.url).href, objectURL => new THREE.TextureLoader().loadAsync(objectURL));
  garden.colorSpace = THREE.SRGBColorSpace;
  const view = new THREE.Mesh(new THREE.PlaneGeometry(4.94, 3.33), new THREE.MeshBasicMaterial({ map: garden, toneMapped: false }));
  const skyTint = { value: new THREE.Color(1, 1, 1) };
  // Leave real space between the masonry, the shrub and the far garden.
  view.scale.set(2.3, 1.95, 1);
  view.position.set(.65, .08, -2.75);
  window.add(view);
  const sash = createCasement(window);
  let opening = 0;

  const leafGeometry = branchLeaf();
  const leafTexture = canopyTexture();
  const leafTints = ['#b3c690', '#d5d6a2', '#9cb294'];
  const leafMaterials = leafTints.map(color => new THREE.MeshStandardMaterial({
    color, map: leafTexture, roughness: .86, side: THREE.DoubleSide,
  }));
  const stemMaterial = new THREE.MeshStandardMaterial({ color: '#634f34', roughness: .94 });
  const branches = windowBranches(window, leafGeometry, leafMaterials, stemMaterial);
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const bounds = new THREE.Box3(new THREE.Vector3(-9.7, .4, -1), new THREE.Vector3(-8.38, 5.2, 5.3));
  const plant = room.getObjectByName('Pothos');
  const plantBounds = plant ? new THREE.Box3().setFromObject(plant) : new THREE.Box3();
  const plantOrigin = plant?.getWorldPosition(new THREE.Vector3());
  const movedBounds = new THREE.Box3(), shift = new THREE.Vector3();
  const leafNodes = [];
  plant?.traverse(node => { if (/^IndoorLeaf_\d+$/.test(node.name)) leafNodes.push(node); });
  const indoor = leafNodes.map((mesh, index) => ({ mesh, home: mesh.quaternion.clone(), touched: -Infinity, impulse: 0, phase: index * 4.79, period: 19 + (index * 7 % 13) }));
  const skin = leafSkin();
  plant?.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.material.name === 'IndoorLeafVeins') mesh.material.color.set('#536637');
    if (!mesh.material.name.startsWith('IndoorFoliage')) return;
    mesh.material.map = skin.color;
    mesh.material.roughnessMap = skin.roughness;
    mesh.material.roughness = .94;
    mesh.material.needsUpdate = true;
  });
  const sway = new THREE.Quaternion(), swayAxis = new THREE.Vector3(.3, .1, 1).normalize();
  let windowVisible = false, plantVisible = false;
  return {
    leafTexture,
    sash,
    setOpening(value) {
      opening = value;
      sash.pivot.rotation.y = value * 1.02;
      sash.handle.rotation.z = -Math.min(1, value * 4) * Math.PI / 2;
    },
    // xyz = opening centre in the room; w = squared radius of an equal-area disc.
    windowOpening: new THREE.Vector4(window.position.x, window.position.y, window.position.z,
      view.geometry.parameters.width * view.geometry.parameters.height / Math.PI),
    setWeather(uniforms) {
      view.material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms, { deskSkyTint: skyTint });
        shader.fragmentShader = 'uniform sampler2D deskCloudMap;\nuniform vec2 deskCloudDrift;\nuniform vec3 deskSkyTint;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          float sky = smoothstep(.56, .8, vMapUv.y) * smoothstep(.13, .36, vMapUv.x);
          float cloud = smoothstep(.3, .7, texture2D(deskCloudMap, vMapUv * vec2(.7,.45) + deskCloudDrift * .6).r);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.81,.86,.94) * deskSkyTint, sky * cloud * .28);`);
      };
      view.material.customProgramCacheKey = () => 'garden-moving-sky-v1'; view.material.needsUpdate = true;
    },
    brush(leaf, direction, seconds) {
      if (!plant || !leaf) return;
      for (const item of indoor) {
        const weight = Math.max(0, 1 - item.mesh.position.distanceTo(leaf.position) / .47);
        if (weight > 0) { item.touched = seconds; item.impulse = (.09 + .16 * weight) * weight * direction; }
      }
    },
    visible(camera) {
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
      windowVisible = frustum.intersectsBox(bounds);
      plantVisible = Boolean(plant) && frustum.intersectsBox(movedBounds.copy(plantBounds).translate(plant.getWorldPosition(shift).sub(plantOrigin)));
      return windowVisible || plantVisible;
    },
    update(time, sunlit) {
      const seconds = time / 1000;
      if (windowVisible || sunlit) for (const { group, leaves, phase } of branches) {
        const gustTime = (seconds + 2.4 - phase * .18 + 21) % 21;
        const gust = gustTime < 6 ? Math.sin(Math.PI * gustTime / 6) ** 2 : 0;
        group.rotation.z = Math.sin(seconds * .72 + phase * .36) * (.053 + .083 * gust) + Math.sin(seconds * .21 + phase) * .019;
        group.rotation.y = Math.sin(seconds * .41 + phase) * (.015 + .025 * gust);
        for (let i = 0; i < leaves.length; i++) {
          const { leaf, home } = leaves[i];
          leaf.rotation.z = home.z + Math.sin(seconds * 1.16 + i * .63 + phase) * (.075 + .09 * gust);
          leaf.rotation.y = home.y + Math.sin(seconds * 1.43 + i * .91 + phase) * (.035 + .045 * gust);
        }
      }
      if (plantVisible || sunlit) for (const { mesh, home, phase, period, touched, impulse } of indoor) {
        const moment = (seconds + phase) % period;
        const envelope = moment < 3.4 ? Math.sin(Math.PI * moment / 3.4) ** 2 : 0;
        const draught = opening * (.015 + .025 * Math.sin(seconds * .52 - phase * .06));
        const age = seconds - touched;
        const recoil = age < 1.6 ? impulse * Math.sin(age * 14) * Math.exp(-age * 3.1) : 0;
        sway.setFromAxisAngle(swayAxis, recoil +  Math.sin(moment * 3.3 + phase) * envelope * (.046 + opening * .035) + Math.sin(seconds * .31 + phase) * .006 + draught);
        mesh.quaternion.copy(home).multiply(sway);
      }
    },
    setLight(state) {
      const tint = new THREE.Color('#16243e').lerp(new THREE.Color('#f1f7ff'), state.day);
      tint.lerp(new THREE.Color('#f7cca1'), state.golden * .5);
      view.material.color.copy(tint);
      skyTint.value.copy(tint);
      leafMaterials.forEach((mat, i) => mat.color.set(leafTints[i]).multiplyScalar(.14 + .86 * state.day));
      stemMaterial.color.set('#634f34').multiplyScalar(.2 + .8 * state.day);
    },
  };
}

function createCasement(window) {
  const pivot = new THREE.Group();
  pivot.position.set(2.405, 0, .19);
  window.add(pivot);
  function rails(parts, color, roughness, metalness) {
    const boxes = parts.map(([w,h,d,x,y,z]) => new THREE.BoxGeometry(w,h,d).translate(x,y,z));
    const mesh = new THREE.Mesh(mergeGeometries(boxes), new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    boxes.forEach(box => box.dispose());
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }
  const width = 2.34, height = 3.19, edge = .075;
  const frame = rails([[edge,height,.085,0,0,0],[edge,height,.085,-width,0,0],
    [width-edge,edge,.085,-width/2,(height-edge)/2,0],[width-edge,edge,.085,-width/2,-(height-edge)/2,0]],
    '#b4a98c', .62, .06);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(width-edge,height-2*edge),
    new THREE.MeshStandardMaterial({ color:'#d7e4e4', roughness:.16, transparent:true,
      opacity:.075, depthWrite:false, side:THREE.DoubleSide, forceSinglePass:true }));
  pane.position.x = -width/2;
  const handle = rails([[.075,.075,.115,0,0,.052],[.047,.205,.045,0,-.085,.116]],
    '#645d4e', .34, .66);
  handle.position.set(-width,.01,.045);
  pivot.add(frame,pane,handle);
  return { pivot, handle, pane, window };
}

// The narrow first section is the petiole. Its end stays on the sampled twig
// while the blade rolls in the wind. Width and camber vanish at both tips.
function branchLeaf() {
  const positions = [], uvs = [], indices = [];
  const rows = 9, columns = 4;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const blade = Math.max(0, (t - .11) / .89);
    const envelope = Math.sin(Math.PI * blade);
    const width = .003 * (1 - t) + .097 * envelope ** .83 * (1.17 - .38 * blade);
    for (let col = 0; col <= columns; col++) {
      const s = col / columns * 2 - 1;
      positions.push(.028 * t * t + width * s * (1 + .09 * s),
        .44 * t + .015 * s * envelope,
        .047 * envelope - .049 * t * t + envelope * (.032 * s * s + .021 * s * t));
      uvs.push(col / columns, t);
      if (row && col) {
        const i = row * (columns + 1) + col;
        indices.push(i - columns - 2, i - columns - 1, i, i - columns - 2, i, i - 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function twig(curve, segments, radius) {
  const tube = new THREE.TubeGeometry(curve, segments, radius, 5, false);
  const p = tube.attributes.position, center = new THREE.Vector3(), offset = new THREE.Vector3();
  for (let ring = 0; ring <= segments; ring++) {
    const t = ring / segments;
    curve.getPointAt(t, center);
    for (let j = 0; j <= 5; j++) {
      const i = ring * 6 + j;
      offset.fromBufferAttribute(p, i).sub(center).multiplyScalar(1 - .85 * t).add(center);
      p.setXYZ(i, offset.x, offset.y, offset.z);
    }
  }
  return tube;
}

function windowBranches(parent, blade, leafMaterials, bark) {
  // Each row is one shoot growing into the opening from below the sill.
  // Forks originate on the parent curve and buds alternate along each twig.
  const shoots = [
    { x: -2.43, y: -2.92, rise: 3.83, lean: 1.32, forks: [[.34, -.52, .91], [.58, .61, .68]] },
    { x: -.45, y: -2.73, rise: 2.73, lean: -.74, forks: [[.40, .53, .70]] },
    { x: 2.01, y: -2.88, rise: 3.17, lean: -.67, forks: [[.37, -.61, .71], [.62, .44, .56]] },
  ];
  return shoots.map(({ x, y, rise, lean, forks }, branch) => {
    const group = new THREE.Group(), leaves = [], wood = [];
    group.name = 'ExteriorBranch_' + branch;
    group.position.set(x, y, [-.86, -1.19, -.96][branch]);
    parent.add(group);
    function grow(base, dx, dy, radius, count, phase) {
      const tip = base.clone().add(new THREE.Vector3(dx, dy, .04));
      const bend = base.clone().lerp(tip, .44);
      bend.x -= dx * .22; bend.z += .025;
      const curve = new THREE.CatmullRomCurve3([base, bend, tip]);
      wood.push(twig(curve, count * 2, radius));
      for (let i = 0; i < count; i++) {
        // Only jitter interior buds. The first and last attachment must stay
        // on the curve for every shoot, including the three-leaf forks.
        const offset = i > 0 && i < count - 1 ? .16 * Math.sin(i + phase) : 0;
        const t = .24 + .74 * (i + offset) / (count - 1);
        const side = (i + phase) % 2 ? 1 : -1;
        const tint = i === count - 1 ? 1 : (i + phase) % leafMaterials.length;
        const leaf = new THREE.Mesh(blade, leafMaterials[tint]);
        leaf.name = 'ExteriorLeaf_' + branch + '_' + leaves.length;
        curve.getPointAt(t, leaf.position);
        leaf.rotation.order = 'ZXY';
        leaf.rotation.set(.33 * Math.cos(2.6 * i + phase),
          .83 * Math.sin(2.17 * i + phase), -side * (.58 + .43 * Math.sin(i + phase) ** 2) - .23 * dx);
        const length = (.86 + .12 * Math.cos(i * 1.62 + phase)) * (1 - .46 * t * t);
        leaf.scale.set(length * (.85 + .20 * Math.sin(i + phase)), length, length);
        leaf.castShadow = true;
        group.add(leaf);
        leaves.push({ leaf, home: leaf.rotation.clone() });
      }
      return curve;
    }
    const stem = grow(new THREE.Vector3(), lean, rise, .018, 6, branch * 3);
    for (const [i, [t, dx, dy]] of forks.entries()) {
      grow(stem.getPointAt(t), dx, dy, .009, 3, branch * 3 + i + 1);
    }
    const stemMesh = new THREE.Mesh(mergeGeometries(wood), bark);
    for (const segment of wood) segment.dispose();
    stemMesh.castShadow = true;
    group.add(stemMesh);
    return { group, leaves, phase: branch * 2.1 };
  });
}

// Bounded value noise on leaf UVs. The scale follows a blade from base to tip.
function tissueNoise(x, y) {
  const cellX = Math.floor(x), cellY = Math.floor(y);
  function hash(i, j) {
    let n = Math.imul(i + 17, 374761393) + Math.imul(j + 29, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  const sx = THREE.MathUtils.smoothstep(x - cellX, 0, 1);
  const sy = THREE.MathUtils.smoothstep(y - cellY, 0, 1);
  const top = THREE.MathUtils.lerp(hash(cellX, cellY), hash(cellX + 1, cellY), sx);
  const bottom = THREE.MathUtils.lerp(hash(cellX, cellY + 1), hash(cellX + 1, cellY + 1), sx);
  return THREE.MathUtils.lerp(top, bottom, sy);
}

function canopyTexture() {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1) - .5, t = y / (size - 1), side = Math.abs(u);
    const tissue = tissueNoise(u * 8, t * 12);
    const stripe = (t - (.13 * side + .36 * side * side) + .023 * Math.sin(t * 8 + u)) * 7;
    const vein = (1 - THREE.MathUtils.smoothstep(Math.abs(stripe - Math.round(stripe)), .012, .075)) * (1 - 1.5 * side);
    const midrib = (1 - THREE.MathUtils.smoothstep(side, .002, .023 - .012 * t));
    const tone = 24 * tissue + 15 * vein + 35 * midrib + 8 * (u + .5);
    const petiole = 1 - THREE.MathUtils.smoothstep(t, .08, .16);
    data.set([64 + tone + 32 * petiole, 91 + tone + 7 * petiole, 48 + tone * .65, 255], (y * size + x) * 4);
  }
  return leafMap(data, size, true);
}

function leafMap(data, size, color = false) {
  const map = new THREE.DataTexture(data, size, size);
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.needsUpdate = true;
  return map;
}

function leafSkin() {
  const size = 256, color = new Uint8Array(size * size * 4), roughness = new Uint8Array(color.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // glTF stores v=1 at the petiole. Follow the raised lateral veins towards the tip.
    const u = x / (size - 1) - .5, t = 1 - y / (size - 1), side = Math.abs(u);
    const flow = t - side * (.15 + .26 * side);
    const coarse = tissueNoise(u * 7 + flow * 4, flow * 12);
    const fine = tissueNoise(u * 29, flow * 47);
    const pigment = THREE.MathUtils.smoothstep(.65 * coarse + .35 * fine, .48, .8);
    const rib = 1 - THREE.MathUtils.smoothstep(side, .003, .022 - .012 * t);
    // Pothos mottling follows the tissue between veins. The central rib
    // stays green and wax reflects differently across the same blade.
    const marbling = pigment * THREE.MathUtils.smoothstep(side, .02, .15);
    const tone = 172 + 38 * coarse;
    const i = (y * size + x) * 4;
    color.set([tone + 45 * marbling, tone + 12 + 25 * marbling + 5 * rib, tone - 10 - 39 * marbling, 255], i);
    const r = 159 + 44 * coarse + 37 * fine + 12 * marbling - 16 * rib;
    roughness.set([r, r, r, 255], i);
  }
  return { color: leafMap(color, size, true), roughness: leafMap(roughness, size) };
}
