import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import vertexShader from './vertexShader.glsl';
import fragmentShader from './fragmentShader.glsl';
import { config } from './config';
import Stats from 'three/examples/jsm/libs/stats.module';
import { BlackHole } from './objects/blackHole';
import { EffectComposer, RenderPass, UnrealBloomPass } from 'three/addons';


// Create a scene
const scene = new THREE.Scene();

// Create a camera
const resolution = {
  width: 800, // window.innerWidth
  height: 500 // window.innerHeight
};
const camera = new THREE.PerspectiveCamera(75, resolution.width / resolution.height, 0.1, 1000);
camera.position.set(config.CAMERA.x, config.CAMERA.y, config.CAMERA.z);

// Create a renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(resolution.width, resolution.height);
document.body.appendChild(renderer.domElement);

const stats = new Stats();
document.body.appendChild(stats.dom);

// Set background color
const image = '../public/galaxy.jpg';
const backgroundTexture = new THREE.CubeTextureLoader().load([image, image, image, image, image, image]);

// Add orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxDistance = 200;
controls.minDistance = 2.5;
controls.enableDamping = true;

const blackHole = new BlackHole(config.BLACK_HOLE_MASS, new THREE.Vector3(0, 0, 0));

// Define uniforms
const uniforms = {
  u_backgroundCube: { value: backgroundTexture },
  u_schwarzschildRadius: { value: blackHole.rs },
  u_blackHolePosition: { value: blackHole.position },

  u_eps: { value: 0.01 },
  u_maxDis: { value: 30 * blackHole.rs }, // todo - we should adjust this based on camera distance from black hole. Otherwise, black hole will disappear when camera is too far
  u_maxSteps: { value: 1000 },
  u_stepSize: { value: config.PHOTON_STEP_SIZE },

  u_camPos: { value: camera.position },
  u_camToWorldMat: { value: camera.matrixWorld },
  u_camInvProjMat: { value: camera.projectionMatrixInverse },

  u_time: { value: 0 }
};

// Create a ray marching plane
const geometry = new THREE.PlaneGeometry();
const material = new THREE.ShaderMaterial({
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  uniforms: uniforms
});
const rayTracePlane = new THREE.Mesh(geometry, material);

// Get the width and height of the near plane
const nearPlaneWidth = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 2;
const nearPlaneHeight = nearPlaneWidth / camera.aspect;

// Scale the ray marching plane
rayTracePlane.scale.set(nearPlaneWidth, nearPlaneHeight, 1);

// Add plane to scene
scene.add(rayTracePlane);

// Set up bloom postprocessing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(resolution.width, resolution.height),
  1.5, // strength
  0.4, // radius
  0.85 // threshold
);
bloomPass.threshold = 0.2;
bloomPass.strength = 1.5;
bloomPass.radius = 0.4;
composer.addPass(bloomPass);

// Needed inside update function
let cameraForwardPos = new THREE.Vector3(0, 0, -1);
const VECTOR3ZERO = new THREE.Vector3(0, 0, 0);

let time = Date.now();

// Render the scene
const animate = () => {
  requestAnimationFrame(animate);

  // Update screen plane position and rotation
  cameraForwardPos = camera.position.clone().add(camera.getWorldDirection(VECTOR3ZERO).multiplyScalar(camera.near));
  rayTracePlane.position.copy(cameraForwardPos);
  rayTracePlane.rotation.copy(camera.rotation);

  // renderer.render(scene, camera);

  composer.render();

  uniforms.u_time.value = (Date.now() - time) / 1000;

  controls.update();
  stats.update();
};
animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = resolution.width / resolution.height;
  camera.updateProjectionMatrix();

  const nearPlaneWidth = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 2;
  const nearPlaneHeight = nearPlaneWidth / camera.aspect;
  rayTracePlane.scale.set(nearPlaneWidth, nearPlaneHeight, 1);

  if (renderer) renderer.setSize(resolution.width, resolution.height);
  // composer.setSize(resolution.width, resolution.height);
  // bloomPass.setSize(resolution.width, resolution.height);
});
