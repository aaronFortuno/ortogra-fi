import * as THREE from 'three';

// One small, shared field for pores, worn varnish and rubbed cloth. No new
// image downloads or per-frame texture uploads; coordinates stay on each object.
export function addPatina(scene){
  const size=256,data=new Uint8Array(size*size*4);let seed=8719;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const values=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)values[y*size+x]=.5+.15*Math.sin(x*.09+Math.sin(y*.07)*2)+.12*Math.cos(y*.13-x*.04)+(random()-.5)*.20;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,h=values[y*size+x],dx=values[y*size+(x+1)%size]-h,dy=values[((y+1)%size)*size+x]-h;
    data[i]=Math.round(255*h);data[i+1]=Math.round(255*(.30+h*.65));data[i+2]=Math.round(255*(.5+dx*.65+dy*.35));data[i+3]=255;
  }
  const field=new THREE.DataTexture(data,size,size);field.wrapS=field.wrapT=THREE.RepeatWrapping;field.needsUpdate=true;
  field.magFilter=THREE.LinearFilter;field.minFilter=THREE.LinearMipmapLinearFilter;field.generateMipmaps=true;
  const seen=new Set();
  scene.traverse(node=>{
    if(!node.isMesh)return;
    for(const material of [].concat(node.material)){
      if(seen.has(material)||!material.isMeshStandardMaterial||material.transparent)continue;seen.add(material);
      const name=material.name,wood=name.startsWith('Oak'),cloth=name.startsWith('Cloth_')||name==='BoxFabric',wall=name==='CornerPlaster';
      if(!wood&&!cloth&&!wall&&!/CornerCup|BookendSteel|StaplerEnamel|Ceramic/.test(name))continue;
      const old=material.onBeforeCompile,oldKey=material.customProgramCacheKey.bind(material),key=oldKey();
      material.onBeforeCompile=shader=>{
        old.call(material,shader);shader.uniforms.wearField={value:field};
        shader.vertexShader='varying vec3 wearPosition;\nvarying vec3 wearNormal;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwearPosition=position;wearNormal=normal;');
        shader.fragmentShader='uniform sampler2D wearField;\nvarying vec3 wearPosition;\nvarying vec3 wearNormal;\n'+shader.fragmentShader;
        // Choose the dominant object face, preserving grain when a binder moves.
        const scale=cloth?'2.6':wall?'3.8':wood?'4.2':'6.0';
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          vec3 wn=abs(wearNormal);vec2 wearUV=wn.y>max(wn.x,wn.z)?wearPosition.xz:(wn.x>wn.z?wearPosition.zy:wearPosition.xy);
          vec3 wear=texture2D(wearField,wearUV*${scale}).rgb;
          float rubbed=smoothstep(.50,.78,wear.r);
          diffuseColor.rgb*=mix(.92,1.04,wear.r);
          ${cloth?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.47,.43,.34),rubbed*.10);':''}`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          roughnessFactor=clamp(roughnessFactor+${wood?'-.24*rubbed+.15*(wear.g-.4)':cloth?'-.14*rubbed+.14*wear.g':'.16*(wear.g-.4)'},.32,1.);`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec3 wx=dFdx(-vViewPosition),wy=dFdy(-vViewPosition);vec3 wr1=cross(wy,normal),wr2=cross(normal,wx);
          float wd=dot(wx,wr1);float wh=wear.b*${wall?'.00025':wood?'.00006':'.00003'};
          normal=normalize(abs(wd)*normal-sign(wd)*(dFdx(wh)*wr1+dFdy(wh)*wr2));`);
      };
      material.customProgramCacheKey=()=>key+'-corner-patina-1';material.needsUpdate=true;
      if(cloth){material.normalScale.multiplyScalar(.8);material.sheen=.14;material.envMapIntensity=.4;}
    }
  });
  return field;
}
