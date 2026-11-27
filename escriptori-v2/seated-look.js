import * as THREE from 'three';

export const SEAT=Object.freeze([-.22,1.06,.53]);
export function createSeatedLook(camera,surface,{redraw,onGesture=()=>{}}){
  const seat=new THREE.Vector3(...SEAT),rotation=new THREE.Euler(-.42,-.14,0,'YXZ'),pointers=new Map();
  let enabled=true,dragged=false,zoomFrame=0,zoomTarget=camera.fov,zoomGesture;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function update(){camera.position.copy(seat);camera.quaternion.setFromEuler(rotation);camera.updateMatrixWorld();redraw();}
  function turn(dx,dy){rotation.y=THREE.MathUtils.clamp(rotation.y+dx,-1.40,1.10);rotation.x=THREE.MathUtils.clamp(rotation.x+dy,-1.20,.70);update();}
  surface.addEventListener('pointerdown',e=>{
    if(!enabled||(e.target.closest('button,a,section,nav')&&!e.target.closest('.project-target'))||e.button>0)return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});dragged=false;e.target.setPointerCapture(e.pointerId);
  });
  surface.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p||!enabled)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(Math.hypot(p.x-p.startX,p.y-p.startY)>5)dragged=true;if(dragged){e.preventDefault();turn(dx*.003,dy*.0026);}});
  const end=e=>{if(pointers.delete(e.pointerId)&&dragged)onGesture('arrossega');};surface.addEventListener('pointerup',end);surface.addEventListener('pointercancel',end);
  surface.addEventListener('click',e=>{if(dragged&&e.detail){dragged=false;e.preventDefault();e.stopImmediatePropagation();}},true);
  function zoomTick(){
    zoomFrame=0;if(!enabled)return;
    camera.fov=reduced.matches?zoomTarget:THREE.MathUtils.lerp(camera.fov,zoomTarget,.24);
    if(Math.abs(camera.fov-zoomTarget)<.015)camera.fov=zoomTarget;
    camera.updateProjectionMatrix();redraw();if(camera.fov!==zoomTarget)zoomFrame=requestAnimationFrame(zoomTick);
  }
  function stopZoom(){cancelAnimationFrame(zoomFrame);zoomFrame=0;zoomTarget=camera.fov;clearTimeout(zoomGesture);}
  surface.addEventListener('wheel',e=>{
    if(!enabled||e.ctrlKey||(e.target.closest('button,a,section,nav')&&!e.target.closest('.project-target')))return;
    e.preventDefault();const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?surface.clientHeight:1);
    zoomTarget=THREE.MathUtils.clamp(zoomTarget+THREE.MathUtils.clamp(pixels,-180,180)*.045,34,62);
    if(reduced.matches){camera.fov=zoomTarget;camera.updateProjectionMatrix();redraw();}else if(!zoomFrame)zoomFrame=requestAnimationFrame(zoomTick);
    clearTimeout(zoomGesture);zoomGesture=setTimeout(()=>onGesture('zoom'),220);
  },{passive:false});
  surface.addEventListener('keydown',e=>{if(!enabled||e.target.closest('button,a'))return;const d={ArrowLeft:[.10,0],ArrowRight:[-.10,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]}[e.key];if(d){e.preventDefault();turn(...d);onGesture('teclat');}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopZoom();});
  update();
  return {set enabled(value){enabled=value;if(!value){pointers.clear();stopZoom();}},get enabled(){return enabled;},
    home(){stopZoom();camera.fov=zoomTarget=50;camera.updateProjectionMatrix();rotation.set(-.42,camera.aspect<.9?.30:-.14,0,'YXZ');update();},turn,
    sync(){stopZoom();rotation.setFromQuaternion(camera.quaternion,'YXZ');camera.position.copy(seat);},
    info:()=>({seat:seat.toArray(),position:camera.position.toArray(),yaw:rotation.y,pitch:rotation.x,fov:camera.fov,zoomTarget,enabled})};
}
