const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:4187';
const output = path.resolve(__dirname, '../tmp/desk');
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));

const instrument = `
  window.deskSampleTest = {
    pose: () => ({ position:camera.position.toArray(), rotation:camera.quaternion.toArray(), forward:new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).toArray() }),
    paper: index => {const p=reading.sheetView(index);return {normal:p.normal.toArray(),up:p.up.toArray(),height:p.height};},
    inspection:()=>reliefs.info().open?reliefs.info():paperView.info(),
    relief:reliefs.info,
    reliefMesh:()=>{let triangles=0,meshes=0,textures=[];scene.getObjectByName('ReliefSample_0')?.traverse(m=>{if(m.isMesh){meshes++;if(m.material.map)textures.push([m.material.map.image.width,m.material.map.image.height]);triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;}});return{meshes,triangles,textures};},
    phase:()=>phase,
    ink:()=>reading.info().pages.map(p=>p.image),
    curl:()=>Math.max(...scene.getObjectByName('PrintedSample').geometry.attributes.position.array.filter((_,i)=>i%3===2),...scene.getObjectByName('PrintedAnswer').geometry.attributes.position.array.filter((_,i)=>i%3===2)),
  };
`;
async function open(page, id, mobile) {
  const area=['pauta','pentagrama'].includes(id)?'Utilitats':id==='relleu-obert'?'Medi':id==='fil-i-compte'?'Matemàtiques':'Llengua';
  const button=page.locator(`[data-area="${area}"]`);if(await button.getAttribute('aria-pressed')!=='true')await button.click();
  await page.locator(`[data-project="${id}"]`).click();
  await page.locator('#project-detail.is-visible').waitFor();
  await page.waitForFunction(() => window.deskSampleTest.phase() === 'reading');
}
async function back(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#project-detail').open && !document.querySelector('#shelf-controls').inert);
}
async function inspect(page, side, mobile, screenshot) {
  const before = await page.evaluate(() => window.deskSampleTest.pose());
  await page.locator(['#sample-open-inline','#sample-open-second','#sample-open-third-inline'][side]).click();
  await page.waitForFunction(() => window.deskSampleTest.phase() === 'inspecting');
  assert.equal(await page.locator('dialog[open]').count(), 1, 'Camera inspection must not open a second modal');
  const zoom = await page.evaluate(index => ({ pose:window.deskSampleTest.pose(),paper:window.deskSampleTest.relief().open?null:window.deskSampleTest.paper(index) }), side);
  assert.ok(distance(before.position, zoom.pose.position) > .2, 'Actually move the camera nearer the paper');
  const isRelief=await page.evaluate(()=>window.deskSampleTest.relief().open);
  if(!isRelief){
    const dot = zoom.pose.forward.reduce((sum, x, i) => sum + x * zoom.paper.normal[i], 0);
    assert.ok(dot < -.99999, 'The enlarged view must be perpendicular to this physical sheet');
    await page.waitForFunction(selector=>document.querySelector(selector).getBoundingClientRect().height > innerHeight - 116,side ? '#sample-open-answers' : '#sample-open');
  }else{
    const geometry=await page.evaluate(()=>window.deskSampleTest.reliefMesh());
    assert.ok(geometry.meshes===2&&geometry.triangles>70000&&geometry.triangles<100000&&geometry.textures.some(t=>t[0]===512&&t[1]===512),'The sample must use detailed geometry and a smooth 512px colour texture in two draw calls');
    const initial=await page.evaluate(()=>window.deskSampleTest.relief());
    await page.locator('#relief-zoom-in').click();
    assert.ok((await page.evaluate(()=>window.deskSampleTest.relief())).distance<initial.distance);
    await page.locator('#relief-reset').click();
  }
  if (screenshot) await page.screenshot({path:path.join(output,screenshot)});
  if (side && await page.locator('#project-title').innerText() === 'Trama') {
    const downloading=page.waitForEvent('download'); await page.locator('#sample-pdf').click();
    const download=await downloading; const destination=path.join(output,'sample-download.pdf');
    await download.saveAs(destination);
    assert.equal((await fs.readFile(destination)).subarray(0,5).toString(),'%PDF-');
  }
  const area = await page.locator('#sample-inspection').boundingBox();
  if (mobile) {
    const cdp = await page.context().newCDPSession(page);
    const x = area.x + area.width * .5, y = area.y + area.height * .5;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-100}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await page.locator('#project-detail').getAttribute('data-inspecting'),'true','Dragging must not act as the return click');
    if(isRelief)assert.ok((await page.evaluate(()=>window.deskSampleTest.relief())).pitch<.85);
    else await page.waitForFunction(()=>window.deskSampleTest.inspection().panY < -.1);
  } else {
    if(isRelief){
      const original=await page.evaluate(()=>window.deskSampleTest.relief());
      await page.mouse.move(area.x+area.width/2,area.y+area.height/2);await page.mouse.down();
      await page.mouse.move(area.x+area.width/2+110,area.y+area.height/2+35,{steps:5});await page.mouse.up();
      const rotated=await page.evaluate(()=>window.deskSampleTest.relief());
      assert.ok(Math.abs(rotated.yaw-original.yaw)>.5&&Math.abs(rotated.pitch-original.pitch)>.1,'Dragging rotates and pivots the real model');
    }else{
    await page.mouse.move(area.x + area.width / 2, area.y + 20);
    assert.equal((await page.evaluate(()=>window.deskSampleTest.inspection())).panY,0,'Hovering alone must not move the sheet');
    await page.mouse.wheel(0,-400);
    await page.waitForFunction(()=>window.deskSampleTest.inspection().panY > .9);
    const upper = await page.evaluate(()=>window.deskSampleTest.pose());
    await page.mouse.wheel(0,800);
    await page.waitForFunction(()=>window.deskSampleTest.inspection().panY < -.7);
    const lower = await page.evaluate(()=>window.deskSampleTest.pose());
    assert.ok(distance(upper.position,lower.position) > .1,'Reach both ends of the sheet');
    }
  }
  if (mobile) await page.touchscreen.tap(area.x + 60, area.y + 60);
  else if (side) await page.locator('#sample-inspection').click({position:{x:60,y:60}});
  else await page.keyboard.press('Escape');
  await page.waitForFunction(()=>window.deskSampleTest.phase()==='reading').catch(async error=>{
    console.error(JSON.stringify(await page.evaluate(()=>({phase:window.deskSampleTest.phase(),inspection:window.deskSampleTest.inspection(),open:document.querySelector('#project-detail').open,attrs:{...document.querySelector('#project-detail').dataset},events:window.deskEvents})),null,2));throw error;
  });
  const restored=await page.evaluate(()=>window.deskSampleTest.pose());
  assert.ok(distance(before.position,restored.position)<1e-6,'Restore the exact open-table viewpoint');
  assert.ok(distance(before.rotation,restored.rotation)<1e-6,'Restore the exact open-table orientation');
  assert.ok(await page.locator('#project-detail').evaluate(e=>e.open),'The first Escape returns to the table: '+JSON.stringify(await page.evaluate(()=>window.deskEvents||[])));
}

(async () => {
  await fs.mkdir(output,{recursive:true});
  const catalogue = JSON.parse(await fs.readFile(path.resolve(__dirname,'../assets/desk/samples/examples.json')));
  assert.equal(Object.keys(catalogue).length,8);
  for (const [id,examples] of Object.entries(catalogue)) {
    assert.equal(examples.length,3,id+' must have three examples');
    assert.equal(new Set(examples.map(e=>e.title)).size,3,id+' must have distinct materials');
    for (const example of examples) {
      assert.equal(example.pages.length,2);
      for (const sample of example.pages) {
        assert.ok((await fs.stat(path.resolve(__dirname,'../assets/desk/samples',sample.image))).size>1000);
        if (sample.pdf) assert.equal((await fs.readFile(path.resolve(__dirname,'../assets/desk/samples',sample.pdf))).subarray(0,5).toString(),'%PDF-');
      }
    }
  }
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    for (const [width,height,theme] of (process.argv.includes('--desktop') ? [[1440,960,'light']] : process.argv.includes('--mobile') ? [[390,844,'light'],[320,568,'dark']] : [[1440,960,'light'],[390,844,'light'],[320,568,'dark']])) {
      const requestedWidth=process.argv.find(arg=>arg.startsWith('--width='))?.split('=')[1];
      if(requestedWidth&&width!==Number(requestedWidth))continue;
      const mobile=width<700;
      const context=await browser.newContext({viewport:{width,height},hasTouch:mobile,colorScheme:theme,reducedMotion:'reduce'});
      await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      const page=await context.newPage(),errors=[];
      await page.addInitScript(()=>{window.deskEvents=[];for(const type of ['keydown','keyup','cancel','close','click','pointerdown','pointerup','pointercancel'])document.addEventListener(type,e=>{if(['Escape','Enter',' '].includes(e.key)||['cancel','close','click','pointerdown','pointerup','pointercancel'].includes(type))window.deskEvents.push({type,target:e.target.id,key:e.key,pointer:e.pointerId,open:document.querySelector('#project-detail')?.open,inspect:document.querySelector('#project-detail')?.dataset.inspecting});},true);});
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.route('**/scene.js*',async route=>{const response=await route.fetch();const body=(await response.text()).replace('  return { highlight, select, home,',instrument+'\n  return { highlight, select, home,');await route.fulfill({response,body});});
      await page.goto(origin+'/escriptori/');
      await page.locator('#workspace[data-ready=true]').waitFor({timeout:60000});
      for (const id of process.argv.find(a=>a.startsWith('--project=')) ? process.argv.find(a=>a.startsWith('--project=')).split('=')[1].split(',') : mobile ? ['trama','pauta'] : ['trama','pauta','pentagrama','plec','sentit','fil-i-compte','resso','relleu-obert']) {
        await open(page,id,mobile);
        if(id==='relleu-obert'){
          assert.equal((await page.evaluate(()=>window.deskSampleTest.relief())).models.length,3);
          assert.ok(await page.locator('.sample-pager').isHidden());
          await page.screenshot({path:path.join(output,`examples-${id}-${width}-${theme}.png`)});
          for(const side of [0,1,2])await inspect(page,side,mobile,`zenith-${id}-${side}-${width}-${theme}.png`);
          await back(page);console.log('OK '+id+' '+width+' '+theme);continue;
        }
        assert.equal(await page.locator('#sample-counter').innerText(),'2 / 3','Always start at the middle example');
        const panel=await page.locator('.description-page').boundingBox();
        assert.ok(panel.x>=0 && panel.x+panel.width<=width && panel.y+panel.height<=height-40,'External panel stays in the viewport');
        assert.equal(await page.locator('.description-page').evaluate(e=>getComputedStyle(e).transform),'none');
        assert.equal(await page.locator('#project-description').evaluate(e=>getComputedStyle(e).fontSize),'16px');
        const initial=await page.evaluate(()=>window.deskSampleTest.ink());
        if(id!=='relleu-obert'){await page.locator('#page-corner-next').hover();await page.waitForFunction(()=>window.deskSampleTest.curl()>.02);}
        await page.locator('#sample-next').click();
        await page.waitForFunction(()=>document.querySelector('#sample-counter').textContent==='3 / 3');
        assert.ok(await page.locator('#sample-next').isDisabled());
        assert.notDeepEqual(await page.evaluate(()=>window.deskSampleTest.ink()),initial,'A new example changes the actual printed materials');
        await page.locator('#sample-previous').click();
        await page.locator('#sample-previous').click();
        await page.waitForFunction(()=>document.querySelector('#sample-counter').textContent==='1 / 3');
        assert.ok(await page.locator('#sample-previous').isDisabled());
        await page.locator('#sample-next').click();
        await page.waitForFunction(()=>document.querySelector('#sample-counter').textContent==='2 / 3');
        if (['trama','pauta','relleu-obert'].includes(id)) {
          await page.screenshot({path:path.join(output,`examples-${id}-${width}-${theme}.png`)});
          await inspect(page,0,mobile,`zenith-${id}-${width}-${theme}.png`);
          if (!mobile) await inspect(page,1,false);
        }
        await back(page);
        console.log('OK '+id+' '+width+' '+theme);
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(errors,[]);
      await context.close();
    }
    console.log('PASS: three real examples per tool, paired sheets, curled corners, external readable panels, zenith camera, mouse/touch panning, exact return, mobile and dark theme.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
