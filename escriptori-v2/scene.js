import * as THREE from 'three';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from '../assets/vendor/three/addons/utils/BufferGeometryUtils.js';
import { prepareMaterials } from '../escriptori/materials.js?v=1.22.0';
import { prepareBinderLoad, arrangeBinderRow } from '../escriptori/binder-load.js?v=1.25.0';
import { createLabelTexture } from '../escriptori/labels.js?v=1.11.0';
import { createBinderShelf } from '../escriptori/binder-shelf.js?v=1.27.0';
import { createPerformanceMonitor } from '../escriptori/performance.js?v=1.22.1';
import { solarLight } from '../escriptori/solar.js?v=1.6.0';
import { createSeatedLook, SEAT } from './seated-look.js?v=0.1.0';
import { createRoom } from './room.js?v=0.1.0';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const flatBinder=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),new THREE.Vector3(-1,0,0)));
export async function createDesk({canvas,projects,resources,onStage,onObjectSound=()=>{},onAction=()=>{}}){
  const surface=canvas.parentElement,renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(54,1,.025,12);camera.position.set(...SEAT);
  const monitor=createPerformanceMonitor(renderer),models=new Map(),motions=new Map();let frame=0,ambientTimer,active=null,phase='shelf',hovered=null,inspected=null,savedLook,clock=0,lastAmbient,lastTime,lastShadow=-Infinity,readyToRender=false;
  const look=createSeatedLook(camera,surface,{redraw:()=>requestRender(),onGesture:()=>onAction('mira',{gest:'arrossega'})});
  const room=createRoom(scene),content=new THREE.Group();content.name='ProjectMaterials';scene.add(content);
  const sky=new THREE.HemisphereLight('#e0e9e6','#9e8b6d',.7);scene.add(sky);
  const sun=new THREE.DirectionalLight('#fff4db',2.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-1.6,right:1.6,top:1.7,bottom:-1.3,near:.1,far:8});sun.shadow.normalBias=.008;sun.shadow.bias=-.0003;sun.shadow.radius=3;scene.add(sun,sun.target);
  onStage(null,'Preparant els materials de la taula…');
  const bytes=await resources.buffer(new URL('../assets/desk/escriptori.glb?v=1.15.0',import.meta.url).href),asset=await new GLTFLoader().parseAsync(bytes,new URL('../assets/desk/',import.meta.url).href);
  let variant=0;
  for(const project of projects){
    const group=asset.scene.getObjectByName('Item_'+project.id),lid=group.getObjectByName('Lid_'+project.id);content.add(group);group.position.set(0,0,0);group.rotation.set(0,0,0);group.scale.setScalar(.145);
    const label=await createLabelTexture(project),labelMesh=new THREE.Mesh(new THREE.PlaneGeometry(project.kind==='binder'?.293:1.4,project.kind==='binder'?1.41:.26,project.kind==='binder'?6:1,project.kind==='binder'?28:1),new THREE.MeshBasicMaterial({map:label,transparent:true,side:THREE.DoubleSide,depthWrite:false}));labelMesh.name='MaterialLabel';
    let setLoad;
    if(project.kind==='binder'){labelMesh.position.set(0,.12,.825);group.add(labelMesh);setLoad=prepareBinderLoad(group,variant++);}
    else if(project.kind==='box'){labelMesh.position.set(0,-.01,.732);group.add(labelMesh);group.position.set(.065,0,-.44);}
    else {labelMesh.position.set(.925,.051,-.81);labelMesh.rotation.x=-Math.PI/2;lid.add(labelMesh);group.position.set(.48+(project.id==='pauta'?.025:0),0,project.id==='pauta'?-.015:-.39);group.rotation.y=project.id==='pauta'?-.04:.025;}
    const hitQuad=project.kind==='binder'?[[-.20,-.91,.87],[.20,-.91,.87],[.20,.93,.87],[-.20,.93,.87]]:project.kind==='box'?[[-.95,-.31,.74],[.95,-.31,.74],[.95,.34,.74],[-.95,.34,.74]]:[[-.93,.05,-1.17],[.93,.05,-1.17],[.93,.05,1.17],[-.93,.05,1.17]];
    const model={project,group,lid,setLoad,hitQuad,axis:project.kind==='binder'?'y':project.kind==='box'?'x':'z',angle:project.kind==='binder'?-Math.PI-.28:project.kind==='box'?-Math.PI*.57:Math.PI};models.set(project.id,model);
  }
  const binders=projects.filter(p=>p.kind==='binder').map(p=>models.get(p.id));
  for(const m of binders)m.group.position.z=-.425+(binders.indexOf(m)%2)*.012;
  arrangeBinderRow(binders.map(m=>m.group),{left:-.722,surface:.75,gap:.001});
  for(const m of models.values()){
    if(m.project.kind!=='binder'){m.group.updateWorldMatrix(true,true);m.group.position.y+=.751-new THREE.Box3().setFromObject(m.group).min.y;}
    m.home=m.group.position.clone();m.rotation=m.group.quaternion.clone();m.group.updateWorldMatrix(true,true);
    m.bounds=new THREE.Box3();const inverse=m.group.matrixWorld.clone().invert();m.group.traverse(n=>{if(n.isMesh){n.geometry.computeBoundingBox();m.bounds.union(n.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,n.matrixWorld)));}});m.outlineBounds=m.bounds.clone();
  }
  for(const [name,x,z,scale]of [['Pothos',-.67,-.12,.12],['LoosePencil',-.32,.19,.145],['LooseWorksheet_1',-.48,-.025,.12],['DeskStapler',.70,.13,.13]]){
    const node=asset.scene.getObjectByName(name);if(!node)continue;const holder=new THREE.Group();content.add(holder);holder.add(node);node.position.set(0,0,0);holder.position.set(x,0,z);holder.rotation.y=name==='LoosePencil'?-.4:name==='LooseWorksheet_1'?.06:0;holder.scale.setScalar(scale);holder.updateWorldMatrix(true,true);
    const b=new THREE.Box3().setFromObject(holder);holder.position.y+=.751-b.min.y;
  }
  // Dispose the unused large room after extracting the authored materials.
  const usedGeometry=new Set(),usedMaterials=new Set(),usedTextures=new Set();content.traverse(n=>{if(n.isMesh){usedGeometry.add(n.geometry);for(const mat of [].concat(n.material)){usedMaterials.add(mat);for(const value of Object.values(mat))if(value?.isTexture)usedTextures.add(value);}}});
  asset.scene.traverse(n=>{if(n.isMesh){if(!usedGeometry.has(n.geometry))n.geometry.dispose();for(const mat of [].concat(n.material))if(!usedMaterials.has(mat)){for(const value of Object.values(mat))if(value?.isTexture&&!usedTextures.has(value))value.dispose();mat.dispose();}}});asset.scene.clear();
  onStage(null,'Preparant la fusta, el vidre i la llum…');
  const materials=await prepareMaterials(scene,scene,renderer,resources);room.finish();batchPlant(content.getObjectByName('Pothos'));
  scene.traverse(n=>{if(n.isMesh&&(n.material.isMeshBasicMaterial||n.material.transparent)){n.castShadow=false;n.receiveShadow=false;}});
  room.outside.material.map=await resources.load(new URL('../assets/desk/garden.webp',import.meta.url).href,url=>new THREE.TextureLoader().loadAsync(url));room.outside.material.map.colorSpace=THREE.SRGBColorSpace;room.outside.material.color.set('#ffffff');room.outside.material.needsUpdate=true;
  const dust=createDust(scene);let lampOn=true,windowOpen=false;
  const shelf=createBinderShelf(binders,{left:-.722,surface:.75,gap:.0007,animate,redraw:requestRender});
  function setTime(){const state=solarLight(new Date());sky.intensity=.28+state.day*.38;scene.environmentIntensity=.24+state.day*.35;sun.intensity=state.sunIntensity;sun.color.set(state.golden>.3?'#fff0d2':'#fff7e8');sun.position.set(...state.direction).multiplyScalar(4).add(new THREE.Vector3(0,.9,0));sun.target.position.set(0,.78,-.15);room.outside.material.color.setScalar(.18+.82*state.day);dust.material.uniforms.light.value=.10+state.day*.16;canvas.dataset.lighting=state.phase;renderer.shadowMap.needsUpdate=true;requestRender();}
  setTime();const minuteTimer=setInterval(()=>{if(!document.hidden)setTime();},60000);window.addEventListener('pagehide',()=>clearInterval(minuteTimer),{once:true});
  function animate(key,update,duration=220){if(motions.has(key))motions.get(key).resolve();if(reduced.matches){update(1);requestRender();return Promise.resolve();}return new Promise(resolve=>{motions.set(key,{start:null,update,resolve,duration});requestRender();});}
  function requestRender(){if(readyToRender&&!frame&&!document.hidden)frame=requestAnimationFrame(render);}
  function render(time){
    monitor.begin();frame=0;for(const [key,m]of motions){m.start??=time;const u=THREE.MathUtils.clamp((time-m.start)/m.duration,0,1);m.update(u*u*(3-2*u));if(u===1){motions.delete(key);m.resolve();}}
    camera.position.set(...SEAT);camera.updateMatrixWorld();scene.updateMatrixWorld();
    const living=!reduced.matches&&!document.hidden&&!active;
    if(living&&(lastAmbient===undefined||time-lastAmbient>1000/24)){
      clock+=lastTime===undefined?0:Math.min(.1,(time-lastTime)/1000);lastAmbient=lastTime=time;dust.material.uniforms.time.value=clock;
      const plant=content.getObjectByName('Pothos');if(plant)plant.traverse(n=>{if(/^IndoorLeaf_\d+$/.test(n.name)){n.userData.rest??=n.rotation.z;const phase=parseInt(n.name.split('_')[1],10);n.rotation.z=n.userData.rest+Math.sin(clock*.35+phase*.79)*.009;}});
      if(time-lastShadow>250){renderer.shadowMap.needsUpdate=true;lastShadow=time;}
    }
    if(!living)lastTime=undefined;dust.visible=!active;
    if(inspected?.type==='sheet')placeInspection();
    projectControls();if(motions.size)renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);monitor.end();
    clearTimeout(ambientTimer);if(living)ambientTimer=setTimeout(requestRender,1000/24);if(motions.size)requestRender();
  }
  const projected=new THREE.Vector3();
  function projectPoint(p){return projected.copy(p).project(camera).toArray();}
  function projectControls(){
    const rect=canvas.getBoundingClientRect();
    for(const m of models.values()){
      const button=m.project.button;button.hidden=Boolean(active);if(active)continue;
      const points=[];const b=m.bounds;
      if(m.group.localToWorld(b.getCenter(new THREE.Vector3())).applyMatrix4(camera.matrixWorldInverse).z>=-.05){button.hidden=true;continue;}
      for(const xyz of m.hitQuad){
        const world=m.group.localToWorld(new THREE.Vector3(...xyz));if(world.clone().applyMatrix4(camera.matrixWorldInverse).z>=-.03)continue;const p=projectPoint(world);points.push(p);
      }
      if(!points.length){button.hidden=true;continue;}
      const xs=points.map(p=>(p[0]+1)*rect.width/2),ys=points.map(p=>(1-p[1])*rect.height/2),left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);
      button.hidden=right<0||left>rect.width||bottom<0||top>rect.height||points.every(p=>p[2]>1);if(button.hidden)continue;
      Object.assign(button.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px',clipPath:'polygon('+points.map((p,i)=>((xs[i]-left)/(right-left)*100)+'% '+((ys[i]-top)/(bottom-top)*100)+'%').join(',')+')'});
      button.style.boxShadow=hovered===m.project.id?'inset 0 0 0 1px #e8d7a288,0 0 10px #eed69b33':'';
    }
  }
  function resize(){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();requestRender();}
  new ResizeObserver(resize).observe(surface);resize();look.home();
  const loader=new THREE.TextureLoader(),terrainLoader=new GLTFLoader();
  async function loadSamples(m){
    if(m.project.kind==='box')return loadTerrain(m,0);
    if(m.samples)return;
    m.samples=await Promise.all(m.project.examples.flatMap((e,i)=>e.pages.map(async page=>{const texture=await loader.loadAsync(new URL('../assets/desk/samples/'+page.image,import.meta.url).href);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return {...page,example:i,texture};})));
  }
  async function loadTerrain(m,index){
    m.terrains??=new Map();if(!m.terrains.has(index)){
      const info=m.project.reliefs[index],asset=await terrainLoader.loadAsync(new URL('../assets/desk/reliefs/'+info.url,import.meta.url).href),node=asset.scene;
      const b=new THREE.Box3().setFromObject(node),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());
      const holder=new THREE.Group();holder.name='TerrainSample';holder.add(node);const s=1.28/Math.max(size.x,size.z);node.scale.multiplyScalar(s);node.position.set(-center.x*s,-b.min.y*s,-center.z*s);holder.position.set(0,-.22,0);m.group.add(holder);holder.visible=false;m.terrains.set(index,holder);
    }
  }
  function makePages(m){
    const definitions=m.project.kind==='binder'?
      [[m.lid,[-.029,0,-.754],[0,-Math.PI/2,0]],[m.group,[.174,0,0],[0,Math.PI/2,0]]]:
      [[m.lid,[.925,-.044,0],[Math.PI/2,0,Math.PI]],[m.group,[0,.008,0],[-Math.PI/2,0,0]]];
    m.pages=definitions.map(([parent,position,rotation])=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:'#fbfdff',side:THREE.DoubleSide,toneMapped:false,transparent:true,depthWrite:false}));mesh.name='PrintedSheet';mesh.position.set(...position);mesh.rotation.set(...rotation);parent.add(mesh);return mesh;});
  }
  function paint(m,index){
    m.index=index;
    if(m.project.kind==='box'){for(const [i,node]of m.terrains)node.visible=i===index;return;}
    const samples=m.samples.filter(p=>p.example===index);
    m.pages.forEach((mesh,i)=>{const sample=samples[i];mesh.visible=Boolean(sample);if(!sample)return;const aspect=sample.texture.image.width/sample.texture.image.height,w=Math.min(m.project.kind==='binder'?1.31:1.55,(m.project.kind==='binder'?1.82:2.04)*aspect);mesh.scale.set(w,w/aspect,1);mesh.material.map=sample.texture;mesh.material.needsUpdate=true;mesh.userData.sample=sample;});
  }
  function readingPose(m){
    const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.40),q=tilt.multiply(m.project.kind==='binder'?flatBinder:new THREE.Quaternion());
    m.group.quaternion.copy(q);m.lid.rotation[m.axis]=m.angle;m.group.position.set(0,0,0);m.group.updateWorldMatrix(true,true);
    const box=new THREE.Box3().setFromObject(m.group),center=box.getCenter(new THREE.Vector3());
    const p=new THREE.Vector3(-center.x,.772-box.min.y,.015-center.z);
    return {position:p,rotation:q};
  }
  function headTo(target){const proxy=camera.clone();proxy.position.set(...SEAT);proxy.lookAt(target);return proxy.quaternion;}
  async function select(id){
    if(active||phase!=='shelf')return;phase='loading';surface.dataset.busy='true';look.enabled=false;const m=models.get(id);
    const viewMotion=motions.get('look');if(viewMotion){viewMotion.update(1);motions.delete('look');viewMotion.resolve();look.sync();}
    try{await loadSamples(m);}catch(error){phase='shelf';look.enabled=true;delete surface.dataset.busy;throw error;}
    active=m;savedLook=camera.quaternion.clone();if(shelf.has(m))await shelf.take(m);
    if(m.project.kind!=='box'){makePages(m);paint(m,1);}else {m.index=0;for(const node of m.terrains.values())node.visible=false;}
    const target=readingPose(m),focus=new THREE.Vector3(0,.86,.035),readLook=headTo(focus),from=m.home.clone(),q=m.rotation.clone();m.group.position.copy(from);m.group.quaternion.copy(q);m.lid.rotation[m.axis]=0;
    surface.dataset.open='true';phase='opening';
    m.journey=t=>{
      const exit=THREE.MathUtils.smoothstep(t,0,.55),settle=THREE.MathUtils.smoothstep(t,.38,.95),open=THREE.MathUtils.smoothstep(t,.52,1),pull=THREE.MathUtils.smoothstep(t,0,.43),travel=THREE.MathUtils.smoothstep(t,.4,1);
      const forward=Math.max(from.z+.43,target.position.z);
      m.group.position.set(THREE.MathUtils.lerp(from.x,target.position.x,travel),THREE.MathUtils.lerp(from.y,target.position.y,t)+Math.sin(Math.PI*t)*.11,THREE.MathUtils.lerp(from.z,forward,pull)+(target.position.z-forward)*travel);
      m.group.quaternion.slerpQuaternions(q,target.rotation,settle);m.lid.rotation[m.axis]=m.angle*open;m.setLoad?.(1-open);
      if(m.terrains)for(const [i,node]of m.terrains)node.visible=t>.58&&i===m.index;
      camera.quaternion.slerpQuaternions(savedLook,readLook,exit);
    };
    await animate('material',t=>{m.journey(t);m.group.updateWorldMatrix(true,true);shelf.leaving(m,t);},2500);phase='reading';delete surface.dataset.busy;requestRender();onAction('obre_material',{projecte:id});
  }
  async function close(){
    if(!active||!['reading','inspecting'].includes(phase))return;if(inspected)await leaveInspection();const m=active;phase='closing';surface.dataset.busy='true';
    await shelf.prepareReturn(m);await animate('material',t=>m.journey(1-t),2500);if(shelf.has(m))await shelf.restore();
    for(const page of m.pages||[]){page.removeFromParent();page.geometry.dispose();page.material.dispose();}m.pages=null;if(m.terrains)for(const node of m.terrains.values())node.visible=false;
    for(const sample of m.samples||[])sample.texture.dispose();m.samples=null;
    active=null;phase='shelf';look.enabled=true;look.sync();delete surface.dataset.open;delete surface.dataset.busy;requestRender();
  }
  async function changeSample(delta){
    if(!active||phase!=='reading')return;const m=active,count=m.project.kind==='box'?m.project.reliefs.length:3,index=(m.index+delta+count)%count;
    phase='changing';try{
      if(m.project.kind==='box'){await loadTerrain(m,index);paint(m,index);}
      else {await animate('print',t=>m.pages.forEach(p=>p.material.opacity=1-t),110);paint(m,index);await animate('print',t=>m.pages.forEach(p=>p.material.opacity=t),110);onObjectSound('page','paper');}
    }finally{phase='reading';requestRender();}
  }
  function placeInspection(){
    const {mesh,scroll}=inspected;if(inspected.type!=='sheet')return;
    const distance=.38,tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),width=Math.min(.30,2*distance*tangent*camera.aspect*.91),aspect=mesh.material.map.image.width/mesh.material.map.image.height;
    mesh.scale.set(width,width/aspect,1);mesh.quaternion.copy(camera.quaternion);
    const direction=camera.getWorldDirection(new THREE.Vector3()),vertical=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    mesh.position.copy(camera.position).addScaledVector(direction,distance).addScaledVector(vertical,scroll+.015);
    const {start,progress}=inspected;if(start&&progress<1){mesh.position.lerpVectors(start.position,mesh.position,progress);mesh.quaternion.slerpQuaternions(start.rotation,mesh.quaternion,progress);mesh.scale.lerpVectors(start.scale,mesh.scale,progress);}
  }
  async function inspect(index=0){
    if(!active||phase!=='reading')return;const m=active;phase='inspecting';surface.dataset.inspecting='true';
    if(m.project.kind==='box'){
      const mesh=m.terrains.get(m.index),from=mesh.getWorldPosition(new THREE.Vector3()),originalScale=mesh.scale.clone(),parent=mesh.parent,local=mesh.position.clone();scene.attach(mesh);mesh.scale.multiplyScalar(1.2);const to=new THREE.Vector3(0,.93,.20);
      inspected={type:'terrain',mesh,parent,local,originalScale,from};await animate('inspect',t=>{mesh.position.lerpVectors(from,to,t);mesh.position.y+=Math.sin(Math.PI*t)*.16;},820);
    }else {
      const source=m.pages[index];if(!source?.visible){phase='reading';delete surface.dataset.inspecting;return;}
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),source.material.clone());mesh.name='InspectedSheet';scene.add(mesh);source.visible=false;
      const start={position:source.getWorldPosition(new THREE.Vector3()),rotation:source.getWorldQuaternion(new THREE.Quaternion()),scale:source.getWorldScale(new THREE.Vector3())};
      inspected={type:'sheet',mesh,source,start,scroll:0,progress:0};onObjectSound('lift','paper');await animate('inspect',t=>{inspected.progress=t;},820);placeInspection();
    }
    requestRender();
  }
  async function leaveInspection(){
    if(!inspected)return;const held=inspected;
    if(held.type==='sheet'){await animate('inspect',t=>{held.progress=1-t;},820);held.mesh.removeFromParent();held.mesh.geometry.dispose();held.mesh.material.dispose();held.source.visible=true;}
    else {const from=held.mesh.position.clone(),to=held.from;await animate('inspect',t=>{held.mesh.position.lerpVectors(from,to,t);held.mesh.position.y+=Math.sin(Math.PI*t)*.16;},820);held.parent.attach(held.mesh);held.mesh.position.copy(held.local);held.mesh.scale.copy(held.originalScale);held.mesh.rotation.set(0,0,0);}
    inspected=null;phase='reading';delete surface.dataset.inspecting;requestRender();
  }
  let heldPointer;
  canvas.addEventListener('pointerdown',e=>{if(inspected&&e.button<=0){heldPointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointermove',e=>{if(heldPointer?.id!==e.pointerId||!inspected)return;
    if(inspected.type==='terrain'){inspected.mesh.rotation.y+=(e.clientX-heldPointer.x)*.008;inspected.mesh.rotation.x=THREE.MathUtils.clamp(inspected.mesh.rotation.x+(e.clientY-heldPointer.y)*.006,-.8,.8);}
    else inspected.scroll=THREE.MathUtils.clamp(inspected.scroll-(e.clientY-heldPointer.y)*.0005,-.16,.16);
    heldPointer.x=e.clientX;heldPointer.y=e.clientY;requestRender();
  });
  canvas.addEventListener('pointerup',()=>heldPointer=null);canvas.addEventListener('pointercancel',()=>heldPointer=null);
  canvas.addEventListener('keydown',e=>{if(inspected?.type==='sheet'&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();inspected.scroll=THREE.MathUtils.clamp(inspected.scroll+(e.key==='ArrowDown'?.025:-.025),-.16,.16);requestRender();}});
  canvas.addEventListener('wheel',e=>{if(!inspected)return;e.preventDefault();if(inspected.type==='sheet')inspected.scroll=THREE.MathUtils.clamp(inspected.scroll+e.deltaY*.00025,-.16,.16);else inspected.mesh.rotation.y+=e.deltaY*.002;requestRender();},{passive:false});
  function highlight(id){if(active)return;hovered=id;requestRender();}
  async function moveView(direction){
    if(active||phase!=='shelf'||motions.has('look'))return;const from=camera.quaternion.clone();if(direction==='home')look.home();else look.turn(direction==='left'?.28:-.28,0);
    const to=camera.quaternion.clone();camera.quaternion.copy(from);look.enabled=false;await animate('look',t=>camera.quaternion.slerpQuaternions(from,to,t),420);look.sync();if(phase==='shelf')look.enabled=true;onAction('mira',{gest:'boto',direccio:direction});
  }
  function setLamp(on){lampOn=on;room.setLamp(on);renderer.shadowMap.needsUpdate=true;requestRender();}
  function setWindow(on){windowOpen=on;const from=room.sash.rotation.y/-.16;animate('window',t=>room.setWindow(THREE.MathUtils.lerp(from,on?1:0,t)));}
  document.addEventListener('visibilitychange',()=>{clearTimeout(ambientTimer);lastTime=undefined;if(!document.hidden)requestRender();});
  reduced.addEventListener('change',()=>{for(const m of motions.values()){m.update(1);m.resolve();}motions.clear();requestRender();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();clearTimeout(ambientTimer);document.querySelector('.desk-list').classList.add('is-open');document.querySelector('#desk-status').textContent='Pots continuar des de la llista de projectes.';});
  onStage(94,'Preparant la mirada des de la cadira…');readyToRender=true;renderer.shadowMap.needsUpdate=true;await renderer.compileAsync(scene,camera);await new Promise(resolve=>{requestRender();requestAnimationFrame(()=>requestAnimationFrame(resolve));});
  return {select,close,highlight,moveView,changeSample,inspect,leaveInspection,setLamp,setWindow,
    info:()=>({phase,selected:active?.project.id,index:active?.index||0,count:active?.project.kind==='box'?active.project.reliefs.length:3,secondary:Boolean(active?.pages?.[1]?.visible),paired:active?.pages?.[1]?.userData.sample?.role==='answers',inspection:inspected?.type||null}),
    diagnostics:()=>({look:look.info(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,materials:materials.size,lampOn,windowOpen}),
  };
}
// Keep two gently moving leaves; batch the static foliage, veins and soil.
function batchPlant(plant){
  if(!plant)return;plant.updateWorldMatrix(true,true);const inverse=plant.matrixWorld.clone().invert(),batches=new Map();
  plant.traverse(n=>{if(!n.isMesh||['IndoorLeaf_2','IndoorLeaf_8'].includes(n.name))return;const key=n.material.uuid+'|'+Object.keys(n.geometry.attributes).sort().join(','),list=batches.get(key)||[];list.push(n);batches.set(key,list);});
  for(const nodes of batches.values())if(nodes.length>1){const material=nodes[0].material;
    const geometries=nodes.map(n=>(n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,n.matrixWorld)));
    const geometry=mergeGeometries(geometries,false);if(geometry){const mesh=new THREE.Mesh(geometry,material);mesh.name='StaticPlant';mesh.castShadow=mesh.receiveShadow=true;plant.add(mesh);for(const n of nodes){n.removeFromParent();n.geometry.dispose();}}for(const g of geometries)g.dispose();
  }
}
function createDust(scene){
  const n=380,data=new Float32Array(n*3);let seed=7429;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/4294967296;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data,3));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{time:{value:0},light:{value:.2}},
    vertexShader:'uniform float time;varying float size;void main(){vec3 s=fract(position+vec3(.001,.0018,.0007)*time);vec3 p=vec3((s.x-.5)*1.7,.76+s.y*.95,-.5+s.z*1.45);p.x+=sin(time*.17+position.z*18.)*.006;p.z+=cos(time*.13+position.y*17.)*.008;size=position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=1.1+position.z*1.5;}',
    fragmentShader:'uniform float light;varying float size;void main(){float r=length(gl_PointCoord-.5)*2.;float a=exp(-r*r*3.)*(1.-smoothstep(.6,1.,r))*light*(.4+size*.6);gl_FragColor=vec4(1.,.95,.82,a);}',
  });const points=new THREE.Points(g,material);points.name='SeatedDust';points.frustumCulled=false;points.raycast=()=>{};scene.add(points);return points;
}
