import * as THREE from 'three';

export class BlackHole {

  constructor(mass, position) {
    this.mass = mass;
    this.position = position;
    this.radius = this.calculateSchwarzschildRadius(mass);
    this.obj = null;
  }

  calculateSchwarzschildRadius() {
    return 1;
  }

  render(scene) {
    const geometry = new THREE.SphereGeometry(this.radius);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    this.obj = sphere;
    scene.add(sphere);
  }
}
