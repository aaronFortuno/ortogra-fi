import * as THREE from 'three';
import { deskLayout } from './desk-layout.js?v=1.10.0';
import { overlaps, solidBounds, routeOutside } from './table-space.js?v=1.16.0';
import { prepareSheet, createTableSupport } from './table-support.js?v=1.17.0';

const surface = deskLayout.table.surfaceY, floor = -3.705;
const definitions = [
  [/^LooseWorksheet_\d+$/, 'paper'], [/^SpareFolder$/, 'paper'], [/^PaperClip$/, 'metal'],
  [/^DeskTapeRoll$/, 'tape'], [/^DeskStapler$/, 'metal'], [/^Pothos$|^PencilCup$/, 'cup'],
  [/^OpenPencilCase$/, 'cloth'], [/^CaseBallpoint_\d+$|^LooseBallpoint$|^LoosePencil$/, 'pen'],
];

export function createStationery({ room, canvas, camera, navigation, enabled, reduced, sound, brush, redraw, cancelView, animate, obstacles = () => [], action=()=>{} }) {
  const items = [], owners = new Map(), fallen = new Set();
  const recover = document.querySelector('#recover-stationery');
  room.updateWorldMatrix(true, true);
  room.traverse(node => {
    const def = definitions.find(([pattern]) => pattern.test(node.name));
    if (!def) return;
    const item = { node, kind: def[1], parent: node.parent, home: node.position.clone(),
      rotation: node.quaternion.clone(), bounds: new THREE.Box3(), solid: new THREE.Box3(), pulse: null,
      velocity: new THREE.Vector3(), spin: 0, supports:new Set(), sheet:prepareSheet(node),
      mass: {paper:.12,pen:.3,tape:1,cloth:1.4,metal:2,cup:5}[def[1]] };
    owners.set(node, item); items.push(item);
  });
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
  const point = new THREE.Vector3(), center = new THREE.Vector3();
  const blockers = [room.getObjectByName('RoomSurfaces'), ...room.children.flatMap(group => group.children.filter(n => n.name.startsWith('Item_')))].filter(Boolean);
  const candidate = [], intersections = [];
  let grip = null, hover = null, suppressClick = false, lastHover = -Infinity, lastBrush = -Infinity, lastUpdate, fixedSolids=[];
  const up = new THREE.Vector3(0,1,0);
  const supportSystem=createTableSupport(surface), supportDirty=new Set();
  function refreshItem(item) {
    item.bounds.setFromObject(item.node);
    solidBounds(item.node,item.solid);
  }
  function refresh() {
    for (const item of items) refreshItem(item);
    fixedSolids=obstacles();
  }
  function roots() {
    return items.filter(item=>{
      for(let p=item.node.parent;p;p=p.parent)if(owners.has(p))return false;
      return true;
    });
  }
  const related = (a,b) => a.node.getObjectById(b.node.id) || b.node.getObjectById(a.node.id) ||
    (grip?.item===a && b.node===grip.parent);
  const collisionBox = item => item.solid.clone();
  function dependsOn(item,base,seen=new Set()){
    if(seen.has(item))return false;seen.add(item);
    return item.supports.has(base)||[...item.supports].some(i=>dependsOn(i,base,seen));
  }
  function invalidate(base){
    for(const other of roots())if(other!==base&&dependsOn(other,base))supportDirty.add(other);
  }
  function supportBodies(item){
    return roots().filter(other=>other!==item&&!fallen.has(other)&&!related(item,other)&&
      !other.drop&&!other.slide&&grip?.item!==other&&!dependsOn(other,item));
  }
  function land(item,isFloor){
    refreshItem(item);
    if(isFloor===undefined){
      const c=item.solid.getCenter(new THREE.Vector3());
      isFloor=c.z>deskLayout.table.bounds[3]||Math.abs(c.x)>deskLayout.table.bounds[1];
    }
    if(isFloor){item.supports.clear();item.sheet?.flatten(reduced.matches);drop(item,item.node.position.y+floor-item.solid.min.y+.001,true);return;}
    const plan=supportSystem.plan(item,supportBodies(item));
    item.supports=plan.supports;
    if(item.sheet)item.sheet.target(plan.values,reduced.matches);
    if(Math.abs(plan.y-item.node.position.y)>.0005)drop(item,plan.y,false);
    invalidate(item);refreshItem(item);redraw();
  }
  function collisions(item, box, ignored) {
    const hits=roots().filter(other=>other!==item && other!==ignored && !fallen.has(other) && !related(item,other) &&
      !(item.kind==='paper' && other.kind==='paper') && overlaps(box,collisionBox(other)));
    return {hits,fixed:fixedSolids.some(b=>overlaps(box,b))};
  }
  function stepMove(item, delta, push, ignored) {
    const old=item.node.getWorldPosition(new THREE.Vector3()), before=collisionBox(item);
    setWorld(item.node,old.clone().add(delta));refreshItem(item);
    const box=collisionBox(item), swept=before.clone().union(box), contacts=collisions(item,swept,ignored);
    if(!contacts.fixed && !contacts.hits.length){invalidate(item);return true;}
    let displaced=push && !contacts.fixed;
    if(displaced) for(const other of contacts.hits){
      if(other.mass>=item.mass || other.drop || other.slide){displaced=false;continue;}
      finishPulse(other);refreshItem(other);
      if(stepMove(other,delta.clone().multiplyScalar(1.05),false,item)){
        other.velocity.addScaledVector(delta,3).clampLength(0,1.4);
        other.spin=THREE.MathUtils.clamp(other.spin+.10*Math.sign(delta.x||delta.z),-2,2);
      }else displaced=false;
    }
    const remaining=collisions(item,box,ignored);
    // Also stop a small, fast-moving pen tunnelling through a thin obstacle.
    if(!remaining.fixed && !remaining.hits.length && displaced && contacts.hits.length){invalidate(item);return true;}
    setWorld(item.node,old);refreshItem(item);return false;
  }
  function moveItem(item, delta, push=false) {
    const steps=Math.min(120,Math.max(1,Math.ceil(delta.length()/.06))), d=delta.clone().divideScalar(steps);
    let blocked=false;
    for(let i=0;i<steps;i++)if(!stepMove(item,d,push)){
      blocked=true;
      if(d.x)stepMove(item,new THREE.Vector3(d.x,0,0),push);
      if(d.z)stepMove(item,new THREE.Vector3(0,0,d.z),push);
    }
    return !blocked;
  }
  function rotateItem(item, angle) {
    const old=item.node.quaternion.clone();item.node.rotateOnWorldAxis(up,angle);refreshItem(item);
    const c=collisions(item,collisionBox(item));
    if(c.fixed||c.hits.length){item.node.quaternion.copy(old);refreshItem(item);return false;}
    return true;
  }
  refresh();
  for(const item of items)item.flatHeight=item.node.getWorldPosition(new THREE.Vector3()).y-item.solid.min.y;
  // Register the papers already on the desk without changing their authored pose.
  for(const item of roots()){
    const below=roots().filter(other=>other!==item&&other.solid.min.y<item.solid.min.y-.001&&
      other.solid.max.y<item.solid.min.y+.065&&!related(item,other));
    item.supports=new Set(below.filter(other=>supportSystem.crosses(item.solid,other.solid)&&
      Math.abs(item.solid.min.y-other.solid.max.y)<.065));
  }
  function aim(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1, 1-(event.clientY-rect.top)/rect.height*2);
    ray.setFromCamera(pointer, camera);
  }
  function hit(event) {
    aim(event); candidate.length = 0; intersections.length = 0;
    for (const item of items) if (!fallen.has(item) && ray.ray.intersectsBox(item.bounds)) candidate.push(item.node);
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
    if (reduced.matches || item.velocity.lengthSq()>1e-5 || Math.abs(item.spin)>.01) return;
    finishPulse(item);
    item.pulse = { start: performance.now(), sign, frequency:15+Math.random()*8,
      rotation: item.node.quaternion.clone(), position: item.node.position.clone() };
    redraw();
  }
  function react(target, direction, event) {
    if (target.leaf) {
      const dx=event?.movementX||direction*2, dy=event?.movementY||0;
      const force=new THREE.Vector3(dx,-dy,0).applyQuaternion(camera.quaternion).normalize();
      brush(target.leaf,{direction:force,strength:THREE.MathUtils.clamp(Math.hypot(dx,dy)/18,.12,1.5),point:target.point});
      if(!event || event.timeStamp-lastBrush>160)sound('touch', 'leaf');
    }
    else if (target.item.kind === 'pen') { tickle(target.item, direction); sound('touch', 'pen'); }
  }
  function kick(item, direction, strength, hitPoint) {
    if(item.kind==='cup'){tickle(item,Math.sign(direction.x)||1);return;}
    item.velocity.addScaledVector(direction,strength/Math.sqrt(item.mass));
    const center=item.solid.getCenter(new THREE.Vector3()), lever=hitPoint?.clone().sub(center);
    item.spin=THREE.MathUtils.clamp(item.spin+(lever?lever.z*direction.x-lever.x*direction.z:.1)*strength*3,-1.8,1.8);
    if(reduced.matches){moveItem(item,item.velocity.clone().multiplyScalar(.1),true);rotateItem(item,item.spin*.1);item.velocity.set(0,0,0);item.spin=0;}
    redraw();
  }
  function rollback() {
    if (!grip) return;
    if (grip.moved) {
      const { item }=grip;
      // A cancelled gesture leaves the prop at its last reachable position.
      // Never jump all the way back to where the drag started.
      item.velocity.set(0,0,0);item.spin=0;land(item);
    }
    grip = null; canvas.style.cursor = '';
  }
  canvas.addEventListener('pointerdown', event => {
    suppressClick = false;
    if (grip && event.pointerId !== grip.id) { rollback(); return; }
    if (!enabled() || !navigation.enabled || navigation.pointers.size || event.button !== 0 || event.shiftKey) return;
    const target = hit(event); if (!target || target.item.drop || target.item.slide) return;
    cancelView();
    const { item } = target; finishPulse(item);item.velocity.set(0,0,0);item.spin=0;
    plane.constant = -target.point.y;
    if (!ray.ray.intersectPlane(plane, point)) return;
    grip = { ...target, id: event.pointerId, x: event.clientX, y: event.clientY, anchor: point.clone(),
      parent: item.node.parent,
      world: item.node.getWorldPosition(new THREE.Vector3()), localHit:item.node.worldToLocal(target.point.clone()),
      lastPoint:point.clone(),lastTime:event.timeStamp,velocity:new THREE.Vector3(),spin:0,moved: false, lastSound: -Infinity };
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
      if (target && (target.leaf || next!==hover) && event.timeStamp-lastBrush > 75) {
        react(target, event.movementX < 0 ? -1 : 1,event); lastBrush = event.timeStamp;
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
    fixedSolids=obstacles();
    if (!grip.moved) {
      room.attach(item.node); grip.moved = true;
      invalidate(item);item.supports.clear();item.sheet?.flatten(reduced.matches);
      item.bounds.getCenter(center);
      grip.offset = center.sub(grip.world).clone();
      grip.height = grip.world.y - item.bounds.min.y;
      grip.depth = (item.bounds.max.z-item.bounds.min.z)/2;
      grip.halfWidth = (item.bounds.max.x-item.bounds.min.x)/2;
      sound('lift', item.kind);
    }
    const dt=Math.max(.008,(event.timeStamp-grip.lastTime)/1000), travel=point.clone().sub(grip.lastPoint);
    const lever=item.node.localToWorld(grip.localHit.clone()).sub(item.solid.getCenter(new THREE.Vector3()));
    const torque=THREE.MathUtils.clamp((lever.z*travel.x-lever.x*travel.z)*.6/(.08+lever.lengthSq()),-.09,.09);
    rotateItem(item,torque);
    grip.velocity.lerp(travel.clone().divideScalar(dt),.35);grip.velocity.clampLength(0,4);
    grip.spin=THREE.MathUtils.clamp(torque/dt,-1.5,1.5);
    grip.lastPoint.copy(point);grip.lastTime=event.timeStamp;
    point.sub(grip.anchor).add(grip.world);
    const sideLimit = 8.00 - grip.halfWidth;
    const cx = THREE.MathUtils.clamp(point.x + grip.offset.x, -sideLimit, sideLimit);
    const cz = THREE.MathUtils.clamp(point.z + grip.offset.z, Math.abs(cx)<6.22 ? .26+grip.depth : -.9, 7.6);
    point.set(cx-grip.offset.x, Math.max(surface + grip.height, grip.world.y) + .12, cz-grip.offset.z);
    // Carry the prop above the surfaces along this step. Unlike a footprint
    // extruded down to the desk, real vertical bounds allow stacked objects.
    const current=item.node.getWorldPosition(new THREE.Vector3());
    const swept=item.solid.clone().union(item.solid.clone().translate(new THREE.Vector3(point.x-current.x,0,point.z-current.z)));
    for(const other of supportBodies(item))if(supportSystem.crosses(swept,other.solid))
      point.y=Math.max(point.y,other.solid.max.y+grip.height+.10);
    setWorld(item.node,new THREE.Vector3(current.x,point.y,current.z));refreshItem(item);
    moveItem(item,new THREE.Vector3(point.x-current.x,0,point.z-current.z),true);
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
    sound(isFloor ? 'floor' : 'land', item.kind); refresh();invalidate(item);
  }
  canvas.addEventListener('pointerup', event => {
    if (!grip || grip.id !== event.pointerId) return;
    const { item, leaf, moved } = grip;
    suppressClick = true;
    if (moved) {
      const box = item.solid.clone();
      box.getCenter(center);
      const landOnFloor = center.z > deskLayout.table.bounds[3] || Math.abs(center.x) > deskLayout.table.bounds[1];
      if (!landOnFloor) {
        // A pen can still be returned to its own slot after moving the case.
        if (/^CaseBallpoint_/.test(item.node.name)) {
          const slot = item.parent.localToWorld(item.home.clone());
          if (Math.hypot(slot.x-item.node.position.x, slot.z-item.node.position.z) < .20) {
            item.parent.add(item.node); item.node.position.copy(item.home); item.node.quaternion.copy(item.rotation);
            fallen.delete(item); recover.hidden = !fallen.size; sound('land', 'pen');
            grip = null; canvas.style.cursor = ''; refresh(); redraw(); return;
          }
        }
      }
      land(item,landOnFloor);
      item.velocity.copy(grip.velocity).multiplyScalar(item.kind==='pen'?.13:.055).clampLength(0,.5);
      item.spin=grip.spin*(item.kind==='pen'?.5:.18);
      if(reduced.matches){item.velocity.set(0,0,0);item.spin=0;}
      // Friction on a support should not slide a freshly placed prop off it.
      if(item.supports.size){item.velocity.multiplyScalar(.15);item.spin*=.15;}
      const at=item.node.getWorldPosition(new THREE.Vector3());
      if(Math.hypot(at.x-grip.world.x,at.z-grip.world.z)>.01)action('mou_objecte',{objecte:item.node.name,tipus:item.kind});
    } else if (leaf) react({item,leaf,point:grip.point},1);
    else {
      const direction=camera.getWorldDirection(new THREE.Vector3());direction.y=0;direction.normalize();
      kick(item,direction,item.kind==='pen'?.16:item.kind==='paper'?.035:.065,grip.point);
      sound('touch',item.kind);
    }
    grip = null; canvas.style.cursor = '';
  });
  for (const type of ['pointercancel','lostpointercapture']) canvas.addEventListener(type, e => { if (grip?.id === e.pointerId) rollback(); });
  canvas.addEventListener('pointerleave', () => { hover = null; if (!grip) canvas.style.cursor = ''; });
  canvas.addEventListener('click', event => {
    if (suppressClick) { suppressClick = false; event.stopImmediatePropagation(); }
  }, true);
  recover.addEventListener('click', () => {
    let count=0;
    for (const item of fallen) {
      const previous={parent:item.node.parent,position:item.node.position.clone(),rotation:item.node.quaternion.clone()};
      item.parent.add(item.node); item.node.position.copy(item.home); item.node.quaternion.copy(item.rotation);
      refresh();
      const box=item.solid.clone(), center=box.getCenter(new THREE.Vector3());
      const route=routeOutside(box,[...fixedSolids,...roots().filter(other=>other!==item&&!fallen.has(other)&&!related(item,other)&&
        !(item.kind==='paper'&&(other.kind==='paper'||other.solid.max.y-other.solid.min.y<.04))).map(other=>other.solid)],[]);
      if(route?.length){
        const delta=route.at(-1).clone().sub(center);
        setWorld(item.node,item.node.getWorldPosition(new THREE.Vector3()).add(delta));
        fallen.delete(item);count++;
      }else{
        previous.parent.add(item.node);item.node.position.copy(previous.position);item.node.quaternion.copy(previous.rotation);
      }
      item.velocity.set(0,0,0);item.spin=0;
    }
    recover.hidden = !fallen.size; refresh(); redraw();
    if(count)action('recull_objectes',{quantitat:count});
  });
  async function clearSpace(regions) {
    rollback();
    for(const item of items){
      finishPulse(item);if(item.drop)settle(item);item.velocity.set(0,0,0);item.spin=0;
    }
    refresh();
    for(const item of roots()){
      if(fallen.has(item)||!regions.some(b=>overlaps(item.solid,b)))continue;
      const start=item.solid.getCenter(new THREE.Vector3()), origin=item.node.getWorldPosition(new THREE.Vector3());
      const offset=start.clone().sub(origin), rest=item.solid.clone();
      rest.translate(new THREE.Vector3(0,surface+.001-rest.min.y,0));
      const others=[...fixedSolids,...roots().filter(other=>other!==item&&!fallen.has(other)).map(other=>other.solid.clone())];
      const route=routeOutside(rest,others,regions);
      if(!route)return false;
      route[0].copy(start);
      if(route.length===1)route.push(rest.getCenter(new THREE.Vector3()));
      const lengths=[0];for(let i=1;i<route.length;i++)lengths.push(lengths[i-1]+route[i].distanceTo(route[i-1]));
      const total=lengths.at(-1);
      item.slide=true;sound('slide',item.kind);
      invalidate(item);item.supports.clear();refreshItem(item);
      await animate('make-room',t=>{
        const d=t*total;let i=1;while(i<lengths.length-1&&lengths[i]<d)i++;
        const fraction=(d-lengths[i-1])/Math.max(1e-9,lengths[i]-lengths[i-1]);
        const p=route[i-1].clone().lerp(route[i],fraction).sub(offset);
        setWorld(item.node,p);refreshItem(item);redraw();
      },Math.min(700,320+total*90));
      item.slide=false;refresh();land(item);if(item.drop)settle(item);
    }
    return true;
  }
  return {
    cancel: rollback,
    clearSpace,
    update(time) {
      const dt=lastUpdate===undefined?0:Math.min(.033,Math.max(0,(time-lastUpdate)/1000));lastUpdate=time;
      let moving = false;
      for(const item of [...supportDirty]){
        if(item.drop||item.slide||grip?.item===item)continue;
        supportDirty.delete(item);
        if(!fallen.has(item))land(item);
      }
      for (const item of items) {
        if(item.sheet?.update(time)){refreshItem(item);invalidate(item);moving=true;}
        if (item.drop) {
          const d = item.drop, elapsed = Math.max(0, (time-d.start)/1000);
          const rising=d.targetY>d.y,t=Math.min(1,elapsed/.22);
          item.node.position.y = rising?THREE.MathUtils.lerp(d.y,d.targetY,t*t*(3-2*t)):
            Math.max(d.targetY, d.y-(d.looseSheet ? 5.2 : 9.8)*elapsed*elapsed);
          if (d.looseSheet) {
            const progress = THREE.MathUtils.clamp((d.y-item.node.position.y)/(d.y-d.targetY), 0, 1);
            const flutter = Math.sin(progress*Math.PI) * Math.sin(elapsed*13);
            item.node.position.x = d.x + .11*flutter;
            item.node.rotation.z = d.angle + .18*flutter;
          }
          if (reduced.matches || (rising?t===1:item.node.position.y<=d.targetY)) settle(item);
          moving = true;
        }
        if((item.velocity.lengthSq()>1e-5||Math.abs(item.spin)>.01) &&
          !item.drop&&!item.slide&&grip?.item!==item&&!fallen.has(item)&&roots().includes(item)){
          fixedSolids=obstacles();
          if(!rotateItem(item,item.spin*dt))item.spin*=.25;
          if(!moveItem(item,item.velocity.clone().multiplyScalar(dt),true)){item.velocity.multiplyScalar(.15);item.spin*=.4;}
          const friction=item.kind==='pen'?3.4:6;
          item.velocity.multiplyScalar(Math.exp(-friction*dt));item.spin*=Math.exp(-5*dt);
          if(reduced.matches){item.velocity.set(0,0,0);item.spin=0;}
          if(item.velocity.lengthSq()<=1e-5&&Math.abs(item.spin)<=.01){item.velocity.set(0,0,0);item.spin=0;land(item);}
          refreshItem(item);
          const c=item.solid.getCenter(new THREE.Vector3());
          if(c.z>deskLayout.table.bounds[3]||Math.abs(c.x)>deskLayout.table.bounds[1]){
            const world=item.node.getWorldPosition(new THREE.Vector3());room.attach(item.node);
            drop(item,world.y+floor-item.solid.min.y+.001,true);
          }
          moving=true;
        }
        if (!item.pulse) continue;
        const age = Math.max(0, (time-item.pulse.start)/1000);
        if (age >= .68 || reduced.matches) finishPulse(item);
        else {
          const wave = item.pulse.sign*Math.sin(age*item.pulse.frequency)*Math.exp(-age*6);
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
