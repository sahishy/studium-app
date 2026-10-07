# Blue cloth middle layer

Built-in image-generation artwork guided by Layer_Middle UV regions, with a corrective pass using exact island bounding boxes. Blender applies the artwork only to Layer_Middle; other solid parts bake from their original varied-brightness atlas. One shared 2048×2048 texture atlas, with a separate matte cloth material (roughness 0.94, metallic 0, sheen weight 0.25). Game-asset baking adapted to preserve separate animated meshes. Glow excluded; Idle and Opening retained. No cloth simulation or geometry changes. No Studium live model changes.

## Initial image prompt

Use case: precise-object-edit.
Image 1 is an existing crate UV atlas to EDIT. Image 2 is a selection guide containing ONLY the middle layer's UV islands. Image 3 is the Lumen logo COLOR reference (bright sky/cyan blue).
Change ONLY the islands indicated by the filled gray regions in image 2: make those islands Lumen BLUE with a unique stylized CLOTH appearance. Every other island in image 1 must stay exactly unchanged. Preserve all UV footprints, positions, scale, orientations, spacing, ring holes and black gaps. Do not repack the atlas. No wireframe lines in final.
Blue target approximately #0BA5E4, from image 3. Middle layer is a soft cloth-wrapped band on a rigid rounded crate: broad hand-painted fabric folds, muted blue creases/shadows and pale sky-blue rubbed edge highlights, very subtle simplified woven crosshatching in small places, velvety matte appearance, stylized animated-film / Ghibli-inspired painted textile. NOT metallic, no corrosion, no micro-grunge, no realistic photo fabric, no bulging cloth or extra geometry. Gentle visible top-to-bottom blue gradients.
Keep the existing Lumen icons on the selected middle-layer islands at their current varied positions, sizes and rotations, recolored tonal blues: a mixture of darker blue, mid blue and faint light blue prints. Different brightnesses, not uniformly dark. Clean minimalist surface with a few soft fabric wear marks, 90% broad simple painted color. No letters, no text, no seams drawn across UV cuts.
Important exact selection: image 2 includes TWO hollow octagonal rings (middle layer upper/lower rims) and eight rectangular islands. Only these become blue cloth. All six charcoal core islands, other four silver rings, and all unselected silver rectangular islands stay untouched.
Output ONLY full edited square UV atlas, no render, perspective, frames, labels or other elements.

## Corrective image prompt

Correct image 1's UV atlas, using image 2 as the original gray atlas to restore unselected regions. Exact square registration. Keep all UV footprints unmoved.
ONLY these 10 existing islands should be blue stylized cloth (normalized image coordinates measured from TOP LEFT, x1,y1,x2,y2):
RECTANGLES:
(0.5834,0.0324,0.6465,0.1973) the narrow vertical near top center;
(0.0558,0.5543,0.1862,0.6174) lower rectangle inside far-left ring;
(0.0062,0.6716,0.2485,0.7383) long horizontal lower-left;
(0.4758,0.2142,0.6700,0.2810) horizontal upper-center;
(0.9309,0.8226,0.9939,0.9874) bottom-right narrow vertical;
(0.0484,0.4781,0.1789,0.5412) upper rectangle inside far-left ring;
(0.2464,0.7515,0.3130,0.9938) fourth vertical column from left along bottom;
(0.0067,0.2641,0.2008,0.3308) upper horizontal at far-left.
RINGS:
(0.4084,0.7640,0.6377,0.9933) bottom-center hollow octagonal ring;
(0.4744,0.2963,0.7037,0.5256) upper-center-right hollow octagonal ring.
Every listed island BLUE, not gray. All OTHER islands restore gray or charcoal exactly as image 2; no other blue.
Material: Lumen sky blue #0BA5E4, calm stylized hand-painted fabric, matte, broad simple folds, only faint sparse woven suggestions. Remove the excessive detailed streaky weave from image 1: simplify it by 70%. Soft blue gradients, gentle rounded creases, a subtle darker sewn hem near edges, no metal glints or scratches. Preserve existing Lumen prints in varied brightnesses, recolor those inside blue cloth to tonal lighter/darker blues.
All black gaps and holes remain black. This is a UV atlas not a render, no text, borders, wireframes, screws. Keep all positions, shapes and sizes exact.

