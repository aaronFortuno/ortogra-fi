const assert=require('node:assert/strict'),fs=require('node:fs/promises'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:4187';
const probe=`
  window.tactile={frames:[],record:false,
    frame(){if(!this.record)return;const s=items.find(i=>i.node.name==='DeskStapler'),pivot=s.node.getObjectByName('StaplerPress');
      let sum=0,count=0;pivot.traverse(m=>{if(!m.isMesh)return;const a=m.geometry.attributes.position,p=new THREE.Vector3();
        for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);const q=s.node.worldToLocal(p.clone());if(q.z>.25){sum+=p.y;count++;}}});
      if(count)this.frames.push(sum/count);},
    get(name){const i=items.find(i=>i.node.name===name);refreshItem(i);return {name,position:i.node.getWorldPosition(new THREE.Vector3()).toArray(),min:i.solid.min.toArray(),max:i.solid.max.toArray(),
      rotation:i.node.quaternion.toArray(),velocity:i.velocity.toArray(),busy:!!i.busy,drop:!!i.drop,docked:i.docked?.node.name,bundle:i.bundle?.id,ball:!!i.sheet?.crumpled,changing:!!i.sheet?.changing,
      insertion:i.insertion?.end.toArray(),hint:room.getObjectByName('StaplerSlotHint')?.visible,
      supports:[...i.supports].map(s=>s.node.name),
      center:i.sheet?.crumpled?i.node.localToWorld(i.sheet.ballCenter.clone()).toArray():null,
      shape:i.sheet?.crumpled?Array.from(i.node.geometry.attributes.position.array).filter((_,j)=>j%19===0):null};},
    place(name,x,z){const i=items.find(i=>i.node.name===name);play.detach(i);finishPulse(i);room.attach(i.node);i.node.rotation.set(0,0,0);i.supports.clear();i.velocity.set(0,0,0);i.spin=0;i.drop=null;
      const p=i.node.getWorldPosition(new THREE.Vector3());p.x=x;p.z=z;setWorld(i.node,p);refreshItem(i);p.y+=surface+.002-i.solid.min.y;setWorld(i.node,p);refresh();redraw();},
    makeBall(name,x,z){this.place(name,x,z);const i=items.find(i=>i.node.name===name);i.sheet.crumple(reduced.matches);i.kind='paperball';redraw();},
    grip:()=>grip?.item.node.name,
    resetFrames(){this.frames=[];this.record=true;},
    staples(){let n=0;room.traverse(m=>{if(m.name.startsWith('AttachedStaple_'))n++});return n;},
  };
`;
const sceneProbe=`window.tactileView={project(xyz){camera.updateMatrixWorld();const p=projectPoint(new THREE.Vector3(...xyz)),r=canvas.getBoundingClientRect();return{x:p.x+r.x,y:p.y+r.y}},view(){camera.position.set(-1.9,innerWidth<500?5.5:3.7,innerWidth<500?8.5:6.7);navigation.target.set(-1.9,-.54,2.8);navigation.update();camera.updateMatrixWorld();requestRender()}};`;
(async()=>{
  const manifest=JSON.parse(await fs.readFile('assets/desk/audio/foley/manifest.json'));
  for(const clip of manifest.clips){const b=await fs.readFile('assets/desk/audio/foley/'+clip.file);assert.equal(b.length,clip.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),clip.sha256);assert.ok(clip.peakDbFS<-8);}
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const mobile of [false,true]){
      const ctx=await browser.newContext({viewport:mobile?{width:320,height:568}:{width:1440,height:960},reducedMotion:mobile?'reduce':'no-preference',colorScheme:mobile?'dark':'light'});
      await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/stationery.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replaceAll('\r\n','\n').replace('let moving = play.update(time);','let moving = play.update(time);window.tactile?.frame();').replace('  return {\n    cancel: rollback,',probe+'\n  return {\n    cancel: rollback,')})});
      await page.route('**/scene.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('  return { highlight, select, home,',sceneProbe+'\n  return { highlight, select, home,')})});
      await page.goto(origin+'/escriptori/');await page.locator('#workspace[data-ready=true]').waitFor({timeout:60000});await page.locator('#desk-loading').waitFor({state:'hidden'});
      const get=name=>page.evaluate(name=>tactile.get(name),name),project=p=>page.evaluate(p=>tactileView.project(p),p);
      await page.evaluate(()=>{tactile.place('DeskStapler',-1.9,1.5);tactileView.view()});
      // Drag actual paper from in front of the stapler into its mouth.
      async function insert(name,retreat=false,quick=false){
        await page.evaluate(name=>tactile.place(name,-1.9,4.05),name);
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        await page.waitForFunction(name=>!tactile.get(name).drop,name);
        // Stop with the free edge still about .4 units from the mouth: outside
        // the old .25 capture range. The paper must visibly dock before release.
        const s=await get(name),p=await project([s.position[0],s.max[1],s.position[2]]),q=await project([s.position[0],s.max[1],s.position[2]-.74]);
        await page.mouse.move(p.x,p.y);await page.mouse.down();assert.equal(await page.evaluate(()=>tactile.grip()),name);
        await page.mouse.move(q.x,q.y,{steps:20});
        if(quick){
          assert.ok((await get(name)).insertion,'A quick release has a predicted destination');
          await page.mouse.up();await page.waitForFunction(name=>tactile.get(name).docked==='DeskStapler'&&!tactile.get(name).busy&&!tactile.get(name).changing,name,{timeout:5000});return;
        }
        await page.waitForFunction(name=>{const s=tactile.get(name);return s.insertion&&!s.changing&&Math.hypot(...s.position.map((v,i)=>v-s.insertion[i]))<.015},name,{timeout:5000});
        const preview=await get(name);assert.equal(preview.docked,undefined,'Preview is reversible until pointer release');
        assert.ok(preview.hint,'The contact cue is visible');assert.ok(preview.max[1]-preview.min[1]>.025,'The preview already bends over the anvil');
        assert.ok(s.position[2]-.74-preview.position[2]>.20,'The wider magnet pulls the paper beyond the pointer position');
        if(retreat){
          await page.screenshot({path:'output/desk/magnetic-preview-'+(mobile?'mobile':'desktop')+'.png'});
          await page.mouse.move(p.x,p.y);
          await page.waitForFunction(name=>{const s=tactile.get(name);return !s.insertion&&!s.hint&&Math.abs(s.position[2]-4.05)<.08},name,{timeout:5000});
          assert.equal((await get(name)).docked,undefined,'Moving away disengages the magnet');
          await page.mouse.up();await page.waitForFunction(name=>!tactile.get(name).drop,name);
          assert.equal((await get(name)).docked,undefined,'Release outside the capture area does not dock');
          return insert(name);
        }
        await page.mouse.up();
        try{await page.waitForFunction(name=>tactile.get(name).docked==='DeskStapler'&&!tactile.get(name).busy,name,{timeout:5000});}
        catch(e){console.log('Insertion failed',mobile,await get(name));await page.screenshot({path:'output/desk/insertion-failed.png'});throw e;}
      }
      async function press(){
        const s=await get('DeskStapler'),p=await project([(s.min[0]+s.max[0])/2,s.max[1]-.012,(s.min[2]+s.max[2])/2]);
        await page.mouse.click(p.x,p.y);await page.waitForFunction(()=>!tactile.get('DeskStapler').busy);
      }
      await insert('LooseWorksheet_4',true);
      await page.evaluate(()=>tactile.resetFrames());await press();
      assert.equal(await page.evaluate(()=>tactile.staples()),1,'Inserted paper receives a staple');
      if(!mobile){const frames=await page.evaluate(()=>tactile.frames);assert.ok(Math.max(...frames)-Math.min(...frames)>.06,'Visible handle vertices actually travel down');}
      await insert('LooseWorksheet_3',false,true);await press();
      assert.ok((await get('LooseWorksheet_4')).bundle);assert.equal((await get('LooseWorksheet_4')).bundle,(await get('LooseWorksheet_3')).bundle);
      await page.screenshot({path:'output/desk/slot-paper-'+(mobile?'mobile':'desktop')+'.png'});
      // Two independent crumples have distinct geometry, then a tap rolls one.
      await page.evaluate(()=>{tactile.makeBall('LooseWorksheet_2',-1.4,3.2);tactile.makeBall('LooseWorksheet_1',-2.6,3.3)});
      await page.waitForFunction(()=>{const a=tactile.get('LooseWorksheet_2'),b=tactile.get('LooseWorksheet_1');return !a.drop&&!b.drop&&a.max[0]-a.min[0]<.60&&b.max[0]-b.min[0]<.60});
      const a=await get('LooseWorksheet_2'),b=await get('LooseWorksheet_1');assert.notDeepEqual(a.shape,b.shape,'Paper balls have distinct folds');
      if(!mobile){
        const p=await project(a.center);await page.mouse.click(p.x,p.y);
        try{await page.waitForFunction(before=>{const a=tactile.get('LooseWorksheet_2');return Math.hypot(a.center[0]-before[0],a.center[2]-before[2])>.06},a.center,{timeout:6000});}
        catch(e){console.log('Ball motion failed',a,await get(a.name));throw e;}
        const moved=await get(a.name);assert.ok(Math.hypot(moved.rotation[0],moved.rotation[2])>.04,'Ball rolls about a horizontal axis, not just vertical spin');
        assert.ok(moved.min[1]>=-.585&&moved.min[1]<-.50,'Irregular ball remains supported while rolling');
      }
      // Decode every real recording and ensure effects use samples, not oscillators.
      const audio=await page.evaluate(async()=>{
        const {objectAudio}=await import('./object-audio.js?v=1.19.0');const ctx=new AudioContext();await ctx.resume();
        let oscillators=0,samples=0;const osc=ctx.createOscillator.bind(ctx),src=ctx.createBufferSource.bind(ctx);
        ctx.createOscillator=()=>{oscillators++;return osc()};ctx.createBufferSource=()=>{samples++;return src()};
        const fx=objectAudio(ctx);await fx.ready;for(const [action,material] of [['staple','metal'],['crumple','paper'],['page','paper'],['land','pen'],['land','cup'],['slide','paperball']])fx.play(action,material);
        fx.stop();await ctx.close();return{oscillators,samples};
      });assert.equal(audio.oscillators,0);assert.equal(audio.samples,6);
      assert.deepEqual(errors,[]);console.log('PASS '+(mobile?'320px dark/reduced':'desktop')+': wider magnetic preview, bend before release, reversible detachment, paper insertion, working head, stapled stack, rolling balls and recorded foley.');await ctx.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
