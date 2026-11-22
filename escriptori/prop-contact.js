import * as THREE from 'three';
import { deskLayout } from './desk-layout.js?v=1.10.0';

// One small batch of local ambient contacts. It follows the actual bodies,
// fades with separation and never pretends to be a directional/solar shadow.
export function createPropContacts(root,bodies){
  const capacity=40,positions=new Float32Array(capacity*12),uvs=new Float32Array(capacity*8),alpha=new Float32Array(capacity*4),indices=[];
  for(let i=0;i<capacity;i++){const n=i*4;indices.push(n,n+2,n+1,n+2,n+3,n+1);}
  const geometry=new THREE.BufferGeometry();geometry.setIndex(indices);
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('contactAlpha',new THREE.BufferAttribute(alpha,1).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.MeshBasicMaterial({color:'#302a22',map:contactAtlas(),transparent:true,depthWrite:false,toneMapped:false,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float contactAlpha;\nvarying float localContactAlpha;\nvarying vec2 localContactPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlocalContactAlpha=contactAlpha;\nlocalContactPosition=(modelMatrix*vec4(position,1.0)).xz;');
    shader.fragmentShader='varying float localContactAlpha;\nvarying vec2 localContactPosition;\n'+shader.fragmentShader;
    const [left,right,back,front]=deskLayout.table.bounds;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(localContactPosition.x<${left}||localContactPosition.x>${right}||localContactPosition.y<${back}||localContactPosition.y>${front})discard;
      diffuseColor.a *= localContactAlpha;`);
  };
  material.customProgramCacheKey=()=> 'local-prop-contact-v1';
  const mesh=new THREE.Mesh(geometry,material);mesh.name='StationeryContactOcclusion';mesh.frustumCulled=false;mesh.raycast=()=>{};root.add(mesh);
  const cache=new WeakMap(),point=new THREE.Vector3(),table=deskLayout.table;let signature='',updates=0,count=0;
  function update(){
    const candidates=bodies().filter(i=>!i.sheet||i.sheet.crumpled).filter(i=>!i.node.name.startsWith('LooseStaple_'));
    const next=candidates.map(i=>i.node.uuid+':'+i.node.matrixWorld.elements.map(v=>Math.round(v*10000)).join(',')+':'+i.solid.min.y.toFixed(4)+':'+Boolean(i.sheet?.crumpled)).join('|');
    if(next===signature)return;signature=next;count=0;
    for(const item of candidates){
      if(count===capacity)break;
      const gap=item.solid.min.y-table.surfaceY,c=item.solid.getCenter(point);
      if(gap<-.035||gap>.16||c.x<table.bounds[0]||c.x>table.bounds[1]||c.z<table.bounds[2]||c.z>table.bounds[3])continue;
      const opacity=(item.kind==='pen'?.29:.3)*(1-THREE.MathUtils.smoothstep(gap,.012,.16));if(opacity<.002)continue;
      let corners;
      if(item.sheet?.crumpled){
        const center=item.node.localToWorld(item.sheet.ballCenter.clone()),r=item.sheet.ballRadius+.045;
        corners=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,z])=>new THREE.Vector3(center.x+x*r,table.contactY,center.z+z*r));
      }else{
        let local=cache.get(item);
        if(!local){local=baseFootprint(item);cache.set(item,local);}
        if(!local)continue;corners=local.map(p=>item.node.localToWorld(p.clone()).setY(table.contactY));
      }
      const rectangle=['cloth','metal'].includes(item.kind)&&item.node.name!=='PaperClip',u=rectangle?.5:0;
      for(let j=0;j<4;j++){
        positions.set(corners[j].toArray(),count*12+j*3);uvs.set([u+(j%2)*.5,j<2?1:0],count*8+j*2);alpha[count*4+j]=opacity;
      }
      count++;
    }
    geometry.setDrawRange(0,count*6);for(const a of Object.values(geometry.attributes))a.needsUpdate=true;
    mesh.visible=count>0;updates++;
  }
  update();return {update,stats:()=>({stamps:count,updates,capacity,bytes:positions.byteLength+uvs.byteLength+alpha.byteLength})};
}

function baseFootprint(item){
  const node=item.node,points=[],v=new THREE.Vector3();node.updateWorldMatrix(true,true);
  node.traverse(mesh=>{
    if(!mesh.isMesh||(node.name==='Pothos'&&!mesh.name.startsWith('Pot')))return;
    const a=mesh.geometry.attributes.position;
    for(let i=0;i<a.count;i++){
      v.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);
      if(v.y<item.solid.min.y+.065)points.push([v.x,v.z]);
    }
  });
  if(points.length<3)return null;
  const x=points.reduce((s,p)=>s+p[0],0)/points.length,z=points.reduce((s,p)=>s+p[1],0)/points.length;
  let xx=0,zz=0,xz=0;for(const p of points){xx+=(p[0]-x)**2;zz+=(p[1]-z)**2;xz+=(p[0]-x)*(p[1]-z);}
  const angle=.5*Math.atan2(2*xz,xx-zz),c=Math.cos(angle),s=Math.sin(angle);
  const us=points.map(p=>(p[0]-x)*c+(p[1]-z)*s),vs=points.map(p=>-(p[0]-x)*s+(p[1]-z)*c),pad=item.kind==='pen'?.024:item.kind==='cup'?.1:.065;
  const loU=Math.min(...us)-pad,hiU=Math.max(...us)+pad,loV=Math.min(...vs)-pad,hiV=Math.max(...vs)+pad;
  return [[loU,loV],[hiU,loV],[loU,hiV],[hiU,hiV]].map(([u,v])=>node.worldToLocal(new THREE.Vector3(x+u*c-v*s,deskLayout.table.contactY,z+u*s+v*c)));
}

function contactAtlas(){
  const width=128,height=64,pixels=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=(x%64+.5)/32-1,v=(y+.5)/32-1;
    const distance=x<64?Math.hypot(u,v):Math.pow(u**4+v**4,.25);
    const opacity=(.65*(1-THREE.MathUtils.smoothstep(distance,.4,1))+.35*(1-THREE.MathUtils.smoothstep(distance,.88,1)))*.85,index=(y*width+x)*4;
    pixels.set([255,255,255,Math.round(opacity*255)],index);
  }
  const texture=new THREE.DataTexture(pixels,width,height);texture.name='PropContactAtlas';texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
