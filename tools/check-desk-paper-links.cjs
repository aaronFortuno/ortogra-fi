const assert=require('node:assert/strict'),{chromium}=require('playwright');
const origin='http://127.0.0.1:4187';
const probe=`
  window.paperLinks={
    grip:()=>grip?.item.node.name,joints:()=>play.joints().map(b=>({...b,moving:b.moving||b.pages.some(name=>{
      const i=items.find(i=>i.node.name===name);return i.velocity.lengthSq()>1e-5||Math.abs(i.spin)>.01||Math.abs(i.bundle.states.get(i).omega)>.008;
    })})),
    get(name){const i=items.find(i=>i.node.name===name);refreshItem(i);return {name,parent:i.node.parent.name,bundle:i.bundle?.id,
      pages:i.bundle?.pages.map(p=>p.node.name),position:i.node.getWorldPosition(new THREE.Vector3()).toArray(),rotation:i.node.quaternion.toArray(),
      min:i.solid.min.toArray(),max:i.solid.max.toArray(),ball:!!i.sheet?.crumpled,changing:!!i.sheet?.changing,wrinkle:i.sheet?.wrinkle,drop:!!i.drop,fallen:fallen.has(i)};},
    place(name,x,z,yaw=0,layer=0){const i=items.find(i=>i.node.name===name);invalidate(i);play.detach(i);finishPulse(i);room.attach(i.node);i.node.rotation.set(0,yaw,0);
      i.supports.clear();i.velocity.set(0,0,0);i.spin=0;i.drop=null;i.sheet?.flatten(true);i.sheet?.setPins([]);
      const p=i.node.getWorldPosition(new THREE.Vector3());p.x=x;p.z=z;setWorld(i.node,p);refreshItem(i);p.y+=surface+.002+layer-i.solid.min.y;setWorld(i.node,p);refresh();redraw();},
    release(name,x,z){const i=items.find(i=>i.node.name===name);play.detach(i);invalidate(i);setWorld(i.node,new THREE.Vector3(x,1.0,z));refresh();land(i);play.release(i);redraw();},
    press(){play.tap(items.find(i=>i.node.name==='DeskStapler'));},
    candidates(name){const i=items.find(i=>i.node.name===name),g=i.node.geometry,a=g.attributes.position,index=g.index;
      const points=[];for(let n=0;n<(index?.count||a.count);n+=3){
        const face=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(a,index?index.getX(n+j):n+j));
        const center=face.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/3);
        points.push(i.node.localToWorld(center).toArray());
      }return points;},
    pick(x,y){return hit({clientX:x,clientY:y})?.item.node.name;},
  };
`;
const view=`window.paperView={phase:()=>phase,project(v){camera.updateMatrixWorld();const p=projectPoint(new THREE.Vector3(...v)),r=canvas.getBoundingClientRect();return{x:p.x+r.x,y:p.y+r.y}},view(){camera.position.set(-1.9,innerWidth<500?5.5:3.8,innerWidth<500?8.5:6.7);navigation.target.set(-1.9,-.54,2.8);navigation.update();camera.updateMatrixWorld();requestRender()}};`;
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const mobile of process.argv.includes('--desktop')?[false]:[false,true]){
      const ctx=await browser.newContext({viewport:mobile?{width:320,height:568}:{width:1440,height:960},reducedMotion:'reduce',colorScheme:mobile?'dark':'light'});
      await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/stationery.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replaceAll('\r\n','\n').replace('  return {\n    cancel: rollback,',probe+'\n  return {\n    cancel: rollback,')})});
      await page.route('**/scene.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('  return { highlight, select, home,',view+'\n  return { highlight, select, home,')})});
      await page.goto(origin+'/escriptori/anterior.html');await page.locator('#workspace[data-ready=true]').waitFor({timeout:60000});await page.locator('#desk-loading').waitFor({state:'hidden'});
      await page.evaluate(()=>{paperLinks.place('LooseWorksheet_4',-1.9,2.8,.16);paperLinks.place('LooseWorksheet_3',-1.84,2.85,-.16,.007);paperLinks.place('DeskStapler',-1.9,2.8);paperView.view();paperLinks.press()});
      const get=name=>page.evaluate(name=>paperLinks.get(name),name),project=v=>page.evaluate(v=>paperView.project(v),v);
      const a='LooseWorksheet_4',b='LooseWorksheet_3';assert.equal((await get(a)).bundle,(await get(b)).bundle);assert.ok((await get(a)).bundle);
      assert.equal((await get(a)).parent,'Scene');assert.equal((await get(b)).parent,'Scene');
      await page.evaluate(()=>paperLinks.place('DeskStapler',-6.8,.6));
      if(!mobile)await page.emulateMedia({reducedMotion:'no-preference'});
      async function pick(name){
        await page.waitForFunction(()=>paperLinks.joints().every(b=>!b.moving),{},{timeout:10000});
        const points=await page.evaluate(name=>paperLinks.candidates(name),name);
        for(const v of points){const p=await project(v);p.x=Math.round(p.x);p.y=Math.round(p.y);if(p.x<8||p.y<150||p.x>(mobile?312:1432)||p.y>(mobile?420:820))continue;
          if(await page.evaluate(p=>paperLinks.pick(p.x,p.y),p)===name)return {screen:p,world:v};}
        throw Error('No exposed edge for '+name);
      }
      async function drag(name,delta){
        const p=await pick(name),end=await project(p.world.map((v,i)=>v+delta[i]));
        await page.mouse.move(p.screen.x,p.screen.y);await page.mouse.down();assert.equal(await page.evaluate(()=>paperLinks.grip()),name,'The exact page under the pointer is picked');
        await page.mouse.move(end.x,end.y,{steps:18});await page.mouse.up();
      }
      const beforeA=await get(a),beforeB=await get(b);await drag(a,[.55,0,.1]);
      await page.waitForFunction(()=>paperLinks.joints().every(b=>!b.moving&&b.links.every(l=>l.distance<.025)),{},{timeout:5000});
      const afterA=await get(a),afterB=await get(b);
      assert.ok(Math.hypot(...afterB.rotation.map((v,i)=>v-beforeB.rotation[i]))>.02,'The trailing page turns about the staple');
      assert.ok(Math.hypot(...afterA.position.map((v,i)=>(v-beforeA.position[i])-(afterB.position[i]-beforeB.position[i])))>.025,'Sheets are not a rigid assembly');
      await drag(b,[-.30,0,.12]);await page.waitForFunction(()=>paperLinks.joints().every(b=>!b.moving&&b.links.every(l=>l.distance<.025)));
      // Both retain ordinary support/deformation behaviour after stapling.
      await page.evaluate(name=>{paperLinks.place('DeskTapeRoll',-1.9,2.8);paperLinks.release(name,-1.9,2.8)},a);
      await page.waitForFunction(name=>!paperLinks.get(name).drop,a);
      assert.ok((await get(a)).max[1]>-.43,'A stapled page can rest over the tape roll');
      await page.evaluate(()=>paperLinks.place('DeskTapeRoll',-6.8,1.9));
      await page.waitForFunction(()=>paperLinks.joints().every(b=>b.links.every(l=>l.distance<.025)));
      // Shake one linked sheet while its partner remains a separate sheet.
      const p=await pick(a);await page.mouse.move(p.screen.x,p.screen.y);await page.mouse.down();assert.equal(await page.evaluate(()=>paperLinks.grip()),a);
      for(let n=0;n<9;n++)await page.mouse.move(p.screen.x+(n%2?-45:45),p.screen.y,{steps:2});await page.mouse.up();
      try{await page.waitForFunction(name=>paperLinks.get(name).ball,a,{timeout:5000});}
      catch(e){console.log('Shake failed',mobile,await get(a),await get(b),await page.evaluate(()=>paperLinks.joints()));throw e;}
      await page.waitForFunction(name=>!paperLinks.get(name).changing,a);
      await page.waitForFunction(()=>paperLinks.joints().every(b=>b.links.every(l=>l.distance<.035)),{},{timeout:5000});
      assert.equal((await get(b)).ball,false);assert.ok((await get(b)).wrinkle>0,'Sharp pulls crease the trailing sheet');
      await page.screenshot({path:'output/desk/flexible-staple-'+(mobile?'mobile':'desktop')+'.png'});
      const second=await pick(b);await page.mouse.move(second.screen.x,second.screen.y);await page.mouse.down();
      assert.equal(await page.evaluate(()=>paperLinks.grip()),b);
      for(let n=0;n<9;n++)await page.mouse.move(second.screen.x+(n%2?-45:45),second.screen.y,{steps:2});await page.mouse.up();
      await page.waitForFunction(name=>paperLinks.get(name).ball&&!paperLinks.get(name).changing,b);
      await page.waitForFunction(()=>paperLinks.joints().every(b=>b.links.every(l=>l.distance<.035)),{},{timeout:5000});
      for(const name of [a,b]){const s=await get(name);assert.ok(s.position.every(Number.isFinite));assert.ok(s.max[1]-s.min[1]<1.1,'Two linked balls stay compact');}
      // The linked pages can be recovered together without becoming one body.
      await page.evaluate(name=>paperLinks.release(name,-1.9,5.6),a);
      await page.waitForFunction(name=>paperLinks.get(name).fallen,a,{timeout:10000});
      await page.locator('#recover-stationery').click();
      await page.waitForFunction(()=>!paperLinks.get('LooseWorksheet_4').fallen&&!paperLinks.get('LooseWorksheet_3').fallen);
      await page.waitForFunction(()=>paperLinks.joints().every(b=>b.links.every(l=>l.distance<.035)),{},{timeout:5000});
      assert.equal((await get(a)).bundle,(await get(b)).bundle);assert.deepEqual(errors,[]);
      console.log('PASS '+(mobile?'320px dark/reduced':'desktop')+': individual picking, trailing rotation, flexible support, independent crumpling, staple continuity and recovery.');await ctx.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
