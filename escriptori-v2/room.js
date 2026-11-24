import * as THREE from 'three';
import { mergeGeometries } from '../assets/vendor/three/addons/utils/BufferGeometryUtils.js';

const colorTexture=canvas=>{const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;};
function plaster(){
  const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');
  let seed=8741;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // One pixel pass avoids the ordered dither accumulated by translucent gradients.
  const colour=x.createImageData(1024,1024);
  for(let y=0;y<1024;y++)for(let px=0;px<1024;px++){
    const i=(y*1024+px)*4,stain=Math.sin(px*.011+Math.sin(y*.008))*1.8+Math.cos(y*.017+px*.004)*1.2+Math.sin(px*.031-y*.021)*.55+(random()-.5)*1.4;
    colour.data[i]=194+stain;colour.data[i+1]=191+stain*.9;colour.data[i+2]=175+stain*.8;colour.data[i+3]=255;
  }
  x.putImageData(colour,0,0);
  for(let i=0;i<12;i++){
    let px=random()*1024,py=random()*1024;x.strokeStyle='rgba(80,73,60,.13)';x.lineWidth=.55;x.beginPath();x.moveTo(px,py);
    for(let j=0;j<7;j++){px+=(random()-.5)*13;py+=4+random()*9;x.lineTo(px,py);}x.stroke();
  }
  const bump=document.createElement('canvas');bump.width=bump.height=512;const b=bump.getContext('2d'),data=b.createImageData(512,512);
  for(let i=0;i<data.data.length;i+=4){const v=116+random()*23;data.data[i]=data.data[i+1]=data.data[i+2]=v;data.data[i+3]=255;}b.putImageData(data,0,0);
  const grain=new THREE.CanvasTexture(bump);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(3,3);
  return new THREE.MeshStandardMaterial({name:'V2Plaster',map:colorTexture(c),roughness:.97,envMapIntensity:.28,userData:{grain}});
}
function rounded(w,h,d,r=.008){
  const shape=new THREE.Shape(),a=w/2,b=d/2;
  shape.moveTo(-a+r,-b);shape.lineTo(a-r,-b);shape.quadraticCurveTo(a,-b,a,-b+r);shape.lineTo(a,b-r);shape.quadraticCurveTo(a,b,a-r,b);shape.lineTo(-a+r,b);shape.quadraticCurveTo(-a,b,-a,b-r);shape.lineTo(-a,-b+r);shape.quadraticCurveTo(-a,-b,-a+r,-b);
  const g=new THREE.ExtrudeGeometry(shape,{depth:h-2*r,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:r,bevelThickness:r,curveSegments:3});g.rotateX(-Math.PI/2);g.translate(0,-h/2+r,0);return g;
}
export function createRoom(scene){
  const root=new THREE.Group();root.name='SeatedRoom';scene.add(root);
  const wall=plaster(),wood=new THREE.MeshStandardMaterial({name:'OakSeated',color:'#b79670',roughness:.75}),trim=wood.clone();trim.name='OakWindow';
  const iron=new THREE.MeshStandardMaterial({color:'#4b4d45',metalness:.65,roughness:.42}),paper=new THREE.MeshStandardMaterial({color:'#dfd6bd',roughness:1});
  const box=(name,size,position,mat,r=0)=>{
    const g=r?rounded(size[0],size[1],size[2],Math.min(r,...size.map(v=>v*.25))):new THREE.BoxGeometry(...size),mesh=new THREE.Mesh(g,mat);
    mesh.name=name;mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  box('BackWall',[2.1,2.8,.075],[0,1.4,-.69],wall);
  box('RightWall',[.075,2.8,2.4],[1.01,1.4,.46],wall);
  box('WindowWallBottom',[.075,.96,2.4],[-1.01,.48,.46],wall);
  box('WindowWallTop',[.075,.76,2.4],[-1.01,2.42,.46],wall);
  box('WindowWallBack',[.075,1.08,.23],[-1.01,1.50,-.64],wall);
  box('WindowWallFront',[.075,1.08,.96],[-1.01,1.50,1.205],wall);
  box('Skirting',[2,.12,.03],[0,.06,-.635],wood,.004);
  box('Floor',[2.1,.055,2.4],[0,-.032,.46],new THREE.MeshStandardMaterial({color:'#777361',roughness:.92}));
  box('DeskTop',[1.65,.045,.87],[0,.7275,-.16],wood,.007);
  box('DeskApron',[1.53,.13,.033],[0,.64,.228],wood,.003);
  for(const x of [-.72,.72])for(const z of [-.47,.17])box('DeskLeg',[.055,.63,.055],[x,.315,z],wood,.003);
  // Short, practical dividers on the desk; the front is kept within arm's reach.
  box('OrganiserBack',[1.48,.25,.024],[0,.875,-.575],wood,.004);
  for(const x of [-.74,-.10,.24,.74])box('OrganiserCheek',[.022,.36,.26],[x,.93,-.45],wood,.004);
  for(const x of [-.69,.68]){
    const screw=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.003,12),iron);screw.rotation.x=Math.PI/2;screw.position.set(x,.955,-.559);root.add(screw);
  }
  // A few small traces of daily use; close-up detail is in the finish and grain.
  const scratch=new THREE.MeshBasicMaterial({color:'#8f714e',transparent:true,opacity:.24,depthWrite:false});
  for(let i=0;i<9;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.018+(i%4)*.012,.00055),scratch);m.rotation.x=-Math.PI/2;m.rotation.z=i*.87;m.position.set(-.65+i*.14,.7506,.11+(i%3)*.026);root.add(m);}
  const ringCanvas=document.createElement('canvas');ringCanvas.width=ringCanvas.height=256;const rc=ringCanvas.getContext('2d');rc.strokeStyle='rgba(77,54,26,.16)';rc.lineWidth=3;rc.beginPath();rc.ellipse(128,128,100,98,.1,.2,5.7);rc.stroke();
  const ring=new THREE.Mesh(new THREE.PlaneGeometry(.084,.084),new THREE.MeshBasicMaterial({map:colorTexture(ringCanvas),transparent:true,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(.59,.7508,.12);root.add(ring);
  // Cork and faded scraps at the edge of sight, with actual thickness/shadows.
  box('CorkBoard',[.32,.25,.014],[.56,1.31,-.642],new THREE.MeshStandardMaterial({color:'#a38a62',roughness:1,bumpMap:wall.userData.grain,bumpScale:.0003}),.004);
  for(let i=0;i<3;i++){const m=box('OldNote',[.085,.12,.001],[.47+i*.075,1.32+(i%2)*.025,-.631-i*.001],paper);m.rotation.z=(i-1)*.08;}
  // The garden stays outside the physical wooden aperture.
  const outside=new THREE.Mesh(new THREE.PlaneGeometry(1.38,1.19),new THREE.MeshBasicMaterial({color:'#c2cfba'}));outside.rotation.y=Math.PI/2;outside.position.set(-1.075,1.50,.10);outside.name='GardenView';root.add(outside);
  for(const z of [-.50,.10,.70])box('WindowFrame',[.055,1.16,.045],[-.962,1.50,z],trim,.004);
  for(const y of [.93,2.07])box('WindowFrame',[.055,.045,1.25],[-.962,y,.10],trim,.004);
  box('WindowSill',[.19,.032,1.31],[-.92,.921,.10],trim,.005);
  const sash=new THREE.Group();sash.position.set(-.961,1.5,.10);root.add(sash);
  const glassCanvas=document.createElement('canvas');glassCanvas.width=glassCanvas.height=256;const gc=glassCanvas.getContext('2d');gc.fillStyle='#080808';gc.fillRect(0,0,256,256);
  const edge=gc.createRadialGradient(128,128,40,128,128,175);edge.addColorStop(0,'#080808');edge.addColorStop(.65,'#161616');edge.addColorStop(1,'#9e9e9e');gc.fillStyle=edge;gc.fillRect(0,0,256,256);
  const normals=new Uint8Array(128*128*4);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;normals[i]=128+Math.sin(x*.073+y*.031)*8;normals[i+1]=128+Math.cos(y*.067-x*.023)*8;normals[i+2]=255;normals[i+3]=255;}
  const normal=new THREE.DataTexture(normals,128,128);normal.needsUpdate=true;normal.magFilter=normal.minFilter=THREE.LinearFilter;
  const glassMat=new THREE.MeshPhysicalMaterial({color:'#dbe0d0',transparent:true,opacity:.17,roughness:.18,metalness:.08,clearcoat:1,clearcoatRoughness:.15,normalMap:normal,normalScale:new THREE.Vector2(.13,.13),roughnessMap:new THREE.CanvasTexture(glassCanvas),side:THREE.DoubleSide,depthWrite:false,envMapIntensity:.7});
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(1.14,1.08),glassMat);glass.rotation.y=Math.PI/2;glass.renderOrder=3;sash.add(glass);
  const dust=new THREE.Mesh(new THREE.PlaneGeometry(1.14,1.08),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(glassCanvas),transparent:true,opacity:.11,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));dust.rotation.y=Math.PI/2;dust.position.x=.001;dust.renderOrder=4;sash.add(dust);
  // A small lamp rather than a large uniformly lit room.
  box('LampFoot',[.13,.018,.10],[.76,.761,-.29],iron,.006);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.30,12),iron);stem.position.set(.76,.91,-.29);stem.rotation.z=-.2;root.add(stem);
  const shade=new THREE.Mesh(new THREE.ConeGeometry(.065,.08,32,1,true),iron);shade.position.set(.73,1.075,-.29);shade.rotation.z=-.18;root.add(shade);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.012,10,8),new THREE.MeshBasicMaterial({color:'#fff0c7'}));bulb.position.set(.73,1.055,-.29);root.add(bulb);
  const lamp=new THREE.SpotLight('#fff1d9',4.8,2.5,Math.PI/3,.65,2);lamp.position.copy(bulb.position);lamp.target.position.set(.1,.75,.0);scene.add(lamp,lamp.target);
  return {root,wood,trim,lamp,sash,outside,bulb,
    setLamp(on){lamp.intensity=on?4.8:0;bulb.visible=on;},
    setWindow(t){sash.rotation.y=-t*.16;sash.position.x=-.961+t*.045;},
    finish(){
      wood.color.set('#b08c62');wood.roughness=.70;trim.color.set('#9e7d56');trim.roughness=.84;
      const batches=new Map();root.updateWorldMatrix(true,true);
      for(const node of [...root.children])if(node.isMesh&&node!==outside&&node!==bulb){const list=batches.get(node.material)||[];list.push(node);batches.set(node.material,list);}
      for(const [material,nodes]of batches)if(nodes.length>1){
        const geometries=nodes.map(n=>(n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone()).applyMatrix4(n.matrix));
        const merged=mergeGeometries(geometries,false);if(!merged)continue;
        const mesh=new THREE.Mesh(merged,material);mesh.name='StaticRoom_'+material.name;mesh.castShadow=nodes[0].castShadow;mesh.receiveShadow=nodes[0].receiveShadow;root.add(mesh);
        for(const n of nodes){n.removeFromParent();n.geometry.dispose();}for(const g of geometries)g.dispose();
      }
    },
  };
}
