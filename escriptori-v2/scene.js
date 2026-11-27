import * as THREE from 'three';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from '../assets/vendor/three/addons/utils/BufferGeometryUtils.js';
import { prepareMaterials } from '../escriptori/materials.js?v=1.22.0';
import { prepareBinderLoad } from '../escriptori/binder-load.js?v=1.25.0';
import { createLabelTexture } from '../escriptori/labels.js?v=1.11.0';
import { createBinderShelf } from '../escriptori/binder-shelf.js?v=1.28.0';
import { createPerformanceMonitor } from '../escriptori/performance.js?v=1.22.1';
import { solarLight } from '../escriptori/solar.js?v=1.6.0';
import { createSeatedLook, SEAT } from './seated-look.js?v=0.3.1';
import { createRoom } from './room.js?v=0.3.0';
import { createDeskLife, movingLeaves } from './life.js?v=0.3.1';
import { addPatina } from './patina.js?v=0.3.1';
import { createGarden } from './garden.js?v=0.3.1';
import { addMonAMaModel } from '../escriptori/project-models.js?v=1.27.0';
import { prepareStapler } from '../escriptori/stapler-mechanism.js?v=1.19.0';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const flatBinder=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),new THREE.Vector3(-1,0,0)));
export async function createDesk({canvas,projects,resources,onStage,onObjectSound=()=>{},onAction=()=>{},onWindowChange=()=>{},onLampChange=()=>{}}){
  const surface=canvas.parentElement,renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1,.025,12);camera.position.set(...SEAT);
  const monitor=createPerformanceMonitor(renderer),models=new Map(),motions=new Map(),lastView=new THREE.Matrix4(),lastProjection=new THREE.Matrix4();let controlsDirty=true,contactsDirty=true;
  let frame=0,ambientTimer,active=null,phase='shelf',hovered=null,inspected=null,savedLook,savedPosition,savedFov,clock=0,lastTime,lastShadow=-Infinity,readyToRender=false;
  const look=createSeatedLook(camera,surface,{redraw:()=>requestRender(),onGesture:gest=>{surface.dataset.looked='true';onAction('mira',{gest});}});
  const room=createRoom(scene),content=new THREE.Group();content.name='ProjectMaterials';scene.add(content);
  const sky=new THREE.HemisphereLight('#e0e9e6','#9e8b6d',.7);scene.add(sky);
  const sun=new THREE.DirectionalLight('#fff4db',2.5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-1.6,right:1.6,top:1.7,bottom:-1.3,near:.1,far:8});sun.shadow.normalBias=.008;sun.shadow.bias=-.0003;sun.shadow.radius=3;scene.add(sun,sun.target);
  onStage(null,'Preparant els materials de la taula…');
  const bytes=await resources.buffer(new URL('../assets/desk/escriptori.glb?v=1.15.0',import.meta.url).href),asset=await new GLTFLoader().parseAsync(bytes,new URL('../assets/desk/',import.meta.url).href);
  addMonAMaModel(asset.scene);
  let variant=0;
  for(const project of projects){
    const group=asset.scene.getObjectByName('Item_'+project.id),lid=group.getObjectByName('Lid_'+project.id);content.add(group);group.position.set(0,0,0);group.rotation.set(0,0,0);group.scale.setScalar(project.kind==='binder'?.19:.175);
    const colours={plec:'#835b4a',trama:'#9c843e',resso:'#4b6350',sentit:'#527475','fil-i-compte':'#aa823c','mon-a-ma':'#63735d'};
    group.traverse(n=>{if(n.isMesh&&n.material.name==='Cloth_'+project.id)n.material.color.set(colours[project.id]);});
    if(project.id==='pauta')group.traverse(n=>{if(n.isMesh)n.visible=false;});
    const label=await createLabelTexture(project),labelMesh=new THREE.Mesh(new THREE.PlaneGeometry(project.kind==='binder'?.293:1.4,project.kind==='binder'?1.41:.26,project.kind==='binder'?6:1,project.kind==='binder'?28:1),new THREE.MeshBasicMaterial({map:label,transparent:true,side:THREE.DoubleSide,depthWrite:false}));labelMesh.name='MaterialLabel';
    let setLoad;
    if(project.kind==='binder'){labelMesh.position.set(0,-.02,.825);group.add(labelMesh);setLoad=prepareBinderLoad(group,variant++);}
    else if(project.kind==='box'){labelMesh.position.set(0,-.01,.732);group.add(labelMesh);group.position.set(.49,0,-.06);}
    else {labelMesh.position.set(.925,.051,-.81);labelMesh.rotation.x=-Math.PI/2;lid.add(labelMesh);group.position.set(project.id==='pauta'?.65:1.0,0,project.id==='pauta'?-.43:-.42);group.rotation.y=project.id==='pauta'?-.07:.13;if(project.id==='pauta')labelMesh.visible=false;}
    if(project.kind==='binder')group.position.z=-.47+(variant%3)*.009;
    const hitQuad=project.kind==='binder'?[[-.20,-.91,.87],[.20,-.91,.87],[.20,.93,.87],[-.20,.93,.87]]:project.kind==='box'?[[-.95,-.31,.74],[.95,-.31,.74],[.95,.34,.74],[-.95,.34,.74]]:[[-.93,.05,-1.17],[.93,.05,-1.17],[.93,.05,1.17],[-.93,.05,1.17]];
    const model={project,group,lid,setLoad,hitQuad,homeLid:project.kind==='box'?-1.70:0,axis:project.kind==='binder'?'y':project.kind==='box'?'x':'z',angle:project.kind==='binder'?-Math.PI-.28:project.kind==='box'?-Math.PI*.57:Math.PI};lid.rotation[model.axis]=model.homeLid;models.set(project.id,model);
  }
  onStage(null,'Deixant els materials a mà…');
  const idleLoader=new THREE.TextureLoader(),box=models.get('relleu-obert'),pauta=models.get('pauta');
  const previewAsset=await new GLTFLoader().parseAsync(await resources.buffer(new URL('../assets/desk/reliefs/agulles-montserrat-preview.glb',import.meta.url).href),new URL('../assets/desk/reliefs/',import.meta.url).href);
  const preview=previewAsset.scene,pb=new THREE.Box3().setFromObject(preview),ps=pb.getSize(new THREE.Vector3()),pc=pb.getCenter(new THREE.Vector3()),normalise=1.28/Math.max(ps.x,ps.z);
  preview.scale.multiplyScalar(normalise);preview.position.set(-pc.x*normalise,-.22-pb.min.y*normalise,-pc.z*normalise);box.group.add(preview);box.idle=preview;
  const paperTexture=await resources.load(new URL('../assets/desk/samples/pauta-1.webp',import.meta.url).href,url=>idleLoader.loadAsync(url));paperTexture.colorSpace=THREE.SRGBColorSpace;
  pauta.idle=new THREE.Group();pauta.idle.name='LoosePautaSamples';pauta.group.add(pauta.idle);
  for(let i=0;i<4;i++){const sheet=new THREE.Mesh(new THREE.PlaneGeometry(1.78,2.30),new THREE.MeshStandardMaterial({map:paperTexture,color:'#f3efdf',roughness:1,side:THREE.DoubleSide}));sheet.rotation.set(-Math.PI/2,0,(i-1.5)*.035);sheet.position.set(Math.sin(i*2.4)*.06,.015+i*.009,Math.cos(i)*.04);pauta.idle.add(sheet);}
  for(const m of models.values()){
    if(m.project.kind!=='binder'){m.group.updateWorldMatrix(true,true);m.group.position.y+=.751-new THREE.Box3().setFromObject(m.group).min.y;}
    m.home=m.group.position.clone();m.rotation=m.group.quaternion.clone();m.group.updateWorldMatrix(true,true);
    m.bounds=new THREE.Box3();const inverse=m.group.matrixWorld.clone().invert();m.group.traverse(n=>{if(n.isMesh){n.geometry.computeBoundingBox();m.bounds.union(n.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,n.matrixWorld)));}});m.outlineBounds=m.bounds.clone();
  }
  for(const [name,x,z,scale]of [['Pothos',-.733,-.035,.12],['PencilCup',-.58,.22,.17],['LoosePencil',.39,.20,.15],['LooseWorksheet_1',.87,-.37,.12],['DeskStapler',.46,.19,.16]]){
    const node=asset.scene.getObjectByName(name);if(!node)continue;const holder=new THREE.Group();content.add(holder);holder.add(node);node.position.set(0,0,0);holder.position.set(x,0,z);holder.rotation.y=name==='LoosePencil'?-.4:name==='LooseWorksheet_1'?.06:0;holder.scale.setScalar(scale);holder.updateWorldMatrix(true,true);
    if(name==='PencilCup'){
      // The imported cup has baked material primitives. Rebuild whole pencils,
      // rather than rotating separate wood/paint primitives apart.
      node.clear();
      const profile=[[0,0],[.20,0],[.24,.025],[.25,.515],[.245,.54],[.21,.54],[.205,.045],[0,.045]].map(p=>new THREE.Vector2(...p));
      node.add(new THREE.Mesh(new THREE.LatheGeometry(profile,24),new THREE.MeshPhysicalMaterial({name:'CornerCup',color:'#bdb8a7',roughness:.53,clearcoat:.12,clearcoatRoughness:.35})));
      const tipMaterial=new THREE.MeshStandardMaterial({color:'#c8ab7e',roughness:.85}),graphite=new THREE.MeshStandardMaterial({color:'#373b35',roughness:.48});
      ['#526844','#a87452','#ad945c','#777b71','#535f67'].forEach((colour,i)=>{
        const pencil=new THREE.Group();pencil.position.set((i%3-1)*.09,.15,(i%2-.5)*.105);pencil.rotation.set(Math.sin(i*1.7)*.14,0,(i-2)*.075);pencil.scale.y=.94+i*.026;
        const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.88,6),new THREE.MeshStandardMaterial({color:colour,roughness:.66}));shaft.position.y=.44;pencil.add(shaft);
        const tip=new THREE.Mesh(new THREE.CylinderGeometry(.006,.022,.10,6),tipMaterial);tip.position.y=.93;pencil.add(tip);
        const lead=new THREE.Mesh(new THREE.ConeGeometry(.006,.025,6),graphite);lead.position.y=.9925;pencil.add(lead);node.add(pencil);
      });
    }
    holder.updateWorldMatrix(true,true);
    const b=new THREE.Box3().setFromObject(holder);holder.position.y+=(name==='Pothos'?.836:.751)-b.min.y;if(name==='DeskStapler')holder.rotation.y=-.18;
  }
  // Dispose the unused large room after extracting the authored materials.
  const usedGeometry=new Set(),usedMaterials=new Set(),usedTextures=new Set();content.traverse(n=>{if(n.isMesh){usedGeometry.add(n.geometry);for(const mat of [].concat(n.material)){usedMaterials.add(mat);for(const value of Object.values(mat))if(value?.isTexture)usedTextures.add(value);}}});
  asset.scene.traverse(n=>{if(n.isMesh){if(!usedGeometry.has(n.geometry))n.geometry.dispose();for(const mat of [].concat(n.material))if(!usedMaterials.has(mat)){for(const value of Object.values(mat))if(value?.isTexture&&!usedTextures.has(value))value.dispose();mat.dispose();}}});asset.scene.clear();
  onStage(null,'Preparant la fusta, el vidre i la llum…');
  const materials=await prepareMaterials(scene,scene,renderer,resources);addPatina(scene);room.finish();batchPlant(content.getObjectByName('Pothos'));const staplerPress=prepareStapler(content.getObjectByName('DeskStapler'));
  scene.traverse(n=>{if(n.isMesh&&(n.material.isMeshBasicMaterial||n.material.transparent)){n.castShadow=false;n.receiveShadow=false;}});
  room.outside.material.map=await resources.load(new URL('../assets/desk/garden.webp',import.meta.url).href,url=>new THREE.TextureLoader().loadAsync(url));room.outside.material.map.colorSpace=THREE.SRGBColorSpace;room.outside.material.color.set('#ffffff');room.outside.material.needsUpdate=true;
  const garden=createGarden(scene,room.outside,reduced),dust=createDust(scene);let lampOn=true,windowOpen=false;
  const life=createDeskLife({scene,camera,canvas,plant:content.getObjectByName('Pothos'),landingSurfaces:[room.root,content],reduced,redraw:requestRender,onBrush:()=>onObjectSound('brush','leaf')});
  const rows=[createBinderShelf(['plec','trama','resso'].map(id=>models.get(id)),{left:-.831,surface:.75,gap:.001,animate,redraw:requestRender}),createBinderShelf(['sentit','fil-i-compte','mon-a-ma'].map(id=>models.get(id)),{left:-.10,right:.300,leanSign:-1,surface:.756,gap:.001,animate,redraw:requestRender})];
  const owner=m=>rows.find(row=>row.has(m)),shelf={has:m=>Boolean(owner(m)),take:m=>owner(m)?.take(m),leaving:(m,t)=>owner(m)?.leaving(m,t),prepareReturn:m=>owner(m)?.prepareReturn(m),restore:async()=>{for(const row of rows)if(row.info().departing)await row.restore();},info:()=>rows.map(row=>row.info())};
  const contacts=createContacts(scene,models);
  function setTime(){const state=solarLight(new Date());sky.intensity=.28+state.day*.38;scene.environmentIntensity=.24+state.day*.35;sun.intensity=state.sunIntensity;sun.color.set(state.golden>.3?'#fff0d2':'#fff7e8');sun.position.set(...state.direction).multiplyScalar(4).add(new THREE.Vector3(0,.9,0));sun.target.position.set(0,.78,-.15);garden.setDay(state.day);dust.material.uniforms.light.value=.20+state.day*.46;canvas.dataset.lighting=state.phase;renderer.shadowMap.needsUpdate=true;requestRender();}
  setTime();const minuteTimer=setInterval(()=>{if(!document.hidden)setTime();},60000);window.addEventListener('pagehide',()=>clearInterval(minuteTimer),{once:true});
  function animate(key,update,duration=220){if(motions.has(key))motions.get(key).resolve();if(reduced.matches){update(1);requestRender();return Promise.resolve();}return new Promise(resolve=>{motions.set(key,{start:null,update,resolve,duration});requestRender();});}
  function requestRender(){if(readyToRender&&!frame&&!document.hidden)frame=requestAnimationFrame(render);}
  function render(time){
    monitor.begin();frame=0;const hadMotion=motions.size>0;for(const [key,m]of motions){m.start??=time;const u=THREE.MathUtils.clamp((time-m.start)/m.duration,0,1);m.update(u*u*(3-2*u));if(u===1){motions.delete(key);m.resolve();}}
    if(!active)camera.position.set(...SEAT);camera.updateMatrixWorld();scene.updateMatrixWorld();
    if(contactsDirty||hadMotion){contacts.update();contactsDirty=false;}
    const living=!reduced.matches&&!document.hidden&&!active;
    if(living){
      clock+=lastTime===undefined?0:Math.min(.1,(time-lastTime)/1000);lastTime=time;dust.material.uniforms.time.value=clock;
      life.tick(clock);
      if(time-lastShadow>250){renderer.shadowMap.needsUpdate=true;lastShadow=time;}
    }
    if(!living)lastTime=undefined;dust.visible=!active;garden.tick(clock,camera);
    if(inspected?.type==='sheet')placeInspection();
    if(controlsDirty||hadMotion||!lastView.equals(camera.matrixWorld)||!lastProjection.equals(camera.projectionMatrix)){projectControls();lastView.copy(camera.matrixWorld);lastProjection.copy(camera.projectionMatrix);controlsDirty=false;}
    if(hadMotion)renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);monitor.end();
    clearTimeout(ambientTimer);if(living&&!life.moving())ambientTimer=setTimeout(requestRender,1000/30);if(motions.size||(living&&life.moving()))requestRender();
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
  function resize(){
    const reading=['reading','inspecting','changing'].includes(phase),w=canvas.clientWidth,h=canvas.clientHeight;
    const ratio=reading?Math.min(devicePixelRatio,1.5):Math.min(devicePixelRatio,1.05,1440/w,900/h);
    renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);dust.material.uniforms.pixelRatio.value=ratio;
    canvas.style.imageRendering='auto';canvas.dataset.finish=reading?'print':'textured';
    camera.aspect=w/h;camera.updateProjectionMatrix();controlsDirty=true;requestRender();
  }
  new ResizeObserver(resize).observe(surface);resize();look.home();
  const loader=new THREE.TextureLoader(),terrainLoader=new GLTFLoader();
  const sampleCache=[];
  async function loadSamples(m,index=1){
    m.sampleLoads??=new Map();m.samples??=[];
    if(!m.sampleLoads.has(index)){
      let failed=false;const acquired=[];
      const pending=Promise.all(m.project.examples[index].pages.map(async page=>{
        const texture=await loader.loadAsync(new URL('../assets/desk/samples/'+page.image,import.meta.url).href);
        if(failed){texture.dispose();return null;}acquired.push(texture);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return {...page,example:index,texture};
      })).then(pages=>{m.samples.push(...pages);}).catch(error=>{failed=true;for(const t of acquired)t.dispose();m.sampleLoads.delete(index);throw error;});
      m.sampleLoads.set(index,pending);
    }
    await m.sampleLoads.get(index);
    const previous=sampleCache.indexOf(m);if(previous>=0)sampleCache.splice(previous,1);sampleCache.push(m);
    while(sampleCache.length>2){const old=sampleCache.splice(sampleCache.findIndex(item=>item!==active),1)[0];for(const page of old.samples)page.texture.dispose();old.samples=[];old.sampleLoads.clear();}
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
    m.pages=definitions.map(([parent,position,rotation])=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:'#fbfdff',side:THREE.DoubleSide,toneMapped:false,transparent:true,depthWrite:false}));mesh.name='PrintedSheet';mesh.scale.set(1.27,1.80,1);mesh.position.set(...position);mesh.rotation.set(...rotation);parent.add(mesh);return mesh;});
  }
  function paint(m,index){
    m.index=index;
    if(m.project.kind==='box'){for(const [i,node]of m.terrains)node.visible=i===index;return;}
    const samples=m.samples.filter(p=>p.example===index);
    m.pages.forEach((mesh,i)=>{const sample=samples[i];mesh.visible=Boolean(sample);if(!sample)return;const aspect=sample.texture.image.width/sample.texture.image.height,w=Math.min(m.project.kind==='binder'?1.31:1.55,(m.project.kind==='binder'?1.82:2.04)*aspect);mesh.scale.set(w,w/aspect,1);mesh.material.map=sample.texture;mesh.material.needsUpdate=true;mesh.userData.sample=sample;});
  }
  function readingPose(m){
    const q=m.project.kind==='binder'?flatBinder.clone():new THREE.Quaternion();
    m.group.quaternion.copy(q);m.lid.rotation[m.axis]=m.angle;m.group.position.set(0,0,0);m.group.updateWorldMatrix(true,true);
    const box=new THREE.Box3().setFromObject(m.group),center=box.getCenter(new THREE.Vector3());
    const p=new THREE.Vector3(-.03-center.x,.772-box.min.y,-.035-center.z);
    return {position:p,rotation:q};
  }
  function headTo(target,position=camera.position){const proxy=camera.clone();proxy.position.copy(position);proxy.up.set(0,0,-1);proxy.lookAt(target);return proxy.quaternion;}
  async function select(id){
    if(active||phase!=='shelf')return;surface.dataset.busy='true';look.enabled=false;const m=models.get(id);
    hovered=null;for(const [key,motion]of motions)if(key.startsWith('hover-')){motions.delete(key);motion.resolve();}for(const other of models.values())if(other!==m)other.group.position.copy(other.home);
    const viewMotion=motions.get('look');if(viewMotion){viewMotion.update(1);motions.delete('look');viewMotion.resolve();look.sync();}
    active=m;const visit=Symbol();m.visit=visit;life.pause(true);savedLook=camera.quaternion.clone();savedPosition=camera.position.clone();savedFov=camera.fov;
    m.index=m.project.kind==='box'?0:1;if(m.project.kind!=='box')makePages(m);
    if(m.terrains)for(const node of m.terrains.values())node.visible=false;
    // Fetch only the first spread while the object is already being picked up.
    // Attach rejection handlers immediately; a failed request returns it safely.
    let timeout;const data=Promise.race([
      m.project.kind==='box'?loadTerrain(m,0):loadSamples(m,1),
      new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('Mostra no disponible')),20000)),
    ]).then(()=>{
      if(active!==m||m.visit!==visit)return;
      if(m.project.kind!=='box')paint(m,m.index);else if(phase==='reading')paint(m,m.index);
      requestRender();return null;
    }).catch(error=>error).finally(()=>clearTimeout(timeout));
    surface.dataset.open='true';phase='opening';if(shelf.has(m))await shelf.take(m);
    const target=readingPose(m),focus=new THREE.Vector3(-.03,.79,.065),height=Math.max(.76,.62/(2*Math.tan(THREE.MathUtils.degToRad(50/2))*camera.aspect*.86));
    const readPosition=new THREE.Vector3(focus.x,.79+height,focus.z+.006),readLook=headTo(focus,readPosition),from=m.home.clone(),q=m.rotation.clone();m.group.position.copy(from);m.group.quaternion.copy(q);m.lid.rotation[m.axis]=m.homeLid;
    if(m.idle)m.idle.visible=false;
    m.journey=t=>{
      const exit=THREE.MathUtils.smoothstep(t,.15,1),settle=THREE.MathUtils.smoothstep(t,.38,.95),open=THREE.MathUtils.smoothstep(t,.52,1),pull=THREE.MathUtils.smoothstep(t,0,.43),travel=THREE.MathUtils.smoothstep(t,.4,1);
      const forward=Math.max(from.z+.43,target.position.z);
      m.group.position.set(THREE.MathUtils.lerp(from.x,target.position.x,travel),THREE.MathUtils.lerp(from.y,target.position.y,t)+Math.sin(Math.PI*t)*.11,THREE.MathUtils.lerp(from.z,forward,pull)+(target.position.z-forward)*travel);
      m.group.quaternion.slerpQuaternions(q,target.rotation,settle);m.lid.rotation[m.axis]=THREE.MathUtils.lerp(m.homeLid,m.angle,open);m.setLoad?.(1-open);
      if(m.terrains)for(const [i,node]of m.terrains)node.visible=t>.58&&i===m.index;
      camera.position.lerpVectors(savedPosition,readPosition,exit);camera.quaternion.slerpQuaternions(savedLook,readLook,exit);camera.fov=THREE.MathUtils.lerp(savedFov,50,exit);camera.updateProjectionMatrix();
    };
    await animate('material',t=>{m.journey(t);m.group.updateWorldMatrix(true,true);shelf.leaving(m,t);},2500);
    const error=await data;phase='reading';
    if(error){await close();throw error;}
    if(m.project.kind==='box')paint(m,m.index);
    delete surface.dataset.busy;resize();requestRender();onAction('obre_material',{projecte:id});
  }
  async function close(){
    if(!active||!['reading','inspecting'].includes(phase))return;if(inspected)await leaveInspection();const m=active;phase='closing';surface.dataset.busy='true';resize();
    await shelf.prepareReturn(m);await animate('material',t=>m.journey(1-t),2500);if(shelf.has(m))await shelf.restore();
    for(const page of m.pages||[]){page.removeFromParent();page.geometry.dispose();page.material.dispose();}m.pages=null;if(m.terrains)for(const node of m.terrains.values())node.visible=false;
    if(m.idle)m.idle.visible=true;delete m.visit;life.pause(false);active=null;phase='shelf';look.enabled=true;look.sync();delete surface.dataset.open;delete surface.dataset.busy;controlsDirty=true;contactsDirty=true;requestRender();
  }
  async function changeSample(delta){
    if(!active||phase!=='reading')return;const m=active,count=m.project.kind==='box'?m.project.reliefs.length:3,index=(m.index+delta+count)%count;
    phase='changing';try{
      if(m.project.kind==='box'){await loadTerrain(m,index);paint(m,index);}
      else {await loadSamples(m,index);await animate('print',t=>m.pages.forEach(p=>p.material.opacity=1-t),110);paint(m,index);await animate('print',t=>m.pages.forEach(p=>p.material.opacity=t),110);onObjectSound('page','paper');}
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
      const mesh=m.terrains.get(m.index),from=mesh.getWorldPosition(new THREE.Vector3()),originalScale=mesh.scale.clone(),parent=mesh.parent,local=mesh.position.clone();scene.attach(mesh);mesh.scale.multiplyScalar(1.2);const to=camera.position.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()),.42);
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
  function highlight(id){if(active||phase!=='shelf')return;hovered=id;for(const m of models.values()){const from=m.group.position.clone(),to=m.home.clone();if(m.project.id===id)to.z+=.015;animate('hover-'+m.project.id,t=>m.group.position.lerpVectors(from,to,t));}requestRender();}
  async function moveView(direction){
    if(active||phase!=='shelf'||motions.has('look'))return;const from=camera.quaternion.clone(),fromFov=camera.fov;if(direction==='home')look.home();else look.turn(direction==='left'?.28:-.28,0);
    const to=camera.quaternion.clone(),toFov=camera.fov;camera.quaternion.copy(from);camera.fov=fromFov;camera.updateProjectionMatrix();look.enabled=false;
    await animate('look',t=>{camera.quaternion.slerpQuaternions(from,to,t);camera.fov=THREE.MathUtils.lerp(fromFov,toFov,t);camera.updateProjectionMatrix();},420);look.sync();if(phase==='shelf')look.enabled=true;onAction('mira',{gest:'boto',direccio:direction});
  }
  function setLamp(on){lampOn=on;room.setLamp(on);onLampChange(on);onAction('llum',{actiu:on});renderer.shadowMap.needsUpdate=true;requestRender();}
  function setWindow(on){windowOpen=on;onWindowChange(on);onAction('finestra',{oberta:on});const from=room.opening;animate('window',t=>room.setWindow(THREE.MathUtils.lerp(from,on?1:0,t)),820);}
  const controlRay=new THREE.Raycaster(),controlPointer=new THREE.Vector2();
  canvas.addEventListener('click',event=>{
    if(active||phase!=='shelf')return;const r=canvas.getBoundingClientRect();controlPointer.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);controlRay.setFromCamera(controlPointer,camera);
    const stapler=content.getObjectByName('DeskStapler'),hit=controlRay.intersectObjects([room.sash,room.switchTarget,...(stapler?[stapler]:[])],true)[0];if(!hit)return;
    const nearest=controlRay.intersectObjects(scene.children,true).find(h=>h.object.isMesh&&h.object.visible&&!h.object.material.transparent);if(nearest&&nearest.distance<hit.distance-.015)return;
    if(stapler?.getObjectById(hit.object.id)){if(motions.has('stapler'))return;animate('stapler',t=>{staplerPress.rotation.x=.19*Math.sin(Math.PI*t);staplerPress.userData.magazine.rotation.x=.103*Math.sin(Math.PI*t);},420);onObjectSound('staple','metal');onAction('toca_grapadora');}
    else if(room.switchTarget.getObjectById(hit.object.id))setLamp(!lampOn);else setWindow(!windowOpen);
  });
  document.addEventListener('visibilitychange',()=>{clearTimeout(ambientTimer);lastTime=undefined;if(!document.hidden)requestRender();});
  reduced.addEventListener('change',()=>{for(const m of motions.values()){m.update(1);m.resolve();}motions.clear();requestRender();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();clearTimeout(ambientTimer);document.querySelector('.desk-list').classList.add('is-open');document.querySelector('#desk-status').textContent='Pots continuar des de la llista de projectes.';});
  onStage(94,'Preparant la mirada des de la cadira…');readyToRender=true;renderer.shadowMap.needsUpdate=true;await renderer.compileAsync(scene,camera);await new Promise(resolve=>{requestRender();requestAnimationFrame(()=>requestAnimationFrame(resolve));});
  return {select,close,highlight,moveView,changeSample,inspect,leaveInspection,setLamp,setWindow,
    info:()=>({phase,selected:active?.project.id,index:active?.index||0,count:active?.project.kind==='box'?active.project.reliefs.length:3,secondary:Boolean(active?.pages?.[1]?.visible),paired:active?.pages?.[1]?.userData.sample?.role==='answers',inspection:inspected?.type||null}),
    diagnostics:()=>({look:look.info(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,materials:materials.size,lampOn,windowOpen,life:life.info(),garden:garden.info(),dust:dust.geometry.attributes.position.count,buffer:[canvas.width,canvas.height],pixelRatio:renderer.getPixelRatio()}),
  };
}
function createContacts(scene,models){
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),pixels=x.createImageData(64,64);
  for(let y=0;y<64;y++)for(let px=0;px<64;px++){const i=(y*64+px)*4,u=(px-31.5)/32,v=(y-31.5)/32;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=28;pixels.data[i+3]=80*Math.exp(-4*(Math.pow(u,6)+Math.pow(v,6)));}x.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(c),geometry=new THREE.PlaneGeometry(1,1),shadows=new Map();
  for(const model of models.values()){const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.55,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.name='Contact_'+model.project.id;scene.add(mesh);shadows.set(model,mesh);}
  return {update(){for(const [model,mesh]of shadows){const b=model.bounds.clone().applyMatrix4(model.group.matrixWorld),size=b.getSize(new THREE.Vector3()),centre=b.getCenter(new THREE.Vector3());mesh.position.set(centre.x,Math.min(.757,Math.max(.7505,b.min.y-.0003)),centre.z);mesh.scale.set(size.x+.012,size.z+.012,1);mesh.material.opacity=.55*Math.exp(-Math.max(0,b.min.y-.758)*35);}}};
}
// Keep reactive leaves and their own veins together; batch the static foliage.
function batchPlant(plant){
  if(!plant)return;plant.updateWorldMatrix(true,true);const inverse=plant.matrixWorld.clone().invert(),batches=new Map();
  plant.traverse(n=>{if(!n.isMesh)return;for(let parent=n;parent&&parent!==plant;parent=parent.parent)if(movingLeaves.has(parent.name))return;const key=n.material.uuid+'|'+Object.keys(n.geometry.attributes).sort().join(','),list=batches.get(key)||[];list.push(n);batches.set(key,list);});
  for(const nodes of batches.values())if(nodes.length>1){const material=nodes[0].material;
    const geometries=nodes.map(n=>(n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,n.matrixWorld)));
    const geometry=mergeGeometries(geometries,false);if(geometry){const mesh=new THREE.Mesh(geometry,material);mesh.name='StaticPlant';mesh.castShadow=mesh.receiveShadow=true;plant.add(mesh);for(const n of nodes){n.removeFromParent();n.geometry.dispose();}}for(const g of geometries)g.dispose();
  }
}
function createDust(scene){
  const n=820,data=new Float32Array(n*3);let seed=7429;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/4294967296;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data,3));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{time:{value:0},light:{value:.6},pixelRatio:{value:1}},
    vertexShader:'uniform float time;uniform float pixelRatio;varying float size;void main(){vec3 s=fract(position+vec3(.0012,.0022,.0009)*time);vec3 p=vec3(-.77+s.x*1.9,.79+s.y*.60,-.5+s.z*.94);p.x+=sin(time*.27+position.z*18.)*.020;p.z+=cos(time*.23+position.y*17.)*.022;size=position.z;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.+position.z*1.7)*.72/max(.18,-mv.z),1.6,6.5)*pixelRatio;}',
    fragmentShader:'uniform float light;varying float size;void main(){float r=length(gl_PointCoord-.5)*2.;float a=exp(-r*r*2.3)*(1.-smoothstep(.55,1.,r))*light*(.55+size*.45);gl_FragColor=vec4(1.,.95,.82,a);}',
  });const points=new THREE.Points(g,material);points.name='SeatedDust';points.frustumCulled=false;points.raycast=()=>{};scene.add(points);return points;
}
