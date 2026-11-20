const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:4187';
const probe=`
  window.deskPlay={
    grip:()=>grip?.item.node.name,
    bodies:()=>roots().map(i=>({name:i.node.name,min:i.solid.min.toArray(),max:i.solid.max.toArray(),drop:!!i.drop,slide:!!i.slide,supports:[...i.supports].map(s=>s.node.name)})),
    pick(x,y){const h=hit({clientX:x,clientY:y});return {name:h?.item.node.name,drop:h?.item.drop,busy:h?.item.busy,element:document.elementFromPoint(x,y)?.outerHTML.slice(0,100)};},
    get(name){const i=items.find(i=>i.node.name===name);refreshItem(i);return {name,parent:i.node.parent.name,
      bundle:i.bundle?.node.name,pages:i.bundlePages?.map(p=>p.node.name),busy:!!i.busy,flight:!!i.flight,drop:!!i.drop,
      position:i.node.getWorldPosition(new THREE.Vector3()).toArray(),min:i.solid.min.toArray(),max:i.solid.max.toArray(),
      ball:!!i.sheet?.crumpled,fallen:fallen.has(i)};},
    staples(){const attached=[];room.traverse(n=>{if(n.name.startsWith('AttachedStaple_'))attached.push({name:n.name,parent:n.parent.name,position:n.getWorldPosition(new THREE.Vector3()).toArray()})});
      return {attached,loose:items.filter(i=>i.node.name.startsWith('LooseStaple_')).map(i=>({name:i.node.name,flight:!!i.flight,drop:!!i.drop,min:i.solid.min.toArray(),max:i.solid.max.toArray()}))};},
    place(name,x,z){const i=items.find(i=>i.node.name===name);finishPulse(i);room.attach(i.node);i.sheet?.flatten(true);
      i.supports.clear();i.velocity.set(0,0,0);i.spin=0;i.drop=null;
      const p=i.node.getWorldPosition(new THREE.Vector3());p.x=x;p.z=z;setWorld(i.node,p);refreshItem(i);
      p.y+=surface+.002-i.solid.min.y;setWorld(i.node,p);refresh();redraw();},
    release(name,x,z){const i=items.find(i=>i.node.name===name);invalidate(i);room.attach(i.node);
      i.supports.clear();i.velocity.set(0,0,0);i.spin=0;setWorld(i.node,new THREE.Vector3(x,1.5,z));refresh();land(i);redraw();},
    press(){play.tap(items.find(i=>i.node.name==='DeskStapler'));},
    rest(){land(items.find(i=>i.node.name==='DeskStapler'));},
    mouth(){return items.find(i=>i.node.name==='DeskStapler').node.localToWorld(new THREE.Vector3(0,.075,.315)).toArray();},
  };
`;
const sceneProbe=`
  window.playView={
    phase:()=>phase,
    project(xyz){camera.updateMatrixWorld();const p=projectPoint(new THREE.Vector3(...xyz)),r=canvas.getBoundingClientRect();return {x:p.x+r.x,y:p.y+r.y}},
    view(){camera.position.set(-2.0,3.8,6.7);navigation.target.set(-2.0,-.54,2.8);navigation.update();camera.updateMatrixWorld();requestRender()},
  };
`;
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const mobile of [false,true]){
      const ctx=await browser.newContext({viewport:mobile?{width:320,height:568}:{width:1440,height:960},reducedMotion:mobile?'reduce':'no-preference',colorScheme:mobile?'dark':'light'});
      await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/stationery.js*',async r=>{const response=await r.fetch();const source=(await response.text()).replaceAll('\r\n','\n');
        assert.ok(source.includes('  return {\n    cancel: rollback,'));await r.fulfill({response,body:source.replace('if(!route)return false;','if(!route){window.playRouteFailure={name:item.node.name,body:[rest.min.toArray(),rest.max.toArray()],others:others.map(b=>[b.min.toArray(),b.max.toArray()]),regions:regions.map(b=>[b.min.toArray(),b.max.toArray()])};return false;}').replace('  return {\n    cancel: rollback,',probe+'\n  return {\n    cancel: rollback,')});});
      await page.route('**/scene.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('action:onAction,','action:(...args)=>{(window.playEvents??=[]).push(args);onAction(...args)},').replace('  return { highlight, select, home,',sceneProbe+'\n  return { highlight, select, home,')})});
      await page.goto(origin+'/escriptori/');await page.locator('#workspace[data-ready=true]').waitFor({timeout:60000});await page.locator('#desk-loading').waitFor({state:'hidden'});
      await page.evaluate(()=>{deskPlay.place('DeskStapler',-1.9,2.7);playView.view()});
      const get=name=>page.evaluate(name=>deskPlay.get(name),name);
      const project=p=>page.evaluate(p=>playView.project(p),p);
      async function press(){
        const s=await get('DeskStapler'),p=s.min.map((v,i)=>(v+s.max[i])/2);p[1]=s.max[1]-.012;
        const point=await project(p);await page.mouse.click(point.x,point.y);
        await page.waitForFunction(()=>!deskPlay.get('DeskStapler').busy);
      }
      await press();await page.waitForFunction(()=>deskPlay.staples().loose.length===1&&!deskPlay.staples().loose[0].flight&&!deskPlay.staples().loose[0].drop);
      assert.ok((await page.evaluate(()=>deskPlay.staples())).loose[0].min[1]>-.585,'An empty press ejects a folded staple onto the desk');
      // One sheet gets a staple at the mouth, not a loose staple on the desk.
      await page.evaluate(()=>{deskPlay.place('LooseWorksheet_4',-1.9,2.7);deskPlay.rest()});
      await page.waitForFunction(()=>!deskPlay.get('DeskStapler').drop);
      await press();let staples=await page.evaluate(()=>deskPlay.staples());
      assert.equal(staples.attached.length,1);assert.equal(staples.attached[0].parent,'LooseWorksheet_4');assert.equal(staples.loose.length,1);
      // Join two sheets and carry them with the real pointer handlers.
      await page.evaluate(()=>{deskPlay.place('LooseWorksheet_3',-1.9,2.7);deskPlay.rest()});
      await page.waitForFunction(()=>!deskPlay.get('DeskStapler').drop);await press();
      const a=await get('LooseWorksheet_4'),b=await get('LooseWorksheet_3');
      assert.ok(a.bundle);assert.equal(a.bundle,b.bundle);assert.equal((await get(a.bundle)).pages.length,2);
      if(!mobile)await page.screenshot({path:'output/desk/minigames-stapled-desktop.png'});
      const start=await project([a.position[0]-.40,a.max[1],a.position[2]+.60]);
      const end=await project([a.position[0]-.15,a.max[1],a.position[2]+.75]);
      await page.mouse.move(start.x,start.y);await page.mouse.down();assert.equal(await page.evaluate(()=>deskPlay.grip()),a.bundle);
      await page.mouse.move(end.x,end.y,{steps:12});await page.mouse.up();
      const movedA=await get(a.name),movedB=await get(b.name);
      for(const axis of [0,1,2])assert.ok(Math.abs((movedA.position[axis]-a.position[axis])-(movedB.position[axis]-b.position[axis]))<.00001,'Stapled sheets keep their relative pose');
      assert.ok(Math.hypot(movedA.position[0]-a.position[0],movedA.position[2]-a.position[2])>.12);
      assert.equal(movedA.ball,false,'A normal drag does not crumple paper');
      // A further press can add a third sheet to the existing bundle.
      await page.evaluate(name=>{deskPlay.place('DeskStapler',-6.8,.6);deskPlay.release(name,-1.9,2.7)},a.bundle);
      await page.waitForFunction(name=>!deskPlay.get(name).drop,a.bundle);
      await page.evaluate(()=>deskPlay.release('LooseWorksheet_1',-1.9,2.7));
      await page.waitForFunction(()=>!deskPlay.get('LooseWorksheet_1').drop);
      await page.evaluate(()=>deskPlay.release('DeskStapler',-1.9,2.7));
      await page.waitForFunction(()=>!deskPlay.get('DeskStapler').drop);await press();
      assert.equal((await get(a.bundle)).pages.length,3);assert.equal((await get('LooseWorksheet_1')).bundle,a.bundle);
      // A deliberate shake of a separate sheet becomes a compact paper ball.
      await page.evaluate(name=>deskPlay.release(name,-4.0,2.0),a.bundle);
      await page.waitForFunction(name=>!deskPlay.get(name).drop,a.bundle);
      await page.evaluate(()=>{deskPlay.place('LooseWorksheet_2',-1.9,3.0);deskPlay.place('DeskStapler',-6.8,.6)});
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      await page.waitForFunction(()=>!deskPlay.get('LooseWorksheet_2').drop);
      const sheet=await get('LooseWorksheet_2'),pick=await project([sheet.position[0],sheet.max[1],sheet.position[2]+.1]);
      await page.mouse.move(pick.x,pick.y);await page.mouse.down();assert.equal(await page.evaluate(()=>deskPlay.grip()),sheet.name,JSON.stringify({sheet,pick,hit:await page.evaluate(p=>deskPlay.pick(p.x,p.y),pick)}));
      for(let n=0;n<9;n++)await page.mouse.move(pick.x+(n%2? -65:65),pick.y,{steps:6});
      await page.mouse.up();
      await page.waitForFunction(()=>{const i=deskPlay.get('LooseWorksheet_2');return i.ball&&!i.drop&&i.max[0]-i.min[0]<.60&&i.max[2]-i.min[2]<.60},{},{timeout:10000});
      const ball=await get(sheet.name);assert.ok(ball.min[1]>=-.585&&ball.min[1]<-.53,'The ball settles on the tabletop after the morph');
      await page.screenshot({path:'output/desk/minigames-'+(mobile?'mobile':'desktop')+'.png'});
      // A joined stack and a paper ball can still be cleared for a resource.
      await page.evaluate(name=>deskPlay.release(name,-1.5,2.5),a.bundle);
      await page.waitForFunction(name=>!deskPlay.get(name).drop,a.bundle);
      await page.evaluate(()=>document.querySelector('[data-project=trama]').click());
      try{await page.waitForFunction(()=>playView.phase()==='reading',{},{timeout:20000});}
      catch(error){console.log(JSON.stringify(await page.evaluate(()=>({phase:playView.phase(),status:document.querySelector('#desk-status').textContent,route:window.playRouteFailure?.name,bodies:deskPlay.bodies()}))));await page.screenshot({path:'output/desk/minigame-failure.png'});throw error;}
      await page.keyboard.press('Escape');await page.waitForFunction(()=>playView.phase()==='shelf');
      // Joined sheets stay joined through a floor drop and recovery.
      await page.evaluate(name=>deskPlay.release(name,-1.9,5.6),a.bundle);
      await page.waitForFunction(name=>deskPlay.get(name).fallen,a.bundle);
      assert.ok((await get(a.name)).max[1]<-3.0);await page.locator('#recover-stationery').click();
      await page.waitForFunction(name=>!deskPlay.get(name).fallen&&!deskPlay.get(name).drop,a.bundle);
      assert.equal((await get(a.name)).bundle,(await get(b.name)).bundle);
      // Rapid empty presses have a bounded amount of new geometry/props.
      await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{deskPlay.place('DeskStapler',-6.8,.6);for(let n=0;n<30;n++)deskPlay.press()});
      assert.equal((await page.evaluate(()=>deskPlay.staples())).loose.length,24);
      const events=await page.evaluate(()=>playEvents);
      assert.equal(events.filter(e=>e[0]==='rebrega_full').length,1,'One crumple event is emitted, with no pointer trace');
      for(const count of [0,1,2,3])assert.ok(events.some(e=>e[0]==='grapa'&&e[1].fulls===count));
      assert.ok((await page.evaluate(()=>deskPlay.bodies())).every(i=>i.min[1]>-.62),'Re-settling props in translated parents stays on the desktop');
      assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      console.log('PASS '+(mobile?'320px dark/reduced':'desktop/animated')+': empty and loaded stapling, joined drag/recovery, deliberate shake and bounded loose staples.');await ctx.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
