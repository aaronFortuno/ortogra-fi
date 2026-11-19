// Coordinates shared by lighting/occlusion helpers. Construction is defined in
// tools/build-desk-assets.py; the desktop itself supports the open organisers.
export const deskLayout = Object.freeze({
  table: Object.freeze({
    surfaceY: -.58,
    contactY: -.577,
    bounds: Object.freeze([-7.75, 7.75, -1.65, 4.95]),
    backEdgeZ: -1.65,
  }),
  organizer: Object.freeze({
    minimum: Object.freeze([-6, -.581, -1.67]),
    maximum: Object.freeze([6, 1.786, .25]),
    baseY: -.58,
    topY: 1.785,
    topOpeningY: 1.845,
    topOpen: true,
    frontZ: .25,
    backingFrontZ: -1.6625,
    dividerXs: Object.freeze([-6, -1.7, .68, 3.2, 6]),
    openings: Object.freeze([[-5.94, -1.76], [-1.64, .62], [.74, 3.14], [3.26, 5.94]].map(Object.freeze)),
    contactBounds: Object.freeze([-6.1, 6.1, -1.65, .255]),
  }),
  wallFrontZ: -1.71,
});
