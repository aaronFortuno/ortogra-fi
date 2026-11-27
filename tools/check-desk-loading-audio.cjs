const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright');
const origin='http://127.0.0.1:4187',out=path.resolve('output/desk/loading-audio');
const gate=()=>{let release;const promise=new Promise(r=>release=r);return {promise,release};};
(async()=>{await fs.mkdir(out,{recursive:true});
  for(const mode of ['allowed','blocked','muted','unavailable','slow']){
    const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy='+(mode==='blocked'?'document-user-activation-required':'no-user-gesture-required')]});
    const scene=gate(),extras=gate(),wind=gate();
    try{
      const mobile=mode==='blocked',ctx=await browser.newContext({viewport:mobile?{width:320,height:568}:{width:1280,height:800},colorScheme:mobile?'dark':'light',reducedMotion:'reduce'});
      await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      await ctx.addInitScript(({muted})=>{
        if(muted)localStorage.setItem('ortografi-desk-muted','true');
        const Native=AudioContext;window.loadingVoices=[];
        window.AudioContext=class extends Native{constructor(...args){super(...args);window.loadingContext=this;const make=this.createBufferSource.bind(this);
          this.createBufferSource=()=>{const source=make(),start=source.start.bind(source);source.start=(...args)=>{loadingVoices.push({duration:source.buffer.duration,ready:document.querySelector('#workspace').dataset.ready==='true'});return start(...args)};return source;};}};
      },{muted:mode==='muted'});
      const page=await ctx.newPage(),requests=[],errors=[];let sceneRequested=false;
      page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/scene.js*',async r=>{sceneRequested=true;await scene.promise;await r.continue();});
      await page.route('**/audio/*.mp3',async r=>{
        if(r.request().url().includes('/wind-leaves.mp3')){
          if(mode==='unavailable')return r.fulfill({status:503,body:'Unavailable'});
          if(mode==='slow')await wind.promise;
        }else if(mode==='allowed')await extras.promise;
        await r.continue();
      });
      await page.goto(origin+'/escriptori/anterior.html',{waitUntil:'domcontentloaded'});
      if(mode==='muted'){
        await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>typeof loadingContext),'undefined');assert.ok(!requests.some(u=>u.includes('/desk/audio/')),'Remembered mute skips even the preload');
      }else if(mode==='unavailable'){
        await page.locator('#ambient-toggle[data-audio-state=error]').waitFor();
      }else if(mode==='slow'){
        const started=Date.now();while(!sceneRequested&&Date.now()-started<4200)await page.waitForTimeout(50);
        assert.ok(sceneRequested,'Slow audio cannot block the 3D interface indefinitely');assert.equal(await page.evaluate(()=>loadingVoices.length),0);wind.release();
      }else if(mode==='blocked'){
        await page.locator('#loading-audio-toggle.is-available').waitFor();
        assert.equal(await page.evaluate(()=>loadingContext.state),'suspended');assert.equal(await page.evaluate(()=>loadingVoices.length),0);
        const b=await page.locator('#loading-audio-toggle').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=320&&b.y>64&&b.y+b.height<518,'The loading audio action fits a small dark screen');
        await page.screenshot({path:path.join(out,'blocked-mobile-dark.png')});await page.locator('#loading-audio-toggle').click();
      }
      if(!['muted','unavailable'].includes(mode)){
        await page.locator('#ambient-toggle[data-audio-state=playing]').waitFor();
        assert.equal(await page.locator('#workspace').getAttribute('data-ready'),null,'The ambient starts before the scene is ready');
        assert.equal(await page.locator('#desk-loading').isVisible(),true);
        const voices=await page.evaluate(()=>loadingVoices);assert.ok(voices.some(v=>Math.abs(v.duration-32)<.01&&!v.ready));
        assert.ok(!requests.some(u=>u.includes('/foley/')),'Object effects do not compete with the initial ambience');
        if(mode==='allowed'){
          assert.ok(requests.findIndex(u=>u.includes('/wind-leaves.mp3'))<requests.findIndex(u=>u.includes('/scene.js')),'Wind is requested before the renderer');
          await page.screenshot({path:path.join(out,'playing-during-load.png')});
        }
      }
      scene.release();extras.release();wind.release();await page.locator('#workspace[data-ready=true]').waitFor({timeout:90000});await page.locator('#desk-loading').waitFor({state:'hidden'});
      if(mode==='muted')assert.equal(await page.locator('#ambient-toggle').getAttribute('aria-pressed'),'false');
      else if(mode!=='unavailable')assert.equal(await page.locator('#ambient-toggle').getAttribute('data-audio-state'),'playing');
      assert.deepEqual(errors,[]);console.log('PASS '+mode+': prioritised ambience, browser policy, lazy foley and independent scene loading.');await ctx.close();
    }finally{scene.release();extras.release();wind.release();await browser.close();}
  }
})().catch(e=>{console.error(e);process.exitCode=1});
