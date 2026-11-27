import * as THREE from 'three';

export const movingLeaves=new Set(['IndoorLeaf_2','IndoorLeaf_5','IndoorLeaf_8','IndoorLeaf_11']);

// Small, independent reactions. There is no per-frame DOM work or physics engine.
export function createDeskLife({scene,camera,canvas,plant,landingSurfaces=[],reduced,redraw,onBrush=()=>{}}){
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),leaves=[];
  plant?.traverse(n=>{if(movingLeaves.has(n.name))leaves.push({node:n,rest:n.quaternion.clone(),bend:0,velocity:0,phase:leaves.length*1.73});});
  const fly=new THREE.Group();fly.name='DeskFly';scene.add(fly);
  const body=new THREE.MeshStandardMaterial({color:'#252923',roughness:.48,metalness:.25}),eye=new THREE.MeshStandardMaterial({color:'#684332',roughness:.6});
  const abdomen=new THREE.Mesh(new THREE.CapsuleGeometry(.0016,.004,3,7),body);abdomen.rotation.x=Math.PI/2;fly.add(abdomen);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.0017,8,6),eye);head.position.z=-.0038;fly.add(head);
  const wingMaterial=new THREE.MeshBasicMaterial({color:'#cbd8cc',transparent:true,opacity:.29,side:THREE.DoubleSide,depthWrite:false});
  const wingShape=new THREE.Shape();wingShape.moveTo(0,0);wingShape.bezierCurveTo(.005,.003,.012,.001,.008,-.002);wingShape.quadraticCurveTo(.003,-.004,0,0);
  const wings=[];for(const side of [-1,1]){const wing=new THREE.Mesh(new THREE.ShapeGeometry(wingShape,5),wingMaterial);wing.rotation.x=-Math.PI/2;wing.scale.x=side;wing.position.set(side*.0007,.0015,.0004);fly.add(wing);wings.push(wing);}
  const legGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(.003,-.0015,.001),new THREE.Vector3(.004,-.003,.002)]);
  for(const side of [-1,1])for(let i=0;i<3;i++){const leg=new THREE.Line(legGeometry,new THREE.LineBasicMaterial({color:'#353a2d'}));leg.scale.x=side;leg.rotation.y=(i-1)*.8;leg.position.z=(i-1)*.0013;fly.add(leg);}
  const perches=[new THREE.Vector3(-.22,.754,.015),new THREE.Vector3(.39,1.14,-.641),new THREE.Vector3(.307,1.169,-.39),new THREE.Vector3(.49,.754,.12)];
  fly.position.copy(perches[0]);let seed=51703,time=0,previous=0,nextFlight=4.5,flight=null,perch=0,paused=false,lastBrush=-10,brushes=0,flights=0;
  let hasPointer=false,pointerAt=-100,landingFromPointer=false,lastDuration=0;
  const deskPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.754),mouse=new THREE.Vector2();
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function visible(node){for(let n=node;n;n=n.parent)if(!n.visible)return false;return true;}
  function landingNearPointer(){
    if(!hasPointer||time-pointerAt>30)return null;
    const rect=canvas.getBoundingClientRect();
    for(let i=0;i<18;i++){
      const angle=random()*Math.PI*2,radius=78+random()*48;
      const ndc=new THREE.Vector2(mouse.x+Math.cos(angle)*radius/rect.width*2,mouse.y+Math.sin(angle)*radius/rect.height*2);
      if(Math.abs(ndc.x)>.92||Math.abs(ndc.y)>.86)continue;
      ray.setFromCamera(ndc,camera);const p=ray.ray.intersectPlane(deskPlane,new THREE.Vector3());
      if(!p||p.x<-.77||p.x>1.09||p.z<-.58||p.z>.24)continue;
      // Land on exposed wood, never inside a cup, sheet, binder or box.
      const obstruction=ray.intersectObjects(landingSurfaces,true).find(h=>h.object.isMesh&&visible(h.object)&&!h.object.material.transparent);
      if(obstruction&&obstruction.distance<ray.ray.origin.distanceTo(p)-.006)continue;
      return p;
    }
    return null;
  }
  function flee(){
    if(paused||reduced.matches||flight)return;
    const preferred=landingNearPointer(),next=(perch+1+Math.floor(random()*(perches.length-1)))%perches.length,from=fly.position.clone(),to=preferred||perches[next].clone();landingFromPointer=Boolean(preferred);
    const path=new THREE.CatmullRomCurve3([from,from.clone().add(new THREE.Vector3((random()-.5)*.12,.16,.05)),new THREE.Vector3(-.20+(random()-.5)*.45,1.19+(random()-.5)*.20,.15+(random()-.5)*.20),new THREE.Vector3(.18+(random()-.5)*.45,1.32+(random()-.5)*.12,-.12+(random()-.5)*.15),new THREE.Vector3(to.x,Math.max(1.12,to.y+.08),to.z+.035),to],false,'centripetal');
    lastDuration=.68+random()*.34;flight={path,start:time,duration:lastDuration,next:preferred?-1:next,to};flights++;redraw();
  }
  function brush(point,dx=1){
    if(reduced.matches||time-lastBrush<.13||!leaves.length)return;
    const nearest=[...leaves].sort((a,b)=>a.node.getWorldPosition(new THREE.Vector3()).distanceToSquared(point)-b.node.getWorldPosition(new THREE.Vector3()).distanceToSquared(point));
    nearest.slice(0,2).forEach((leaf,i)=>{leaf.velocity+=Math.sign(dx||1)*(1.05+random()*.6)/(i+1);});
    if(time-lastBrush>.55)onBrush();lastBrush=time;brushes++;redraw();
  }
  let lastPointerX=0;
  function pointerMove(event){
    if(paused||event.target.closest('.view-tools,.material-info,.inspection-close,.desk-list')||!canvas.isConnected)return;
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    pointer.set(x/rect.width*2-1,1-y/rect.height*2);mouse.copy(pointer);hasPointer=true;pointerAt=time;ray.setFromCamera(pointer,camera);
    if(plant){const hit=ray.intersectObject(plant,true)[0];if(hit)brush(hit.point,x-lastPointerX);}
    const screen=fly.position.clone().project(camera);if(screen.z>-1&&screen.z<1&&Math.hypot((screen.x+1)*rect.width/2-x,(1-screen.y)*rect.height/2-y)<48)flee();lastPointerX=x;
  }
  canvas.parentElement.addEventListener('pointermove',pointerMove);
  return {fly,
    tick(seconds){
      time=seconds;const dt=Math.min(.05,Math.max(0,seconds-previous));previous=seconds;
      if(!paused&&!reduced.matches){
        for(const leaf of leaves){leaf.velocity+=(-58*leaf.bend-10.5*leaf.velocity)*dt;leaf.bend=THREE.MathUtils.clamp(leaf.bend+leaf.velocity*dt,-.28,.28);const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(leaf.bend*.28,Math.sin(seconds*.41+leaf.phase)*.006,leaf.bend+Math.sin(seconds*.33+leaf.phase)*.005));leaf.node.quaternion.copy(leaf.rest).multiply(q);}
        if(flight){const u=THREE.MathUtils.clamp((seconds-flight.start)/flight.duration,0,1);fly.position.copy(flight.path.getPoint(u));const tangent=flight.path.getTangent(u);fly.rotation.y=Math.atan2(tangent.x,tangent.z)+Math.PI;fly.rotation.x=tangent.y*.45;if(u===1){perch=flight.next;flight=null;nextFlight=seconds+2.7+random()*3.4;if(perch===1)fly.rotation.set(Math.PI/2,0,random()*Math.PI*2);else fly.rotation.set(0,random()*Math.PI*2,0);}}
        else if(seconds>nextFlight)flee();
      }
      for(const [i,wing]of wings.entries())wing.rotation.z=(i?1:-1)*(flight ? .65+Math.sin(seconds*122)*.6 : .13);
    },
    pause(value){paused=value;fly.visible=!value;if(value&&flight){perch=flight.next;fly.position.copy(flight.to);flight=null;}if(!value)nextFlight=time+3+random()*4;},
    moving:()=>Boolean(flight)||leaves.some(l=>Math.abs(l.bend)>.003||Math.abs(l.velocity)>.02),
    info:()=>({fly:flight?'flying':'resting',flights,brushes,position:fly.position.toArray(),bend:Math.max(0,...leaves.map(l=>Math.abs(l.bend))),landingFromPointer,lastDuration}),
  };
}
