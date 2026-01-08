precision mediump float;

// From vertex shader
in vec2 vUv;

// From CPU
uniform float u_schwarzschildRadius;
uniform vec3 u_blackHolePosition;

uniform float u_eps;
uniform float u_maxDis;
uniform int u_maxSteps;
uniform float u_stepSize;

uniform vec3 u_camPos;
uniform mat4 u_camToWorldMat;
uniform mat4 u_camInvProjMat;

struct Photon {
    vec3 position;
    float dr;
    float dphi;
    float dtheta;
    float E;
    float L;
};

struct GeodesicStepState {
    float r; // radial position
    float theta; // polar angle
    float phi; // azimuthal angle
    float dr; // radial velocity
    float dtheta; // polar angular velocity
    float dphi; // angular velocity
};

float blackHoleDist(vec3 p) {
    return distance(p, u_blackHolePosition) - u_schwarzschildRadius;
}

float accretionDiscDist(vec3 p) {
    float outerRadius = 7.0 * u_schwarzschildRadius;
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

GeodesicStepState geodesic(GeodesicStepState state, float E)
{
    float f = 1.0 - u_schwarzschildRadius / state.r;
    float dt = E / f;
    float rs = u_schwarzschildRadius;

    float sinTheta = sin(state.theta);
    float cosTheta = cos(state.theta);

    float invSinTheta = 1.0 / (sinTheta + 1e-7);
    float cotTheta = cosTheta * invSinTheta;  // avoid division by zero

    // Radial acceleration
    float term1 = -(rs / (2.0 * state.r * state.r)) * f * dt * dt;
    float term2 = (rs / (2.0 * state.r * state.r * f)) * state.dr * state.dr;
    float term3 = state.r * f * state.dtheta * state.dtheta;
    float term4 = state.r * f * sinTheta * sinTheta * state.dphi * state.dphi;
    float r_acc = term1 + term2 + term3 + term4;

    // 'theta' acceleration
    float theta_acc = (sinTheta * cosTheta * state.dphi * state.dphi) - (2.0 / state.r * state.dr * state.dtheta);

    // 'phi' acceleration
    float phi_acc = (-2.0 * cotTheta * state.dtheta * state.dphi) - (2.0 / state.r) * state.dr * state.dphi;

    return GeodesicStepState(state.dr, state.dtheta, state.dphi, r_acc, theta_acc, phi_acc);
}

// RK4 integration step for geodesic equations
GeodesicStepState rk4Step(GeodesicStepState state, float E, float stepSize)
{
    GeodesicStepState k1 = geodesic(state, E);
    float halfStepSize = stepSize * 0.5;

    GeodesicStepState state2;
    state2.r = state.r + k1.r * halfStepSize;
    state2.theta = state.theta + k1.theta * halfStepSize;
    state2.phi = state.phi + k1.phi * halfStepSize;
    state2.dr = state.dr + k1.dr * halfStepSize;
    state2.dtheta = state.dtheta + k1.dtheta * halfStepSize;
    state2.dphi = state.dphi + k1.dphi * halfStepSize;

    GeodesicStepState k2 = geodesic(state2, E);

    GeodesicStepState state3;
    state3.r = state.r + k2.r * halfStepSize;
    state3.theta = state.theta + k2.theta * halfStepSize;
    state3.phi = state.phi + k2.phi * halfStepSize;
    state3.dr = state.dr + k2.dr * halfStepSize;
    state3.dtheta = state.dtheta + k2.dtheta * halfStepSize;
    state3.dphi = state.dphi + k2.dphi * halfStepSize;

    GeodesicStepState k3 = geodesic(state3, E);

    GeodesicStepState state4;
    state4.r = state.r + k3.r * stepSize;
    state4.theta = state.theta + k3.theta * stepSize;
    state4.phi = state.phi + k3.phi * stepSize;
    state4.dr = state.dr + k3.dr * stepSize;
    state4.dtheta = state.dtheta + k3.dtheta * stepSize;
    state4.dphi = state.dphi + k3.dphi * stepSize;

    GeodesicStepState k4 = geodesic(state4, E);

    GeodesicStepState newState;
    float stepSizeOver6 = stepSize / 6.0;
    newState.r = state.r + stepSizeOver6 * (k1.r + 2.0 * k2.r + 2.0 * k3.r + k4.r);
    newState.theta = state.theta + stepSizeOver6 * (k1.theta + 2.0 * k2.theta + 2.0 * k3.theta + k4.theta);
    newState.phi = state.phi + stepSizeOver6 * (k1.phi + 2.0 * k2.phi + 2.0 * k3.phi + k4.phi);
    newState.dr = state.dr + stepSizeOver6 * (k1.dr + 2.0 * k2.dr + 2.0 * k3.dr + k4.dr);
    newState.dtheta = state.dtheta + stepSizeOver6 * (k1.dtheta + 2.0 * k2.dtheta + 2.0 * k3.dtheta + k4.dtheta);
    newState.dphi = state.dphi + stepSizeOver6 * (k1.dphi + 2.0 * k2.dphi + 2.0 * k3.dphi + k4.dphi);

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

        float r = length(vec3(x, y, z));
        float theta = acos(z / r);
        float phi = atan(y, x);

        // Clamp theta to avoid singularities
        theta = max(thetaEpsilon, min(PI_minus_thetaEpsilon, theta));

        if (r <= u_schwarzschildRadius) {
            break; // Photon has crossed the event horizon
        }

        // geodesic equation step
        float dr = photon.dr;
        float dtheta = photon.dtheta;
        float dphi = photon.dphi;

        GeodesicStepState state = GeodesicStepState(r, theta, phi, dr, dtheta, dphi);

        // Compute adaptive step size based on distance from black hole
        float minStep = u_stepSize * 0.5; // smaller near black hole
        float maxStep = u_stepSize * 3.0;  // larger far away
        float farRadius = 10.0 * u_schwarzschildRadius;
        float adaptiveStep = mix(minStep, maxStep, smoothstep(u_schwarzschildRadius, farRadius, r)); // todo - now we only adapt based on distance from black hole center. We should also consider distance from accretion disk - use SDF for blackhole+sphere combined.

        // RK4 integration step
        GeodesicStepState newState = rk4Step(state, photon.E, adaptiveStep);

        r = newState.r;
        theta = newState.theta;
        phi = newState.phi;
        dr = newState.dr;
        dtheta = newState.dtheta;
        dphi = newState.dphi;

        photon.dr = dr;
        photon.dtheta = dtheta;
        photon.dphi = dphi;

        float sinTheta = sin(theta);
        float newX = r * sinTheta * cos(phi);
        float newY = r * sinTheta * sin(phi);
        float newZ = r * cos(theta);

        photon.position = vec3(newX, newY, newZ);

        cd = accretionDiscDist(photon.position);

        // if we have hit anything or our distance is too big, break loop
        if (cd < u_eps || d >= u_maxDis) break;

        // otherwise, add new scene distance to total distance
        d += adaptiveStep;
    }

    return RayTraceResult(photon, d); // finally, return scene distance
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

    float r0 = length(vec3(x0, y0, z0));
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
    vec3 finalColor = vec3(0.0);
    if (result.distanceTravelled < u_maxDis) { // TODO - we can optimize maxDistance for accretion disc since it is relatively close to black hole
        float d = accretionDiscDist(result.photon.position);
        if (d < u_eps) {
            finalColor = vec3(0.0, 0.0, 0.0); // hit accretion disc. We can easily add nice looking texture here
//            finalColor = vec3(1.0,1.0,1.0); // hit accretion disc. We can easily add nice looking texture here
        }
    }

    gl_FragColor = vec4(finalColor, 1.0);
}
