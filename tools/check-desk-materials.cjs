const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright');
const origin='http://127.0.0.1:4187',out=path.resolve('output/desk/materials');
const probe=`window.materialStudy={phase:()=>phase,shelf:()=>binderShelf.info(),movement:()=>materialMovement.info(),
  camera:()=>camera.position.toArray().concat(camera.quaternion.toArray()),
  get(id){const m=models.get(id);m.group.updateWorldMatrix(true,true);return {home:m.home.toArray(),position:m.group.position.toArray(),rotation:m.group.quaternion.toArray(),bounds:m.outlineBounds.clone().applyMatrix4(m.group.matrixWorld).min.toArray()};},
  project(p){camera.updateMatrixWorld();const r=canvas.getBoundingClientRect(),v=projectPoint(new THREE.Vector3(...p));return{x:v.x+r.x,y:v.y+r.y};},
  contacts(){const order=binderShelf.info().order.filter(id=>models.get(id)!==active),profiles=order.map(id=>standingProfile(models.get(id).group)),gaps=[];
    for(let i=1;i<profiles.length;i++){const a=profiles[i-1],b=profiles[i],low=Math.max(Math.min(...a.map(p=>p.y)),Math.min(...b.map(p=>p.y))),high=Math.min(Math.max(...a.map(p=>p.y)),Math.max(...b.map(p=>p.y)));
      const ys=[low,high,...a.map(p=>p.y),...b.map(p=>p.y)].filter(y=>y>=low&&y<=high);gaps.push(Math.min(...ys.map(y=>profileSpan(b,y).low-profileSpan(a,y).high)));}
    return {floor:profiles.map(p=>Math.min(...p.map(p=>p.y))),wall:Math.min(...profiles[0].map(p=>p.x))-deskLayout.organizer.openings[0][0],gaps};},
};`;
(async()=>{await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
  try{for(const mobile of [false,true]){
    const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},hasTouch:mobile,isMobile:mobile,reducedMotion:mobile?'reduce':'no-preference',colorScheme:mobile?'dark':'light'});
    await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await page.route('**/scene.js*',async r=>{const response=await r.fetch();let body=await response.text();
      body="import { standingProfile, profileSpan } from './binder-load.js?v=1.25.0';\n"+body.replace('  return { highlight, select, home,',probe+'\n  return { highlight, select, home,');
      await r.fulfill({response,body});});
    await page.goto(origin+'/escriptori/');await page.locator('#workspace[data-ready=true]').waitFor({timeout:90000});await page.locator('#desk-loading').waitFor({state:'hidden'});
    const contacts=async()=>{const c=await page.evaluate(()=>materialStudy.contacts());for(const y of c.floor)assert.ok(Math.abs(y+.579)<.002,'Every standing book touches the desk');assert.ok(Math.abs(c.wall-.004)<.002);for(const gap of c.gaps)assert.ok(gap>.002&&gap<.008,'Books lean against a neighbour, without intersections or floating gaps: '+gap);};
    await contacts();const initial=await page.evaluate(()=>materialStudy.shelf().order);
    await page.locator('[data-project=trama]').click();await page.locator('#project-detail.is-visible').waitFor({timeout:30000});await contacts();
    await page.screenshot({path:path.join(out,(mobile?'mobile':'desktop')+'-reading.png')});await page.keyboard.press('Escape');await page.waitForFunction(()=>materialStudy.phase()==='shelf');await contacts();
    assert.deepEqual(await page.evaluate(()=>materialStudy.shelf().order),initial);
    const b=await page.locator('[data-project=trama]').boundingBox(),start={x:b.x+b.width/2,y:b.y+b.height*.55};
    await page.mouse.move(1300,70);await page.waitForTimeout(240);
    const camera=await page.evaluate(()=>materialStudy.camera());
    if(mobile){const cdp=await ctx.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x-60,y:start.y+2}]});await page.waitForTimeout(500);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x-72,y:start.y+2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else {await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x-145,start.y+2,{steps:6});await page.waitForTimeout(600);await page.mouse.up();}
    await page.waitForFunction(()=>!materialStudy.movement().busy,{},{timeout:10000});
    assert.equal(await page.locator('#project-detail').evaluate(d=>d.open),false,'Dragging never opens a project');
    assert.deepEqual(await page.evaluate(()=>materialStudy.camera()),camera,'Material drag does not orbit the camera');
    const changed=await page.evaluate(()=>materialStudy.shelf().order);assert.notDeepEqual(changed,initial,'Dragging reorders the shelf');await contacts();
    await page.screenshot({path:path.join(out,(mobile?'mobile':'desktop')+'-reordered.png')});
    await page.locator('[data-project=trama]').press('Enter');await page.locator('#project-detail.is-visible').waitFor({timeout:30000});await contacts();await page.keyboard.press('Escape');await page.waitForFunction(()=>materialStudy.phase()==='shelf');assert.deepEqual(await page.evaluate(()=>materialStudy.shelf().order),changed);await contacts();
    for(const [id,area,delta]of [['pauta','Utilitats',[.32,0,0]],['relleu-obert','Medi',[0,0,.45]]]){
      await page.locator('[data-area='+area+']').click();await page.waitForTimeout(mobile?100:500);
      const old=await page.evaluate(id=>materialStudy.get(id),id),r=await page.locator('[data-project='+id+']').boundingBox();assert.ok(r);
      const from={x:r.x+r.width/2,y:r.y+r.height/2};const to=await page.evaluate(({p,d})=>materialStudy.project(p.map((v,i)=>v+d[i])),{p:old.home,d:delta});
      // Convert the desired tabletop delta to a screen delta at the same point.
      const projected=await page.evaluate(p=>materialStudy.project(p),old.home);
      await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(from.x+to.x-projected.x,from.y+to.y-projected.y,{steps:8});await page.mouse.up();await page.waitForFunction(()=>!materialStudy.movement().busy);
      const moved=await page.evaluate(id=>materialStudy.get(id),id);assert.ok(Math.hypot(...moved.home.map((v,i)=>v-old.home[i]))>.05,id+' is movable');
      await page.locator('[data-project='+id+']').press('Enter');await page.locator('#project-detail.is-visible').waitFor({timeout:30000});await page.keyboard.press('Escape');await page.waitForFunction(()=>materialStudy.phase()==='shelf');
      const restored=await page.evaluate(id=>materialStudy.get(id),id);assert.ok(Math.hypot(...restored.home.map((v,i)=>v-moved.home[i]))<.001,'Closing returns to the new location');
    }
    if(mobile){
      await page.locator('[data-area=Llengua]').click();await page.locator('[data-project=trama]').waitFor({state:'visible'});const box=await page.locator('[data-project=trama]').boundingBox(),p={x:box.x+box.width/2,y:box.y+box.height*.55},cdp=await ctx.newCDPSession(page);
      const before=await page.evaluate(()=>materialStudy.camera());
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+12,y:p.y}]});await page.waitForTimeout(80);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x+12,y:p.y},{x:p.x+82,y:p.y}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-12,y:p.y},{x:p.x+106,y:p.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(()=>!materialStudy.movement().busy);assert.notDeepEqual(await page.evaluate(()=>materialStudy.camera()),before,'A second finger hands a material drag back to camera pinch');await contacts();assert.equal(await page.locator('#project-detail').evaluate(d=>d.open),false);
    }
    assert.deepEqual(errors,[]);console.log('PASS '+(mobile?'390px dark/touch/reduced':'desktop')+': supported neighbours, click/drag separation, reorder persistence, movable box and portfolios, keyboard opening.');await ctx.close();
  }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
