import * as THREE from 'three';

// One scene render plus a single output triangle. The centre samples once;
// only the periphery blends nearby pixels. No depth/geometry prepass or bokeh.
export function createPeripheralFocus(renderer){
  const available=renderer.extensions.has('EXT_color_buffer_float');let enabled=available,active=false,target,width=1,height=1;
  try{enabled=available&&localStorage.getItem('ortografi-desk-focus')!=='off';}catch{/* Session only. */}
  const uniforms={image:{value:null},texel:{value:new THREE.Vector2(1,1)},radius:{value:2.2},toneMappingExposure:{value:1}};
  const material=new THREE.RawShaderMaterial({name:'PeripheralFocus',depthTest:false,depthWrite:false,uniforms,
    vertexShader:'precision highp float;attribute vec3 position;attribute vec2 uv;varying vec2 screenUV;void main(){screenUV=uv;gl_Position=vec4(position,1.);}',
    fragmentShader:`precision highp float;
      uniform sampler2D image;uniform vec2 texel;uniform float radius;varying vec2 screenUV;
      #include <tonemapping_pars_fragment>
      #include <colorspace_pars_fragment>
      void main(){
        float edge=smoothstep(.26,.67,length((screenUV-.5)*vec2(1.,1.18)));
        vec3 color=texture2D(image,screenUV).rgb;
        if(edge>.002){
          vec2 d=texel*radius*edge;
          color*=.28;
          color+=(texture2D(image,screenUV+vec2(d.x,0.)).rgb+texture2D(image,screenUV-vec2(d.x,0.)).rgb+texture2D(image,screenUV+vec2(0.,d.y)).rgb+texture2D(image,screenUV-vec2(0.,d.y)).rgb)*.12;
          color+=(texture2D(image,screenUV+d).rgb+texture2D(image,screenUV-d).rgb+texture2D(image,screenUV+vec2(d.x,-d.y)).rgb+texture2D(image,screenUV+vec2(-d.x,d.y)).rgb)*.06;
        }
        gl_FragColor=sRGBTransferOETF(vec4(AgXToneMapping(color),1.));
      }`,
  });
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,0,2],2));
  const output=new THREE.Scene(),camera=new THREE.Camera(),triangle=new THREE.Mesh(geometry,material);triangle.frustumCulled=false;output.add(triangle);
  function ensureTarget(){
    target??=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthBuffer:true,stencilBuffer:false,samples:0});uniforms.image.value=target.texture;
  }
  return {
    resize(w,h){width=w;height=h;target?.setSize(w,h);uniforms.texel.value.set(1/w,1/h);uniforms.radius.value=w<700?1.35:2.2;},
    setEnabled(value){enabled=available&&value;if(!enabled&&target){target.dispose();target=null;uniforms.image.value=null;}return enabled;},get enabled(){return enabled;},get available(){return available;},
    async compile(scene,view){
      if(!enabled)return renderer.compileAsync(scene,view);
      ensureTarget();renderer.setRenderTarget(target);try{await renderer.compileAsync(scene,view);}finally{renderer.setRenderTarget(null);}await renderer.compileAsync(output,camera);
    },
    render(scene,view,reading){
      active=enabled&&!reading;
      if(!active){renderer.setRenderTarget(null);renderer.render(scene,view);return;}
      ensureTarget();uniforms.toneMappingExposure.value=renderer.toneMappingExposure;
      const reset=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();
      try{renderer.setRenderTarget(target);renderer.render(scene,view);renderer.setRenderTarget(null);renderer.render(output,camera);}
      finally{renderer.setRenderTarget(null);renderer.info.autoReset=reset;}
    },
    info:()=>({available,enabled,active,passes:active?1:0,buffer:target?[width,height]:null}),
  };
}
