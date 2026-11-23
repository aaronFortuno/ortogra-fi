import * as THREE from 'three';

// Small, depth-tested motes and four feathered scattering sheets. Reuse the
// existing solar/ceiling shadow maps; no depth copy, raymarch pass or new light.
export function createAirLight({scene,sun,roomLight,opening,weather}){
  const count=640,seeds=new Float32Array(count*3),traits=new Float32Array(count*2);
  let random=43179;const rand=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
  for(let i=0;i<count;i++){seeds.set([rand(),rand(),rand()],i*3);traits.set([rand(),rand()],i*2);}
  const origin=opening.getWorldPosition(new THREE.Vector3()),half=new THREE.Vector2((opening.userData.height||3.3)/2,(opening.userData.width||4.9)/2);
  const uniforms={
    airTime:{value:0},airScale:{value:1},airVisibility:{value:1},
    airWindow:{value:origin},airHalf:{value:half},airSun:{value:new THREE.Vector3()},airSunPower:{value:0},airSunColor:{value:new THREE.Color()},
    airRoom:{value:new THREE.Vector3()},airRoomDirection:{value:new THREE.Vector3()},airRoomPower:{value:0},airRoomCos:{value:Math.cos(roomLight.angle)},airRoomColor:{value:new THREE.Color()},
    airSunMap:{value:null},airSunMatrix:{value:sun.shadow.matrix},airSunReady:{value:0},
    airRoomMap:{value:null},airRoomMatrix:{value:roomLight.shadow.matrix},airRoomReady:{value:0},
    ...weather,
  };
  const lighting=`
    #include <packing>
    uniform vec3 airWindow,airSun,airSunColor,airRoom,airRoomDirection,airRoomColor;
    uniform vec2 airHalf;
    uniform float airSunPower,airRoomPower,airRoomCos,airVisibility;
    uniform sampler2D airSunMap,airRoomMap,deskCloudMap;
    uniform mat4 airSunMatrix,airRoomMatrix;
    uniform float airSunReady,airRoomReady;
    uniform vec2 deskCloudDrift;
    uniform vec3 deskCloudU,deskCloudV;
    float airShadow(sampler2D map,mat4 matrix,float ready,vec3 p){
      if(ready<.5)return 1.0;
      vec4 projected=matrix*vec4(p,1.0);vec3 q=projected.xyz/projected.w;
      if(q.z<0.0||q.z>1.0||any(lessThan(q.xy,vec2(0.0)))||any(greaterThan(q.xy,vec2(1.0))))return 1.0;
      return step(q.z-.0007,unpackRGBAToDepth(texture2D(map,q.xy)));
    }
    float airAperture(vec3 p){
      if(airSun.x>=-.015)return 0.0;
      float t=(airWindow.x-p.x)/airSun.x;if(t<=0.0)return 0.0;
      vec2 aperture=abs((p+airSun*t-airWindow).yz)/airHalf;
      vec2 edge=1.0-smoothstep(vec2(.78),vec2(1.0),aperture);
      return edge.x*edge.y*exp(-max(0.0,p.x-airWindow.x)*.06);
    }
    float airCloud(vec3 p){
      vec2 uv=vec2(dot(p,deskCloudU),dot(p,deskCloudV))*.045+deskCloudDrift;
      return mix(1.0,.38,smoothstep(.28,.72,texture2D(deskCloudMap,uv).r));
    }
    float airDirect(vec3 p){return airSunPower*airAperture(p)*airCloud(p)*airShadow(airSunMap,airSunMatrix,airSunReady,p);}
    float airCeiling(vec3 p){
      vec3 ray=p-airRoom;float cone=smoothstep(airRoomCos,min(.999,airRoomCos+.15),dot(normalize(ray),airRoomDirection));
      return airRoomPower*cone/(1.0+dot(ray,ray)*.016)*airShadow(airRoomMap,airRoomMatrix,airRoomReady,p);
    }
  `;
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(seeds,3));dustGeometry.setAttribute('trait',new THREE.BufferAttribute(traits,2));
  const bounds=new THREE.Box3(new THREE.Vector3(-7.7,-.2,.3),new THREE.Vector3(5.1,4.95,5.15));
  dustGeometry.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
  const dustMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
    vertexShader:lighting+`
      attribute vec2 trait;
      uniform float airTime,airScale;
      varying float moteAlpha;
      varying vec3 moteColor;
      void main(){
        float phase=trait.x*6.2831853;
        vec3 seed=fract(position+airTime*vec3(.00065,.00072,.00036)*( .65+trait.y*.7));
        vec3 p=vec3(-7.6+seed.x*12.5,-.05+seed.y*4.85,.4+seed.z*4.6);
        p.x+=sin(airTime*.17+phase)*.06+sin(airTime*.31-phase)*.018;
        p.y+=sin(airTime*.13+phase)*.025;
        p.z+=cos(airTime*.13+phase)*.055;
        float edge=smoothstep(0.0,.035,seed.y)*(1.0-smoothstep(.965,1.0,seed.y));
        edge*=smoothstep(0.0,.02,seed.x)*(1.0-smoothstep(.98,1.0,seed.x));
        edge*=smoothstep(0.0,.025,seed.z)*(1.0-smoothstep(.975,1.0,seed.z));
        float sunlight=airDirect(p),ceiling=airCeiling(p);
        float sky=airSunPower*.035,light=sunlight+ceiling*.34+sky;
        vec4 view=modelViewMatrix*vec4(p,1.0);float distance=-view.z;
        float nearFade=smoothstep(.5,1.4,distance)*(1.0-smoothstep(12.0,19.0,distance));
        moteAlpha=airVisibility*edge*nearFade*light*(.16+trait.y*.23)*(.8+.2*sin(phase+airTime*.27));
        moteColor=mix(airRoomColor,airSunColor,(sunlight+sky)/max(.0001,light))*1.65;
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp((.008+trait.y*trait.y*.010)*airScale/max(.3,distance),1.2,4.2);
      }`,
    fragmentShader:`
      varying float moteAlpha;varying vec3 moteColor;
      void main(){
        float r=length(gl_PointCoord-vec2(.5))*2.0;
        float alpha=moteAlpha*exp(-r*r*3.5)*(1.0-smoothstep(.65,1.0,r));
        if(alpha<.003)discard;gl_FragColor=vec4(moteColor,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dust=new THREE.Points(dustGeometry,dustMaterial);dust.name='FloatingDust';dust.raycast=()=>{};scene.add(dust);
  const beamGeometry=new THREE.BufferGeometry(),beamVertices=new Float32Array(48),beamUvs=[],beamIndices=[];
  for(let i=0;i<4;i++){const v=i*4;beamUvs.push(0,0,1,0,0,1,1,1);beamIndices.push(v,v+2,v+1,v+2,v+3,v+1);}
  beamGeometry.setAttribute('position',new THREE.BufferAttribute(beamVertices,3).setUsage(THREE.DynamicDrawUsage));
  beamGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(beamUvs,2));
  beamGeometry.setIndex(beamIndices);
  const beamMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 beamUv;varying vec3 beamWorld;void main(){beamUv=uv;beamWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:lighting+`
      varying vec2 beamUv;varying vec3 beamWorld;
      void main(){
        vec3 p=beamWorld;
        if(p.x<airWindow.x+.08||p.x>7.7||p.z< -1.63||p.z>5.1||p.y< -.5||p.y>6.7)discard;
        float feather=smoothstep(0.0,.28,beamUv.x)*(1.0-smoothstep(.72,1.0,beamUv.x));
        feather*=smoothstep(0.0,.10,beamUv.y)*(1.0-smoothstep(.62,1.0,beamUv.y))*smoothstep(-.5,.15,p.y);
        float facing=abs(dot(normalize(cross(dFdx(p),dFdy(p))),normalize(cameraPosition-p)));
        float alpha=airVisibility*airDirect(p)*feather*(.025+.045*facing);
        if(alpha<.001)discard;gl_FragColor=vec4(airSunColor*1.35,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const beam=new THREE.Mesh(beamGeometry,beamMaterial);beam.name='WindowLightScattering';beam.raycast=()=>{};scene.add(beam);
  const previous=new THREE.Vector3(Infinity,0,0),sunDirection=new THREE.Vector3(),frustum=new THREE.Frustum(),projection=new THREE.Matrix4();
  let fade=null,target=1,lastSeconds=0;
  function updateBeam(){
    const end=origin.clone().addScaledVector(sunDirection,-13);
    const axes=[new THREE.Vector3(0,0,half.y*.94),new THREE.Vector3(0,half.x*.94,0),
      new THREE.Vector3(0,half.x*.68,half.y*.68),new THREE.Vector3(0,-half.x*.68,half.y*.68)];
    for(let i=0;i<axes.length;i++)for(let j=0;j<4;j++){
      const p=(j<2?origin:end).clone().addScaledVector(axes[i],j%2?1:-1);beamVertices.set(p.toArray(),(i*4+j)*3);
    }
    beamGeometry.attributes.position.needsUpdate=true;beamGeometry.computeBoundingSphere();previous.copy(sunDirection);
  }
  return {
    sync({camera,height,pixelRatio,mobile,focused,time,reduced}){
      const next=focused?0:1;
      if(next!==target){target=next;fade={from:uniforms.airVisibility.value,start:time};}
      if(fade){const t=reduced?1:THREE.MathUtils.clamp((time-fade.start)/220,0,1);uniforms.airVisibility.value=THREE.MathUtils.lerp(fade.from,target,t*t*(3-2*t));if(t===1)fade=null;}
      sunDirection.subVectors(sun.position,sun.target.position).normalize();uniforms.airSun.value.copy(sunDirection);
      uniforms.airSunPower.value=THREE.MathUtils.clamp(sun.intensity/2.8,0,1);uniforms.airSunColor.value.copy(sun.color);
      uniforms.airRoom.value.copy(roomLight.position);uniforms.airRoomDirection.value.subVectors(roomLight.target.position,roomLight.position).normalize();
      uniforms.airRoomPower.value=THREE.MathUtils.clamp(roomLight.intensity/85,0,1);uniforms.airRoomColor.value.copy(roomLight.color);
      uniforms.airScale.value=height*pixelRatio/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
      for(const [light,map,matrix,ready]of [[sun,'airSunMap','airSunMatrix','airSunReady'],[roomLight,'airRoomMap','airRoomMatrix','airRoomReady']]){
        uniforms[map].value=light.shadow.map?.texture||null;uniforms[matrix].value=light.shadow.matrix;uniforms[ready].value=light.shadow.map?1:0;
      }
      if(previous.distanceToSquared(sunDirection)>1e-9)updateBeam();
      dustGeometry.setDrawRange(0,mobile?384:count);
      const visible=uniforms.airVisibility.value>.001;
      dust.visible=visible&&(uniforms.airSunPower.value>.002||uniforms.airRoomPower.value>.002);
      beam.visible=visible&&uniforms.airSunPower.value>.02&&sunDirection.x<-.015;
      projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
      return {moving:Boolean(fade),visible:dust.visible&&frustum.intersectsBox(bounds)};
    },
    update(seconds){lastSeconds=seconds;uniforms.airTime.value=seconds;},
    info:()=>({particles:dustGeometry.drawRange.count,dust:dust.visible,beam:beam.visible,opacity:uniforms.airVisibility.value,
      seconds:lastSeconds,sun:uniforms.airSunPower.value,room:uniforms.airRoomPower.value,direction:sunDirection.toArray(),
      bytes:seeds.byteLength+traits.byteLength+beamVertices.byteLength+beamGeometry.attributes.uv.array.byteLength+beamGeometry.index.array.byteLength}),
  };
}
