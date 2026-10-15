import { MeshStandardMaterial, MeshToonMaterial } from 'three'

// Keep the Blender atlas while matching the character's stylized lighting.
export const createCrateSurfaceMaterial = (original) => new MeshToonMaterial({
    color: original.color,
    map: original.map,
    side: original.side,
})

// HDR emission feeds the bloom pass; gray crate surfaces are not selected.
export const createCrateCoreGlowMaterial = (original) => new MeshStandardMaterial({
    color: '#000000',
    emissive: '#ffffff',
    emissiveIntensity: 3,
    roughness: 1,
    side: original.side,
    toneMapped: false,
})

export const updateCrateCoreGlow = (core, glowMaterial, color, intensity = 3) => {
    core.material = glowMaterial
    glowMaterial.emissive.set(color)
    glowMaterial.emissiveIntensity = intensity
}
