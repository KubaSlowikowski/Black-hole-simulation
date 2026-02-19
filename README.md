# Ray-traced simulation of a black hole

This project is an interactive 3D visualization of how light bends around a **non-rotating (Schwarzschild) black hole**. Under the hood it uses JavaScript with **Three.js** for 3D graphics and **GLSL** shaders to numerically solve the equations that describe photon motion in curved spacetime.

The main goal of this project is to deepen my physics knowledge by learning general relativity, and to combine it with my passion for programming.

In simple terms: it’s a playground where you can *see* how general relativity affects the light rays near a black hole.

[<img src="/screenshots/1.png" width="500"/>](1.png)

[<img src="/screenshots/2.png" width="500"/>](2.png)

[<img src="/screenshots/3.png" width="500"/>](3.png)

## Overview

- You look at a black hole surrounded by a thin, glowing accretion disc and a distant starry sky.
- Light rays (photons) are not forced to go straight – their paths are bent by gravity of black hole according to general relativity.
- For every pixel on the screen, the shader calculates photon's path in curved spacetime.

[//]: # (## Physics – in a nutshell)

[//]: # ()
[//]: # (### Spacetime background)

[//]: # ()
[//]: # (The simulation uses the model of a non‑rotating black hole: the **Schwarzschild solution**. The key number is the **Schwarzschild radius**:)

[//]: # ()
[//]: # (\[ r_s = \frac{2GM}{c^2}. \])

[//]: # ()
[//]: # (In the code, life is made easier by using so‑called geometrized units:)

[//]: # ()
[//]: # (- Gravitational constant \&#40;G = 1\&#41;)

[//]: # (- Speed of light \&#40;c = 1\&#41;)

[//]: # (- Black hole mass `BLACK_HOLE_MASS` is set in `js/config.js`)

[//]: # ()
[//]: # (With this choice the formula becomes simply)

[//]: # ()
[//]: # (\[ r_s = 2 M. \])

[//]: # ()
[//]: # (The radius is computed in `js/objects/blackHole.js` and passed to the shaders as the uniform `u_schwarzschildRadius`.)

[//]: # ()
[//]: # (### How photons move)

[//]: # ()
[//]: # (In general relativity, light follows **null geodesics** – the natural “straight” paths in curved spacetime.)

[//]: # ()
[//]: # (In this project a photon is described in spherical coordinates by)

[//]: # ()
[//]: # (- position: \&#40; &#40;r, \theta, \phi&#41; \&#41;,)

[//]: # (- and “velocities”: \&#40; &#40;\dot r, \dot\theta, \dot\phi&#41; \&#41;)

[//]: # ()
[//]: # (where the dots mean “change along the path”.)

[//]: # ()
[//]: # (Two conserved quantities for motion in the Schwarzschild geometry are used:)

[//]: # ()
[//]: # (- \&#40;E\&#41; – energy &#40;set to 1 for convenience&#41;,)

[//]: # (- \&#40;L\&#41; – magnitude of angular momentum.)

[//]: # ()
[//]: # (The shaders &#40;`js/shaders/fragmentShader.glsl` and `js/shaders/accretionDiscBloomFragmentShader.glsl`&#41; do the following for each pixel:)

[//]: # ()
[//]: # (1. Take the camera position in world space as the starting point of the photon.)

[//]: # (2. Compute the ray direction that corresponds to this pixel &#40;using camera matrices&#41; and convert it to spherical components \&#40;&#40;\dot r, \dot\theta, \dot\phi&#41;\&#41;.)

[//]: # (3. Use the null‑geodesic condition in the Schwarzschild metric to solve for the initial \&#40;\dot r\&#41;.)

[//]: # (4. Use a helper `geodesic&#40;...&#41;` to compute the accelerations \&#40;\ddot r\&#41;, \&#40;\ddot\theta\&#41;, \&#40;\ddot\phi\&#41;.)

[//]: # (5. Advance the photon using a **Runge–Kutta 4 &#40;RK4&#41;** integrator `rk4Step&#40;...&#41;`.)

[//]: # ()
[//]: # (The step size is adapted based on the distance from the black hole:)

[//]: # ()
[//]: # (- near the horizon steps are smaller &#40;strong curvature&#41;,)

[//]: # (- farther away steps grow to keep things efficient.)

[//]: # ()
[//]: # (## What’s in the scene)

[//]: # ()
[//]: # (The physical scene consists of three main elements:)

[//]: # ()
[//]: # (1. **Black hole &#40;event horizon&#41;**)

[//]: # (   - Treated as a sphere of radius `u_schwarzschildRadius` centered at `u_blackHolePosition`.)

[//]: # (   - A signed distance function `blackHoleDist&#40;...&#41;` in the shaders checks whether the photon has crossed the horizon. If it does, we stop following it.)

[//]: # ()
[//]: # (2. **Accretion disc**)

[//]: # (   - A thin disc in the equatorial plane, described by another signed distance function `accretionDiscDist&#40;...&#41;`.)

[//]: # (   - Its parameters live in `js/blackHoleConfig.js` as multiples of the Schwarzschild radius:)

[//]: # (     - `OUTER_RADIUS_MULTIPLIER`)

[//]: # (     - `INNER_RADIUS_MULTIPLIER`)

[//]: # (     - `THICKNESS`)

[//]: # (   - When a photon hits the disc, its 3D hit position is mapped to 2D texture coordinates by `uvPlanar&#40;...&#41;` and sampled from `public/accretionDisc.png`.)

[//]: # (   - The disc can optionally rotate &#40;see the `ROTATION` section in `blackHoleConfig.js`&#41;; the rotation angle is controlled by the uniform `u_time`.)

[//]: # ()
[//]: # (3. **Distant sky / background**)

[//]: # (   - Represented by a cubemap built from `public/sky.jpg` and bound as `u_backgroundCube`.)

[//]: # (   - If a photon leaves the scene without hitting the black hole or disc, the shader uses its outgoing direction to sample this background.)

[//]: # ()
[//]: # (Because everything is computed per pixel in the fragment shader, the rings and arcs you see are not drawn by hand – they are the direct result of how the null geodesics curve in the Schwarzschild spacetime.)

[//]: # ()
[//]: # (## How it’s implemented)

[//]: # ()
[//]: # (### Core rendering – `js/app.js`)

[//]: # ()
[//]: # (`app.js` wires together the graphics and the physics:)

[//]: # ()
[//]: # (- Creates a `THREE.Scene`, a `THREE.PerspectiveCamera`, and a `THREE.WebGLRenderer`.)

[//]: # (- Attaches **OrbitControls** so you can rotate and zoom the camera with the mouse.)

[//]: # (- Loads:)

[//]: # (  - `public/sky.jpg` as the background cubemap,)

[//]: # (  - `public/accretionDisc.png` as the disc texture.)

[//]: # (- Reads configuration from `js/config.js` &#40;resolution, camera position, step size, etc.&#41;.)

[//]: # (- Sets up the shader uniforms:)

[//]: # (  - camera position and matrices &#40;`u_camPos`, `u_camToWorldMat`, `u_camInvProjMat`&#41;,)

[//]: # (  - Schwarzschild radius and black hole position,)

[//]: # (  - accretion disc geometry parameters,)

[//]: # (  - background and disc textures.)

[//]: # (- Creates two full‑screen planes in front of the camera:)

[//]: # (  - one uses `fragmentShader.glsl` for the main ray‑traced image,)

[//]: # (  - the other uses `accretionDiscBloomFragmentShader.glsl` as input for the bloom effect.)

[//]: # ()
[//]: # (Each frame:)

[//]: # ()
[//]: # (- camera matrices are updated &#40;`updateCameraUniforms&#40;&#41;`&#41;,)

[//]: # (- the planes are kept just in front of the camera and aligned with its view,)

[//]: # (- the scene is rendered twice:)

[//]: # (  1. into a dedicated bloom render target,)

[//]: # (  2. as the main image that is later mixed with bloom.)

[//]: # ()
[//]: # (### Shaders)

[//]: # ()
[//]: # (- `js/shaders/vertexShader.glsl`)

[//]: # (  - Simple vertex shader that transforms the plane into clip space and passes UV coordinates to the fragment shader.)

[//]: # ()
[//]: # (- `js/shaders/fragmentShader.glsl` &#40;main view&#41;)

[//]: # (  - Reconstructs a ray from the camera through the current pixel.)

[//]: # (  - Creates an initial `Photon` state in spherical coordinates with consistent \&#40;&#40;\dot r, \dot\theta, \dot\phi&#41;\&#41; and conserved \&#40;E, L\&#41;.)

[//]: # (  - Integrates the Schwarzschild geodesic equations using RK4 with an adaptive step.)

[//]: # (  - Uses signed distance functions to test for intersections with the black hole and disc.)

[//]: # (  - Returns either)

[//]: # (    - the background cubemap color &#40;photon escapes&#41;, or)

[//]: # (    - the color of the object hit &#40;black for the shadow, disc color otherwise&#41;.)

[//]: # ()
[//]: # (- `js/shaders/accretionDiscBloomFragmentShader.glsl`)

[//]: # (  - Follows the same geodesic integration idea, but is focused only on detecting disc hits and sampling the disc texture.)

[//]: # (  - The output is used as a bright source layer for bloom.)

[//]: # ()
[//]: # (- `js/shaders/mixFragmentShader.glsl`)

[//]: # (  - Simple shader that takes the base image and the bloom texture and adds them together to get the final picture.)

[//]: # ()
[//]: # (### Post‑processing)

[//]: # ()
[//]: # (The project uses Three.js’ `EffectComposer` for post‑processing:)

[//]: # ()
[//]: # (1. **Bloom pipeline**)

[//]: # (   - Renders the disc‑only view into a render target.)

[//]: # (   - Applies an `UnrealBloomPass` with parameters from `js/postProcessingConfig.js` &#40;`BLOOM_PARAMS`&#41;.)

[//]: # ()
[//]: # (2. **Final pipeline**)

[//]: # (   - Renders the main ray‑traced view.)

[//]: # (   - Uses a custom `ShaderPass` and `mixFragmentShader.glsl` to blend in the bloom texture.)

[//]: # (   - Outputs the result with `OutputPass`.)

[//]: # ()
[//]: # (### Configuration files)

[//]: # ()
[//]: # (- `js/config.js`)

[//]: # (  - `BLACK_HOLE_MASS` &#40;in units where \&#40;G = c = 1\&#41;&#41;)

[//]: # (  - `PHOTON_STEP_SIZE` &#40;base step for integration&#41;)

[//]: # (  - `RESOLUTION` &#40;image width and height&#41;)

[//]: # (  - Initial camera position &#40;`CAMERA.x`, `CAMERA.y`, `CAMERA.z`&#41;.)

[//]: # ()
[//]: # (- `js/blackHoleConfig.js`)

[//]: # (  - Parameters controlling the accretion disc: inner and outer radius &#40;in units of \&#40;r_s\&#41;&#41;, thickness, optional rotation.)

[//]: # ()
[//]: # (- `js/objects/blackHole.js`)

[//]: # (  - Computes the Schwarzschild radius from the mass and constants.)

[//]: # (  - Can render a helper sphere at the horizon radius, textured with `public/UV_grid.png`.)

## How to run the project

### Requirements

- Node.js and npm.

### Install dependencies

From the project root (`black-hole-simulation`):

```powershell
npm install
```

### Start the development server

```powershell
npm start
```

Then open the URL printed in the console (`http://localhost:8080/`) in your browser.

## Controls

The camera is controlled with the mouse:

- **Left mouse button** – rotate the camera.
- **Right mouse button** – move the camera.
- **Mouse wheel / trackpad scroll** – zoom in and out.

Every time you move the camera, the photon paths are recomputed for the new viewpoint, so you are constantly exploring a new family of null geodesics.

## Limitations and scope

- The simulation uses a **pure Schwarzschild black hole** model:
  - no rotation,
  - no electric charge,
- The accretion disc is a simplified thin disc:
  - relativistic beaming and redshift are not modelled in detail. The disc brightness and color change is not affected.
- RK4 integration uses a finite step size, so extreme parameter choices can still lead to numerical artefacts (close to the black hole poles).
- Performance:
  - depends on resolution (`RESOLUTION` in `config.js`), the maximum number of steps, and bloom settings.
  - the goal of this project was to generate physically accurate image. The Application calculates the whole curved path for each pixel in every frame, which makes it slow. I didn't focus on optimization, so there are many possible improvements.
- If a user moves the camera to far from the black hole, the image will look weird because of ray-tracing maximum distance.

Despite these simplifications, the project already shows the key features of general relativity near a black hole: the shadow, the photon sphere, and the strong lensing of both the accretion disc and the background sky.

## Want to learn more?

If you want to connect what you see on the screen with the physics equations or simply learn more, these are good starting points.
I based my learning path on those:
- https://rantonels.github.io/starless/ - online simulator of black hole with good introduction and explanations.
- https://www.youtube.com/watch?v=8-B6ryuBkCM&t=1s - how author implemented it in C++ from scratch. Good examples on how to put physic equations into code.
- https://testtubegames.com/blackhole.html - a simple online simulator where you can see black hole neighborhood slows down time. It’s a good playground to get intuition about the effects of general relativity.
- https://oseiskar.github.io/black-hole/ - astonishing simulation of black hole with relativistic beaming and gravitational redshift. Very accurate and well optimized.
- https://arxiv.org/pdf/1502.03808 - reproduction of Interstellar black hole.

This project is meant as a bridge between abstract physics and something you can see and interact with: you can move the camera, watch how light bends and simple play with it.
