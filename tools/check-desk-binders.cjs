const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:4187';
const probe = `
  const checkedBinders = [...models.values()].filter(m => m.project.kind === 'binder');
  const originalParts = new Map();
  const worldVertices = mesh => {
    mesh.updateWorldMatrix(true, false);
    const a = mesh.geometry.attributes.position;
    return Array.from({length:a.count}, (_,i) => new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld));
  };
  checkedBinders.forEach(m => m.group.traverse(n => {
    if(n.isMesh) originalParts.set(n, n.geometry.attributes.position.array.slice());
  }));
  const closestCovers = (left, right) => {
    let front, back, nearest = Infinity, height;
    left.group.traverse(n=>{if(n.name.startsWith('FrontCover')) front=n;});
    right.group.traverse(n=>{if(n.name.startsWith('BackCover')) back=n;});
    const a=worldVertices(front), b=worldVertices(back), index=front.geometry.index?.array;
    const triangle=new THREE.Triangle(), point=new THREE.Vector3();
    for(let i=0;i<(index?.length||a.length);i+=3){
      triangle.set(a[index?index[i]:i],a[index?index[i+1]:i+1],a[index?index[i+2]:i+2]);
      for(const v of b){
        const d=triangle.closestPointToPoint(v,point).distanceTo(v);
        if(d<nearest){nearest=d;height=v.y;}
      }
    }
    return {distance:nearest,height};
  };
  window.binderCheck={
    phase:()=>phase,
    support(){return checkedBinders.map((m,i)=>{
      const points=[];m.group.traverse(n=>{if(n.isMesh)points.push(...worldVertices(n));});
      return {id:m.project.id,foot:Math.min(...points.map(p=>p.y)),left:Math.min(...points.map(p=>p.x)),
        right:Math.max(...points.map(p=>p.x)),lean:m.group.rotation.z,
        contact:i?closestCovers(checkedBinders[i-1],m):null};
    });},
    restoreError(){
      let error=0;for(const [mesh,rest] of originalParts){
        const a=mesh.geometry.attributes.position.array;for(let i=0;i<a.length;i++)error=Math.max(error,Math.abs(a[i]-rest[i]));
      }
      return {geometry:error,pose:Math.max(...checkedBinders.map(m=>m.group.position.distanceTo(m.home)))};
    },
  };
`;
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    for(const mobile of process.argv.includes('--desktop')?[false]:[false,true]){
      const context=await browser.newContext({viewport:mobile?{width:320,height:568}:{width:1440,height:960},
        reducedMotion:'reduce',colorScheme:mobile?'dark':'light',hasTouch:mobile,isMobile:mobile});
      await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      const page=await context.newPage(),errors=[];
      await page.route('**/stationery.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('if(!route)return false;',"if(!route){window.blockedProp=item.node.name;return false;}")});});
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.route('**/scene.js*',async r=>{
        const response=await r.fetch(),source=await response.text();
        const anchor='  return { highlight, select, home,';assert.ok(source.includes(anchor));
        await r.fulfill({response,body:source.replace(anchor,probe+'\n'+anchor)});
      });
      await page.goto(origin+'/escriptori/anterior.html');
      await page.locator('#workspace[data-ready=true]').waitFor({timeout:60000});
      await page.locator('#desk-loading').waitFor({state:'hidden'});
      const support=await page.evaluate(()=>binderCheck.support());
      assert.equal(support.length,5);
      for(const [i,b] of support.entries()){
        assert.ok(Math.abs(b.foot-(-.579))<1e-5,b.id+': foot rests on the desktop');
        assert.ok(b.right< -1.76,b.id+': stays inside the organizer');
        if(i){
          assert.ok(b.lean>support[i-1].lean,b.id+': progressively leans on its neighbour');
          assert.ok(b.contact.distance>=.003&&b.contact.distance<.035,b.id+': real covers meet without intersecting: '+JSON.stringify(b.contact));
          assert.ok(b.contact.height>.65,b.id+': support is on the upper board');
        }else assert.ok(Math.abs(b.left-(-5.936))<1e-5,'The first binder rests against the wooden cheek');
      }
      for(const id of mobile?['plec','sentit']:support.map(b=>b.id)){
        const only=process.argv.find(a=>a.startsWith('--project='))?.split('=')[1];if(only&&id!==only)continue;
        const target=page.locator('[data-project="'+id+'"]');
        if(mobile) await target.tap(); else await target.click();
        await page.waitForFunction(()=>binderCheck.phase()==='reading').catch(async error=>{
          console.error(id,await page.evaluate(()=>({phase:binderCheck.phase(),blocked:window.blockedProp,status:document.querySelector('#desk-status').textContent})),errors);throw error;
        });
        assert.equal(await page.locator('#desk-canvas').getAttribute('data-selected'),id,'Select the intended binder');
        await page.mouse.move(1,1);await page.keyboard.press('Escape');
        await page.waitForFunction(()=>binderCheck.phase()==='shelf');
        await page.evaluate(()=>document.activeElement?.blur());
        const restored=await page.evaluate(()=>binderCheck.restoreError());
        assert.equal(restored.geometry,0,'Loaded shape returns without drift');
        assert.ok(restored.pose<1e-8,'Binders return to their supports');
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);
      console.log('PASS '+(mobile?'320px dark':'desktop')+': real support, planted feet, selectable spines and exact deformation/pose restoration. '+JSON.stringify(support.map(b=>({id:b.id,contact:b.contact}))));
      await context.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
