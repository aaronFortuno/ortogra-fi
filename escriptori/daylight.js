import * as THREE from 'three';
import { solarLight } from './solar.js?v=1.6.0';

export function createDaylight({ scene, renderer, canvas, atmosphere, ambient, daylight, fill, bounce, animate, requestRender, dark: initialDark, onChange }) {
  let dark = initialDark, manual = null;
  const roomLight = new THREE.DirectionalLight('#ffe5b9', 0);
  roomLight.position.set(0, 7.5, 2.5);
  roomLight.target.position.set(0, -.5, 2.5);
  scene.add(roomLight, roomLight.target, daylight.target);
  const fixture = new THREE.Mesh(new THREE.CylinderGeometry(.83, .83, .12, 32), new THREE.MeshStandardMaterial({ color: '#dcded7', roughness: .85 }));
  fixture.position.set(0, 7.85, 3);
  const diffuser = new THREE.Mesh(new THREE.CircleGeometry(.75, 32), new THREE.MeshBasicMaterial({ color: '#fff0d5', toneMapped: false }));
  diffuser.position.set(0, 7.778, 3); diffuser.rotation.x = Math.PI / 2;
  scene.add(fixture, diffuser);
  daylight.target.position.set(-.5, 1.3, 1.5);
  Object.assign(daylight.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: .5, far: 55 });
  daylight.shadow.camera.updateProjectionMatrix();
  const sunColor = new THREE.Color(), sky = new THREE.Color(), ground = new THREE.Color();
  let applied;

  function apply(state) {
    const sun = new THREE.Vector3(...state.direction);
    daylight.position.copy(daylight.target.position).addScaledVector(sun, 24);
    daylight.intensity = state.sunIntensity;
    daylight.color.copy(sunColor.set('#f7fbff').lerp(new THREE.Color('#ffc281'), state.golden * .8));
    ambient.color.copy(sky.set('#b0c3e7').lerp(new THREE.Color('#e4edf9'), state.day));
    ambient.groundColor.copy(ground.set('#9e7952').lerp(new THREE.Color('#8b8974'), state.day));
    ambient.intensity = .16 + .18 * state.day + .08 * state.artificial;
    fill.color.set('#dce9fa'); fill.intensity = .07 + .17 * state.day;
    roomLight.intensity = .92 * state.artificial;
    bounce.color.set('#f4ce91'); bounce.intensity = 1.5 + 6 * state.artificial;
    diffuser.material.color.set('#fff0d5').multiplyScalar(.22 + .78 * state.artificial);
    scene.environmentIntensity = .10 + 1.15 * state.day;
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
    canvas.parentElement.dataset.dim = String(next.day < .45);
    onChange?.({ ...next, date, automatic: !manual });
    if (immediate || !applied) { apply(next); return; }
    const previous = applied;
    animate(t => {
      const mix = key => previous[key] + (next[key] - previous[key]) * t;
      apply({ ...next, direction: previous.direction.map((value, i) => value + (next.direction[i] - value) * t), day: mix('day'), artificial: mix('artificial'), golden: mix('golden'), sunIntensity: mix('sunIntensity') });
    });
  }
  setInterval(() => { if (!manual) refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
  window.addEventListener('pageshow', () => refresh(true));
  refresh(true);
  return {
    setTheme(value) { dark = value; refresh(); },
    setMoment(value) { manual = value; refresh(); },
  };
}
