const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:4187',pass=process.argv[2]||'after',out=path.resolve('output/desk/realism',pass);
const probe=`window.realism={
  phase:()=>phase,view:moveView,moment:iso=>lighting.setMoment(new Date(iso)),
  idle:()=>typeof idleCamera==='undefined'?null:idleCamera.info(),
  contactVertices:()=>Array.from(scene.getObjectByName('StationeryContactOcclusion')?.geometry.attributes.position.array||[]),
  pose:()=>({position:camera.position.toArray(),rotation:camera.quaternion.toArray(),target:navigation.target.toArray()}),
  stats(){const geometry=new Set();scene.traverse(n=>{if(n.isMesh||n.isPoints)geometry.add(n.geometry)});
    return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,
      geometryBytes:[...geometry].reduce((sum,g)=>sum+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(g.index?.array.byteLength||0),0),
      lights:scene.children.filter(n=>n.isLight).length,
      materials:[...materials].map(m=>({name:m.name,roughness:m.roughness,metalness:m.metalness,clearcoat:m.clearcoat,sheen:m.sheen})),
      contacts:contactShadows.stats?.(),cameraMotion:canvas.dataset.cameraMotion};},
  bench(){const samples=[],gl=renderer.getContext();for(let i=0;i<25;i++){const t=performance.now();renderer.render(scene,camera);gl.finish();if(i>=5)samples.push(performance.now()-t)}samples.sort((a,b)=>a-b);return {medianMs:samples[10],p95Ms:samples[18]};},
};`;
(async()=>{
  await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const mobile of [false,true]){
      const context=await browser.newContext({viewport:mobile?{width:320,height:568}:{width:1440,height:960},reducedMotion:'reduce',colorScheme:mobile?'dark':'light'});
      await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      await context.addInitScript(()=>{const D=Date;window.Date=class extends D{constructor(...args){super(...(args.length?args:['2026-11-22T10:00:00Z']))}static now(){return D.parse('2026-11-22T10:00:00Z')}}});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
      await page.route('**/scene.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('  return { highlight, select, home,',probe+'\n  return { highlight, select, home,')})});
      await page.route('**/stationery.js*',async r=>{const response=await r.fetch();const helper=`window.realismProps={move(name,x,y,z){const i=items.find(i=>i.node.name===name);const p=i.node.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(x,y,z));room.attach(i.node);setWorld(i.node,p);refreshItem(i);invalidate(i);redraw();}};`;
        await r.fulfill({response,body:(await response.text()).replaceAll('\r\n','\n').replace('  return {\n    cancel: rollback,',helper+'\n  return {\n    cancel: rollback,')})});
      await page.goto(origin+'/escriptori/');await page.locator('#workspace[data-ready=true]').waitFor({timeout:90000});await page.locator('#desk-loading').waitFor({state:'hidden'});
      const snapshots={};
      async function snap(name){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(out,name+'.png')});snapshots[name]=await page.evaluate(()=>({stats:realism.stats(),bench:realism.bench()}));}
      await snap(mobile?'mobile-day':'overview-day');
      if(!mobile){await page.evaluate(()=>realism.view('fulls'));await snap('stationery-day');await page.evaluate(()=>realism.view('potus'));await snap('plant-day');await page.evaluate(()=>realism.view('home'));}
      await page.evaluate(()=>realism.moment('2026-11-22T22:00:00Z'));await snap(mobile?'mobile-night':'overview-night');
      if(pass==='after'){
        let baseline=null;
        try{baseline=JSON.parse(await fs.readFile(path.resolve('output/desk/realism/before',mobile?'mobile.json':'desktop.json')));}catch(e){if(e.code!=='ENOENT')throw e;}
        for(const [name,{stats}]of Object.entries(snapshots)){
          assert.ok(stats.contacts.stamps<=40);assert.ok(stats.contacts.bytes<=4096);
          if(baseline){
            const before=baseline[name].stats;assert.ok(stats.calls<=before.calls+3,'One contact batch and at most two air-light draws');
            assert.ok(stats.triangles<=before.triangles+88);assert.equal(stats.textures,before.textures+1);assert.equal(stats.lights,before.lights);
            assert.ok(stats.geometryBytes<=before.geometryBytes+32768,'Contact and air geometry stay within 32 KiB');
          }
        }
        if(!mobile){
          const updates=await page.evaluate(()=>realism.stats().contacts.updates);
          await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('canvas').dataset.cameraMotion==='drifting',{},{timeout:10000});
          const before=await page.evaluate(()=>realism.pose());await page.waitForTimeout(1000);const after=await page.evaluate(()=>realism.pose());
          const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
          assert.ok(distance(before.rotation,after.rotation)>.00003,'The idle view subtly pivots');assert.ok(distance(before.rotation,after.rotation)<.003);
          assert.ok(distance(before.position,after.position)<.015,'The eye remains almost still');
          assert.equal(await page.evaluate(()=>realism.stats().contacts.updates),updates,'Camera movement never rebuilds contact geometry');
          await page.mouse.move(1260,145);await page.mouse.down();const held=await page.evaluate(()=>realism.pose());await page.waitForTimeout(300);
          assert.deepEqual(await page.evaluate(()=>realism.pose()),held,'Input freezes the exact visible camera before picking');await page.mouse.up();
          await page.locator('[data-project=trama]').click();await page.waitForFunction(()=>realism.phase()==='reading',{},{timeout:20000});
          const reading=await page.evaluate(()=>realism.pose());await page.waitForTimeout(350);assert.deepEqual(await page.evaluate(()=>realism.pose()),reading,'Reading never breathes');
          await page.keyboard.press('Escape');await page.waitForFunction(()=>realism.phase()==='shelf');
          await page.emulateMedia({reducedMotion:'reduce'});const still=await page.evaluate(()=>realism.pose());await page.waitForTimeout(400);
          assert.deepEqual(await page.evaluate(()=>realism.pose()),still,'Reduced motion keeps the eye still');
          const contacts=await page.evaluate(()=>({stats:realism.stats().contacts,vertices:realism.contactVertices()}));
          await page.evaluate(()=>realismProps.move('LoosePencil',.4,.4,0));
          await page.waitForFunction(count=>realism.stats().contacts.stamps<count,contacts.stats.stamps);
          await page.evaluate(()=>realismProps.move('LoosePencil',.2,-.4,0));
          await page.waitForFunction(count=>realism.stats().contacts.stamps===count,contacts.stats.stamps);
          assert.notDeepEqual(await page.evaluate(()=>realism.contactVertices()),contacts.vertices,'Contact moves to the new resting point without a ghost');
          console.log('PASS: bounded idle pivot, exact input freeze, still reading/reduced motion, no contact rebuilds on camera movement.');
        }else{
          await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(4200);
          assert.equal(await page.evaluate(()=>document.querySelector('canvas').dataset.cameraMotion),'still','Small screens do not drift');
        }
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,(mobile?'mobile':'desktop')+'.json'),JSON.stringify(snapshots,null,2));
      console.log('PASS '+(mobile?'320px dark':'desktop')+': '+JSON.stringify(Object.fromEntries(Object.entries(snapshots).map(([key,v])=>[key,{calls:v.stats.calls,triangles:v.stats.triangles,textures:v.stats.textures,bytes:v.stats.geometryBytes,...v.bench}]))));
      await context.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
