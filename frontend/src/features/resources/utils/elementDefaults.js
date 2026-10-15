// Starting points for everything an author can add. Kept as data in one place so the palette,
// the inspector and the preview never disagree about the shape of a new thing.

export const num = (value) => ['num', value]

export const newId = () => crypto.randomUUID()

// Pages are a fixed shape so a frame in percentages means the same thing everywhere.
export const PAGE_RATIO = 16 / 9

// Everything snaps to this grid, in page percentages, so things line up without fiddling.
export const GRID = 2.5

export const snap = (value) => Math.round(value / GRID) * GRID

// What the palette offers. The last three are all `interactive` underneath — one engine — but
// an author picks by what they are making, because "interactive" says nothing about what
// you get. Each preset only differs in its starting canvas, which is data, not a code path.
export const BLOCK_KINDS = [
    { type: 'text', label: 'Text', description: 'Explain an idea in your own words.', size: { w: 80, h: 20 } },
    { type: 'media', label: 'Media', description: 'Link a video or document.', size: { w: 60, h: 15 } },
    { type: 'quiz', label: 'Quiz', description: 'Ask a question with one right answer.', size: { w: 70, h: 45 } },
    { type: 'graph', label: 'Graph', description: 'Axes, curves and shaded areas.', size: { w: 70, h: 70 } },
    { type: 'diagram', label: 'Diagram', description: 'Labelled parts, no axes.', size: { w: 70, h: 70 } },
    { type: 'simulation', label: 'Simulation', description: 'A diagram that runs over time.', size: { w: 70, h: 70 } },
]

export const ELEMENT_VARIANTS = new Set(['graph', 'diagram', 'simulation'])

export const variantLabel = (variant) => BLOCK_KINDS.find((entry) => entry.type === variant)?.label ?? 'Element'

export const newPage = () => ({ id: newId(), variables: [], blocks: [] })

export const defaultFrame = (type) => {
    const size = BLOCK_KINDS.find((entry) => entry.type === type)?.size ?? { w: 60, h: 30 }
    return { x: snap((100 - size.w) / 2), y: snap((100 - size.h) / 2), ...size }
}

// Keeps a frame on the page whichever edge it was pushed past, and on the grid.
export const clampFrame = (frame, toGrid = true) => {
    const fit = (value) => (toGrid ? snap(value) : value)
    const w = Math.min(Math.max(fit(frame.w), GRID * 2), 100)
    const h = Math.min(Math.max(fit(frame.h), GRID * 2), 100)
    return { w, h, x: Math.min(Math.max(fit(frame.x), 0), 100 - w), y: Math.min(Math.max(fit(frame.y), 0), 100 - h) }
}

// Each primitive carries the miniature the palette draws, so adding one here is the only step
// needed to offer it — no subject ever gets its own entry.
export const SHAPE_KINDS = [
    { kind: 'curve', label: 'Curve', description: 'Any line or function, straight or bent.', preview: 'M4,26 C12,26 16,6 28,6' },
    { kind: 'path', label: 'Path', description: 'Straight lines between points. Arrows optional.', preview: 'M4,26 L14,10 L28,18' },
    { kind: 'marker', label: 'Point', description: 'A dot you can label, or let the reader drag.', preview: 'M16,16 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0' },
    { kind: 'region', label: 'Shaded area', description: 'Fill the area between two curves.', preview: 'M4,26 L14,10 L28,18 L28,26 Z' },
    { kind: 'label', label: 'Text label', description: 'Words placed on the canvas.', preview: 'M6,22 L16,8 L26,22 M10,17 L22,17' },
    { kind: 'image', label: 'Image', description: 'Your own picture, placed and rotated.', preview: 'M5,7 L27,7 L27,25 L5,25 Z M5,20 L12,14 L19,21 L23,18 L27,21' },
    { kind: 'arc', label: 'Angle', description: 'An arc between two directions, with its measure.', preview: 'M6,26 L26,26 M6,26 L22,10 M12,26 A8,8 0 0,0 15,19' },
]

export const CONTROL_KINDS = [
    { control: 'slider', label: 'Slider' },
    { control: 'stepper', label: 'Stepper' },
    { control: 'toggle', label: 'Toggle' },
    { control: 'choice', label: 'Choices' },
]

export const newTimeline = () => ({ duration: 5, loop: true, autoplay: false })

export const newBlock = (type, frame = null) => {
    const id = newId()
    const placed = frame ? clampFrame(frame) : defaultFrame(type)

    if(type === 'text') return { id, type, frame: placed, text: '' }
    if(type === 'media') return { id, type, frame: placed, url: '', caption: '' }
    if(type === 'quiz') return { id, type, frame: placed, prompt: '', options: ['', ''], answerIndex: 0, explanation: '' }

    const variant = ELEMENT_VARIANTS.has(type) ? type : 'graph'

    return {
        id,
        frame: placed,
        type: 'interactive',
        variant,
        title: '',
        caption: '',
        canvas: variant === 'graph'
            ? { kind: 'plane', xMin: 0, xMax: 10, yMin: 0, yMax: 10, xLabel: '', yLabel: '', grid: true }
            : { kind: 'diagram', xMin: 0, xMax: 100, yMin: 0, yMax: 100, xLabel: '', yLabel: '', grid: false },
        timeline: variant === 'simulation' ? newTimeline() : null,
        params: [],
        derived: [],
        shapes: [],
        readouts: [],
    }
}

// A page variable and an element parameter are the same shape; only where they live differs.
export const newVariable = (control, index) => ({ ...newParam(control, index), label: `Variable ${index + 1}` })

export const newParam = (control, index) => {
    const id = newId()
    const label = `Value ${index + 1}`

    if(control === 'toggle') return { id, label, control, min: 0, max: 1, step: 1, value: 0, options: [], update: null }
    if(control === 'choice') return { id, label, control, min: 0, max: 1, step: 1, value: 0, options: [{ label: 'First', value: 0 }, { label: 'Second', value: 1 }], update: null }

    return { id, label, control, min: 0, max: 10, step: control === 'stepper' ? 1 : 0.1, value: 5, options: [], update: null }
}

// New shapes are placed inside the canvas the author already set up, so a freshly added shape
// is visible immediately rather than off-screen at the origin.
export const newShape = (kind, canvas, index, curveIds = []) => {
    const id = newId()
    const midX = (canvas.xMin + canvas.xMax) / 2
    const midY = (canvas.yMin + canvas.yMax) / 2
    const base = { id, kind, repeat: null, style: { color: index % 6, width: 2, dash: false, fillOpacity: 0.16 } }

    if(kind === 'curve') return { ...base, label: `Curve ${index + 1}`, x: ['var', 'u'], y: ['var', 'u'], domain: [num(canvas.xMin), num(canvas.xMax)] }
    if(kind === 'path') return { ...base, points: [[num(canvas.xMin), num(midY)], [num(midX), num(canvas.yMax)]], closed: false, arrow: 'none' }
    if(kind === 'marker') return { ...base, at: [num(midX), num(midY)], radius: num((canvas.xMax - canvas.xMin) / 50), glyph: 'disc', label: '', drag: null }
    if(kind === 'region') return { ...base, between: curveIds.slice(0, 2), under: curveIds.length < 2 ? curveIds[0] ?? '' : null, domain: [num(canvas.xMin), num(canvas.xMax)] }
    if(kind === 'label') return { ...base, at: [num(midX), num(midY)], text: 'Label' }
    if(kind === 'image') return { ...base, url: '', at: [num(midX), num(midY)], width: num((canvas.xMax - canvas.xMin) / 4), height: num((canvas.yMax - canvas.yMin) / 4), rotation: num(0) }

    return { ...base, at: [num(midX), num(midY)], from: [num(canvas.xMax), num(midY)], to: [num(midX), num(canvas.yMax)], radius: num((canvas.xMax - canvas.xMin) / 8), showMeasure: true }
}

// Duplicating a page gives its variables new ids, so every expression that referenced the old
// ones has to be rewritten or the copy would point at variables that no longer exist.
export const remapExpr = (expr, map) => {

    if(!Array.isArray(expr)) return expr

    const [kind] = expr

    if(kind === 'param' && map[expr[1]]) return ['param', map[expr[1]]]
    if(kind === 'num' || kind === 'var' || kind === 'param' || kind === 'derived') return expr

    return expr.map((entry) => (Array.isArray(entry) ? remapExpr(entry, map) : entry))
}

const remapPoint = (point, map) => point.map((entry) => remapExpr(entry, map))

export const remapBlock = (block, map) => {

    if(block.type !== 'interactive') return block

    const field = (value) => (Array.isArray(value) ? remapExpr(value, map) : value)
    const pair = (value) => (Array.isArray(value) ? remapPoint(value, map) : value)

    return {
        ...block,
        params: block.params.map((param) => ({ ...param, update: param.update ? remapExpr(param.update, map) : param.update })),
        derived: block.derived.map((entry) => ({ ...entry, expr: remapExpr(entry.expr, map) })),
        readouts: block.readouts.map((entry) => ({ ...entry, expr: remapExpr(entry.expr, map) })),
        shapes: block.shapes.map((shape) => ({
            ...shape,
            ...(shape.x ? { x: field(shape.x), y: field(shape.y) } : {}),
            ...(shape.at ? { at: pair(shape.at) } : {}),
            ...(shape.from ? { from: pair(shape.from), to: pair(shape.to) } : {}),
            ...(shape.points ? { points: shape.points.map((point) => remapPoint(point, map)) } : {}),
            ...(shape.domain ? { domain: pair(shape.domain) } : {}),
            ...(shape.radius ? { radius: field(shape.radius) } : {}),
            ...(shape.width ? { width: field(shape.width), height: field(shape.height), rotation: field(shape.rotation) } : {}),
            ...(shape.repeat ? { repeat: { ...shape.repeat, count: field(shape.repeat.count) } } : {}),
        })),
    }
}

export const newReadout = (index) => ({ id: newId(), label: `Readout ${index + 1}`, expr: num(0), decimals: 1 })

export const newDerived = (index) => ({ id: newId(), label: `Step ${index + 1}`, expr: num(0) })

