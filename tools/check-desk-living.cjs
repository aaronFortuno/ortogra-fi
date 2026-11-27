const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:4187';
const output = path.resolve(__dirname, '../tmp/desk');
const instrument = `
  window.deskLiving = {
    phase:()=>phase, info:reading.info, relief:reliefs.info,
    pose:()=>({position:camera.position.toArray(),rotation:camera.quaternion.toArray()}),
    switch:()=>({rotation:rocker.rotation.x,point:projectPoint(switchNode.getWorldPosition(new THREE.Vector3()))}),
    previewTurn:(t,index=2)=>{if(!reading.info().turn)reading.startTurn(index);reading.turn(t);requestRender();
      const mesh=scene.getObjectByName('TurningLeaf'),positions=mesh.geometry.attributes.position;
      const outer=mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,reading.info().turn.direction>0?32:0));
      return {...reading.info().turn,outerY:outer.y};},
    endTurn:()=>{reading.finishTurn(1);requestRender();},
    startRecording:()=>{window.deskFrames=[];const sample=()=>{const info=reading.info().turn;
      const leaf=scene.getObjectByName('TurningLeaf');
      if(leaf&&info){const positions=leaf.geometry.attributes.position;
        const point=i=>leaf.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,i));
        const side=info.direction>0?0:32;
        const a=point(side),b=point(40*33+side),hinge=new THREE.Vector3(...info.hinge);
        const axis=b.clone().sub(a).normalize();
        const anchorDistance=a.clone().sub(hinge).cross(axis).length();
        window.deskFrames.push({...info,anchorDistance,outerY:point(info.direction>0?32:0).y});
      }
      const extraction=reliefs.info().extraction;
      if(extraction)window.deskFrames.push({extraction});
      if(window.deskRecording)requestAnimationFrame(sample);
    };window.deskRecording=true;requestAnimationFrame(sample);},
    stopRecording:()=>{window.deskRecording=false;return window.deskFrames;},
  };
`;
const distance = (a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage(), errors=[], audioRequests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('request',r=>{if(r.url().includes('/desk/audio/'))audioRequests.push(r.url());});
    await page.addInitScript(()=>{
      const NativeDate=Date; window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-11-19T09:00:00Z']));}static now(){return new NativeDate('2026-11-19T09:00:00Z').valueOf();}};
      const Native=window.AudioContext;
      window.AudioContext=class extends Native{constructor(...args){super(...args);window.deskAudio=this;}};
    });
    await page.route('**/daylight.js*',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:(await response.text()).replaceAll('2048, 2048','256, 256')});
    });
    await page.route('**/reliefs.js*',async route=>{
      const response=await route.fetch();
      const body=(await response.text()).replace('  return { prepare, mount,',`window.deskReliefPath=t=>{stored.path(t);return {progress:t,rim:stored.rim,base:new THREE.Box3().setFromObject(selected).min.toArray()};};\n  return { prepare, mount,`);
      await route.fulfill({response,body});
    });
    await page.route('**/scene.js*',async route=>{
      const response=await route.fetch();let body=await response.text();
      body=body.replace('  return { highlight, select, home,',instrument+'\n  return { highlight, select, home,');
      // Lower drawing resolution, not geometry/timing, to sample real movement
      // reliably with the headless software GPU. Other suites capture full size.
      body=body.replace('renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));','renderer.setPixelRatio(.35);');
      body=body.replaceAll('2048, 2048','256, 256');
      body=body.replace('const texture = await new THREE.TextureLoader().loadAsync(sample.image);',`const texture = await new THREE.TextureLoader().loadAsync(sample.image);
        const original=texture.image, small=document.createElement('canvas'), factor=256/Math.max(original.width,original.height);
        small.width=Math.round(original.width*factor);small.height=Math.round(original.height*factor);
        small.getContext('2d').drawImage(original,0,0,small.width,small.height);texture.image=small;`);
      await route.fulfill({response,body});
    });
    await page.goto(origin+'/escriptori/anterior.html');
    await page.locator('#workspace[data-ready=true]').waitFor({timeout:90000});
    if(!process.argv.includes('--relief-only')){
    assert.equal(await page.locator('#ambient-toggle').getAttribute('aria-pressed'),'true');
    await page.locator('[data-view=window]').click();
    await page.locator('#ambient-toggle[data-audio-state=playing]').waitFor();
    assert.equal(audioRequests.filter(url=>url.endsWith('.mp3')).length,6);
    const latch=page.locator('#window-latch');
    await latch.click();
    assert.equal(await latch.getAttribute('aria-pressed'),'true');
    await latch.press('Enter');
    assert.equal(await latch.getAttribute('aria-pressed'),'false');
    assert.equal(await page.evaluate(()=>deskAudio.state),'running');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>deskAudio.state==='suspended');
    assert.equal(await page.locator('#ambient-toggle').getAttribute('data-audio-state'),'paused');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
    await page.locator('#ambient-toggle[data-audio-state=playing]').waitFor();
    assert.equal(audioRequests.filter(url=>url.endsWith('.mp3')).length,6,'Buffers are reused on return');
    await page.locator('#ambient-toggle').click();
    await page.waitForFunction(()=>deskAudio.state==='suspended');
    assert.equal(await page.locator('#ambient-toggle').getAttribute('aria-pressed'),'false');
    await page.reload();
    await page.locator('#workspace[data-ready=true]').waitFor({timeout:90000});
    assert.equal(await page.locator('#ambient-toggle').getAttribute('aria-pressed'),'false','Silence is remembered');
    await page.locator('[data-view=left]').click();
    await page.locator('#wall-light-switch').waitFor({state:'visible'});
    const initialLight=await page.locator('#room-light-toggle').getAttribute('aria-pressed');
    await page.locator('#wall-light-switch').click();
    assert.notEqual(await page.locator('#room-light-toggle').getAttribute('aria-pressed'),initialLight);
    assert.equal(await page.locator('#wall-light-switch').getAttribute('aria-pressed'),await page.locator('#room-light-toggle').getAttribute('aria-pressed'));
    const flipped=await page.evaluate(()=>deskLiving.switch().rotation);
    await page.locator('#room-light-toggle').click();
    assert.ok(Math.abs(flipped-(await page.evaluate(()=>deskLiving.switch().rotation)))>.08,'The real rocker follows both controls');
    await page.locator('[data-area=Llengua]').click();
    await page.locator('[data-project=trama]').click();
    await page.locator('#project-detail.is-visible').waitFor();
    await page.waitForFunction(()=>deskLiving.phase()==='reading');
    for(const index of [2,0]){
      const pathSamples=await page.evaluate(index=>[0,.1,.25,.5,.75,.9,1].map(t=>deskLiving.previewTurn(t,index)),index);
      assert.ok(pathSamples.every(frame=>frame.opacity===1&&Math.abs(frame.angle)>3));
      assert.ok(Math.max(...pathSamples.map(frame=>frame.outerY))>.8,'The complete path rises over the binding in both directions');
      await page.evaluate(()=>deskLiving.endTurn());
    }
    await page.evaluate(()=>deskLiving.previewTurn(.5));
    await page.screenshot({path:path.join(output,'bound-page-halfway.png')});
    await page.evaluate(()=>deskLiving.endTurn());
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    for(const direction of [1,-1]){
      await page.evaluate(()=>deskLiving.startRecording());
      await page.locator(direction>0?'#sample-next':'#sample-previous').click();
      await page.waitForFunction(()=>deskLiving.phase()==='reading');
      const frames=await page.evaluate(()=>deskLiving.stopRecording());
      await fs.writeFile(path.join(output,`bound-page-${direction}.json`),JSON.stringify(frames,null,2));
      const leaves=frames.filter(frame=>frame.progress>0&&frame.progress<1);
      assert.ok(leaves.length>=1,'Observe a visible page turn; deterministic path samples also cover both ends');
      assert.ok(leaves.every(frame=>frame.opacity===1),'Paper does not fade out');
      assert.ok(leaves.every(frame=>frame.anchorDistance<.14),'The inner edge stays attached to the binding');
      assert.ok(leaves.every(frame=>Math.sign(frame.angle)===-direction&&Math.abs(frame.angle)>3),'The leaf crosses to the other side in the natural direction');
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    const originalPose=await page.evaluate(()=>deskLiving.pose());
    await page.locator('#sample-open-inline').click();
    await page.waitForFunction(()=>deskLiving.phase()==='inspecting');
    const inspectPose=await page.evaluate(()=>deskLiving.pose());
    await page.mouse.move(800,150);
    assert.equal(distance(inspectPose.position,(await page.evaluate(()=>deskLiving.pose())).position),0,'Hover does not pan the paper');
    await page.mouse.wheel(0,250);
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>document.querySelector('#sample-counter').textContent==='3 / 3');
    assert.equal(await page.evaluate(()=>deskLiving.phase()),'inspecting','Change examples without leaving the enlarged sheet');
    await page.keyboard.press('ArrowLeft');
    await page.locator('#inspection-previous').click();
    await page.waitForFunction(()=>document.querySelector('#sample-counter').textContent==='1 / 3');
    assert.ok(await page.locator('#inspection-previous').isDisabled());
    await page.locator('#inspection-next').click();
    await page.waitForFunction(()=>document.querySelector('#sample-counter').textContent==='2 / 3');
    assert.equal(await page.evaluate(()=>deskLiving.phase()),'inspecting','Toolbar arrows keep the same enlarged viewer');
    await page.keyboard.press('Escape');
    assert.ok(distance(originalPose.position,(await page.evaluate(()=>deskLiving.pose())).position)<1e-6);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#shelf-controls').inert);
    }
    await page.locator('[data-area=Medi]').click();
    await page.locator('[data-project=relleu-obert]').click();
    await page.locator('#project-detail.is-visible').waitFor();
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>deskLiving.startRecording());
    await page.locator('#sample-open-inline').click();
    await page.waitForFunction(()=>deskLiving.phase()==='inspecting');
    const extraction=(await page.evaluate(()=>deskLiving.stopRecording())).filter(frame=>frame.extraction).map(frame=>frame.extraction);
    assert.ok(extraction.length>=1,'The real sample moves in the rendered scene');
    // Sample all of the production trajectory as well: a software GPU can
    // render only a few of the 820ms frames, so check every crossing numerically
    // with the actual transformed model geometry, then restore its final pose.
    const transport=await page.evaluate(()=>{
      const samples=[];for(let t=.3;t<=.75;t+=.025)samples.push(deskReliefPath(t));
      deskReliefPath(1);return samples;
    });
    await fs.writeFile(path.join(output,'relief-transport.json'),JSON.stringify(transport,null,2));
    assert.ok(transport.every(frame=>frame.base[1]>frame.rim+.05),'The whole base clears the box rim during transport');
    await fs.writeFile(path.join(output,'relief-extraction.json'),JSON.stringify(extraction,null,2));
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>deskLiving.phase()==='reading');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);
    await context.close();
    console.log(process.argv.includes('--relief-only')?'PASS: rendered relief extraction, complete path clears the box rim, and exact return.':'PASS: gesture-unlocked ambience, remembered mute, sash control, suspended/resumed audio, physical light switch, opaque bound page flips both directions, scroll/arrows while enlarged, and relief lifted clear of the box.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
