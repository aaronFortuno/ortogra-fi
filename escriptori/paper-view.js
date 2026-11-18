import * as THREE from 'three';

// A second camera pose, not a second viewer. Store the exact table pose so that
// clicking the sheet or pressing Escape returns to the same open object.
export function createPaperView({ camera, target, reading, animate, requestRender, getSize }) {
  let stored, paper, pageIndex = 0, bounds, distance, panX = 0, panY = 0;
  const clamp = THREE.MathUtils.clamp;
  const snapshot = () => ({ position: camera.position.clone(), rotation: camera.quaternion.clone(), up: camera.up.clone(), target: target.clone(), aspect: camera.aspect });
  function measure() {
    paper = reading.sheetView(pageIndex);
    const { height } = getSize();
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // A close view intentionally shows a portion of the sheet. On narrow screens
    // horizontal panning is available as well, so the type still gets larger.
    const visibleHeight = Math.min(paper.width * 1.08 / camera.aspect, paper.height * .68);
    distance = visibleHeight / (2 * tangent);
    const usefulHeight = visibleHeight * Math.max(.65, (height - 68) / height);
    bounds = { x: Math.max(0, (paper.width - visibleHeight * camera.aspect * .94) / 2), y: Math.max(0, (paper.height - usefulHeight) / 2) };
  }
  function view(x = panX, y = panY) {
    const focus = paper.center.clone().addScaledVector(paper.right, x * bounds.x).addScaledVector(paper.up, y * bounds.y);
    const position = focus.clone().addScaledVector(paper.normal, distance);
    const proxy = camera.clone(); proxy.position.copy(position); proxy.up.copy(paper.up); proxy.lookAt(focus);
    return { position, target: focus, rotation: proxy.quaternion, up: paper.up };
  }
  async function travel(to) {
    const from = snapshot();
    await animate('inspection', t => {
      camera.position.lerpVectors(from.position, to.position, t);
      camera.quaternion.slerpQuaternions(from.rotation, to.rotation, t);
      target.lerpVectors(from.target, to.target, t);
    });
    camera.up.copy(to.up);
  }
  async function open(index) {
    if (stored) return;
    stored = snapshot(); pageIndex = index; panX = panY = 0;
    measure(); await travel(view());
  }
  async function close(fallback) {
    if (!stored) return;
    let to = stored;
    if (Math.abs(stored.aspect - camera.aspect) > .01) {
      const resized = fallback(); const proxy = camera.clone();
      proxy.up.copy(stored.up); proxy.position.copy(resized.position); proxy.lookAt(resized.target);
      to = { ...resized, rotation: proxy.quaternion, up: stored.up };
    }
    await travel(to); stored = null;
  }
  async function pan(x, y) {
    if (!stored) return;
    panX = clamp(x, -1, 1); panY = clamp(y, -1, 1);
    await travel(view());
  }
  function scroll(dx, dy) { return pan(panX + dx * .003, panY - dy * .003); }
  function resize() {
    if (!stored) return;
    measure(); const to = view(); camera.position.copy(to.position); camera.quaternion.copy(to.rotation); target.copy(to.target); requestRender();
  }
  return { open, close, pan, scroll, resize, info: () => ({ open: Boolean(stored), index: pageIndex, panX, panY }) };
}
