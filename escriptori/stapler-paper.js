import * as THREE from 'three';

// A reversible magnetic preview carries an edge through the open throat while
// the pointer is still held. Test intent against the unsnapped pointer pose,
// never against the attracted sheet (which would otherwise trap itself).
export function createPaperSlot({room,stapler,items,reduced,refreshItem,refresh,invalidate,land,setWorld,supportPlan,redraw}){
  const motions=new Map(),outlines=new WeakMap(),capture=.62,escape=.86,notice=.98;
  let guide=null,hintLevel=0,hintTarget=0,hintMotion=null;
  // Kept outside the stapler hierarchy so the cue is not a solid or a hit target.
  const hint=new THREE.Group();hint.name='StaplerSlotHint';hint.visible=false;hint.matrixAutoUpdate=false;room.add(hint);
  const pad=new THREE.Mesh(new THREE.PlaneGeometry(.38,.18),new THREE.MeshBasicMaterial({color:'#73c7a3',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
  pad.rotation.x=-Math.PI/2;pad.position.set(0,.086,.46);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.062,.083,28),new THREE.MeshBasicMaterial({color:'#c8f6db',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.set(0,.088,.49);
  pad.raycast=ring.raycast=()=>{};hint.add(pad,ring);
  function paintHint(value){
    hintLevel=value;hint.visible=value>.002;pad.material.opacity=value*.38;ring.material.opacity=value*.85;
    hint.matrix.multiplyMatrices(room.matrixWorld.clone().invert(),stapler.node.matrixWorld);hint.matrixWorldNeedsUpdate=true;
  }
  function showHint(value){
    if(value===hintTarget||value>0&&hintTarget>0&&Math.abs(value-hintTarget)<.015)return;
    hintTarget=value;hintMotion={from:hintLevel,start:performance.now()};
    if(reduced.matches){paintHint(value);hintMotion=null;}redraw();
  }
  function cancel(item){
    if(guide&&(!item||guide.item===item||item===stapler)){
      const paper=guide.item;motions.delete(paper);paper.insertion=null;
      if(!paper.docked)paper.sheet.flatten(reduced.matches);guide=null;
    }
    if(item)item.insertion=null;showHint(0);
  }
  function detach(item){
    const targets=item===stapler?items.filter(i=>i.docked):[item];
    for(const i of targets)if(i.docked){i.docked=null;invalidate(i);if(i!==item)land(i);}
    cancel(item);
  }
  function nearestEdge(item,target,mouth){
    let outline=outlines.get(item.sheet);
    if(!outline){
      // The authored sheets have skewed, worn edges; their bounding rectangle
      // includes empty corners. Use the actual material silhouette instead.
      const points=[...item.sheet.sites].sort((a,b)=>a.x-b.x||a.z-b.z),cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
      const half=points=>{const result=[];for(const p of points){while(result.length>1&&cross(result.at(-2),result.at(-1),p)<=0)result.pop();result.push(p);}return result;};
      outline=[...half(points).slice(0,-1),...half([...points].reverse()).slice(0,-1)].map(p=>new THREE.Vector3(p.x,p.y,p.z));outlines.set(item.sheet,outline);
    }
    const delta=target.clone().sub(item.node.getWorldPosition(new THREE.Vector3()));
    const p=item.node.worldToLocal(mouth.clone().sub(delta)),edges=[];
    for(let i=0;i<outline.length;i++){
      const a=outline[i],b=outline[(i+1)%outline.length],v=b.clone().sub(a),length=v.x*v.x+v.z*v.z;
      const inset=Math.min(.45,.11/Math.max(.001,Math.sqrt(length)));
      const t=THREE.MathUtils.clamp(((p.x-a.x)*v.x+(p.z-a.z)*v.z)/Math.max(1e-9,length),inset,1-inset);
      edges.push(a.clone().addScaledVector(v,t));
    }
    let best,distance=Infinity;
    for(const edge of edges){const w=item.node.localToWorld(edge.clone()).add(delta),d=Math.hypot(w.x-mouth.x,w.z-mouth.z);if(d<distance){best=edge;distance=d;}}
    return {edge:best,distance};
  }
  function motion(item,path,mode){
    const lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths.at(-1)+path[i].distanceTo(path[i-1]));
    motions.set(item,{path,lengths,start:performance.now(),mode});
    if(reduced.matches){setWorld(item.node,path.at(-1).clone());complete(item);}redraw();
  }
  function captureEdge(item,target,edge,mouth){
    const from=item.node.getWorldPosition(new THREE.Vector3()),front=new THREE.Vector3(0,0,1).transformDirection(stapler.node.matrixWorld);
    const w=item.node.localToWorld(edge.clone()).add(target.clone().sub(from));
    const end=target.clone().add(new THREE.Vector3(mouth.x-w.x,0,mouth.z-w.z)).addScaledVector(front,-.07);
    // Preview the same supported, bent pose that will remain after release.
    setWorld(item.node,end);refreshItem(item);const plan=supportPlan(item,stapler);end.y=plan.y;setWorld(item.node,end);refreshItem(item);
    const layers=items.filter(i=>i!==item&&i.docked).length;
    const height=stapler.node.localToWorld(new THREE.Vector3(0,.078+layers*.004,.315)).y;
    const values=item.sheet.sites.map((p,i)=>{
      const w=item.node.localToWorld(new THREE.Vector3(p.x,p.y,p.z)),z=stapler.node.worldToLocal(w.clone()).z;
      const lift=Math.max(0,height-w.y)*(1-THREE.MathUtils.smoothstep(z,.43,1.4));return Math.max(plan.values[i],lift);
    });
    setWorld(item.node,from.clone());refreshItem(item);item.sheet.target(values,reduced.matches);
    item.insertion={end,front,edge};guide={item,raw:target.clone(),snapped:true};
    item.supports.clear();item.velocity.set(0,0,0);item.spin=0;
    const outside=end.clone().addScaledVector(front,.34);
    motion(item,[from,outside.clone().setY(from.y),outside,end],'capture');
  }
  function unhook(item,target){
    const insert=item.insertion;item.insertion=null;
    if(!insert)return;
    const from=item.node.getWorldPosition(new THREE.Vector3()),outside=insert.end.clone().addScaledVector(insert.front,.40);
    guide={item,raw:target.clone(),snapped:false};item.sheet.flatten(reduced.matches);
    motion(item,[from,outside.clone().setY(from.y),outside.clone().setY(target.y),target.clone()],'free');
  }
  function complete(item){
    const m=motions.get(item);motions.delete(item);
    if(m?.mode==='free'&&guide?.item===item)guide=null;
    if(m?.mode==='release')item.busy=false;
    refreshItem(item);invalidate(item);
  }
  return {
    preview(item,target){
      if(!item.sheet||item.sheet.crumpled||stapler.busy||stapler.drop||stapler.slide){cancel(item);return false;}
      const current=item.node.getWorldPosition(new THREE.Vector3()),delta=target.clone().sub(current);
      const center=item.solid.getCenter(new THREE.Vector3()).add(delta),local=stapler.node.worldToLocal(center.clone());
      const mouth=stapler.node.localToWorld(new THREE.Vector3(0,.075,.315)),snapped=guide?.item===item&&guide.snapped;
      let candidate;
      if(local.z>.60&&local.z<2.65&&Math.abs(local.x)<1.45){
        if(snapped){const edge=item.insertion.edge,w=item.node.localToWorld(edge.clone()).add(delta);candidate={edge,distance:Math.hypot(w.x-mouth.x,w.z-mouth.z)};}
        else candidate=nearestEdge(item,target,mouth);
      }
      const distance=candidate?.distance??Infinity;
      showHint(snapped&&distance<escape?1:.60*(1-THREE.MathUtils.smoothstep(distance,.30,notice)));
      if(distance<(snapped?escape:capture)){
        if(!snapped)captureEdge(item,target,candidate.edge,mouth);
        guide.raw.copy(target);return true;
      }
      if(snapped)unhook(item,target);
      if(guide?.item===item){
        guide.raw.copy(target);const m=motions.get(item);if(m?.mode==='free')m.path[m.path.length-1].copy(target);
        return true;
      }
      return false;
    },
    release(item){
      const insert=item.insertion;
      if(!insert){cancel(item);return false;}
      item.insertion=null;guide=null;showHint(0);
      item.supports.clear();item.docked=stapler;item.velocity.set(0,0,0);item.spin=0;item.drop=null;
      const m=motions.get(item);item.busy=Boolean(m);if(m)m.mode='release';
      redraw();return true;
    },
    cancel,
    detach,
    hold:item=>Boolean(item.docked),
    finish(){
      cancel();
      for(const [item,m] of motions){setWorld(item.node,m.path.at(-1).clone());complete(item);}
      for(const item of items)if(item.docked)detach(item);
      hintMotion=null;hintTarget=0;paintHint(0);
    },
    update(time){
      let moving=false;
      if(hintMotion){
        const t=THREE.MathUtils.clamp((time-hintMotion.start)/220,0,1);paintHint(THREE.MathUtils.lerp(hintMotion.from,hintTarget,t*t*(3-2*t)));
        if(t===1)hintMotion=null;moving=true;
      }
      for(const [item,m] of motions){
        if(m.mode==='free'){
          m.lengths=[0];for(let i=1;i<m.path.length;i++)m.lengths.push(m.lengths.at(-1)+m.path[i].distanceTo(m.path[i-1]));
        }
        const t=Math.min(1,Math.max(0,(time-m.start)/220)),d=t*t*(3-2*t)*m.lengths.at(-1);
        let i=1;while(i<m.path.length-1&&m.lengths[i]<d)i++;
        setWorld(item.node,m.path[i-1].clone().lerp(m.path[i],(d-m.lengths[i-1])/Math.max(1e-9,m.lengths[i]-m.lengths[i-1])));
        refreshItem(item);invalidate(item);if(t===1)complete(item);moving=true;
      }
      return moving;
    },
  };
}
