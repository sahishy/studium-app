import { BlendFunction, Effect } from 'postprocessing'

// Bloom's default shader scales RGBA by intensity. Its amplified, blurred
// alpha becomes opaque long before its RGB does, leaving a hard-edged blob.
// Add only bloom RGB and preserve the original scene coverage instead.
export const configureCrateBloom = (effect) => {
    if(!effect) return
    effect.setFragmentShader(`
        uniform sampler2D map;
        uniform float intensity;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
            vec3 halo = texture2D(map, uv).rgb;
            float peak = max(halo.r, max(halo.g, halo.b));
            vec3 hue = halo / max(peak, 0.00001);
            // Approximate the bright core's Reinhard-compressed hue, rather
            // than letting faint bloom retain the darker raw emission color.
            vec3 coreTint = (hue * 3.0) / (vec3(1.0) + hue * 3.0);
            coreTint /= 0.75;
            vec3 tint = mix(coreTint, vec3(1.0), 0.12);
            // Keep the core and textured crate saturated: tint only the halo
            // outside opaque geometry, blending smoothly at antialiased edges.
            tint = mix(hue, tint, 1.0 - clamp(inputColor.a, 0.0, 1.0));
            // Preserve the peak and falloff; lift only the secondary channels.
            outputColor = vec4(tint * peak * intensity, 0.0);
        }
    `)
}

// The canvas uses premultiplied alpha. After tone mapping, give the halo
// sufficient coverage for its display-space RGB, without unpremultiplying
// opaque crate pixels or introducing an opaque background. EffectPass performs
// the actual sRGB conversion after this final effect.
export const createCrateBloomCoverage = () => new Effect('CrateBloomCoverage', `
    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = inputColor;
        float peak = max(inputColor.r, max(inputColor.g, inputColor.b));
        float coverage = peak <= 0.0031308
            ? 12.92 * peak
            : 1.055 * pow(max(peak, 0.0), 1.0 / 2.4) - 0.055;
        outputColor.a = max(inputColor.a, clamp(coverage, 0.0, 1.0));
    }
`, { blendFunction: BlendFunction.SRC })
