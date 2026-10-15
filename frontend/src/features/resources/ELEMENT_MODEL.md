# Interactive element model (design, not yet implemented)

Replaces the old `graph` block with one block type, `interactive`, with no legacy path kept. The deadweight-loss
element that started this was hardcoded — not because it was economics, but because its
behaviour lived in code instead of in data. Everything below follows from fixing that.

No subject is named anywhere in the schema. Authors never write JavaScript.

## Where the expressiveness comes from

Not from the primitive list. Three orthogonal axes multiply:

1. **Primitives** — seven, fixed.
2. **Exprs** — every number on every primitive is an expression over the element's
   params, so position, size, rotation, opacity and even repeat *count* are live.
3. **Repeat** — any shape can be drawn N times with an index usable in its Exprs.

A vector field is not a primitive: it is one arrow repeated 64 times with its direction
computed from the index. That substitution is the pattern — reach for it every time
something looks like it needs a new type.

**Rule for anything proposed later:** if it can be built from the existing primitives in
about three shapes without awkwardness, it is a *template*, not a primitive. This is what
keeps the renderer and the validator from growing once per subject.

## Document shape

```
interactive
  title                                      100 chars
  caption                                    300 chars
  canvas   { kind: 'plane' | 'diagram',
             xLabel, yLabel,                 50 chars each (plane only)
             xMin, xMax, yMin, yMax,         finite, span > 0, |v| <= 1e4
             grid: boolean }
  timeline { duration, loop, autoplay }      optional; adds `t` to Exprs
  params   [ Param ]                         <= 8
  derived  [ { id, label, expr } ]           <= 8, in order, earlier ones only
  shapes   [ Shape ]                         <= 16
  readouts [ { id, label, expr, decimals } ] <= 4
```

`diagram` hides axes and ticks but keeps the same coordinate space — a diagram is a plane
you don't label, which is why one renderer serves both.

## Primitives

Discriminated by `kind`. Every numeric field is an Expr. `style` is bounded: `color` a
palette index 0..5, `width` 1..4, `dash` boolean, `fillOpacity` 0..0.4.

| kind | fields | covers |
|---|---|---|
| `curve` | `x`, `y` (Exprs in `u`), `domain: [Expr, Expr]` | **Parametric, not y = f(x).** Subsumes function-of-x via `x = u`, and adds circles, ellipses, vertical lines, spirals, orbits, polar curves |
| `path` | `points: [[Expr, Expr], ...]` <= 12, `closed`, `arrow: 'none'|'end'|'both'` | segments, polygons, arrows, bars, bonds, force vectors, wires, edges |
| `marker` | `at: [Expr, Expr]`, `radius` (canvas units), `glyph: 'disc'|'ring'|'square'|'cross'`, `label` | atoms, charges, masses, data points, equilibrium dots |
| `region` | `between: [curveId, curveId]` or `under: curveId`, `domain: [Expr, Expr]` | deadweight loss, surplus, definite integrals, bands, lobes — the boundary is curved, so a path cannot express it |
| `label` | `at: [Expr, Expr]`, `text` <= 80, may interpolate `{readoutId}` | every subject |
| `image` | `url`, `at: [Expr, Expr]`, `width`, `height`, `rotation` | author-supplied art with live position and rotation: beaker, cell, map, skeleton, circuit symbol, photo. One primitive, unbounded subject coverage. Same http/https rule as `media` blocks |
| `arc` | `at`, `from`, `to` (points), `radius`, `showMeasure` | bond angles, inclines, geometry. Expressible as a curve, but wanted constantly and carries its own measure |

A tangent line is deliberately not a primitive — it is a `path` whose endpoints use a
difference quotient, which is precisely the lesson in the calculus case.

## Params, state and interaction

```
Param { id, label,
        control: 'slider' | 'stepper' | 'toggle' | 'choice',
        min, max, step, value,
        options: [ { label, value } ],     // choice, 2..6; toggle -> 0 | 1
        update: Expr }                     // optional: next value, per frame
```

Params are the only mutable state, and reader interaction can do exactly one thing: set a
param. That single rule is what keeps the model validatable.

- **`update`** makes the format a simulation rather than a graph: projectile motion, a
  pendulum, exponential decay, a titration curve. Rules are evaluated once per frame in
  declaration order into a *fresh* frame, so a rule reads the previous frame and there is
  no ordering trap. No branching, no loops; `dt` is fixed by the renderer; a value
  leaving `[min, max]` clamps; a non-finite result freezes that param at its last finite
  value and flags the element in the builder.
- **`drag: { xParam, yParam }`** on a `marker` lets a reader drag it, writing two params.
  Covers vector addition, ray optics, free-body diagrams, geometry constructions —
  interaction a slider cannot express, without breaking the params-only rule.
- **`repeat: { count, as: 'i' }`** on any shape exposes `i` (0 .. count-1) inside that
  shape only. `count` may itself be an Expr, so a slider can add atoms. Cap 64.

## Expr

Stored as a prefix tuple tree, never a string, so the server validates structure rather
than parsing a language:

```
['num', 3.5] | ['param', id] | ['derived', id] | ['var', 'x'|'u'|'t'|'i']
['op', '+'|'-'|'*'|'/'|'^', a, b]
['fn', name, ...args]
```

Whitelist: `abs min max sqrt sin cos tan atan2 exp ln clamp floor round`. `pow` is
deliberately absent — `^` is the only exponent path, so its literal-integer bound cannot be
routed around.
Depth <= 6, <= 48 nodes, `^` exponent an integer in [-4, 4]. `ln`/`sqrt` of a
non-positive value and division by zero yield `NaN`; a shape evaluating non-finite at a
sample is skipped for that sample, never thrown.

Conditionals beyond `clamp`/`min`/`max` are out — a conditional is where a declarative
format starts becoming a language. Revisit only against a concrete lesson that needs one.

## Status

Canonical copies live in `backend/functions/src/features/resources/` and are mirrored to
`frontend/src/features/resources/utils/`, held byte-identical by a test, because functions
deploys only `backend/functions`.

- **Built:** `elementExpr.js` — Expr grammar, scope rules, bounds, evaluator.
- **Built:** `elementModel.js` — `validateElement`, the seven shapes, params with `update`
  rules, `repeat`, `drag`, reference integrity, the smoke check, frame/stepping and
  `shapePoints` sampling shared with the renderer, and `upcastGraphBlock`.
- **Built:** `contentService.js` — the `interactive` block replaces `graph` outright. There is
  no legacy path: `graph` is not a block type any more, and any stored graph block is now
  rejected as unsupported.
- **Built:** `InteractiveElement.jsx` — the reader renderer, on `shapePoints`: axes and grid,
  all seven shapes, `repeat`, param controls, timeline transport, pointer dragging, readouts
  and label interpolation. `InteractiveGraph.jsx` is deleted and `ResourceDetail.jsx` renders
  the new component. Pure geometry lives in `utils/elementGeometry.js` (frontend only).
- **Built:** the builder at `/resources/build` and `/resources/build/:resourceId`. Two areas:
  the pages on the left on a `neutral5` field, each page a white 16:9 card; a single column on
  the right with **Palette** and **Properties** tabs. Header follows the Circles pattern —
  name left, Builder/Settings tabs centre, Save draft / Publish right. Blocks are dragged from
  the palette onto a page (`@dnd-kit`), and dragging a placed block moves it.
- **Built:** grid snapping (2.5% of the page, drawn on the canvas), drag ghosts, per-block
  controls (forward / backward / delete), draft placeholders that are shown but never stored,
  and the Graph / Diagram / Simulation split of the old "Interactive" palette entry.
- **Built:** page-level variables. `page.variables` are validated before the page's blocks and
  passed into `validateElement(input, allowIncomplete, shared)`; they resolve through the same
  `['param', id]` node, so the grammar and evaluator are untouched. One strip of controls per
  page drives every block on it, and a text block can name a variable in braces to show its
  live value.
- **Built:** shapes are dragged onto an element the same way blocks are dragged onto a page;
  during a shape drag every element outlines itself as a target and everything else dims.
- **Built:** the value/function picker is a searchable palette with a plain-language line per
  entry, replacing the long dropdown. Palette entries carry hover cards with a sketch of what
  they produce.
- **Built:** the editor behaviours a builder is expected to have — undo/redo (pure rules in
  `editHistory.js`, so typing a sentence is one step), corner resize handles on the grid,
  duplicate block and duplicate page, page reordering, an unsaved-changes indicator with a
  close guard, keyboard shortcuts (arrows nudge, delete, escape, ⌘D, ⌘Z/⇧⌘Z), a keyboard
  sensor and click-to-place so the builder works without dragging, and an empty-page hint.
- **Built:** a calmer reader and builder. A lesson opens full screen at
  `/resources/lesson/:id` (`LessonPlayer.jsx`) instead of in a modal: one slim bar, the page
  at full width, dots and arrow keys to move, and thanking the author waiting on the last page.
  The nested framing is gone — an element no longer draws its own card inside a page card
  inside a modal. In the builder the palette only offers shapes once an element is selected,
  variables collapse to one "Add a variable" control, the grid appears only while dragging,
  page controls appear on hover, and a variable is one thing on screen (its control doubles as
  the way into its settings). `ResourceDetail.jsx` is deleted.
- **Verified in the running app** (local emulators): place a block, drag a shape onto an
  element, add a page variable, bind a curve to it, move the slider, nudge/undo/redo, save,
  reopen, and read the lesson. Four real bugs came out of that pass — see the git history.
- **Next:** drag-to-label and matching as their own block types; derived values still have no
  palette entry; a page-level clock to match the page-level variables, which is what would
  bring back "this value changes on its own" (the switch is hidden until then rather than
  promising something that is dropped on save).

### What other systems do, and what we should take

The complaint that "interactive" is vague and secretly means "graph" is correct, and the fix is
not more fields. Five systems worth copying from, and the one idea each:

- **Desmos** — one expression list; type `y = m*x + b` and it offers *"add slider for m"*.
  Variables are **implicit**, created from what you already wrote. Nobody declares a parameter
  first.
- **GeoGebra** — one maths kernel, several focused apps (Graphing, Geometry, 3D). They split
  the *authoring surface* by form while keeping one engine. **Taken: `variant` splits the
  palette into Graph / Diagram / Simulation over the same model.**
- **Tangle / explorable explanations** (Bret Victor) — reactive prose: "if you eat **5**
  cookies…" where the number is draggable and the rest of the sentence updates. The
  interactive part is the *text*, with no chart anywhere.
- **Observable** — a page is a namespace of named reactive values; inputs publish into it and
  anything can read it. State is not trapped inside one widget.
- **Nearpod / Pear Deck / Kahoot** — a short list of discrete *activity* types (poll, matching,
  drag-to-label). They never built a generic canvas for assessment, because the common cases
  are few and each is clearer as its own thing.

### Variables belong to the page, not to an element (done)

A slider used to live **inside** one element, which is what made each element a self-contained
mini-app that could share nothing. Variables now sit on the page:

```
page
  variables [ { id, label, control, min, max, step, value, update } ]
  blocks    [ ... ]   // every block may read any variable on its page
```

- A slider can drive **two** elements side by side — a graph and a diagram of the same thing.
- A **text** block can say "at this price, demand is {q} units" and update live, so an
  interactive lesson no longer requires a chart (the Tangle idea).
- Each element shrinks to what it draws. A Graph is axes plus curves; a Diagram is shapes; a
  Simulation is a Diagram with a clock. None of them own controls any more.
- The control strip renders once per page instead of once per element, which is also less
  cluttered on screen.

The Expr grammar did not change — only where the names it resolves come from, which is a change
to `exprScope`'s inputs rather than to the evaluator. A page with no variables behaves exactly
as before.

### Also worth having, and deliberately not part of the element engine

The most common interactive-lesson activities are not graphs, and contorting the element model
to cover them would repeat the original mistake. They should be their own block types, each
small and obvious: **drag-to-label** (drop names onto an image), **matching** (pair two
columns), and **poll**. Each is a day of work and covers more real lessons than another
primitive would.

### Lessons are pages

A lesson is `pages: [{ id, blocks }]`, each block carrying `frame { x, y, w, h }` in page
percentages — so one set of numbers renders identically for the author and the reader, at any
size. Pages are 16:9. `course` is gone as a resource type: a lesson can simply be long.

### Colour

Six categorical series colours, `--color-series0..5` in `index.css`, light and dark stepped
separately rather than flipped, and validated for colour-vision separation against this
project's plot surfaces. Assigned by the author per shape and never cycled; a multi-curve
element always renders a legend, so identity is never colour alone.

### Storage: Firestore cannot nest arrays

An expression is an array of arrays, and Firestore rejects an array placed directly inside
another array — so a perfectly valid lesson failed to save with "Property array contains an
invalid nested entity". Rather than reshape the grammar that the evaluator, the validator and
the builder all share, `firestoreArrays.js` packs the nesting on write (`[a, b]` inside an
array becomes `{ __a: [a, b] }`) and unpacks it on read. The quirk is confined to the storage
boundary; nothing else in the system knows about it.

## Validation (contentService.js)

Structural bounds on every field, as elsewhere in that file, plus two checks this model
specifically needs:

1. **Reference integrity** — every `['param', id]`, `['derived', id]` and `curveId`
   resolves; `derived` references only earlier `derived`; `drag` names real params; `u`
   appears only inside a `curve`, `i` only inside a repeated shape, `t` only when a
   `timeline` exists.
2. **Smoke evaluation** — sample the corners and midpoint of the param space (capped at 64
   combinations), at up to three points on the timeline, stepping any simulation first. If no
   shape ever produces a finite point, reject. A `region` additionally requires each boundary
   curve to run left to right, checked per boundary; that keeps shading to an x-monotone
   sample-by-x fill instead of general polygon clipping.

The evaluator is one pure module shared by renderer and validator, so what the author
previews is what the server accepts.

## Authoring

**Layout:** live preview in the centre showing exactly what a reader sees, with the
element palette on the right; each palette entry carries a mini preview of what it draws. The element's own setup follows the project's
multi-step modal convention (canvas -> params -> shapes -> review), with
`ResourceCreateModal.jsx` as the reference implementation.

Expression fields are a **chip editor** (`components/builder/ExpressionField.jsx`) — pick a param, `x`, `u`, `t` or `i`, pick an
operator, pick a number. Never a text box with a parser; the Expr tree is the editor's
native state.

Decided for now:
- **Authors build from scratch.** No forking or remixing another author's element.
  First-party templates are a possible later addition; author-to-author copying is not
  planned.
- **No AI assistant yet.** Worth noting only that the format makes one cheap to add
  later: an assistant would emit a document in this format, pass the same validator as a
  hand-built element, and open in the same builder — no second renderer, no new trust
  boundary, and nothing it can express that an author couldn't.

## Deliberately out

- **Arbitrary author code.** If the format provably cannot express something needed, the
  answer is a new bounded primitive, not an escape hatch. A sandboxed deterministic subset
  with fuel limits in a worker is the only safe version, and a project of its own.
- **3D.** A different renderer and a different authoring metaphor.
