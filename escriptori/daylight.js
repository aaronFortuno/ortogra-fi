import * as THREE from 'three';
import { solarLight } from './solar.js?v=1.6.0';

export function createDaylight({ scene, renderer, canvas, atmosphere, ambient, daylight, fill, bounce, animate, requestRender, dark: initialDark, onChange, onReadingPower }) {
  let dark = initialDark, manual = null, roomOverride = null;
  const roomLight = new THREE.SpotLight('#fff0d8', 0, 32, Math.PI / 2.5, .65, 2);
  roomLight.name = 'CeilingLight';
  roomLight.position.set(-1.6, 7.5, 4.1);
  roomLight.target.position.set(0, -.5, .8);
  roomLight.shadow.mapSize.set(2048, 2048);
  Object.assign(roomLight.shadow.camera, { near: .4, far: 30 });
  roomLight.shadow.camera.updateProjectionMatrix();
  roomLight.shadow.normalBias = .025;
  roomLight.shadow.bias = -.00065;
  roomLight.shadow.radius = 3;
  scene.add(roomLight, roomLight.target, daylight.target);
  const fixture = new THREE.Mesh(new THREE.CylinderGeometry(.83, .83, .12, 32), new THREE.MeshStandardMaterial({ color: '#dcded7', roughness: .85 }));
  fixture.position.set(0, 7.85, 3);
  const diffuser = new THREE.Mesh(new THREE.CircleGeometry(.75, 32), new THREE.MeshBasicMaterial({ color: '#fff0d5', toneMapped: false }));
  diffuser.position.set(0, 7.778, 3); diffuser.rotation.x = Math.PI / 2;
  scene.add(fixture, diffuser);
  daylight.target.position.set(-.5, 1.3, 1.5);
  Object.assign(daylight.shadow.camera, { left: -10.5, right: 10.5, top: 9, bottom: -8, near: .5, far: 44 });
  daylight.shadow.camera.updateProjectionMatrix();
  daylight.shadow.normalBias = .018;
  daylight.shadow.bias = -.0006;
  daylight.shadow.radius = 2.5;
  const sunColor = new THREE.Color(), sky = new THREE.Color(), ground = new THREE.Color();
  let applied;

  function apply(state) {
    const sun = new THREE.Vector3(...state.direction);
    daylight.position.copy(daylight.target.position).addScaledVector(sun, 24);
    daylight.intensity = state.sunIntensity;
    daylight.color.copy(sunColor.set('#f7fbff').lerp(new THREE.Color('#ffc281'), state.golden * .8));
    ambient.color.copy(sky.set('#b0c3e7').lerp(new THREE.Color('#e4edf9'), state.day));
    ambient.groundColor.copy(ground.set('#9e7952').lerp(new THREE.Color('#8b8974'), state.day));
    const power = state.roomPower;
    ambient.intensity = .045 + .145 * Math.max(state.day, power) + .17 * state.day + .13 * power;
    fill.color.set('#dce9fa'); fill.intensity = .025 + .255 * state.day + .095 * power;
    roomLight.intensity = 85 * power;
    // At night the ceiling must still anchor the furniture to the room. Skip
    // this second shadow pass entirely while daylight lights the interior.
    roomLight.castShadow = power > .02;
    bounce.color.set('#f4ce91'); bounce.intensity = .012 + .04 * state.day + .13 * power;
    diffuser.material.color.set('#fff0d5').multiplyScalar(.04 + .96 * power);
    scene.environmentIntensity = .035 + 1.215 * state.day + .065 * power;
    onReadingPower?.(state.readingPower);
    renderer.toneMappingExposure = dark ? .98 : 1.06;
    scene.background = new THREE.Color('#182331').lerp(new THREE.Color('#e7e1d3'), state.day);
    atmosphere.setLight(state);
    renderer.shadowMap.needsUpdate = true;
    applied = state;
    requestRender(false);
  }
  function refresh(immediate = false) {
    if (document.hidden) return;
    const date = manual || new Date(), next = solarLight(date);
    canvas.dataset.lighting = next.phase;
    canvas.dataset.lightMode = manual ? 'manual' : 'auto';
    canvas.dataset.solarAltitude = next.altitude.toFixed(2);
    canvas.dataset.solarAzimuth = next.azimuth.toFixed(2);
    next.roomPower = roomOverride === null ? next.artificial : Number(roomOverride);
    next.readingPower = roomOverride === false ? 0 : 1;
    canvas.dataset.roomLight = roomOverride === null ? 'auto' : roomOverride ? 'on' : 'off';
    canvas.dataset.roomLightOn = String(next.roomPower > .02);
    canvas.parentElement.dataset.dim = String(next.day < .45);
    onChange?.({ ...next, date, automatic: !manual, roomLightAutomatic: roomOverride === null, roomLightOn: next.roomPower > .02 });
    if (immediate || !applied) { apply(next); return; }
    const previous = applied;
    animate(t => {
      const mix = key => previous[key] + (next[key] - previous[key]) * t;
      apply({ ...next, direction: previous.direction.map((value, i) => value + (next.direction[i] - value) * t), day: mix('day'), artificial: mix('artificial'), golden: mix('golden'), sunIntensity: mix('sunIntensity'), roomPower: mix('roomPower'), readingPower: mix('readingPower') });
    });
  }
  setInterval(() => { if (!manual) refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
  window.addEventListener('pageshow', () => refresh(true));
  refresh(true);
  return {
    setTheme(value) { dark = value; refresh(); },
    setMoment(value) { manual = value; refresh(); },
    setRoomLight(value) { roomOverride = value === null ? null : Boolean(value); refresh(); },
    hasShadows: () => daylight.intensity > .01 || roomLight.castShadow,
  };
}
