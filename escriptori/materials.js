import * as THREE from 'three';
import { HDRLoader } from '../assets/vendor/three/addons/loaders/HDRLoader.js';
import { deskLayout } from './desk-layout.js?v=1.10.0';

export async function prepareMaterials(room, scene, renderer, resources) {
  const loader = new THREE.TextureLoader();
  const texture = async name => {
    const url = new URL('../assets/desk/pbr/' + name + '.webp', import.meta.url).href;
    const map = await resources.load(url, objectURL => loader.loadAsync(objectURL));
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.flipY = false;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return map;
  };
  const [cloth, clothNormal, clothRough, oak, oakNormal, oakRough, studio] = await Promise.all([
    ...['book-color', 'book-normal', 'book-rough', 'oak-color', 'oak-normal', 'oak-rough'].map(texture),
    resources.load(new URL('../assets/desk/pbr/studio.hdr', import.meta.url).href, objectURL => new HDRLoader().loadAsync(objectURL)),
  ]);
  oak.colorSpace = THREE.SRGBColorSpace;
  // The veneer scan runs along U. Keep the pores and the finish registered
  // as the cathedral grain stretches along each board's longest face.
  for (const map of [oak, oakNormal, oakRough]) map.repeat.set(.52, 1.65);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(studio).texture;
  scene.environmentRotation.y = 1.25;
  studio.dispose(); pmrem.dispose();

  const cache = new Map();
  const paperGrain = paperTexture();
  const plasterGrain = plasterTexture();
  function prepare(source) {
    if (cache.has(source)) return cache.get(source);
    let material = source;
    if (source.name.startsWith('Cloth_') || source.name === 'BoxFabric') {
      material = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(material, source);
      material.defines = { STANDARD: '', PHYSICAL: '' };
      material.name = source.name;
      material.map = cloth;
      material.normalMap = clothNormal;
      material.normalScale.set(.48, .48);
      material.roughnessMap = clothRough;
      material.roughness = 1;
      material.sheen = .22;
      material.sheenColor.copy(source.color);
      material.sheenRoughness = .9;
      material.envMapIntensity = .7;
    }
    if (source.name.startsWith('Oak')) {
      material.map = oak;
      material.color.set('#d9ba94');
      material.normalMap = oakNormal;
      material.normalScale.set(.22, .22);
      material.roughnessMap = oakRough;
      material.roughness = 1;
      material.envMapIntensity = .65;
      prepareOakFinish(material);
    }
    if (source.name.startsWith('Plaster')) {
      material.color.set('#e9e5db');
      material.roughness = .96;
      material.envMapIntensity = .65;
      preparePlaster(material, plasterGrain);
    }
    if (source.name === 'Paper' || source.name === 'PaperEdges') {
      material.color.set('#f7f3e8');
      material.roughness = 1;
      material.roughnessMap = paperGrain;
      material.bumpMap = null;
    }
    if (source.name === 'PaperEdges') {
      material.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 paperPosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\npaperPosition = position;');
        shader.fragmentShader = 'varying vec3 paperPosition;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= .92 + .08 * smoothstep(-.3, .7, sin(paperPosition.x * 1350.0));');
      };
      material.customProgramCacheKey = () => 'paper-edges-v1';
    }
    if (source.name.startsWith('Steel')) {
      material.roughness = .3;
      material.metalness = 1;
      material.envMapIntensity = 1;
    }
    // The baked map contains only static geometry; mobile binders retain real shadows.
    if (material.aoMap) material.aoMapIntensity = source.name.startsWith('Plaster') ? .85 : .95;
    cache.set(source, material);
    return material;
  }
  room.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = object.receiveShadow = true;
    object.material = Array.isArray(object.material) ? object.material.map(prepare) : prepare(object.material);
  });
  return new Set(cache.values());
}

// Satin veneer is more matte in the rack and lightly burnished on the writing
// surface. Keep the measured pore pattern under both finishes and the AO UVs intact.
function prepareOakFinish(material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 oakPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\noakPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 oakPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      vec2 workArea = (oakPosition.xz - vec2(-1.2, 2.8)) / vec2(3.6, 1.7);
      float desktop = 1.0 - smoothstep(.005, .025, abs(oakPosition.y - ${deskLayout.table.surfaceY.toFixed(3)}));
      float polish = desktop * (1.0 - smoothstep(.12, 1.0, dot(workArea, workArea)));
      roughnessFactor = .41 + .52 * roughnessFactor - .095 * polish;`);
  };
  material.customProgramCacheKey = () => 'satin-oak-v1';
}

// World-space mapping keeps the grain the same size on a wall, a window reveal
// and the shelf backing, independently of Blender's packed UV islands.
function preparePlaster(material, grain) {
  material.onBeforeCompile = shader => {
    shader.uniforms.plasterGrain = { value: grain };
    shader.vertexShader = 'varying vec3 plasterPosition;\nvarying vec3 plasterNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nplasterPosition = (modelMatrix * vec4(position, 1.0)).xyz;\nplasterNormal = normalize(mat3(modelMatrix) * normal);');
    shader.fragmentShader = `
      uniform sampler2D plasterGrain;
      varying vec3 plasterPosition;
      varying vec3 plasterNormal;
      vec3 plasterSample() {
        vec3 weight = pow(abs(plasterNormal), vec3(6.0));
        weight /= max(dot(weight, vec3(1.0)), .0001);
        return texture2D(plasterGrain, plasterPosition.zy * .42).rgb * weight.x
          + texture2D(plasterGrain, plasterPosition.xz * .42).rgb * weight.y
          + texture2D(plasterGrain, plasterPosition.xy * .42).rgb * weight.z;
      }
      vec3 plasterBump(vec3 position, vec3 n, float height) {
        vec3 dx = dFdx(position), dy = dFdy(position);
        vec3 r1 = cross(dy, n), r2 = cross(n, dx);
        float determinant = dot(dx, r1);
        vec3 gradient = sign(determinant) * (dFdx(height) * r1 + dFdy(height) * r2);
        return normalize(abs(determinant) * n - gradient);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nvec3 plaster = plasterSample();\ndiffuseColor.rgb *= .965 + .07 * plaster.r;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (plaster.g - .5) * .055, .85, 1.0);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = plasterBump(-vViewPosition, normal, (plaster.b - .5) * .00008);');
  };
  material.customProgramCacheKey = () => 'world-plaster-v1';
}

function plasterTexture() {
  const size = 512, pixels = new Uint8Array(size * size * 4);
  // Deterministic, periodic value noise: no external asset or visible tile seam.
  const hash = (x, y, period) => {
    x = (x % period + period) % period; y = (y % period + period) % period;
    const value = Math.sin(x * 127.1 + y * 311.7 + 13.2) * 43758.5453;
    return value - Math.floor(value);
  };
  const noise = (x, y, period) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy);
    const a = hash(ix, iy, period), b = hash(ix + 1, iy, period);
    const c = hash(ix, iy + 1, period), d = hash(ix + 1, iy + 1, period);
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, index = (y * size + x) * 4;
    const broad = noise(u * 8, v * 8, 8), fine = noise(u * 96, v * 96, 96);
    const pores = noise(u * 192, v * 192, 192);
    pixels[index] = Math.round(255 * (.4 + .2 * broad));
    pixels[index + 1] = Math.round(255 * (.3 + .4 * fine));
    pixels[index + 2] = Math.round(255 * (.3 * broad + .45 * fine + .25 * pores));
    pixels[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.name = 'WorldPlasterGrain';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

function paperTexture() {
  const size = 256, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const value = 210 + (n - Math.floor(n)) * 36;
    const index = (y * size + x) * 4;
    pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
    pixels[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}
