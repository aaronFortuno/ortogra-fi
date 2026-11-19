import * as THREE from 'three';

// Slightly aged printed labels; the small lifted corner is geometry in scene.js.
// Logos come from the same catalogue as the portal, so identities stay in sync.
export async function createLabelTexture(project) {
  const vertical = project.kind === 'binder';
  const canvas = document.createElement('canvas');
  canvas.width = vertical ? 256 : 1536; canvas.height = vertical ? 1536 : 256;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (vertical) ctx.rotate(-Math.PI / 2);
  let seed = [...project.id].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.beginPath(); ctx.moveTo(-763, -121);
  for (let x = -750; x < 765; x += 12) ctx.lineTo(x, -124 + random() * 5);
  ctx.lineTo(766, 120); ctx.lineTo(725, 126);
  for (let x = 710; x > -765; x -= 12) ctx.lineTo(x, 123 - random() * 4);
  ctx.closePath();
  const paper = ctx.createLinearGradient(-740, -120, 730, 125);
  paper.addColorStop(0, '#e2dbc6'); paper.addColorStop(.22, '#f1ecdf'); paper.addColorStop(.76, '#eae4d2'); paper.addColorStop(1, '#d1c8ae');
  ctx.fillStyle = paper; ctx.fill(); ctx.save(); ctx.clip();
  for (let i = 0; i < 1900; i++) {
    ctx.fillStyle = `rgba(83,67,38,${random() * .05})`;
    ctx.fillRect(-768 + random() * 1536, -128 + random() * 256, 1 + random() * 3, 1 + random() * 2);
  }
  // Faint traces of older adhesive and two creases, away from the lettering.
  ctx.strokeStyle = '#8b765a25'; ctx.lineWidth = 3;
  ctx.strokeRect(-752, -113, 1495, 230);
  for (const x of [-718, 706]) {
    ctx.beginPath(); ctx.moveTo(x, -125); ctx.bezierCurveTo(x - 10, -50, x + 18, 55, x + 6, 125); ctx.stroke();
    ctx.strokeStyle = '#fffdf04a'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = '#8b765a25';
  }
  if (project.logo) {
    const logo = new Image(); logo.src = project.logo;
    try { await logo.decode(); ctx.globalAlpha = .9; ctx.drawImage(logo, -680, -88, 176, 176); ctx.globalAlpha = 1; } catch { /* The name remains readable if an icon is unavailable. */ }
  }
  const x = project.logo ? -445 : -650;
  ctx.fillStyle = '#293b30'; ctx.textBaseline = 'middle';
  let fontSize = 128; ctx.font = `650 ${fontSize}px "Segoe UI",Arial,sans-serif`;
  while (ctx.measureText(project.name).width > 1100) ctx.font = `650 ${--fontSize}px "Segoe UI",Arial,sans-serif`;
  ctx.fillText(project.name, x, -32);
  ctx.fillStyle = '#4c5847'; ctx.font = '500 53px "Segoe UI",Arial,sans-serif';
  ctx.fillText(project.purpose, x, 64);
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
