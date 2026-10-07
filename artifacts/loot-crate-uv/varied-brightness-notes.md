# Lumen brightness variation

Built-in image-generation edit of the hand-painted UV atlas. Applied directly through CrateAtlasUV and baked in Blender at 2048×2048. Existing darkest gray retained as the intended lower brightness limit, with lighter and faint variants. Game-asset workflow adapted to keep animated objects separate. Glow excluded. Idle and Opening exported. Studium live model unchanged.

## Prompt

Use case: precise-object-edit. Edit the supplied crate UV texture atlas.
Change ONLY the brightness/contrast of the existing Lumen icon stamps. Keep every icon's exact position, silhouette, cutout, size, rotation and count unchanged. Preserve ALL UV island boundaries, locations, canvas, black gaps, six dark core islands, base colors, gradients, painted weathering and highlights EXACTLY.
Each icon is currently the darkest it may be. Do not darken ANY icon. Randomly vary brightness per icon: keep about 15% at the existing gray, make about 30% moderately lighter, 35% very soft faint gray almost blending into the base, and 20% light ghostlike gray only barely visible. Give each panel a mix of these levels; do not tie brightness to size or location. All icons stay slightly darker than their local surface, not white highlights. The darkest remain the current shade, every other level approaches the surrounding base paint. Deliberate unmistakable brightness variation, not one uniformly lighter pattern.
This is a surgical color-only edit to the icon pixels, NOT a new atlas or repaint. Keep everything else unchanged. Output only square UV atlas, no borders, text or renders.

