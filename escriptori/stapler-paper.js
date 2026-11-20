import * as THREE from 'three';

// Carry the sheet to the front, lower it, then slide its edge into the throat.
// The slot is an exception to the stapler's coarse collision box, not a hole
// through its upper cover or its base.
export function createPaperSlot({room,stapler,items,reduced,refreshItem,refresh,invalidate,land,setWorld,supportPlan,redraw}){
  const motions=new Map(),front=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const hint=new THREE.Mesh(new THREE.BoxGeometry(.28,.006,.11),new THREE.MeshBasicMaterial({color:'#3d9274',transparent:true,opacity:.45,depthWrite:false}));
  hint.name='StaplerSlotHint';hint.position.set(0,.085,.43);hint.visible=false;stapler.node.add(hint);
  function clearPreview(item){if(item)item.insertion=null;hint.visible=false;}
  function detach(item){
    const targets=item===stapler?items.filter(i=>i.docked):[item];
    for(const i of targets)if(i.docked){i.docked=null;invalidate(i);if(i!==item)land(i);}
    clearPreview(item);
  }
  function complete(item){motions.delete(item);item.busy=false;refreshItem(item);invalidate(item);}
  return {
    preview(item,target){
      clearPreview(item);
      if(!item.sheet||item.sheet.crumpled||stapler.busy||stapler.drop||stapler.slide)return false;
      const current=item.node.getWorldPosition(new THREE.Vector3()),delta=target.clone().sub(current);
      const center=item.solid.getCenter(new THREE.Vector3()).add(delta),local=stapler.node.worldToLocal(center.clone());
      if(local.z<.65||local.z>2.0||Math.abs(local.x)>1.15)return false;
      const mouth=stapler.node.localToWorld(new THREE.Vector3(0,.075,.315));
      let best,distance=.25;
      for(const p of item.sheet.sites){
        if(p.neighbours.length<4||p.neighbours.length>=6)continue;
        const w=item.node.localToWorld(new THREE.Vector3(p.x,p.y,p.z)).add(delta),d=Math.hypot(w.x-mouth.x,w.z-mouth.z);
        if(d<distance){best=w;distance=d;}
      }
      if(!best)return false;
      front.set(0,0,1).transformDirection(stapler.node.matrixWorld);
      const end=target.clone().add(new THREE.Vector3(mouth.x-best.x,0,mouth.z-best.z)).addScaledVector(front,-.07);
      item.insertion={end,front:front.clone()};hint.visible=true;redraw();return true;
    },
    release(item){
      const insert=item.insertion;clearPreview(item);if(!insert)return false;
      const from=item.node.getWorldPosition(new THREE.Vector3()),end=insert.end.clone();
      const layers=items.filter(i=>i!==item&&i.docked).reduce((n,i)=>n+(i.bundlePages?.length||1),0);
      setWorld(item.node,end);refreshItem(item);
      const plan=supportPlan(item,stapler);end.y=plan.y;setWorld(item.node,end);refreshItem(item);
      const height=stapler.node.localToWorld(new THREE.Vector3(0,.078+layers*.004,.315)).y;
      const values=item.sheet.sites.map((p,i)=>{
        const w=item.node.localToWorld(new THREE.Vector3(p.x,p.y,p.z)),z=stapler.node.worldToLocal(w.clone()).z;
        const lift=Math.max(0,height-w.y)*(1-THREE.MathUtils.smoothstep(z,.43,1.4));
        return Math.max(plan.values[i],lift);
      });
      item.supports.clear();item.docked=stapler;item.velocity.set(0,0,0);item.spin=0;item.busy=true;item.drop=null;
      item.sheet.target(values,reduced.matches);
      const outside=end.clone().addScaledVector(insert.front,.34);
      const path=[from,outside.clone().setY(from.y),outside,end],lengths=[0];
      for(let i=1;i<path.length;i++)lengths.push(lengths.at(-1)+path[i].distanceTo(path[i-1]));
      setWorld(item.node,from);refreshItem(item);
      motions.set(item,{path,lengths,start:performance.now()});
      if(reduced.matches){setWorld(item.node,end);complete(item);}
      redraw();return true;
    },
    detach,
    hold:item=>Boolean(item.docked),
    finish(){
      for(const [item,m] of motions){setWorld(item.node,m.path.at(-1));complete(item);}
      for(const item of items)if(item.docked)detach(item);
      hint.visible=false;
    },
    update(time){
      let moving=false;
      for(const [item,m] of motions){
        const t=Math.min(1,Math.max(0,(time-m.start)/220)),d=t*t*(3-2*t)*m.lengths.at(-1);
        let i=1;while(i<m.path.length-1&&m.lengths[i]<d)i++;
        setWorld(item.node,m.path[i-1].clone().lerp(m.path[i],(d-m.lengths[i-1])/Math.max(1e-9,m.lengths[i]-m.lengths[i-1])));
        refreshItem(item);if(t===1)complete(item);moving=true;
      }
      return moving;
    },
  };
}
