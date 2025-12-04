import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import vertexShader from './vertexShader.glsl';
import fragmentShader from './fragmentShader.glsl';
import accretionDiscBloomFragmentShader from './accretionDiscBloomFragmentShader.glsl';
import mixFragmentShader from './mixFragmentShader.glsl';
import { config } from './config';
import Stats from 'three/examples/jsm/libs/stats.module';
import { BlackHole } from './objects/blackHole';
import { EffectComposer, OutputPass, RenderPass, ShaderPass, UnrealBloomPass } from 'three/addons';
import { BLOOM_PARAMS, RENDERER_PARAMS } from './postProcessingConfig';

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
renderer.toneMapping = RENDERER_PARAMS.toneMapping;
renderer.toneMappingExposure = RENDERER_PARAMS.toneMappingExposure;
// renderer.outputEncoding = RENDERER_PARAMS.outputEncoding;
renderer.setAnimationLoop(animate);
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

const uniformsForBloomEffectOnly = {
  u_schwarzschildRadius: { value: blackHole.rs },
  u_blackHolePosition: { value: blackHole.position },

  u_eps: { value: 0.1 },
  u_maxDis: { value: 30 * blackHole.rs }, // todo - we should adjust this based on camera distance from black hole. Otherwise, black hole will disappear when camera is too far
  u_maxSteps: { value: 500 },
  u_stepSize: { value: config.PHOTON_STEP_SIZE * 2 },

  u_camPos: { value: camera.position },
  u_camToWorldMat: { value: camera.matrixWorld },
  u_camInvProjMat: { value: camera.projectionMatrixInverse },
};

// Create a ray marching plane
const geometry = new THREE.PlaneGeometry();
const material = new THREE.ShaderMaterial({
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  uniforms: uniforms
});
const rayTracePlane = new THREE.Mesh(geometry, material);

// Mask material for bloom effect of accretion disc
const bloomMaterial = new THREE.ShaderMaterial({
  vertexShader: vertexShader,
  fragmentShader: accretionDiscBloomFragmentShader,
  uniforms: uniformsForBloomEffectOnly
});
const bloomPlane = new THREE.Mesh(geometry, bloomMaterial);

// Get the width and height of the near plane
const nearPlaneWidth = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 2;
const nearPlaneHeight = nearPlaneWidth / camera.aspect;

// Scale the ray tracing plane
rayTracePlane.scale.set(nearPlaneWidth, nearPlaneHeight, 1);
bloomPlane.scale.set(nearPlaneWidth, nearPlaneHeight, 1);

// Set up bloom postprocessing
const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(resolution.width, resolution.height),
  BLOOM_PARAMS.strength, // strength
  BLOOM_PARAMS.radius, // radius
  BLOOM_PARAMS.threshold // threshold
);

const bloomRenderTarget = new THREE.WebGLRenderTarget( resolution.width, resolution.height, { type: THREE.HalfFloatType } );
const bloomComposer = new EffectComposer(renderer, bloomRenderTarget);
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);
bloomComposer.renderToScreen = false;

const mixPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null }, // contains original textures of the bloomed objects
      bloomTexture: { value: bloomComposer.renderTarget2.texture } // contains object textures after bloom effect is applied to them
    },
    vertexShader: vertexShader,
    fragmentShader: mixFragmentShader,
    defines: {}
  }), 'baseTexture'
);
mixPass.needsSwap = true;

const outputPass = new OutputPass();

const finalRenderTarget = new THREE.WebGLRenderTarget( resolution.width, resolution.height, { type: THREE.HalfFloatType, samples: 4 } );
const finalComposer = new EffectComposer(renderer, finalRenderTarget);
finalComposer.addPass(renderScene);
finalComposer.addPass(mixPass);
finalComposer.addPass(outputPass);

// Needed inside update function
const VECTOR3ZERO = new THREE.Vector3(0, 0, 0);

renderView();

function renderView() {
  let cameraForwardPos = camera.position.clone().add(camera.getWorldDirection(VECTOR3ZERO).multiplyScalar(camera.near));
  rayTracePlane.position.copy(cameraForwardPos);
  rayTracePlane.rotation.copy(camera.rotation);
  bloomPlane.position.copy(cameraForwardPos);
  bloomPlane.rotation.copy(camera.rotation);

  // --- 1. Render bloomPlane to bloomComposer ---
  // Only bloomPlane in scene
  scene.clear();
  scene.add(bloomPlane);
  bloomComposer.render();

  // --- 2. Render rayTracePlane to mainComposer ---
  scene.clear();
  scene.add(rayTracePlane);
  renderer.setRenderTarget(finalRenderTarget);
  renderer.clear();
  renderer.render(scene, camera);

  // --- 3. Mix both textures and display ---
  mixPass.material.uniforms.baseTexture.value = finalRenderTarget.texture;
  mixPass.material.uniforms.bloomTexture.value = bloomComposer.renderTarget2.texture;

  renderer.setRenderTarget(null); // Render to screen
  finalComposer.render();

  controls.update();
  stats.update();
}

// Render the scene
function animate() {
  requestAnimationFrame(animate);

  // Update screen plane position and rotation
  controls.update();
  stats.update();
};

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = resolution.width / resolution.height;
  camera.updateProjectionMatrix();

  const nearPlaneWidth = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 2;
  const nearPlaneHeight = nearPlaneWidth / camera.aspect;
  rayTracePlane.scale.set(nearPlaneWidth, nearPlaneHeight, 1);

  if (renderer) renderer.setSize(resolution.width, resolution.height);
  if (bloomComposer) bloomComposer.setSize(resolution.width, resolution.height);
  if (finalComposer) finalComposer.setSize(resolution.width, resolution.height);
});
