const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:4187';
const output = path.resolve(__dirname, '../tmp/desk');

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 }, reducedMotion: 'reduce', hasTouch: mobile });
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
      await page.goto(origin + '/escriptori/');
      await page.locator('#workspace[data-ready=true]').waitFor({ timeout: 30000 });
      await page.locator('[data-project=trama]').hover();
      await page.locator('.object-outline.is-visible').waitFor();
      assert.ok((await page.locator('.object-outline path').getAttribute('d')).startsWith('M'));
      if (!mobile) await page.screenshot({ path: path.join(output, 'shelf-lived-in.png') });
      await page.locator('[data-project=trama]').click();
      await page.locator('#project-detail.is-visible').waitFor();
      assert.equal(await page.locator('#project-detail').getAttribute('data-sample-count'), '2');
      if (!mobile) {
        await page.locator('#sample-open').hover();
        await page.locator('#sample-lens.is-visible').waitFor();
        assert.ok(!(await page.locator('#sample-lens').getAttribute('style')).includes('NaN'));
        await page.screenshot({ path: path.join(output, 'portfolio-lens.png') });
      }
      await page.locator(mobile ? '#sample-open-inline' : '#sample-open').click();
      await page.locator('#sample-viewer.is-visible').waitFor();
      await page.waitForFunction(() => document.querySelector('#sample-document').naturalWidth > 0 && !document.querySelector('#sample-document').classList.contains('is-loading'));
      assert.equal(await page.locator('#sample-counter').innerText(), '1 / 2');
      assert.ok(await page.locator('#project-detail').evaluate(dialog => dialog.open));
      const before = await page.locator('#sample-document').boundingBox();
      await page.locator('#sample-zoom-in').click();
      assert.equal(await page.locator('#sample-scale').innerText(), '125%');
      assert.ok((await page.locator('#sample-document').boundingBox()).height > before.height * 1.15);
      await page.locator('#sample-fit').click();
      await page.locator('#sample-next').click();
      await page.waitForFunction(() => document.querySelector('#sample-document').src.endsWith('trama-2.webp') && document.querySelector('#sample-document').complete);
      assert.equal(await page.locator('#sample-counter').innerText(), '2 / 2');
      await page.screenshot({ path: path.join(output, 'sample-viewer-' + (mobile ? 'mobile' : 'desktop') + '.png') });
      const downloading = page.waitForEvent('download');
      await page.locator('#sample-pdf').click();
      const download = await downloading;
      await download.saveAs(path.join(output, 'sample-download.pdf'));
      const bytes = await fs.readFile(path.join(output, 'sample-download.pdf'));
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#sample-viewer').open);
      assert.ok(await page.locator('#project-detail').evaluate(dialog => dialog.open));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#project-detail').open && !document.querySelector('#shelf-controls').inert);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(origin + '/escriptori/');
    await page.locator('#workspace[data-ready=true]').waitFor({ timeout: 30000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const opening = Date.now();
    await page.locator('[data-project=plec]').click();
    await page.locator('#project-detail.is-visible').waitFor({ timeout: 30000 });
    assert.ok(Date.now() - opening >= 2200, 'Opening and camera travel must be visibly slower');
    const closing = Date.now();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#shelf-controls').inert);
    assert.ok(Date.now() - closing >= 2400, 'Closing and return camera travel must be visibly slower');
    await context.close();
    console.log('PASS: hover contour, lens, full PDF samples, page navigation, zoom, download, nested Escape, mobile and slower opening/closing.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
