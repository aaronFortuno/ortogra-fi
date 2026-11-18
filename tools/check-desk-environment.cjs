const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const root = path.resolve(__dirname, '..');
  const { solarLight, referenceDate, referenceTime } = await import(pathToFileURL(path.join(root, 'escriptori/solar.js')));
  const summer = solarLight(referenceDate('2026-06-21', '18:00'));
  const winter = solarLight(referenceDate('2026-12-21', '18:00'));
  assert.ok(summer.altitude > 20 && winter.altitude < 0, 'The same clock time must reflect the season');
  const morning = solarLight(referenceDate('2026-11-18', '10:00'));
  const afternoon = solarLight(referenceDate('2026-11-18', '15:00'));
  assert.equal(morning.phase, 'day');
  assert.ok(morning.direction[2] < afternoon.direction[2], 'The sun must travel across the window');
  const night = solarLight(referenceDate('2026-11-18', '23:00'));
  assert.equal(night.phase, 'night');
  assert.equal(night.sunIntensity, 0);
  assert.equal(night.artificial, 1);
  assert.ok(night.day < morning.day);
  assert.ok(solarLight(referenceDate('2026-06-21', '14:00')).altitude > solarLight(referenceDate('2026-12-21', '13:00')).altitude + 35);
  for (const state of [summer, winter, morning, afternoon, night]) {
    assert.ok(Math.abs(Math.hypot(...state.direction) - 1) < 1e-10);
    assert.ok(state.sunIntensity >= 0 && state.day >= 0 && state.day <= 1 && state.artificial >= 0 && state.artificial <= 1);
    if (state.sunIntensity > 0) assert.ok(state.direction[0] < 0);
  }
  assert.equal(referenceDate('2026-06-21', '18:00').toISOString(), '2026-06-21T16:00:00.000Z');
  assert.equal(referenceDate('2026-12-21', '18:00').toISOString(), '2026-12-21T17:00:00.000Z');
  assert.equal(referenceDate('2026-03-29', '02:30'), null);
  assert.equal(referenceDate('2026-02-29', '10:00'), null);
  assert.equal(referenceTime(referenceDate('2026-10-25', '02:30')).time, '02:30');
  assert.equal(referenceTime(referenceDate('2028-02-29', '10:00')).date, '2028-02-29');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/desk/loading.json')));
  for (const [file, size] of Object.entries(manifest.assets)) assert.equal(fs.statSync(path.join(root, file)).size, size, file + ': regenerate the loading budget');
  const { createResourceLoader } = await import(pathToFileURL(path.join(root, 'escriptori/loading.js')));
  const originalFetch = global.fetch, reports = [];
  try {
    global.fetch = async url => new Response(new ReadableStream({start(controller) {
      const count = new URL(url).pathname.endsWith('first.bin') ? 4 : 6;
      controller.enqueue(new Uint8Array(2)); controller.enqueue(new Uint8Array(count - 2)); controller.close();
    }}));
    const loader = createResourceLoader({assets:{'first.bin':4,'second.bin':6}},'https://example.test/',value=>reports.push(value));
    assert.equal((await loader.buffer('https://example.test/first.bin')).byteLength, 4);
    assert.equal(reports.at(-1), 42);
    await loader.load('https://example.test/second.bin', async url => assert.ok(url.startsWith('blob:')));
    assert.equal(reports.at(-1), 90, 'Downloads alone must never claim the scene is ready');
    assert.ok(reports.every((value,index)=>value<100&&(!index||value>=reports[index-1])));
    global.fetch = async () => ({ok:true,body:null,arrayBuffer:async()=>new Uint8Array(4).buffer});
    assert.equal((await loader.buffer('https://example.test/first.bin')).byteLength, 4);
    global.fetch = async () => new Response('',{status:403});
    await assert.rejects(loader.buffer('https://example.test/first.bin'));
  } finally { global.fetch = originalFetch; }
  console.log('PASS: seasonal sun, moving direction, night lighting, reference time zone/DST, asset byte budget and genuine streamed download progress.');
})().catch(error => {console.error(error);process.exitCode=1;});
