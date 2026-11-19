import * as THREE from 'three';
import { deskLayout } from './desk-layout.js?v=1.10.0';

export function overlaps(a, b, inset = .003) {
  return a.min.x < b.max.x-inset && a.max.x > b.min.x+inset &&
    a.min.y < b.max.y-inset && a.max.y > b.min.y+inset &&
    a.min.z < b.max.z-inset && a.max.z > b.min.z+inset;
}

// Leaves are flexible, not a solid cage around the pot.
export function solidBounds(node, target = new THREE.Box3()) {
  if (node.name !== 'Pothos') return target.setFromObject(node);
  target.makeEmpty(); node.updateWorldMatrix(true, true);
  node.traverse(part => {
    if (part.isMesh && part.name.startsWith('Pot')) target.union(new THREE.Box3().setFromObject(part));
  });
  return target;
}

function crosses(a, b, rect) {
  let low = 0, high = 1;
  for (const [axis, min, max] of [['x', rect.x0, rect.x1], ['z', rect.z0, rect.z1]]) {
    const d = b[axis]-a[axis];
    if (Math.abs(d) < 1e-9) { if (a[axis] <= min || a[axis] >= max) return false; }
    else {
      const u = (min-a[axis])/d, v = (max-a[axis])/d;
      low = Math.max(low, Math.min(u,v)); high = Math.min(high, Math.max(u,v));
      if (low >= high) return false;
    }
  }
  return high > 0 && low < 1;
}

// A small, event-driven search on the tabletop. No physics world runs at idle.
// Regions are sampled volumes of the material's actual opening trajectory.
export function routeOutside(body, obstacles, regions) {
  const start = body.getCenter(new THREE.Vector3()), half = body.getSize(new THREE.Vector3()).multiplyScalar(.5);
  const inflate = boxes => boxes.filter(b => body.min.y < b.max.y+.025 && body.max.y > b.min.y-.025)
    .map(b => ({ x0:b.min.x-half.x-.025, x1:b.max.x+half.x+.025,
      z0:b.min.z-half.z-.025, z1:b.max.z+half.z+.025 }));
  const walls = inflate(obstacles), reserved = inflate(regions);
  const [left,right,,front] = deskLayout.table.bounds;
  const limits = { x0:left+half.x+.035, x1:right-half.x-.035,
    z0:deskLayout.organizer.frontZ+half.z+.06, z1:front-half.z-.035 };
  const inside = (p,r) => p.x>r.x0 && p.x<r.x1 && p.z>r.z0 && p.z<r.z1;
  const legal = p => p.x>=limits.x0 && p.x<=limits.x1 && p.z>=limits.z0 && p.z<=limits.z1;
  const free = p => legal(p) && !walls.some(r=>inside(p,r));
  const goal = p => free(p) && !reserved.some(r=>inside(p,r));
  const step = .22, open = [{x:start.x,z:start.z,ix:0,iz:0,cost:0}], visited = new Map([['0,0',open[0]]]);
  let end;
  for (let count=0; open.length && count<2400; count++) {
    let best=0; for(let i=1;i<open.length;i++) if(open[i].cost<open[best].cost) best=i;
    const current=open.splice(best,1)[0];
    if(current.closed) continue; current.closed=true;
    if(goal(current)){end=current;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const ix=current.ix+dx, iz=current.iz+dz, key=ix+','+iz;
      const p={x:start.x+ix*step,z:start.z+iz*step,ix,iz};
      if(!free(p) || walls.some(r=>crosses(current,p,r))) continue;
      const cost=current.cost+Math.hypot(dx,dz)*step, old=visited.get(key);
      if(old && old.cost<=cost) continue;
      Object.assign(p,{cost,parent:current}); visited.set(key,p);open.push(p);
    }
  }
  if(end){
    const points=[];for(let p=end;p;p=p.parent)points.unshift(new THREE.Vector3(p.x,start.y,p.z));
    // Remove straight intermediate cells; keep turns clear of the obstacles.
    return points.filter((p,i)=>!i||i===points.length-1||
      Math.abs((p.x-points[i-1].x)*(points[i+1].z-p.z)-(p.z-points[i-1].z)*(points[i+1].x-p.x))>1e-6);
  }
  // An already trapped object can be lifted by the invisible hand, carried
  // over the other props and set down in a free spot. Never teleport through it.
  let nearest, distance=Infinity;
  for(let x=limits.x0;x<=limits.x1;x+=step) for(let z=limits.z0;z<=limits.z1;z+=step){
    const p={x,z}, d=(x-start.x)**2+(z-start.z)**2;
    if(d<distance && goal(p)){nearest=new THREE.Vector3(x,start.y,z);distance=d;}
  }
  if(!nearest) return null;
  const high=Math.max(body.max.y,...obstacles.map(b=>b.max.y))+half.y+.12;
  return [start,start.clone().setY(high),nearest.clone().setY(high),nearest];
}
