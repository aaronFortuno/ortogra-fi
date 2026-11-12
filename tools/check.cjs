// Smoke tests against the local server; never requests production URLs.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const origin = 'http://127.0.0.1:4187';
  const tracker = 'https://maquestria.tail72bc84.ts.net:8443/script.js';
  async function localContext(options) {
    const context = await browser.newContext(options);
    await context.route(tracker, route => route.abort('blockedbyclient'));
    return context;
  }
  const errors = [];
  fs.mkdirSync(path.join(__dirname, '../tmp'), { recursive: true });
  try {
    for (const [width, height] of [[1440, 900], [1024, 768], [768, 600], [390, 844], [320, 568]]) {
      const context = await localContext({ viewport: { width, height }, colorScheme: 'light' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      page.on('request', request => {
        if (request.url() !== tracker) assert.equal(new URL(request.url()).origin, origin, 'Unexpected external request');
      });
      await page.goto(origin);
      assert.equal(await page.title(), 'ortogra.fi · Eines per aprendre i ensenyar');
      await page.locator('h1').waitFor();
      const layout = await page.evaluate(() => ({
        fits: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight,
        footer: document.querySelector('footer').getBoundingClientRect().bottom <= innerHeight,
        mainScrolls: getComputedStyle(document.querySelector('main')).overflowY === 'auto',
        contentFits: document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth
      }));
      assert.deepEqual(layout, { fits: true, footer: true, mainScrolls: true, contentFits: true }, `${width}px layout`);
      const groups = await page.locator('.resource-groups > section').evaluateAll(sections => sections.map(section => [
        section.querySelector('h2').textContent,
        [...section.querySelectorAll('.project-link')].map(link => link.href),
      ]));
      assert.deepEqual(groups, [
        ['Llengua', ['https://plec.ortogra.fi/', 'https://trama.ortogra.fi/']],
        ['Matemàtiques', ['https://filicompte.ortogra.fi/']],
        ['Medi', ['https://relleu.ortogra.fi/']],
        ['Utilitats', ['https://pentagrama.page/', 'https://pauta.ortogra.fi/']],
      ]);
      await page.locator('.project-preview').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      await page.locator('#about-open').click();
      await page.waitForTimeout(240);
      assert.equal(await page.locator('dialog').evaluate(el => el.open), true);
      const dialogFits = await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth);
      assert.equal(dialogFits, true, 'Dialog has no horizontal overflow');
      await page.screenshot({ path: path.join(__dirname, `../tmp/about-${width}.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(240);
      assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
      assert.equal(await page.locator('#about-open').evaluate(el => el === document.activeElement), true);
      if (width === 1440) {
        await page.locator('#about-open').click();
        await page.waitForTimeout(240);
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.getByRole('button', { name: 'Copia l’adreça Lightning' }).click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'aptswim903@walletofsatoshi.com');
        await page.mouse.click(4, 4);
        await page.waitForTimeout(240);
        assert.equal(await page.locator('dialog').evaluate(el => el.open), false, 'Backdrop closes dialog');
      }
      await page.locator('#about-open').click();
      await page.waitForTimeout(240);
      await page.getByRole('button', { name: 'Tanca la informació' }).click();
      await page.waitForTimeout(240);
      assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
      await page.screenshot({ path: path.join(__dirname, `../tmp/home-${width}.png`) });
      await page.getByRole('button', { name: 'Activa el tema fosc' }).click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.reload();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      if (width === 1440) await page.screenshot({ path: path.join(__dirname, '../tmp/home-dark.png') });
      await context.close();
      console.log(`OK ${width}×${height}: layout, V4V, controls and theme`);
    }
    const context = await localContext({ reducedMotion: 'reduce', colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(origin);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'System theme is respected');
    assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--motion').trim()), '0ms');
    await context.close();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
