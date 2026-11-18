const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = 'http://127.0.0.1:4187';
const output = path.resolve(__dirname, '../tmp/desk');

async function checkTouch(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  try {
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(origin + '/escriptori/');
    await page.locator('#workspace[data-ready=true]').waitFor();
    const target = page.locator('[data-project=trama]');
    const initial = await target.boundingBox();
    const cdp = await context.newCDPSession(page);
    const x = initial.x + initial.width / 2, y = initial.y + initial.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 60, y: y + 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('#project-detail').evaluate(dialog => dialog.open), false);
    const home = await page.locator('[data-view=home]').boundingBox();
    const reset = () => page.touchscreen.tap(home.x + home.width / 2, home.y + home.height / 2);
    await reset();
    await page.waitForFunction(x => Math.abs(document.querySelector('[data-project=trama]').getBoundingClientRect().x - x) < 1, initial.x);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 170, y: 410 }, { x: 220, y: 410 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 140, y: 410 }, { x: 250, y: 410 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(width => document.querySelector('[data-project=trama]').getBoundingClientRect().width > width * 1.15, initial.width);
    await reset();
    await page.waitForFunction(x => Math.abs(document.querySelector('[data-project=trama]').getBoundingClientRect().x - x) < 1, initial.x);
    await target.tap();
    await page.locator('#project-detail.is-visible').waitFor();
    assert.equal(await page.locator('#project-title').innerText(), 'Trama');
  } finally { await context.close(); }
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    if (process.argv.includes('--touch')) {
      await checkTouch(browser);
      console.log('PASS: touch swipe, two-finger pinch and first tap after each gesture.');
      return;
    }
    const readingOnly = process.argv.includes('--reading');
    const layouts = readingOnly ? [[390, 844, 'light']] : [[1440, 960, 'light'], [1280, 800, 'dark'], [390, 844, 'light'], [320, 568, 'dark']];
    for (const [width, height, theme] of layouts) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion: readingOnly ? 'reduce' : 'no-preference' });
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
        await page.waitForFunction(() => document.querySelector('#desk-canvas').dataset.ambience === 'moving');
        await page.screenshot({ path: path.join(output, 'look-left.png') });
        await page.locator('[data-view=home]').click();
        await page.waitForFunction(x => Math.abs(document.querySelector('[data-project=trama]').getBoundingClientRect().x - x) < 1, initial.x);
        // Navigation also works on the object hit areas, without opening a card.
        const center = { x: initial.x + initial.width / 2, y: initial.y + initial.height / 2 };
        await page.mouse.move(center.x, center.y);
        await page.mouse.down();
        await page.mouse.move(center.x + 95, center.y + 20, { steps: 8 });
        await page.mouse.up();
        assert.equal(await page.locator('#project-detail').evaluate(dialog => dialog.open), false);
        await page.waitForFunction(x => Math.abs(document.querySelector('[data-project=trama]').getBoundingClientRect().x - x) > 20, initial.x);
        await page.locator('[data-view=home]').click();
        await page.waitForFunction(x => Math.abs(document.querySelector('[data-project=trama]').getBoundingClientRect().x - x) < 1, initial.x);
        await page.mouse.move(center.x, center.y);
        await page.mouse.wheel(0, -600);
        await page.waitForFunction(width => document.querySelector('[data-project=trama]').getBoundingClientRect().width > width * 1.65, initial.width);
        assert.equal(await page.locator('#project-detail').evaluate(dialog => dialog.open), false);
        await page.screenshot({ path: path.join(output, 'close-labels.png') });
        await page.locator('[data-view=home]').click();
        await page.waitForFunction(x => Math.abs(document.querySelector('[data-project=trama]').getBoundingClientRect().x - x) < 1, initial.x);
        await page.keyboard.down('Shift');
        await page.mouse.move(center.x, center.y);
        await page.mouse.down();
        await page.mouse.move(center.x + 75, center.y, { steps: 6 });
        await page.mouse.up();
        await page.keyboard.up('Shift');
        await page.waitForFunction(x => Math.abs(document.querySelector('[data-project=trama]').getBoundingClientRect().x - x) > 30, initial.x);
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
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.description-page')).opacity) === 1);
      assert.equal(await page.locator('#project-title').innerText(), 'Trama');
      assert.equal(await page.locator('#project-enter').getAttribute('href'), 'https://trama.ortogra.fi/');
      assert.equal(await page.locator('#desk-canvas').getAttribute('data-selected'), 'trama');
      assert.equal(await page.locator('#desk-canvas').getAttribute('data-presentation'), 'table');
      assert.equal(await page.locator('#project-detail').evaluate(dialog => getComputedStyle(dialog, '::backdrop').backgroundColor), 'rgba(0, 0, 0, 0)');
      const paper = await page.locator('.description-page').boundingBox();
      assert.ok(paper.x >= 0 && paper.y >= 64 && paper.x + paper.width <= width + 1 && paper.y + paper.height <= height - 50);
      assert.ok(await page.locator('#project-enter').isVisible());
      await page.screenshot({ path: path.join(output, 'open-' + width + '-' + theme + '.png') });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#project-detail').open && !document.querySelector('#shelf-controls').inert);
      assert.equal(await page.locator('#desk-canvas').getAttribute('data-presentation'), null);
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
    const context = await browser.newContext({ viewport: readingOnly ? { width: 1440, height: 960 } : { width: 1024, height: 768 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(origin + '/escriptori/');
    await page.locator('#workspace[data-ready=true]').waitFor();
    assert.equal(await page.locator('#desk-canvas').getAttribute('data-ambience'), 'still');
    // Check the camera contract independently of screen projections: looking
    // never moves the eye; translating and cursor zoom preserve its orientation.
    const navigation = await page.evaluate(async () => {
      const THREE = await import('three');
      const { DeskNavigation } = await import('/escriptori/navigation.js?v=1.2.0');
      const camera = new THREE.PerspectiveCamera(32, 1, .06, 75);
      camera.position.set(0, 3, 12);
      const navigation = new DeskNavigation(camera, document.createElement('div'), {
        change() {}, start() {}, cancel() {}, animate: update => { update(1); return Promise.resolve(); },
      });
      navigation.target.set(0, 2, 0); navigation.update(); camera.updateMatrixWorld();
      const position = camera.position.clone();
      navigation.look(.4, .1);
      const fixedEye = camera.position.equals(position);
      const rotation = camera.quaternion.clone();
      navigation.translate(80, 12);
      const translated = !camera.position.equals(position) && camera.quaternion.equals(rotation);
      await navigation.zoom(-400, null);
      const near = camera.position.z;
      for (let i = 0; i < 30; i++) await navigation.zoom(-500, null);
      const bounded = navigation.bounds.containsPoint(camera.position);
      return { fixedEye, translated, near, bounded, orientation: camera.quaternion.equals(rotation) };
    });
    assert.ok(navigation.fixedEye && navigation.translated && navigation.bounded && navigation.orientation);
    assert.ok(navigation.near < 8);
    // Repeat a full cycle to check that callbacks, focus and the selected object reset.
    for (const id of ['plec', 'pauta', 'sentit', 'relleu-obert']) {
      if (id === 'plec') {
        const initial = await page.locator('[data-project=plec]').boundingBox();
        await page.locator('[data-view=left]').click();
        await page.waitForFunction(x => Math.abs(document.querySelector('[data-project=plec]').getBoundingClientRect().x - x) > 5, initial.x);
      }
      const previous = await page.locator('[data-project=' + id + ']').boundingBox();
      await page.locator('[data-project=' + id + ']').focus();
      await page.keyboard.press('Enter');
      await page.locator('#project-detail.is-visible').waitFor();
      assert.equal(await page.locator('#desk-canvas').getAttribute('data-presentation'), 'table');
      if (id === 'relleu-obert') assert.equal(await page.locator('#project-detail').getAttribute('data-kind'), 'box');
      await page.screenshot({ path: path.join(output, 'reading-' + id + '.png') });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#project-detail').open && !document.querySelector('#shelf-controls').inert);
      const restored = await page.locator('[data-project=' + id + ']').boundingBox();
      assert.ok(Math.abs(previous.x - restored.x) < 1 && Math.abs(previous.width - restored.width) < 1);
      if (id === 'plec') await page.locator('[data-view=home]').click();
    }
    await context.close();
    if (process.argv.includes('--reading')) {
      console.log('PASS: four table-reading cycles, three object types, printed surfaces and exact return to the previous viewpoint.');
      return;
    }
    const noScript = await browser.newContext({ javaScriptEnabled: false });
    const fallback = await noScript.newPage();
    await fallback.goto(origin + '/escriptori/');
    assert.ok(await fallback.locator('#projectes').isVisible());
    assert.equal(await fallback.locator('#projectes a').count(), 8);
    await noScript.close();
    await checkTouch(browser);
    console.log('PASS: fixed-eye look, lateral movement, cursor zoom, gesture/click separation, camera bounds, reduced-motion ambience, 8 projects, keyboard, mobile, themes and fallback.');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
