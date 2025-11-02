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

float blackHoleDist(vec3 p) {
    return distance(p, u_blackHolePosition) - u_schwarzschildRadius;
}

float accretionDiscDist(vec3 p) {
    float outerRadius = 6.5;
    float innerRadius = 3.0;
    float thickness = 0.02;

    float radialDistOuter = length(p.xz) - outerRadius;
    float radialDistInner = innerRadius - length(p.xz);

    float verticalDist = abs(p.y) - thickness;
    return max(max(radialDistOuter, verticalDist), radialDistInner);
}

float scene(vec3 p) {
    // distance to sphere 1
    float blackHoleDist = blackHoleDist(p);

    // distance to sphere 2
    float accretionDiscColor = accretionDiscDist(p);

    // return the minimum distance between the two spheres
    return min(blackHoleDist, accretionDiscColor);
}

float rayTrace(vec3 ro, vec3 rd)
{
    float d = 0.0; // total distance travelled
    float cd; // current scene distance
    vec3 p; // current position of ray

    for (int i = 0; i < u_maxSteps; ++i) { // main loop
                                           p = ro + d * rd; // calculate new position
                                           cd = scene(p); // get scene distance

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

void main() {
    // Get UV from vertex shader
    vec2 uv = vUv.xy;

    // Get ray origin and direction from camera uniforms
    vec3 rayOrigin = u_camPos;
    vec3 rayDirection = (u_camInvProjMat * vec4(uv * 2. - 1., 0, 1)).xyz;
    rayDirection = (u_camToWorldMat * vec4(rayDirection, 0)).xyz;
    rayDirection = normalize(rayDirection);

    // Ray marching and find total distance travelled
    float distanceTravelled = rayTrace(rayOrigin, rayDirection); // use normalized ray

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
