// A quiet, short bell gesture, deliberately separate from recorded object foley.
// The shared ambient controller owns focus, mute, context and voice cleanup.
export function createLeafChime(context,register){
  const notes=[2400,2694,3024,3204,3596,4036];let previous=-1,last=-Infinity;
  return ()=>{
    const now=context.currentTime;if(now-last<.45)return false;last=now;
    const index=(previous+1+Math.floor(Math.random()*(notes.length-1)))%notes.length;previous=index;
    for(const [ratio,gain,duration]of [[1,.007,.34],[2.013,.0012,.17]]){
      const source=context.createOscillator(),level=context.createGain();source.type='sine';source.frequency.value=notes[index]*ratio;
      level.gain.setValueAtTime(0,now);level.gain.linearRampToValueAtTime(gain,now+.004);level.gain.exponentialRampToValueAtTime(.00001,now+duration);
      source.connect(level).connect(context.destination);register(source,{level,gain,start:now,end:now+duration+.015,stopAt:now+duration+.015,fade:.004});
      source.start(now);source.stop(now+duration+.015);
    }
    return true;
  };
}
