import * as THREE from 'three';

// The optimised GLB merges parts by material and drops Blender's part names.
// Recover connected shells before selecting the handle, magazine and driver.
function shells(mesh,toRoot){
  const g=mesh.geometry,a=g.attributes.position,index=g.index,count=(index?.count||a.count)/3;
  const parents=Array.from({length:count},(_,i)=>i),weld=new Map(),v=new THREE.Vector3();
  const find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
  for(let t=0;t<count;t++)for(let j=0;j<3;j++){
    const i=index?index.getX(t*3+j):t*3+j;v.fromBufferAttribute(a,i).applyMatrix4(toRoot);
    const key=[v.x,v.y,v.z].map(x=>Math.round(x*100000)).join('/');
    if(weld.has(key))parents[find(t)]=find(weld.get(key));else weld.set(key,t);
  }
  const groups=new Map();
  for(let t=0;t<count;t++){
    const id=find(t);if(!groups.has(id))groups.set(id,{triangles:[],bounds:new THREE.Box3()});
    const part=groups.get(id);part.triangles.push(t);
    for(let j=0;j<3;j++)part.bounds.expandByPoint(v.fromBufferAttribute(a,index?index.getX(t*3+j):t*3+j).applyMatrix4(toRoot));
  }
  return [...groups.values()];
}
function subset(source,triangles){
  const indices=[],used=new Map(),vertices=[];
  for(const t of triangles)for(let j=0;j<3;j++){
    const i=source.index?source.index.getX(t*3+j):t*3+j;
    if(!used.has(i)){used.set(i,vertices.length);vertices.push(i);}indices.push(used.get(i));
  }
  const g=new THREE.BufferGeometry();
  for(const [name,a] of Object.entries(source.attributes)){
    const data=new a.array.constructor(vertices.length*a.itemSize);
    vertices.forEach((i,n)=>{for(let j=0;j<a.itemSize;j++)data[n*a.itemSize+j]=a.array[i*a.itemSize+j];});
    g.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize,a.normalized));
  }
  g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function prepareStapler(stapler){
  const pivot=new THREE.Group();pivot.name='StaplerPress';pivot.position.set(0,.15,-.345);
  const magazine=new THREE.Group();magazine.name='StaplerMagazinePress';magazine.position.copy(pivot.position);pivot.userData.magazine=magazine;
  stapler.updateWorldMatrix(true,true);
  const inverse=stapler.matrixWorld.clone().invert(),meshes=[];stapler.traverse(n=>{if(n.isMesh)meshes.push(n);});
  stapler.add(pivot,magazine);pivot.updateWorldMatrix(true,false);magazine.updateWorldMatrix(true,false);
  for(const mesh of meshes){
    const parts=shells(mesh,new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
    const moving=[],fixed=[];
    for(const p of parts){
      const b=p.bounds;
      const moves=(b.max.y>.23&&b.min.y>.10)||(b.min.y>.085&&b.max.z>-.28&&(b.max.z-b.min.z>.45||b.min.z>.18));
      (moves?moving:fixed).push(...p.triangles);
    }
    if(!moving.length)continue;
    const carrier=mesh.material.metalness>.4?magazine:pivot;
    if(fixed.length){
      const mobile=mesh.clone(false);mobile.name='StaplerMoving_'+mesh.name;mobile.geometry=subset(mesh.geometry,moving);
      mesh.parent.add(mobile);carrier.attach(mobile);mesh.geometry=subset(mesh.geometry,fixed);
    }else carrier.attach(mesh);
  }
  return pivot;
}
