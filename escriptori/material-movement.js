import * as THREE from 'three';
import { deskLayout } from './desk-layout.js?v=1.10.0';
import { overlaps, routeOutside } from './table-space.js?v=1.16.0';

export function createMaterialMovement({models,shelf,canvas,camera,navigation,stationery,animate,cancelMotion,enabled,onBusy,redraw,onAction}) {
  const surface=canvas.parentElement,ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(),point=new THREE.Vector3();
  const fixed=deskLayout.organizer.dividerXs.map(x=>new THREE.Box3(new THREE.Vector3(x-.06,-.625,-1.69),new THREE.Vector3(x+.06,1.845,.25)));
  let current=null,busy=false;
  const bounds=model=>model.outlineBounds.clone().applyMatrix4(model.group.matrixWorld);
  function aim(event){const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);camera.updateMatrixWorld();ray.setFromCamera(pointer,camera);return ray.ray.intersectPlane(plane,point);}
  const obstacles=model=>[...fixed,...[...models.values()].filter(m=>m!==model).map(bounds),...stationery.contactBodies().map(i=>i.solid)];
  function move(model,target){
    const start=model.group.position.clone(),body=bounds(model),[left,right,back,front]=deskLayout.table.bounds;
    target.x=THREE.MathUtils.clamp(target.x,left+start.x-body.min.x+.02,right+start.x-body.max.x-.02);
    target.z=THREE.MathUtils.clamp(target.z,back+start.z-body.min.z+.02,front+start.z-body.max.z-.02);
    const delta=target.clone().sub(start);delta.y=0;
    const blockers=obstacles(model),steps=Math.min(120,Math.max(1,Math.ceil(delta.length()/.04))),step=delta.divideScalar(steps);
    function tryStep(d){
      const swept=bounds(model);
      model.group.position.add(d);model.group.updateWorldMatrix(true,true);const b=bounds(model);
      if(b.min.x<left+.019||b.max.x>right-.019||b.min.z<back+.019||b.max.z>front-.019||blockers.some(o=>overlaps(swept.union(b),o))){model.group.position.sub(d);model.group.updateWorldMatrix(true,true);return false;}
      return true;
    }
    for(let i=0;i<steps;i++)if(!tryStep(step)){if(step.x)tryStep(new THREE.Vector3(step.x,0,0));if(step.z)tryStep(new THREE.Vector3(0,0,step.z));}
    model.home.copy(model.group.position);redraw();
  }
  function update(g){
    if(!g.readyToMove||!aim(g.latest))return;
    const target=g.origin.clone().add(point.clone().sub(g.anchor));
    if(shelf.has(g.model))shelf.dragTo(g.model,target.x);else move(g.model,target);
    const tracked=navigation.pointers.get(g.id);if(tracked){tracked.x=g.latest.clientX;tracked.y=g.latest.clientY;}
  }
  async function begin(g){
    busy=true;onBusy(true);stationery.cancel();cancelMotion('view');
    document.querySelector('#desk-status').textContent='';
    for(const m of models.values())cancelMotion('hover-'+m.project.id);
    for(const m of models.values())if(m!==g.model&&!shelf.has(m)){
      const from=m.group.position.clone();animate('hover-'+m.project.id,t=>m.group.position.lerpVectors(from,m.home,t));
    }
    surface.classList.add('is-moving-material');g.model.project.button.setAttribute('aria-grabbed','true');
    if(shelf.has(g.model)){
      const [left,right]=deskLayout.organizer.openings[0];
      const lane=new THREE.Box3(new THREE.Vector3(left,deskLayout.table.surfaceY,.27),new THREE.Vector3(right,2,2.7));
      if(!await stationery.clearSpace([lane])){document.querySelector('#desk-status').textContent='Fes una mica de lloc davant dels arxivadors per poder-los moure.';return;}
      await shelf.dragOut(g.model);g.origin.copy(g.model.home);
    }
    else {g.model.group.position.copy(g.model.home);g.model.group.updateWorldMatrix(true,true);}
    g.readyToMove=true;update(g);
  }
  async function finish(g){
    if(g.finished)return;g.finished=true;navigation.dragged=true;
    try{
      await g.preparing;update(g);
      if(g.readyToMove){
        if(shelf.has(g.model))await shelf.dragIn(g.model);
        onAction('mou_material',{projecte:g.model.project.id,tipus:g.model.project.kind});
      }else {
        const from=new Map([...models.values()].map(m=>[m,m.group.position.clone()]));
        await animate('material-cancel',t=>{for(const m of models.values())m.group.position.lerpVectors(from.get(m),m.home,t);redraw();});
      }
    }finally{
      if(current===g)current=null;busy=false;onBusy(false);surface.classList.remove('is-moving-material');
      g.model.project.button.removeAttribute('aria-grabbed');redraw();
    }
  }
  for(const model of models.values()){
    const button=model.project.button;
    button.title='Clic per obrir · Arrossega per moure · Majúscules + arrossega per moure la càmera';
    button.addEventListener('pointerdown',event=>{
      if(!enabled()||busy||event.button!==0||event.shiftKey||navigation.pointers.size)return;
      if(shelf.has(model))plane.set(new THREE.Vector3(0,0,1),-(model.home.z+.8));
      else {model.group.updateWorldMatrix(true,true);plane.set(new THREE.Vector3(0,1,0),-bounds(model).getCenter(point).y);}
      if(!aim(event))return;
      current={model,id:event.pointerId,x:event.clientX,y:event.clientY,anchor:point.clone(),origin:model.home.clone(),latest:event,started:false};
      event.preventDefault();button.setPointerCapture(event.pointerId);
    });
    button.addEventListener('pointermove',event=>{
      const g=current;if(!g||g.id!==event.pointerId||g.finished)return;
      g.latest={clientX:event.clientX,clientY:event.clientY};
      const tracked=navigation.pointers.get(g.id);if(tracked){tracked.x=event.clientX;tracked.y=event.clientY;}
      if(!g.started&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<=6)return;
      event.preventDefault();navigation.dragged=true;
      if(!g.started){g.started=true;g.preparing=begin(g);}
      else update(g);
    });
    button.addEventListener('pointerup',event=>{
      const g=current;if(!g||g.id!==event.pointerId||g.finished)return;
      if(g.started){event.preventDefault();finish(g);}
      else {current=null;if(event.pointerType==='touch')button.click();}
    });
    for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,event=>{const g=current;if(g?.id!==event.pointerId)return;if(g.started)finish(g);else current=null;});
  }
  // A second finger hands both pointers back to camera pan/pinch. Keeping the
  // first pointer's current coordinates avoids a jump during the hand-off.
  surface.addEventListener('pointerdown',event=>{const g=current;if(g&&g.id!==event.pointerId){if(g.started)finish(g);else current=null;}},true);
  surface.addEventListener('wheel',event=>{if(busy){event.preventDefault();event.stopPropagation();}},{capture:true,passive:false});
  window.addEventListener('blur',()=>{const g=current;if(g?.started)finish(g);else current=null;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&current?.started){event.preventDefault();finish(current);}});
  async function clearSpace(regions,selected){
    for(const model of models.values()){
      if(model===selected||shelf.has(model))continue;
      model.group.updateWorldMatrix(true,true);const body=bounds(model);
      if(!regions.some(r=>overlaps(r,body)))continue;
      const route=routeOutside(body,obstacles(model).filter(b=>!overlaps(b,body)),regions);if(!route)return false;
      const origin=model.group.position.clone(),center=body.getCenter(new THREE.Vector3()),lengths=[0];
      for(let i=1;i<route.length;i++)lengths.push(lengths.at(-1)+route[i].distanceTo(route[i-1]));
      const total=lengths.at(-1);
      await animate('material-make-room',t=>{
        const distance=total*t;let i=1;while(i<lengths.length-1&&lengths[i]<distance)i++;
        const next=route[i]||route[0],previous=route[i-1]||route[0],u=(distance-(lengths[i-1]||0))/Math.max(1e-9,(lengths[i]||0)-(lengths[i-1]||0));
        model.group.position.copy(origin).add(previous.clone().lerp(next,u).sub(center));redraw();
      },Math.min(820,320+total*90));
      model.home.copy(model.group.position);
    }
    return true;
  }
  return {get busy(){return busy;},clearSpace,info:()=>({busy,project:current?.model.project.id||null})};
}
