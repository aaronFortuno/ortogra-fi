// Recorded indoor foley shares the exterior's AudioContext and mute control,
// but never passes through the window filter. Sources and edits ship locally.
export function objectAudio(context) {
  const base=new URL('../assets/desk/audio/foley/',import.meta.url),buffers=new Map(),voices=new Set();
  let generation=0;
  const ready=(async()=>{
    const response=await fetch(new URL('manifest.json?v=1.19.0',base));if(!response.ok)return;
    const manifest=await response.json();
    await Promise.allSettled(manifest.clips.map(async clip=>{
      const audio=await fetch(new URL(clip.file+'?v='+clip.sha256.slice(0,12),base));if(!audio.ok)return;
      buffers.set(clip.id,await context.decodeAudioData(await audio.arrayBuffer()));
    }));
  })().catch(()=>{});
  function choose(action,material){
    if(action==='staple')return ['stapler',.9];
    if(action==='crumple')return ['paper-crumple',.7];
    if(action==='page')return ['page-turn',.65];
    if(material==='paperball')return ['paper-roll',action==='floor'?.55:.24];
    if(material==='paper')return ['paper-move',action==='floor'?.6:.35];
    if(material==='leaf')return ['paper-move',.08];
    if(material==='pen')return ['pen-drop',action==='floor'?.65:action==='slide'?.14:.3];
    if(material==='cloth')return ['paper-roll',.16];
    return ['table-tap',action==='floor'?.7:action==='slide'?.12:.32];
  }
  function play(action,material='pen'){
    const token=generation;
    const start=()=>{
      if(token!==generation||context.state!=='running'||voices.size>=8)return;
      const [id,gain]=choose(action,material),buffer=buffers.get(id);if(!buffer)return;
      const source=context.createBufferSource(),level=context.createGain();source.buffer=buffer;level.gain.value=gain;
      source.connect(level).connect(context.destination);voices.add(source);
      source.onended=()=>{voices.delete(source);source.disconnect();level.disconnect();};source.start();
    };
    if(buffers.has(choose(action,material)[0]))start();else ready.then(start);
  }
  return {ready,play,stop(){generation++;for(const source of voices){try{source.stop();}catch{/* Already ended. */}}voices.clear();}};
}
