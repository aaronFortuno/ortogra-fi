import * as THREE from 'three';

const progress = (from, to, value) => THREE.MathUtils.smoothstep(value, from, to);

export function createObjectJourney({ model, from, to, flatRotation, startView, endView, endFocus, camera, target, focusPoints, onLid }) {
  const folder = model.project.kind === 'folder';
  const cameraLift = Math.min(.5, Math.max(0, 7.4 - Math.max(startView.position.y, endView.position.y)));
  // The first two controls keep the object aligned with its shelf until clear.
  // A single quartic curve has no joins at which velocity could drop to zero.
  const controls = [
    from.clone(),
    from.clone().add(new THREE.Vector3(0, folder ? .9 : .32, folder ? .4 : 3.5)),
    from.clone().add(new THREE.Vector3(0, folder ? 1.25 : .65, folder ? 1 : 3.5)),
    to.clone().add(new THREE.Vector3(0, .8, .45)),
    to.clone(),
  ];
  const closedCenter = model.outlineBounds.getCenter(new THREE.Vector3());
  const initialFocus = closedCenter.clone().applyQuaternion(model.rotation).add(from);
  const initialOffset = startView.position.clone().sub(initialFocus);
  const finalOffset = endView.position.clone().sub(endView.target);
  const lookOffset = startView.target.clone().sub(initialFocus);
  const finalFocusOffset = endView.target.clone().sub(endFocus);
  const focus = new THREE.Vector3(), offset = new THREE.Vector3(), center = new THREE.Vector3();
  const bounds = new THREE.Box3();
  const card = model.group.getObjectByName('ProjectCard');

  return u => {
    const v = 1 - u;
    model.group.position.set(0, 0, 0)
      .addScaledVector(controls[0], v ** 4)
      .addScaledVector(controls[1], 4 * v ** 3 * u)
      .addScaledVector(controls[2], 6 * v ** 2 * u ** 2)
      .addScaledVector(controls[3], 4 * v * u ** 3)
      .addScaledVector(controls[4], u ** 4);
    model.group.quaternion.slerpQuaternions(model.rotation, flatRotation, progress(.20, .82, u));
    const opening = progress(.55, 1, u);
    model.lid.rotation[model.axis] = model.angle * opening;
    if (card) { card.visible = opening > 0; card.position.x = 2.05 * opening; }
    onLid(opening);
    model.group.updateWorldMatrix(true, true);

    focus.copy(closedCenter); model.group.localToWorld(focus);
    bounds.setFromPoints(focusPoints()).getCenter(center);
    center.add(finalFocusOffset);
    focus.lerp(center, opening);
    // Follow the moving object while approaching the reading view, below the ceiling.
    offset.lerpVectors(initialOffset, finalOffset, u).multiplyScalar(1 + .15 * Math.sin(Math.PI * u));
    camera.position.copy(focus).add(offset);
    camera.position.y = THREE.MathUtils.lerp(startView.position.y, endView.position.y, u) + cameraLift * Math.sin(Math.PI * u);
    target.copy(focus).addScaledVector(lookOffset, 1 - progress(0, .32, u));
    camera.lookAt(target);
  };
}
