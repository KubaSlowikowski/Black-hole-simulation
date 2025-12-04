import * as THREE from "three";

export const BLOOM_PARAMS = {
    strength: 0.7, // intensity of the effect
    radius: 0.3, // radius of the bloom
    threshold: 0.05 // minimum size to activate bloom
};

export const RENDERER_PARAMS = {
    toneMapping: THREE.CineonToneMapping,
    toneMappingExposure: 1,
    // outputEncoding: THREE.sRGBEncoding,
};
