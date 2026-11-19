import * as THREE from 'three';
import { deskLayout } from './desk-layout.js?v=1.10.0';

const surface = deskLayout.table.surfaceY, floor = -3.705;
const definitions = [
  [/^LooseWorksheet_\d+$/, 'paper'], [/^SpareFolder$/, 'paper'], [/^PaperClip$/, 'metal'],
  [/^DeskTapeRoll$/, 'tape'], [/^DeskStapler$/, 'metal'], [/^Pothos$|^PencilCup$/, 'cup'],
  [/^OpenPencilCase$/, 'cloth'], [/^CaseBallpoint_\d+$|^LooseBallpoint$|^LoosePencil$/, 'pen'],
];

export function createStationery({ room, canvas, camera, navigation, enabled, reduced, sound, brush, redraw, cancelView }) {
  const items = [], owners = new Map(), fallen = new Set();
  const recover = document.querySelector('#recover-stationery');
  room.updateWorldMatrix(true, true);
  room.traverse(node => {
    const def = definitions.find(([pattern]) => pattern.test(node.name));
    if (!def) return;
    const item = { node, kind: def[1], parent: node.parent, home: node.position.clone(),
      rotation: node.quaternion.clone(), bounds: new THREE.Box3(), pulse: null };
    owners.set(node, item); items.push(item);
  });
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
  const point = new THREE.Vector3(), center = new THREE.Vector3();
  const blockers = [room.getObjectByName('RoomSurfaces'), ...room.children.flatMap(group => group.children.filter(n => n.name.startsWith('Item_')))].filter(Boolean);
  const candidate = [], intersections = [];
  let grip = null, hover = null, suppressClick = false, lastHover = -Infinity, lastBrush = -Infinity;
  function refresh() {
    for (const item of items) item.bounds.setFromObject(item.node, true);
  }
  refresh();
  function aim(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1, 1-(event.clientY-rect.top)/rect.height*2);
    ray.setFromCamera(pointer, camera);
  }
  function hit(event) {
    aim(event); candidate.length = 0; intersections.length = 0;
    for (const item of items) if (ray.ray.intersectsBox(item.bounds)) candidate.push(item.node);
    if (!candidate.length) return null;
    ray.intersectObjects(candidate, true, intersections);
    const first = intersections[0];
    if (!first) return null;
    ray.far = first.distance - .002;
    const blocked = ray.intersectObjects(blockers, true).length > 0;
    ray.far = Infinity;
    if (blocked) return null;
    let leaf = null;
    for (let node = first.object; node; node = node.parent) {
      if (/^IndoorLeaf_\d+$/.test(node.name)) leaf = node;
      if (owners.has(node)) return { item: owners.get(node), leaf, point: first.point };
    }
    return null;
  }
  function setWorld(node, pos) { node.position.copy(node.parent.worldToLocal(pos)); node.updateWorldMatrix(false, true); }
  function finishPulse(item) {
    if (!item.pulse) return;
    item.node.quaternion.copy(item.pulse.rotation);
    item.node.position.copy(item.pulse.position); item.pulse = null;
  }
  function tickle(item, sign) {
    if (reduced.matches) return;
    finishPulse(item);
    item.pulse = { start: performance.now(), sign, rotation: item.node.quaternion.clone(), position: item.node.position.clone() };
    redraw();
  }
  function react(target, direction) {
    if (target.leaf) { brush(target.leaf, direction); sound('touch', 'leaf'); }
    else if (target.item.kind === 'pen') { tickle(target.item, direction); sound('touch', 'pen'); }
  }
  function rollback() {
    if (!grip) return;
    if (grip.moved) {
      const { item, parent, startPos, rotation } = grip;
      parent.add(item.node); item.node.position.copy(startPos); item.node.quaternion.copy(rotation);
      refresh(); redraw();
    }
    grip = null; canvas.style.cursor = '';
  }
  canvas.addEventListener('pointerdown', event => {
    suppressClick = false;
    if (grip && event.pointerId !== grip.id) { rollback(); return; }
    if (!enabled() || !navigation.enabled || navigation.pointers.size || event.button !== 0 || event.shiftKey) return;
    const target = hit(event); if (!target || target.item.drop) return;
    cancelView();
    const { item } = target; finishPulse(item);
    plane.constant = -target.point.y;
    if (!ray.ray.intersectPlane(plane, point)) return;
    grip = { ...target, id: event.pointerId, x: event.clientX, y: event.clientY, anchor: point.clone(),
      parent: item.node.parent, startPos: item.node.position.clone(), rotation: item.node.quaternion.clone(),
      world: item.node.getWorldPosition(new THREE.Vector3()), moved: false, lastSound: -Infinity };
    canvas.setPointerCapture(event.pointerId); event.preventDefault();
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', event => {
    if (!enabled() || !navigation.enabled || navigation.pointers.size > 1) { rollback(); return; }
    if (!grip) {
      if (navigation.pointers.size || event.buttons || event.pointerType === 'touch' || event.timeStamp-lastHover < 45) return;
      lastHover = event.timeStamp;
      const target = hit(event), next = target?.leaf || target?.item;
      canvas.style.cursor = target ? 'grab' : '';
      if (target && next !== hover && event.timeStamp-lastBrush > 95) {
        react(target, event.movementX < 0 ? -1 : 1); lastBrush = event.timeStamp;
      }
      hover = next; return;
    }
    if (grip.id !== event.pointerId) return;
    event.preventDefault();
    const distance = Math.hypot(event.clientX-grip.x, event.clientY-grip.y);
    if (!grip.moved && distance < 5) return;
    aim(event);
    if (!ray.ray.intersectPlane(plane, point)) return;
    const { item } = grip;
    if (!grip.moved) {
      room.attach(item.node); grip.moved = true;
      item.bounds.getCenter(center);
      grip.offset = center.sub(grip.world).clone();
      grip.height = grip.world.y - item.bounds.min.y;
      grip.depth = (item.bounds.max.z-item.bounds.min.z)/2;
      grip.halfWidth = (item.bounds.max.x-item.bounds.min.x)/2;
      sound('lift', item.kind);
    }
    point.sub(grip.anchor).add(grip.world);
    const sideLimit = 8.00 - grip.halfWidth;
    const cx = THREE.MathUtils.clamp(point.x + grip.offset.x, -sideLimit, sideLimit);
    const cz = THREE.MathUtils.clamp(point.z + grip.offset.z, Math.abs(cx)<6.22 ? .26+grip.depth : -.9, 7.6);
    point.set(cx-grip.offset.x, Math.max(surface + grip.height, grip.world.y) + .12, cz-grip.offset.z);
    setWorld(item.node, point);
    if (event.timeStamp-grip.lastSound > 380 && Math.hypot(event.movementX || 0, event.movementY || 0) > 0) {
      sound('slide', item.kind); grip.lastSound = event.timeStamp;
    }
    redraw();
  });
  function drop(item, targetY, isFloor) {
    const looseSheet = isFloor && item.node.name.startsWith('LooseWorksheet_');
    item.drop = { y: item.node.position.y, x: item.node.position.x, angle: item.node.rotation.z,
      looseSheet, targetY, isFloor, start: performance.now() };
    if (reduced.matches) settle(item);
    redraw();
  }
  function settle(item) {
    const { targetY, isFloor, x, angle } = item.drop;
    item.node.position.x = x; item.node.rotation.z = angle;
    item.node.position.y = targetY; item.drop = null;
    if (isFloor) fallen.add(item); else fallen.delete(item);
    recover.hidden = !fallen.size;
    sound(isFloor ? 'floor' : 'land', item.kind); refresh();
  }
  canvas.addEventListener('pointerup', event => {
    if (!grip || grip.id !== event.pointerId) return;
    const { item, leaf, moved } = grip;
    suppressClick = true;
    if (moved) {
      const box = new THREE.Box3().setFromObject(item.node, true);
      box.getCenter(center);
      const landOnFloor = center.z > deskLayout.table.bounds[3] || Math.abs(center.x) > deskLayout.table.bounds[1];
      let support = landOnFloor ? floor : surface;
      if (!landOnFloor) {
        // Do not drop through another prop. Flat sheets can stack; a pen can
        // be returned to its own slot, even after the case has moved.
        if (/^CaseBallpoint_/.test(item.node.name)) {
          const slot = item.parent.localToWorld(item.home.clone());
          if (Math.hypot(slot.x-item.node.position.x, slot.z-item.node.position.z) < .20) {
            item.parent.add(item.node); item.node.position.copy(item.home); item.node.quaternion.copy(item.rotation);
            fallen.delete(item); recover.hidden = !fallen.size; sound('land', 'pen');
            grip = null; canvas.style.cursor = ''; refresh(); redraw(); return;
          }
        }
        for (const other of items) {
          if (other === item || other.drop || fallen.has(other) || item.node.getObjectById(other.node.id)) continue;
          const b = other.bounds;
          if (box.min.x < b.max.x-.008 && box.max.x > b.min.x+.008 && box.min.z < b.max.z-.008 && box.max.z > b.min.z+.008) {
            if (other.kind === 'paper') support = Math.max(support, b.max.y-.006);
            else { rollback(); return; }
          }
        }
        // Keep the contact plane at the true lowest vertex of each prop.
      }
      drop(item, item.node.position.y + support - box.min.y + .001, landOnFloor);
    } else if (leaf || item.kind === 'pen') react({item, leaf}, 1);
    else if (item.kind === 'paper') {
      item.nudge = item.nudge === 1 ? -1 : 1;
      item.node.position.x += .036 * item.nudge; item.node.rotateY(.012 * item.nudge);
      sound('touch', 'paper'); refresh(); redraw();
    } else { tickle(item, 1); sound('touch', item.kind); }
    grip = null; canvas.style.cursor = '';
  });
  for (const type of ['pointercancel','lostpointercapture']) canvas.addEventListener(type, e => { if (grip?.id === e.pointerId) rollback(); });
  canvas.addEventListener('pointerleave', () => { hover = null; if (!grip) canvas.style.cursor = ''; });
  canvas.addEventListener('click', event => {
    if (suppressClick) { suppressClick = false; event.stopImmediatePropagation(); }
  }, true);
  recover.addEventListener('click', () => {
    for (const item of fallen) {
      item.parent.add(item.node); item.node.position.copy(item.home); item.node.quaternion.copy(item.rotation);
    }
    fallen.clear(); recover.hidden = true; refresh(); redraw();
  });
  return {
    cancel: rollback,
    update(time) {
      let moving = false;
      for (const item of items) {
        if (item.drop) {
          const d = item.drop, elapsed = Math.max(0, (time-d.start)/1000);
          item.node.position.y = Math.max(d.targetY, d.y-(d.looseSheet ? 5.2 : 9.8)*elapsed*elapsed);
          if (d.looseSheet) {
            const progress = THREE.MathUtils.clamp((d.y-item.node.position.y)/(d.y-d.targetY), 0, 1);
            const flutter = Math.sin(progress*Math.PI) * Math.sin(elapsed*13);
            item.node.position.x = d.x + .11*flutter;
            item.node.rotation.z = d.angle + .18*flutter;
          }
          if (reduced.matches || item.node.position.y <= d.targetY) settle(item);
          moving = true;
        }
        if (!item.pulse) continue;
        const age = Math.max(0, (time-item.pulse.start)/1000);
        if (age >= .68 || reduced.matches) finishPulse(item);
        else {
          const wave = item.pulse.sign*Math.sin(age*20)*Math.exp(-age*6);
          item.node.quaternion.copy(item.pulse.rotation);
          item.node.rotateY(wave*(item.kind==='pen'?.10:.023));
          item.node.position.copy(item.pulse.position);
          if (item.kind === 'pen') item.node.position.z += wave*.036;
        }
        moving = true;
      }
      return moving;
    }
  };
}
