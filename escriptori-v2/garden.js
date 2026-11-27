import * as THREE from 'three';

// The existing photograph is only a distant backdrop. Branches and clusters
// occupy two real depths; the small head-linked offset is deliberately stylised.
export function createGarden(scene,backdrop,reduced){
  backdrop.geometry.dispose();backdrop.geometry=new THREE.PlaneGeometry(11,14.6667);backdrop.position.set(-4.8,3,.5);
  scene.background=new THREE.Color('#aebdca');
  const root=new THREE.Group();root.name='LayeredGarden';scene.add(root);
  const layers=[],uniforms=[],dummy=new THREE.Object3D();let seed=19473;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.translate(64,64);
  for(let i=0;i<13;i++){ctx.save();ctx.rotate(random()*Math.PI*2);ctx.translate((random()-.5)*70,(random()-.5)*52);ctx.fillStyle=['#778651','#8b9862','#a0a26b','#657b4a'][i%4];ctx.beginPath();ctx.ellipse(0,0,9+random()*10,4+random()*6,random(),0,Math.PI*2);ctx.fill();ctx.restore();}
  const leafMap=new THREE.CanvasTexture(canvas);leafMap.colorSpace=THREE.SRGBColorSpace;leafMap.magFilter=THREE.LinearFilter;
  const bark=new THREE.MeshStandardMaterial({color:'#625c43',roughness:.97});
  for(let layer=0;layer<2;layer++){
    const group=new THREE.Group();group.position.set(layer?-2.15:-1.26,0,layer?.20:.75);root.add(group);layers.push(group);
    const count=layer?40:65,material=new THREE.MeshStandardMaterial({map:leafMap,alphaTest:.42,side:THREE.DoubleSide,roughness:1,color:layer?'#a0ad87':'#c1bd87',emissive:'#65734d',emissiveIntensity:.12,envMapIntensity:.15});
    material.onBeforeCompile=shader=>{
      shader.uniforms.gardenTime={value:0};uniforms.push(shader.uniforms.gardenTime);
      shader.vertexShader='uniform float gardenTime;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=sin(gardenTime*1.7+instanceMatrix[3].y*11.+instanceMatrix[3].z*7.)*.035*(position.y+.5);');
    };material.customProgramCacheKey=()=> 'corner-leaves-wind-v1';
    const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,count);leaves.name='GardenLeaves_'+layer;leaves.raycast=()=>{};group.add(leaves);
    const paths=[new THREE.CatmullRomCurve3([new THREE.Vector3(.04,.25,1.1),new THREE.Vector3(.01,1.0,.6),new THREE.Vector3(-.04,1.7,.28),new THREE.Vector3(-.08,2.5,-.5)])];
    for(let i=0;i<3;i++){
      const from=paths[0].getPoint(.30+i*.20),sign=i%2?1:-1;
      paths.push(new THREE.CatmullRomCurve3([from,from.clone().add(new THREE.Vector3(.02,.22,sign*.35)),from.clone().add(new THREE.Vector3(-.03,.42,sign*.75)),from.clone().add(new THREE.Vector3(-.08,.62,sign*1.05))]));
    }
    for(let i=0;i<count;i++){
      const p=paths[i%paths.length].getPoint(.25+random()*.75);dummy.position.copy(p).add(new THREE.Vector3((random()-.5)*.28,(random()-.5)*.24,(random()-.5)*.28));
      dummy.rotation.set((random()-.5)*.8,Math.PI/2+(random()-.5)*1.2,random()*Math.PI);dummy.scale.setScalar(.15+random()*.18);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
    }
    for(const [i,path]of paths.entries()){const branch=new THREE.Mesh(new THREE.TubeGeometry(path,12,i?.006:.013,5,false),bark);branch.raycast=()=>{};group.add(branch);}
  }
  const euler=new THREE.Euler(0,0,0,'YXZ');
  return {root,
    tick(time,camera){
      for(const u of uniforms)u.value=reduced.matches?0:time;
      euler.setFromQuaternion(camera.quaternion);layers[0].position.z=.75+THREE.MathUtils.clamp(euler.y*.045,-.055,.055);layers[0].position.y=THREE.MathUtils.clamp((euler.x+.46)*.025,-.025,.025);
      layers[1].position.z=.20+THREE.MathUtils.clamp(euler.y*.015,-.02,.02);
    },
    setDay(day){backdrop.material.color.setScalar(.001+.999*day);scene.background.set('#aebdca').multiplyScalar(.002+.998*day);root.visible=day>.04;},
    info:()=>({depths:[backdrop.position.x,...layers.map(l=>l.position.x)],offsets:layers.map(l=>l.position.toArray())}),
  };
}
