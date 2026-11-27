import * as THREE from 'three';

export const SEAT=Object.freeze([-.52,1.06,.53]);
export function createSeatedLook(camera,surface,{redraw,onGesture=()=>{}}){
  const seat=new THREE.Vector3(...SEAT),rotation=new THREE.Euler(-.46,-.22,0,'YXZ'),pointers=new Map();
  let enabled=true,dragged=false;
  function update(){camera.position.copy(seat);camera.quaternion.setFromEuler(rotation);camera.updateMatrixWorld();redraw();}
  function turn(dx,dy){rotation.y=THREE.MathUtils.clamp(rotation.y+dx,-1.40,1.10);rotation.x=THREE.MathUtils.clamp(rotation.x+dy,-1.20,.70);update();}
  surface.addEventListener('pointerdown',e=>{
    if(!enabled||(e.target.closest('button,a,section,nav')&&!e.target.closest('.project-target'))||e.button>0)return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});dragged=false;e.target.setPointerCapture(e.pointerId);
  });
  surface.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p||!enabled)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(Math.hypot(p.x-p.startX,p.y-p.startY)>5)dragged=true;if(dragged){e.preventDefault();turn(dx*.003,dy*.0026);}});
  const end=e=>{if(pointers.delete(e.pointerId)&&dragged)onGesture();};surface.addEventListener('pointerup',end);surface.addEventListener('pointercancel',end);
  surface.addEventListener('click',e=>{if(dragged&&e.detail){dragged=false;e.preventDefault();e.stopImmediatePropagation();}},true);
  surface.addEventListener('wheel',e=>{if(!enabled||e.target.closest('button,a,section,nav'))return;e.preventDefault();turn(0,-e.deltaY*.0008);onGesture();},{passive:false});
  surface.addEventListener('keydown',e=>{if(!enabled||e.target.closest('button,a'))return;const d={ArrowLeft:[.10,0],ArrowRight:[-.10,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]}[e.key];if(d){e.preventDefault();turn(...d);onGesture();}});
  update();
  return {set enabled(value){enabled=value;if(!value)pointers.clear();},get enabled(){return enabled;},
    home(){rotation.set(-.46,camera.aspect<.9?.04:-.22,0,'YXZ');update();},turn,
    sync(){rotation.setFromQuaternion(camera.quaternion,'YXZ');camera.position.copy(seat);},
    info:()=>({seat:seat.toArray(),position:camera.position.toArray(),yaw:rotation.y,pitch:rotation.x,enabled})};
}
