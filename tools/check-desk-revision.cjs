const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:4187';
const output = path.resolve(__dirname, '../tmp/desk');
const instrument = `
  window.revision={
    phase:()=>phase, models:()=>reliefs.info().models,
    box:()=>{const inverse=active.group.matrixWorld.clone().invert();return [0,1,2].map(i=>{
      const piece=scene.getObjectByName('ReliefSample_'+i),position=piece.position.toArray();
      const bounds=new THREE.Box3().setFromObject(piece);const local=new THREE.Box3();
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])local.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(inverse));
      return{position,minimum:local.min.toArray(),maximum:local.max.toArray()};});},
    pose:()=>camera.position.toArray(),
    turn:(index=2)=>{reading.startTurn(index);reading.turn(.65);requestRender();
      const side=index>1?1:0;
      const exposed=scene.getObjectByName(side?'SecondAnswer':'SecondSample'),expected=active.sampleTextures.find(p=>p.exampleIndex===index&&p.pageIndex===side).texture;
      const point=exposed.localToWorld(new THREE.Vector3(side?.3:-.3,0,.001));
      const ray=new THREE.Raycaster(camera.position,point.clone().sub(camera.position).normalize());
      const visible=o=>{while(o){if(!o.visible)return false;o=o.parent;}return true;};
      const hits=ray.intersectObjects(scene.children,true).filter(hit=>visible(hit.object));
      return{visible:exposed.visible,loaded:exposed.material.map.image.width>0,expected:exposed.material.map===expected,front:exposed.localToWorld(new THREE.Vector3(0,0,1)).sub(exposed.getWorldPosition(new THREE.Vector3())).dot(camera.position.clone().sub(point))>0,nearest:hits[0]?.object.name};},
    finish:()=>{reading.finishTurn(1);requestRender();},
    scenery:t=>{atmosphere.visible(camera);atmosphere.update(t*1000);weather.update(t);requestRender();return{
      drift:weather.uniforms.deskCloudDrift.value.toArray(),branches:[0,1,2].map(i=>scene.getObjectByName('ExteriorBranch_'+i).rotation.toArray().slice(0,3)),
      sun:daylight.intensity,room:scene.getObjectByName('CeilingLight').intensity};},
    clock:()=>sceneryTime,
  };
`;
const difference=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    for(const width of process.argv.includes('--desktop')?[1440]:process.argv.includes('--mobile')?[320]:[1440,320]){
      const context=await browser.newContext({viewport:{width,height:width===320?568:960},reducedMotion:'reduce',colorScheme:width===320?'dark':'light'});
      await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      const page=await context.newPage(),errors=[],images=[];
      page.setDefaultTimeout(90000);
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      page.on('request',r=>{if(r.url().includes('/samples/')&&r.url().endsWith('.webp'))images.push(r.url());});
      await page.addInitScript(()=>{const D=Date;window.Date=class extends D{constructor(...args){super(...(args.length?args:['2026-11-19T09:00:00Z']));}static now(){return new D('2026-11-19T09:00:00Z').valueOf();}};});
      await page.route('**/daylight.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replaceAll('2048, 2048','256, 256')});});
      await page.route('**/reliefs.js*',async r=>{const response=await r.fetch();const body=(await response.text()).replace('  return { prepare, mount,',`window.reliefPath=t=>{stored.path(t);const b=new THREE.Box3().setFromObject(selected);return{base:b.min.y,rim:stored.rim};};\n  return { prepare, mount,`);await r.fulfill({response,body});});
      await page.route('**/scene.js*',async r=>{const response=await r.fetch();let body=await response.text();
        body=body.replace('  return { highlight, select, home,',instrument+'\n  return { highlight, select, home,');
        if(!process.argv.includes('--full'))body=body.replace('renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));','renderer.setPixelRatio(.5);').replaceAll('2048, 2048','256, 256');
        await r.fulfill({response,body});});
      await page.goto(origin+'/escriptori/anterior.html');await page.locator('#workspace[data-ready=true]').waitFor({timeout:120000});
      await page.locator('[data-area=Medi]').click();await page.locator('[data-project=relleu-obert]').click();await page.locator('#project-detail.is-visible').waitFor().catch(async error=>{
        console.error({errors,state:await page.evaluate(()=>({phase:revision.phase(),status:document.querySelector('#desk-status').textContent}))});throw error;
      });
      assert.equal((await page.evaluate(()=>revision.models())).length,3,'All three distinct models are visible at once');
      assert.ok(await page.locator('.sample-pager').isHidden(),'No confusing pairs/combinations pager');
      const panel=await page.locator('.description-page').boundingBox(),entry=await page.locator('#project-enter').boundingBox();
      assert.ok(entry.y+entry.height<=panel.y+panel.height-6,'All three model choices and the project link fit in the panel');
      const homes=await page.evaluate(()=>revision.box()),camera=await page.evaluate(()=>revision.pose());
      for(const model of homes){assert.ok(model.minimum[0]>-.91&&model.maximum[0]<.91&&model.minimum[2]>-.66&&model.maximum[2]<.66,'Each complete sample starts inside the box');}
      await page.screenshot({path:path.join(output,`three-reliefs-${width}.png`)});
      for(const [i,id] of ['sample-open-inline','sample-open-second','sample-open-third-inline'].entries()){
        await page.locator('#'+id).click();await page.waitForFunction(()=>revision.phase()==='inspecting');
        const pathSamples=await page.evaluate(()=>{const samples=[];for(let t=.3;t<.76;t+=.025)samples.push(reliefPath(t));reliefPath(1);return samples;});
        assert.ok(pathSamples.every(p=>p.base>p.rim+.05),'Every model clears the box rim before crossing a wall');
        if(i===2)await page.screenshot({path:path.join(output,`third-relief-${width}.png`)});
        await page.keyboard.press('Escape');await page.waitForFunction(()=>revision.phase()==='reading');
        assert.deepEqual((await page.evaluate(()=>revision.box()))[i].position,homes[i].position,'Restore this model to its own slot');
        assert.ok(difference(camera,await page.evaluate(()=>revision.pose()))<1e-6,'Restore the exact camera');
      }
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#shelf-controls').inert);
      await page.locator('[data-area=Llengua]').click();await page.locator('[data-project=trama]').click();await page.locator('#project-detail.is-visible').waitFor();
      const downloaded=images.length;
      for(const index of [2,0]){
        const turn=await page.evaluate(index=>revision.turn(index),index);
        assert.ok(turn.visible&&turn.loaded&&turn.expected&&turn.front,'The incoming printed sheet is ready and front-facing after visiting Relleu');
        assert.equal(turn.nearest,index===2?'SecondAnswer':'SecondSample','The new print is above the grey paper geometry while the old leaf moves');
        await page.screenshot({path:path.join(output,`printed-underleaf-${index}-${width}.png`)});
        assert.equal(images.length,downloaded,'Turning does not trigger a late image download');
        await page.evaluate(()=>revision.finish());
      }
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#shelf-controls').inert);
      if(width===1440){
        for(let i=0;i<4;i++)await page.locator('[data-view=left]').click();
        for(let i=0;i<2;i++)await page.locator('[data-view=up]').click();
        const before=await page.evaluate(()=>revision.scenery(0));await page.screenshot({path:path.join(output,'weather-before.png')});
        const after=await page.evaluate(()=>revision.scenery(16));await page.screenshot({path:path.join(output,'weather-after.png')});
        assert.ok(difference(before.drift,after.drift)>.1,'Cloud shadows move across the world');
        assert.ok(before.branches.some((r,i)=>difference(r,after.branches[i])>.04),'Exterior branches visibly respond to wind');
        assert.equal(before.sun,after.sun);assert.equal(before.room,after.room,'Clouds preserve solar time/intensity and ceiling light');
        await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>revision.clock()>.03);
        await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('#desk-canvas').dataset.ambience==='still');
        const clock=await page.evaluate(()=>revision.clock());await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>revision.clock()),clock,'Reduced motion freezes the scenery clock');
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
      await context.close();console.log('OK '+width+': three contained models, every extraction/return, printed underleaf after Relleu and scenery');
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
