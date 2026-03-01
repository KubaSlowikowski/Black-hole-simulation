precision mediump float;

// From vertex shader
in vec2 vUv;

// From CPU
uniform float u_schwarzschildRadius;
uniform vec3  u_blackHolePosition;
uniform float u_accretionDisc_outerRadiusMultiplier;
uniform float u_accretionDisc_innerRadiusMultiplier;
uniform float u_accretionDisc_thickness;
uniform sampler2D u_accretionDiscTexture;
uniform float u_eps;
uniform float u_maxDis;
uniform int   u_maxSteps;
uniform float u_stepSize;
uniform vec3  u_camPos;
uniform mat4  u_camToWorldMat;
uniform mat4  u_camInvProjMat;
uniform float u_time;

struct Photon {
    vec3  position;
    float dr;
    float dphi;
    float dtheta;
    float E;
    float L;
};

struct GeodesicStepState {
    float r;      // radial position
    float theta;  // polar angle (from +z)
    float phi;    // azimuth (around z)
    float dr;     // radial velocity
    float dtheta; // polar angular velocity
    float dphi;   // azimuthal angular velocity
};

float sdfBlackHole(vec3 p) {
    return distance(p, u_blackHolePosition) - u_schwarzschildRadius;
}

float sdfAccretionDisc(vec3 p) {
    float outerRadius = u_accretionDisc_outerRadiusMultiplier * u_schwarzschildRadius;
    float innerRadius = u_accretionDisc_innerRadiusMultiplier * u_schwarzschildRadius;
    float thickness   = u_accretionDisc_thickness;

    float radialDistOuter = length(p.xz) - outerRadius; // disc lies in y=0 plane
    float radialDistInner = innerRadius - length(p.xz);
    float verticalDist    = abs(p.y) - thickness;

    return max(max(radialDistOuter, verticalDist), radialDistInner);
}

float scene(vec3 p) {
    // Distance to objects in the scene; avoid name shadowing
    float bhDist  = sdfBlackHole(p);
    float discDist = sdfAccretionDisc(p);
    return min(bhDist, discDist);
}

GeodesicStepState geodesic(GeodesicStepState state, float E) {
    float rs = u_schwarzschildRadius;
    float f  = 1.0 - rs / state.r;
    float dt = E / f;

    float sinTheta = sin(state.theta);
    float cosTheta = cos(state.theta);
    float invSinTheta = 1.0 / (sinTheta + 1e-7);
    float cotTheta = cosTheta * invSinTheta;

    // Radial acceleration
    float term1 = -(rs / (2.0 * state.r * state.r)) * f * dt * dt;
    float term2 =  (rs / (2.0 * state.r * state.r * f)) * state.dr * state.dr;
    float term3 =   state.r * f * state.dtheta * state.dtheta;
    float term4 =   state.r * f * sinTheta * sinTheta * state.dphi * state.dphi;
    float r_acc = term1 + term2 + term3 + term4;

    // Polar acceleration
    float theta_acc = (sinTheta * cosTheta * state.dphi * state.dphi) - (2.0 / state.r * state.dr * state.dtheta);

    // Azimuthal acceleration
    float phi_acc = (-2.0 * cotTheta * state.dtheta * state.dphi) - (2.0 / state.r) * state.dr * state.dphi;

    return GeodesicStepState(state.dr, state.dtheta, state.dphi, r_acc, theta_acc, phi_acc);
}

// RK4 integration step for geodesic equations
GeodesicStepState rk4Step(GeodesicStepState state, float E, float stepSize) {
    GeodesicStepState k1 = geodesic(state, E);

    float halfStepSize = stepSize * 0.5;

    GeodesicStepState s2;
    s2.r      = state.r      + k1.r      * halfStepSize;
    s2.theta  = state.theta  + k1.theta  * halfStepSize;
    s2.phi    = state.phi    + k1.phi    * halfStepSize;
    s2.dr     = state.dr     + k1.dr     * halfStepSize;
    s2.dtheta = state.dtheta + k1.dtheta * halfStepSize;
    s2.dphi   = state.dphi   + k1.dphi   * halfStepSize;
    GeodesicStepState k2 = geodesic(s2, E);

    GeodesicStepState s3;
    s3.r      = state.r      + k2.r      * halfStepSize;
    s3.theta  = state.theta  + k2.theta  * halfStepSize;
    s3.phi    = state.phi    + k2.phi    * halfStepSize;
    s3.dr     = state.dr     + k2.dr     * halfStepSize;
    s3.dtheta = state.dtheta + k2.dtheta * halfStepSize;
    s3.dphi   = state.dphi   + k2.dphi   * halfStepSize;
    GeodesicStepState k3 = geodesic(s3, E);

    GeodesicStepState s4;
    s4.r      = state.r      + k3.r      * stepSize;
    s4.theta  = state.theta  + k3.theta  * stepSize;
    s4.phi    = state.phi    + k3.phi    * stepSize;
    s4.dr     = state.dr     + k3.dr     * stepSize;
    s4.dtheta = state.dtheta + k3.dtheta * stepSize;
    s4.dphi   = state.dphi   + k3.dphi   * stepSize;
    GeodesicStepState k4 = geodesic(s4, E);

    GeodesicStepState ns;
    float w = stepSize / 6.0;
    ns.r      = state.r      + w * (k1.r      + 2.0 * k2.r      + 2.0 * k3.r      + k4.r);
    ns.theta  = state.theta  + w * (k1.theta  + 2.0 * k2.theta  + 2.0 * k3.theta  + k4.theta);
    ns.phi    = state.phi    + w * (k1.phi    + 2.0 * k2.phi    + 2.0 * k3.phi    + k4.phi);
    ns.dr     = state.dr     + w * (k1.dr     + 2.0 * k2.dr     + 2.0 * k3.dr     + k4.dr);
    ns.dtheta = state.dtheta + w * (k1.dtheta + 2.0 * k2.dtheta + 2.0 * k3.dtheta + k4.dtheta);
    ns.dphi   = state.dphi   + w * (k1.dphi   + 2.0 * k2.dphi   + 2.0 * k3.dphi   + k4.dphi);
    return ns;
}

struct RayTraceResult {
    Photon photon;
    float  distanceTravelled;
};

RayTraceResult rayTrace(Photon photon) {
    const float thetaEpsilon = 1e-4;
    const float PI = 3.14159265359;
    const float PI_minus_thetaEpsilon = PI - thetaEpsilon;

    float d = 0.0; // total affine "distance"
    float cd;
    for (int i = 0; i < u_maxSteps; i++) {
        float x = photon.position.x;
        float y = photon.position.y;
        float z = photon.position.z;

        float r     = length(vec3(x, y, z));
        float theta = acos(z / r);
        float phi   = atan(y, x);

        // Clamp theta to avoid singularities
        theta = max(thetaEpsilon, min(PI_minus_thetaEpsilon, theta));

        if (r <= u_schwarzschildRadius) {
            break; // photon crossed the event horizon
        }

        // Adaptive step-size (tighter near BH)
        float minStep = u_stepSize * 0.5;
        float maxStep = u_stepSize * 3.0;
        float farRadius = 10.0 * u_schwarzschildRadius;
        float adaptiveStep = mix(minStep, maxStep, smoothstep(u_schwarzschildRadius, farRadius, r));

        // RK4 integration step
        GeodesicStepState state = GeodesicStepState(r, theta, phi, photon.dr, photon.dtheta, photon.dphi);
        GeodesicStepState newState = rk4Step(state, photon.E, adaptiveStep);

        // Update photon phase-space vars
        r          = newState.r;
        theta      = newState.theta;
        phi        = newState.phi;
        photon.dr     = newState.dr;
        photon.dtheta = newState.dtheta;
        photon.dphi   = newState.dphi;

        float sinTheta = sin(theta);
        float newX = r * sinTheta * cos(phi);
        float newY = r * sinTheta * sin(phi);
        float newZ = r * cos(theta);
        photon.position = vec3(newX, newY, newZ);

        cd = sdfAccretionDisc(photon.position);

        // hit or exceeded max distance?
        if (cd < u_eps || d >= u_maxDis) break;

        d += adaptiveStep;
    }
    return RayTraceResult(photon, d);
}

vec3 normal(vec3 p) { // from https://iquilezles.org/articles/normalsSDF/
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

    // Initial position
    float x0 = rayOrigin.x;
    float y0 = rayOrigin.y;
    float z0 = rayOrigin.z;

    float r0     = length(vec3(x0, y0, z0));
    float theta0 = acos(z0 / r0);
    float phi0   = atan(y0, x0);

    // Direction (normalized)
    float dx = rayDirection.x;
    float dy = rayDirection.y;
    float dz = rayDirection.z;

    float sinTheta0 = sin(theta0);
    float cosTheta0 = cos(theta0);
    float sinPhi0   = sin(phi0);
    float cosPhi0   = cos(phi0);

    // Convert Cartesian direction to spherical directional derivatives
    float dphi0   = (-dx * sinPhi0 + dy * cosPhi0 + 0.0 * dz) / (r0 * sinTheta0);
    float dtheta0 = ( dx * cosTheta0 * cosPhi0 + dy * cosTheta0 * sinPhi0 - dz * sinTheta0) / r0;

    float dr0_sign = sign(dx * sinTheta0 * cosPhi0 + dy * sinTheta0 * sinPhi0 + dz * cosTheta0);

    // Conserved quantities for null geodesics
    float E = 1.0; // set arbitrarily; only ratios matter
    float L2 = r0*r0*r0*r0 * (dtheta0*dtheta0 + (sinTheta0*sinTheta0 * dphi0*dphi0));

    float f = 1.0 - u_schwarzschildRadius / r0;
    float dr0 = dr0_sign * sqrt(max( (E*E) - (L2 * f)/(r0*r0), 0.0 ));

    photon.position = vec3(x0, y0, z0);
    photon.dr       = dr0;
    photon.dphi     = dphi0;
    photon.dtheta   = dtheta0;
    photon.E        = E;
    photon.L        = sqrt(max(L2, 0.0));
    return photon;
}

/** Keplerian angular frequency in Schwarzschild (Schwarzschild units with rs = 2M) */
float omegaKepler(float r, float rs) {
    // Omega = sqrt(M / r^3) = sqrt(rs / (2 r^3))
    return sqrt(max(rs, 0.0) / (2.0 * r * r * r + 1e-30));
}

/** Build spherical orthonormal basis (around z-axis) in Cartesian coordinates */
void sphericalBasis(float theta, float phi,
out vec3 e_r, out vec3 e_theta, out vec3 e_phi)
{
    float st = sin(theta), ct = cos(theta);
    float sp = sin(phi),   cp = cos(phi);
    e_r     = vec3(st*cp, st*sp, ct);
    e_theta = vec3(ct*cp, ct*sp, -st);
    e_phi   = vec3(-sp,   cp,    0.0);
}

/** Compute redshift g = sqrt(f)/(gamma*(1 - v · n))
    - v : emitter 3-velocity in static orthonormal frame
    - n : photon direction in same frame (unit) */
float redshiftFactor_g_general(vec3 P,
                               float r, float theta, float phi,
                               float dr_lambda, float dtheta_lambda, float dphi_lambda,
                               float E, float rs)
{
    // Schwarzschild lapse
    float f  = 1.0 - rs / r;
    float sf = sqrt(max(f, 1e-12));

    // --- Photon direction in static orthonormal frame
    // k^hat{t} = E / sqrt(f)
    // k^hat{r} = dr/dλ / sqrt(f)
    // k^hat{θ} = r dθ/dλ
    // k^hat{φ} = r sinθ dφ/dλ
    float k_hat_t = E / sf;
    float n_r     = (dr_lambda / sf) / k_hat_t;                  // = dr / E
    float n_th    = (r * dtheta_lambda) / k_hat_t;               // = r dθ √f / E
    float n_ph    = (r * sin(theta) * dphi_lambda) / k_hat_t;    // = r sinθ dφ √f / E

    // --- Emitter Keplerian speed measured by static observer
    // v_mag = (r * Omega) / sqrt(f)
    float Omega = omegaKepler(r, rs);
    float vmag  = (r * Omega) / sf;
    vmag = clamp(vmag, 0.0, 0.999); // avoid superluminal due to numerics
    float gamma = 1.0 / sqrt(1.0 - vmag*vmag);

    // Emitter velocity direction (disc in y=0 plane, rotation around +y)
    // Tangential unit vector around y-axis at P: t = normalize( (-z, 0, x) )
    vec2 xz = P.xz;
    float rad_xz = length(xz);
    vec3 t_cart = rad_xz > 1e-12 ? normalize(vec3(-P.z, 0.0, P.x)) : vec3(1.0, 0.0, 0.0);

    // Project t_cart onto spherical orthonormal basis to get v components
    vec3 e_r, e_th, e_ph;
    sphericalBasis(theta, phi, e_r, e_th, e_ph);
    float v_r  = vmag * dot(t_cart, e_r);
    float v_th = vmag * dot(t_cart, e_th);
    float v_ph = vmag * dot(t_cart, e_ph);

    // Photon direction unit components
    vec3 n_vec = vec3(n_r, n_th, n_ph);
    vec3 v_vec = vec3(v_r, v_th, v_ph);

    float vdotn = dot(v_vec, n_vec);

    // Final redshift factor
    float denom = gamma * (1.0 - vdotn);
    float g = sf / max(denom, 1e-6);
    return clamp(g, 0.05, 5.0); // tame extremes for stability/bloom
}

/**
 * Map 3D position on accretion disc (y=0 plane) to UV.
 * The rotation is made radius-dependent using Keplerian Omega(r)
 * so texture advection matches the velocity field used in Doppler.
 */
vec2 uvPlanar(vec3 p, float outerRadius) {
    // Base planar UV (center at 0.5,0.5; scale by outerRadius)
    float u = 0.5 + p.x / (2.0 * outerRadius);
    float v = 0.5 + p.z / (2.0 * outerRadius);

    // Local rotation around +y with physical Omega(r)
    float r_planar = max(length(p.xz), 1e-6);
    float omega = omegaKepler(r_planar, u_schwarzschildRadius);
    float angle = u_time * omega;

    vec2 centered = vec2(u, v) - 0.5;
    float ca = cos(angle), sa = sin(angle);
    vec2 rotated = vec2(centered.x * ca - centered.y * sa,
    centered.x * sa + centered.y * ca);
    return rotated + 0.5;
}

void main() {
    // Reconstruct camera ray
    vec2 uv = vUv.xy;

    vec3 rayOrigin = u_camPos;
    vec3 rayDirection = (u_camInvProjMat * vec4(uv * 2.0 - 1.0, 0.0, 1.0)).xyz;
    rayDirection = (u_camToWorldMat * vec4(rayDirection, 0.0)).xyz;
    rayDirection = normalize(rayDirection);

    Photon photon = initializePhoton(rayOrigin, rayDirection);

    // Trace
    RayTraceResult result = rayTrace(photon);

    vec4 finalColor = vec4(0.0);

    if (result.distanceTravelled < u_maxDis) {
        float d = sdfAccretionDisc(result.photon.position);
        if (d < u_eps) {
            // --- Evaluate redshift & shade
            vec3  P     = result.photon.position;
            float r_hit = length(P);
            float theta_hit = acos(clamp(P.z / r_hit, -1.0, 1.0));
            float phi_hit   = atan(P.y, P.x);

            // General g using local v and photon direction in static orthonormal frame
            float g = redshiftFactor_g_general(
                P,
                r_hit, theta_hit, phi_hit,
                result.photon.dr, result.photon.dtheta, result.photon.dphi,
                result.photon.E,
                u_schwarzschildRadius
            );

            // Sample disc texture in emitter frame
            float outerR = u_accretionDisc_outerRadiusMultiplier * u_schwarzschildRadius;
            vec2 uvDisc = uvPlanar(P, outerR);
            vec4 col_em = texture(u_accretionDiscTexture, uvDisc);

            // Liouville invariant: I_obs = g^3 I_em
            float g3 = g * g * g;
            vec3 col_obs = col_em.rgb * g3;

            // Keep bloom stable
            col_obs = clamp(col_obs, 0.0, 50.0);

            finalColor = vec4(col_obs, col_em.a);
        }
    }

    gl_FragColor = finalColor;
}
