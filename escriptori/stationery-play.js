import * as THREE from 'three';
import { prepareStapler } from './stapler-mechanism.js?v=1.19.0';
import { createPaperSlot } from './stapler-paper.js?v=1.21.0';
import { createPaperLinks } from './paper-links.js?v=1.20.0';

// Deliberate, quick reversals rather than a long drag or tiny pointer jitter.
export function recordShake(grip,event){
  const now=event.timeStamp,position=new THREE.Vector2(event.clientX,event.clientY);
  let s=grip.shake;
  if(!s||now-s.start>1800)s=grip.shake={start:now,last:position.clone(),time:now,stroke:new THREE.Vector2(),turns:0,path:0};
  const delta=position.clone().sub(s.last),dt=Math.max(1,now-s.time),length=delta.length();
  s.last.copy(position);s.time=now;
  if(length<1.5||length/dt<.18)return false;
  s.path+=length;
  if(s.stroke.length()>20&&delta.clone().normalize().dot(s.stroke.clone().normalize())<-.55){s.turns++;s.stroke.copy(delta);}
  else s.stroke.add(delta);
  return s.turns>=5&&s.path>=(event.pointerType==='touch'?200:300);
}

export function createStationeryPlay({room,items,fallen,register,remove,refresh,refreshItem,invalidate,land,setWorld,supportPlan,redraw,reduced,sound,action,surface,floor}){
  const stapler=items.find(i=>i.node.name==='DeskStapler'),pressPivot=stapler?prepareStapler(stapler.node):null;
  let press=null,serial=0,geometry,material;
  const loose=[],flights=new Set(),down=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster();
  // Face the mouth towards the usable desktop instead of its left edge.
  if(stapler){stapler.node.rotation.y=.48;stapler.rotation.copy(stapler.node.quaternion);refreshItem(stapler);}
  const slot=stapler?createPaperSlot({room,stapler,items,reduced,refreshItem,refresh,invalidate,land,setWorld,supportPlan,redraw}):null;
  const links=createPaperLinks({items,fallen,refreshItem,invalidate,setWorld,supportPlan,reduced,redraw,surface,floor});
  function staple(){
    if(!geometry){
      const points=[[-.012,-.004,.027],[-.054,-.004,.012],[-.055,.003,0],[.055,.003,0],[.054,-.004,.012],[.012,-.004,.027]];
      geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal'),22,.0032,5,false);
      material=new THREE.MeshStandardMaterial({color:'#c2c7c3',metalness:.85,roughness:.28});
    }
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
  }
  function mouth(){return stapler.node.localToWorld(new THREE.Vector3(0,.075,.315));}
  function papersAtMouth(){
    const center=mouth(),ends=[-.048,.048].map(x=>stapler.node.localToWorld(new THREE.Vector3(x,.075,.315)));
    const matches=[];
    for(const item of items){
      if(!item.sheet||item.sheet.crumpled||fallen.has(item)||item.drop)continue;
      const heights=[];
      for(const p of [center,...ends]){
        ray.set(new THREE.Vector3(p.x,center.y+.018,p.z),down);ray.far=.16;
        const h=ray.intersectObject(item.node,false)[0];if(h)heights.push(h.point.y);
      }
      if(heights.length===3)matches.push({item,y:Math.max(...heights)});
    }
    matches.sort((a,b)=>b.y-a.y);
    return matches.filter(m=>matches[0].y-m.y<.055);
  }
  function emit(){
    const matches=papersAtMouth();sound('staple','metal');
    if(matches.length){
      const page=matches[0].item,p=mouth();
      ray.set(new THREE.Vector3(p.x,p.y+.018,p.z),down);ray.far=.16;
      const hit=ray.intersectObject(page.node,false)[0];if(!hit)return;
      p.y=hit.point.y+.0015;
      const local=page.node.worldToLocal(p.clone());
      const attached=page.node.children.filter(n=>n.name.startsWith('AttachedStaple_'));
      if(attached.length<12&&!attached.some(n=>n.position.distanceTo(local)<.085)){
        const mesh=staple();mesh.name='AttachedStaple_'+(++serial);page.node.add(mesh);mesh.position.copy(local);
        mesh.quaternion.copy(page.node.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(stapler.node.getWorldQuaternion(new THREE.Quaternion())));
        page.sheet.follow(mesh);
      }
      const bundle=links.connect(matches.map(m=>({item:m.item,point:new THREE.Vector3(p.x,m.y+.0015,p.z)})));
      for(const item of bundle.pages){refreshItem(item);invalidate(item);}
      action('grapa',{fulls:bundle.pages.length});
    }else{
      if(loose.length>=24){const old=loose.shift();flights.delete(old);remove(old);}
      const mesh=staple();mesh.name='LooseStaple_'+(++serial);room.add(mesh);mesh.position.copy(mouth());
      mesh.quaternion.copy(stapler.node.getWorldQuaternion(new THREE.Quaternion()));
      const item=register(mesh,'metal',.015),from=mesh.position.clone();
      const direction=new THREE.Vector3((serial%3-1)*.12,0,1).transformDirection(stapler.node.matrixWorld);
      const to=from.clone().addScaledVector(direction,.27+(serial%4)*.035);
      to.y=stapler.solid.min.y+.008;item.flight={from,to,start:performance.now()};
      flights.add(item);loose.push(item);action('grapa',{fulls:0});
      if(reduced.matches){mesh.position.copy(to);item.flight=null;flights.delete(item);refreshItem(item);land(item);}
    }
    redraw();
  }
  function finishPress(){if(!press)return;if(!press.emitted)emit();pressPivot.rotation.x=0;pressPivot.userData.magazine.rotation.x=0;press=null;stapler.busy=false;refresh();}
  function finishFlights(){for(const item of flights){item.node.position.copy(item.flight.to);item.flight=null;refreshItem(item);land(item);}flights.clear();}
  return {
    resolve:item=>item,
    members:links.members,
    joints:links.info,
    updateLinks:links.update,
    deformed:links.changed,
    resupported:links.resupported,
    prepareRecovery:links.prepareRecovery,
    recovered:links.recovered,
    pack:links.pack,
    preview:(item,point)=>slot?.preview(item,point),
    cancelPreview:item=>slot?.cancel(item),
    release(item){const inserted=slot?.release(item);links.release(item);return inserted;},
    detach(item){for(const p of links.members(item))slot?.detach(p);links.grab(item);},
    hold:item=>slot?.hold(item),
    tap(item){
      if(item!==stapler){links.grab(item);links.release(item);return false;}
      if(press)return true;
      press={start:performance.now(),emitted:false};stapler.busy=true;
      if(reduced.matches)finishPress();redraw();return true;
    },
    shake(item,event,grip){
      if(!item.sheet||item.sheet.crumpled||!recordShake(grip,event))return false;
      slot?.cancel(item);
      item.sheet.crumple(reduced.matches);item.kind='paperball';item.velocity.set(0,0,0);item.spin=0;
      links.changed(item);
      invalidate(item);sound('crumple','paper');action('rebrega_full',{objecte:item.node.name});redraw();return true;
    },
    finish(){finishPress();finishFlights();slot?.finish();links.settle();},
    update(time){
      let moving=slot?.update(time)||false;
      if(press){
        const t=Math.min(1,Math.max(0,(time-press.start)/220));pressPivot.rotation.x=.19*Math.sin(Math.PI*t);
        pressPivot.userData.magazine.rotation.x=.103*Math.sin(Math.PI*t);
        if(t>=.45&&!press.emitted){press.emitted=true;emit();}
        if(t===1)finishPress();else refreshItem(stapler);moving=true;
      }
      for(const item of flights){
        const f=item.flight,t=Math.min(1,Math.max(0,(time-f.start)/220));
        item.node.position.copy(f.from).lerp(f.to,t);item.node.position.y+=Math.sin(Math.PI*t)*.11;
        item.node.rotateY(.08*(1-t));refreshItem(item);
        if(t===1){item.flight=null;flights.delete(item);land(item);}moving=true;
      }
      return moving;
    },
  };
}
