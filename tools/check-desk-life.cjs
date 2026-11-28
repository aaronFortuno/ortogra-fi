// Local, seeded simulation of the real fly module and Three.js surface queries.
// Time advances in the test only; no renderer, analytics or external requests.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:4187';
const html=`<!doctype html><html><head><script type="importmap">{"imports":{"three":"/assets/vendor/three/three.module.min.js"}}</script><style>body{margin:0}main,canvas{width:1440px;height:844px;display:block}</style></head><body><main><canvas></canvas></main><script type="module">
import * as THREE from 'three';
import {createDeskLife} from '/escriptori-v2/life.js';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1440/844,.025,12),canvas=document.querySelector('canvas'),root=new THREE.Group(),reduced={matches:false};scene.add(root);
camera.position.set(-.22,1.06,.53);camera.rotation.set(-.42,-.14,0,'YXZ');camera.updateMatrixWorld();
function box(size,pos){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial());mesh.position.set(...pos);root.add(mesh);return mesh;}
box([2,.047,.93],[.15,.7265,-.17]);box([2.2,2.8,.07],[.2,1.4,-.68]);box([.12,.13,.12],[.30,.815,-.10]);box([.03,.34,.20],[-.50,.92,-.47]);scene.updateMatrixWorld(true);
let seed=11743;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const life=createDeskLife({scene,camera,canvas,landingSurfaces:[root],reduced,redraw:()=>{},randomSource:random});let time=0;
const rect=canvas.getBoundingClientRect(),p=new THREE.Vector3(-.22,.75,.015).project(camera),mouse={x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};
function pointer(){canvas.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:mouse.x,clientY:mouse.y}));}
function advance(){time+=.035;life.tick(time);}
pointer();const ray=new THREE.Raycaster(),normal=new THREE.Vector3(),position=new THREE.Vector3(),stats={walkSamples:0,walkErrors:0,foldedSamples:0,openSamples:0,biased:0,independent:0,spontaneous:0,unique:new Set(),durations:new Set(),gaps:[]};let previous=0,lastFlightAt=-Infinity;
for(let i=0;i<50000&&life.info().landings<80;i++){
  if(i%250===0)pointer();advance();const info=life.info();
  if(info.fly==='flying'){lastFlightAt=time;if(info.wingSpread>.98){stats.openSamples++;if(Math.abs(life.fly.getObjectByName('FlyWingLeft').rotation.y)>.11)throw Error('Flying wings are not deployed');}}
  else if(time-lastFlightAt>.22){stats.foldedSamples++;if(info.wingSpread>.002||Math.abs(life.fly.getObjectByName('FlyWingLeft').rotation.y)<1.24)throw Error('Resting or walking wings are not folded over the back');}
  if(info.fly==='walking'&&i%4===0){
    normal.fromArray(info.surfaceNormal);position.copy(life.fly.position);ray.set(position.clone().addScaledVector(normal,.025),normal.clone().negate());const hit=ray.intersectObject(root,true)[0],gap=hit?ray.ray.origin.distanceTo(hit.point)-.025:Infinity;
    stats.walkSamples++;if(gap<.001||gap>.007)stats.walkErrors++;
  }
  if(info.landings>previous){previous=info.landings;stats[info.landingFromPointer?'biased':'independent']++;if(info.lastCause==='explore')stats.spontaneous++;if(info.landingFromPointer)stats.gaps.push(info.lastLandingGap);stats.unique.add(info.position.map(n=>n.toFixed(3)).join(','));stats.durations.add(info.lastDuration.toFixed(2));}
}
const summary={...stats,unique:stats.unique.size,durations:stats.durations.size,info:life.info()};
canvas.parentElement.dispatchEvent(new PointerEvent('pointerleave'));const biasBefore=life.info().pointerLandings,landingsBefore=life.info().landings;
for(let i=0;i<20000&&life.info().landings<landingsBefore+12;i++)advance();
summary.withoutPointer=life.info().pointerLandings-biasBefore;
reduced.matches=true;const at=life.fly.position.toArray(),before=life.info();for(let i=0;i<100;i++)advance();summary.reduced={before:at,after:life.fly.position.toArray(),flightsBefore:before.flights,flightsAfter:life.info().flights,moving:life.moving()};
life.pause(true);summary.pausedVisible=life.fly.visible;window.result=summary;
</script></body></html>`;
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  const context=await browser.newContext({viewport:{width:1440,height:844}}),errors=[],external=[];
  await context.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();external.push(r.request().url());return r.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));await page.route('**/__life-test',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto(origin+'/__life-test');await page.waitForFunction(()=>window.result,{},{timeout:15000});
  const r=await page.evaluate(()=>window.result);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(r.info.landings,80);assert.ok(r.info.walks>12);assert.ok(r.walkSamples>100);assert.equal(r.walkErrors,0,'Walking stays attached to a real surface');assert.ok(r.biased>=8&&r.biased<45,'Cursor preference is a minority of landings');assert.ok(r.independent>r.biased);assert.ok(r.spontaneous>20);assert.ok(r.unique>35);assert.ok(r.durations>15);assert.ok(r.gaps.every(n=>n>=156&&n<=252));assert.equal(r.withoutPointer,0);assert.deepEqual(r.reduced.before,r.reduced.after);assert.equal(r.reduced.flightsBefore,r.reduced.flightsAfter);assert.equal(r.reduced.moving,false);assert.equal(r.pausedVisible,false);
  assert.ok(r.foldedSamples>100&&r.openSamples>100);console.log('PASS: autonomous flights, varied routes, surface walking without penetration, folded resting/walking wings, deployed flying wings, occasional cursor bias, reduced motion and pause.');console.log(JSON.stringify({landings:r.info.landings,walks:r.info.walks,biased:r.biased,independent:r.independent,spontaneous:r.spontaneous,unique:r.unique,durations:r.durations,walkSamples:r.walkSamples,foldedSamples:r.foldedSamples,openSamples:r.openSamples},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
