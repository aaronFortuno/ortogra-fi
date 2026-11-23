const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright');const origin='http://127.0.0.1:4187',out=path.resolve('output/desk/air');
const probe=`window.airStudy={
  phase:()=>phase,info:()=>air.info(),moment:iso=>lighting.setMoment(new Date(iso)),light:lighting.setRoomLight,view:moveView,
  panePoint(){const p=projectPoint(atmosphere.sash.pane.localToWorld(new THREE.Vector3(0,.35,0))),r=canvas.getBoundingClientRect();return {x:p.x+r.x,y:p.y+r.y};},
  toggle(value){window.airDisabled=!value;requestRender();},time(t){air.update(t);requestRender();},
  stats(){const geometry=new Set();scene.traverse(n=>{if(n.isMesh||n.isPoints)geometry.add(n.geometry)});return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,textures:renderer.info.memory.textures,lights:scene.children.filter(n=>n.isLight).length,
    bytes:[...geometry].reduce((s,g)=>s+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(g.index?.array.byteLength||0),0)};},
  seed:()=>Array.from(scene.getObjectByName('FloatingDust').geometry.attributes.position.array).reduce((s,v,i)=>s+v*(i+1),0),
  bench(){const samples=[],gl=renderer.getContext();for(let i=0;i<25;i++){const t=performance.now();renderer.render(scene,camera);gl.finish();if(i>4)samples.push(performance.now()-t)}samples.sort((a,b)=>a-b);return {median:samples[10],p95:samples[18]};},
};`;
(async()=>{
  await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
  try{for(const mobile of [false,true]){
    const ctx=await browser.newContext({viewport:mobile?{width:320,height:568}:{width:1440,height:960},reducedMotion:'reduce',colorScheme:mobile?'dark':'light'});
    await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    await ctx.addInitScript(()=>{const D=Date;window.Date=class extends D{constructor(...args){super(...(args.length?args:['2026-11-23T15:00:00Z']))}static now(){return D.parse('2026-11-23T15:00:00Z')}}});
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await page.route('**/scene.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('  return { highlight, select, home,',probe+'\n  return { highlight, select, home,').replace('focused:Boolean(active)||presenting||contextLost','focused:Boolean(active)||presenting||contextLost||window.airDisabled')})});
    await page.goto(origin+'/escriptori/');await page.locator('#workspace[data-ready=true]').waitFor({timeout:90000});await page.locator('#desk-loading').waitFor({state:'hidden'});
    const snapshots={},images={};
    async function snap(name){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));images[name]=(await page.screenshot({path:path.join(out,(mobile?'mobile-':'desktop-')+name+'.png')})).toString('base64');snapshots[name]=await page.evaluate(()=>({air:airStudy.info(),stats:airStudy.stats(),bench:airStudy.bench()}));}
    await page.evaluate(()=>airStudy.toggle(false));await snap('without');await page.evaluate(()=>airStudy.toggle(true));await snap('sun');
    const a=snapshots.without.stats,b=snapshots.sun.stats;
    assert.equal(b.points-a.points,mobile?640:1024);assert.equal(b.calls-a.calls,2);assert.equal(b.triangles-a.triangles,8);assert.equal(b.textures,a.textures);assert.equal(b.lights,a.lights);
    snapshots.sun.visiblePixels=await page.evaluate(async ({urls,mobile})=>{
      const top=mobile?100:160,threshold=mobile?4:8,arrays=[];
      for(const url of urls){const image=new Image();image.src='data:image/png;base64,'+url;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);arrays.push(ctx.getImageData(0,top,c.width,c.height-top-60).data);}
      let changed=0;for(let i=0;i<arrays[0].length;i+=4)if(Math.max(...[0,1,2].map(j=>Math.abs(arrays[0][i+j]-arrays[1][i+j])))>threshold)changed++;return changed;
    },{urls:[images.without,images.sun],mobile});
    assert.ok(snapshots.sun.visiblePixels>(mobile?15:100),'The particles and scattering are visible, not just submitted to the GPU');
    const seed=await page.evaluate(()=>airStudy.seed());await page.evaluate(()=>airStudy.time(16));await snap('drift');assert.equal(await page.evaluate(()=>airStudy.seed()),seed,'Particle motion reuses immutable GPU buffers');
    if(!mobile){
      await page.evaluate(()=>airStudy.view('window'));await snap('window');
      const point=await page.evaluate(()=>airStudy.panePoint());await page.mouse.click(point.x,point.y);
      await page.waitForFunction(()=>document.querySelector('#window-latch').getAttribute('aria-pressed')==='true');
      await page.evaluate(()=>document.querySelector('#window-latch').click());await page.evaluate(()=>airStudy.view('home'));
    }
    await page.evaluate(()=>airStudy.moment('2026-11-23T22:00:00Z'));await snap('night');assert.equal(snapshots.night.air.beam,false);assert.equal(snapshots.night.air.dust,true);
    await page.evaluate(()=>airStudy.light(false));await snap('lights-off');assert.equal(snapshots['lights-off'].air.dust,false);assert.equal(snapshots['lights-off'].air.beam,false);
    await page.evaluate(()=>{airStudy.light(null);airStudy.moment('2026-11-23T13:00:00Z')});await snap('midday');assert.notDeepEqual(snapshots.midday.air.direction,snapshots.sun.air.direction);
    const frozen=await page.evaluate(()=>airStudy.info().seconds);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>airStudy.info().seconds),frozen);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(t=>airStudy.info().seconds!==t,frozen);await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('[data-project=trama]').click();await page.waitForFunction(()=>airStudy.phase()==='reading');assert.equal(await page.evaluate(()=>airStudy.info().opacity),0,'Reading has no floating dust or haze');
    await page.keyboard.press('Escape');await page.waitForFunction(()=>airStudy.phase()==='shelf');await page.waitForFunction(()=>airStudy.info().opacity===1);
    assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,(mobile?'mobile':'desktop')+'.json'),JSON.stringify(snapshots,null,2));
    console.log('PASS '+(mobile?'320px dark':'desktop')+': light-dependent motes/shafts, sun direction, night/off, GPU-only drift, reduced-motion freeze and reading pause. '+JSON.stringify({without:snapshots.without,with:snapshots.sun}));await ctx.close();
  }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
