import * as THREE from "three";

const image = '../../public/sky.png';

export const sky = new THREE.CubeTextureLoader().load([image, image, image, image, image, image]);
