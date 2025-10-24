import * as THREE from 'three';
import { BlackHole } from './objects/blackHole';
import { Photon } from './objects/photon';
import { config } from './config';

function createPhoton(rs, i, N) {

  const angle = (2 * Math.PI * i) / N; // Direction angle

  const r0 = 10 * rs; // Initial radial position far from the black hole
  const phi0 = 0;

  // Position of emitter
  const x0 = r0 * Math.cos(phi0);
  const y0 = r0 * Math.sin(phi0);

  // Direction vector (unit)
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  // const b = 3 * Math.sqrt(3) / 2 * rs; // impact parameter, b = L/E
  // Impact parameter b = r0 * sin(angle)
  const b = r0 * Math.abs(Math.sin(angle)); // Approximation for flat-space direction

  const E = 1; // arbitrary energy scale
  const L = b * E; // angular momentum from impact parameter

  // Compute dr/dλ using null Schwarzschild geodesic equation condition
  const term1 = E * E;
  const term2 = (1 - rs / r0) * (L * L) / (r0 * r0);
  if (term1 < term2) {
    alert('Invalid photon initial conditions.');
  }
  const dr = Math.sqrt(term1 - term2); // geodesic null condition for photon (ds^2 = 0)
  // Angular velocity dφ/dλ
  const dphi = L / (r0 * r0);

  console.log(`Creating photon at (x0=${x0}, y0=${y0}) with dr=${dr}, dphi=${dphi}`);

  return new Photon(new THREE.Vector3(x0, y0, 0), dr * dx, dphi * dy);
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
for (let i = 0; i < NUMBER_OF_PHOTONS; i++) {
  const photon = createPhoton(blackHole.rs, i, NUMBER_OF_PHOTONS);
  photons.push(photon);
}

photons.forEach(p => p.render(scene));
photons.forEach(photon => {
  const c = config.LIGHT_SPEED;
  const rs = blackHole.rs;

  const x = photon.position.x;
  const y = photon.position.y;

  const r = Math.hypot(x, y);
  const phi = Math.atan2(y, x);

  const dr = photon.dr;
  const dphi = photon.dphi;

  const newR = r + dr * config.PHOTON_STEP_SIZE;
  const newPhi = phi + dphi * config.PHOTON_STEP_SIZE;

  const newX = r * Math.cos(newPhi);
  const newY = r * Math.sin(newPhi);
  console.log(`Photon position: x=${newX.toFixed(2)}, y=${newY.toFixed(2)}`);

  photon.move(newX, newY);
});
renderer.setAnimationLoop(animate);

let i = 0;

function animate(time) {
  // if (i++ > 150) {
  //   console.log('Animation stopped after 150 frames');
  //   return;
  // }
  photons.forEach(photon => {
    if (photon.isDone) return;
    rk4Step(photon, config.PHOTON_STEP_SIZE);
  });

  renderer.render(scene, camera);
}


function computeGeodesic(state, c, rs) { // compute Schwarzschild geodesic equation for 2D space with simplified assumptions (skipped time component)
  const r = state[0];
  const dr = state[2];
  const dphi = state[3];

  const r_acc = (-c * c * rs) / (2 * r * r) + r * dphi * dphi; // approximation of 'r' acceleration
  const phi_acc = -(2 / r) * dr * dphi; // 'phi' acceleration

  return [dr, dphi, r_acc, phi_acc];
}

function rk4Step(photon, stepSize) {
  // This function would compute the next position and velocity of the photon
  // using the Runge-Kutta 4th order method.

  // stepSize is the affine parameter increment (dLambda)
  const c = config.LIGHT_SPEED;
  const rs = blackHole.rs;

  const x = photon.position.x;
  const y = photon.position.y;

  const r = Math.hypot(x, y);
  const phi = Math.atan2(y, x);

  const dr = photon.dr;
  const dphi = photon.dphi;

  // console.log(x, y, r, phi, dr, dphi);

  if (r < rs) {
    console.log('Photon has crossed the event horizon and is absorbed by the black hole.');
    photon.isFinished = true;
    return;
  }

  let state = [r, phi, dr, dphi];

  const k1 = computeGeodesic(state, c, rs);
  // state[0] = state[0] + k1[0] * stepSize;
  // state[1] = state[1] + k1[1] * stepSize;
  // state[2] = state[2] + k1[2];
  // state[3] = state[3] + k1[3];
  // const newState = state;
  const state2 = state.map((v, i) => v + k1[i] * stepSize / 2);
  const k2 = computeGeodesic(state2, c, rs);
  const state3 = state.map((v, i) => v + k2[i] * stepSize / 2);
  const k3 = computeGeodesic(state3, c, rs);
  const state4 = state.map((v, i) => v + k3[i] * stepSize);
  const k4 = computeGeodesic(state4, c, rs);

  const newState = state.map(
    (v, i) => v + (stepSize / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
  );

  // Update photon velocities
  photon.dr = newState[2];
  photon.dphi = newState[3];

  console.log(`Photon velocities: dr=${photon.dr.toFixed(4)}, dphi=${photon.dphi.toFixed(4)}`);

  // Update polar coordinates
  const newR = newState[0];
  const newPhi = newState[1];

  // Transform back to cartesian coordinates
  const newX = newR * Math.cos(newPhi);
  const newY = newR * Math.sin(newPhi);
  console.log(`Photon position: x=${newX.toFixed(2)}, y=${newY.toFixed(2)}`);

  photon.move(newX, newY);
}


function addAxesHelper() {
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
}
