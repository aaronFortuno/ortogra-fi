// Short indoor sounds share the exterior's AudioContext and mute control.
// The filter for the window belongs only to sounds coming from outside.
export function objectAudio(context) {
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * .75), context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const voices = new Set();
  function strike(time, duration, frequency, gain, tone = false, attack = .009) {
    const source = tone ? context.createOscillator() : context.createBufferSource();
    const level = context.createGain(), filter = context.createBiquadFilter();
    if (tone) {
      source.type = 'sine'; source.frequency.setValueAtTime(frequency, time);
      source.frequency.exponentialRampToValueAtTime(frequency * .7, time + duration);
    } else source.buffer = noise;
    filter.type = 'bandpass'; filter.Q.value = tone ? .8 : .65;
    filter.frequency.setValueAtTime(frequency, time);
    filter.frequency.exponentialRampToValueAtTime(frequency * .59, time + duration);
    level.gain.setValueAtTime(.00001, time);
    level.gain.exponentialRampToValueAtTime(gain, time + attack);
    level.gain.exponentialRampToValueAtTime(.00001, time + duration);
    source.connect(filter).connect(level).connect(context.destination);
    source.onended = () => { voices.delete(source); source.disconnect(); filter.disconnect(); level.disconnect(); };
    if (tone) source.start(time); else source.start(time, Math.random() * .09);
    source.stop(time + duration); voices.add(source);
  }
  function play(action, material = 'pen') {
    if (context.state !== 'running' || voices.size >= 12) return;
    const t = context.currentTime, variation = .88 + Math.random() * .24;
    if(action==='staple'){
      strike(t,.052,1900*variation,.047);strike(t+.025,.075,330*variation,.035,true,.003);
      strike(t+.065,.065,3700*variation,.029);return;
    }
    if(action==='crumple'){
      for(let i=0;i<4;i++)strike(t+i*.045,.12,(2600+i*490)*variation,.034,false,.012);
      return;
    }
    if(material==='paperball')material='paper';
    if (action === 'page' || material === 'paper' || material === 'leaf') {
      const page = action === 'page', landing = action === 'floor';
      const gain = page ? .050 : landing ? .037 : material === 'leaf' ? .009 : .025;
      strike(t, page ? .36 : .14, 3400 * variation, gain, false, page ? .07 : .022);
      if (landing) strike(t + .016, .12, 720 * variation, .027);
      if (page) strike(t + .24, .29, 1950 * variation, .034, false, .055);
      return;
    }
    const heavy = material === 'metal' || material === 'cup';
    if (action === 'slide') { strike(t, .16, (heavy ? 610 : 1300) * variation, .019, false, .034); return; }
    const floor = action === 'floor';
    const frequency = (heavy ? 205 : material === 'cloth' ? 145 : 780) * variation;
    strike(t, floor ? .19 : .095, frequency, floor ? .063 : .024, true);
    strike(t, floor ? .14 : .07, (heavy ? 2100 : 3100) * variation, floor ? .047 : .022);
    if (floor && material === 'pen') strike(t + .085, .07, 980 * variation, .023);
  }
  return { play, stop() { for (const voice of voices) { try { voice.stop(); } catch { /* already ended */ } } } };
}
