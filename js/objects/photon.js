import * as THREE from 'three';
import { config } from '../config';

export const LIGHT_SPEED = 0.01;

export class Photon {

  constructor(initialPosition, dr, dphi, E, L) {
    this.position = initialPosition.clone();
    this.obj = null;

    this.line = [];

    this.dr = dr; // radial velocity
    this.dphi = dphi; // angular velocity in azimuthal direction

    this.E = E; // constant of motion: energy
    this.L = L; // constant of motion: angular momentum

    this.isDone = false;
  }

  render(scene) {
    const points = [this.position];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const line = new THREE.Line(geometry, material);

    this.obj = line;
    scene.add(line);
  }

  move(x, y) {
    this.position.set(x, y, 0);
    this.line.push(this.position.clone());

    const newGeometry = new THREE.BufferGeometry().setFromPoints(this.line);
    this.obj.geometry.dispose();
    this.obj.geometry = newGeometry;
  }

  // updatePosition() {
  //   const deltaPosition = this.direction.clone().multiplyScalar(this.speed);
  //   this.position.add(deltaPosition);
  //   this.line.push(this.position.clone());
  //
  //   const newGeometry = new THREE.BufferGeometry().setFromPoints(this.line);
  //   this.obj.geometry.dispose();
  //   this.obj.geometry = newGeometry;
  // }
}
