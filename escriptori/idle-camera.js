import * as THREE from 'three';

// A render-time breathing pose, never an accumulating change to navigation.
// On input, retain the exact visible pose as the new base before any raycast.
export function createIdleCamera(camera,navigation,{reduced,redraw}){
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),offset=new THREE.Quaternion(),angles=new THREE.Euler();
  const visiblePosition=new THREE.Vector3(),visibleRotation=new THREE.Quaternion();
  let applied=false,quietUntil=performance.now()+3500,start=null,lastTime=null,clock=0,amount=0,pointerDown=false;
  function restore(){
    if(!applied)return;
    // A resize or a direct view change owns the camera; never restore an older
    // saved pose over an intentional edit made between two rendered frames.
    if(camera.position.distanceToSquared(visiblePosition)>1e-12||1-Math.abs(camera.quaternion.dot(visibleRotation))>1e-12){applied=false;interrupt();return;}
    camera.position.copy(position);camera.quaternion.copy(rotation);camera.updateMatrixWorld();applied=false;
  }
  function interrupt(){
    if(applied){
      const distance=position.distanceTo(navigation.target);
      navigation.target.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()),distance);applied=false;
    }
    quietUntil=performance.now()+3500;start=null;amount=0;lastTime=null;
    if(!document.hidden)redraw();
  }
  document.addEventListener('pointerdown',()=>{interrupt();pointerDown=true;},{capture:true});
  for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{pointerDown=false;interrupt();},{capture:true});
  for(const type of ['wheel','keydown','focusin'])document.addEventListener(type,interrupt,{capture:true,passive:true});
  window.addEventListener('blur',()=>{pointerDown=false;interrupt();});
  document.addEventListener('visibilitychange',interrupt);
  reduced.addEventListener('change',interrupt);
  return {
    restore,interrupt,
    update(time,enabled){
      if(!enabled||pointerDown||reduced.matches||document.hidden||time<quietUntil){start=null;lastTime=null;amount=0;return false;}
      start??=time;const dt=lastTime===null?0:Math.min(.1,(time-lastTime)/1000);lastTime=time;clock+=dt;
      amount=THREE.MathUtils.smoothstep(time-start,0,220);
      position.copy(camera.position);rotation.copy(camera.quaternion);
      const yaw=(Math.sin(clock*.31)*.0009+Math.sin(clock*.17+.7)*.00035)*amount;
      const pitch=(Math.sin(clock*.43+.4)*.00048+Math.sin(clock*.23)*.00022)*amount;
      angles.set(pitch,yaw,Math.sin(clock*.19)*.00016*amount);offset.setFromEuler(angles);
      camera.quaternion.multiply(offset);
      camera.position.add(new THREE.Vector3(Math.sin(clock*.27)*.004,Math.sin(clock*.37)*.0015,0).applyQuaternion(rotation).multiplyScalar(amount));
      camera.updateMatrixWorld();visiblePosition.copy(camera.position);visibleRotation.copy(camera.quaternion);applied=true;return true;
    },
    info:()=>({applied,amount,clock,quietUntil,pointerDown}),
  };
}
