// Each exterior layer schedules its own next entrance on the audio clock.
export function createAmbientAudio(button) {
  const base = new URL('../assets/desk/audio/', import.meta.url);
  let context, master, filter, buffers, loadingBuffers, reading = false, open = false;
  let generation = 0, previousBird = '', wanted = true, started = false, pending = false, playedOnce = false;
  try { wanted = localStorage.getItem('ortografi-desk-muted') !== 'true'; } catch { /* Session-only preference. */ }
  const sources = new Set(), timers = new Set();
  const random = (a, b) => a + Math.random() * (b - a);
  const status = document.querySelector('#ambient-status');
  function reflect(state) {
    button.dataset.audioState = state;
    button.setAttribute('aria-pressed', String(wanted));
    button.setAttribute('aria-busy', String(state === 'loading'));
    const label = wanted ? 'Apaga el so ambient' : 'Activa el so ambient';
    button.setAttribute('aria-label', label); button.title = label;
  }
  const later = (seconds, callback, token) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (token === generation && wanted && !document.hidden) callback();
    }, seconds * 1000);
    timers.add(timer);
  };
  function stopLayers(fade = 0) {
    generation++;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const source of sources) { try { source.stop(context.currentTime + fade); } catch { /* Already ended. */ } }
    sources.clear();
  }
  function volume() {
    if (!master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    const level = (open ? .42 : .24) * (reading ? .43 : 1);
    master.gain.setTargetAtTime(wanted && !document.hidden ? level : 0, now, .12);
    filter.frequency.setTargetAtTime(open ? 7200 : 1500, now, .14);
  }
  function play(entry, { gain = 1, pan = 0, rate = 1, offset = 0, fade = .25 } = {}) {
    const source = context.createBufferSource(), level = context.createGain(), position = context.createStereoPanner();
    source.buffer = entry.buffer; source.playbackRate.value = rate;
    position.pan.value = pan;
    const duration = (entry.buffer.duration - offset) / rate, now = context.currentTime;
    level.gain.setValueAtTime(0, now);
    level.gain.linearRampToValueAtTime(gain, now + fade);
    level.gain.setValueAtTime(gain, now + Math.max(fade, duration - fade));
    level.gain.linearRampToValueAtTime(0, now + duration);
    source.connect(level).connect(position).connect(master);
    sources.add(source);
    source.onended = () => { sources.delete(source); source.disconnect(); level.disconnect(); position.disconnect(); };
    source.start(now, offset);
    return { duration, position };
  }
  function wind(token) {
    const entry = buffers.find(clip => clip.kind === 'wind');
    const fade = 2.5, played = play(entry, { gain: random(.55, .8), pan: random(-.5, -.15), rate: random(.97, 1.03), offset: random(0, 2), fade });
    later(played.duration - fade, () => wind(token), token);
  }
  function bird(token) {
    const options = buffers.filter(clip => clip.kind === 'birds' && clip.id !== previousBird);
    const entry = options[Math.floor(Math.random() * options.length)]; previousBird = entry.id;
    if (isDay()) play(entry, { gain: random(.4, .7), pan: random(-.8, -.25), rate: random(.985, 1.015) });
    later(random(18, 43), () => bird(token), token);
  }
  function vehicle(token) {
    const entry = buffers.find(clip => clip.kind === 'vehicle');
    const played = play(entry, { gain: random(.3, .55), pan: -.8, rate: random(.96, 1.04), fade: 1.5 });
    played.position.pan.linearRampToValueAtTime(.35, context.currentTime + played.duration);
    later(random(70, 145), () => vehicle(token), token);
  }
  function isDay() { return document.querySelector('#desk-canvas')?.dataset.lighting === 'day'; }
  function playground(token) {
    const entry = buffers.find(clip => clip.kind === 'playground');
    if (isDay() && entry) play(entry, { gain: random(.46, .72), pan: random(-.75, -.3),
      offset: random(0, 2), fade: 1.4, rate: random(.97, 1.03) });
    later(random(38, 90), () => playground(token), token);
  }
  async function start(gesture = false) {
    if (!wanted || document.hidden || pending || started) return;
    const token = ++generation;
    pending = true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('Audio unavailable');
      if (!context) {
        context = new AudioContext(); master = context.createGain(); master.gain.value = 0;
        // Soften the upper frequencies as though they arrive through a window.
        filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = .65;
        filter.frequency.value = open ? 7200 : 1500;
        master.connect(filter).connect(context.destination);
        context.addEventListener('statechange', () => { if (context.state === 'running') start(); });
      }
      if (context.state !== 'running') {
        if (!gesture) { reflect('waiting'); return; }
        await context.resume();
      }
      if (token !== generation || !wanted || document.hidden) return;
      if (!buffers) {
        reflect('loading');
        loadingBuffers ||= (async () => {
          const response = await fetch(new URL('manifest.json?v=1.14.0', base));
          if (!response.ok) throw new Error('Audio catalogue unavailable');
          const manifest = await response.json();
          return Promise.all(manifest.clips.map(async entry => {
            const audio = await fetch(new URL(entry.file, base));
            if (!audio.ok) throw new Error('Audio unavailable');
            return { ...entry, buffer: await context.decodeAudioData(await audio.arrayBuffer()) };
          }));
        })().catch(error => { loadingBuffers = null; throw error; });
        buffers = await loadingBuffers;
      }
      if (token !== generation || !wanted || document.hidden) return;
      started = true; playedOnce = true; volume(); reflect('playing'); wind(token);
      later(random(3, 7), () => bird(token), token);
      later(random(6, 16), () => playground(token), token);
      later(random(25, 45), () => vehicle(token), token);
    } catch {
      if (token !== generation) return;
      pending = false; started = false; wanted = false; stopLayers(); volume(); context?.suspend(); reflect('error');
      status.textContent = 'No s’ha pogut activar el so. Pots tornar-ho a provar.';
    } finally { if (token === generation) pending = false; }
  }
  function pause(fade = 0) {
    pending = false; started = false; stopLayers(fade); volume();
    const token = generation;
    if (fade) setTimeout(() => { if (token === generation) context?.suspend(); }, fade * 1000);
    else context?.suspend();
  }
  function unlock(event) {
    if (event.isTrusted && !button.contains(event.target) && !event.repeat && !event.ctrlKey && !event.metaKey) start(true);
  }
  document.addEventListener('click', unlock, true);
  document.addEventListener('keydown', unlock, true);
  button.addEventListener('click', () => {
    wanted = !wanted; status.textContent = ''; reflect(wanted ? 'loading' : 'off');
    try { localStorage.setItem('ortografi-desk-muted', String(!wanted)); } catch { /* Session-only preference. */ }
    if (wanted) start(true);
    else pause(.22);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); if (wanted) reflect('paused'); }
    else if (wanted) start(playedOnce || navigator.userActivation?.hasBeenActive);
  });
  window.addEventListener('pagehide', () => pause());
  window.addEventListener('pageshow', event => { if (event.persisted) start(playedOnce || navigator.userActivation?.hasBeenActive); });
  reflect(wanted ? 'waiting' : 'off');
  return { start, setWindow(value) { open = value; volume(); }, setReading(value) { reading = value; volume(); } };
}
