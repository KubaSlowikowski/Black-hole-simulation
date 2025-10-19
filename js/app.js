import * as THREE from 'three';
import { BlackHole } from './objects/blackHole';
import { Photon } from './objects/photon';

const scene = new THREE.Scene();
addAxesHelper();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 500);
camera.position.set(0, 0, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const blackHole = new BlackHole(1, new THREE.Vector3(0, 0, 0));
blackHole.render(scene);

const NUMBER_OF_PHOTONS = 1;
const photons = [];
for (let i = 0; i < NUMBER_OF_PHOTONS; i++) {
  const photon = new Photon(new THREE.Vector3(-10, 2.5 * i + 2.5, 0), new THREE.Vector3(1, 0, 0));

  photons.push(photon);
}

photons.forEach(p => p.render(scene));

renderer.setAnimationLoop(animate);

function animate(time) {
  photons.forEach(photon => {
    const x = photon.position.x;
    const y = photon.position.y;

    // polar coordinates
    const r = Math.hypot(x,y);
    const phi = Math.atan2(y, x);

    const vr = 0.5;
    const vphi = 0.05;

    



    const dr = 0.03;
    const dphi = 0.005;

    const newR = r + dr;
    const newPhi = phi + dphi;

    const newX = newR * Math.cos(newPhi);
    const newY = newR * Math.sin(newPhi);

    photon.move(newX, newY);
  });

  renderer.render(scene, camera);
}

function addAxesHelper() {
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
}
