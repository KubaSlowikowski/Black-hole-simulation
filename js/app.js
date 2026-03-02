// javascript
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import vertexShader from './shaders/vertexShader.glsl';
import fragmentShader from './shaders/fragmentShader.glsl';
import accretionDiscBloomFragmentShader from './shaders/accretionDiscBloomFragmentShader.glsl';
import mixFragmentShader from './shaders/mixFragmentShader.glsl';
import {config} from './config';
import gsap from 'gsap';
import Stats from 'three/examples/jsm/libs/stats.module';
import {BlackHole} from './objects/blackHole';
import {EffectComposer, OutputPass, RenderPass, ShaderPass, UnrealBloomPass} from 'three/addons';
import {BLOOM_PARAMS, RENDERER_PARAMS} from './postProcessingConfig';
import {BLACK_HOLE_CONFIG} from "./blackHoleConfig";

const scene = new THREE.Scene();

const resolution = config.RESOLUTION;
const camera = new THREE.PerspectiveCamera(75, resolution.width / resolution.height, 0.1, 1000);
camera.position.set(config.CAMERA.x, config.CAMERA.y, config.CAMERA.z);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(resolution.width, resolution.height);
renderer.toneMapping = RENDERER_PARAMS.toneMapping;
renderer.toneMappingExposure = RENDERER_PARAMS.toneMappingExposure;

document.body.appendChild(renderer.domElement);

// const stats = new Stats();
// document.body.appendChild(stats.dom);

const backgroundImage = '../public/sky.jpg';
const accretionDiscImage = '../public/accretionDisc.png';
const backgroundTexture = new THREE.CubeTextureLoader().load([backgroundImage, backgroundImage, backgroundImage, backgroundImage, backgroundImage, backgroundImage]);
const accretionDiscTexture = new THREE.TextureLoader().load(accretionDiscImage);
accretionDiscTexture.colorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.maxDistance = 200;
controls.minDistance = 2.5;
controls.enableDamping = true;

const blackHole = new BlackHole(config.BLACK_HOLE_MASS, new THREE.Vector3(0, 0, 0));

const uniforms = {
  u_schwarzschildRadius: { value: blackHole.rs },
  u_blackHolePosition: { value: blackHole.position },

  u_eps: { value: 0.01 },
  u_maxDis: { value: 30 * blackHole.rs },
  u_maxSteps: { value: 2500 },
  u_stepSize: { value: config.PHOTON_STEP_SIZE / 2 },

  u_accretionDisc_outerRadiusMultiplier: { value: BLACK_HOLE_CONFIG.ACCRETION_DISC.OUTER_RADIUS_MULTIPLIER },
  u_accretionDisc_innerRadiusMultiplier: { value: BLACK_HOLE_CONFIG.ACCRETION_DISC.INNER_RADIUS_MULTIPLIER },
  u_accretionDisc_thickness: { value: BLACK_HOLE_CONFIG.ACCRETION_DISC.THICKNESS },

  u_camPos: { value: new THREE.Vector3().copy(camera.position) },
  u_camToWorldMat: { value: new THREE.Matrix4().copy(camera.matrixWorld) },
  u_camInvProjMat: { value: new THREE.Matrix4().copy(camera.projectionMatrixInverse) },

  u_backgroundCube: { value: backgroundTexture }
};

const uniformsForBloomEffectOnly = {
  u_schwarzschildRadius: { value: blackHole.rs },
  u_blackHolePosition: { value: blackHole.position },

  u_eps: { value: 0.1 },
  u_maxDis: { value: 30 * blackHole.rs },
  u_maxSteps: { value: 1000 },
  u_stepSize: { value: config.PHOTON_STEP_SIZE / 2 },

  u_accretionDisc_outerRadiusMultiplier: { value: BLACK_HOLE_CONFIG.ACCRETION_DISC.OUTER_RADIUS_MULTIPLIER },
  u_accretionDisc_innerRadiusMultiplier: { value: BLACK_HOLE_CONFIG.ACCRETION_DISC.INNER_RADIUS_MULTIPLIER },
  u_accretionDisc_thickness: { value: BLACK_HOLE_CONFIG.ACCRETION_DISC.THICKNESS },

  u_camPos: { value: new THREE.Vector3().copy(camera.position) },
  u_camToWorldMat: { value: new THREE.Matrix4().copy(camera.matrixWorld) },
  u_camInvProjMat: { value: new THREE.Matrix4().copy(camera.projectionMatrixInverse) },

  u_accretionDiscTexture: { value: accretionDiscTexture },

  u_time: { value: 0.0 }
};

const geometry = new THREE.PlaneGeometry();
const material = new THREE.ShaderMaterial({
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  uniforms: uniforms
});
const rayTracePlane = new THREE.Mesh(geometry, material);

const bloomMaterial = new THREE.ShaderMaterial({
  vertexShader: vertexShader,
  fragmentShader: accretionDiscBloomFragmentShader,
  uniforms: uniformsForBloomEffectOnly
});
const bloomPlane = new THREE.Mesh(geometry, bloomMaterial);

const nearPlaneWidth = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 2;
const nearPlaneHeight = nearPlaneWidth / camera.aspect;
rayTracePlane.scale.set(nearPlaneWidth, nearPlaneHeight, 1);
bloomPlane.scale.set(nearPlaneWidth, nearPlaneHeight, 1);

// --- Bloom composer ---
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(resolution.width, resolution.height),
  BLOOM_PARAMS.strength,
  BLOOM_PARAMS.radius,
  BLOOM_PARAMS.threshold
);

// Render bloom into its own render target; we do not need a RenderPass here
const bloomRenderTarget = new THREE.WebGLRenderTarget(
  resolution.width,
  resolution.height,
  { type: THREE.HalfFloatType }
);
const bloomComposer = new EffectComposer(renderer, bloomRenderTarget);
// Scene is rendered implicitly by EffectComposer, because we will set it before render()
bloomComposer.addPass(new RenderPass(scene, camera));
bloomComposer.addPass(bloomPass);
bloomComposer.renderToScreen = false;

// --- Final composer ---
const mainRenderPass = new RenderPass(scene, camera);

const mixPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture }
    },
    vertexShader: vertexShader,
    fragmentShader: mixFragmentShader,
    defines: {}
  }),
  'baseTexture'
);
mixPass.needsSwap = true;

const outputPass = new OutputPass();

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(mainRenderPass);
finalComposer.addPass(mixPass);
finalComposer.addPass(outputPass);

const VECTOR3ZERO = new THREE.Vector3(0, 0, 0);

function updateCameraUniforms() {
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  uniforms.u_camPos.value.copy(camera.position);
  uniforms.u_camToWorldMat.value.copy(camera.matrixWorld);
  uniforms.u_camInvProjMat.value.copy(camera.projectionMatrixInverse);

  uniformsForBloomEffectOnly.u_camPos.value.copy(camera.position);
  uniformsForBloomEffectOnly.u_camToWorldMat.value.copy(camera.matrixWorld);
  uniformsForBloomEffectOnly.u_camInvProjMat.value.copy(camera.projectionMatrixInverse);
}

function renderView() {
  updateCameraUniforms();

  const cameraForwardPos = camera.position
    .clone()
    .add(camera.getWorldDirection(VECTOR3ZERO).multiplyScalar(camera.near));

  rayTracePlane.position.copy(cameraForwardPos);
  rayTracePlane.rotation.copy(camera.rotation);
  bloomPlane.position.copy(cameraForwardPos);
  bloomPlane.rotation.copy(camera.rotation);

  // 1. render bloom
  scene.clear();
  scene.add(bloomPlane);
  bloomComposer.render();

  // 2. render main with mixing
  scene.clear();
  scene.add(rayTracePlane);
  mixPass.material.uniforms.bloomTexture.value = bloomComposer.renderTarget2.texture;

  renderer.setRenderTarget(null);
  finalComposer.render();
}

function animate(time) {
  requestAnimationFrame(animate);

  controls.update();
  // stats.update();

  if (BLACK_HOLE_CONFIG.ACCRETION_DISC.ROTATION.ENABLED) {
    uniformsForBloomEffectOnly.u_time.value = BLACK_HOLE_CONFIG.ACCRETION_DISC.ROTATION.SPEED * time / 1000;
  }

  renderView();
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = resolution.width / resolution.height;
  camera.updateProjectionMatrix();

  const nearPlaneWidth = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 2;
  const nearPlaneHeight = nearPlaneWidth / camera.aspect;
  rayTracePlane.scale.set(nearPlaneWidth, nearPlaneHeight, 1);
  bloomPlane.scale.set(nearPlaneWidth, nearPlaneHeight, 1);

  renderer.setSize(resolution.width, resolution.height);
  bloomComposer.setSize(resolution.width, resolution.height);
  finalComposer.setSize(resolution.width, resolution.height);
});

const tl = gsap.timeline();
window.addEventListener('load', () => {
  controls.enabled = false;

  tl.to(controls.target, {
    x: 100,
    y: 0,
    z: 0,
    duration: 2,
    ease: 'power2.inOut'
  });

  tl.to(camera.position, {
    x: -5,
    y: 5,
    z: 14,
    duration: 6,
    ease: "sine.in"
  }, "<");  // "<" = startuj w tym samym momencie co poprzedni tween

  tl.to(controls.target, {
    x: 0,
    y: 0,
    z: 0,
    duration: 2,
    ease: 'power2.inOut'
  });

  // move away
  tl.to(camera.position, {
    x: 20,
    y: 6,
    z: 20,
    duration: 4,
    ease: "none"
  }, "<");  // "<" = startuj razem z poprzednim twenem

  // go down
  tl.to(camera.position, {
    x: 20,
    y: -3,
    z: 20,
    duration: 4,
    ease: "none"
  });

  // Obrót wokół punktu (0, 0, 0) przez 2 sekundy
  const orbitDuration = 6;
  const orbitAngle = Math.PI / 5;

  // Oblicz początkowy kąt i promień na podstawie obecnej pozycji
  const startX = 20;
  const startZ = 20;
  const startY = -3;
  const radius = Math.sqrt(startX * startX + startZ * startZ);
  const startAngle = Math.atan2(startZ, startX);

  // Animuj kąt obrotu
  const rotationData = { angle: 0 };
  tl.to(rotationData, {
    angle: orbitAngle,
    duration: orbitDuration,
    ease: "power1.inOut",
    onUpdate: () => {
      const currentAngle = startAngle + rotationData.angle;
      camera.position.x = Math.cos(currentAngle) * radius;
      camera.position.z = Math.sin(currentAngle) * radius;
      camera.position.y = startY;

      // Kamera patrzy na środek (0, 0, 0) podczas obrotu
      camera.lookAt(0, 0, 0);
    }
  });

  // tl.to(camera.position, {
  //   x: 25,
  //   y: -7.5,
  //   z: 25,
  //   duration: 6,
  //   ease: "sine.in"
  // });
  // tl.to(camera.position, {
  //   x: 0,
  //   y: 3,
  //   z: 25,
  //   duration: 6,
  //   ease: "none"
  // });
  // tl.to(camera.position, {
  //   x: -17,
  //   y: 3,
  //   z: 17,
  //   duration: 6,
  //   ease: "none"
  // });
  //
  tl.to(camera.position, {
    x: 0,
    y: 5,
    z: 3,
    duration: 15,
    ease: "power3.out"
  });

  controls.enabled= true;
});
