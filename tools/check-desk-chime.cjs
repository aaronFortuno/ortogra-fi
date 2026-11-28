// Local native Web Audio + Three.js ray tests. No external requests or telemetry.
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const origin='http://127.0.0.1:4187';
const html=`<!doctype html><html><head><script type="importmap">{"imports":{"three":"/assets/vendor/three/three.module.min.js"}}</script><style>body{margin:0}main,canvas{width:1000px;height:400px;display:block}</style></head><body><button id="ambient-toggle"></button><span id="ambient-status"></span><main><canvas></canvas></main><script type="module">
import * as THREE from 'three';
import {createDeskLife} from '/escriptori-v2/life.js?v=0.3.3';
import {createAmbientAudio} from '/escriptori/ambient-audio.js?v=1.26.2';
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,.4,-.4,.01,5),canvas=document.querySelector('canvas'),plant=new THREE.Group(),material=new THREE.MeshStandardMaterial({name:'IndoorFoliage_0',side:THREE.DoubleSide});
camera.position.z=2;camera.updateMatrixWorld();scene.add(plant);
// Five leaves in one mesh: the same concatenated face ranges used by batching.
const values=[],ranges=[];
for(let i=0;i<5;i++){const x=-.8+i*.4,w=.12;values.push(x-w,-.1,0,x+w,-.1,0,x+w,.1,0,x-w,-.1,0,x+w,.1,0,x-w,.1,0);ranges.push({end:(i+1)*2,id:'IndoorLeaf_'+i});}
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));geometry.computeVertexNormals();
const leaf=new THREE.Mesh(geometry,material);leaf.userData.leafRanges=ranges;plant.add(leaf);
const pot=new THREE.Mesh(new THREE.PlaneGeometry(.15,.12),new THREE.MeshStandardMaterial({name:'Ceramic'}));pot.position.set(0,-.28,0);plant.add(pot);scene.updateMatrixWorld(true);
const audio=createAmbientAudio(document.querySelector('#ambient-toggle'));let touches=0;
const life=createDeskLife({scene,camera,canvas,plant,reduced:{matches:true},redraw:()=>{},onBrush:()=>{touches++;audio.playObject('chime','leaf');}});
const rect=canvas.getBoundingClientRect();
function move(x,y=200){canvas.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:rect.x+x,clientY:rect.y+y}));}
function leave(){canvas.parentElement.dispatchEvent(new PointerEvent('pointerleave'));}
window.chimeStudy={move,leave,touches:()=>touches,sweep:()=>{leave();move(1);move(999);},pot:()=>{leave();move(500,340);}};
window.ready=true;
</script></body></html>`;
(async()=>{
  const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
  try{
    const context=await browser.newContext({viewport:{width:1100,height:600}}),errors=[],requests=[],external=[];
    await context.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();external.push(r.request().url());return r.abort();});
    await context.addInitScript(()=>{
      window.chimeVoices=[];window.oscillators=0;
      const Native=AudioContext;window.AudioContext=class extends Native{constructor(...args){super(...args);const make=this.createBufferSource.bind(this),osc=this.createOscillator.bind(this);
        this.createOscillator=()=>{oscillators++;return osc();};
        this.createBufferSource=()=>{const node=make(),start=node.start.bind(node),stop=node.stop.bind(node);let voice;
          node.start=(...args)=>{if(node.playbackRate.value>1.18){voice={buffer:node.buffer,rate:node.playbackRate.value,at:this.currentTime,ended:false,stops:[]};chimeVoices.push(voice);node.addEventListener('ended',()=>voice.ended=true);}return start(...args);};
          node.stop=(when)=>{voice?.stops.push(when??this.currentTime);return stop(when);};return node;};
      }};
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));page.on('request',r=>requests.push(r.url()));
    await page.route('**/__chime-test',r=>r.fulfill({contentType:'text/html',body:html}));
    let release;const gate=new Promise(r=>release=r);await page.route('**/leaf-chime.mp3',async r=>{await gate;await r.continue();});
    await page.goto(origin+'/__chime-test');await page.waitForFunction(()=>window.ready);
    await page.locator('#ambient-toggle').click();await page.locator('#ambient-toggle').click();await page.waitForFunction(()=>document.querySelector('#ambient-toggle').dataset.audioState==='playing');
    // Queue a touch behind the download, then mute and unmute before it arrives.
    await page.evaluate(()=>chimeStudy.sweep());assert.equal(await page.evaluate(()=>chimeStudy.touches()),5,'A rapid sweep touches all five batched leaves, without a time cooldown');
    await page.locator('#ambient-toggle').click();await page.locator('#ambient-toggle').click();await page.waitForFunction(()=>document.querySelector('#ambient-toggle').dataset.audioState==='playing');
    const downloaded=page.waitForResponse('**/leaf-chime.mp3');release();await downloaded;
    await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>chimeVoices.length),0,'Mute cancels pending touches even if sound is re-enabled before decoding');
    const before=await page.evaluate(()=>chimeStudy.touches());await page.evaluate(()=>chimeStudy.sweep());await page.waitForFunction(()=>chimeVoices.length===5);
    let r=await page.evaluate(()=>({touches:chimeStudy.touches(),count:chimeVoices.length,rates:chimeVoices.map(v=>v.rate),sameBuffer:chimeVoices.every(v=>v.buffer===chimeVoices[0].buffer),span:Math.max(...chimeVoices.map(v=>v.at))-Math.min(...chimeVoices.map(v=>v.at)),ended:chimeVoices.filter(v=>v.ended).length}));
    assert.equal(r.touches-before,5);assert.equal(r.count,5);assert.ok(r.sameBuffer);assert.ok(r.span<.08);assert.equal(r.ended,0,'All five sample voices overlap');
    assert.ok(r.rates.every(v=>v>=2**(3/12)-1e-6&&v<=2**(10/12)+1e-6));for(let i=1;i<r.rates.length;i++)assert.notEqual(r.rates[i],r.rates[i-1]);
    await page.evaluate(()=>{chimeStudy.leave();chimeStudy.move(500);for(let i=0;i<8;i++)chimeStudy.move(501+i);});await page.waitForFunction(()=>chimeVoices.length===6);
    assert.equal(await page.evaluate(()=>chimeVoices.length),6,'Remaining within one leaf is one touch');
    await page.evaluate(()=>{chimeStudy.leave();chimeStudy.move(500);});await page.waitForFunction(()=>chimeVoices.length===7);
    await page.evaluate(()=>chimeStudy.pot());assert.equal(await page.evaluate(()=>chimeVoices.length),7,'The pot remains silent');
    await page.locator('#ambient-toggle').click();await page.waitForFunction(()=>chimeVoices.every(v=>v.ended));const muted=await page.evaluate(()=>chimeVoices.length);await page.evaluate(()=>chimeStudy.sweep());assert.equal(await page.evaluate(()=>chimeVoices.length),muted);
    assert.ok(await page.evaluate(()=>chimeVoices.every(v=>v.stops.length>0)),'Mute fades all overlapping voices');
    const measured=await page.evaluate(async()=>{
      const {createLeafChime}=await import('/escriptori/leaf-chime.js?v=0.3.3'),offline=new OfflineAudioContext(1,44100*3,44100),voices=[];
      const audio={get currentTime(){return offline.currentTime;},state:'running',destination:offline.destination,decodeAudioData:offline.decodeAudioData.bind(offline),createGain:offline.createGain.bind(offline),createBufferSource:offline.createBufferSource.bind(offline)};
      const play=createLeafChime(audio,(node,voice)=>{voices.push({duration:node.buffer.duration,rate:node.playbackRate.value});node.onended=()=>{node.disconnect();voice.level.disconnect();};});await play.prepare();for(let i=0;i<5;i++)play();
      const rendered=await offline.startRendering();let peak=0;for(const v of rendered.getChannelData(0))peak=Math.max(peak,Math.abs(v));return{peak,voices};
    });
    assert.equal(measured.voices.length,5);assert.ok(measured.peak>.005&&measured.peak<.11,'Five real recordings stay quiet and do not clip');assert.equal(await page.evaluate(()=>oscillators),0);
    assert.equal(requests.filter(u=>u.endsWith('/leaf-chime.mp3')).length,2,'One live decoded buffer, plus the separate offline measurement');assert.ok(!requests.some(u=>u.includes('/foley/')));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log('PASS: five rapid batched-leaf contacts produce five overlapping recorded chimes; varied high pitches, same decoded buffer, quiet mix, no pot sound, no hover loop, re-entry and pending/active mute cleanup.');console.log(JSON.stringify({rates:r.rates,span:r.span,offlinePeak:measured.peak,clipDuration:measured.voices[0].duration},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
