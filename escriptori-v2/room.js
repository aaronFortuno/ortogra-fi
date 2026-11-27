import * as THREE from 'three';
import { mergeGeometries } from '../assets/vendor/three/addons/utils/BufferGeometryUtils.js';

const texture=canvas=>{const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;};
function plaster(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(512,512);let seed=8741;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const i=(y*512+x)*4,s=Math.sin(x*.022+Math.sin(y*.016))*5+Math.cos(y*.034+x*.008)*3+Math.sin(x*.062-y*.042)*.9+(random()-.5)*4;
    pixels.data[i]=201+s;pixels.data[i+1]=194+s*.9;pixels.data[i+2]=175+s*.8;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  for(let i=0;i<15;i++){let x=random()*512,y=random()*512;ctx.strokeStyle='rgba(82,70,53,.14)';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<8;j++){x+=(random()-.5)*7;y+=2+random()*5;ctx.lineTo(x,y);}ctx.stroke();}
  const material=new THREE.MeshStandardMaterial({name:'CornerPlaster',map:texture(canvas),roughness:.98,envMapIntensity:.36});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 cornerWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncornerWorld=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader='varying vec3 cornerWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nfloat skirting=exp(-abs(cornerWorld.y-.75)*9.);float corner=exp(-abs(cornerWorld.x+.84)*11.)*exp(-abs(cornerWorld.z+.65)*10.);reflectedLight.indirectDiffuse*=1.-.22*skirting-.20*corner;');
  };
  material.customProgramCacheKey=()=> 'corner-plaster-contact-v1';return material;
}
function rounded(w,h,d,r=.008){
  const shape=new THREE.Shape(),a=w/2,b=d/2;
  shape.moveTo(-a+r,-b);shape.lineTo(a-r,-b);shape.quadraticCurveTo(a,-b,a,-b+r);shape.lineTo(a,b-r);shape.quadraticCurveTo(a,b,a-r,b);shape.lineTo(-a+r,b);shape.quadraticCurveTo(-a,b,-a,b-r);shape.lineTo(-a,-b+r);shape.quadraticCurveTo(-a,-b,-a+r,-b);
  const g=new THREE.ExtrudeGeometry(shape,{depth:h-2*r,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:r,bevelThickness:r,curveSegments:3});g.rotateX(-Math.PI/2);g.translate(0,-h/2+r,0);return g;
}
function noteTexture(){
  const c=document.createElement('canvas');c.width=384;c.height=512;const x=c.getContext('2d');x.fillStyle='#ddd3b4';x.fillRect(0,0,384,512);x.strokeStyle='#889b9738';x.lineWidth=1;
  for(let y=150;y<490;y+=46){x.beginPath();x.moveTo(28,y);x.lineTo(355,y);x.stroke();}
  x.fillStyle='#506655';x.font='italic 34px Georgia';x.fillText('Per demà...',30,80);x.font='24px Georgia';for(const [i,line]of ['Tornar les fitxes','Revisar les notes','Fer una mica de lloc'].entries())x.fillText(line,30,148+i*92);return texture(c);
}
export function createRoom(scene){
  const root=new THREE.Group();root.name='CornerRoom';scene.add(root);
  const wall=plaster(),wood=new THREE.MeshStandardMaterial({name:'OakCorner',color:'#a8865d',roughness:.8}),trim=wood.clone();trim.name='OakWindow';
  const iron=new THREE.MeshStandardMaterial({name:'BookendSteel',color:'#52636a',metalness:.62,roughness:.52}),paper=new THREE.MeshStandardMaterial({color:'#e1dac5',roughness:1});
  function box(name,size,position,material,r=0,parent=root){
    const geometry=r?rounded(...size,Math.min(r,...size.map(v=>v*.24))):new THREE.BoxGeometry(...size),mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  box('BackWall',[2.2,2.8,.07],[.2,1.4,-.68],wall);
  box('RightWall',[.07,2.8,2.2],[1.25,1.4,.4],wall);
  box('WindowWallBottom',[.07,.83,2.2],[-.87,.415,.4],wall);
  box('WindowWallTop',[.07,1.02,2.2],[-.87,2.29,.4],wall);
  box('WindowWallBack',[.07,.96,.50],[-.87,1.31,-.43],wall);
  box('WindowWallFront',[.07,.96,.62],[-.87,1.31,1.17],wall);
  box('DeskTop',[2,.047,.93],[.15,.7265,-.17],wood,.009);
  box('DeskLeftEdge',[.05,.14,.88],[-.82,.66,-.17],wood,.003);
  box('DeskFrontApron',[1.91,.14,.035],[.15,.65,.278],wood,.003);
  for(const x of [-.72,1.02])for(const z of [-.5,.19])box('DeskLeg',[.06,.63,.06],[x,.315,z],wood,.004);
  box('Floor',[2.2,.05,2.2],[.2,-.03,.4],new THREE.MeshStandardMaterial({color:'#77715e',roughness:1}));
  box('BookendFoot',[.40,.006,.23],[.11,.753,-.47],iron,.003);
  box('BookendUpright',[.009,.41,.23],[.307,.961,-.47],iron,.003);
  for(const z of [-.56,-.38]){const screw=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,.002,10),iron);screw.position.set(.29,.757,z);root.add(screw);}
  const scar=new THREE.MeshStandardMaterial({color:'#664d31',roughness:1,transparent:true,opacity:.21,depthWrite:false});
  let wearSeed=3071;const wearRandom=()=>{wearSeed=(Math.imul(wearSeed,1664525)+1013904223)>>>0;return wearSeed/4294967296;};
  for(let i=0;i<28;i++){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(.006+wearRandom()**2*.042,.00022+wearRandom()*.00025),scar);m.rotation.set(-Math.PI/2,0,(wearRandom()-.5)*1.4);
    const x=i<19?-.15+(wearRandom()+wearRandom()-1)*.45:-.70+wearRandom()*1.65,z=i<19?.04+(wearRandom()+wearRandom()-1)*.17:-.37+wearRandom()*.58;m.position.set(x,.7506,z);root.add(m);
  }
  const ringCanvas=document.createElement('canvas');ringCanvas.width=ringCanvas.height=192;const rc=ringCanvas.getContext('2d');rc.strokeStyle='rgba(85,59,31,.18)';rc.lineWidth=3;rc.beginPath();rc.ellipse(96,96,72,75,.2,.3,5.8);rc.stroke();
  const ring=new THREE.Mesh(new THREE.PlaneGeometry(.092,.092),new THREE.MeshStandardMaterial({map:texture(ringCanvas),roughness:1,transparent:true,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(.31,.7508,.15);root.add(ring);
  const note=box('WallNote',[.12,.17,.001],[.43,1.25,-.642],new THREE.MeshStandardMaterial({map:noteTexture(),roughness:1}));note.rotation.z=-.065;
  const pin=new THREE.Mesh(new THREE.SphereGeometry(.004,10,7),new THREE.MeshStandardMaterial({color:'#a96745',roughness:.55}));pin.position.set(.43,1.327,-.636);root.add(pin);
  box('HighShelf',[.82,.026,.18],[.44,1.55,-.55],wood,.004);
  for(const x of [.14,.73])box('ShelfBracket',[.015,.12,.12],[x,1.49,-.56],iron,.002);
  for(let i=0;i<4;i++){const m=box('ShelfPapers',[.24-i*.009,.003,.145],[.37+Math.sin(i)*.004,1.567+i*.003,-.52],paper);m.rotation.y=(i-1)*.032;}
  box('ShelfBox',[.15,.12,.12],[.70,1.623,-.55],new THREE.MeshStandardMaterial({color:'#9f9275',roughness:1}),.004);
  const outside=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.1),new THREE.MeshBasicMaterial({color:'#c5cfb3'}));outside.rotation.y=Math.PI/2;outside.position.set(-1.65,1.31,.34);outside.name='GardenView';root.add(outside);
  for(const z of [-.18,.86])box('WindowFrame',[.06,1.01,.048],[-.826,1.31,z],trim,.004);
  for(const y of [.815,1.805])box('WindowFrame',[.06,.048,1.09],[-.826,y,.34],trim,.004);
  box('WindowSill',[.26,.036,1.15],[-.765,.817,.34],trim,.005);
  const sash=new THREE.Group();sash.name='WindowSash';sash.position.set(-.802,1.31,-.155);root.add(sash);
  for(const z of [0,1])box('SashFrame',[.024,.93,.028],[0,0,z],trim,.003,sash);
  for(const y of [-.45,.45])box('SashFrame',[.024,.028,1],[0,y,.5],trim,.003,sash);
  box('SashBar',[.022,.90,.018],[0,0,.5],trim,.002,sash);
  const normals=new Uint8Array(128*128*4);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;normals[i]=128+Math.sin(x*.073+y*.031)*8;normals[i+1]=128+Math.cos(y*.067-x*.023)*8;normals[i+2]=255;normals[i+3]=255;}
  const normal=new THREE.DataTexture(normals,128,128);normal.needsUpdate=true;normal.magFilter=normal.minFilter=THREE.LinearFilter;
  const glassMaterial=new THREE.MeshPhysicalMaterial({color:'#d8dfcf',transparent:true,opacity:.12,roughness:.21,metalness:.06,clearcoat:1,clearcoatRoughness:.19,normalMap:normal,normalScale:new THREE.Vector2(.15,.15),side:THREE.DoubleSide,depthWrite:false});
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(.97,.88),glassMaterial);glass.name='WindowGlass';glass.rotation.y=Math.PI/2;glass.position.z=.5;glass.renderOrder=3;sash.add(glass);
  const handle=box('WindowHandle',[.021,.055,.012],[.022,-.1,.93],iron,.004,sash);
  // A rocker on the movable lamp's own base, not a household wall switch.
  const lampSwitch=new THREE.Group();lampSwitch.name='LampBaseSwitch';lampSwitch.position.set(.94,.773,.23);lampSwitch.rotation.x=-Math.PI/2;root.add(lampSwitch);
  box('SwitchPlate',[.030,.038,.005],[0,0,0],new THREE.MeshStandardMaterial({color:'#434b43',roughness:.65}),.003,lampSwitch);
  const rocker=box('SwitchRocker',[.017,.025,.005],[0,0,.004],new THREE.MeshStandardMaterial({color:'#c9c3a9',roughness:.6}),.002,lampSwitch);
  box('LampFoot',[.13,.018,.10],[.94,.761,.20],iron,.006);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.30,12),iron);stem.position.set(.94,.91,.20);stem.rotation.z=-.2;root.add(stem);
  const shade=new THREE.Mesh(new THREE.ConeGeometry(.065,.08,32,1,true),iron);shade.position.set(.91,1.075,.20);shade.rotation.z=-.18;root.add(shade);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.012,10,8),new THREE.MeshBasicMaterial({color:'#fff0c7'}));bulb.position.set(.91,1.055,.20);root.add(bulb);
  const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.99,.757,.20),new THREE.Vector3(1.08,.754,.17),new THREE.Vector3(1.14,.73,.14),new THREE.Vector3(1.15,.63,.14)]),14,.002,5,false),new THREE.MeshStandardMaterial({color:'#373b33',roughness:.85}));root.add(cable);
  const lamp=new THREE.SpotLight('#ffecd0',6.4,3.0,Math.PI/3,.85,2);lamp.position.copy(bulb.position);lamp.target.position.set(-.25,.75,.10);lamp.shadow.mapSize.set(1024,1024);lamp.shadow.camera.near=.03;lamp.shadow.camera.far=3;lamp.shadow.normalBias=.0012;lamp.shadow.bias=-.00006;lamp.shadow.radius=3.5;scene.add(lamp,lamp.target);
  let opening=0;
  return {root,wood,trim,lamp,sash,outside,bulb,windowTargets:[glass,handle],switchTarget:lampSwitch,
    get opening(){return opening;},
    setLamp(on){lamp.intensity=on?6.4:0;bulb.visible=on;rocker.rotation.x=on?-.07:.07;},
    setWindow(t){opening=t;sash.rotation.y=-t*.48;},
    finish(){
      wood.color.set('#aa8255');wood.roughness=.78;trim.color.set('#927247');trim.roughness=.86;
      const batches=new Map();root.updateWorldMatrix(true,true);
      for(const node of [...root.children])if(node.isMesh&&node!==outside&&node!==bulb){const key=node.material.uuid+'|'+Object.keys(node.geometry.attributes).sort().join(','),list=batches.get(key)||[];list.push(node);batches.set(key,list);}
      for(const nodes of batches.values())if(nodes.length>1){const material=nodes[0].material,geometries=nodes.map(n=>(n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone()).applyMatrix4(n.matrix));const merged=mergeGeometries(geometries,false);if(merged){const mesh=new THREE.Mesh(merged,material);mesh.name='StaticRoom_'+material.name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);for(const n of nodes){n.removeFromParent();n.geometry.dispose();}}for(const g of geometries)g.dispose();}
    },
  };
}
