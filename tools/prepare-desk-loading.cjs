const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = [
  'assets/desk/escriptori.glb', 'assets/desk/garden.webp',
  ...['book-color.webp', 'book-normal.webp', 'book-rough.webp', 'oak-color.webp', 'oak-normal.webp', 'oak-rough.webp', 'studio.hdr'].map(name => 'assets/desk/pbr/' + name),
  ...[...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/class="project-preview"\s+src="([^"]+)"/g)].map(match => match[1]),
];
const assets = Object.fromEntries([...new Set(files)].map(file => [file, fs.statSync(path.join(root, file)).size]));
const manifest = { version: 1, assets };
fs.writeFileSync(path.join(root, 'assets/desk/loading.json'), JSON.stringify(manifest, null, 2) + '\n');
const cornerFiles=[...files.filter(file=>!file.startsWith('assets/project-previews/')),'assets/desk/reliefs/agulles-montserrat-preview.glb','assets/desk/samples/pauta-1.webp'];
fs.writeFileSync(path.join(root,'assets/desk/corner-loading.json'),JSON.stringify({version:1,assets:Object.fromEntries(cornerFiles.map(file=>[file,fs.statSync(path.join(root,file)).size]))},null,2)+'\n');
console.log(`${Object.keys(assets).length} startup assets, ${Object.values(assets).reduce((sum, size) => sum + size, 0)} bytes.`);
