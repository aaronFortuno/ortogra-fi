const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:4187';
const bodiesProbe=`
  window.tableBodies={
    values:()=>roots().filter(i=>!fallen.has(i)).map(i=>({name:i.node.name,position:i.node.getWorldPosition(new THREE.Vector3()).toArray(),rotation:i.node.quaternion.toArray(),min:i.solid.min.toArray(),max:i.solid.max.toArray()})),
    grip:()=>grip?.item.node.name,
    pick(x,y){const h=hit({clientX:x,clientY:y});return {name:h?.item.node.name,enabled:enabled(),navigation:navigation.enabled,pointers:navigation.pointers.size,element:document.elementFromPoint(x,y)?.outerHTML.slice(0,140)}},
    place(name,x,z){const i=items.find(i=>i.node.name===name);finishPulse(i);room.attach(i.node);
      i.velocity.set(0,0,0);i.spin=0;const p=i.node.getWorldPosition(new THREE.Vector3());p.x=x;p.z=z;setWorld(i.node,p);refreshItem(i);
      p.y+=surface+.001-i.solid.min.y;setWorld(i.node,p);refresh();redraw();},
    contacts:box=>roots().filter(i=>!fallen.has(i)&&overlaps(i.solid,box,.008)).map(i=>i.node.name),
  };
`;
const sceneProbe=`
  window.tableScene={
    recording:false,frames:[],phase:()=>phase,
    frame(){if(!this.recording||!active)return;
      const boxes=[new THREE.Box3().setFromObject(active.group)];
      if(reliefs.info().open)for(let i=0;i<3;i++){const piece=scene.getObjectByName('ReliefSample_'+i);if(piece)boxes.push(new THREE.Box3().setFromObject(piece));}
      const contacts=[...new Set(boxes.flatMap(b=>window.tableBodies.contacts(b)))];
      if(contacts.length)this.frames.push({phase,contacts});
    },
    folders:()=>['pentagrama','pauta'].map(id=>{const b=new THREE.Box3().setFromObject(models.get(id).group);return {min:b.min.toArray(),max:b.max.toArray()}}),
    project(xyz){const p=projectPoint(new THREE.Vector3(...xyz)),r=canvas.getBoundingClientRect();return{x:p.x+r.x,y:p.y+r.y}},
    propView(){camera.position.set(-1.6,1.6,5.4);navigation.target.set(-1.9,-.54,3.2);navigation.update();camera.updateMatrixWorld()},
    brush(){const leaf=room.getObjectByName('IndoorLeaf_7'),p=new THREE.Box3().setFromObject(leaf).getCenter(new THREE.Vector3());
      atmosphere.brush(leaf,{direction:new THREE.Vector3(1,0,0),strength:.45,point:p});},
  };
`;
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const mobile of [false,true]){
      const ctx=await browser.newContext({viewport:mobile?{width:320,height:568}:{width:1440,height:960},reducedMotion:'reduce',colorScheme:mobile?'dark':'light'});
      await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      const page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
      await page.route('**/stationery.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('  return {\n    cancel: rollback,',bodiesProbe+'\n  return {\n    cancel: rollback,')})});
      await page.route('**/atmosphere.js*',async r=>{const response=await r.fetch();const source=(await response.text()).replaceAll('\r\n','\n');assert.ok(source.includes('  return {\n    leafTexture,'));await r.fulfill({response,body:source.replace('  return {\n    leafTexture,','globalThis.leafState=()=>indoor.map(i=>({bend:i.bend.toArray(),velocity:i.velocity.toArray()}));\n  return {\n    leafTexture,')})});
      await page.route('**/scene.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replaceAll('renderer.render(scene, camera);','window.tableScene?.frame();renderer.render(scene, camera);').replace('  return { highlight, select, home,',sceneProbe+'\n  return { highlight, select, home,')})});
      await page.goto(origin+'/escriptori/anterior.html');
      await page.locator('#workspace[data-ready=true]').waitFor({timeout:60000});await page.locator('#desk-loading').waitFor({state:'hidden'});
      const folders=await page.evaluate(()=>tableScene.folders());
      const [a,b]=folders;assert.ok(a.max[0]<b.min[0]||b.max[0]<a.min[0]||a.max[2]<b.min[2]||b.max[2]<a.min[2],'Pauta and Pentagrama have separate footprints');
      await page.evaluate(()=>{tableBodies.place('DeskStapler',-1.2,2.8);tableBodies.place('LoosePencil',-1.5,2.0);tableBodies.place('LooseBallpoint',-1.5,4.15)});
      const before=await page.evaluate(()=>tableBodies.values());
      if(!mobile)await page.emulateMedia({reducedMotion:'no-preference'});
      if(mobile)await page.locator('[data-area=Medi]').click();
      await page.evaluate(()=>{tableScene.recording=true;tableScene.frames=[]});
      await page.locator('[data-project=relleu-obert]').click();
      await page.waitForFunction(()=>tableScene.phase()==='reading',{},{timeout:60000});
      const after=await page.evaluate(()=>tableBodies.values());
      for(const name of ['DeskStapler','LoosePencil','LooseBallpoint']){
        const p=before.find(i=>i.name===name).position,q=after.find(i=>i.name===name).position;
        assert.ok(Math.hypot(...p.map((v,i)=>v-q[i]))>.08,name+' is moved out of the material/inspection zone');
      }
      await page.locator('#sample-open-inline').click();await page.waitForFunction(()=>tableScene.phase()==='inspecting');
      await page.keyboard.press('Escape');await page.waitForFunction(()=>tableScene.phase()==='reading');
      await page.mouse.move(1,1);await page.keyboard.press('Escape');await page.waitForFunction(()=>tableScene.phase()==='shelf');
      assert.deepEqual(await page.evaluate(()=>tableScene.frames),[],'Props stay clear throughout opening, model extraction and return');
      await page.evaluate(()=>{document.activeElement?.blur();tableScene.recording=false;tableBodies.place('DeskStapler',-1.5,2.5)});
      if(mobile)await page.locator('[data-area=Llengua]').click();
      await page.evaluate(()=>{tableScene.frames=[];tableScene.recording=true});
      await page.locator('[data-project=trama]').click();await page.waitForFunction(()=>tableScene.phase()==='reading');
      await page.mouse.move(1,1);await page.keyboard.press('Escape');await page.waitForFunction(()=>tableScene.phase()==='shelf');
      assert.deepEqual(await page.evaluate(()=>tableScene.frames),[],'The stapler cannot intersect an opening binder');
      await page.evaluate(()=>{tableScene.recording=false;document.activeElement?.blur()});
      if(!mobile){
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.evaluate(()=>{tableBodies.place('LoosePencil',-1.8,2.7);tableScene.propView()});
        const p=(await page.evaluate(()=>tableBodies.values())).find(i=>i.name==='LoosePencil');
        const c=p.min.map((v,i)=>(v+p.max[i])/2),dx=c[0]-p.position[0],dz=c[2]-p.position[2],length=Math.hypot(dx,dz);
        c[0]+=.18*dx/length;c[2]+=.18*dz/length;c[1]=p.max[1]-.008;
        const start=await page.evaluate(c=>tableScene.project(c),c),endWorld=[...c];endWorld[0]+=.4*dz/length;endWorld[2]-=.4*dx/length;
        const end=await page.evaluate(c=>tableScene.project(c),endWorld);
        await page.mouse.move(start.x,start.y);await page.mouse.down();
        if(await page.evaluate(()=>tableBodies.grip())!=='LoosePencil')console.log('Pencil pick',p,c,start,await page.evaluate(p=>tableBodies.pick(p.x,p.y),start));
        assert.equal(await page.evaluate(()=>tableBodies.grip()),'LoosePencil');
        await page.mouse.move(end.x,end.y,{steps:12});await page.mouse.up();
        const q=(await page.evaluate(()=>tableBodies.values())).find(i=>i.name==='LoosePencil');
        assert.ok(Math.hypot(...p.rotation.map((v,i)=>v-q.rotation[i]))>.01,'An off-centre drag rotates the pencil');
        const response=await page.evaluate(()=>{tableScene.brush();const a=leafState();tableScene.brush();return[a,leafState()]});
        const energy=state=>state.reduce((s,i)=>s+i.velocity.reduce((s,v)=>s+v*v,0),0);
        assert.ok(energy(response[0])>0&&energy(response[1])>energy(response[0]),'Leaf impulses accumulate rather than restarting a fixed animation');
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
      console.log('PASS '+(mobile?'320px dark':'desktop')+': separate portfolios, pencil/stapler cleared, collision-free material/model journeys, '+(mobile?'mobile layout.':'off-centre rotation and accumulating foliage impulses.'));
      await ctx.close();
    }
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
