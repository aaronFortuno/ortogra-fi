import * as THREE from 'three';

const down = new THREE.Vector3(0, -1, 0);
const crosses = (a,b,margin=0) => a.min.x < b.max.x+margin && a.max.x > b.min.x-margin &&
  a.min.z < b.max.z+margin && a.max.z > b.min.z-margin;

// Reuse the loose sheets' existing grid and thickness. No new meshes or faces.
export function prepareSheet(node) {
  if (!node.isMesh || !/^LooseWorksheet_/.test(node.name)) return null;
  const geometry = node.geometry.clone(), base = geometry.attributes.position.array.slice();
  node.geometry = geometry;
  const sites=[], vertexSite=[];
  for(let i=0;i<base.length;i+=3){
    let index=sites.findIndex(p=>Math.hypot(p.x-base[i],p.z-base[i+2])<.002);
    if(index<0){index=sites.length;sites.push({x:base[i],y:base[i+1],z:base[i+2],neighbours:[]});}
    sites[index].y=Math.min(sites[index].y,base[i+1]);vertexSite.push(index);
  }
  // Exported thickness shifts some lower vertices sideways by a few microns.
  // Merge those pairs and use triangle topology, not exact coordinate rows.
  const neighbours=sites.map(()=>new Set()),index=geometry.index;
  for(let i=0;i<(index?.count||vertexSite.length);i+=3){
    const face=[0,1,2].map(j=>vertexSite[index?index.getX(i+j):i+j]);
    for(const a of face)for(const b of face)if(a!==b)neighbours[a].add(b);
  }
  sites.forEach((p,i)=>p.neighbours=[...neighbours[i]].map(j=>({index:j,distance:Math.hypot(p.x-sites[j].x,p.z-sites[j].z)})));
  let current=new Float32Array(sites.length), motion=null, ball=false, ballMotion=null;
  const followers=[];
  function nearest(x,z){let best=0,distance=Infinity;sites.forEach((p,i)=>{const d=(p.x-x)**2+(p.z-z)**2;if(d<distance){distance=d;best=i;}});return best;}
  function follow(){
    const a=geometry.attributes.position;
    for(const f of followers){f.node.position.fromBufferAttribute(a,f.vertex).add(f.offset);}
  }
  function apply(values){
    const a=geometry.attributes.position;
    for(let i=0;i<a.count;i++)a.setXYZ(i,base[i*3],base[i*3+1]+values[vertexSite[i]],base[i*3+2]);
    a.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();follow();
  }
  return { sites,
    get crumpled(){return ball;},
    freeze(){motion=null;},
    follow(node){
      const site=nearest(node.position.x,node.position.z),vertex=vertexSite.indexOf(site),a=geometry.attributes.position;
      followers.push({node,vertex,offset:node.position.clone().sub(new THREE.Vector3().fromBufferAttribute(a,vertex))});
    },
    crumple(instant=false){
      if(ball)return false;ball=true;motion=null;
      const a=geometry.attributes.position,from=a.array.slice(),to=from.slice();
      const x0=Math.min(...sites.map(p=>p.x)),x1=Math.max(...sites.map(p=>p.x));
      const z0=Math.min(...sites.map(p=>p.z)),z1=Math.max(...sites.map(p=>p.z));
      const bottom=Math.min(...sites.map(p=>p.y)),radius=.215;
      for(let i=0;i<a.count;i++){
        const u=(base[i*3]-x0)/(x1-x0),v=(base[i*3+2]-z0)/(z1-z0);
        const theta=.07+v*(Math.PI-.14)+.055*Math.sin(u*29+v*13);
        const phi=u*Math.PI*2+.16*Math.sin(v*21)+.06*Math.sin(u*41-v*17);
        const crease=.89+.075*Math.sin(u*49+v*17)+.065*Math.sin(u*31-v*43)+.04*Math.cos(u*83+v*61);
        const r=radius*crease+(base[i*3+1]-sites[vertexSite[i]].y)*.5;
        to[i*3]=Math.sin(theta)*Math.cos(phi)*r;
        to[i*3+1]=bottom+radius+Math.cos(theta)*r;
        to[i*3+2]=Math.sin(theta)*Math.sin(phi)*r;
      }
      node.material=node.material.clone();node.material.flatShading=true;node.material.needsUpdate=true;
      ballMotion={from,to,start:performance.now()-(instant?220:0)};
      return true;
    },
    target(values,instant=false){
      if(ball)return false;
      if(values.every((v,i)=>Math.abs(v-current[i])<.0001)){motion=null;return false;}
      if(instant){current=Float32Array.from(values);apply(current);motion=null;}
      else motion={from:current.slice(),to:Float32Array.from(values),start:performance.now()};
      return true;
    },
    flatten(instant=false){return this.target(new Float32Array(sites.length),instant);},
    update(time){
      if(ballMotion){
        const t=THREE.MathUtils.clamp((time-ballMotion.start)/220,0,1),s=t*t*(3-2*t),a=geometry.attributes.position;
        for(let i=0;i<a.array.length;i++)a.array[i]=THREE.MathUtils.lerp(ballMotion.from[i],ballMotion.to[i],s);
        a.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();follow();
        if(t===1)ballMotion=null;return true;
      }
      if(!motion)return false;
      const t=THREE.MathUtils.clamp((time-motion.start)/220,0,1),s=t*t*(3-2*t);
      for(let i=0;i<current.length;i++)current[i]=THREE.MathUtils.lerp(motion.from[i],motion.to[i],s);
      apply(current);if(t===1)motion=null;return true;
    },
  };
}

export function createTableSupport(surface) {
  const ray=new THREE.Raycaster(), point=new THREE.Vector3(), hits=[];
  function heightAt(x,z,bodies,radius=0){
    let height=surface, owner=null;
    for(const item of bodies){
      const b=item.solid;
      if(x<b.min.x-radius||x>b.max.x+radius||z<b.min.z-radius||z>b.max.z+radius)continue;
      // A narrow pen can fit between two paper vertices. Sample the nearby
      // contact as well, rather than letting it poke through that grid cell.
      const probes=[[x,z]];
      if(radius)probes.push([THREE.MathUtils.clamp(x,b.min.x+.001,b.max.x-.001),THREE.MathUtils.clamp(z,b.min.z+.001,b.max.z-.001)],
        [x+radius,z],[x-radius,z],[x,z+radius],[x,z-radius]);
      for(const [px,pz] of probes){
        ray.set(point.set(px,b.max.y+.05,pz),down);ray.far=b.max.y-surface+.10;hits.length=0;
        if(item.node.name==='Pothos')item.node.traverse(n=>{if(n.isMesh&&n.name.startsWith('Pot'))ray.intersectObject(n,false,hits);});
        else ray.intersectObject(item.node,true,hits);
        for(const h of hits)if(h.point.y>height){height=h.point.y;owner=item;}
      }
    }
    return {height,owner};
  }
  function samples(item){
    const points=[],v=new THREE.Vector3(),bottom=item.solid.min.y;
    item.node.updateWorldMatrix(true,true);
    item.node.traverse(mesh=>{
      if(!mesh.isMesh || (item.node.name==='Pothos'&&!mesh.name.startsWith('Pot')))return;
      const a=mesh.geometry.attributes.position,step=Math.max(1,Math.floor(a.count/120));
      for(let i=0;i<a.count;i+=step){v.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);if(v.y<bottom+.065)points.push(v.clone());}
    });
    return points;
  }
  function contactPatches(bodies){
    const patches=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(const item of bodies){
      if(item.sheet&&!item.sheet.crumpled)continue;
      item.node.updateWorldMatrix(true,true);
      item.node.traverse(mesh=>{
        if(!mesh.isMesh||(item.node.name==='Pothos'&&!mesh.name.startsWith('Pot')))return;
        const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
        for(let i=0;i<(index?.count||p.count);i+=3){
          a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
          b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
          c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
          const y=Math.max(a.y,b.y,c.y);if(y<surface)continue;
          patches.push({x0:Math.min(a.x,b.x,c.x),x1:Math.max(a.x,b.x,c.x),
            z0:Math.min(a.z,b.z,c.z),z1:Math.max(a.z,b.z,c.z),y,owner:item});
        }
      });
    }
    return patches;
  }
  return {
    crosses,
    plan(item,bodies){
      const supports=new Set(),origin=item.node.getWorldPosition(new THREE.Vector3());
      const near=bodies.filter(b=>crosses(item.solid,b.solid,.09));
      if(item.sheet&&!item.sheet.crumpled){
        const restY=surface+item.flatHeight+.002,shift=restY-origin.y;
        const world=item.sheet.sites.map(p=>new THREE.Vector3(p.x,p.y,p.z).applyMatrix4(item.node.matrixWorld));
        const patches=contactPatches(near),papers=near.filter(b=>b.sheet&&!b.sheet.crumpled);
        const radius=Math.max(...item.sheet.sites.flatMap(p=>p.neighbours.map(n=>n.distance)))+.003;
        const constraints=world.map(p=>{
          const h=heightAt(p.x,p.z,papers,.058);
          // Cover every cell crossed by a solid triangle, not only the grid
          // vertices hit by a vertical ray. This prevents tiny hard corners
          // poking through between two paper vertices during the bend.
          for(const patch of patches)if(p.x>=patch.x0-radius&&p.x<=patch.x1+radius&&
            p.z>=patch.z0-radius&&p.z<=patch.z1+radius&&patch.y>h.height){h.height=patch.y;h.owner=patch.owner;}
          if(h.owner)supports.add(h.owner);
          return Math.max(0,h.height+.003-(p.y+shift));
        });
        let values=Float32Array.from(constraints);
        // A constrained smooth height field: contact remains above the solid,
        // while unsupported paper sags back towards the desktop. Bound the
        // slope first, then relax curvature instead of wrapping sharp corners.
        for(let pass=0;pass<22;pass++)for(let i=0;i<values.length;i++)for(const n of item.sheet.sites[i].neighbours)
          values[i]=Math.max(values[i],values[n.index]-.65*n.distance);
        for(let pass=0;pass<45;pass++){
          const next=values.slice();
          for(let i=0;i<values.length;i++){
            const ns=item.sheet.sites[i].neighbours;
            if(ns.length)next[i]=Math.max(constraints[i],ns.reduce((sum,n)=>sum+values[n.index],0)/ns.length-.0005);
          }
          values=next;
        }
        return {y:restY,values,supports};
      }
      let delta=surface+.002-item.solid.min.y;
      for(const p of samples(item)){
        const h=heightAt(p.x,p.z,near);if(h.owner)supports.add(h.owner);
        delta=Math.max(delta,h.height+.002-p.y);
      }
      return {y:origin.y+delta,supports};
    },
  };
}
