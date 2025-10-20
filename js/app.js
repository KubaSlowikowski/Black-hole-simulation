import * as THREE from 'three';
import { BlackHole } from './objects/blackHole';
import { Photon } from './objects/photon';
import { config } from './config';

const scene = new THREE.Scene();
addAxesHelper();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 500);
camera.position.set(0, 0, 300);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const blackHole = new BlackHole(config.BLACK_HOLE_MASS, new THREE.Vector3(0, 0, 0));
blackHole.render(scene);

const NUMBER_OF_PHOTONS = 1;
const photons = [
  new Photon(new THREE.Vector3(-100, 5, 0), new THREE.Vector3(1, 0, 0))
];
// for (let i = 0; i < NUMBER_OF_PHOTONS; i++) {
//   const photon = new Photon(new THREE.Vector3(-10, 2.5 * i + 2.5, 0), new THREE.Vector3(1, 0, 0));
//
//   photons.push(photon);
// }

photons.forEach(p => p.render(scene));

renderer.setAnimationLoop(animate);

function animate(time) {
  photons.forEach(photon => {
    if (photon.isDone) return;
    rk4Step(photon, config.PHOTON_STEP_SIZE);
  });

  renderer.render(scene, camera);
}

function computeGeodesic(state, c, rs) {
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

  console.log(x, y, r, phi, dr, dphi);

  if (r <= rs) {
    console.log('Photon has crossed the event horizon and is absorbed by the black hole.');
    photon.isDone = true;
    return;
  }

  let state = [r, phi, dr, dphi];

  console.log(r, phi, dr, dphi);

  const k1 = computeGeodesic(state, c, rs);
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
