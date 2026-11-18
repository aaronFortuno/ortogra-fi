const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:4187';
const output = path.resolve(__dirname, '../tmp/desk');

async function fixClock(page) {
  await page.addInitScript(() => {
    window.deskTestNow = '2026-11-18T09:00:00Z';
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [window.deskTestNow])); }
      static now() { return new NativeDate(window.deskTestNow).valueOf(); }
    };
  });
}
async function choose(page, day, time) {
  await page.locator('#light-date').fill(day);
  await page.locator('#light-time').fill(time);
  await page.locator('#light-time').press('Tab');
  await page.waitForFunction(() => document.querySelector('#desk-canvas').dataset.lightMode === 'manual');
}
(async () => {
  await fs.mkdir(output, {recursive:true});
  const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
    await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const page = await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await fixClock(page);
    await page.addInitScript(() => {
      window.deskProgress=[];
      const observer = new MutationObserver(() => {
        const meter=document.querySelector('.loading-meter');
        if(meter)window.deskProgress.push(Number(meter.getAttribute('aria-valuenow')));
      });
      observer.observe(document,{subtree:true,attributes:true,attributeFilter:['aria-valuenow']});
    });
    let release;
    const waiting = new Promise(resolve=>{release=resolve;});
    await page.route('**/escriptori.glb*',async route=>{await waiting;await route.continue();});
    await page.goto(origin+'/escriptori/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>Number(document.querySelector('.loading-meter').getAttribute('aria-valuenow'))>=10);
    assert.ok(await page.locator('#desk-loading').isVisible());
    assert.ok(await page.locator('.desk-view-tools').evaluate(e=>e.inert));
    assert.equal(await page.locator('#workspace').getAttribute('aria-busy'),'true');
    assert.ok(Number(await page.locator('.loading-meter').getAttribute('aria-valuenow'))<100);
    await page.screenshot({path:path.join(output,'loading-progress.png')});
    release();
    await page.locator('#workspace[data-ready=true]').waitFor({timeout:60000});
    await page.locator('#desk-loading').waitFor({state:'hidden'});
    const progress=await page.evaluate(()=>window.deskProgress);
    assert.equal(progress.at(-1),100);
    assert.ok(progress.every((value,index)=>!index||value>=progress[index-1]));
    assert.equal(await page.locator('#workspace').getAttribute('aria-busy'),'false');
    assert.equal(await page.locator('#desk-canvas').getAttribute('data-lighting'),'day');
    await page.locator('[data-view=left]').click();
    await page.screenshot({path:path.join(output,'lighting-morning.png')});
    await page.locator('#light-toggle').click();
    await page.locator('#light-panel:popover-open').waitFor();
    assert.equal(await page.locator('#light-time').inputValue(),'10:00');
    await choose(page,'2026-12-21','18:00');
    const winter=Number(await page.locator('#desk-canvas').getAttribute('data-solar-altitude'));
    assert.ok(winter<0);
    await page.locator('.light-close').click();
    await page.screenshot({path:path.join(output,'lighting-winter-evening.png')});
    await page.locator('#light-toggle').click();
    await choose(page,'2026-06-21','18:00');
    const summer=Number(await page.locator('#desk-canvas').getAttribute('data-solar-altitude'));
    assert.ok(summer>20&&summer>winter+20);
    await page.locator('.light-close').click();
    await page.screenshot({path:path.join(output,'lighting-summer-evening.png')});
    await page.locator('#light-toggle').click();
    await choose(page,'2026-11-18','23:00');
    assert.equal(await page.locator('#desk-canvas').getAttribute('data-lighting'),'night');
    await page.locator('.light-close').click();
    await page.screenshot({path:path.join(output,'lighting-night.png')});
    await page.locator('[data-view=home]').click();
    assert.equal(await page.locator('#workspace').getAttribute('data-dim'),'true');
    assert.ok(await page.locator('.desk-intro').evaluate(e=>Number(getComputedStyle(e).color.match(/\d+/)[0])>180),'The heading must remain readable in the night scene with a light UI');
    await page.screenshot({path:path.join(output,'lighting-night-front.png')});
    await page.locator('[data-project=trama]').click();
    await page.locator('#project-detail.is-visible').waitFor();
    await page.screenshot({path:path.join(output,'lighting-reading-night.png')});
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#shelf-controls').inert);
    await page.locator('#light-toggle').click();
    await page.locator('#light-now').click();
    await page.waitForFunction(()=>document.querySelector('#desk-canvas').dataset.lightMode==='auto');
    assert.equal(await page.locator('#light-time').inputValue(),'10:00');
    await page.locator('.light-close').click();
    await page.evaluate(()=>{window.deskTestNow='2026-11-18T22:00:00Z';document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>document.querySelector('#desk-canvas').dataset.lighting==='night');
    await page.locator('[data-theme-toggle]').click();
    assert.equal(await page.locator('#desk-canvas').getAttribute('data-lighting'),'night');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('#light-toggle').click();
    await choose(page,'2026-11-18','10:00');
    await page.waitForFunction(()=>document.querySelector('#desk-canvas').dataset.lighting==='day');
    await page.locator('.light-close').click();
    await page.locator('[data-project=plec]').click();
    await page.locator('#project-detail.is-visible').waitFor({timeout:30000});
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#shelf-controls').inert);
    assert.deepEqual(errors,[]);
    await context.close();
    const mobile=await browser.newContext({viewport:{width:320,height:568},reducedMotion:'reduce',hasTouch:true});
    await mobile.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const phone=await mobile.newPage();await fixClock(phone);
    await phone.goto(origin+'/escriptori/');
    await phone.locator('#workspace[data-ready=true]').waitFor({timeout:60000});
    await phone.locator('#light-toggle').click();
    const box=await phone.locator('#light-panel').boundingBox();
    assert.ok(box.x>=0&&box.x+box.width<=321&&box.y>=0&&box.y+box.height<568);
    await choose(phone,'2026-11-18','23:00');
    assert.equal(await phone.locator('#desk-canvas').getAttribute('data-lighting'),'night');
    assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await phone.screenshot({path:path.join(output,'lighting-controls-mobile.png')});
    await mobile.close();
    const failed=await browser.newContext({reducedMotion:'reduce'});
    await failed.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const fallback=await failed.newPage();
    await fallback.route('**/escriptori.glb*',route=>route.fulfill({status:503,body:'Unavailable'}));
    await fallback.goto(origin+'/escriptori/');
    await fallback.locator('#workspace.failed').waitFor();
    assert.ok(await fallback.locator('#desk-loading').isHidden());
    assert.ok(await fallback.locator('#projectes.is-open').isVisible());
    assert.ok(Number(await fallback.locator('.loading-meter').getAttribute('aria-valuenow'))<100);
    await failed.close();
    console.log('PASS: real loading progress, ready after render, seasonal daylight, night room light, manual/automatic clock, theme independence, mobile controls and failure fallback.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
