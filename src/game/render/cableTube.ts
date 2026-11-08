import * as THREE from 'three';

/**
 * Tube geometry for a cable lying on the floor between bends. A Catmull-Rom spline through
 * sparse points overshoots and dips under the floor next to steep rises (to a hand, a drum),
 * so the spline is sampled densely and every sample is kept above the floor.
 */
export function cableTube(points: THREE.Vector3[], radius: number, floorY = 0): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const n = Math.max(24, points.length * 12);
  const min = floorY + radius + 0.006;
  const dense = curve.getPoints(n).map(p => (p.y < min ? p.setY(min) : p));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(dense, false, 'catmullrom', 0), n, radius, 6);
}
