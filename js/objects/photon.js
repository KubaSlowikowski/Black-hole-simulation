import * as THREE from 'three';

export const LIGHT_SPEED = 0.01;

export class Photon {

  constructor(initialPosition, initialDirection) {
    this.position = initialPosition.clone();
    this.direction = initialDirection.clone().normalize();
    this.speed = LIGHT_SPEED;
    this.obj = null;

    this.line = [];
  }

  render(scene) {
    const points = [this.position];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const line = new THREE.Line(geometry, material);

    this.obj = line;
    scene.add(line);
  }

  move(x,y) {
    this.position.set(x,y,0);
    this.line.push(this.position.clone());

    const newGeometry = new THREE.BufferGeometry().setFromPoints(this.line);
    this.obj.geometry.dispose();
    this.obj.geometry = newGeometry;
  }

  updatePosition() {
    const deltaPosition = this.direction.clone().multiplyScalar(this.speed);
    this.position.add(deltaPosition);
    this.line.push(this.position.clone());

    const newGeometry = new THREE.BufferGeometry().setFromPoints(this.line);
    this.obj.geometry.dispose();
    this.obj.geometry = newGeometry;
  }
}
