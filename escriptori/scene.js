import * as THREE from 'three';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import { DeskNavigation } from './navigation.js?v=1.16.0';
import { prepareBinderLoad, arrangeBinderRow } from './binder-load.js?v=1.15.1';
import { deskLayout } from './desk-layout.js?v=1.10.0';
import { createStationery } from './stationery.js?v=1.22.0';
import { createAtmosphere } from './atmosphere.js?v=1.22.0';
import { prepareMaterials } from './materials.js?v=1.22.0';
import { createReadingPages } from './reading.js?v=1.11.0';
import { createDaylight } from './daylight.js?v=1.13.0';
import { createPaperView } from './paper-view.js?v=1.11.0';
import { createContactShadows } from './contact-shadows.js?v=1.22.0';
import { createIdleCamera } from './idle-camera.js?v=1.22.0';
import { createPerformanceMonitor } from './performance.js?v=1.22.1';
import { createAirLight } from './air-light.js?v=1.23.0';
import { createShelfOcclusion } from './shelf-occlusion.js?v=1.11.0';
import { createLabelTexture } from './labels.js?v=1.11.0';
import { createReliefs } from './reliefs.js?v=1.11.0';
import { createObjectJourney } from './journey.js?v=1.16.0';
import { createCloudShadows } from './weather.js?v=1.13.0';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 700px)');
const journeyDuration = 2500;
const areas = {
  Llengua: { center: [-4.48, .25, -.2], width: 3.8, label: [-3.92, 2.19, .0] },
  Matemàtiques: { center: [-2.55, .25, -.2], width: 2.1, label: [-2.55, 2.19, .0] },
  Medi: { center: [-.6, .0, -.2], width: 2.6, label: [-.6, 1.3, .0] },
  Utilitats: { center: [2.5, -.5, .7], width: 3.1, label: [2.5, .25, 1.25] },
};
const overview = { center: [-1.5, .12, .5], width: 9.3 };

export async function createDesk({ canvas, projects, dark: initialDark, resources, onStage = () => {}, onLightingChange, onWindowChange, onObjectSound = () => {}, onAction=()=>{} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  const performanceMonitor=createPerformanceMonitor(renderer);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .06, 75);
  const navigation = new DeskNavigation(camera, canvas.parentElement, {
    change: requestRender,
    start(type) {
      canvas.parentElement.classList.add('is-exploring');
      if (type === 'pointerdown') canvas.parentElement.classList.add('is-navigating');
      canvas.parentElement.querySelector('#hover-caption').classList.remove('visible');
      highlight(null);
    },
    animate: update => animate('view', update),
    cancel: () => cancelMotion('view'),
    end:gest=>onAction('mou_camara',{gest}),
  });
  const ambient = new THREE.HemisphereLight('#e6edf1', '#9b947c', .42);
  scene.add(ambient);
  const daylight = new THREE.DirectionalLight('#fff8eb', 2.5);
  daylight.position.set(-9, 7.5, 4);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  Object.assign(daylight.shadow.camera, { left: -9, right: 9, top: 8, bottom: -5, near: .5, far: 30 });
  // Avoid self-shadow stripes when the camera reads the pages up close.
  daylight.shadow.normalBias = .025;
  daylight.shadow.bias = -.001;
  daylight.shadow.radius = 5;
  scene.add(daylight);
  // Sky fill and reflected room light are diffuse, so the shelf's visibility
  // field can occlude them. Unshadowed direct lights lit blocked recesses.
  const fill = new THREE.HemisphereLight('#e0ebf2', '#858575', .45);
  fill.position.set(5, 5, 4);
  scene.add(fill);
  const bounce = new THREE.HemisphereLight('#ded0ad', '#a47c52', .1);
  bounce.position.set(-5, 2, 3.5);
  scene.add(bounce);
  // A soft desk cone protects reading without lighting every recess behind it.
  const readingLight = new THREE.SpotLight('#e8f2ff', 0, 15, Math.PI / 7.5, .65, 2);
  readingLight.position.set(-1.5, 6.5, 5);
  readingLight.target.position.set(-1.5, -.4, 2.5);
  scene.add(readingLight, readingLight.target);
  let darkTheme = initialDark, readingPower = 1, readingBlend = 0;
  const readingIntensity = () => (darkTheme ? 2.4 : 1.8) * 55 * readingPower;

  const modelURL = new URL('../assets/desk/escriptori.glb?v=1.15.0', import.meta.url);
  const modelBytes = await resources.buffer(modelURL.href);
  onStage(null, 'Preparant els arxivadors…');
  const asset = await new GLTFLoader().parseAsync(modelBytes, new URL('.', modelURL).href);
  const room = asset.scene;
  scene.add(room);
  const materials = await prepareMaterials(room, scene, renderer, resources);
  const shelfOcclusion = createShelfOcclusion(room, materials);
  const reading = createReadingPages(document.querySelector('#project-detail'), [...materials].find(material => material.name === 'Paper'));

  const models = new Map();
  const motions = new Map();
  const curlAmounts = new Map();
  let frame = 0;
  let active = null;
  let hovered = null;
  let currentArea = matchMedia('(max-width: 1050px)').matches ? 'Llengua' : 'Taula';
  let lastWidth = 0;
  let lastHeight = 0;
  let presenting = false;
  let phase = 'shelf';
  let returnView;
  let ambientTimer;
  let contextLost = false;
  let controlsDirty = true;
  let ambientShadowTime = -Infinity;
  let firstFrame;
  let sceneryTime = 0, sceneryFrame = null;
  const idleCamera=createIdleCamera(camera,navigation,{reduced:reducedMotion,redraw:()=>requestRender(false)});
  const paperView = createPaperView({ camera, target: navigation.target, reading,
    animate, requestRender, getSize: () => ({ width: lastWidth, height: lastHeight }) });
  const reliefs = createReliefs({ scene, camera, target: navigation.target, animate, requestRender, onMaterial: material => weather.prepare(material) });
  const outline = createHoverOutline(canvas.parentElement);
  const atmosphere = await createAtmosphere(scene, room, resources);
  const windowButton = document.querySelector('#window-latch');
  const sash = atmosphere.sash;
  let windowOpen = false, windowTravel = 0;
  function toggleWindow() {
    if (active || presenting) return;
    windowOpen = !windowOpen;
    windowButton.setAttribute('aria-pressed', String(windowOpen));
    windowButton.title = windowOpen ? 'Tanca la finestra' : 'Obre la finestra';
    windowButton.setAttribute('aria-label', windowButton.title);
    onWindowChange?.(windowOpen);
    onAction('finestra',{oberta:windowOpen});
    const from = windowTravel, to = Number(windowOpen);
    animate('window', t => {
      windowTravel = THREE.MathUtils.lerp(from, to, t);
      atmosphere.setOpening(windowTravel);
      renderer.shadowMap.needsUpdate = true;
    }, 540);
  }
  windowButton.addEventListener('click', toggleWindow);
  const windowRay = new THREE.Raycaster();
  canvas.addEventListener('click', event => {
    if (active || presenting) return;
    const rect = canvas.getBoundingClientRect();
    windowRay.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,
      1-(event.clientY-rect.top)/rect.height*2), camera);
    if (!windowRay.intersectObject(sash.window).length) return;
    const first = windowRay.intersectObjects(scene.children)[0];
    for (let node = first?.object; node; node = node.parent) {
      if (node === sash.window) { toggleWindow(); break; }
    }
  });
  const wallSwitch = document.querySelector('#wall-light-switch');
  const switchNode = room.getObjectByName('RoomLightSwitch'), rocker = room.getObjectByName('SwitchRocker');
  wallSwitch.addEventListener('click', () => {const on=canvas.dataset.roomLightOn!=='true';lighting.setRoomLight(on);onAction('llum_sala',{encesa:on});});
  for (const material of materials) if (material.name.startsWith('Leaves') || material.name.startsWith('LeafLight')) {
    material.map = atmosphere.leafTexture;
    material.color.set('#b5ba8f');
    material.roughness = .68;
    material.side = THREE.DoubleSide;
  }

  function addPlane(parent, size, position, texture, horizontal = false) {
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const material = new THREE.MeshStandardMaterial({
      map: texture, side: THREE.DoubleSide, roughness: .88, color: '#fffdf6',
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, alphaTest: .45,
    });
    const geometry = new THREE.PlaneGeometry(...size, 8, 24);
    const vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const u = vertices.getX(i) / size[0] + .5, v = vertices.getY(i) / size[1] + .5;
      const corner = Math.max(0, (u - .62) + (v - .84));
      vertices.setZ(i, corner * corner * .15 + Math.sin(v * 39) * .0007);
    }
    geometry.computeVertexNormals();
    const plane = new THREE.Mesh(geometry, material); plane.castShadow = plane.receiveShadow = true;
    plane.position.set(...position);
    if (horizontal) plane.rotation.x = -Math.PI / 2;
    parent.add(plane);
    return plane;
  }
  let binderIndex = 0;
  for (const project of projects) {
    const group = room.getObjectByName('Item_' + project.id);
    const lid = room.getObjectByName('Lid_' + project.id);
    if (!group || !lid) throw new Error('Falta el model de ' + project.name);
    const label = await createLabelTexture(project);
    let bounds, axis, angle, setLoad;
    if (project.kind === 'binder') {
      addPlane(group, [.293, 1.41], [0, .12, .824], label);
      setLoad = prepareBinderLoad(group, binderIndex++);
      bounds = [[-.30, -1.06, .82], [.34, 1.06, 1.18]];
      axis = 'y'; angle = -Math.PI - .28;
    } else if (project.kind === 'box') {
      addPlane(group, [1.4, .26], [0, -.01, .731], label);
      bounds = [[-.96, -.34, .72], [.96, .4, .92]];
      axis = 'x'; angle = -Math.PI * .57;
    } else {
      // Rest on the desk, and leave a real gap between the closed portfolios.
      group.updateWorldMatrix(true,true);
      group.position.y+=deskLayout.table.surfaceY+.001-new THREE.Box3().setFromObject(group).min.y;
      group.updateWorldMatrix(true,true);
      if(project.id==='pauta'){
        const previous=models.get('pentagrama');
        if(previous){
          const a=new THREE.Box3().setFromObject(previous.group),b=new THREE.Box3().setFromObject(group);
          if(a.intersectsBox(b))group.position.z+=a.max.z-b.min.z+.18;
        }
      }
      addPlane(lid, [1.37, .285], [.925, .051, -.81], label, true);
      bounds = [[-.93, -.03, -1.17], [.93, .08, 1.18]];
      axis = 'z'; angle = Math.PI;
    }
    models.set(project.id, {
      group, lid, project, bounds, axis, angle, setLoad,
      hitPoints: project.kind === 'binder' ? meshPoints(group, group.getObjectByName('Spine_' + project.id)) : null,
      home: group.position.clone(), rotation: group.quaternion.clone(), outlineBounds: localBounds(group),
    });
  }
  const binders = [...models.values()].filter(model => model.project.kind === 'binder');
  arrangeBinderRow(binders.map(model => model.group), {
    left: deskLayout.organizer.openings[0][0], surface: deskLayout.table.surfaceY,
  });
  for (const model of binders) {
    model.home.copy(model.group.position); model.rotation.copy(model.group.quaternion);
  }
  // Keep area shortcuts above the actual, more closely packed materials.
  for (const name of ['Llengua', 'Matemàtiques']) {
    const row = binders.filter(model => model.project.area === name);
    const center = row.reduce((sum, model) => sum + model.home.x, 0) / row.length;
    areas[name].center[0] = center; areas[name].label[0] = center;
  }
  await Promise.all([...models.values()].map(async model => {
    if (!model.project.preview) return;
    model.previewTexture = await resources.load(model.project.preview, objectURL => new THREE.TextureLoader().loadAsync(objectURL));
    model.previewTexture.colorSpace = THREE.SRGBColorSpace;
  }));
  const stationery = createStationery({ room, canvas, camera, navigation, reduced: reducedMotion,
    enabled: () => !active && !presenting && !contextLost, sound: onObjectSound,
    brush: (leaf, impulse) => { if (!reducedMotion.matches) { atmosphere.brush(leaf, impulse); requestRender(false); } },
    animate,
    action:onAction,
    obstacles:()=>[...models.values()].map(model=>new THREE.Box3().setFromObject(model.group)),
    cancelView: () => cancelMotion('view'),
    redraw: () => { renderer.shadowMap.needsUpdate = true; requestRender(false); } });
  const contactShadows = createContactShadows(room,stationery.contactBodies);
  const lighting = createDaylight({ scene, renderer, canvas, atmosphere, ambient, daylight, fill, bounce,
    animate: update => animate('daylight', update), requestRender, dark: initialDark,
    onChange: state => {
      onLightingChange?.(state);
      wallSwitch.setAttribute('aria-pressed', String(state.roomLightOn));
      wallSwitch.setAttribute('aria-label', (state.roomLightOn ? 'Apaga' : 'Encén') + ' el llum de la sala');
      wallSwitch.title = wallSwitch.getAttribute('aria-label');
      if (rocker) {
        const from = rocker.rotation.x, to = state.roomLightOn ? -.045 : .045;
        animate('switch', t => { rocker.rotation.x = THREE.MathUtils.lerp(from, to, t); });
      }
    },
    onReadingPower: value => { readingPower = value; readingLight.intensity = readingIntensity() * readingBlend; } });
  const weather = createCloudShadows(scene, daylight, lighting.prepareWindowShader);
  atmosphere.setWeather(weather.uniforms);
  const air=createAirLight({scene,sun:daylight,roomLight:scene.getObjectByName('CeilingLight'),opening:room.getObjectByName('WindowOpening'),weather:weather.uniforms});

  function requestRender(geometryChanged = true) {
    if (geometryChanged) controlsDirty = true;
    if (!frame) frame = requestAnimationFrame(render);
  }
  function render(time) {
    performanceMonitor.begin();
    frame = 0;
    idleCamera.restore();
    for (const [key, motion] of motions) {
      if (motion.start === null) motion.start = time;
      const ratio = THREE.MathUtils.clamp((time - motion.start) / motion.duration, 0, 1);
      motion.update(ratio * ratio * (3 - 2 * ratio));
      if (ratio === 1) { motions.delete(key); motion.resolve(); }
    }
    const objectsMoving = stationery.update(time);
    if (objectsMoving) renderer.shadowMap.needsUpdate = true;
    scene.updateMatrixWorld();
    shelfOcclusion.update();
    contactShadows.update();
    const cameraEligible=!narrow.matches&&!active&&!presenting&&!contextLost&&!document.hidden&&!hovered&&navigation.enabled&&
      !navigation.pointers.size&&!motions.size&&!document.querySelector('dialog[open],#projectes.is-open,[popover]:popover-open');
    const cameraMoving=idleCamera.update(time,cameraEligible);
    canvas.dataset.cameraMotion=cameraMoving?'drifting':'still';
    if(cameraMoving)controlsDirty=true;
    camera.updateMatrixWorld();
    const airState=air.sync({camera,height:lastHeight,pixelRatio:renderer.getPixelRatio(),mobile:narrow.matches,
      focused:Boolean(active)||presenting||contextLost,time,reduced:reducedMotion.matches});
    if (controlsDirty) { updateControls(); controlsDirty = false; }
    if (active) {
      const rect = canvas.getBoundingClientRect(); reading.project(camera, rect);
      if (active.project.reliefs?.length) reliefs.project(rect);
    }
    outline.update(active ? null : models.get(hovered), camera, lastWidth, lastHeight);
    if ([...motions.keys()].some(key => key !== 'view')) renderer.shadowMap.needsUpdate = true;
    const foliageVisible = atmosphere.visible(camera);
    const living = !reducedMotion.matches && !document.hidden && !presenting && !active && !contextLost && (foliageVisible || weather.active() || cameraEligible || airState.visible);
    if (living && (sceneryFrame === null || time - sceneryFrame >= 1000 / 24)) {
      sceneryTime += sceneryFrame === null ? 0 : Math.min(.1, (time - sceneryFrame) / 1000);
      sceneryFrame = time;
      atmosphere.update(sceneryTime * 1000, daylight.intensity > .02); weather.update(sceneryTime);
      air.update(sceneryTime);
      if ((foliageVisible || daylight.intensity > .02) && lighting.hasShadows() && time - ambientShadowTime >= 125) {
        renderer.shadowMap.needsUpdate = true;
        ambientShadowTime = time;
      }
    }
    if (!living) sceneryFrame = null;
    renderer.render(scene, camera);
    performanceMonitor.end();
    if (firstFrame) { const resolve = firstFrame; firstFrame = null; requestAnimationFrame(resolve); }
    clearTimeout(ambientTimer);
    canvas.dataset.ambience = living ? 'moving' : 'still';
    if (living) ambientTimer = setTimeout(() => requestRender(false), 1000 / 24);
    if (motions.size) requestRender();
    else if (objectsMoving || airState.moving) requestRender(false);
  }
  function cancelMotion(key) {
    if (!motions.has(key)) return;
    motions.get(key).resolve();
    motions.delete(key);
  }
  function animate(key, update, duration = 220) {
    idleCamera.interrupt();
    cancelMotion(key);
    if (reducedMotion.matches) { update(1); requestRender(); return Promise.resolve(); }
    return new Promise(resolve => {
      motions.set(key, { start: null, update, resolve, duration });
      requestRender();
    });
  }
  function projectPoint(point) {
    const projected = point.clone().project(camera);
    return { x: (projected.x + 1) * lastWidth / 2, y: (1 - projected.y) * lastHeight / 2, depth: projected.z };
  }
  function updateControls() {
    const latch = projectPoint(sash.handle.getWorldPosition(new THREE.Vector3()));
    windowButton.hidden = Boolean(active) || Math.abs(latch.depth) >= 1 ||
      latch.x < 0 || latch.x > lastWidth || latch.y < 0 || latch.y > lastHeight;
    if (!windowButton.hidden) {
      windowButton.style.left = latch.x + 'px';
      windowButton.style.top = latch.y + 'px';
    }
    wallSwitch.hidden = Boolean(active) || !switchNode;
    if (!wallSwitch.hidden) {
      const corners = [[-.16, -.22], [.16, .22]].map(([x, y]) => switchNode.localToWorld(new THREE.Vector3(x, y, .09)));
      const points = corners.map(projectPoint);
      const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y));
      const width = Math.abs(points[1].x - points[0].x), height = Math.abs(points[1].y - points[0].y);
      wallSwitch.hidden = corners.some(p => p.applyMatrix4(camera.matrixWorldInverse).z > -camera.near) || points.some(p => Math.abs(p.depth) > 1) || left + width < 0 || left > lastWidth || top + height < 0 || top > lastHeight;
      Object.assign(wallSwitch.style, { left: left + 'px', top: top + 'px', width: Math.max(28, width) + 'px', height: Math.max(32, height) + 'px' });
    }
    if (active) {
      for (const project of projects) { project.button.hidden = true; project.areaLabel.hidden = true; }
      return;
    }
    for (const model of models.values()) {
      const { project, bounds, home, rotation, hitPoints } = model;
      if (narrow.matches && currentArea !== 'Taula' && project.area !== currentArea) {
        project.button.hidden = true;
        continue;
      }
      const points = [];
      if (hitPoints) {
        for (const point of hitPoints) {
          const world = point.clone().applyQuaternion(rotation).add(home);
          if (world.clone().applyMatrix4(camera.matrixWorldInverse).z <= -camera.near) points.push(projectPoint(world));
        }
      } else for (const x of [bounds[0][0], bounds[1][0]]) {
        for (const y of [bounds[0][1], bounds[1][1]]) {
          for (const z of [bounds[0][2], bounds[1][2]]) {
            const local = new THREE.Vector3(x, y, z).applyQuaternion(rotation).add(home);
            // A rear corner crossing the eye plane projects to the opposite
            // side of the screen and used to create giant invisible hit areas.
            if (local.clone().applyMatrix4(camera.matrixWorldInverse).z > -camera.near) continue;
            points.push(projectPoint(local));
          }
        }
      }
      if (!points.length) { project.button.hidden = true; continue; }
      const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y));
      const right = Math.max(...points.map(p => p.x)), bottom = Math.max(...points.map(p => p.y));
      project.button.hidden = (hitPoints && points.length < 3) || right-left < .01 || bottom-top < .01 ||
        points.every(point => point.depth > 1 || point.depth < -1) || right < 0 || left > lastWidth || bottom < 0 || top > lastHeight;
      project.button.tabIndex = project.button.hidden ? -1 : 0;
      if (project.button.hidden) continue;
      const center = new THREE.Vector3(...bounds[0]).add(new THREE.Vector3(...bounds[1])).multiplyScalar(.5).applyQuaternion(rotation).add(home);
      const eyeDepth = -center.applyMatrix4(camera.matrixWorldInverse).z;
      Object.assign(project.button.style, {
        left: left + 'px', top: top + 'px', width: (right - left) + 'px', height: (bottom - top) + 'px',
        zIndex: String(Math.round(10000 / Math.max(.1, eyeDepth))),
        clipPath: hitPoints ? 'polygon(' + convexHull(points).map(p =>
          `${(p.x-left)/(right-left)*100}% ${(p.y-top)/(bottom-top)*100}%`).join(',') + ')' : '',
      });
    }
    for (const [area, settings] of Object.entries(areas)) {
      const label = projects.find(project => project.area === area).areaLabel;
      const point = projectPoint(new THREE.Vector3(...settings.label));
      label.hidden = narrow.matches || point.depth > 1 || point.depth < -1 || point.x < 0 || point.x > lastWidth;
      label.style.left = point.x + 'px';
      label.style.top = point.y + 'px';
    }
  }
  function initialView() {
    const aspect = lastWidth / lastHeight;
    if(currentArea==='Utilitats'){
      const direction=new THREE.Vector3(),right=new THREE.Vector3(1,0,0),up=new THREE.Vector3(),points=[];
      for(const model of models.values())if(model.project.kind==='folder'){
        const b=model.outlineBounds;
        for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])
          points.push(new THREE.Vector3(x,y,z).applyQuaternion(model.rotation).add(model.home));
      }
      const focus=new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
      const tangent=Math.tan(THREE.MathUtils.degToRad(16));
      const top=Math.min(70,lastHeight*.18),bottom=Math.min(lastWidth<=1050?128:90,lastHeight*.29);
      const upper=1-2*top/lastHeight,lower=-1+2*bottom/lastHeight;
      const shift=(bottom-top)/lastHeight,usable=(lastHeight-top-bottom)/lastHeight;
      let pitch=.68,target,position;
      for(let attempt=0;attempt<12;attempt++){
        direction.set(0,pitch,Math.sqrt(1-pitch*pitch));up.crossVectors(direction,right);
        let distance=5.5;
        for(const point of points){
          const relative=point.clone().sub(focus),depth=relative.dot(direction),y=relative.dot(up);
          distance=Math.max(distance,depth+Math.abs(relative.x)/(tangent*aspect*.90),
            (y/tangent+upper*depth)/usable,(-y/tangent-lower*depth)/usable);
        }
        target=focus.clone().addScaledVector(up,-shift*distance*tangent);
        position=target.clone().addScaledVector(direction,distance);
        if(position.y<=7.2)break;
        pitch*=.82; // A tall viewport must not lift the eye through the ceiling.
      }
      return {target,position};
    }
    const settings = currentArea === 'Taula' ? overview : areas[currentArea];
    const target = new THREE.Vector3(...settings.center);
    const width = settings.width;
    const distance = Math.max(narrow.matches ? 7 : 5.5, width / (2 * Math.tan(THREE.MathUtils.degToRad(16)) * aspect));
    const direction = new THREE.Vector3(0, .21, .978).normalize();
    return { target, position: target.clone().addScaledVector(direction, distance) };
  }
  function resize() {
    idleCamera.interrupt();
    lastWidth = canvas.clientWidth; lastHeight = canvas.clientHeight;
    if (!lastWidth || !lastHeight) return;
    renderer.setSize(lastWidth, lastHeight, false);
    camera.aspect = lastWidth / lastHeight;
    camera.updateProjectionMatrix();
    if (phase === 'inspecting') {
      if (reliefs.info().open) { cancelMotion('relief-view'); reliefs.resize(); }
      else { cancelMotion('inspection'); paperView.resize(); }
    }
    else if (!active || phase === 'reading') {
      const view = active ? readingView() : initialView();
      camera.position.copy(view.position);
      navigation.target.copy(view.target);
      navigation.update();
    }
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    updateControls();
    requestRender();
  }
  canvas.parentElement.addEventListener('pointermove', () => {
    if (!navigation.pointers.size) canvas.parentElement.classList.remove('is-navigating');
  });
  canvas.parentElement.addEventListener('pointerup', () => canvas.parentElement.classList.remove('is-navigating'));
  canvas.parentElement.addEventListener('pointercancel', () => canvas.parentElement.classList.remove('is-navigating'));

  function highlight(id) {
    if (active || hovered === id) return;
    hovered = id;
    for (const [key, model] of models) {
      const start = model.group.position.clone();
      const destination = model.home.clone();
      if (key === id) {
        if (model.project.kind === 'folder') destination.y += .11;
        else destination.z += .3;
      }
      animate('hover-' + key, t => model.group.position.lerpVectors(start, destination, t));
    }
  }
  async function select(id) {
    idleCamera.interrupt();
    const selected = models.get(id);
    if (selected.project.reliefs?.length) {
      await reliefs.prepare(selected.project);
      const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); blank.needsUpdate = true;
      selected.sampleTextures = selected.project.samples.map(sample => ({ ...sample, texture: blank }));
    } else if (selected.project.samples?.length && !selected.sampleTextures) {
      selected.sampleTextures = await Promise.all(selected.project.samples.map(async sample => {
        const texture = await new THREE.TextureLoader().loadAsync(sample.image);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return { ...sample, texture };
      }));
    }
    stationery.cancel();
    highlight(null);
    active = models.get(id);
    navigation.enabled = false;
    phase = 'preparing';
    returnView = { position: camera.position.clone(), target: navigation.target.clone(), rotation: camera.quaternion.clone(), aspect: camera.aspect };
    const model = active;
    cancelMotion('hover-' + id);
    reading.mount(model);
    if (model.project.reliefs?.length) reliefs.mount(model, reading.info().pages);
    // Upload and compile newly loaded samples before the animation clock starts.
    for (const sample of model.sampleTextures) renderer.initTexture(sample.texture);
    await renderer.compileAsync(scene, camera);
    // Warm the actual shadow/material passes as well as the shader programs.
    // A GPU fence keeps queued uploads out of the first moving frame, without
    // blocking the main thread with gl.finish().
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    const gl = renderer.getContext(), fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (fence) {
      gl.flush();
      await new Promise(resolve => {
        const ready = () => {
          const result = gl.clientWaitSync(fence, 0, 0);
          if (result === gl.TIMEOUT_EXPIRED) { requestAnimationFrame(ready); return; }
          gl.deleteSync(fence); resolve();
        };
        requestAnimationFrame(ready);
      });
    }
    phase = 'clearing';
    const from = model.group.position.clone();
    const journey = prepareJourney(model, from, returnView);
    const space=openingSpace(journey,model);
    if(!await stationery.clearSpace(space)){
      reading.unmount();if(model.project.reliefs?.length)reliefs.unmount();
      for(const texture of new Set((model.sampleTextures||[]).map(sample=>sample.texture)))texture.dispose();
      model.sampleTextures=null;active=null;phase='shelf';navigation.enabled=true;requestRender();
      throw Object.assign(new Error('No hi ha prou espai lliure a la taula.'),{code:'TABLE_FULL'});
    }
    phase='opening';canvas.parentElement.classList.add('is-reading');
    await animate('journey', journey, journeyDuration);
    shelfOcclusion.update(true);
    contactShadows.onTable(model.group);
    phase = 'reading';
    canvas.dataset.selected = id;
    canvas.dataset.presentation = 'table';
    requestRender();
  }
  function openingSpace(journey,model){
    const position=camera.position.clone(),rotation=camera.quaternion.clone(),target=navigation.target.clone();
    const from=model.group.position.clone(),pose=model.group.quaternion.clone(),lid=model.lid.rotation[model.axis];
    const regions=[],paths=[journey];
    // Hover can pull a book forwards before it is picked up. Reserve the
    // return to its true shelf position as well as that slightly shorter exit.
    if(from.distanceTo(model.home)>.001)paths.push(prepareJourney(model,model.home,{position,rotation,target,aspect:camera.aspect}));
    for(const path of paths){
      let previous;
      for(let i=0;i<=64;i++){
        path(i/64);
        const box=new THREE.Box3().setFromObject(model.group);
        if(previous)regions.push(previous.clone().union(box).expandByScalar(.055));
        previous=box;
      }
    }
    journey(0);
    model.group.position.copy(from);model.group.quaternion.copy(pose);model.lid.rotation[model.axis]=lid;
    camera.position.copy(position);camera.quaternion.copy(rotation);navigation.target.copy(target);
    model.group.updateWorldMatrix(true,true);camera.updateMatrixWorld();
    // Keep the landing strip clear for all three terrain samples too.
    if(model.project.reliefs?.length)regions.push(new THREE.Box3(new THREE.Vector3(-2,-.60,3.65),new THREE.Vector3(-1,.6,4.7)));
    return regions;
  }
  function prepareJourney(model, from, startView) {
    const saved = { position: model.group.position.clone(), rotation: model.group.quaternion.clone(), lid: model.lid.rotation[model.axis] };
    const card = model.group.getObjectByName('ProjectCard');
    const savedCard = card && { x: card.position.x, visible: card.visible };
    const flatRotation = model.project.kind === 'binder'
      ? new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)))
      : new THREE.Quaternion();
    const destination = new THREE.Vector3(-1.5, model.project.kind === 'folder' ? -.53 : model.project.kind === 'box' ? -.205 : -.34, 2.5);
    // Measure the final reading pose, then restore the actual pose before moving.
    model.group.position.copy(destination); model.group.quaternion.copy(flatRotation);
    model.lid.rotation[model.axis] = model.angle;
    if (card) { card.visible = true; card.position.x = 2.05; }
    model.group.updateWorldMatrix(true, true);
    // The spread, rather than the cover's hinge, is centred on the workspace.
    const spread = reading.points(false);
    if (model.project.reliefs?.length) spread.push(...reliefs.points(false));
    const spreadX = new THREE.Box3().setFromPoints(spread).getCenter(new THREE.Vector3()).x;
    destination.x += -1.5 - spreadX;
    model.group.position.copy(destination); model.group.updateWorldMatrix(true, true);
    const view = readingView();
    const materialPoints = () => model.project.reliefs?.length ? reliefs.points(narrow.matches) : reading.points(narrow.matches);
    const endFocus = new THREE.Box3().setFromPoints(materialPoints()).getCenter(new THREE.Vector3());
    model.group.position.copy(saved.position); model.group.quaternion.copy(saved.rotation); model.lid.rotation[model.axis] = saved.lid;
    if (card) { card.visible = savedCard.visible; card.position.x = savedCard.x; }
    model.group.updateWorldMatrix(true, true);
    return createObjectJourney({
      model, from, to: destination, flatRotation, startView, endView: view, endFocus,
      camera, target: navigation.target, focusPoints: materialPoints,
      onLid: opening => { model.setLoad?.(1-opening); readingBlend = opening; readingLight.intensity = readingIntensity() * opening; },
    });
  }
  async function home() {
    if (!active) return;
    if (paperView.info().open || reliefs.info().open) await leaveInspection();
    phase = 'closing';
    contactShadows.onTable(null);
    const model = active;
    const view = Math.abs(returnView.aspect - camera.aspect) < .01 ? returnView : initialView();
    const journey = prepareJourney(model, model.home, view);
    await animate('journey', t => journey(1 - t), journeyDuration);
    shelfOcclusion.update(true);
    reading.unmount();
    if (model.project.reliefs?.length) reliefs.unmount();
    for (const texture of new Set((model.sampleTextures || []).map(sample => sample.texture))) texture.dispose();
    model.sampleTextures = null;
    active = null; hovered = null;
    phase = 'shelf';
    navigation.enabled = true;
    navigation.update();
    delete canvas.dataset.selected;
    delete canvas.dataset.presentation;
    canvas.parentElement.classList.remove('is-reading');
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); updateControls(); requestRender();
  }
  function readingView() {
    const points = reading.points(narrow.matches);
    if (active.project.reliefs?.length) points.push(...reliefs.points(narrow.matches));
    if (active.project.kind === 'box' && !narrow.matches) {
      const bounds = new THREE.Box3().setFromObject(active.group);
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        points.push(new THREE.Vector3(x, y, z));
      }
    }
    const target = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    const direction = (active.project.reliefs?.length ? new THREE.Vector3(0, .82, .57) : new THREE.Vector3(0, .975, .22)).normalize();
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(direction, right);
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const panel = document.querySelector('.description-page');
    const reserved = panel.offsetHeight ? panel.offsetHeight + 30 : narrow.matches ? 244 : 152;
    const verticalTangent = tangent * Math.max(.4, (lastHeight - reserved) / lastHeight);
    let distance = 0;
    for (const point of points) {
      const local = point.clone().sub(target);
      distance = Math.max(distance, Math.abs(local.dot(right)) / (tangent * camera.aspect) + local.dot(direction), Math.abs(local.dot(up)) / verticalTangent + local.dot(direction));
    }
    distance *= narrow.matches ? 1.06 : 1.09;
    target.addScaledVector(up, -reserved / lastHeight * distance * tangent);
    return { target, position: target.clone().addScaledVector(direction, distance) };
  }
  function setDetailVisible(visible) {
    presenting = visible;
    renderer.shadowMap.needsUpdate = true;
    requestRender();
  }
  function setArea(area) {
    if (active) return Promise.resolve();
    currentArea = area;
    highlight(null);
    const from = camera.position.clone(), oldTarget = navigation.target.clone(), oldRotation = camera.quaternion.clone();
    const to = initialView(), proxy = camera.clone(); proxy.position.copy(to.position); proxy.lookAt(to.target);
    navigation.enabled = false;
    return animate('view', t => {
      camera.position.lerpVectors(from, to.position, t); camera.quaternion.slerpQuaternions(oldRotation, proxy.quaternion, t);
      navigation.target.lerpVectors(oldTarget, to.target, t);
    }, 420).then(() => { navigation.enabled = true; navigation.update(); requestRender(); });
  }
  function setTheme(dark) {
    darkTheme = dark;
    if (active) readingLight.intensity = readingIntensity() * readingBlend;
    lighting.setTheme(dark);
    requestRender();
  }
  async function moveView(action) {
    if (active) return;
    canvas.parentElement.classList.toggle('is-exploring', action !== 'home');
    if (action === 'in' || action === 'out') {
      await navigation.zoom(action === 'in' ? -150 : 150);
      return;
    }
    const from = camera.position.clone(), previousTarget = navigation.target.clone();
    let target = previousTarget.clone(), position = from.clone();
    const fromRotation = camera.quaternion.clone();
    if (action === 'home') {
      ({ target, position } = initialView());
    } else if (action === 'fulls' || action === 'estoig' || action === 'potus') {
      const views = { fulls: [[-4.55,3.3,7.1],[-4.65,-.55,3.45]],
        estoig: [[6.5,2.4,6.3],[6.5,-.46,3.8]], potus: [[-4.85,1.8,6.5],[-6.66,.40,3.1]] };
      position.fromArray(views[action][0]); target.fromArray(views[action][1]);
    } else if (action === 'window') {
      target.set(-8.04, 2.97, 1.7);
      position.set(narrow.matches ? -.5 : -3.25, 2.25, narrow.matches ? 5.9 : 5.25);
    } else {
      navigation.look(action === 'left' ? .2 : action === 'right' ? -.2 : 0,
        action === 'up' ? .12 : action === 'down' ? -.12 : 0);
      target.copy(navigation.target);
    }
    const viewCamera = camera.clone();
    viewCamera.position.copy(position);
    viewCamera.lookAt(target);
    const rotation = viewCamera.quaternion.clone();
    camera.quaternion.copy(fromRotation);
    navigation.enabled = false;
    await animate('view', t => {
      camera.position.lerpVectors(from, position, t);
      navigation.target.lerpVectors(previousTarget, target, t);
      camera.quaternion.slerpQuaternions(fromRotation, rotation, t);
    }, 420);
    navigation.enabled = !active;
    navigation.update();
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); updateControls(); requestRender();
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  narrow.addEventListener('change', () => {
    if (narrow.matches && currentArea === 'Taula') {
      currentArea = 'Llengua';
      document.querySelectorAll('[data-area]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.area === currentArea)));
    }
    resize();
  });
  reducedMotion.addEventListener('change', () => {
    for (const motion of motions.values()) { motion.update(1); motion.resolve(); }
    motions.clear(); requestRender();
  });
  document.addEventListener('visibilitychange', () => {
    clearTimeout(ambientTimer);
    if (document.hidden) { canvas.dataset.ambience = 'still'; sceneryFrame = null; }
    if (!document.hidden) requestRender();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    clearTimeout(ambientTimer);
    document.querySelector('#projectes').classList.add('is-open');
    document.querySelector('.list-toggle').setAttribute('aria-expanded', 'true');
    document.querySelector('#desk-status').textContent = 'L’escriptori s’ha pausat. Pots continuar des de Projectes.';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    document.querySelector('#desk-status').textContent = '';
    requestRender();
  });
  resize();
  document.querySelectorAll('[data-area]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.area === currentArea)));
  onStage(94, 'Preparant la llum i els materials…');
  await new Promise(resolve => requestAnimationFrame(resolve));
  await renderer.compileAsync(scene, camera);
  onStage(98, 'Dibuixant l’escriptori…');
  await new Promise(resolve => { firstFrame = resolve; requestRender(); });
  async function setSample(index) {
    const info = reading.info();
    const inspectingPaper = phase === 'inspecting' && paperView.info().open;
    if ((phase !== 'reading' && !inspectingPaper) || index === info.index || index < 0 || index >= info.count) return;
    phase = 'turning';
    for (const direction of [-1, 1]) { cancelMotion('curl-' + direction); curlAmounts.set(direction, 0); }
    const direction = Math.sign(index - info.index);
    reading.startTurn(index);
    if (!active.project.reliefs?.length) onObjectSound('page', 'paper');
    await animate('pages', t => { if (!active.project.reliefs?.length) reading.turn(t); }, active.project.reliefs?.length ? 220 : 820);
    reading.finishTurn(index);
    if (active.project.reliefs?.length) reliefs.setSamples(reading.info().pages);
    phase = inspectingPaper ? 'inspecting' : 'reading'; resize();
  }
  function curlSample(direction, amount) {
    if (phase !== 'reading') return;
    if (active.project.reliefs?.length) return;
    const from = curlAmounts.get(direction) || 0;
    animate('curl-' + direction, t => {
      const value = THREE.MathUtils.lerp(from, amount, t);
      curlAmounts.set(direction, value); reading.curl(direction, value, narrow.matches);
    });
  }
  async function inspectSheet(index) {
    if (phase !== 'reading' || !reading.info().pages[index]) return;
    for (const direction of [-1, 1]) { cancelMotion('curl-' + direction); curlAmounts.set(direction, 0); }
    reading.curl(-1, 0, narrow.matches); reading.curl(1, 0, narrow.matches);
    phase = 'zooming';
    if (active.project.reliefs?.length) { await reliefs.inspect(index); phase = 'inspecting'; }
    else { await paperView.open(index); phase = 'inspecting'; paperView.resize(); }
    canvas.dataset.presentation = active.project.reliefs?.length ? 'relief' : 'sheet'; requestRender();
  }
  async function leaveInspection() {
    if ((!paperView.info().open && !reliefs.info().open) || phase === 'zooming') return;
    cancelMotion('inspection'); phase = 'zooming';
    if (reliefs.info().open) { cancelMotion('relief-view'); await reliefs.close(readingView); }
    else await paperView.close(readingView);
    phase = 'reading';
    canvas.dataset.presentation = 'table'; requestRender();
  }
  function panInspection(x, y) { if (phase === 'inspecting') return paperView.pan(x, y); }
  function scrollInspection(x, y) { if (phase === 'inspecting') return reliefs.info().open ? reliefs.zoom(y) : paperView.scroll(x, y); }
  function orbitInspection(x, y) { if (phase === 'inspecting') return reliefs.orbit(x, y); }
  new ResizeObserver(() => { if (active && phase === 'reading') resize(); }).observe(document.querySelector('.description-page'));
  return { highlight, select, home, setTheme, setArea, setDetailVisible, moveView, setSample, curlSample,
    inspectSheet, leaveInspection, panInspection, scrollInspection, orbitInspection,
    resetInspection: reliefs.reset, reliefInfo: reliefs.info, inspectionInfo: () => reliefs.info().open ? reliefs.info() : paperView.info(),
    sampleInfo: reading.info, setMoment: lighting.setMoment, setRoomLight: lighting.setRoomLight };
}

function meshPoints(group, mesh) {
  group.updateWorldMatrix(true, true);
  const matrix = new THREE.Matrix4().multiplyMatrices(group.matrixWorld.clone().invert(), mesh.matrixWorld);
  const position = mesh.geometry.getAttribute('position'), points = new Map();
  for (let i = 0; i < position.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix);
    points.set(point.toArray().map(v => Math.round(v * 100000)).join(','), point);
  }
  return [...points.values()];
}

function convexHull(points) {
  const cross = (o, a, b) => (a.x-o.x)*(b.y-o.y) - (a.y-o.y)*(b.x-o.x);
  const sorted = [...points].sort((a, b) => a.x-b.x || a.y-b.y);
  const half = values => {
    const hull = [];
    for (const p of values) {
      while (hull.length > 1 && cross(hull.at(-2), hull.at(-1), p) <= 0) hull.pop();
      hull.push(p);
    }
    hull.pop(); return hull;
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

function localBounds(group) {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  group.traverse(mesh => {
    if (!mesh.isMesh || !mesh.visible || mesh.name === 'ProjectCard') return;
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)));
  });
  return bounds;
}

function createHoverOutline(surface) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.classList.add('object-outline'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(namespace, 'path'); svg.append(path); surface.append(svg);
  return {
    update(model, camera, width, height) {
      svg.classList.toggle('is-visible', Boolean(model));
      if (!model) return;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const bounds = model.outlineBounds, points = [];
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = model.group.localToWorld(new THREE.Vector3(x, y, z)).project(camera);
        points.push({ x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 });
      }
      const hull = convexHull(points);
      path.setAttribute('d', hull.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ') + ' Z');
    },
  };
}
