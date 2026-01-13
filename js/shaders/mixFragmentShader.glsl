uniform sampler2D baseTexture;
uniform sampler2D bloomTexture;
varying vec2 vUv;

void main() {
    vec4 originalColors = texture2D(baseTexture, vUv); // original colors of the object texture
    vec4 generatedColors = vec4(1.0) * texture2D(bloomTexture, vUv); // bloom effect colors
    vec4 intensity = vec4(1.0);

    gl_FragColor = originalColors + intensity * generatedColors;
}
