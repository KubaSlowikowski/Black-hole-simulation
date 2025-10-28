import * as THREE from 'three';
import { BlackHole } from './objects/blackHole';
import { Photon } from './objects/photon';
import { config } from './config';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';


function createPhoton(rs, i, N) {

  const ySpread = 10 * rs;
  const zSpread = 10 * rs;

  const x0 = 5 * rs; // Fixed x position, from the black hole
  const y0 = -ySpread / 2 + (ySpread * i) / (N - 1); // Vary y position
  const z0 = -zSpread / 2 + (zSpread * i) / (N - 1); // Vary y position

  // Convert to polar coordinates
  const r0 = Math.hypot(x0, y0, z0);
  const theta0 = Math.acos(z0 / r0);
  const phi0 = Math.atan2(y0, x0);

  // Initial direction vector: leftwards
  const dx = -1;
  const dy = -0.1;
  const dz = 0.1;

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

const gridSize = 100;
const gridDivisions = 100;
const colorCenterLine = 0xcc0000; // Red for the center line
const colorGrid = 0x333333; // Green for the grid lines
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, colorCenterLine, colorGrid);
gridHelper.rotation.x = Math.PI / 2;
scene.add(gridHelper);


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


function computeGeodesic(state, rs, E, L) {
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
  const cotTheta = cosTheta / sinTheta;

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
  // This function would compute the next position and velocity of the photon
  // using the Runge-Kutta 4th order method.

  // stepSize is the affine parameter increment (dLambda)
  const rs = blackHole.rs;
  const x = photon.position.x;
  const y = photon.position.y;
  const z = photon.position.z;

  const r = Math.hypot(x, y, z);
  const phi = Math.atan2(y, x);
  const theta = Math.acos(z / r);

  const dr = photon.dr;
  const dphi = photon.dphi;
  const dtheta = photon.dtheta;

  const epsilon = 1e-1; // we need to add this epsilon, because when 'f' in geodesic equation goes to zero, values multiplied by 1/f goes to infinity
  if (r <= rs + (2 * epsilon)) {
    console.log('Photon has crossed the event horizon and is absorbed by the black hole.');
    photon.isDone = true;
    return;
  }

  let state = [r, theta, phi, dr, dtheta, dphi];

  const k1 = computeGeodesic(state, rs, photon.E, photon.L);
  const state2 = state.map((v, i) => v + k1[i] * stepSize / 2);
  const k2 = computeGeodesic(state2, rs, photon.E, photon.L);
  const state3 = state.map((v, i) => v + k2[i] * stepSize / 2);
  const k3 = computeGeodesic(state3, rs, photon.E, photon.L);
  const state4 = state.map((v, i) => v + k3[i] * stepSize);
  const k4 = computeGeodesic(state4, rs, photon.E, photon.L);

  const newR      = r      + (stepSize / 6) * (k1[0] + 2*k2[0] + 2*k3[0] + k4[0]); // dr
  const newTheta  = theta  + (stepSize / 6) * (k1[1] + 2*k2[1] + 2*k3[1] + k4[1]); // dtheta
  const newPhi    = phi    + (stepSize / 6) * (k1[2] + 2*k2[2] + 2*k3[2] + k4[2]); // dphi

  const newDr     = dr     + (stepSize / 6) * (k1[3] + 2*k2[3] + 2*k3[3] + k4[3]); // r_acc
  const newDtheta = dtheta + (stepSize / 6) * (k1[4] + 2*k2[4] + 2*k3[4] + k4[4]); // theta_acc
  const newDphi   = dphi   + (stepSize / 6) * (k1[5] + 2*k2[5] + 2*k3[5] + k4[5]); // phi_acc

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
