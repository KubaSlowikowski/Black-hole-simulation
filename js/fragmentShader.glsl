precision mediump float;

#define PI 3.14159265359

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

float blackHoleDist(vec3 p) {
    return distance(p, u_blackHolePosition) - u_schwarzschildRadius;
}

float accretionDiscDist(vec3 p) {
    float outerRadius = 8.0;
    float innerRadius = 3.5;
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
    float cotTheta = cosTheta / sinTheta + 1e-10; // avoid division by zero

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

float rayTrace(Photon photon)
{
    float thetaEpsilon = 1e-6;

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
        theta = max(thetaEpsilon, min(PI - thetaEpsilon, theta));

        if (r <= u_schwarzschildRadius) {
            break; // Photon has crossed the event horizon // TODO
        }

        // geodesic equation step
        float dr = photon.dr;
        float dtheta = photon.dtheta;
        float dphi = photon.dphi;

        float[] state = float[6](r, theta, phi, dr, dtheta, dphi);

        state = geodesic(state, photon.E);

        float r_acc = state[3];
        float theta_acc = state[4];
        float phi_acc = state[5];

        // Euler integration step
        dr += r_acc * u_stepSize;
        dtheta += theta_acc * u_stepSize;
        dphi += phi_acc * u_stepSize;

        r += dr * u_stepSize;
        theta += dtheta * u_stepSize;
        phi += dphi * u_stepSize;

        photon.dr = dr;
        photon.dtheta = dtheta;
        photon.dphi = dphi;
        // photon.t += stepSize * dt; photon's time coordinate

        // Transform back to Cartesian coordinates
        float newX = r * sin(theta) * cos(phi);
        float newY = r * sin(theta) * sin(phi);
        float newZ = r * cos(theta);

        vec3 newPosition = vec3(newX, newY, newZ);
        photon.position = newPosition;

        cd = scene(photon.position); // get scene distance

        // if we have hit anything or our distance is too big, break loop
        if (cd < u_eps || d >= u_maxDis) break;

        // otherwise, add new scene distance to total distance
        d += u_stepSize;
    }

    return d; // finally, return scene distance
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

    // Convert Cartesian Direction to 3D Polar Velocities
    float dphi0 = (-dx * sin(phi0) + dy * cos(phi0) + 0.0 * dz) / (r0 * sin(theta0)); // angular velocity in azimuthal direction
    float dtheta0 = (dx * cos(theta0) * cos(phi0) + dy * cos(theta0) * sin(phi0) - dz * sin(theta0)) / r0; // angular velocity in polar direction
    float dr0_sign; // todo - simplify this to clamp(...)
    if ((dx * sin(theta0) * cos(phi0) + dy * sin(theta0) * sin(phi0) + dz * cos(theta0)) >= 0.0) {
        dr0_sign = 1.0;
    } else {
        dr0_sign = -1.0;
    }

    // Conserved quantities
    float E = 1.0; // conserved energy per unit mass (set to 1 arbitrarily)
    float L_squared = pow(r0, 4.0) * ((dtheta0 * dtheta0) + (sin(theta0) * sin(theta0) * dphi0 * dphi0)); //Square of Angular Momentum in Schwarzschild Geometry for 3D space

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

void main() {
    // Get UV from vertex shader
    vec2 uv = vUv.xy;

    // Get ray origin and direction from camera uniforms
    vec3 rayOrigin = u_camPos;
    vec3 rayDirection = (u_camInvProjMat * vec4(uv * 2. - 1., 0, 1)).xyz;
    rayDirection = (u_camToWorldMat * vec4(rayDirection, 0)).xyz;
    rayDirection = normalize(rayDirection);

    Photon photon = initializePhoton(rayOrigin, rayDirection);

    // Ray tracing and find total distance travelled
    float distanceTravelled = rayTrace(photon); // use normalized ray

    // Find the hit position
    vec3 hitPoint = rayOrigin + distanceTravelled * rayDirection;

    // Get normal of hit point
    vec3 normal = normal(hitPoint);

    if (distanceTravelled >= u_maxDis) { // if ray doesn't hit anything
                                         gl_FragColor = texture(u_backgroundCube, rayDirection);
    } else { // if ray hits something
             vec3 color = sceneCol(hitPoint);
             gl_FragColor = vec4(color, 1); // color output
    }
}
