// Recorded indoor foley shares the exterior's AudioContext and mute control,
// but never passes through the window filter. Sources and edits ship locally.
import { soundProfile } from './object-sounds.js?v=1.24.0';

export function objectAudio(context) {
  const base=new URL('../assets/desk/audio/foley/',import.meta.url),buffers=new Map(),voices=new Set();
  const last=new Map(),previous=new Map(),active=new Map();
  let generation=0;
  const ready=(async()=>{
    const response=await fetch(new URL('manifest.json?v=1.24.0',base));if(!response.ok)return;
    const manifest=await response.json();
    await Promise.allSettled(manifest.clips.map(async clip=>{
      const audio=await fetch(new URL(clip.file+'?v='+clip.sha256.slice(0,12),base));if(!audio.ok)return;
      buffers.set(clip.id,await context.decodeAudioData(await audio.arrayBuffer()));
    }));
  })().catch(()=>{});
  function play(action,material='pen'){
    const profile=soundProfile(action,material);if(!profile)return;
    const key=material+':'+action,now=context.currentTime;
    if(now-(last.get(key)??-Infinity)<(profile.cooldown??.09))return;
    if(material==='leaf'&&active.get(material))return;
    last.set(key,now);
    const choices=profile.clips.filter(id=>id!==previous.get(key)),id=choices[Math.floor(Math.random()*choices.length)]||profile.clips[0];
    const token=generation,requested=performance.now();
    const start=()=>{
      if(token!==generation||context.state!=='running'||voices.size>=8||performance.now()-requested>250)return;
      if(material==='leaf'&&active.get(material))return;
      const buffer=buffers.get(id);if(!buffer)return;
      const source=context.createBufferSource(),level=context.createGain();source.buffer=buffer;level.gain.value=profile.gain*(.94+Math.random()*.12);
      source.connect(level).connect(context.destination);voices.add(source);previous.set(key,id);active.set(material,(active.get(material)||0)+1);
      source.onended=()=>{voices.delete(source);if(token===generation)active.set(material,Math.max(0,(active.get(material)||0)-1));source.disconnect();level.disconnect();};source.start();
    };
    if(buffers.has(id))start();else ready.then(start);
  }
  return {ready,play,stop(){generation++;last.clear();active.clear();for(const source of voices){try{source.stop();}catch{/* Already ended. */}}voices.clear();}};
}
