import * as THREE from 'three';
import { BlackHole } from './objects/blackHole';
import { Photon } from './objects/photon';
import { config } from './config';

function createPhoton(rs, i, N) {

  const x0 = 10 * rs; // Fixed x position, from the black hole
  const ySpread = 20 * rs;
  const y0 = -ySpread / 2 + (ySpread * i) / (N - 1); // Vary y position

  // Convert to polar coordinates
  const r0 = Math.hypot(x0, y0);
  const phi0 = Math.atan2(y0, x0);

  // Initial direction vector: leftwards
  const dx = -1;
  const dy = 0;

  // Convert Cartesian Direction to Polar Velocities
  const dphi0 = (-dx * Math.sin(phi0) + dy * Math.cos(phi0)) / r0;

  // Conserved quantities
  const E = 1; // conserved energy per unit mass (set to 1 arbitrarily)
  const L = r0 * r0 * dphi0; // angular momentum per unit mass

  // Schwarzschild factor
  const f = 1 - rs / r0; // gravitational redshift factor

  // Null geodesic constraint: 0 = -f (dt/dλ)^2 + f^{-1} (dr/dλ)^2 + r^2 (dφ/dλ)^2
  // dt/dλ = E / f
  // Solve for dr0:
  const dr0_sign = dx * Math.cos(phi0) + dy * Math.sin(phi0) >= 0 ? 1 : -1;
  const dr0 = dr0_sign * Math.sqrt(
    (E * E) - f * (r0 * r0 * dphi0 * dphi0)
  );
  if (isNaN(dr0)) {
    console.error(`Invalid initial conditions for photon at index ${i}: dr0 is NaN`);
  }

  return new Photon(new THREE.Vector3(x0, y0, 0), dr0, dphi0, E, L);
}

const scene = new THREE.Scene();
addAxesHelper();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 500);
camera.position.set(config.CAMERA.x, config.CAMERA.y, config.CAMERA.z);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const gridSize = 100;
const gridDivisions = 100;
const colorCenterLine = 0xcc0000; // Red for the center line
const colorGrid = 0x333333; // Green for the grid lines
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, colorCenterLine, colorGrid);
gridHelper.rotation.x = Math.PI / 2;
scene.add(gridHelper);


const blackHole = new BlackHole(config.BLACK_HOLE_MASS, new THREE.Vector3(0, 0, 0));
blackHole.render(scene);

const NUMBER_OF_PHOTONS = 100;
const photons = [];
for (let i = 1; i <= NUMBER_OF_PHOTONS; i++) {
  const photon = createPhoton(blackHole.rs, i, NUMBER_OF_PHOTONS + 1);
  photons.push(photon);
}

photons.forEach(p => p.render(scene));
renderer.setAnimationLoop(animate);

function animate(time) {
  photons.forEach(photon => {
    if (photon.isDone) return;
    rk4Step(photon, config.PHOTON_STEP_SIZE);
  });

  renderer.render(scene, camera);
}


function computeGeodesic(state, rs, E) { // compute Schwarzschild geodesic equation for 2D space with simplified assumptions (skipped time component)
  const r = state[0]; // radial position
  const dr = state[2]; // radial velocity
  const dphi = state[3]; // angular velocity

  const f = 1 - rs / r; // Schwarzschild Factor
  const dt = E / f; // dt/dλ from conserved energy (E=f(r)c^2 dt/dλ, with c=1)

  // const r_acc = ((-rs / (2 * r * r)) * dt * dt) + (rs / (2 * r * r * f) * dr * dr) + (r * f * dphi * dphi);
  const r_acc = // Simplified angular term. From "r*f = r(1-rs/r)" to "r-s". It prevents numerical issues near the event horizon.
    -(rs / (2 * r * r)) *f * (dt * dt)
    + (rs / (2 * r * r * f)) * (dr * dr)
    + (r - rs) * (dphi * dphi);

  const phi_acc = -(2 / r) * dr * dphi; // 'phi' acceleration

  return [dr, dphi, r_acc, phi_acc];
}

function rk4Step(photon, stepSize) {
  // This function would compute the next position and velocity of the photon
  // using the Runge-Kutta 4th order method.

  // stepSize is the affine parameter increment (dLambda)
  const rs = blackHole.rs;
  const x = photon.position.x;
  const y = photon.position.y;

  const r = Math.hypot(x, y);
  const phi = Math.atan2(y, x);

  const dr = photon.dr;
  const dphi = photon.dphi;

  const epsilon = 1e-1; // we need to add this epsilon, because when 'f' in geodesic equation goes to zero, values multiplied by 1/f goes to infinity
  if (r <= rs + (2 * epsilon)) {
    console.log('Photon has crossed the event horizon and is absorbed by the black hole.');
    photon.isDone = true;
    return;
  }

  let state = [r, phi, dr, dphi];

  const k1 = computeGeodesic(state, rs, photon.E);
  const state2 = state.map((v, i) => v + k1[i] * stepSize / 2);
  const k2 = computeGeodesic(state2, rs, photon.E);
  const state3 = state.map((v, i) => v + k2[i] * stepSize / 2);
  const k3 = computeGeodesic(state3, rs, photon.E);
  const state4 = state.map((v, i) => v + k3[i] * stepSize);
  const k4 = computeGeodesic(state4, rs, photon.E);

  const newState = state.map(
    (v, i) => v + (stepSize / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
  );

  // Update photon velocities
  photon.dr = newState[2];
  photon.dphi = newState[3];

  // Update polar coordinates
  const newR = newState[0];
  const newPhi = newState[1];

  // Transform back to cartesian coordinates
  const newX = newR * Math.cos(newPhi);
  const newY = newR * Math.sin(newPhi);

  photon.move(newX, newY);
}


function addAxesHelper() {
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
}
