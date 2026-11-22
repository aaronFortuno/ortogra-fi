// Temporary, local diagnostics. Count actual scene renders rather than running
// a second animation loop, and never query/stall the GPU to time a frame.
export function createPerformanceMonitor(renderer){
  const button=document.querySelector('#performance-toggle'),panel=document.querySelector('#performance-panel');
  const fps=button.querySelector('[data-performance-fps]'),memory=button.querySelector('[data-performance-memory]');
  const fields=Object.fromEntries([...panel.querySelectorAll('[data-performance-value]')].map(n=>[n.dataset.performanceValue,n]));
  const number=new Intl.NumberFormat('ca',{maximumFractionDigits:1}),integer=new Intl.NumberFormat('ca',{maximumFractionDigits:0});
  let timer=null,ready=false,lost=false,frames=0,cpu=0,frameStart=0,since=performance.now(),latest=null;
  function reset(){frames=0;cpu=0;since=performance.now();}
  function sample(){
    if(!ready||document.hidden||lost)return;
    const seconds=Math.max(.001,(performance.now()-since)/1000),rate=Math.round(frames/seconds),average=frames?cpu/frames:null;
    fps.textContent=frames?integer.format(rate)+' FPS':'Repòs';
    fields.fps.textContent=integer.format(rate)+(frames?' FPS':' FPS · en repòs');
    fields.cpu.textContent=average===null?'—':number.format(average)+' ms';
    const used=performance.memory?.usedJSHeapSize;
    const hasMemory=Number.isFinite(used)&&used>0;
    memory.hidden=!hasMemory;memory.textContent=hasMemory?'JS '+integer.format(used/1048576)+' MB':'';
    fields.memory.textContent=hasMemory?number.format(used/1048576)+' MB aprox.':'No disponible';
    if(latest){
      fields.calls.textContent=integer.format(latest.calls);fields.triangles.textContent=integer.format(latest.triangles);
      fields.geometries.textContent=integer.format(latest.geometries);fields.textures.textContent=integer.format(latest.textures);
    }
    reset();
  }
  function stop(){clearInterval(timer);timer=null;}
  function resume(){stop();reset();if(ready&&!document.hidden&&!lost)timer=setInterval(sample,1000);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();fps.textContent='Pausat';}else resume();});
  window.addEventListener('pagehide',stop);window.addEventListener('pageshow',resume);
  renderer.domElement.addEventListener('webglcontextlost',()=>{lost=true;stop();fps.textContent='Pausat';});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;resume();});
  return {
    begin(){frameStart=performance.now();},
    end(){
      if(!ready){ready=true;resume();}
      frames++;cpu+=performance.now()-frameStart;
      latest={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
        geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
    },
  };
}
