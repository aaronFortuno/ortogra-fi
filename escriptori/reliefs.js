import * as THREE from 'three';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';

// These are lightweight copies of the author's 3MFs, loaded only for the box.
// Inspection takes the real mesh out of the box; it never opens a second canvas.
export function createReliefs({ scene, camera, target, animate, requestRender }) {
  let assets = new Map(), box, pieces = [], selected = null, stored, yaw = .3, pitch = .85, distance = 3, radius = 1, center;
  const loader = new GLTFLoader();
  const clamp = THREE.MathUtils.clamp;
  const pose = () => ({ position: camera.position.clone(), rotation: camera.quaternion.clone(), up: camera.up.clone(), target: target.clone(), aspect: camera.aspect });
  async function prepare(project) {
    if (assets.size) return;
    const loaded = await Promise.all(project.reliefs.map(async entry => ({ entry, asset: await loader.loadAsync(entry.url) })));
    for (const { entry, asset } of loaded) {
      asset.scene.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.castShadow = mesh.receiveShadow = true;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          material.metalness = 0; material.roughness = .87; material.envMapIntensity = .7;
        }
      });
      assets.set(entry.id, { ...entry, object: asset.scene });
    }
  }
  function mount(model, pages) { box = model; setSamples(pages); }
  function setSamples(pages) {
    for (const piece of pieces) piece.removeFromParent(); pieces = [];
    pages.forEach((page, index) => {
      const entry = assets.get(page.modelId);
      const piece = new THREE.Group(); piece.name = 'ReliefSample_' + index; piece.userData.relief = entry;
      piece.add(entry.object.clone(true));
      const bounds = new THREE.Box3().setFromObject(piece), size = bounds.getSize(new THREE.Vector3());
      const scale = Math.min((index ? 1.55 : 1.48) / size.x, (index ? 1.04 : .98) / size.z);
      piece.scale.setScalar(scale);
      if (index) {
        box.group.getObjectByName('ProjectCard').add(piece); piece.position.set(0, .015, 0);
      } else { box.group.add(piece); piece.position.set(0, -.225, 0); }
      pieces.push(piece);
    });
  }
  function view() {
    const position = center.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(distance));
    const proxy = camera.clone(); proxy.position.copy(position); proxy.up.set(0, 1, 0); proxy.lookAt(center);
    return { position, rotation: proxy.quaternion, target: center, up: proxy.up };
  }
  async function travel(to, movePiece, duration = 220) {
    const from = pose();
    await animate('relief-view', t => {
      camera.position.lerpVectors(from.position, to.position, t); camera.quaternion.slerpQuaternions(from.rotation, to.rotation, t);
      target.lerpVectors(from.target, to.target, t); movePiece?.(t);
    }, duration);
    camera.up.copy(to.up);
  }
  function fitDistance() {
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return radius / (tangent * Math.min(1, camera.aspect)) * 1.1;
  }
  async function inspect(index) {
    if (selected) return;
    selected = pieces[index];
    stored = { camera: pose(), parent: selected.parent, position: selected.position.clone(), rotation: selected.quaternion.clone(), scale: selected.scale.clone() };
    scene.attach(selected);
    stored.worldPosition = selected.position.clone();
    const startBounds = new THREE.Box3().setFromObject(selected);
    const offset = startBounds.getCenter(new THREE.Vector3()).sub(selected.position);
    radius = startBounds.getSize(new THREE.Vector3()).length() * .5;
    // The front of the table is clear of the box and the second sample.
    const bottomOffset = startBounds.min.y - selected.position.y;
    const destination = new THREE.Vector3(-1.5, -.574 - bottomOffset, 4.15);
    const rim = box.group.localToWorld(new THREE.Vector3(0, .32, 0)).y;
    const lift = Math.max(.45, rim + .14 - Math.min(startBounds.min.y, destination.y + bottomOffset));
    // Lift the entire base above the rim before crossing a side. Horizontal
    // motion overlaps the lift/landing, so the sample never stops in mid-air.
    stored.path = t => {
      const horizontal = THREE.MathUtils.smoothstep(t, .25, .79);
      const raised = THREE.MathUtils.smoothstep(t, 0, .28) * (1 - THREE.MathUtils.smoothstep(t, .72, 1));
      selected.position.lerpVectors(stored.worldPosition, destination, horizontal);
      selected.position.y += lift * raised;
      stored.progress = t;
    };
    stored.rim = rim;
    center = destination.clone().add(offset);
    yaw = .3; pitch = .85; distance = fitDistance();
    await travel(view(), stored.path, 820);
    requestRender();
  }
  async function close(fallback) {
    if (!selected) return;
    let to = stored.camera;
    if (Math.abs(to.aspect - camera.aspect) > .01) {
      const resized = fallback(), proxy = camera.clone();
      proxy.up.copy(to.up); proxy.position.copy(resized.position); proxy.lookAt(resized.target);
      to = { ...resized, up: to.up, rotation: proxy.quaternion };
    }
    await travel(to, t => stored.path(1 - t), 820);
    stored.parent.attach(selected); selected.position.copy(stored.position); selected.quaternion.copy(stored.rotation); selected.scale.copy(stored.scale);
    selected = null; stored = null; requestRender();
  }
  function orbit(dx, dy) {
    if (!selected) return;
    yaw -= dx * .008; pitch = clamp(pitch + dy * .006, .12, 1.48);
    return travel(view());
  }
  function zoom(delta) {
    if (!selected) return;
    distance = clamp(distance * Math.exp(clamp(delta, -500, 500) * .0015), radius * 1.12, radius * 10);
    return travel(view());
  }
  function reset() {
    if (!selected) return;
    yaw = .3; pitch = .85; distance = fitDistance(); return travel(view());
  }
  function resize() {
    if (!selected) return;
    distance = fitDistance(); const to = view();
    camera.position.copy(to.position); camera.quaternion.copy(to.rotation); target.copy(to.target); requestRender();
  }
  function unmount() {
    for (const piece of pieces) piece.removeFromParent(); pieces = [];
    const geometries = new Set(), materials = new Set(), textures = new Set();
    for (const entry of assets.values()) entry.object.traverse(mesh => {
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material); if (material.map) textures.add(material.map);
      }
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    assets.clear(); box = null;
  }
  function points(narrow) {
    const result = [];
    for (const piece of narrow ? pieces.slice(0, 1) : pieces) {
      const bounds = new THREE.Box3().setFromObject(piece);
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) result.push(new THREE.Vector3(x, y, z));
    }
    return result;
  }
  function project(rect) {
    pieces.forEach((piece, index) => {
      const bounds = new THREE.Box3().setFromObject(piece), projected = [];
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        projected.push(new THREE.Vector3(x, y, z).project(camera));
      }
      const left = Math.min(...projected.map(p => (p.x + 1) * rect.width / 2));
      const right = Math.max(...projected.map(p => (p.x + 1) * rect.width / 2));
      const top = Math.min(...projected.map(p => (1 - p.y) * rect.height / 2));
      const bottom = Math.max(...projected.map(p => (1 - p.y) * rect.height / 2));
      const button = document.querySelector(index ? '#sample-open-answers' : '#sample-open');
      button.style.width = right - left + 'px'; button.style.height = bottom - top + 'px';
      button.style.transform = `translate(${left}px,${top}px)`;
    });
  }
  return { prepare, mount, setSamples, inspect, close, orbit, zoom, reset, resize, unmount,
    points, project,
    info: () => ({ kind: selected ? 'relief' : null, open: Boolean(selected), yaw, pitch, distance, radius, panX: 0, panY: 0, models: pieces.map(piece => piece.userData.relief.id), title: selected?.userData.relief.title,
      extraction: selected && stored ? { progress: stored.progress, rim: stored.rim, base: new THREE.Box3().setFromObject(selected).min.toArray(), position: selected.position.toArray() } : null }) };
}
