# Hand-painted crate texture

Edited the existing UV atlas using the built-in image-generation tool, then baked UV-to-UV in live Blender at 2048×2048 with 8px bleed. More varied Lumen marks, stronger silver-gray gradients, simplified painted weathering. Game-asset baking workflow adapted to preserve separate animated layers. Geometry and UV coordinates verified unchanged against the original export. Glow excluded; Idle and Opening retained. No changes to Studium live asset or app code.

## Prompt

Use case: precise-object-edit / style-transfer.
Image 1: existing crate UV ATLAS, the edit target. Image 2: Lumen icon shape reference only (ignore blue).
Make a more minimal hand-painted Studio Ghibli-inspired version of THIS EXACT UV atlas. This is a game base-color texture, not a model render.
INVARIANTS: exact same square canvas, exact island positions, shapes, sizes, orientations, holes and black gaps. Absolutely no repacking, moving, adding or merging islands. Black negative space remains black. Six large charcoal square-ish core islands stay charcoal; light rectangular side islands and six hollow octagonal rim islands stay cool silver-gray, barely blue.
REMOVE realistic metal corrosion, granular noise, detailed pitting, jagged gritty chips and microscopic scratches. Replace weathering with a handful of simplified soft-edged painted patches, short gentle brush scuffs, broad muted gray edge-shadow accents and occasional short ivory-gray edge glints. Clean, calm, whimsical hand-painted animated-film prop, minimal shapes and spacious surfaces; 90% smooth clean paint. No rust, no photographic metal, no all-over fine-grain texture.
Make gradients on side panels appreciably stronger: smooth broad transition from pale silver upper part to medium cool-gray lower part, with tasteful 15–20% tonal contrast; vary gradient subtly between panels/layers. Rounded painted lighting feel, not noisy.
Add MORE Lumen icon stamps on rectangular SIDE islands, roughly 2–4 per island, totaling around 45–55 overall, irregularly scattered, no aligned rows, no repeating panel designs. Distinct size variation: mix tiny, medium and occasional larger marks (about 1:2:3 sizes). Rotation variation must be unmistakable: some diagonally tilted 30–45 degrees, some nearly upright, some 10–20 degrees, with overall random orientation. The four-point Lumen is rotationally symmetric every 90 degrees, so vary within 0–90, not merely 90-degree rotations. Faithful rounded four-point silhouette and rounded-square negative center from image 2. All stamps subtle darker gray about 5–8% darker than local base, flat surface paint, never blue or black.
Keep dark core islands mostly plain with very soft gradients. Rim islands use restrained painted edge accents around inner and outer perimeter, no busy icons. Output only edited UV atlas. No text, wireframes, frames, model renders, perspective or extra elements.

