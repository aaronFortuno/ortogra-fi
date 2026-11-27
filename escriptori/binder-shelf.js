import * as THREE from 'three';
import { standingProfile, profileSpan } from './binder-load.js?v=1.25.0';

// Five cached convex outlines, not a continuously running physics world.
// A shrinking/growing reserved slot keeps every remaining book supported.
export function createBinderShelf(models,{left,right=null,leanSign=1,surface,gap=.004,animate,redraw}) {
  const order=[...models],cache=new Map(),up=new THREE.Vector3(0,0,1);
  let departing=null,departureAt=null;
  for(const model of order){
    const {group}=model,p=group.position.clone(),q=group.quaternion.clone();
    group.position.x=group.position.y=0;group.rotation.z=0;
    cache.set(model,{profile:standingProfile(group),basis:group.quaternion.clone(),z:p.z});
    group.position.copy(p);group.quaternion.copy(q);group.updateWorldMatrix(true,true);
  }
  function poses(lean=1,reserved=null,space=1){
    const result=new Map();let previous,rank=0,high=-Infinity;
    for(const model of order){
      const weight=model===reserved?space:1;if(weight<=0)continue;
      const saved=cache.get(model),angle=leanSign*THREE.MathUtils.degToRad(5+2.5*rank)*lean,c=Math.cos(angle),s=Math.sin(angle);
      const outline=saved.profile.map(p=>({x:p.x*c-p.y*s,y:p.x*s+p.y*c}));
      const lift=surface-Math.min(...outline.map(p=>p.y))+.001;
      const minX=Math.min(...outline.map(p=>p.x));
      for(const p of outline){p.y+=lift;p.x=minX+(p.x-minX)*weight;}
      let offset=left+gap-minX;
      if(previous){
        const bottom=Math.max(Math.min(...previous.map(p=>p.y)),Math.min(...outline.map(p=>p.y)));
        const top=Math.min(Math.max(...previous.map(p=>p.y)),Math.max(...outline.map(p=>p.y)));
        const heights=[bottom,top,...previous.map(p=>p.y),...outline.map(p=>p.y)].filter(y=>y>=bottom&&y<=top);
        offset=Math.max(...heights.map(y=>profileSpan(previous,y).high-profileSpan(outline,y).low+gap));
      }
      outline.forEach(p=>p.x+=offset);previous=outline;rank+=weight;
      high=Math.max(high,...outline.map(p=>p.x));
      result.set(model,{position:new THREE.Vector3(offset,lift,saved.z),rotation:new THREE.Quaternion().setFromAxisAngle(up,angle).multiply(saved.basis)});
    }
    if(right!==null&&Number.isFinite(high))for(const pose of result.values())pose.position.x+=right-high;
    return result;
  }
  function set(model,pose){
    model.group.position.copy(pose.position);model.group.quaternion.copy(pose.rotation);
    model.home.copy(pose.position);model.rotation.copy(pose.rotation);model.group.updateWorldMatrix(true,true);
  }
  function layout(lean,reserved=null,space=1){for(const [model,pose]of poses(lean,reserved,space))if(model!==reserved)set(model,pose);redraw();}
  async function take(model){
    departing=model;departureAt=null;
    const depths=new Map(order.map(m=>[m,m.group.position.z]));
    await animate('shelf-support',t=>{
      layout(1-t);
      for(const m of order)m.group.position.z=THREE.MathUtils.lerp(depths.get(m),cache.get(m).z,t);
    });
  }
  function leaving(model,u){
    if(!cache.has(model))return;
    if(departureAt===null){
      const front=Math.max(...order.filter(m=>m!==model).map(m=>m.outlineBounds.clone().applyMatrix4(m.group.matrixWorld).max.z));
      if(model.outlineBounds.clone().applyMatrix4(model.group.matrixWorld).min.z<=front+.055&&u<1)return;
      departureAt=u;
    }
    const t=u===1?1:THREE.MathUtils.smoothstep(u,departureAt,Math.min(.95,departureAt+.28));
    layout(t,model,1-t);
  }
  async function prepareReturn(model){
    if(!cache.has(model))return;
    await animate('shelf-support',t=>layout(1-t,model,t));
    const pose=poses(0).get(model);model.home.copy(pose.position);model.rotation.copy(pose.rotation);
  }
  async function restore(){await animate('shelf-support',t=>layout(t));departing=null;departureAt=null;}
  async function dragOut(model){
    await take(model);const start=model.group.position.clone();
    const front=Math.max(...order.map(m=>m.outlineBounds.clone().applyMatrix4(m.group.matrixWorld).max.z));
    const back=model.outlineBounds.clone().applyMatrix4(model.group.matrixWorld).min.z;
    model.dragDepth=front-back+.10;
    await animate('shelf-grab',t=>{model.group.position.copy(start);model.group.position.z+=model.dragDepth*t;redraw();});
  }
  function dragTo(model,x){
    const slots=poses(0),others=order.filter(m=>m!==model);
    const rank=others.filter(m=>x>slots.get(m).position.x).length,old=order.indexOf(model);
    if(rank!==old){
      order.splice(old,1);order.splice(rank,0,model);
      const target=poses(0),from=new Map(others.map(m=>[m,m.group.position.clone()]));
      animate('shelf-reorder',t=>{for(const m of others){const pose=target.get(m);set(m,{position:from.get(m).clone().lerp(pose.position,t),rotation:pose.rotation});}redraw();});
    }
    const limits=[...poses(0).values()].map(p=>p.position.x);
    model.group.position.x=THREE.MathUtils.clamp(x,Math.min(...limits)-.12,Math.max(...limits)+.12);redraw();
  }
  async function dragIn(model){
    const target=poses(0).get(model),from=model.group.position.clone();
    await animate('shelf-grab',t=>{model.group.position.lerpVectors(from,target.position,t);redraw();});
    set(model,target);await restore();delete model.dragDepth;
  }
  layout(1);
  return {has:model=>cache.has(model),take,leaving,prepareReturn,restore,dragOut,dragTo,dragIn,
    info:()=>({order:order.map(m=>m.project.id),departing:departing?.project.id||null,departureAt})};
}
