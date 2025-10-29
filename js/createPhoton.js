import { Photon } from './objects/photon';
import * as THREE from 'three';

export function createPhoton(rs, i, N) {

  const ySpread = 25 * rs;
  const zSpread = 25 * rs;

  const x0 = 10 * rs;
  // const y0 = -ySpread / 2 + (ySpread * i) / (N - 1);
  const y0 = Math.random() * ySpread - ySpread / 2;
  // const z0 = -zSpread / 2 + (zSpread * i) / (N - 1);
  const z0 = Math.random() * zSpread - zSpread / 2;

  const r0 = Math.hypot(x0, y0, z0);
  const theta0 = Math.acos(z0 / r0);
  const phi0 = Math.atan2(y0, x0);

  // Initial direction vector (normalize!)
  let dx = -1, dy = -0.1, dz = 0.1;
  const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
  dx /= mag;
  dy /= mag;
  dz /= mag;

  // Convert Cartesian Direction to 3D Polar Velocities
  const dphi0 = (-dx * Math.sin(phi0) + dy * Math.cos(phi0) + 0 * dz) / (r0 * Math.sin(theta0)); // angular velocity in azimuthal direction
  const dtheta0 = (dx * Math.cos(theta0) * Math.cos(phi0) + dy * Math.cos(theta0) * Math.sin(phi0) - dz * Math.sin(theta0)) / r0; // angular velocity in polar direction
  const dr0_sign = (
    dx * Math.sin(theta0) * Math.cos(phi0) +
    dy * Math.sin(theta0) * Math.sin(phi0) +
    dz * Math.cos(theta0)
  ) >= 0 ? 1 : -1;

  // Conserved quantities
  const E = 1; // conserved energy per unit mass (set to 1 arbitrarily)
  const L_squared = Math.pow(r0, 4) * ((dtheta0 * dtheta0) + (Math.sin(theta0) * Math.sin(theta0) * dphi0 * dphi0)); //Square of Angular Momentum in Schwarzschild Geometry for 3D space

  // Schwarzschild factor
  const f = 1 - rs / r0; // gravitational redshift factor

  // Null geodesic constraint:
  // dt/dλ = E / f
  // Solve for dr0:
  const dr0 = dr0_sign * Math.sqrt(
    (E * E) - (L_squared * f) / (r0 * r0)
  );
  if (isNaN(dr0)) {
    console.error(`Invalid initial conditions for photon at index ${i}: dr0 is NaN`);
  }

  return new Photon(new THREE.Vector3(x0, y0, z0), dr0, dphi0, dtheta0, E, Math.sqrt(L_squared));
}
