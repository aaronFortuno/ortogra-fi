import * as THREE from 'three';

export async function createAtmosphere(scene, room) {
  const window = new THREE.Group();
  window.position.set(-8.1, 3.25, 1);
  window.rotation.y = Math.PI / 2;
  scene.add(window);
  const garden = await new THREE.TextureLoader().loadAsync(new URL('../assets/desk/garden.webp', import.meta.url).href);
  garden.colorSpace = THREE.SRGBColorSpace;
  const view = new THREE.Mesh(new THREE.PlaneGeometry(2.94, 3.33), new THREE.MeshBasicMaterial({ map: garden, toneMapped: false }));
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
    group.position.set(-.92 + branch * .67, -1.76 + branch * .17, -.13);
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
  const bounds = new THREE.Box3(new THREE.Vector3(-8.45, 1.62, -.48), new THREE.Vector3(-8, 4.9, 2.48));
  const plant = room.getObjectByName('Pothos');
  const plantBounds = plant ? new THREE.Box3().setFromObject(plant) : new THREE.Box3();
  const indoor = plant ? plant.getObjectsByProperty('isMesh', true).filter(mesh => mesh.name.startsWith('IndoorLeaf_')).map((mesh, index) => ({ mesh, home: mesh.quaternion.clone(), phase: index * 1.7 })) : [];
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
      if (plantVisible) for (const { mesh, home, phase } of indoor) {
        const sway = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(seconds * .47 + phase) * .012);
        mesh.quaternion.copy(home).multiply(sway);
      }
    },
    setTheme(dark) {
      view.material.color.setScalar(dark ? .28 : .95);
    },
  };
}
