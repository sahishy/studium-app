// Validation and sampling for the interactive-element block. Dependency-free and pure for
// the same reason as elementExpr.js: the builder, the renderer and the publish check all
// run this exact code. The frontend holds a byte-identical copy — see elementModel.test.js.

import { EXPR_VARIABLES, evaluateExpr, evaluatePoint, exprScope, isFinitePoint, validateExpr } from './elementExpr.js'

export const MAX_PARAMS = 8
export const MAX_DERIVED = 8
export const MAX_SHAPES = 16
export const MAX_READOUTS = 4
export const MAX_PATH_POINTS = 12
export const MAX_CHOICE_OPTIONS = 6
export const MAX_REPEAT = 64
export const MAX_SMOKE_COMBINATIONS = 64
export const CURVE_SAMPLES = 48
export const COORD_LIMIT = 1e4
export const MAX_DURATION = 60
export const FRAME_SECONDS = 1 / 60

export const CANVAS_KINDS = new Set(['plane', 'diagram'])
// How the author thinks of the element. One engine underneath; this only picks the starting
// point and which controls the builder bothers showing.
export const ELEMENT_VARIANTS = new Set(['graph', 'diagram', 'simulation'])
export const PARAM_CONTROLS = new Set(['slider', 'stepper', 'toggle', 'choice'])
export const SHAPE_KINDS = new Set(['curve', 'path', 'marker', 'region', 'label', 'image', 'arc'])
const GLYPHS = new Set(['disc', 'ring', 'square', 'cross'])
const ARROWS = new Set(['none', 'end', 'both'])
const DRAGGABLE_CONTROLS = new Set(['slider', 'stepper'])
const MAX_COLOR = 5
const MAX_WIDTH = 4
const MAX_FILL_OPACITY = 0.4

const text = (value, max) => String(value ?? '').trim().slice(0, max)
const uuid = () => globalThis.crypto.randomUUID()
const fail = (message) => { throw new Error(message) }
const list = (value) => (Array.isArray(value) ? value : [])

// A local copy rather than an import from contentService, which will import this module:
// the dependency has to run one way for both Node and the browser bundle.
const externalUrl = (value) => {
    try {
        const url = new URL(value)
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
    } catch { return null }
}

const bounded = (value, min, max, fallback) => {
    const number = Number(value)
    if(!Number.isFinite(number)) return fallback
    return Math.min(Math.max(number, min), max)
}

const style = (input) => ({
    color: Math.round(bounded(input?.color, 0, MAX_COLOR, 0)),
    width: Math.round(bounded(input?.width, 1, MAX_WIDTH, 2)),
    dash: Boolean(input?.dash),
    fillOpacity: bounded(input?.fillOpacity, 0, MAX_FILL_OPACITY, 0.16),
})

const uniqueIds = (entries, label) => {
    const seen = new Set()
    entries.forEach((entry) => {
        if(seen.has(entry.id)) fail(`Two ${label} share an id.`)
        seen.add(entry.id)
    })
    return entries
}

const validateCanvas = (input) => {
    const kind = CANVAS_KINDS.has(input?.kind) ? input.kind : 'plane'
    const xMin = bounded(input?.xMin, -COORD_LIMIT, COORD_LIMIT, 0)
    const xMax = bounded(input?.xMax, -COORD_LIMIT, COORD_LIMIT, 100)
    const yMin = bounded(input?.yMin, -COORD_LIMIT, COORD_LIMIT, 0)
    const yMax = bounded(input?.yMax, -COORD_LIMIT, COORD_LIMIT, 100)
    if(xMax <= xMin || yMax <= yMin) fail('The canvas needs a positive width and height.')
    return { kind, xMin, xMax, yMin, yMax, xLabel: text(input?.xLabel, 50), yLabel: text(input?.yLabel, 50), grid: Boolean(input?.grid) }
}

const validateTimeline = (input) => {
    if(!input) return null
    return { duration: bounded(input.duration, 0.5, MAX_DURATION, 5), loop: Boolean(input.loop), autoplay: Boolean(input.autoplay) }
}

export const validateParamShape = (input) => {
    const control = PARAM_CONTROLS.has(input?.control) ? input.control : 'slider'
    const id = text(input?.id, 80) || uuid()
    const label = text(input?.label, 80)
    if(control === 'toggle') return { id, label, control, min: 0, max: 1, step: 1, value: input?.value ? 1 : 0, options: [] }
    if(control === 'choice') {
        const options = list(input?.options).slice(0, MAX_CHOICE_OPTIONS).map((option) => ({ label: text(option?.label, 80), value: bounded(option?.value, -COORD_LIMIT, COORD_LIMIT, 0) }))
        if(options.length < 2) fail('A choice control needs at least two options.')
        const values = options.map((option) => option.value)
        const value = values.includes(Number(input?.value)) ? Number(input.value) : values[0]
        return { id, label, control, min: Math.min(...values), max: Math.max(...values), step: 1, value, options }
    }
    const min = bounded(input?.min, -COORD_LIMIT, COORD_LIMIT, 0)
    const max = bounded(input?.max, -COORD_LIMIT, COORD_LIMIT, 100)
    if(max <= min) fail('A control needs a maximum above its minimum.')
    const step = bounded(input?.step, (max - min) / 1000, max - min, 1)
    return { id, label, control, min, max, step, value: bounded(input?.value, min, max, min), options: [] }
}

// Scope is resolved in three passes because the references only run one way: derived values
// see earlier derived values, and a param's update rule sees every param and derived value.
const validateDerived = (input, params) => {
    const entries = []
    list(input).slice(0, MAX_DERIVED).forEach((entry) => {
        const scope = exprScope({ params, derived: entries, variables: [] })
        entries.push({ id: text(entry?.id, 80) || uuid(), label: text(entry?.label, 80), expr: validateExpr(entry?.expr, scope) })
    })
    return uniqueIds(entries, 'values')
}

const validateUpdates = (params, derived, hasTimeline, shared = []) => params.map((param) => {
    if(param.update === undefined || param.update === null) return { ...param, update: null }
    // A rule may read the clock, which is only meaningful on a timeline.
    const scope = exprScope({ params: [...shared, ...params], derived, variables: hasTimeline ? ['t'] : [] })
    return { ...param, update: validateExpr(param.update, scope) }
})

const point = (input, scope) => {
    const pair = list(input)
    if(pair.length !== 2) fail('A point needs an x and a y value.')
    return [validateExpr(pair[0], scope), validateExpr(pair[1], scope)]
}

const validateShape = (input, context) => {
    const kind = input?.kind
    if(!SHAPE_KINDS.has(kind)) fail('Unsupported element shape.')
    const id = text(input?.id, 80) || uuid()
    const { params, derived, baseVariables } = context
    // `i` exists only inside the shape that repeats, so scope is built per shape.
    const repeatInput = input?.repeat
    const outer = exprScope({ params, derived, variables: baseVariables })
    const repeat = repeatInput ? { count: validateExpr(repeatInput.count, outer), as: 'i' } : null
    const variables = repeat ? [...baseVariables, 'i'] : baseVariables
    const scope = exprScope({ params, derived, variables })
    const base = { id, kind, repeat, style: style(input?.style) }
    if(kind === 'curve') {
        const domain = point(input?.domain, scope)
        // `u` runs along the curve, so it is in scope for the drawn point but not the domain.
        const inner = exprScope({ params, derived, variables: [...variables, 'u'] })
        return { ...base, label: text(input?.label, 80), x: validateExpr(input?.x, inner), y: validateExpr(input?.y, inner), domain }
    }
    if(kind === 'path') {
        const points = list(input?.points).slice(0, MAX_PATH_POINTS).map((entry) => point(entry, scope))
        if(points.length < 2) fail('A path needs at least two points.')
        return { ...base, points, closed: Boolean(input?.closed), arrow: ARROWS.has(input?.arrow) ? input.arrow : 'none' }
    }
    if(kind === 'marker') {
        const drag = input?.drag ? { xParam: text(input.drag.xParam, 80), yParam: text(input.drag.yParam, 80) } : null
        if(drag) {
            // Dragging writes two params, so a repeated marker would have every copy writing
            // the same pair — ambiguous, and silently wrong for the reader.
            if(repeat) fail('A draggable point cannot be repeated.')
            const draggable = new Set(params.filter((param) => DRAGGABLE_CONTROLS.has(param.control)).map((param) => param.id))
            if(!draggable.has(drag.xParam) || !draggable.has(drag.yParam)) fail('Dragging needs two slider or stepper parameters.')
            if(drag.xParam === drag.yParam) fail('Dragging needs two different parameters.')
        }
        // Radii are canvas units, not pixels, so a marker keeps its meaning when the canvas rescales.
        return { ...base, at: point(input?.at, scope), radius: validateExpr(input?.radius ?? ['num', 1], scope), glyph: GLYPHS.has(input?.glyph) ? input.glyph : 'disc', label: text(input?.label, 80), drag }
    }
    if(kind === 'region') {
        const between = list(input?.between).map((value) => text(value, 80)).filter(Boolean)
        const under = text(input?.under, 80)
        const referenced = between.length ? between : [under]
        if(between.length && between.length !== 2) fail('Shade between exactly two curves.')
        if(!referenced.length || referenced.some((curveId) => !context.curveIds.has(curveId))) fail('A shaded region needs curves that exist.')
        return { ...base, between: between.length ? between : null, under: between.length ? null : under, domain: point(input?.domain, scope) }
    }
    if(kind === 'label') return { ...base, at: point(input?.at, scope), text: text(input?.text, 80) }
    if(kind === 'image') {
        const url = externalUrl(input?.url)
        if(!url && !context.allowIncomplete) fail('Enter a valid image URL.')
        return { ...base, url: url || '', at: point(input?.at, scope), width: validateExpr(input?.width ?? ['num', 10], scope), height: validateExpr(input?.height ?? ['num', 10], scope), rotation: validateExpr(input?.rotation ?? ['num', 0], scope) }
    }
    return { ...base, at: point(input?.at, scope), from: point(input?.from, scope), to: point(input?.to, scope), radius: validateExpr(input?.radius ?? ['num', 2], scope), showMeasure: Boolean(input?.showMeasure) }
}

// `shared` are the page's variables: the same shape as a param, declared outside the element
// so one slider can drive several elements at once. They resolve through the same ['param', id]
// node, so the grammar and the evaluator are unchanged — only the scope is wider.
export const validateElement = (input, allowIncomplete = false, shared = []) => {
    const canvas = validateCanvas(input?.canvas)
    const timeline = validateTimeline(input?.timeline)
    const paramInput = list(input?.params).slice(0, MAX_PARAMS)
    const params = uniqueIds(paramInput.map(validateParamShape).map((param, index) => ({ ...param, update: paramInput[index]?.update })), 'controls')
    const visible = [...shared, ...params]
    const derived = validateDerived(input?.derived, visible)
    const withUpdates = validateUpdates(params, derived, Boolean(timeline), shared)
    const baseVariables = timeline ? ['t'] : []
    const shapeInput = list(input?.shapes).slice(0, MAX_SHAPES)
    // Region references are resolved against curve ids declared anywhere in the element, so
    // an author can shade between curves they add after the region.
    const curveIds = new Set(shapeInput.filter((shape) => shape?.kind === 'curve').map((shape) => text(shape?.id, 80)).filter(Boolean))
    const inScope = [...shared, ...withUpdates]
    const shapes = uniqueIds(shapeInput.map((shape) => validateShape(shape, { params: inScope, derived, baseVariables, curveIds, allowIncomplete })), 'shapes')
    const readoutScope = exprScope({ params: inScope, derived, variables: baseVariables })
    const readouts = uniqueIds(list(input?.readouts).slice(0, MAX_READOUTS).map((readout) => ({
        id: text(readout?.id, 80) || uuid(), label: text(readout?.label, 80),
        expr: validateExpr(readout?.expr, readoutScope), decimals: Math.round(bounded(readout?.decimals, 0, 3, 1)),
    })), 'readouts')
    const variant = ELEMENT_VARIANTS.has(input?.variant) ? input.variant : 'graph'
    const element = { variant, canvas, timeline, params: withUpdates, derived, shapes, readouts }
    if(!allowIncomplete) {
        if(!shapes.length) fail('Add a shape before publishing.')
        assertDraws(element, shared)
    }
    return element
}

export const paramValues = (element, shared = []) => Object.fromEntries([...shared, ...element.params].map((param) => [param.id, param.value]))

export const derivedValues = (element, params, time = 0) => {
    const values = {}
    element.derived.forEach((entry) => {
        values[entry.id] = evaluateExpr(entry.expr, { params, derived: values, variables: { t: time } })
    })
    return values
}

export const elementFrame = (element, params, time = 0) => ({ params, derived: derivedValues(element, params, time), variables: { t: time } })

// Rules are read from the previous frame and written into a new one, so declaration order
// never changes the result. A non-finite rule keeps its last good value rather than poisoning
// the frame, which is what lets the builder flag it instead of the element going blank.
export const stepParams = (element, params, time, dt = FRAME_SECONDS) => {
    const frame = elementFrame(element, params, time)
    const next = { ...params }
    element.params.forEach((param) => {
        if(!param.update) return
        const value = evaluateExpr(param.update, { ...frame, variables: { ...frame.variables, dt } })
        if(Number.isFinite(value)) next[param.id] = Math.min(Math.max(value, param.min), param.max)
    })
    return next
}

export const repeatCount = (shape, frame) => {
    if(!shape.repeat) return 1
    const count = evaluateExpr(shape.repeat.count, frame)
    return Number.isFinite(count) ? Math.min(Math.max(Math.floor(count), 0), MAX_REPEAT) : 0
}

const curvePoints = (shape, frame, domain) => {
    const [from, to] = domain ?? [evaluateExpr(shape.domain[0], frame), evaluateExpr(shape.domain[1], frame)]
    if(!Number.isFinite(from) || !Number.isFinite(to)) return []
    return Array.from({ length: CURVE_SAMPLES + 1 }, (_, index) => {
        const u = from + ((to - from) * index) / CURVE_SAMPLES
        const variables = { ...frame.variables, u }
        return [evaluateExpr(shape.x, { ...frame, variables }), evaluateExpr(shape.y, { ...frame, variables })]
    })
}

// One geometry source for the renderer and the publish check, so a shape that draws nothing
// on the server draws nothing in the preview too.
export const shapePoints = (shape, frame, element = null) => {
    if(shape.kind === 'curve') return curvePoints(shape, frame)
    if(shape.kind === 'path') return shape.points.map((pair) => evaluatePoint(pair, frame))
    if(shape.kind === 'arc') return [shape.at, shape.from, shape.to].map((pair) => evaluatePoint(pair, frame))
    if(shape.kind === 'region') {
        // A ring, not a concatenation: the second boundary runs back the way it came, which is
        // what makes the shape fillable and keeps each boundary checkable on its own.
        const [first, second] = regionBoundaries(shape, frame, element)
        return second ? [...first, ...[...second].reverse()] : first
    }
    return [evaluatePoint(shape.at, frame)]
}

// Each boundary separately, so the monotone check sees one curve at a time. `under` has a
// single boundary; the renderer closes it along the axis.
export const regionBoundaries = (shape, frame, element) => {
    const domain = [evaluateExpr(shape.domain[0], frame), evaluateExpr(shape.domain[1], frame)]
    return (shape.between ?? [shape.under]).map((curveId) => {
        const curve = element?.shapes.find((entry) => entry.id === curveId && entry.kind === 'curve')
        return curve ? curvePoints(curve, frame, domain) : []
    })
}

const paramSamples = (param) => {
    if(param.control === 'choice') return param.options.map((option) => option.value)
    if(param.control === 'toggle') return [0, 1]
    return [param.min, (param.min + param.max) / 2, param.max]
}

// The corners and midpoint of the parameter space, capped so a wide element stays cheap to
// check. Combinations grow as 3^n, so the cap bites before the work does.
const paramCombinations = (element, shared = []) => {
    let combinations = [paramValues(element, shared)]
    ;[...shared, ...element.params].forEach((param) => {
        if(combinations.length >= MAX_SMOKE_COMBINATIONS) return
        combinations = paramSamples(param).flatMap((value) => combinations.map((combination) => ({ ...combination, [param.id]: value }))).slice(0, MAX_SMOKE_COMBINATIONS)
    })
    return combinations
}

const monotoneByX = (points) => {
    const finite = points.filter(isFinitePoint)
    return finite.every((entry, index) => index === 0 || entry[0] >= finite[index - 1][0])
}

// Publishing runs the element rather than only type-checking it: an author can satisfy every
// bound above and still produce something that never draws, and that is worth catching before
// a reader sees an empty box.
export const assertDraws = (element, shared = []) => {
    const stepped = element.params.some((param) => param.update)
    const times = element.timeline ? [0, element.timeline.duration / 2, element.timeline.duration] : [0]
    let drew = false
    paramCombinations(element, shared).forEach((combination) => {
        times.forEach((time) => {
            // A simulated element may only draw once it has run, so advance it before sampling.
            const params = stepped ? Array.from({ length: 8 }).reduce((current) => stepParams(element, current, time), combination) : combination
            const frame = elementFrame(element, params, time)
            element.shapes.forEach((shape) => {
                if(!repeatCount(shape, frame)) return
                const variables = shape.repeat ? { ...frame.variables, i: 0 } : frame.variables
                const sampled = { ...frame, variables }
                const points = shapePoints(shape, sampled, element)
                if(points.some(isFinitePoint)) drew = true
                if(shape.kind === 'region') regionBoundaries(shape, sampled, element).forEach((boundary) => {
                    if(boundary.length && !monotoneByX(boundary)) fail('Shaded regions need curves that run left to right.')
                })
            })
        })
    })
    if(!drew) fail(`This element doesn't draw anything yet.`)
}

export const elementScope = (element, { variables = [] } = {}) => exprScope({ params: element.params, derived: element.derived, variables: variables.filter((name) => EXPR_VARIABLES.has(name)) })
