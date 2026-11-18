const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = 'http://127.0.0.1:4187';
const output = path.resolve(__dirname, '../tmp/desk');

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const [width, height, theme] of [[1440, 960, 'light'], [1280, 800, 'dark'], [390, 844, 'light'], [320, 568, 'dark']]) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
      await page.goto(origin + '/escriptori/');
      await page.locator('#workspace[data-ready=true]').waitFor({ timeout: 20000 });
      assert.equal(await page.locator('.binder-target').count(), 8);
      assert.equal(await page.locator('.binder-target:visible').count(), width > 700 ? 8 : 4);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await page.locator('footer').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight));
      await page.screenshot({ path: path.join(output, 'shelf-' + width + '-' + theme + '.png') });
      if (width === 1440) {
        const initial = await page.locator('[data-project=trama]').boundingBox();
        await page.locator('[data-view=left]').click();
        await page.waitForFunction(x => Math.abs(document.querySelector('[data-project=trama]').getBoundingClientRect().x - x) > 5, initial.x);
        await page.screenshot({ path: path.join(output, 'look-left.png') });
        await page.locator('[data-view=home]').click();
        await page.waitForFunction(x => Math.abs(document.querySelector('[data-project=trama]').getBoundingClientRect().x - x) < 1, initial.x);
        await page.locator('[data-view=in]').click();
        await page.waitForFunction(width => document.querySelector('[data-project=trama]').getBoundingClientRect().width > width * 1.1, initial.width);
        await page.locator('[data-view=home]').click();
        await page.waitForFunction(x => Math.abs(document.querySelector('[data-project=trama]').getBoundingClientRect().x - x) < 1, initial.x);
      }
      const trama = page.locator('[data-project=trama]');
      await trama.hover();
      await page.locator('#hover-caption.visible').waitFor();
      await page.screenshot({ path: path.join(output, 'hover-' + width + '.png') });
      await trama.click();
      await page.locator('#project-detail.is-visible').waitFor();
      assert.equal(await page.locator('#project-title').innerText(), 'Trama');
      assert.equal(await page.locator('#project-enter').getAttribute('href'), 'https://trama.ortogra.fi/');
      assert.equal(await page.locator('#desk-canvas').getAttribute('data-selected'), 'trama');
      await page.screenshot({ path: path.join(output, 'open-' + width + '-' + theme + '.png') });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#project-detail').open && !document.querySelector('#shelf-controls').inert);
      assert.equal(await page.locator('#desk-canvas').getAttribute('data-selected'), null);
      if (width < 701) {
        await page.locator('[data-area=Utilitats]').click();
        assert.equal(await page.locator('.binder-target:visible').count(), 2);
        await page.locator('[data-project=pentagrama]').click();
        await page.locator('#project-detail.is-visible').waitFor();
        assert.equal(await page.locator('#project-title').innerText(), 'Pentagrama');
        assert.equal(await page.locator('#project-detail').getAttribute('data-kind'), 'folder');
        await page.locator('.binder-close').click();
        await page.waitForFunction(() => !document.querySelector('#project-detail').open && !document.querySelector('#shelf-controls').inert);
      }
      await page.locator('.list-toggle').click();
      await page.locator('#projectes.is-open').waitFor();
      assert.equal(await page.locator('#projectes a').count(), 8);
      await page.keyboard.press('Escape');
      await page.locator('#about-open').click();
      await page.locator('#about-dialog.is-visible').waitFor();
      assert.ok(await page.locator('#about-dialog').isVisible());
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(origin + '/escriptori/');
    await page.locator('#workspace[data-ready=true]').waitFor();
    // Repeat a full cycle to check that callbacks, focus and the selected object reset.
    for (const id of ['plec', 'pauta', 'sentit', 'relleu-obert']) {
      await page.locator('[data-project=' + id + ']').focus();
      await page.keyboard.press('Enter');
      await page.locator('#project-detail.is-visible').waitFor();
      if (id === 'relleu-obert') assert.equal(await page.locator('#project-detail').getAttribute('data-kind'), 'box');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#project-detail').open && !document.querySelector('#shelf-controls').inert);
    }
    await context.close();
    const noScript = await browser.newContext({ javaScriptEnabled: false });
    const fallback = await noScript.newPage();
    await fallback.goto(origin + '/escriptori/');
    assert.ok(await fallback.locator('#projectes').isVisible());
    assert.equal(await fallback.locator('#projectes a').count(), 8);
    await noScript.close();
    console.log('PASS: Blender models, 8 projects, binder/folder/box, viewpoint and zoom, hover, open/close, keyboard, mobile, themes, V4V and fallback.');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
