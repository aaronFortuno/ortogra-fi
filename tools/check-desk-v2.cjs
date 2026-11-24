// Local browser checks. Production analytics and all external requests are blocked.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:4187',out=path.resolve('output/desk-v2');
const seat=[0,1.16,.73];
async function fixed(page){assert.deepEqual((await page.evaluate(()=>seatedStudy.diagnostics())).look.position,seat,'The viewer never leaves the chair');}
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
      await page.route('**/escriptori-v2/app.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace("workspace.dataset.ready='true';","window.seatedStudy=desk;workspace.dataset.ready='true';")});});
      // Camera/plane values only exist in this routed test response, never in the public API.
      await page.route('**/escriptori-v2/scene.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('return {select,close,highlight,','return {probe:()=>({sheet:inspected?.mesh.position.toArray(),terrain:inspected?.mesh.rotation.toArray(),camera:camera.quaternion.toArray(),pages:active?.pages?.map(p=>p.material.map?.image?.src),shelf:shelf.info(),plant:content.getObjectByName(\'Pothos\')?.children.length}),select,close,highlight,')});});
      await page.goto(origin+'/escriptori-v2/');await page.locator('#workspace[data-ready=true]').waitFor({timeout:90000});await page.locator('#desk-loading').waitFor({state:'hidden'});
      await layout(page);await fixed(page);assert.equal(await page.locator('#project-list button').count(),8);assert.equal(await page.locator('[data-website-id]').count(),0);assert.deepEqual(external,[]);
      const initial=await page.evaluate(()=>seatedStudy.diagnostics());assert.ok(initial.calls<240,'Initial render stays below 240 draw calls');assert.ok(initial.triangles<110000);assert.ok(initial.textures<32);
      await page.screenshot({path:path.join(out,mobile?'mobile-dark.png':'desktop.png')});
      // Theme is handled once by the shared root script and persists to this origin.
      const theme=await page.locator('html').getAttribute('data-theme');await page.locator('[data-theme-toggle]').click();assert.notEqual(await page.locator('html').getAttribute('data-theme'),theme);await page.locator('[data-theme-toggle]').click();
      const before=await page.evaluate(()=>seatedStudy.diagnostics().look);
      if(mobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:270}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:250,y:290}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
      else {await page.mouse.move(700,265);await page.mouse.down();await page.mouse.move(790,280,{steps:6});await page.mouse.up();}
      assert.notEqual((await page.evaluate(()=>seatedStudy.diagnostics())).look.yaw,before.yaw);await fixed(page);
      await home(page);await page.locator('#desk-canvas').focus();const yaw=(await page.evaluate(()=>seatedStudy.diagnostics())).look.yaw;await page.keyboard.press('ArrowRight');assert.notEqual((await page.evaluate(()=>seatedStudy.diagnostics())).look.yaw,yaw);await fixed(page);await home(page);
      await page.mouse.move(mobile?200:700,mobile?500:620);await page.mouse.wheel(0,180);await fixed(page);await home(page);
      if(!mobile){
        // A real hit target and the complete animated journey, sampled throughout.
        await page.evaluate(()=>{window.seatSamples=[];window.seatTimer=setInterval(()=>seatSamples.push(seatedStudy.diagnostics().look.position),80);});
        await page.locator('[data-project=trama]').click();await phase(page,'reading');await page.locator('#material-info.is-visible').waitFor();
        const samples=await page.evaluate(()=>{clearInterval(seatTimer);return seatSamples;});assert.ok(samples.length>15);for(const p of samples)assert.deepEqual(p,seat);
      }else await open(page,'trama');
      assert.equal(await page.locator('#material-title').textContent(),'Trama');assert.equal(await page.locator('#sample-counter').textContent(),'2 / 3');
      const pages=await page.evaluate(()=>seatedStudy.probe().pages);assert.ok(pages.every(Boolean));assert.equal((await page.evaluate(()=>seatedStudy.info())).paired,true);
      await page.screenshot({path:path.join(out,mobile?'mobile-reading.png':'reading.png')});
      await page.locator('#sample-next').click();await page.waitForFunction(()=>seatedStudy.info().index===2);await phase(page,'reading');assert.notDeepEqual(await page.evaluate(()=>seatedStudy.probe().pages),pages);
      await page.locator('#sample-previous').click();await page.waitForFunction(()=>seatedStudy.info().index===1);await phase(page,'reading');
      await page.locator('#sample-inspect').click();await page.locator('#inspection-close').waitFor();await fixed(page);const at=await page.evaluate(()=>seatedStudy.probe().sheet);
      await page.mouse.move(mobile?200:700,mobile?400:450);await page.mouse.wheel(0,240);await page.waitForFunction(old=>JSON.stringify(seatedStudy.probe().sheet)!==JSON.stringify(old),at);
      if(mobile){const old=await page.evaluate(()=>seatedStudy.probe().sheet),cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:400}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y:460}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(old=>JSON.stringify(seatedStudy.probe().sheet)!==JSON.stringify(old),old);await fixed(page);}
      await page.screenshot({path:path.join(out,mobile?'mobile-sheet.png':'sheet.png')});await page.locator('#inspection-close').click();await phase(page,'reading');
      await page.locator('#sample-answer').click();await page.locator('#inspection-close').waitFor();await page.keyboard.press('Escape');await phase(page,'reading');await close(page);
      if(!mobile){
        // Test remaining resources with reduced motion after checking the normal journey.
        await page.emulateMedia({reducedMotion:'reduce'});
        for(const name of ['Plec','Ressò','Sentit','Fil i Compte','Pentagrama']){
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
    const failed=await browser.newContext({reducedMotion:'reduce'});await failed.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await failed.route('**/escriptori.glb*',r=>r.abort());const page=await failed.newPage();await page.goto(origin+'/escriptori-v2/');await page.locator('#workspace.failed').waitFor({timeout:30000});assert.equal(await page.locator('#project-list a').count(),8,'Loading failure offers real links to every resource');assert.equal(await page.locator('#projectes').evaluate(e=>e.inert),false);await failed.close();
    console.log('PASS: fixed seat during gestures, reading, inspection and terrain; all 8 resources, 3 samples, paired pages, theme, V4V, mobile and render budget.');console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
