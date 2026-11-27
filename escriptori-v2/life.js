import * as THREE from 'three';

export const movingLeaves=new Set(['IndoorLeaf_2','IndoorLeaf_5','IndoorLeaf_8','IndoorLeaf_11']);

// Small independent behaviours, with ray-tested landings and walks. No physics
// world, pointer telemetry or per-frame DOM reads are needed.
export function createDeskLife({scene,camera,canvas,plant,landingSurfaces=[],reduced,redraw,onBrush=()=>{},randomSource=Math.random}){
  const random=randomSource,ray=new THREE.Raycaster(),surfaceRay=new THREE.Raycaster(),pointer=new THREE.Vector2(),mouse=new THREE.Vector2(),leaves=[],legs=[];
  plant?.traverse(n=>{if(movingLeaves.has(n.name))leaves.push({node:n,rest:n.quaternion.clone(),bend:0,velocity:0,phase:leaves.length*1.73});});
  const fly=new THREE.Group();fly.name='DeskFly';scene.add(fly);
  const body=new THREE.MeshStandardMaterial({color:'#252923',roughness:.48,metalness:.25}),eye=new THREE.MeshStandardMaterial({color:'#684332',roughness:.6});
  const abdomen=new THREE.Mesh(new THREE.CapsuleGeometry(.0016,.004,3,7),body);abdomen.rotation.x=Math.PI/2;fly.add(abdomen);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.0017,8,6),eye);head.position.z=-.0038;fly.add(head);
  const wingMaterial=new THREE.MeshStandardMaterial({color:'#cbd8cc',roughness:.9,envMapIntensity:.08,transparent:true,opacity:.29,side:THREE.DoubleSide,depthWrite:false});
  const wingShape=new THREE.Shape();wingShape.moveTo(0,0);wingShape.bezierCurveTo(.005,.003,.012,.001,.008,-.002);wingShape.quadraticCurveTo(.003,-.004,0,0);
  const wings=[];for(const side of [-1,1]){const wing=new THREE.Mesh(new THREE.ShapeGeometry(wingShape,5),wingMaterial);wing.rotation.x=-Math.PI/2;wing.scale.x=side;wing.position.set(side*.0007,.0015,.0004);fly.add(wing);wings.push(wing);}
  const legGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(.003,-.0015,.001),new THREE.Vector3(.004,-.003,.002)]),legMaterial=new THREE.LineBasicMaterial({color:'#353a2d'});
  for(const side of [-1,1])for(let i=0;i<3;i++){const leg=new THREE.Line(legGeometry,legMaterial);leg.scale.x=side;leg.rotation.y=(i-1)*.8;leg.position.z=(i-1)*.0013;fly.add(leg);legs.push(leg);}
  const up=new THREE.Vector3(0,1,0),normalMatrix=new THREE.Matrix3();
  let surface={point:new THREE.Vector3(-.22,.750,.015),normal:up.clone()},time=0,previous=0,nextAction=1.4+random()*3.8,flight=null,walk=null,paused=false;
  let lastBrush=-10,brushes=0,flights=0,walks=0,landings=0,pointerLandings=0,autoFlights=0,hasPointer=false,pointerAt=-100,landingFromPointer=false,lastDuration=0,lastCause='initial',lastLandingGap=null;
  const lift=s=>s.point.clone().addScaledVector(s.normal,.004);
  fly.position.copy(lift(surface));

  function visible(node){for(let n=node;n;n=n.parent)if(!n.visible)return false;return true;}
  function firstSolid(caster){
    return caster.intersectObjects(landingSurfaces,true).find(h=>h.object.isMesh&&visible(h.object)&&![].concat(h.object.material).every(m=>m.transparent));
  }
  function hitSurface(hit){
    if(!hit?.face)return null;
    const normal=hit.face.normal.clone().applyMatrix3(normalMatrix.getNormalMatrix(hit.object.matrixWorld)).normalize(),p=hit.point;
    if(p.x<-.84||p.x>1.17||p.y<.74||p.y>1.49||p.z<-.65||p.z>.285||normal.y<-.25)return null;
    return {point:p.clone(),normal};
  }
  function orient(normal,heading){
    let forward=heading.clone().projectOnPlane(normal);
    if(forward.lengthSq()<1e-8)forward=(Math.abs(normal.y)<.9?up.clone():new THREE.Vector3(0,0,-1)).projectOnPlane(normal);
    forward.normalize();const back=forward.negate(),right=new THREE.Vector3().crossVectors(normal,back).normalize();
    fly.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,normal,back));
  }
  function scheduleRest(){nextAction=time+(random()<.08?8+random()*7:1.3+random()*4.8);}
  function landingNearPointer(){
    if(!hasPointer||time-pointerAt>30)return null;
    const rect=canvas.getBoundingClientRect();
    for(let i=0;i<18;i++){
      const angle=random()*Math.PI*2,radius=156+random()*96;
      const ndc=new THREE.Vector2(mouse.x+Math.cos(angle)*radius/rect.width*2,mouse.y+Math.sin(angle)*radius/rect.height*2);
      if(Math.abs(ndc.x)>.94||Math.abs(ndc.y)>.88)continue;
      ray.setFromCamera(ndc,camera);const target=hitSurface(firstSolid(ray));
      if(target){lastLandingGap=radius;return target;}
    }
    return null;
  }
  function randomLanding(){
    for(let i=0;i<15;i++){
      if(random()<.26){
        surfaceRay.set(new THREE.Vector3(-.70+random()*1.78,.84+random()*.58,.38),new THREE.Vector3(0,0,-1));
      }else surfaceRay.set(new THREE.Vector3(-.74+random()*1.82,1.72,-.55+random()*.78),new THREE.Vector3(0,-1,0));
      surfaceRay.far=2;const target=hitSurface(firstSolid(surfaceRay));if(target)return target;
    }
    return surface;
  }
  function finishFlight(){
    const finished=flight;surface=finished.target;fly.position.copy(lift(surface));orient(surface.normal,finished.path.getTangentAt(1));flight=null;
    landings++;if(finished.biased)pointerLandings++;scheduleRest();
  }
  function takeFlight(cause='explore'){
    if(paused||reduced.matches||flight)return;
    // Most flights explore independently. The cursor is only an occasional bias.
    lastLandingGap=null;const preferred=random()<.35?landingNearPointer():null,target=preferred||randomLanding();
    landingFromPointer=Boolean(preferred);lastCause=cause;if(cause==='explore')autoFlights++;walk=null;
    const from=fly.position.clone(),to=lift(target),distance=from.distanceTo(to),roam=random()<.28,points=[from,from.clone().addScaledVector(surface.normal,.08+random()*.10)];
    const bends=roam?3:1+Math.floor(random()*2);
    for(let i=0;i<bends;i++){
      const u=(i+1)/(bends+1),p=from.clone().lerp(to,u);p.x+=(random()-.5)*(roam?.75:.32);p.z+=(random()-.5)*(roam?.5:.22);p.y=Math.max(p.y,1.19+random()*.22);
      p.x=THREE.MathUtils.clamp(p.x,-.74,1.10);p.z=THREE.MathUtils.clamp(p.z,-.51,.33);points.push(p);
    }
    points.push(to.clone().addScaledVector(target.normal,.08+random()*.07),to);
    const path=new THREE.CatmullRomCurve3(points,false,'centripetal');
    lastDuration=THREE.MathUtils.clamp(path.getLength()/(2.4+random()*1.8),.38,1.3);
    flight={path,start:time,duration:lastDuration,target,biased:Boolean(preferred)};flights++;redraw();
  }
  function startWalk(){
    for(let attempt=0;attempt<7;attempt++){
      const normal=surface.normal,reference=Math.abs(normal.y)<.9?up:new THREE.Vector3(0,0,-1),a=new THREE.Vector3().crossVectors(normal,reference).normalize(),b=new THREE.Vector3().crossVectors(normal,a),angle=random()*Math.PI*2;
      const forward=a.multiplyScalar(Math.cos(angle)).addScaledVector(b,Math.sin(angle)),side=new THREE.Vector3().crossVectors(normal,forward),distance=.014+random()*.055,curve=(random()-.5)*.65,points=[fly.position.clone()];let target;
      for(let i=1;i<=8;i++){
        const u=i/8,p=surface.point.clone().addScaledVector(forward,u*distance).addScaledVector(side,Math.sin(u*Math.PI)*distance*curve);
        surfaceRay.set(p.addScaledVector(normal,.02),normal.clone().negate());surfaceRay.far=.045;target=hitSurface(firstSolid(surfaceRay));
        if(!target||target.normal.dot(normal)<.96){target=null;break;}points.push(lift(target));
      }
      if(!target)continue;
      walk={path:new THREE.CatmullRomCurve3(points,false,'centripetal'),normal:normal.clone(),start:time,duration:THREE.MathUtils.clamp(distance/(.015+random()*.018),.8,3.8),target};walks++;redraw();return true;
    }
    return false;
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
    if(plant){
      const hit=ray.intersectObject(plant,true)[0];
      if(hit&&[].concat(hit.object.material||[]).some(m=>/^IndoorFoliage_|^IndoorLeafVeins/.test(m.name)))brush(hit.point,x-lastPointerX);
    }
    const screen=fly.position.clone().project(camera);if(screen.z>-1&&screen.z<1&&Math.hypot((screen.x+1)*rect.width/2-x,(1-screen.y)*rect.height/2-y)<48)takeFlight('startle');lastPointerX=x;
  }
  canvas.parentElement.addEventListener('pointermove',pointerMove);
  canvas.parentElement.addEventListener('pointerleave',()=>hasPointer=false);
  return {fly,
    tick(seconds){
      time=seconds;const dt=Math.min(.05,Math.max(0,seconds-previous));previous=seconds;
      if(!paused&&!reduced.matches){
        for(const leaf of leaves){leaf.velocity+=(-58*leaf.bend-10.5*leaf.velocity)*dt;leaf.bend=THREE.MathUtils.clamp(leaf.bend+leaf.velocity*dt,-.28,.28);const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(leaf.bend*.28,Math.sin(seconds*.41+leaf.phase)*.006,leaf.bend+Math.sin(seconds*.33+leaf.phase)*.005));leaf.node.quaternion.copy(leaf.rest).multiply(q);}
        if(flight){
          const u=THREE.MathUtils.clamp((seconds-flight.start)/flight.duration,0,1),travel=u*u*(3-2*u);fly.position.copy(flight.path.getPointAt(travel));orient(up,flight.path.getTangentAt(travel));if(u===1)finishFlight();
        }else if(walk){
          const u=THREE.MathUtils.clamp((seconds-walk.start)/walk.duration,0,1),travel=u*u*(3-2*u);fly.position.copy(walk.path.getPointAt(travel));orient(walk.normal,walk.path.getTangentAt(travel));
          if(u===1){surface=walk.target;walk=null;scheduleRest();}
        }else if(seconds>nextAction){if(random()<.58){if(!startWalk())takeFlight();}else takeFlight();}
      }
      const animated=!paused&&!reduced.matches;
      for(const [i,wing]of wings.entries())wing.rotation.z=(i?1:-1)*(animated&&flight ? .65+Math.sin(seconds*122)*.6 : .13);
      for(const [i,leg]of legs.entries())leg.rotation.z=animated&&walk?Math.sin(seconds*36+i*2.3)*.17:0;
      head.rotation.y=animated&&!flight?Math.sin(seconds*1.7)*.08:0;
    },
    pause(value){
      if(value&&flight)finishFlight();if(value&&walk){surface=walk.target;fly.position.copy(lift(surface));walk=null;}
      paused=value;fly.visible=!value;hasPointer=false;if(!value)scheduleRest();
    },
    moving:()=>!paused&&!reduced.matches&&(Boolean(flight||walk)||leaves.some(l=>Math.abs(l.bend)>.003||Math.abs(l.velocity)>.02)),
    info:()=>({fly:flight?'flying':walk?'walking':'resting',flights,walks,landings,pointerLandings,autoFlights,brushes,position:fly.position.toArray(),surfaceNormal:surface.normal.toArray(),bend:Math.max(0,...leaves.map(l=>Math.abs(l.bend))),landingFromPointer,lastDuration,lastCause,lastLandingGap}),
  };
}
