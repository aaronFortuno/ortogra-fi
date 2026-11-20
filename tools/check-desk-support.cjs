const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:4187';
const probe=`
  window.supportCheck={
    grip:()=>grip?.item.node.name,
    contacts:box=>roots().filter(i=>!fallen.has(i)&&overlaps(i.solid,box,.008)).map(i=>i.node.name),
    get(name){const i=items.find(i=>i.node.name===name);refreshItem(i);return {name,position:i.node.getWorldPosition(new THREE.Vector3()).toArray(),
      min:i.solid.min.toArray(),max:i.solid.max.toArray(),supports:[...i.supports].map(b=>b.node.name),drop:!!i.drop,
      sheet:i.sheet?{sites:i.sheet.sites.length,ys:Array.from(i.node.geometry.attributes.position.array).filter((_,j)=>j%3===1)}:null};},
    place(name,x,z){const i=items.find(i=>i.node.name===name);finishPulse(i);room.attach(i.node);i.sheet?.flatten(true);i.supports.clear();
      i.velocity.set(0,0,0);i.spin=0;i.drop=null;const p=i.node.getWorldPosition(new THREE.Vector3());p.x=x;p.z=z;setWorld(i.node,p);refreshItem(i);
      p.y+=surface+.002-i.solid.min.y;setWorld(i.node,p);refresh();redraw();},
    release(name,x,z){const i=items.find(i=>i.node.name===name);invalidate(i);room.attach(i.node);i.supports.clear();i.velocity.set(0,0,0);i.spin=0;
      setWorld(i.node,new THREE.Vector3(x,1.5,z));refresh();land(i);redraw();},
    remove(name,x,z){const i=items.find(i=>i.node.name===name);invalidate(i);this.place(name,x,z);},
    cancel(){rollback()},
    penetrations(sheetName,solidName){
      const sheet=items.find(i=>i.node.name===sheetName),solid=items.find(i=>i.node.name===solidName),r=new THREE.Raycaster();
      let bad=0,covered=0,worst=0,example;const v=new THREE.Vector3(),hits=[];
      solid.node.traverse(mesh=>{if(!mesh.isMesh)return;const a=mesh.geometry.attributes.position;
        for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);hits.length=0;
          r.set(new THREE.Vector3(v.x,sheet.solid.max.y+.5,v.z),new THREE.Vector3(0,-1,0));r.intersectObject(sheet.node,true,hits);
          if(hits.length){covered++;if(hits[0].point.y<v.y-.001){bad++;const gap=v.y-hits[0].point.y;if(gap>worst){worst=gap;example={solid:v.toArray(),paper:hits[0].point.toArray()};}}}
        }
      });return {bad,covered,worst,example};
    },
    pick(x,y){const h=hit({clientX:x,clientY:y});return h?.item.node.name;},
  };
`;
const sceneProbe=`
  window.supportScene={
    phase:()=>phase,record:false,contacts:[],
    frame(){if(!this.record||!active)return;const b=new THREE.Box3().setFromObject(active.group);
      const touched=window.supportCheck.contacts(b);if(touched.length)this.contacts.push({phase,touched});},
    project(xyz){camera.updateMatrixWorld();const p=projectPoint(new THREE.Vector3(...xyz)),r=canvas.getBoundingClientRect();return{x:p.x+r.x,y:p.y+r.y}},
    view(){camera.position.set(-2.2,3.8,6.7);navigation.target.set(-2.2,-.54,2.8);navigation.update();camera.updateMatrixWorld();requestRender()},
  };
`;
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const mobile of [false,true]){
      const ctx=await browser.newContext({viewport:mobile?{width:320,height:568}:{width:1440,height:960},reducedMotion:'reduce',colorScheme:mobile?'dark':'light'});
      await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/stationery.js*',async r=>{const response=await r.fetch();const source=(await response.text()).replaceAll('\r\n','\n');
        assert.ok(source.includes('  return {\n    cancel: rollback,'));await r.fulfill({response,body:source.replace('  return {\n    cancel: rollback,',probe+'\n  return {\n    cancel: rollback,')});});
      await page.route('**/scene.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replaceAll('renderer.render(scene, camera);','window.supportScene?.frame();renderer.render(scene, camera);').replace('  return { highlight, select, home,',sceneProbe+'\n  return { highlight, select, home,')})});
      await page.goto(origin+'/escriptori/');await page.locator('#workspace[data-ready=true]').waitFor({timeout:60000});await page.locator('#desk-loading').waitFor({state:'hidden'});
      await page.evaluate(()=>{supportCheck.place('LooseWorksheet_4',-1.9,2.8);supportCheck.place('LoosePencil',-3.0,2.5);supportScene.view()});
      const get=name=>page.evaluate(name=>supportCheck.get(name),name);
      // Exercise the actual pointer handlers, not just the drop planner.
      const pen=await get('LoosePencil'),xyz=pen.min.map((v,i)=>(v+pen.max[i])/2);xyz[1]=pen.max[1]-.008;
      const start=await page.evaluate(p=>supportScene.project(p),xyz);
      const target=await page.evaluate(p=>supportScene.project(p),[xyz[0]+1.1,xyz[1],xyz[2]+.2]);
      await page.mouse.move(start.x,start.y);await page.mouse.down();
      assert.equal(await page.evaluate(()=>supportCheck.grip()),'LoosePencil',JSON.stringify({mobile,start,target,pick:await page.evaluate(p=>supportCheck.pick(p.x,p.y),start)}));
      await page.mouse.move(target.x,target.y,{steps:16});await page.mouse.up();
      let placed=await get('LoosePencil');
      assert.ok(placed.supports.includes('LooseWorksheet_4'),'A dragged pen can land on a sheet');
      assert.ok(Math.abs(placed.position[0]-pen.position[0])>.5,'Drop does not return to the drag origin');
      // Bend a sheet over a real, solid, non-paper prop.
      await page.evaluate(()=>{supportCheck.place('LoosePencil',-3.8,3);supportCheck.place('DeskStapler',-1.9,2.8);supportCheck.release('LooseWorksheet_4',-1.9,2.8)});
      let bent=await get('LooseWorksheet_4'),stapler=await get('DeskStapler');
      assert.ok(bent.supports.includes('DeskStapler'),'A sheet rests on the stapler');
      assert.ok(bent.sheet.sites>=300,'The existing paper grid is used');
      const amplitude=Math.max(...bent.sheet.ys)-Math.min(...bent.sheet.ys);
      assert.ok(amplitude>.15,'The paper bends locally rather than floating flat over the prop');
      assert.ok(bent.min[1]<stapler.max[1]-.10&&bent.max[1]>stapler.max[1],'Free edges sag towards the desktop');
      const contacts=await page.evaluate(()=>supportCheck.penetrations('LooseWorksheet_4','DeskStapler'));
      assert.ok(contacts.covered>30);if(contacts.bad){console.log({contacts,sheet:bent,stapler});await page.screenshot({path:'output/desk/support-bent-paper.png'});}
      assert.equal(contacts.bad,0,'Solid corners stay below the paper between grid vertices');
      // A pen must follow the actual bent surface, not the sheet AABB ceiling.
      await page.evaluate(()=>supportCheck.release('LoosePencil',-2.35,2.8));
      placed=await get('LoosePencil');assert.ok(placed.supports.includes('LooseWorksheet_4'));
      // Removing a support must let both the paper and the pen settle.
      await page.evaluate(()=>supportCheck.remove('DeskStapler',-6.8,.6));
      await page.waitForFunction(()=>{const p=supportCheck.get('LooseWorksheet_4'),q=supportCheck.get('LoosePencil');return !p.drop&&!q.drop&&p.max[1]<-.48&&q.max[1]<-.35},{},{timeout:10000});
      assert.ok(!(await get('LooseWorksheet_4')).supports.includes('DeskStapler'));
      await page.evaluate(()=>{supportCheck.place('LoosePencil',-1.9,2.8);supportCheck.release('LooseWorksheet_4',-1.9,2.8)});
      const thin=await page.evaluate(()=>supportCheck.penetrations('LooseWorksheet_4','LoosePencil'));
      assert.ok(thin.covered>30);assert.equal(thin.bad,0,'A thin pencil does not slip through the paper grid');
      if(!mobile){
        // Also exercise the animated fall and deformation.
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.evaluate(()=>{supportCheck.place('DeskStapler',-1.9,2.8);supportCheck.release('LooseWorksheet_4',-1.9,2.8)});
        await page.waitForFunction(()=>{const s=supportCheck.get('LooseWorksheet_4');return !s.drop&&Math.max(...s.sheet.ys)>.20});
        const sheet=await get('LooseWorksheet_4');assert.ok(sheet.max[1]>(await get('DeskStapler')).max[1]);
        await page.screenshot({path:'output/desk/support-bent-paper.png'});
        // Cancelling a drag settles at the last reachable point, not its origin.
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.evaluate(()=>supportCheck.place('LoosePencil',-3.0,2.5));
        const p=await get('LoosePencil'),c=p.min.map((v,i)=>(v+p.max[i])/2);c[1]=p.max[1]-.008;
        const from=await page.evaluate(c=>supportScene.project(c),c),to=await page.evaluate(c=>supportScene.project(c),[c[0]+.45,c[1],c[2]-.2]);
        await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});
        assert.equal(await page.evaluate(()=>supportCheck.grip()),'LoosePencil');
        const held=await get('LoosePencil');await page.evaluate(()=>supportCheck.cancel());await page.mouse.up();
        const cancelled=await get('LoosePencil');assert.ok(Math.hypot(cancelled.position[0]-held.position[0],cancelled.position[2]-held.position[2])<.001);
        assert.ok(Math.hypot(cancelled.position[0]-p.position[0],cancelled.position[2]-p.position[2])>.2);
      }
      // Opening a resource must still clear a bent sheet and the prop below it.
      await page.evaluate(()=>{supportCheck.place('LoosePencil',-3.5,2.0);supportCheck.place('DeskStapler',-1.5,2.5);supportCheck.release('LooseWorksheet_4',-1.5,2.5);});
      if(!mobile)await page.emulateMedia({reducedMotion:'no-preference'});
      await page.evaluate(()=>{supportScene.record=true;supportScene.contacts=[];document.querySelector('[data-project=trama]').click()});
      await page.waitForFunction(()=>supportScene.phase()==='reading',{},{timeout:60000});
      await page.keyboard.press('Escape');await page.waitForFunction(()=>supportScene.phase()==='shelf');
      assert.deepEqual(await page.evaluate(()=>supportScene.contacts),[],'Bent paper and its support stay out of the binder journey');
      assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      console.log('PASS '+(mobile?'320px dark':'desktop')+': pointer drop on paper, bent sheet over stapler, pen on curved paper, support removal and settling.');await ctx.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
