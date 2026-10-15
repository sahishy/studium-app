// Pure geometry for the interactive-element renderer: data space to SVG space, and the path
// strings the SVG needs. Frontend-only — the shared model supplies the points, this decides
// where they land on screen.

import { isFinitePoint } from './elementExpr.js'

export const VIEW = { width: 480, height: 300 }
export const PLOT = { left: 44, right: 12, top: 14, bottom: 34 }
export const SERIES_COLORS = 6
export const TICKS = 4

export const seriesColor = (index) => `var(--color-series${((index % SERIES_COLORS) + SERIES_COLORS) % SERIES_COLORS})`

export const plotBox = () => ({
    x: PLOT.left,
    y: PLOT.top,
    width: VIEW.width - PLOT.left - PLOT.right,
    height: VIEW.height - PLOT.top - PLOT.bottom,
})

export const projector = (canvas) => {
    const box = plotBox()
    const spanX = canvas.xMax - canvas.xMin
    const spanY = canvas.yMax - canvas.yMin
    return {
        box,
        // y inverts because SVG counts downward and readers expect up to mean more.
        toView: ([x, y]) => [box.x + ((x - canvas.xMin) / spanX) * box.width, box.y + box.height - ((y - canvas.yMin) / spanY) * box.height],
        toData: ([vx, vy]) => [canvas.xMin + ((vx - box.x) / box.width) * spanX, canvas.yMin + ((box.y + box.height - vy) / box.height) * spanY],
        scaleX: (value) => (value / spanX) * box.width,
        scaleY: (value) => (value / spanY) * box.height,
    }
}

// Non-finite samples break the line rather than joining across a gap, so an asymptote reads
// as a gap instead of a near-vertical jump through the whole plot.
export const polylineSegments = (points, project) => {
    const segments = []
    let current = []
    points.forEach((point) => {
        if(isFinitePoint(point)) return current.push(project(point))
        if(current.length > 1) segments.push(current)
        current = []
    })
    if(current.length > 1) segments.push(current)
    return segments
}

export const pointsAttribute = (viewPoints) => viewPoints.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')

export const ringPath = (points, project) => {
    const finite = points.filter(isFinitePoint).map(project)
    if(finite.length < 3) return ''
    return `${finite.map(([x, y], index) => `${index ? 'L' : 'M'}${round(x)},${round(y)}`).join(' ')} Z`
}

// `under` regions have one boundary; the fill closes along the canvas floor.
export const underPath = (points, project, canvas) => {
    const finite = points.filter(isFinitePoint)
    if(finite.length < 2) return ''
    const floor = Math.max(canvas.yMin, 0)
    const closed = [[finite[finite.length - 1][0], floor], [finite[0][0], floor]]
    return ringPath([...finite, ...closed], project)
}

export const arrowHead = (from, to, size = 7) => {
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0])
    const wing = (offset) => [to[0] - size * Math.cos(angle - offset), to[1] - size * Math.sin(angle - offset)]
    return pointsAttribute([to, wing(0.4), wing(-0.4)])
}

export const arcPath = (at, from, to, radius, project) => {
    const angleTo = (point) => Math.atan2(point[1] - at[1], point[0] - at[0])
    const start = angleTo(from)
    const end = angleTo(to)
    const edge = (angle) => project([at[0] + radius * Math.cos(angle), at[1] + radius * Math.sin(angle)])
    const [sx, sy] = edge(start)
    const [ex, ey] = edge(end)
    const sweep = Math.abs(end - start) > Math.PI ? 1 : 0
    // The sweep flag is inverted because the projection flips y.
    return `M${round(sx)},${round(sy)} A${round(Math.abs(project([at[0] + radius, at[1]])[0] - project(at)[0]))},${round(Math.abs(project(at)[1] - project([at[0], at[1] + radius])[1]))} 0 ${sweep} ${end > start ? 0 : 1} ${round(ex)},${round(ey)}`
}

export const arcMeasure = (at, from, to) => {
    const angleTo = (point) => Math.atan2(point[1] - at[1], point[0] - at[0])
    const degrees = ((angleTo(to) - angleTo(from)) * 180) / Math.PI
    const wrapped = ((degrees % 360) + 360) % 360
    return Math.round(wrapped > 180 ? 360 - wrapped : wrapped)
}

export const axisTicks = (min, max, count = TICKS) => Array.from({ length: count + 1 }, (_, index) => min + ((max - min) * index) / count)

export const formatTick = (value) => {
    const rounded = Math.round(value * 100) / 100
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

// Readouts are interpolated into label text so an author can name a value without duplicating
// the expression that produced it.
export const interpolate = (template, readouts) => String(template ?? '').replace(/\{([^}]{1,80})\}/g, (match, id) => {
    const readout = readouts.find((entry) => entry.id === id || entry.label === id)
    return readout ? readout.text : match
})

const round = (value) => Math.round(value * 100) / 100

export const snapToStep = (value, { min, max, step }) => {
    const stepped = step > 0 ? min + Math.round((value - min) / step) * step : value
    return Math.min(Math.max(stepped, min), max)
}
