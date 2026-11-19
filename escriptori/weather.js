import * as THREE from 'three';

// A soft, drifting mask affects only the scene's sole directional light (Sun).
// Ceiling/reading lights, ambient light and unlit printed ink remain unchanged.
export function createCloudShadows(scene, sun) {
  const size = 128, data = new Uint8Array(size * size);
  const smooth = x => x * x * (3 - 2 * x);
  const hash = (x, y, n) => { const v = Math.sin((x % n) * 127.1 + (y % n) * 311.7 + n * 13.7) * 43758.5453; return v - Math.floor(v); };
  function noise(u, v, n) {
    const x = u * n, y = v * n, ix = Math.floor(x), iy = Math.floor(y), sx = smooth(x - ix), sy = smooth(y - iy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy, n), hash(ix + 1, iy, n), sx),
      THREE.MathUtils.lerp(hash(ix, iy + 1, n), hash(ix + 1, iy + 1, n), sx), sy);
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    data[y * size + x] = Math.round(255 * (.58 * noise(x / size, y / size, 3) + .29 * noise(x / size, y / size, 6) + .13 * noise(x / size, y / size, 12)));
  }
  const map = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.minFilter = map.magFilter = THREE.LinearFilter; map.needsUpdate = true;
  const uniforms = { deskCloudMap: { value: map }, deskCloudDrift: { value: new THREE.Vector2(.13, .41) },
    deskCloudU: { value: new THREE.Vector3(1, 0, 0) }, deskCloudV: { value: new THREE.Vector3(0, 0, 1) } };
  const prepared = new WeakSet(), direction = new THREE.Vector3();
  const declarations = 'uniform sampler2D deskCloudMap;\nuniform vec2 deskCloudDrift;\nuniform vec3 deskCloudU;\nuniform vec3 deskCloudV;\nvarying vec3 deskWeatherWorld;\n';
  const lightChunk = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', `getDirectionalLightInfo( directionalLight, directLight );
    vec2 cloudUV = vec2(dot(deskWeatherWorld, deskCloudU), dot(deskWeatherWorld, deskCloudV)) * .045 + deskCloudDrift;
    float cloudCover = smoothstep(.28, .72, texture2D(deskCloudMap, cloudUV).r);
    directLight.color *= mix(1.0, .38, cloudCover);`);
  function prepare(material) {
    if (!material.isMeshStandardMaterial || prepared.has(material)) return;
    prepared.add(material);
    const before = material.onBeforeCompile, key = material.customProgramCacheKey.call(material);
    material.onBeforeCompile = function(shader, renderer) {
      before.call(this, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'varying vec3 deskWeatherWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\ndeskWeatherWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = declarations + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', lightChunk);
    };
    material.customProgramCacheKey = () => key + '|solar-clouds-v1'; material.needsUpdate = true;
  }
  scene.traverse(node => { if (node.isMesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) prepare(material); });
  function update(seconds) {
    direction.subVectors(sun.position, sun.target.position).normalize();
    uniforms.deskCloudU.value.crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
    uniforms.deskCloudV.value.crossVectors(direction, uniforms.deskCloudU.value).normalize();
    uniforms.deskCloudDrift.value.set(.13 + seconds * .0083, .41 + seconds * .0031);
  }
  update(0);
  return { prepare, update, uniforms, active: () => sun.intensity > .02 };
}
