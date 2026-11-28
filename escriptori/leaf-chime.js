// One decoded recording, a new overlapping voice on every leaf entry.
// The shared ambient controller owns focus, mute and active voice cleanup.
export function createLeafChime(context,register,canPlay=()=>true){
  const url=new URL('../assets/desk/audio/leaf-chime.mp3',import.meta.url);
  let buffer,loading,peak=1,previous=-1,generation=0;
  function prepare(){
    if(buffer)return Promise.resolve(true);
    if(!loading)loading=(async()=>{
      const response=await fetch(url);if(!response.ok)throw Error('Chime unavailable');
      const decoded=await context.decodeAudioData(await response.arrayBuffer());let maximum=0;
      for(let channel=0;channel<decoded.numberOfChannels;channel++)for(const value of decoded.getChannelData(channel))maximum=Math.max(maximum,Math.abs(value));
      peak=Math.max(.01,maximum);buffer=decoded;return true;
    })().catch(()=>false).finally(()=>{loading=null;});
    return loading;
  }
  function play(){
    const token=generation,requested=performance.now();
    const start=()=>{
      if(!buffer||token!==generation||!canPlay()||context.state!=='running'||performance.now()-requested>750)return false;
      // Three to ten semitones above the recording; never the same twice.
      const note=(previous+1+Math.floor(Math.random()*7))%8;previous=note;
      const rate=2**((3+note)/12),source=context.createBufferSource(),level=context.createGain();
      source.buffer=buffer;source.playbackRate.value=rate;
      const now=context.currentTime,duration=buffer.duration/rate,fade=.006,gain=.020/peak*(.88+Math.random()*.12);
      level.gain.setValueAtTime(0,now);level.gain.linearRampToValueAtTime(gain,now+fade);
      level.gain.setValueAtTime(gain,now+Math.max(fade,duration-.06));level.gain.linearRampToValueAtTime(0,now+duration);
      source.connect(level).connect(context.destination);register(source,{level,gain,start:now,end:now+duration,stopAt:now+duration,fade});
      source.start(now);return true;
    };
    return buffer?start():prepare().then(ok=>ok&&start());
  }
  return Object.assign(play,{prepare,cancelPending:()=>{generation++;}});
}
