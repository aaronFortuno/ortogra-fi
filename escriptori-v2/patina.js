import * as THREE from 'three';

// Shared, irregular multiscale wear. Object coordinates keep it attached when
// materials move; face coordinates concentrate rubbing near the board edges.
export function addPatina(scene){
  const size=256,data=new Uint8Array(size*size*4);
  function hash(x,y,n){x=(x%n+n)%n;y=(y%n+n)%n;let h=Math.imul(x+191,n*157)^Math.imul(y+73,374761393);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
  function noise(x,y,n){const a=Math.floor(x),b=Math.floor(y);let u=x-a,v=y-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b,n),hash(a+1,b,n),u),THREE.MathUtils.lerp(hash(a,b+1,n),hash(a+1,b+1,n),u),v);}
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,a=noise(x/size*7,y/size*7,7),b=noise(x/size*23,y/size*23,23),c=noise(x/size*81,y/size*81,81);
    data[i]=255*(.65*a+.35*b);data[i+1]=255*(.50*b+.50*c);data[i+2]=255*(.55*b+.45*c);data[i+3]=255;
  }
  const field=new THREE.DataTexture(data,size,size);field.wrapS=field.wrapT=THREE.RepeatWrapping;field.needsUpdate=true;
  field.magFilter=THREE.LinearFilter;field.minFilter=THREE.LinearMipmapLinearFilter;field.generateMipmaps=true;
  const seen=new Set();
  scene.traverse(node=>{
    if(!node.isMesh)return;
    const name=node.material.name||'',wood=name.startsWith('Oak'),cloth=name.startsWith('Cloth_')||name==='BoxFabric',wall=name==='CornerPlaster',ceramic=/CornerCup|Ceramic/.test(name);
    if(!wood&&!cloth&&!wall&&!ceramic&&!/BookendSteel|StaplerEnamel/.test(name))return;
    if(!node.geometry.attributes.wearCoord){
      const geometry=node.geometry,positions=geometry.attributes.position,coords=new Float32Array(positions.count*3),p=new THREE.Vector3();geometry.computeBoundingBox();const min=geometry.boundingBox.min,size=geometry.boundingBox.getSize(new THREE.Vector3());
      for(let i=0;i<positions.count;i++){p.fromBufferAttribute(positions,i).sub(min);p.set(p.x/Math.max(size.x,.001),p.y/Math.max(size.y,.001),p.z/Math.max(size.z,.001));p.toArray(coords,i*3);}geometry.setAttribute('wearCoord',new THREE.BufferAttribute(coords,3));
    }
    for(const material of [].concat(node.material)){
      if(seen.has(material)||!material.isMeshStandardMaterial||material.transparent)continue;seen.add(material);
      let salt=37;for(const c of name)salt=(Math.imul(salt,31)+c.charCodeAt(0))>>>0;
      const offset=[(salt%179)/179,((salt>>>9)%163)/163],old=material.onBeforeCompile,key=material.customProgramCacheKey();
      material.onBeforeCompile=shader=>{
        old.call(material,shader);shader.uniforms.wearField={value:field};
        shader.vertexShader='attribute vec3 wearCoord;varying vec3 wearPosition;varying vec3 wearNormal;varying vec3 wearFace;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwearPosition=position;wearNormal=normal;wearFace=wearCoord;');
        shader.fragmentShader='uniform sampler2D wearField;varying vec3 wearPosition;varying vec3 wearNormal;varying vec3 wearFace;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          vec3 wn=abs(wearNormal);vec2 wearUV=wn.y>max(wn.x,wn.z)?wearPosition.xz:(wn.x>wn.z?wearPosition.zy:wearPosition.xy);
          vec2 faceUV=wn.y>max(wn.x,wn.z)?wearFace.xz:(wn.x>wn.z?wearFace.zy:wearFace.xy);
          vec2 wearOffset=vec2(${offset[0].toFixed(4)},${offset[1].toFixed(4)});
          vec3 wear=texture2D(wearField,wearUV*${cloth?'.37':wood?'.72':'1.9'}+wearOffset).rgb;
          vec3 pores=texture2D(wearField,wearUV*${cloth?'3.7':wood?'5.8':'9.1'}+wearOffset.yx+.31).rgb;
          float edge=min(min(faceUV.x,1.-faceUV.x),min(faceUV.y,1.-faceUV.y));
          float rubbed=(1.-smoothstep(.005,.055,edge))*smoothstep(.27,.69,wear.r);
          float handled=smoothstep(.47,.80,wear.r)*smoothstep(.35,.75,pores.g);
          diffuseColor.rgb*=.94+.10*wear.r;
          ${cloth?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.19,.14),rubbed*.13);':''}
          ${wood?'diffuseColor.rgb*=1.-handled*.065;':''}
          ${ceramic?'diffuseColor.rgb*=.90+.14*pores.r;':''}`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          roughnessFactor=clamp(${cloth?'.84+.12*pores.g-.10*rubbed':wood?'roughnessFactor+.10*wear.g-.18*handled-.10*rubbed':ceramic?'.87+.12*wear.g':'roughnessFactor+.12*(wear.g-.35)'},${ceramic?'.84':'.42'},1.);`);
        if(!cloth)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec3 wx=dFdx(-vViewPosition),wy=dFdy(-vViewPosition);vec3 wr1=cross(wy,normal),wr2=cross(normal,wx);
          float wd=dot(wx,wr1);float wh=pores.b*${wall?'.00016':wood?'.000025':'.000045'};
          normal=normalize(abs(wd)*normal-sign(wd)*(dFdx(wh)*wr1+dFdy(wh)*wr2));`);
      };
      material.customProgramCacheKey=()=>key+'-irregular-patina-2';material.needsUpdate=true;
      if(cloth){material.normalScale.set(.11,.11);material.sheen=.06;material.envMapIntensity=.25;}
      if(ceramic){material.roughness=.94;material.metalness=0;material.clearcoat=0;material.envMapIntensity=.10;material.color.set(name==='CornerCup'?'#b2aa97':'#a39680');}
    }
  });
  return field;
}
