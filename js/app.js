import * as THREE from 'three';
import { BlackHole } from './objects/blackHole';
import { Photon } from './objects/photon';
import { config } from './config';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { sky } from './objects/backgroundSky';


function createPhoton(rs, i, N) {

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

const scene = new THREE.Scene();
scene.background = sky;
addAxesHelper();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 500);
camera.position.set(config.CAMERA.x, config.CAMERA.y, config.CAMERA.z);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

const blackHole = new BlackHole(config.BLACK_HOLE_MASS, new THREE.Vector3(0, 0, 0));
blackHole.render(scene);

const NUMBER_OF_PHOTONS = 1;
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

function computeGeodesic(state, rs, E) {
  const r = state[0]; // radial position
  const theta = state[1]; // polar angle
  // const phi = state[2]; // azimuthal angle
  const dr = state[3]; // radial velocity
  const dtheta = state[4]; // polar angular velocity
  const dphi = state[5]; // angular velocity

  const f = 1 - rs / r; // Schwarzschild Factor
  const dt = E / f; // dt/dλ from conserved energy (E=f(r)c^2 dt/dλ, with c=1)

  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const cotTheta = cosTheta / (sinTheta + 1e-10); // avoid division by zero

  // Radial acceleration
  const term1 = -(rs / (2 * r * r)) * f * dt * dt;
  const term2 = (rs / (2 * r * r * f)) * dr * dr;
  const term3 = r * f * dtheta * dtheta;
  const term4 = r * f * sinTheta ** 2 * dphi * dphi;
  const r_acc = term1 + term2 + term3 + term4;

  // 'theta' acceleration
  const theta_acc = (sinTheta * cosTheta * dphi * dphi) - (2 / r * dr * dtheta);

  // 'phi' acceleration
  const phi_acc = (-2 * cotTheta * dtheta * dphi) - (2 / r) * dr * dphi;

  return [dr, dtheta, dphi, r_acc, theta_acc, phi_acc];
}

function rk4Step(photon, stepSize) {
  // This function would compute the next position and velocity of the photon using the Runge-Kutta 4th order method.
  const rs = blackHole.rs;
  const x = photon.position.x;
  const y = photon.position.y;
  const z = photon.position.z;

  const r = Math.hypot(x, y, z);
  let theta = Math.acos(z / r);
  const phi = Math.atan2(y, x);

  // Clamp theta to avoid singularities
  const thetaEpsilon = 1e-6;
  theta = Math.max(thetaEpsilon, Math.min(Math.PI - thetaEpsilon, theta));

  const eventHorizonEpsilon = 1e-1;
  if (r <= rs + eventHorizonEpsilon) {
    console.log('Photon has crossed the event horizon.');
    photon.isDone = true;
    return;
  }

  const dr = photon.dr;
  const dtheta = photon.dtheta;
  const dphi = photon.dphi;

  const state = [r, theta, phi, dr, dtheta, dphi];

  const k1 = computeGeodesic(state, rs, photon.E);
  const state2 = state.map((v, i) => v + k1[i] * stepSize / 2);
  const k2 = computeGeodesic(state2, rs, photon.E);
  const state3 = state.map((v, i) => v + k2[i] * stepSize / 2);
  const k3 = computeGeodesic(state3, rs, photon.E);
  const state4 = state.map((v, i) => v + k3[i] * stepSize);
  const k4 = computeGeodesic(state4, rs, photon.E);

  const newState = state.map((v, i) =>
    v + (stepSize / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
  );

  const [newR, newTheta, newPhi, newDr, newDtheta, newDphi] = newState;

  // Update photon velocities
  photon.dr = newDr;
  photon.dtheta = newDtheta;
  photon.dphi = newDphi;
  // photon.t += stepSize * dt; photon's time coordinate

  // Transform back to cartesian coordinates
  const newX = newR * Math.sin(newTheta) * Math.cos(newPhi);
  const newY = newR * Math.sin(newTheta) * Math.sin(newPhi);
  const newZ = newR * Math.cos(newTheta);

  photon.move(newX, newY, newZ);
}

function addAxesHelper() {
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
}
