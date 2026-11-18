import * as THREE from 'three';

// Look from the viewer's position; moving the eye and turning the head are
// separate operations. No pointer lock is needed for a public catalogue.
export class DeskNavigation {
  constructor(camera, surface, { change, start, animate, cancel }) {
    this.camera = camera;
    this.surface = surface;
    this.target = new THREE.Vector3();
    this.enabled = true;
    this.change = change;
    this.start = start;
    this.animate = animate;
    this.cancel = cancel;
    this.distance = 10;
    this.pointers = new Map();
    this.dragged = false;
    this.zoomGoal = null;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.bounds = new THREE.Box3(new THREE.Vector3(-7.15, .25, 1.05), new THREE.Vector3(7.15, 6.8, 36));
    const navigable = event => event.target === surface.querySelector('canvas') || event.target.closest('.binder-target');
    surface.addEventListener('pointerdown', event => {
      if (!this.pointers.size) this.dragged = false;
      if (!this.enabled || !navigable(event) || (event.pointerType === 'mouse' && ![0, 2].includes(event.button))) return;
      this.cancel();
      this.zoomGoal = null;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
      this.pan = event.shiftKey || event.button === 2;
      // Capture on the original button so a short tap remains an ordinary click.
      event.target.setPointerCapture(event.pointerId);
      this.start(event.type);
    });
    surface.addEventListener('pointermove', event => {
      const previous = this.pointers.get(event.pointerId);
      if (!this.enabled || !previous) return;
      const before = [...this.pointers.values()].map(point => ({ ...point }));
      const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
      previous.x = event.clientX; previous.y = event.clientY;
      if (Math.hypot(previous.x - previous.startX, previous.y - previous.startY) > 5) this.dragged = true;
      if (!this.dragged) return;
      event.preventDefault();
      if (this.pointers.size === 2) {
        const after = [...this.pointers.values()];
        const oldGap = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
        const gap = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
        this.translate(dx / 2, dy / 2);
        if (oldGap > 10 && gap > 10) this.zoom(Math.log(oldGap / gap) / .0015, null, false);
      } else if (this.pan || event.shiftKey) {
        this.translate(dx, dy);
      } else {
        this.look(dx * .0032, dy * .0028);
      }
      this.change();
    });
    const release = event => {
      this.pointers.delete(event.pointerId);
      if (event.type !== 'pointerup') this.dragged = false;
    };
    surface.addEventListener('pointerup', release);
    surface.addEventListener('pointercancel', release);
    surface.addEventListener('lostpointercapture', event => this.pointers.delete(event.pointerId));
    surface.addEventListener('click', event => {
      if (!this.dragged || event.detail === 0) return;
      this.dragged = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    surface.addEventListener('contextmenu', event => { if (navigable(event)) event.preventDefault(); });
    surface.addEventListener('wheel', event => {
      if (!this.enabled || !navigable(event)) return;
      event.preventDefault();
      this.start(event.type);
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientHeight : 1);
      this.zoom(pixels, { x: event.clientX, y: event.clientY });
    }, { passive: false });
  }

  update() {
    this.camera.lookAt(this.target);
    this.distance = this.camera.position.distanceTo(this.target);
    this.zoomGoal = null;
    this.change();
  }

  updateTarget() {
    this.target.copy(this.camera.position).addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()), this.distance);
  }

  look(yaw, pitch) {
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.euler.y = THREE.MathUtils.clamp(this.euler.y + yaw, -1.22, 1.22);
    this.euler.x = THREE.MathUtils.clamp(this.euler.x + pitch, -.68, .7);
    this.camera.quaternion.setFromEuler(this.euler);
    this.updateTarget();
  }

  translate(dx, dy) {
    const scale = Math.max(2, this.camera.position.z - .5) * .0016;
    this.camera.updateMatrix();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    this.camera.position.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    this.bounds.clampPoint(this.camera.position, this.camera.position);
    this.updateTarget();
  }

  async zoom(delta, pointer, animated = true) {
    const rect = this.surface.getBoundingClientRect();
    const ray = pointer ? new THREE.Vector3(
      (pointer.x - rect.left) / rect.width * 2 - 1,
      1 - (pointer.y - rect.top) / rect.height * 2, .5,
    ).unproject(this.camera).sub(this.camera.position).normalize() : this.camera.getWorldDirection(new THREE.Vector3());
    const from = this.camera.position.clone();
    const goal = this.zoomGoal?.clone() || from.clone();
    // Forward travel follows the cursor ray, so an off-centre label can be
    // brought close without first returning it to the middle of the shelf.
    const step = Math.max(1, goal.z - .6) * (1 - Math.exp(THREE.MathUtils.clamp(delta, -500, 500) * .0015));
    goal.addScaledVector(ray, step);
    this.bounds.clampPoint(goal, goal);
    this.zoomGoal = goal;
    if (animated) {
      await this.animate(t => {
        this.camera.position.lerpVectors(from, goal, t);
        this.updateTarget();
      });
    } else {
      this.camera.position.copy(goal);
      this.updateTarget();
    }
    if (this.zoomGoal === goal) this.zoomGoal = null;
    this.change();
  }
}
