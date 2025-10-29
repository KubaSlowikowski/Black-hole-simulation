import * as THREE from 'three';
import { config } from '../config';

export class BlackHole {

  constructor(mass, position) {
    this.mass = mass;
    this.position = position;
    this.rs = this.calculateSchwarzschildRadius(mass);
    this.obj = null;
  }

  calculateSchwarzschildRadius() {
    const G = config.GRAVITATIONAL_CONSTANT;
    return 2 * G * this.mass / (config.LIGHT_SPEED ** 2);
  }

  render(scene) {
    const geometry = new THREE.SphereGeometry(this.rs);
    const material = new THREE.MeshBasicMaterial({
      map: new THREE.TextureLoader().load("../../public/UV_grid.png"),
    });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    this.obj = sphere;
    scene.add(sphere);
  }
}
