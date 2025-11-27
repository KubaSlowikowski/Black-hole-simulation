precision mediump float;

// From vertex shader
in vec2 vUv;

// From CPU
uniform float u_schwarzschildRadius;
uniform vec3 u_blackHolePosition;

uniform samplerCube u_backgroundCube;

uniform float u_eps;
uniform float u_maxDis;
uniform int u_maxSteps;
uniform float u_stepSize;

uniform vec3 u_camPos;
uniform mat4 u_camToWorldMat;
uniform mat4 u_camInvProjMat;

uniform float u_time;

struct Photon {
    vec3 position;
    float dr;
    float dphi;
    float dtheta;
    float E;
    float L;
};

struct GeodesicStepState { float r, theta, phi, dr, dtheta, dphi; };


float blackHoleDist(vec3 p) {
    return distance(p, u_blackHolePosition) - u_schwarzschildRadius;
}

float accretionDiscDist(vec3 p) {
    float outerRadius = 5.0 * u_schwarzschildRadius;
    float innerRadius = 2.0 * u_schwarzschildRadius;
    float thickness = 0.02;

    float radialDistOuter = length(p.xz) - outerRadius;
    float radialDistInner = innerRadius - length(p.xz);

    float verticalDist = abs(p.y) - thickness;
    return max(max(radialDistOuter, verticalDist), radialDistInner);
}

float scene(vec3 p) {
    // distance to black hole
    float blackHoleDist = blackHoleDist(p);

    // distance to accretion disk
    float accretionDiscColor = accretionDiscDist(p);

    // return the minimum distance between the two spheres
    return min(blackHoleDist, accretionDiscColor);
}

float hypot(float x, float y, float z) {
    return sqrt(x * x + y * y + z * z);
}

float[6] geodesic(float[6] state, float E)
{
    float r = state[0]; // radial position
    float theta = state[1]; // polar angle
    // const phi = state[2]; // azimuthal angle
    float dr = state[3]; // radial velocity
    float dtheta = state[4]; // polar angular velocity
    float dphi = state[5]; // angular velocity

    float f = 1.0 - u_schwarzschildRadius / r;
    float dt = E / f;
    float rs = u_schwarzschildRadius;

    float sinTheta = sin(theta);
    float cosTheta = cos(theta);

    float invSinTheta = 1.0 / (sinTheta + 1e-7);
    float cotTheta = cosTheta * invSinTheta;  // avoid division by zero

    // Radial acceleration
    float term1 = -(rs / (2.0 * r * r)) * f * dt * dt;
    float term2 = (rs / (2.0 * r * r * f)) * dr * dr;
    float term3 = r * f * dtheta * dtheta;
    float term4 = r * f * sinTheta * sinTheta * dphi * dphi;
    float r_acc = term1 + term2 + term3 + term4;

    // 'theta' acceleration
    float theta_acc = (sinTheta * cosTheta * dphi * dphi) - (2.0 / r * dr * dtheta);

    // 'phi' acceleration
    float phi_acc = (-2.0 * cotTheta * dtheta * dphi) - (2.0 / r) * dr * dphi;

    return float[6](dr, dtheta, dphi, r_acc, theta_acc, phi_acc);
}

// RK4 integration step for geodesic equations
float[6] rk4Step(float[6] state, float E, float stepSize)
{
    float[6] k1 = geodesic(state, E);

    float[6] state2;
    for (int i = 0; i < 6; i++) {
        state2[i] = state[i] + k1[i] * stepSize * 0.5;
    }
    float[6] k2 = geodesic(state2, E);

    float[6] state3;
    for (int i = 0; i < 6; i++) {
        state3[i] = state[i] + k2[i] * stepSize * 0.5;
    }
    float[6] k3 = geodesic(state3, E);

    float[6] state4;
    for (int i = 0; i < 6; i++) {
        state4[i] = state[i] + k3[i] * stepSize;
    }
    float[6] k4 = geodesic(state4, E);

    float[6] newState;
    for (int i = 0; i < 6; i++) {
        newState[i] = state[i] + (stepSize / 6.0) * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
    }
    return newState;
}

struct RayTraceResult {
    Photon photon;
    float distanceTravelled;
};

RayTraceResult rayTrace(Photon photon)
{
    const float thetaEpsilon = 1e-4;
    const float PI = 3.14159265359;
    const float PI_minus_thetaEpsilon = PI - thetaEpsilon;

    float d = 0.0; // total distance travelled
    float cd; // current scene distance
    vec3 p; // current position of ray

    for (int i = 0; i < u_maxSteps; i++) // main loop
    {
        float x = photon.position.x;
        float y = photon.position.y;
        float z = photon.position.z;

        float r = hypot(x, y, z);
        float theta = acos(z / r);
        float phi = atan(y, x);

        // Clamp theta to avoid singularities
        theta = max(thetaEpsilon, min(PI_minus_thetaEpsilon, theta));

        if (r <= u_schwarzschildRadius) {
            break; // Photon has crossed the event horizon // TODO
        }

        // geodesic equation step
        float dr = photon.dr;
        float dtheta = photon.dtheta;
        float dphi = photon.dphi;

        float[] state = float[6](r, theta, phi, dr, dtheta, dphi);
//        GeodesicStepState gs = GeodesicStepState(r, theta, phi, dr, dtheta, dphi);

        // RK4 integration step
        float[6] newState = rk4Step(state, photon.E, u_stepSize);

        r = newState[0];
        theta = newState[1];
        phi = newState[2];
        dr = newState[3];
        dtheta = newState[4];
        dphi = newState[5];

        photon.dr = dr;
        photon.dtheta = dtheta;
        photon.dphi = dphi;

        float newX = r * sin(theta) * cos(phi);
        float newY = r * sin(theta) * sin(phi);
        float newZ = r * cos(theta);

        photon.position = vec3(newX, newY, newZ);

        cd = scene(photon.position); // get scene distance

        // if we have hit anything or our distance is too big, break loop
        if (cd < u_eps || d >= u_maxDis) break;

        // otherwise, add new scene distance to total distance
        d += u_stepSize;
    }

    return RayTraceResult(photon, d); // finally, return scene distance
}

vec3 sceneCol(vec3 p)
{
    float blackHoleDist = blackHoleDist(p);
    float sphere2Dis = accretionDiscDist(p);

    vec3 color1 = vec3(1, 0, 0); // Red
    vec3 blackHoleColor = vec3(0.2, 0.2, 0.2);

    // Return color based on which object is closer
    if (blackHoleDist < sphere2Dis) {
        return blackHoleColor;
    } else {
        return color1;
    }
}

vec3 normal(vec3 p) // from https://iquilezles.org/articles/normalsSDF/
{
    vec3 n = vec3(0, 0, 0);
    vec3 e;
    for (int i = 0; i < 4; i++) {
        e = 0.5773 * (2.0 * vec3((((i + 3) >> 1) & 1), ((i >> 1) & 1), (i & 1)) - 1.0);
        n += e * scene(p + e * u_eps);
    }
    return normalize(n);
}

Photon initializePhoton(vec3 rayOrigin, vec3 rayDirection) {
    Photon photon;

    // Initial position in Cartesian coordinates
    float x0 = rayOrigin.x;
    float y0 = rayOrigin.y;
    float z0 = rayOrigin.z;

    float r0 = hypot(x0, y0, z0);
    float theta0 = acos(z0 / r0);
    float phi0 = atan(y0, x0);

    // Initial direction vector (normalized)
    float dx = rayDirection.x;
    float dy = rayDirection.y;
    float dz = rayDirection.z;

    float sinTheta0 = sin(theta0);
    float cosTheta0 = cos(theta0);
    float sinPhi0 = sin(phi0);
    float cosPhi0 = cos(phi0);

    // Convert Cartesian Direction to 3D Polar Velocities
    float dphi0 = (-dx * sin(phi0) + dy * cosPhi0 + 0.0 * dz) / (r0 * sinTheta0); // angular velocity in azimuthal direction
    float dtheta0 = (dx * cosTheta0 * cosPhi0 + dy * cosTheta0 * sin(phi0) - dz * sinTheta0) / r0; // angular velocity in polar direction
    float dr0_sign = sign(dx * sinTheta0 * cosPhi0 + dy * sinTheta0 * sin(phi0) + dz * cosTheta0);

    // Conserved quantities
    float E = 1.0; // conserved energy per unit mass (set to 1 arbitrarily)
    float L_squared = r0 * r0 * r0 * r0 * ((dtheta0 * dtheta0) + (sinTheta0 * sinTheta0 * dphi0 * dphi0)); //Square of Angular Momentum in Schwarzschild Geometry for 3D space

    // Schwarzschild factor
    float f = 1.0 - u_schwarzschildRadius / r0; // gravitational redshift factor

    // Null geodesic constraint:
    // dt/dλ = E / f
    // Solve for dr0:
    float dr0 = dr0_sign * sqrt((E * E) - (L_squared * f) / (r0 * r0));

    photon.position = vec3(x0, y0, z0);
    photon.dr = dr0;
    photon.dphi = dphi0;
    photon.dtheta = dtheta0;
    photon.E = E;
    photon.L = sqrt(L_squared);

    return photon;
}

vec3 sphericalToCartesianVelocity(float r, float theta, float phi, float dr, float dtheta, float dphi)
{
    float dx = dr * sin(theta) * cos(phi)
    + r * dtheta * cos(theta) * cos(phi)
    - r * dphi * sin(theta) * sin(phi);

    float dy = dr * sin(theta) * sin(phi)
    + r * dtheta * cos(theta) * sin(phi)
    + r * dphi * sin(theta) * cos(phi);

    float dz = dr * cos(theta)
    - r * dtheta * sin(theta);

    return vec3(dx, dy, dz);
}

void main()
{
    // Get UV from vertex shader
    vec2 uv = vUv.xy;

    // Get ray origin and direction from camera uniforms
    vec3 rayOrigin = u_camPos;
    vec3 rayDirection = (u_camInvProjMat * vec4(uv * 2. - 1., 0, 1)).xyz;
    rayDirection = (u_camToWorldMat * vec4(rayDirection, 0)).xyz;
    rayDirection = normalize(rayDirection);

    Photon photon = initializePhoton(rayOrigin, rayDirection);

    // Ray tracing and find total distance travelled
    RayTraceResult result = rayTrace(photon);
    photon = result.photon;

    float x = photon.position.x;
    float y = photon.position.y;
    float z = photon.position.z;
    float r = length(vec3(x, y, z));
    float theta = acos(z / r);
    float phi = atan(y, x);

    vec3 updatedDirection = normalize(
        sphericalToCartesianVelocity(r, theta, phi, photon.dr, photon.dtheta, photon.dphi)
    );

    // Find the hit position
    vec3 hitPoint = photon.position;

    // Get normal of hit point
    vec3 normal = normal(hitPoint);

    if (result.distanceTravelled >= u_maxDis)
    { // if ray doesn't hit anything
      gl_FragColor = texture(u_backgroundCube, updatedDirection);
    } else
    { // if ray hits something
      vec3 color = sceneCol(hitPoint);
      gl_FragColor = vec4(color, 1); // color output
    }
}
