import * as THREE from 'three';

// At most five independent paper bodies, joined at material points. No scene
// parent is used as a rigid surrogate for stapled sheets.
export function createPaperLinks({items,fallen,refreshItem,invalidate,setWorld,supportPlan,reduced,redraw,surface,floor}){
  const bundles=new Set(),up=new THREE.Vector3(0,1,0);let serial=0,lastTime;
  const members=item=>item.bundle?.pages||[item];
  function wake(item,fresh=false){
    const b=item?.bundle;if(!b)return;
    b.until=performance.now()+650;
    if(fresh)for(const state of b.states.values())state.contact=null;
    redraw();
  }
  function rest(item,bundle){
    const state=bundle.states.get(item),position=item.node.getWorldPosition(new THREE.Vector3());
    if(bundle.floor){
      if(bundle.fall&&bundle.leader.drop)position.y=bundle.fall.heights.get(item)+bundle.leader.node.getWorldPosition(new THREE.Vector3()).y-bundle.fall.y;
      else position.y+=floor+.002-item.solid.min.y;
      setWorld(item.node,position);
      if(!item.sheet.crumpled)item.sheet.flatten(reduced.matches);refreshItem(item);return;
    }
    const q=item.node.quaternion;
    if(!state.contact||Math.hypot(position.x-state.contact.x,position.z-state.contact.z)>.085||q.angleTo(state.contact.q)>.10){
      const plan=supportPlan(item);state.contact={x:position.x,z:position.z,q:q.clone(),plan};
      if(!item.sheet.crumpled)item.sheet.target(plan.values,reduced.matches);item.supports=plan.supports;
    }
    position.y=state.contact.plan.y+bundle.pages.indexOf(item)*.002;setWorld(item.node,position);refreshItem(item);
  }
  function gap(link){return link.gap.clone().applyQuaternion(link.a.node.getWorldQuaternion(new THREE.Quaternion()).multiply(link.rotation.clone().invert()));}
  function rotateAround(item,pin,axis,angle){
    const before=pin.world();item.node.rotateOnWorldAxis(axis,angle);item.node.updateWorldMatrix(true,false);
    setWorld(item.node,item.node.getWorldPosition(new THREE.Vector3()).add(before.sub(pin.world())));refreshItem(item);
  }
  function solve(bundle,held,dt){
    const leader=held&&bundle.pages.includes(held)?held:bundle.leader;
    bundle.leader=leader;
    if(held){bundle.floor=false;bundle.fall=null;}
    else if(fallen.has(leader)||leader.drop?.isFloor){
      if(!bundle.floor)bundle.fall={y:leader.node.getWorldPosition(new THREE.Vector3()).y,heights:new Map(bundle.pages.map(p=>[p,p.node.getWorldPosition(new THREE.Vector3()).y]))};
      bundle.floor=true;
    }
    const protectedBody=i=>i===held||i.docked||i.busy||i.slide||i.drop;
    const depth=new Map([[leader,0]]),queue=[leader];let moving=false;
    // Traverse from the page being held; any page may become the driver.
    for(let k=0;k<queue.length;k++){
      const fixed=queue[k];
      for(const link of bundle.links){
        const other=link.a===fixed?link.b:link.b===fixed?link.a:null;if(!other||depth.has(other))continue;
        depth.set(other,depth.get(fixed)+1);queue.push(other);
        const fixedPin=link.a===fixed?link.pa:link.pb,freePin=link.a===other?link.pa:link.pb;
        const target=fixedPin.world(true).addScaledVector(gap(link),link.a===fixed?1:-1);
        const state=bundle.states.get(other),current=freePin.world(true),center=other.solid.getCenter(new THREE.Vector3());
        const velocity=state.anchor?target.clone().sub(state.anchor).divideScalar(Math.max(.008,dt)).clampLength(0,4):new THREE.Vector3();
        state.anchor=target.clone();
        if(!protectedBody(other)){
          const lever=current.clone().sub(center),torque=(lever.z*velocity.x-lever.x*velocity.z)/(.15+lever.x*lever.x+lever.z*lever.z);
          state.omega=THREE.MathUtils.clamp((state.omega+torque*18*dt)*Math.exp(-7*dt),-3.2,3.2);
          if(Math.abs(state.omega)>.008){rotateAround(other,freePin,up,state.omega*dt);moving=true;}
          // Crumpled sheets can swivel around the staple to sit beside one
          // another, rather than occupying the same small sphere.
          if(other.sheet.crumpled&&fixed.sheet.crumpled){
            const pivot=freePin.world(),c=other.node.localToWorld(other.sheet.ballCenter.clone());
            const away=pivot.clone().sub(fixed.node.localToWorld(fixed.sheet.ballCenter.clone()));away.y=Math.max(0,away.y);
            if(away.lengthSq()<1e-8)away.set(1,.2,0);away.normalize();
            const arm=c.sub(pivot).normalize(),turn=new THREE.Quaternion().setFromUnitVectors(arm,away);
            const partial=new THREE.Quaternion().slerp(turn,reduced.matches?1:Math.min(1,dt*9));
            const before=freePin.world();other.node.quaternion.premultiply(partial);other.node.updateWorldMatrix(true,false);
            setWorld(other.node,other.node.getWorldPosition(new THREE.Vector3()).add(before.sub(freePin.world())));
            if(1-Math.abs(partial.w)>1e-6)moving=true;
          }
          const delta=target.clone().sub(freePin.world(true));delta.y=0;
          if(delta.lengthSq()>1e-9){setWorld(other.node,other.node.getWorldPosition(new THREE.Vector3()).add(delta));moving=true;}
          refreshItem(other);rest(other,bundle);
          if(velocity.length()>1.2&&Math.abs(state.omega)>.6&&other.sheet.rumple(velocity.length()*dt*.22))moving=true;
        }
      }
    }
    const constraints=new Map(bundle.pages.map(i=>[i,[]]));
    for(const link of bundle.links){
      const g=gap(link),a=link.pa.world(true),b=link.pb.world(true);
      const target=(depth.get(link.a)<=depth.get(link.b)?a:b.clone().sub(g));
      target.y=Math.max(a.y,b.y-g.y);
      constraints.get(link.a).push({pin:link.pa,target:target.clone()});
      constraints.get(link.b).push({pin:link.pb,target:target.clone().add(g)});
    }
    for(const item of bundle.pages){
      if(item.sheet.setPins(constraints.get(item))){refreshItem(item);invalidate(item);moving=true;}
      if(bundle.floor&&!leader.drop&&fallen.has(leader)&&!item.drop&&!held)fallen.add(item);
      if(held&&item.solid.min.y>floor+.15)fallen.delete(item);
    }
    return moving;
  }
  return {
    members,
    connect(matches){
      const selected=matches.map(m=>m.item),previous=new Set(selected.map(i=>i.bundle).filter(Boolean));
      const pages=[...new Set(selected.flatMap(members))];if(pages.length<2)return {pages};
      let bundle=[...previous][0];
      if(!bundle){bundle={id:'StapledWorksheets_'+(++serial),pages:[],links:[],states:new Map(),leader:selected[0],until:0,floor:false};bundles.add(bundle);}
      for(const old of previous)if(old!==bundle){bundle.links.push(...old.links);for(const [p,state]of old.states)bundle.states.set(p,state);bundles.delete(old);}
      bundle.pages=pages;
      for(const item of pages){
        item.bundle=bundle;
        if(!bundle.states.has(item))bundle.states.set(item,{omega:0,anchor:null,contact:null});
        item.supports=new Set([...item.supports].filter(s=>!pages.includes(s)));
      }
      const first=matches[0];
      for(const match of matches.slice(1)){
        const a=first.item,b=match.item;
        if(bundle.links.filter(l=>l.a===a||l.b===a).length>=12||bundle.links.filter(l=>l.a===b||l.b===b).length>=12)continue;
        const pa=a.sheet.pin(a.node.worldToLocal(first.point.clone())),pb=b.sheet.pin(b.node.worldToLocal(match.point.clone()));
        if(bundle.links.some(l=>l.a===a&&l.b===b&&l.pa.local().distanceTo(pa.local())<.07&&l.pb.local().distanceTo(pb.local())<.07||
          l.a===b&&l.b===a&&l.pb.local().distanceTo(pa.local())<.07&&l.pa.local().distanceTo(pb.local())<.07))continue;
        bundle.links.push({a,b,pa,pb,gap:pb.world().sub(pa.world()),rotation:a.node.getWorldQuaternion(new THREE.Quaternion())});
      }
      return bundle;
    },
    grab(item){
      const b=item.bundle;if(!b)return;b.leader=item;b.floor=false;
      for(const p of b.pages){p.drop=null;p.velocity.set(0,0,0);p.spin=0;b.states.get(p).anchor=null;b.states.get(p).contact=null;}
      wake(item);
    },
    release(item){if(reduced.matches&&item.bundle)for(const state of item.bundle.states.values())state.omega=0;wake(item,true);},
    changed:item=>wake(item),
    resupported:item=>wake(item,true),
    prepareRecovery(){for(const item of [...fallen])for(const p of members(item))fallen.add(p);},
    recovered(){
      for(const b of bundles){if(b.pages.some(p=>fallen.has(p)))continue;b.floor=false;b.fall=null;for(const p of b.pages){b.states.get(p).anchor=null;b.states.get(p).contact=null;p.sheet.setPins([]);}wake(b.leader);}
    },
    settle(){for(const b of bundles)for(const p of b.pages){b.states.get(p).omega=0;b.states.get(p).anchor=null;}},
    async pack(item,animate){
      const b=item.bundle;if(!b)return;
      const leader=b.pages.find(p=>!p.sheet.crumpled)||b.leader;
      const orientations=new Map(b.pages.map(p=>[p,p.node.quaternion.clone()])),target=leader.node.quaternion.clone();
      for(const p of b.pages){p.slide=true;p.drop=null;p.velocity.set(0,0,0);p.spin=0;p.sheet.flatten(reduced.matches);p.sheet.relaxPins(reduced.matches);}
      await animate('stack-papers',t=>{
        const ready=new Set([leader]),queue=[leader];
        for(let k=0;k<queue.length;k++)for(const link of b.links){
          const fixed=queue[k],other=link.a===fixed?link.b:link.b===fixed?link.a:null;if(!other||ready.has(other))continue;
          const fixedPin=link.a===fixed?link.pa:link.pb,freePin=link.a===other?link.pa:link.pb;
          if(!other.sheet.crumpled)other.node.quaternion.copy(orientations.get(other)).slerp(target,t);
          other.node.updateWorldMatrix(true,false);
          const desired=fixedPin.world().addScaledVector(gap(link),link.a===fixed?1:-1);
          setWorld(other.node,other.node.getWorldPosition(new THREE.Vector3()).add(desired.sub(freePin.world())));
          refreshItem(other);ready.add(other);queue.push(other);
        }
        refreshItem(leader);redraw();
      },220);
      for(const p of b.pages){p.slide=false;b.states.get(p).omega=0;b.states.get(p).anchor=null;b.states.get(p).contact=null;}
      b.leader=leader;
    },
    update(time,held){
      const dt=lastTime===undefined?1/60:Math.min(.033,Math.max(.001,(time-lastTime)/1000));lastTime=time;let moving=false;
      for(const b of bundles){
        if(b.pages.some(p=>p.slide||p.busy)||b.pages.every(p=>p.docked))continue;
        const active=held&&b.pages.includes(held)||time<b.until||b.pages.some(p=>p.drop||p.sheet.changing||p.velocity.lengthSq()>1e-5);
        if(!active)continue;
        const did=solve(b,held,dt);moving=did||moving;
        if(b.pages.some(p=>Math.abs(b.states.get(p).omega)>.012))b.until=Math.max(b.until,time+120);
      }
      return moving;
    },
    info(){return [...bundles].map(b=>({id:b.id,pages:b.pages.map(p=>p.node.name),moving:b.pages.some(p=>Math.abs(b.states.get(p).omega)>.02||p.drop||p.sheet.changing),links:b.links.map(l=>({a:l.a.node.name,b:l.b.node.name,distance:l.pa.world().add(gap(l)).distanceTo(l.pb.world())}))}));},
  };
}
