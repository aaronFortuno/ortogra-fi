import { objectAudio } from './object-audio.js?v=1.25.0';

// Each exterior layer schedules its own next entrance on the audio clock.
export function createAmbientAudio(button) {
  const base = new URL('../assets/desk/audio/', import.meta.url);
  const mixGain = 10 ** (-3 / 20);
  let context, master, filter, loadingBuffers, effects, open = false;
  const buffers=[];
  let catalogue,warming;
  let generation = 0, previousBird = '', wanted = true, started = false, pending = false, playedOnce = false;
  let focused=document.hasFocus(),suspendTimer;
  const focusFade=2.5,available=()=>focused&&!document.hidden;
  try { wanted = localStorage.getItem('ortografi-desk-muted') !== 'true'; } catch { /* Session-only preference. */ }
  const sources = new Map(), timers = new Set();
  const random = (a, b) => a + Math.random() * (b - a);
  const status = document.querySelector('#ambient-status');
  const loadingButton=document.querySelector('#loading-audio-toggle');
  function reflect(state) {
    button.dataset.audioState = state;
    button.setAttribute('aria-pressed', String(wanted));
    button.setAttribute('aria-busy', String(state === 'loading'));
    const label = wanted ? 'Apaga el so ambient' : 'Activa el so ambient';
    button.setAttribute('aria-label', label); button.title = label;
    if(loadingButton){
      const waiting=wanted&&state==='waiting'&&buffers.some(clip=>clip.kind==='wind');
      loadingButton.classList.toggle('is-available',waiting);loadingButton.inert=!waiting;loadingButton.setAttribute('aria-hidden',String(!waiting));
    }
  }
  const later = (seconds, callback, token) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (token === generation && wanted && available()) callback();
    }, seconds * 1000);
    timers.add(timer);
  };
  function stopLayers(fade = 0) {
    generation++;
    effects?.stop(fade);
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const [source,voice] of sources) {
      const now=context.currentTime;
      const end=Math.max(now,Math.min(now+fade,voice.stopAt??Infinity));voice.stopAt=end;
      if(fade){
        const gain=voice.level.gain;
        if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(now);
        else {gain.cancelScheduledValues(now);gain.setValueAtTime(voice.gain*Math.max(0,Math.min(1,(now-voice.start)/voice.fade,(voice.end-now)/voice.fade)),now);}
        gain.linearRampToValueAtTime(0,end);
      }
      try { source.stop(end); } catch { /* Already ended. */ }
    }
    if(!fade)sources.clear();
  }
  function volume() {
    if (!master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    const level = mixGain * (open ? .42 : .24);
    // Per-voice fades survive background timer throttling and can crossfade
    // with a quick return without reviving an old layer or cutting it short.
    master.gain.setTargetAtTime(level, now, .12);
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
    sources.set(source,{level,gain,start:now,end:now+duration,fade});
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
    if(!buffers.some(clip=>clip.kind==='birds')||!document.querySelector('#desk-canvas')?.dataset.lighting){later(2,()=>bird(token),token);return;}
    let options = buffers.filter(clip => clip.kind === 'birds' && clip.id !== previousBird);
    if(!options.length)options=buffers.filter(clip=>clip.kind==='birds');
    const entry = options[Math.floor(Math.random() * options.length)]; previousBird = entry.id;
    if (isDay()) play(entry, { gain: random(.4, .7), pan: random(-.8, -.25), rate: random(.985, 1.015) });
    later(random(18, 43), () => bird(token), token);
  }
  function vehicle(token) {
    const entry = buffers.find(clip => clip.kind === 'vehicle');
    if(!entry){later(3,()=>vehicle(token),token);return;}
    const played = play(entry, { gain: random(.3, .55), pan: -.8, rate: random(.96, 1.04), fade: 1.5 });
    played.position.pan.linearRampToValueAtTime(.35, context.currentTime + played.duration);
    later(random(70, 145), () => vehicle(token), token);
  }
  function isDay() { return document.querySelector('#desk-canvas')?.dataset.lighting === 'day'; }
  function playground(token) {
    const entry = buffers.find(clip => clip.kind === 'playground');
    if(!entry||!document.querySelector('#desk-canvas')?.dataset.lighting){later(3,()=>playground(token),token);return;}
    if (isDay() && entry) play(entry, { gain: random(.46, .72), pan: random(-.75, -.3),
      offset: random(0, 2), fade: 1.4 });
    later(random(38, 90), () => playground(token), token);
  }
  function ensureContext(){
    if(!context){
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('Audio unavailable');
      context = new AudioContext(); master = context.createGain(); master.gain.value = 0;
      // Soften the upper frequencies as though they arrive through a window.
      filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = .65;
      filter.frequency.value = open ? 7200 : 1500;
      master.connect(filter).connect(context.destination);
      context.addEventListener('statechange', () => { if (context.state === 'running') start(); });
    }
  }
  async function loadClip(entry,priority){
    const audio=await fetch(new URL(entry.file,base),{priority});
    if(!audio.ok)throw new Error('Audio unavailable');
    const clip={...entry,buffer:await context.decodeAudioData(await audio.arrayBuffer())};buffers.push(clip);return clip;
  }
  function warmOthers(){
    if(!warming&&wanted&&catalogue)warming=Promise.allSettled(catalogue.clips.filter(clip=>clip.kind!=='wind').map(clip=>loadClip(clip,'low')));
  }
  function prepare(){
    if(!wanted)return Promise.resolve(false);
    if(loadingBuffers)return loadingBuffers;
    reflect('loading');
    loadingBuffers=(async()=>{
      ensureContext();
      const response=await fetch(new URL('manifest.json?v=1.14.1',base),{priority:'high'});
      if(!response.ok)throw new Error('Audio catalogue unavailable');
      catalogue=await response.json();const wind=catalogue.clips.find(clip=>clip.kind==='wind');
      if(!wind)throw new Error('Wind unavailable');
      await loadClip(wind,'high');return true;
    })().catch(()=>{
      loadingBuffers=null;
      if(!pending){wanted=false;context?.suspend();reflect('error');status.textContent='No s’ha pogut carregar el so. Pots tornar-ho a provar.';}
      return false;
    });
    loadingBuffers.then(ok=>{
      if(!ok)return;
      start();
      // The continuous bed can play immediately. Occasional layers must not
      // hold it up, and object foley stays lazy until an actual object gesture.
      warmOthers();
    });
    return loadingBuffers;
  }
  async function start(gesture = false) {
    if (!wanted || !available() || pending || started) return;
    if(!context&&!gesture){reflect('waiting');return;}
    clearTimeout(suspendTimer);suspendTimer=null;
    const token = ++generation;
    pending = true;
    try {
      ensureContext();
      if (context.state !== 'running') {
        if (!gesture) { reflect('waiting'); return; }
        await context.resume();
      }
      if (token !== generation || !wanted || !available()) return;
      if(!await prepare())throw new Error('Audio unavailable');
      if (token !== generation || !wanted || !available()) return;
      started = true; playedOnce = true; volume(); reflect('playing'); wind(token);
      warmOthers();
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
    if(suspendTimer&&!started&&!pending&&fade)return;
    clearTimeout(suspendTimer);suspendTimer=null;
    pending = false; started = false; stopLayers(fade); volume();
    const token = generation;
    if (fade) suspendTimer=setTimeout(() => { suspendTimer=null;if (token === generation) context?.suspend(); }, fade * 1000+30);
    else context?.suspend();
  }
  function unlock(event) {
    if (event.isTrusted && !button.contains(event.target) && !event.repeat && !event.ctrlKey && !event.metaKey) start(true);
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('pointerup', unlock, true);
  document.addEventListener('click', unlock, true);
  document.addEventListener('keydown', unlock, true);
  button.addEventListener('click', () => {
    wanted = !wanted; status.textContent = ''; reflect(wanted ? 'loading' : 'off');
    try { localStorage.setItem('ortografi-desk-muted', String(!wanted)); } catch { /* Session-only preference. */ }
    if (wanted) start(true);
    else pause(.22);
  });
  loadingButton?.addEventListener('click',()=>start(true));
  document.addEventListener('visibilitychange', () => {
    focused=document.hasFocus();
    if (!available()) { pause(focusFade); if (wanted) reflect('paused'); }
    else if (wanted) start(playedOnce || navigator.userActivation?.hasBeenActive);
  });
  window.addEventListener('blur',()=>{focused=false;pause(focusFade);if(wanted)reflect('paused');});
  window.addEventListener('focus',()=>{focused=true;if(wanted)start(playedOnce||navigator.userActivation?.hasBeenActive);});
  window.addEventListener('pagehide', () => pause());
  window.addEventListener('pageshow', event => { focused=document.hasFocus();if (event.persisted) start(playedOnce || navigator.userActivation?.hasBeenActive); });
  reflect(wanted ? 'waiting' : 'off');
  return { start, prepare, setWindow(value) { open = value; volume(); },
    playObject(action, material) {
      if (!wanted || !available() || context?.state !== 'running') return;
      effects ||= objectAudio(context); effects.play(action, material);
    } };
}
