# Ray-traced simulation of a black hole

This project is an interactive 3D visualization of how light bends around a **non-rotating (Schwarzschild) black hole**. Under the hood it uses JavaScript with **Three.js** for 3D graphics and **GLSL** shaders to numerically solve the equations that describe photon motion in curved spacetime.

In simple terms: it's a playground where you can *see* how general relativity affects the light rays near a black hole.

<img src="/screenshots/blackhole.gif" width="500" alt="Black Hole Animation"/>

[<img src="/screenshots/1.png" width="500"/>](1.png)

[<img src="/screenshots/2.png" width="500"/>](2.png)

[<img src="/screenshots/3.png" width="500"/>](3.png)

## Overview

- You look at a black hole surrounded by a thin, glowing accretion disc and a distant starry sky.
- Light rays (photons) are not forced to go straight – their paths are bent by gravity of black hole according to general relativity.
- For every pixel on the screen, the shader calculates photon's path in curved spacetime.

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
- The mathematical model uses polar coordinates. Near the poles of the black hole, numerical errors may occur that can be noticeable during the simulation.
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
