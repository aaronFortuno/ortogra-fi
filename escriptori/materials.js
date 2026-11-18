import * as THREE from 'three';
import { HDRLoader } from '../assets/vendor/three/addons/loaders/HDRLoader.js';

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
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(studio).texture;
  scene.environmentRotation.y = 1.25;
  studio.dispose(); pmrem.dispose();

  const cache = new Map();
  const paperGrain = paperTexture();
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
      material.color.set('#dcc3a2');
      material.normalMap = oakNormal;
      material.normalScale.set(.22, .22);
      material.roughnessMap = oakRough;
      material.roughness = .9;
      material.envMapIntensity = .8;
    }
    if (source.name.startsWith('Plaster')) {
      material.color.set('#e6dfd0');
      material.roughness = .96;
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
      material.roughness = .2;
      material.metalness = 1;
      material.envMapIntensity = 1.25;
    }
    if (material.aoMap) material.aoMapIntensity = source.name.startsWith('Plaster') ? .55 : .8;
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
