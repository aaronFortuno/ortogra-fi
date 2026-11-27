import * as THREE from 'three';

export const movingLeaves=new Set(['IndoorLeaf_2','IndoorLeaf_5','IndoorLeaf_8','IndoorLeaf_11']);

// Small, independent reactions. There is no per-frame DOM work or physics engine.
export function createDeskLife({scene,camera,canvas,plant,reduced,redraw,onBrush=()=>{}}){
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
  fly.position.copy(perches[0]);let seed=51703,time=0,previous=0,nextFlight=7.5,flight=null,perch=0,paused=false,lastBrush=-10,brushes=0,flights=0;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function flee(){
    if(paused||reduced.matches||flight)return;
    const next=(perch+1+Math.floor(random()*(perches.length-1)))%perches.length,from=fly.position.clone(),to=perches[next];
    const path=new THREE.CatmullRomCurve3([from,from.clone().add(new THREE.Vector3(.025,.10,.025)),new THREE.Vector3(-.34+(random()-.5)*.20,.995+(random()-.5)*.06,.15+(random()-.5)*.10),new THREE.Vector3(.08+(random()-.5)*.30,1.31+(random()-.5)*.08,-.02+(random()-.5)*.12),new THREE.Vector3(to.x,Math.max(1.27,to.y+.06),to.z+.055),to.clone()],false,'centripetal');
    flight={path,start:time,duration:2.6+random()*1.4,next};flights++;redraw();
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
    pointer.set(x/rect.width*2-1,1-y/rect.height*2);ray.setFromCamera(pointer,camera);
    if(plant){const hit=ray.intersectObject(plant,true)[0];if(hit)brush(hit.point,x-lastPointerX);}
    const screen=fly.position.clone().project(camera);if(screen.z>-1&&screen.z<1&&Math.hypot((screen.x+1)*rect.width/2-x,(1-screen.y)*rect.height/2-y)<65)flee();lastPointerX=x;
  }
  canvas.parentElement.addEventListener('pointermove',pointerMove);
  return {fly,
    tick(seconds){
      time=seconds;const dt=Math.min(.05,Math.max(0,seconds-previous));previous=seconds;
      if(!paused&&!reduced.matches){
        for(const leaf of leaves){leaf.velocity+=(-58*leaf.bend-10.5*leaf.velocity)*dt;leaf.bend=THREE.MathUtils.clamp(leaf.bend+leaf.velocity*dt,-.28,.28);const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(leaf.bend*.28,Math.sin(seconds*.41+leaf.phase)*.006,leaf.bend+Math.sin(seconds*.33+leaf.phase)*.005));leaf.node.quaternion.copy(leaf.rest).multiply(q);}
        if(flight){const u=THREE.MathUtils.clamp((seconds-flight.start)/flight.duration,0,1);fly.position.copy(flight.path.getPoint(u));const tangent=flight.path.getTangent(u);fly.rotation.y=Math.atan2(tangent.x,tangent.z)+Math.PI;fly.rotation.x=tangent.y*.45;if(u===1){perch=flight.next;flight=null;nextFlight=seconds+7+random()*11;if(perch===1)fly.rotation.set(Math.PI/2,0,random()*Math.PI*2);else fly.rotation.set(0,random()*Math.PI*2,0);}}
        else if(seconds>nextFlight)flee();
      }
      for(const [i,wing]of wings.entries())wing.rotation.z=(i?1:-1)*(flight ? .65+Math.sin(seconds*122)*.6 : .13);
    },
    pause(value){paused=value;fly.visible=!value;if(value&&flight){perch=flight.next;fly.position.copy(perches[perch]);flight=null;}if(!value)nextFlight=time+5+random()*7;},
    info:()=>({fly:flight?'flying':'resting',flights,brushes,position:fly.position.toArray(),bend:Math.max(0,...leaves.map(l=>Math.abs(l.bend)))}),
  };
}
