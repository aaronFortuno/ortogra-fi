import * as THREE from 'three';

// One point draw. Each mote traces back to the actual window and reuses the
// sun's existing shadow texture, so dust brightens only inside unblocked light.
export function createSunlitDust(scene,sun,aperture){
  const count=820,seeds=new Float32Array(count*3);let seed=7429;
  for(let i=0;i<seeds.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;seeds[i]=seed/4294967296;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(seeds,3));
  const uniforms={time:{value:0},light:{value:.12},pixelRatio:{value:1},
    sunDirection:{value:new THREE.Vector3()},sunPower:{value:0},sunColor:{value:sun.color},
    sunMap:{value:null},sunMatrix:{value:sun.shadow.matrix},sunReady:{value:0},
    windowCenter:{value:aperture.center},windowHalf:{value:aperture.half}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms,
    vertexShader:`
      #include <packing>
      uniform float time,light,pixelRatio,sunPower,sunReady;
      uniform vec3 sunDirection,sunColor,windowCenter;
      uniform vec2 windowHalf;
      uniform sampler2D sunMap;
      uniform mat4 sunMatrix;
      varying float moteAlpha;
      varying vec3 moteColor;
      float directLight(vec3 p){
        if(sunPower<.001||sunDirection.x>=-.015)return 0.;
        float t=(windowCenter.x-p.x)/sunDirection.x;if(t<=0.)return 0.;
        vec2 uv=abs((p+sunDirection*t-windowCenter).yz)/windowHalf;
        vec2 edge=1.-smoothstep(vec2(.82),vec2(1.),uv);
        float visibility=1.;
        if(sunReady>.5){
          vec4 h=sunMatrix*vec4(p,1.);vec3 q=h.xyz/h.w;
          if(q.z>=0.&&q.z<=1.&&all(greaterThanEqual(q.xy,vec2(0.)))&&all(lessThanEqual(q.xy,vec2(1.))))
            visibility=step(q.z-.00016,unpackRGBAToDepth(texture2D(sunMap,q.xy)));
        }
        return sunPower*edge.x*edge.y*visibility;
      }
      void main(){
        vec3 s=fract(position+vec3(.0012,.0022,.0009)*time);
        vec3 p=vec3(-.77+s.x*1.9,.79+s.y*.60,-.5+s.z*.94);
        p.x+=sin(time*.27+position.z*18.)*.020;p.z+=cos(time*.23+position.y*17.)*.022;
        float beam=directLight(p),illumination=light+beam*.92;
        moteAlpha=illumination*(.55+position.z*.45);
        moteColor=mix(vec3(.88,.91,.95),sunColor,beam/max(.001,illumination));
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((1.+position.z*1.7)*.72*(1.+beam*.18)/max(.18,-mv.z),1.6,6.5)*pixelRatio;
      }`,
    fragmentShader:`
      varying float moteAlpha;varying vec3 moteColor;
      void main(){float r=length(gl_PointCoord-.5)*2.;float a=exp(-r*r*2.3)*(1.-smoothstep(.55,1.,r))*moteAlpha;gl_FragColor=vec4(moteColor,a);}`,
  });
  const points=new THREE.Points(geometry,material);points.name='SeatedDust';points.frustumCulled=false;points.raycast=()=>{};
  points.onBeforeRender=()=>{
    uniforms.sunDirection.value.subVectors(sun.position,sun.target.position).normalize();
    uniforms.sunPower.value=sun.intensity/2.8;uniforms.sunMap.value=sun.shadow.map?.texture||null;
    uniforms.sunReady.value=sun.castShadow&&sun.shadow.map?1:0;
  };
  scene.add(points);return points;
}
