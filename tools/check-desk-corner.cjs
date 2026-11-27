// Local browser checks. Production analytics and all external requests are blocked.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:4187',out=path.resolve('output/desk-corner');
const seat=[-.22,1.06,.53];
const probe=`const qaScreen=p=>{const v=p.clone().project(camera),r=canvas.getBoundingClientRect();return{x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2};};
const qaControls={trama:()=>models.get('trama').group.localToWorld(new THREE.Vector3(0,-.35,.87)),window:()=>room.sash.localToWorld(new THREE.Vector3(0,0,.5)),lamp:()=>room.switchTarget.getWorldPosition(new THREE.Vector3()),stapler:()=>content.getObjectByName('DeskStapler').localToWorld(new THREE.Vector3(0,.22,.12)),plant:()=>new THREE.Box3().setFromObject(content.getObjectByName('Pothos')).getCenter(new THREE.Vector3())};
return {face:name=>{const d=qaControls[name]().sub(camera.position).normalize(),s=look.info();look.turn(Math.atan2(-d.x,-d.z)-s.yaw,Math.asin(d.y)-s.pitch);},probe:()=>({sheet:inspected?.mesh.position.toArray(),terrain:inspected?.mesh.rotation.toArray(),camera:camera.quaternion.toArray(),down:camera.getWorldDirection(new THREE.Vector3()).y,pages:active?.pages?.map(p=>p.material.map?.image?.src),trama:models.get('trama').group.position.toArray(),tramaHit:qaScreen(qaControls.trama()),shelf:shelf.info(),fly:qaScreen(life.fly.position),flyVisible:life.fly.visible,
leaves:(()=>{const points=[];content.getObjectByName('Pothos')?.traverse(n=>{if(movingLeaves.has(n.name))points.push(qaScreen(new THREE.Box3().setFromObject(n).getCenter(new THREE.Vector3())));});return points;})(),
window:qaScreen(room.sash.localToWorld(new THREE.Vector3(0,0,.5))),windowTravel:room.opening,switch:qaScreen(room.switchTarget.getWorldPosition(new THREE.Vector3())),
stapler:qaScreen(content.getObjectByName('DeskStapler').localToWorld(new THREE.Vector3(0,.22,.12))),pressAngle:staplerPress.rotation.x,
preview:{visible:box.idle.visible,lid:box.lid.rotation.x,triangles:(()=>{let t=0;box.idle.traverse(n=>{if(n.isMesh)t+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;});return t;})()}}),select,close,highlight,`;
async function fixed(page){
  const d=await page.evaluate(()=>seatedStudy.diagnostics()),phase=await page.evaluate(()=>seatedStudy.info().phase);
  if(phase==='shelf')assert.deepEqual(d.look.position,seat,'Exploration stays in the chair and closing restores it exactly');
  else if(['reading','inspecting','changing'].includes(phase)){assert.ok(d.look.position[1]>1.4,'Reading camera is above the material');assert.ok((await page.evaluate(()=>seatedStudy.probe().down))<-.99);}
}
async function phase(page,value){await page.waitForFunction(value=>seatedStudy.info().phase===value,value,{timeout:30000});await fixed(page);}
async function home(page){await page.locator('[data-look=home]').click();await page.waitForFunction(()=>seatedStudy.diagnostics().look.enabled);await fixed(page);}
async function layout(page){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true,'The page fits the screen');
  assert.equal(await page.locator('footer').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight),true,'Footer remains visible');
}
async function open(page,id){
  await page.locator('.list-toggle').click();await page.locator('#project-list button').filter({hasText:({trama:'Trama',pauta:'Pauta','relleu-obert':'Relleu Obert',plec:'Plec'})[id]||id}).click();
  await phase(page,'reading');await page.locator('#material-info.is-visible').waitFor();
}
async function close(page){await page.locator('#material-close').click();await phase(page,'shelf');}

(async()=>{
  await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome'}),report=[];
  try{
    for(const mobile of [false,true]){
      const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},hasTouch:mobile,isMobile:mobile,reducedMotion:mobile?'reduce':'no-preference',colorScheme:mobile?'dark':'light'});
      const errors=[],external=[];await context.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();external.push(r.request().url());return r.abort();});
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
      await page.clock.setFixedTime(new Date('2026-11-27T10:00:00+01:00'));
      await page.route('**/escriptori-v2/app.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace("workspace.dataset.ready='true';","window.seatedStudy=desk;workspace.dataset.ready='true';")});});
      // Camera/plane values only exist in this routed test response, never in the public API.
      await page.route('**/escriptori-v2/scene.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('return {select,close,highlight,',probe)});});
      await page.goto(origin+'/escriptori/');await page.locator('#workspace[data-ready=true]').waitFor({timeout:90000});await page.locator('#desk-loading').waitFor({state:'hidden'});
      await layout(page);await fixed(page);assert.equal(await page.locator('#project-list button').count(),9);assert.equal(await page.locator('[data-website-id]').count(),0);assert.deepEqual(external,[]);
      const initial=await page.evaluate(()=>seatedStudy.diagnostics());assert.ok(initial.calls<300,'Initial render stays below 300 draw calls');assert.ok(initial.triangles<155000);assert.ok(initial.textures<36);assert.equal(initial.dust,820);assert.equal(new Set(initial.garden.depths).size,3);
      if(!mobile)assert.ok(initial.pixelRatio>=.95&&initial.pixelRatio<=1.05,'Exploration keeps moderate resolution');assert.equal(await page.locator('#desk-canvas').evaluate(e=>e.style.imageRendering),'auto');
      await page.screenshot({path:path.join(out,mobile?'mobile-dark.png':'desktop.png')});
      const preview=await page.evaluate(()=>seatedStudy.probe().preview);assert.ok(preview.visible&&preview.lid< -1);assert.ok(preview.triangles<13000,'The initial box uses a real low-detail preview');
      if(!mobile){
        await page.waitForFunction(()=>seatedStudy.diagnostics().life.fly==='resting');const fly=await page.evaluate(()=>seatedStudy.probe().fly),flights=(await page.evaluate(()=>seatedStudy.diagnostics())).life.flights;
        await page.mouse.move(fly.x,fly.y);await page.waitForFunction(old=>seatedStudy.diagnostics().life.flights>old,flights);const from=(await page.evaluate(()=>seatedStudy.diagnostics())).life.position;await page.waitForTimeout(160);assert.notDeepEqual((await page.evaluate(()=>seatedStudy.diagnostics())).life.position,from,'The fly follows a real trajectory');await fixed(page);
        assert.ok((await page.evaluate(()=>seatedStudy.diagnostics())).life.lastDuration<=1.3);await page.waitForFunction(()=>seatedStudy.diagnostics().life.fly!=='flying');
        await page.evaluate(()=>seatedStudy.face('plant'));const points=await page.evaluate(()=>seatedStudy.probe().leaves);for(const point of points){if(point.x<5||point.x>1435||point.y<70||point.y>900)continue;for(const dx of [0,-9,9]){await page.mouse.move(point.x+dx,point.y);await page.waitForTimeout(70);if((await page.evaluate(()=>seatedStudy.diagnostics())).life.brushes)break;}if((await page.evaluate(()=>seatedStudy.diagnostics())).life.brushes)break;}
        await page.waitForFunction(()=>seatedStudy.diagnostics().life.bend>.003,{},{timeout:4000});
        const gardenBefore=(await page.evaluate(()=>seatedStudy.diagnostics())).garden.offsets;await page.evaluate(()=>seatedStudy.face('window'));
        const windowPoint=await page.evaluate(()=>seatedStudy.probe().window);await page.mouse.click(windowPoint.x,windowPoint.y);await page.waitForFunction(()=>seatedStudy.diagnostics().windowOpen);await page.waitForFunction(()=>seatedStudy.probe().windowTravel>.99);assert.equal(await page.locator('#window-toggle').getAttribute('aria-pressed'),'true');
        assert.notDeepEqual((await page.evaluate(()=>seatedStudy.diagnostics())).garden.offsets,gardenBefore);await page.screenshot({path:path.join(out,'window.png')});await page.locator('#window-toggle').click();await page.waitForFunction(()=>seatedStudy.probe().windowTravel<.01);await home(page);
        await page.evaluate(()=>seatedStudy.face('lamp'));const switchPoint=await page.evaluate(()=>seatedStudy.probe().switch);await page.mouse.click(switchPoint.x,switchPoint.y);await page.waitForFunction(()=>!seatedStudy.diagnostics().lampOn);await page.locator('#lamp-toggle').click();await home(page);
        await page.evaluate(()=>seatedStudy.face('stapler'));const staplerPoint=await page.evaluate(()=>seatedStudy.probe().stapler);await page.mouse.click(staplerPoint.x,staplerPoint.y);await page.waitForFunction(()=>seatedStudy.probe().pressAngle>.01);await page.waitForFunction(()=>seatedStudy.probe().pressAngle<.001);await fixed(page);await home(page);
      }
      // Theme is handled once by the shared root script and persists to this origin.
      const theme=await page.locator('html').getAttribute('data-theme');await page.locator('[data-theme-toggle]').click();assert.notEqual(await page.locator('html').getAttribute('data-theme'),theme);await page.locator('[data-theme-toggle]').click();
      const before=await page.evaluate(()=>seatedStudy.diagnostics().look);
      if(mobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:270}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:250,y:290}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
      else {await page.mouse.move(700,265);await page.mouse.down();await page.mouse.move(790,280,{steps:6});await page.mouse.up();}
      assert.notEqual((await page.evaluate(()=>seatedStudy.diagnostics())).look.yaw,before.yaw);await fixed(page);
      await home(page);await page.locator('#desk-canvas').focus();const yaw=(await page.evaluate(()=>seatedStudy.diagnostics())).look.yaw;await page.keyboard.press('ArrowRight');assert.notEqual((await page.evaluate(()=>seatedStudy.diagnostics())).look.yaw,yaw);await fixed(page);await home(page);
      const beforeZoom=await page.evaluate(()=>seatedStudy.diagnostics().look);await page.mouse.move(mobile?200:700,mobile?500:620);await page.mouse.wheel(0,-180);
      await page.waitForFunction(old=>{const l=seatedStudy.diagnostics().look;return l.fov<old-1&&Math.abs(l.fov-l.zoomTarget)<.02;},beforeZoom.fov);
      const zoomed=await page.evaluate(()=>seatedStudy.diagnostics().look);assert.equal(zoomed.pitch,beforeZoom.pitch);assert.equal(zoomed.yaw,beforeZoom.yaw);await fixed(page);
      for(let i=0;i<5;i++)await page.mouse.wheel(0,-1000);await page.waitForFunction(()=>Math.abs(seatedStudy.diagnostics().look.fov-34)<.02);
      for(let i=0;i<5;i++)await page.mouse.wheel(0,1000);await page.waitForFunction(()=>Math.abs(seatedStudy.diagnostics().look.fov-62)<.02);
      await home(page);assert.equal((await page.evaluate(()=>seatedStudy.diagnostics().look)).fov,50);
      // A normal zoom survives the overhead-reading round trip exactly.
      await page.mouse.move(mobile?200:700,mobile?500:620);await page.mouse.wheel(0,-120);await page.waitForFunction(()=>seatedStudy.diagnostics().look.fov===seatedStudy.diagnostics().look.zoomTarget);
      if(!mobile)await page.evaluate(()=>seatedStudy.face('trama'));
      const readingStart=await page.evaluate(()=>seatedStudy.diagnostics().look),readingCamera=await page.evaluate(()=>seatedStudy.probe().camera);
      if(!mobile){
        // A real hit target and the complete animated journey, sampled throughout.
        let sampleRequests=0;await page.route('**/samples/trama*.webp',async r=>{sampleRequests++;await new Promise(resolve=>setTimeout(resolve,1800));await r.continue();});
        const start=await page.evaluate(()=>seatedStudy.probe().trama);
        await page.evaluate(()=>{window.seatSamples=[];window.seatTimer=setInterval(()=>seatSamples.push(seatedStudy.diagnostics().look.position),80);});
        await page.waitForTimeout(60);const hit=await page.evaluate(()=>seatedStudy.probe().tramaHit);await page.mouse.click(hit.x,hit.y);await page.waitForTimeout(450);assert.notDeepEqual(await page.evaluate(()=>seatedStudy.probe().trama),start,'The binder moves while print downloads are delayed');assert.equal((await page.evaluate(()=>seatedStudy.info())).phase,'opening');
        await phase(page,'reading');await page.locator('#material-info.is-visible').waitFor();
        const samples=await page.evaluate(()=>{clearInterval(seatTimer);return seatSamples;});assert.ok(samples.length>15);assert.ok(samples.some(p=>p[1]>1.4));assert.equal(sampleRequests,2,'Only the first spread is requested before reading');await page.unroute('**/samples/trama*.webp');
      }else await open(page,'trama');
      assert.equal(await page.locator('#material-title').textContent(),'Trama');assert.equal(await page.locator('#sample-counter').textContent(),'2 / 3');
      assert.equal(await page.evaluate(()=>seatedStudy.probe().flyVisible),false,'The fly stays out of the reading view');
      const pages=await page.evaluate(()=>seatedStudy.probe().pages);assert.ok(pages.every(Boolean));assert.equal((await page.evaluate(()=>seatedStudy.info())).paired,true);
      await page.screenshot({path:path.join(out,mobile?'mobile-reading.png':'reading.png')});
      await page.locator('#sample-next').click();await page.waitForFunction(()=>seatedStudy.info().index===2);await phase(page,'reading');assert.notDeepEqual(await page.evaluate(()=>seatedStudy.probe().pages),pages);
      await page.locator('#sample-previous').click();await page.waitForFunction(()=>seatedStudy.info().index===1);await phase(page,'reading');
      await page.locator('#sample-inspect').click();await page.locator('#inspection-close').waitFor();await fixed(page);const at=await page.evaluate(()=>seatedStudy.probe().sheet);
      await page.mouse.move(mobile?200:700,mobile?400:450);await page.mouse.wheel(0,240);await page.waitForFunction(old=>JSON.stringify(seatedStudy.probe().sheet)!==JSON.stringify(old),at);
      if(mobile){const old=await page.evaluate(()=>seatedStudy.probe().sheet),cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:400}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y:460}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(old=>JSON.stringify(seatedStudy.probe().sheet)!==JSON.stringify(old),old);await fixed(page);}
      await page.screenshot({path:path.join(out,mobile?'mobile-sheet.png':'sheet.png')});await page.locator('#inspection-close').click();await phase(page,'reading');
      await page.locator('#sample-answer').click();await page.locator('#inspection-close').waitFor();await page.keyboard.press('Escape');await phase(page,'reading');await close(page);
      assert.equal((await page.evaluate(()=>seatedStudy.diagnostics().look)).fov,readingStart.fov);assert.deepEqual(await page.evaluate(()=>seatedStudy.probe().camera),readingCamera);await home(page);
      if(!mobile){
        // Test remaining resources with reduced motion after checking the normal journey.
        await page.emulateMedia({reducedMotion:'reduce'});
        let rerequests=0;const countTrama=r=>{if(r.url().includes('/samples/trama')&&r.url().endsWith('.webp'))rerequests++;};page.on('request',countTrama);await open(page,'trama');await close(page);page.off('request',countTrama);assert.equal(rerequests,0,'Reopening a recent binder reuses its cached spread');
        for(const name of ['Plec','Ressò','Sentit','Fil i Compte','Món a mà','Pentagrama']){
          await page.locator('.list-toggle').click();await page.getByRole('button',{name,exact:false}).filter({has:page.locator('small')}).click();await phase(page,'reading');await close(page);
        }
      }
      await open(page,'pauta');assert.equal(await page.locator('#sample-answer').textContent(),'Acosta la segona plantilla');await page.locator('#sample-answer').click();await page.locator('#inspection-close').waitFor();await fixed(page);await page.locator('#inspection-close').click();await close(page);
      await open(page,'relleu-obert');assert.equal(await page.locator('#sample-answer').isHidden(),true);await page.locator('#sample-inspect').click();await page.locator('#inspection-close').waitFor();await fixed(page);
      const angle=await page.evaluate(()=>seatedStudy.probe().terrain);await page.mouse.move(mobile?190:700,mobile?350:430);await page.mouse.down();await page.mouse.move(mobile?235:800,mobile?375:460,{steps:5});await page.mouse.up();assert.notDeepEqual(await page.evaluate(()=>seatedStudy.probe().terrain),angle);
      await page.screenshot({path:path.join(out,mobile?'mobile-terrain.png':'terrain.png')});await page.locator('#inspection-close').click();await phase(page,'reading');
      for(let i=1;i<3;i++){await page.locator('#sample-next').click();await page.waitForFunction(i=>seatedStudy.info().index===i,i);await fixed(page);}
      await close(page);await page.locator('#lamp-toggle').click();await page.locator('#window-toggle').click();const ambient=await page.evaluate(()=>seatedStudy.diagnostics());assert.equal(ambient.lampOn,false);assert.equal(ambient.windowOpen,true);
      await page.locator('#about-open').click();await page.locator('#about-dialog.is-visible').waitFor();await page.keyboard.press('Escape');await page.locator('#about-dialog').waitFor({state:'hidden'});await layout(page);
      if(mobile){await page.setViewportSize({width:320,height:568});await layout(page);await fixed(page);await page.screenshot({path:path.join(out,'small-mobile.png')});}
      assert.deepEqual(errors,[]);report.push({mode:mobile?'mobile-dark-reduced':'desktop',initial});await context.close();
    }
    const failed=await browser.newContext({reducedMotion:'reduce'});await failed.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const recovery=await failed.newPage();await recovery.route('**/escriptori-v2/app.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace("workspace.dataset.ready='true';","window.seatedStudy=desk;workspace.dataset.ready='true';")});});
    await recovery.route('**/samples/trama*.webp',r=>r.abort());await recovery.goto(origin+'/escriptori/');await recovery.locator('#workspace[data-ready=true]').waitFor({timeout:90000});await recovery.locator('#desk-loading').waitFor({state:'hidden'});await recovery.locator('.list-toggle').click();await recovery.locator('#project-list button').filter({hasText:'Trama'}).click();
    await recovery.waitForFunction(()=>document.querySelector('#desk-status').textContent.includes('No s’ha pogut'));assert.equal(await recovery.locator('.view-tools').evaluate(e=>e.inert),false);assert.deepEqual(await recovery.evaluate(()=>seatedStudy.diagnostics().look.position),seat);
    await recovery.unroute('**/samples/trama*.webp');await recovery.locator('.list-toggle').click();await recovery.locator('#project-list button').filter({hasText:'Trama'}).click();await recovery.locator('#material-info.is-visible').waitFor();assert.equal(await recovery.locator('#material-title').textContent(),'Trama');await recovery.close();
    await failed.route('**/escriptori.glb*',r=>r.abort());const page=await failed.newPage();await page.goto(origin+'/escriptori-v2/');await page.locator('#workspace.failed').waitFor({timeout:30000});assert.equal(await page.locator('#project-list a').count(),9,'Loading failure offers real links to every resource');assert.equal(await page.locator('#projectes').evaluate(e=>e.inert),false);await failed.close();
    console.log('PASS: optical zoom without tilt, exact reading return, smoother finish, overhead reading, delayed downloads, garden, dust, fly, all 9 resources, mobile and render budget.');console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
