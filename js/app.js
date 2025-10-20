import * as THREE from 'three';
import { BlackHole } from './objects/blackHole';
import { Photon } from './objects/photon';
import { config } from './config';

const scene = new THREE.Scene();
addAxesHelper();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 500);
camera.position.set(0, 0, 150);
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

    const dLambda = 0.001; // step size
    const c = config.LIGHT_SPEED;
    const rs = blackHole.rs;

    // cartesian coordinates
    const x = photon.position.x;
    const y = photon.position.y;

    // polar coordinates
    const r = Math.hypot(x, y);
    const phi = Math.atan2(y, x);

    if (r <= rs) {
      console.log('Photon has crossed the event horizon and is absorbed by the black hole.');
      photon.isDone = true;
      return;
    }

    const dr_2 = ((-c * c * rs) / 2 * r * r) + (r * photon.dphi * photon.dphi); // approximation of r acceleration
    const dphi_2 = -(2 / r) * photon.dr * photon.dphi; // phi acceleration
    console.log(`photon accelerations: dr_2=${dr_2}, dphi_2=${dphi_2}`);

    photon.dr += dr_2 * dLambda;
    photon.dphi += dphi_2 * dLambda;
    console.log(`photon velocities: dr=${photon.dr}, dphi=${photon.dphi}`);

    const newR = r + photon.dr * dLambda; // Euler integration
    const newPhi = phi + photon.dphi * dLambda;
    console.log(`photon new polar position: r=${newR}, phi=${newPhi}`);

    const newX = newR * Math.cos(newPhi);
    const newY = newR * Math.sin(newPhi);
    console.log(`photon new cartesian position: x=${newX}, y=${newY}`);

    photon.move(newX, newY);
  });

  renderer.render(scene, camera);
}

function addAxesHelper() {
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
}
