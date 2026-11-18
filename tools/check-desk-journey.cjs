const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:4187';
const output = path.resolve(__dirname, '../tmp/desk');
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));

const instrument = `
    if (active && (phase === 'opening' || phase === 'closing')) {
      const body = active.group.localToWorld(active.outlineBounds.getCenter(new THREE.Vector3()));
      const centers = [body];
      if (Math.abs(active.lid.rotation[active.axis]) > .05) {
        const points = reading.points(narrow.matches);
        for (let i = 0; i < points.length; i += 4) centers.push(new THREE.Box3().setFromPoints(points.slice(i, i + 4)).getCenter(new THREE.Vector3()));
      }
      window.deskFrames ||= [];
      window.deskFrames.push({ id:active.project.id, phase, time, position:active.group.position.toArray(), camera:camera.position.toArray(), centers:centers.map(point=>point.project(camera).toArray()) });
    }
`;

function checkFrames(frames, phase) {
  const values = frames.filter(frame => frame.phase === phase);
  assert.ok(values.length >= 5, phase + ': enough rendered frames to inspect the journey');
  for (const frame of values) {
    assert.ok(frame.centers.some(([x,y,z]) => Math.abs(x)<1 && Math.abs(y)<1 && z>-1 && z<1), `${frame.id} ${phase}: selected material left the frame at ${frame.time}`);
    assert.ok(frame.camera[1] < 7.6 && Math.abs(frame.camera[0]) < 8, `${frame.id} ${phase}: camera left the room`);
  }
  const start = values[0].time, span = values.at(-1).time - start;
  assert.ok(span > 2200, phase + ': retain the deliberately slow pace');
  for (let i = 1; i < values.length; i++) {
    const u = (values[i].time - start) / span;
    if (u < .15 || u > .85) continue;
    assert.ok(distance(values[i].position, values[i-1].position) > 1e-5, phase + ': the object stopped in the middle');
    assert.ok(distance(values[i].camera, values[i-1].camera) > 1e-5, phase + ': the camera stopped in the middle');
  }
}
(async () => {
  await fs.mkdir(output,{recursive:true});
  const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const capture = process.argv.includes('--captures');
    for (const layout of capture ? ['desktop'] : ['desktop','mobile','tablet']) {
      const mobile = layout === 'mobile';
      const context = await browser.newContext({viewport:mobile?{width:390,height:844}:layout==='tablet'?{width:768,height:1024}:{width:1440,height:960},reducedMotion:'reduce',hasTouch:mobile});
      await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      const page = await context.newPage(), errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/scene.js*',async route=>{
        const response=await route.fetch(), source=await response.text();
        assert.ok(source.includes('renderer.render(scene, camera);'));
        // SwiftShader needs a small drawing buffer to sample a real-time path.
        // Camera geometry, viewport, trajectories and production timing stay intact.
        const body = source.replace('renderer.render(scene, camera);',instrument+'\n    renderer.render(scene, camera);')
          .replace('const motions = new Map();', 'const motions = new Map(); window.deskMoving = () => motions.has("view");')
          .replace('const camera = new THREE.PerspectiveCamera(32, 1, .06, 75);', 'const camera = new THREE.PerspectiveCamera(32, 1, .06, 75); Object.defineProperty(window, "deskCamera", {get:()=>({position:camera.position.toArray(),rotation:camera.quaternion.toArray()})});')
          .replace('renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));', 'renderer.setPixelRatio(.3);')
          .replace('daylight.shadow.mapSize.set(2048, 2048);', 'daylight.shadow.mapSize.set(256, 256);');
        await route.fulfill({response,body:process.argv.includes('--captures') ? body.replace('const journeyDuration = 2500;', 'const journeyDuration = 8000;') : body});
      });
      await page.goto(origin+'/escriptori/');
      await page.locator('#workspace[data-ready=true]').waitFor({timeout:60000});
      await page.emulateMedia({reducedMotion:'no-preference'});
      for (const id of capture ? ['plec'] : mobile?['sentit','pauta']:layout==='tablet'?['plec','pauta']:['plec','trama','relleu-obert']) {
        if (id === 'trama') {
          await page.locator('[data-view=left]').click();
          await page.waitForFunction(()=>!window.deskMoving());
          await page.locator('[data-view=in]').click();
          await page.waitForFunction(()=>!window.deskMoving());
        }
        if (id === 'relleu-obert') {await page.locator('[data-view=home]').click();await page.waitForFunction(()=>!window.deskMoving());}
        if (id === 'pauta' && mobile) await page.locator('[data-area=Utilitats]').click();
        const initial=await page.evaluate(()=>window.deskCamera);
        await page.evaluate(()=>{window.deskFrames=[];});
        await page.locator('[data-project='+id+']').click();
        if (id === 'plec' && process.argv.includes('--captures')) for (let i=1;i<=4;i++) {
          await page.waitForTimeout(1100);
          await page.screenshot({path:path.join(output,'journey-'+i+'.png')});
        }
        await page.locator('#project-detail.is-visible').waitFor({timeout:30000});
        if (capture) await page.screenshot({path:path.join(output,'journey-5.png')});
        const openingFrames = await page.evaluate(()=>window.deskFrames);
        await fs.writeFile(path.join(output,'journey-'+id+'-'+layout+(capture?'-captures':'')+'-opening.json'),JSON.stringify(openingFrames));
        checkFrames(openingFrames,'opening');
        await page.keyboard.press('Escape');
        await page.waitForFunction(()=>!document.querySelector('#project-detail').open&&!document.querySelector('#shelf-controls').inert);
        const frames=await page.evaluate(()=>window.deskFrames);
        checkFrames(frames,'closing');
        const restored=await page.evaluate(()=>window.deskCamera);
        assert.ok(distance(initial.position,restored.position)<1e-6,'Restore the previous camera position: '+JSON.stringify({initial,restored}));
        assert.ok(distance(initial.rotation,restored.rotation)<1e-6,'Restore the previous viewing direction');
        await fs.writeFile(path.join(output,'journey-'+id+'-'+layout+(capture?'-captures':'')+'.json'),JSON.stringify(frames));
        console.log('OK '+id+' '+layout+': continuous travel, visible throughout and exact camera return');
      }
      assert.deepEqual(errors,[]);
      await context.close();
    }
    console.log(capture ? 'PASS: slowed visual sequence of the continuous binder journey.' : 'PASS: one continuous object/camera journey, subject tracking, binder/box/folder, rotated/zoomed start, mobile and exact return.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
