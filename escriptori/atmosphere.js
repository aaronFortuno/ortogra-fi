import * as THREE from 'three';

export async function createAtmosphere(scene, room, resources) {
  const window = new THREE.Group();
  window.position.set(-8.1, 3.25, 2);
  window.rotation.y = Math.PI / 2;
  scene.add(window);
  const garden = await resources.load(new URL('../assets/desk/garden.webp', import.meta.url).href, objectURL => new THREE.TextureLoader().loadAsync(objectURL));
  garden.colorSpace = THREE.SRGBColorSpace;
  const view = new THREE.Mesh(new THREE.PlaneGeometry(4.94, 3.33), new THREE.MeshBasicMaterial({ map: garden, toneMapped: false }));
  view.position.z = -.27;
  window.add(view);

  const shape = new THREE.Shape();
  shape.moveTo(0, -.24);
  shape.bezierCurveTo(-.13, -.1, -.13, .09, 0, .24);
  shape.bezierCurveTo(.12, .06, .1, -.13, 0, -.24);
  const leafGeometry = new THREE.ShapeGeometry(shape, 8);
  // ShapeGeometry uses local xy for UVs; normalise these for the vein texture.
  const uv = leafGeometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / .26 + .5, uv.getY(i) / .48 + .5);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 128, 0);
  gradient.addColorStop(0, '#384b2b'); gradient.addColorStop(.5, '#7d8a4d'); gradient.addColorStop(1, '#4a5d32');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#adb47d70'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128); ctx.stroke();
  ctx.lineWidth = .7;
  for (let y = 18; y < 120; y += 17) {
    ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(4, y - 25); ctx.moveTo(64, y); ctx.lineTo(124, y - 25); ctx.stroke();
  }
  const leafTexture = new THREE.CanvasTexture(canvas);
  leafTexture.colorSpace = THREE.SRGBColorSpace;
  const leafMaterial = new THREE.MeshStandardMaterial({ map: leafTexture, roughness: .74, side: THREE.DoubleSide });
  const stemMaterial = new THREE.MeshStandardMaterial({ color: '#635b3d', roughness: .93 });
  const branches = [];
  for (let branch = 0; branch < 3; branch++) {
    const group = new THREE.Group();
    group.position.set(-1.8 + branch * 1.3, -1.76 + branch * .17, -.13);
    const points = [new THREE.Vector3(), new THREE.Vector3(.14, .6, 0), new THREE.Vector3(-.06, 1.25, .015), new THREE.Vector3(.24, 1.95, 0)];
    const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, .009, 5, false), stemMaterial);
    stem.castShadow = true;
    group.add(stem);
    const leaves = [];
    for (let i = 0; i < 13; i++) {
      const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
      const side = i % 2 ? 1 : -1;
      leaf.position.set(.08 + side * .16, .22 + i * .126, Math.sin(i * 2.7) * .025);
      leaf.rotation.set(Math.sin(i * 4.1) * .38, Math.cos(i * 1.7) * .5, side * -.8);
      leaf.scale.setScalar(.65 + (Math.sin(i * 2.3) + 1) * .18);
      leaf.castShadow = true;
      group.add(leaf);
      leaves.push({ leaf, angle: leaf.rotation.z });
    }
    window.add(group);
    branches.push({ group, leaves, phase: branch * 2.1 });
  }
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const bounds = new THREE.Box3(new THREE.Vector3(-8.45, 1.62, -.48), new THREE.Vector3(-8, 4.9, 4.48));
  const plant = room.getObjectByName('Pothos');
  const plantBounds = plant ? new THREE.Box3().setFromObject(plant) : new THREE.Box3();
  const leafNodes = [];
  plant?.traverse(node => { if (/^IndoorLeaf_\d+$/.test(node.name)) leafNodes.push(node); });
  const indoor = leafNodes.map((mesh, index) => ({ mesh, home: mesh.quaternion.clone(), phase: index * 4.79, period: 19 + (index * 7 % 13) }));
  const skin = leafSkin();
  plant?.traverse(mesh => {
    if (!mesh.isMesh || !mesh.material.name.startsWith('IndoorFoliage')) return;
    mesh.material.map = skin.color;
    mesh.material.roughnessMap = skin.roughness; mesh.material.roughness = .72;
    mesh.material.normalMap = skin.normal; mesh.material.normalScale.set(.2, .2);
    mesh.material.envMapIntensity = 1.1; mesh.material.needsUpdate = true;
  });
  const sway = new THREE.Quaternion(), swayAxis = new THREE.Vector3(.3, .1, 1).normalize();
  let windowVisible = false, plantVisible = false;
  return {
    leafTexture,
    visible(camera) {
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
      windowVisible = frustum.intersectsBox(bounds);
      plantVisible = !plantBounds.isEmpty() && frustum.intersectsBox(plantBounds);
      return windowVisible || plantVisible;
    },
    update(time) {
      const seconds = time / 1000;
      if (windowVisible) for (const { group, leaves, phase } of branches) {
        group.rotation.z = Math.sin(seconds * .62 + phase) * .018 + Math.sin(seconds * .21 + phase) * .008;
        for (let i = 0; i < leaves.length; i++) {
          leaves[i].leaf.rotation.z = leaves[i].angle + Math.sin(seconds * .86 + i * .63 + phase) * .035;
        }
      }
      if (plantVisible) for (const { mesh, home, phase, period } of indoor) {
        const moment = (seconds + phase) % period;
        const envelope = moment < 3.4 ? Math.sin(Math.PI * moment / 3.4) ** 2 : 0;
        sway.setFromAxisAngle(swayAxis, Math.sin(moment * 3.3 + phase) * envelope * .035 + Math.sin(seconds * .23 + phase) * .002);
        mesh.quaternion.copy(home).multiply(sway);
      }
    },
    setLight(state) {
      const tint = new THREE.Color('#16243e').lerp(new THREE.Color('#f1f7ff'), state.day);
      tint.lerp(new THREE.Color('#f7cca1'), state.golden * .5);
      view.material.color.copy(tint);
      leafMaterial.color.setScalar(.14 + .86 * state.day);
      stemMaterial.color.set('#635b3d').multiplyScalar(.2 + .8 * state.day);
    },
  };
}

// Fine veins and varied waxiness follow the model's leaf UVs. The original
// vertex colours and curved geometry remain visible beneath this microtexture.
function leafSkin() {
  const size = 256;
  const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
  const color = canvas(), roughness = canvas(), normal = canvas();
  const data = [color, roughness, normal].map(c => c.getContext('2d').createImageData(size, size));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, side = Math.abs(u - .5);
    const central = Math.exp(-1 * (((u - .5) * 100) ** 2));
    const vein = Math.exp(-1 * ((Math.sin((v - side * .65) * Math.PI * 13) * 17) ** 2)) * (1 - side * 1.3);
    const grain = Math.sin(x * 5.23 + y * 13.7) * Math.sin(x * 1.73 - y * 3.13);
    const tone = 232 + 13 * central + 7 * vein + 3 * grain;
    const i = (y * size + x) * 4;
    data[0].data.set([tone - 5, tone, tone - 8, 255], i);
    const r = 153 - 28 * central - 15 * vein + grain * 7;
    data[1].data.set([r, r, r, 255], i);
    data[2].data.set([128 + Math.cos((v - side * .65) * Math.PI * 26) * vein * 17, 128 + grain * 5, 254, 255], i);
  }
  [color, roughness, normal].forEach((c, i) => c.getContext('2d').putImageData(data[i], 0, 0));
  const maps = [color, roughness, normal].map(c => new THREE.CanvasTexture(c));
  maps[0].colorSpace = THREE.SRGBColorSpace;
  return { color: maps[0], roughness: maps[1], normal: maps[2] };
}
