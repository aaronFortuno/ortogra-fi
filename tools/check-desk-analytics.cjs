const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:4187';
const source=fs.readFileSync('escriptori/desk.js','utf8');
const fn=source.slice(source.indexOf('function track('),source.indexOf('\nfunction setList('));
const sent=[],environment={location:{protocol:'https:',hostname:'ortogra.fi'},navigator:{webdriver:false},
  window:{umami:{track:(...args)=>sent.push(args)}}};
vm.runInNewContext(fn+'\nglobalThis.sendDeskEvent=track;',environment);
environment.sendDeskEvent('obre_fitxa_escriptori',{projecte:'trama'});
assert.equal(sent[0][0],'v2_obre_fitxa');assert.equal(sent[0][1].interficie,'escriptori');assert.equal(sent[0][1].projecte,'trama');
environment.location.hostname='127.0.0.1';environment.sendDeskEvent('obre_projecte',{});assert.equal(sent.length,1);
environment.location.hostname='ortogra.fi';environment.navigator.webdriver=true;environment.sendDeskEvent('obre_projecte',{});assert.equal(sent.length,1);
environment.navigator.webdriver=false;environment.window.umami=undefined;environment.sendDeskEvent('obre_projecte',{});
console.log('PASS: v2 names/properties, localhost and automated-browser guards, and optional blocked analytics.');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
    // Only a local in-memory stub receives these events. All external requests
    // are blocked, including the real collector and any project navigation.
    await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    await ctx.addInitScript(()=>{window.qaEvents=[];window.umami={track:(name,data)=>{qaEvents.push({name,data});return Promise.resolve()}}});
    await ctx.route('**/desk.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace("if (location.protocol !== 'https:' || location.hostname !== 'ortogra.fi' || navigator.webdriver) return;",'if (false) return;')})});
    await ctx.route('**/app.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace("if(location.protocol!=='https:'||location.hostname!=='ortogra.fi'||navigator.webdriver)return;",'if(false)return;')})});
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/escriptori/');await page.locator('#workspace[data-ready=true]').waitFor({timeout:60000});
    assert.equal(await page.locator('script[data-website-id]').count(),0,'No real tracker is loaded locally');
    assert.equal(await page.locator('a[data-umami-event=v2_obre_portafoli]').count(),1);
    assert.equal(await page.locator('a[data-umami-event=v2_obre_portafoli]').getAttribute('data-umami-event-interficie'),'escriptori');
    await page.locator('[data-area=Llengua]').click();
    await page.locator('[data-project=trama]').click();await page.locator('#project-detail.is-visible').waitFor();
    await page.locator('#sample-next').click();await page.waitForFunction(()=>document.querySelector('#sample-counter').textContent==='3 / 3');
    await page.locator('#sample-open-inline').click();await page.waitForFunction(()=>document.querySelector('#project-detail').dataset.inspecting==='true');
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#project-detail').dataset.inspecting);
    await page.evaluate(()=>document.querySelector('#project-enter').addEventListener('click',e=>e.preventDefault()));
    await page.locator('#project-enter').click();
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#project-detail').open&&!document.querySelector('#shelf-controls').inert);
    await page.locator('[data-view=out]').click();
    await page.locator('[data-theme-toggle]').click();
    const theme=await page.locator('html').getAttribute('data-theme');
    await page.locator('#ambient-toggle').click();
    await page.locator('#about-open').click();await page.locator('#about-dialog[open]').waitFor();
    await page.locator('#about-dialog [data-close]').click();await page.locator('#about-dialog').waitFor({state:'hidden'});
    await page.locator('.list-toggle').click();
    await page.locator('#projectes a').first().evaluate(a=>a.addEventListener('click',e=>e.preventDefault()));
    await page.locator('#projectes a').first().click();
    const events=await page.evaluate(()=>qaEvents),names=events.map(e=>e.name);
    for(const name of ['v2_tria_area','v2_obre_fitxa','v2_passa_mostra','v2_amplia_mostra','v2_obre_projecte','v2_tanca_fitxa','v2_mou_camara','v2_canvia_tema','v2_so_ambient','v2_obre_v4v'])assert.ok(names.includes(name),name);
    assert.ok(names.every(name=>name.startsWith('v2_')));assert.equal(events.find(e=>e.name==='v2_canvia_tema').data.tema,theme);
    assert.ok(events.some(e=>e.name==='v2_obre_projecte'&&e.data.origen==='llista'));
    assert.deepEqual(errors,[]);console.log('PASS: local-only capture of real desk actions, v2 V4V/portfolio scope and the updated theme value.');
    await ctx.close();
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
