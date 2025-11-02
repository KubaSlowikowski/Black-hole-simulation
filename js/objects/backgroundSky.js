import * as THREE from "three";

const image = '../../public/galaxy.jpg';

export const sky = new THREE.CubeTextureLoader().load([image, image, image, image, image, image]);
