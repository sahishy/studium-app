// Mirrors backend/functions/src/features/mastery/masteryService.js. The ids are the exact domain
// strings the SAT question bank carries, so they have to match that list character for character.
// Eight domains, four per section - the web is an octagon rather than a hexagon because collapsing
// the four Math domains into fewer axes would make "get better at Geometry" unreadable, which is
// the one thing the chart exists to say.
const SAT_DOMAINS = Object.freeze([
    { id: 'Information and Ideas', section: 'reading', label: 'Information & Ideas', short: 'Info' },
    { id: 'Craft and Structure', section: 'reading', label: 'Craft & Structure', short: 'Craft' },
    { id: 'Expression of Ideas', section: 'reading', label: 'Expression of Ideas', short: 'Expression' },
    { id: 'Standard English Conventions', section: 'reading', label: 'Standard English Conventions', short: 'Conventions' },
    { id: 'Algebra', section: 'math', label: 'Algebra', short: 'Algebra' },
    { id: 'Advanced Math', section: 'math', label: 'Advanced Math', short: 'Advanced' },
    { id: 'Problem-Solving and Data Analysis', section: 'math', label: 'Problem-Solving & Data', short: 'Data' },
    { id: 'Geometry and Trigonometry', section: 'math', label: 'Geometry & Trigonometry', short: 'Geometry' },
])

const SECTION_LABELS = Object.freeze({ reading: 'Reading & Writing', math: 'Math' })

// A domain needs this many answers before its axis is treated as settled. Below it the vertex is
// drawn hollow, so a single lucky question never reads as mastery.
const MASTERY_CONFIDENCE_THRESHOLD = 10

// Always returns all eight axes in a fixed order, so the polygon keeps its shape whatever the
// server sent and a missing domain reads as zero rather than deforming the chart.
const normalizeDomains = (domains = []) => {
    const byId = new Map((Array.isArray(domains) ? domains : []).map((domain) => [domain?.id, domain]))

    return SAT_DOMAINS.map((domain) => {
        const stored = byId.get(domain.id) ?? {}
        const answered = Math.max(0, Number(stored.answered) || 0)

        return {
            ...domain,
            answered,
            correct: Math.max(0, Number(stored.correct) || 0),
            accuracy: answered ? Math.min(1, Math.max(0, Number(stored.accuracy) || 0)) : 0.5,
            lifetimeAccuracy: Math.min(1, Math.max(0, Number(stored.lifetimeAccuracy) || 0)),
            confident: Boolean(stored.confident ?? (answered >= MASTERY_CONFIDENCE_THRESHOLD)),
        }
    })
}

// Vertex positions for a regular polygon with one axis pointing straight up. The centre is given
// as {x, y} rather than a single number because the chart sits in a wider-than-tall viewBox - the
// axis labels on the left and right need far more room than the ones at the top and bottom.
const axisPoint = (index, count, radius, center) => {
    const angle = (Math.PI * 2 * index) / count - (Math.PI / 2)
    return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
    }
}

const polygonPoints = (values, { count, radius, center, minimum = 0 }) => values
    .map((value, index) => {
        const scaled = minimum + ((radius - minimum) * Math.min(1, Math.max(0, value)))
        const point = axisPoint(index, count, scaled, center)
        return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
    })
    .join(' ')

// A periodic cubic spline passes through every score with continuous slope AND
// curvature. Solving tangents together lets both peaks and troughs round naturally,
// instead of pinching low scores with handles proportional to their radius.
const smoothRadarPath = (values, { radius, center }) => {
    const count = values.length
    if(count < 3) return ''
    const points = values.map((value, index) => axisPoint(
        index, count, radius * Math.min(1, Math.max(0, Number(value) || 0)), center,
    ))
    // For a closed spline: tangent[i-1] + 4*tangent[i] + tangent[i+1]
    // equals 3*(point[i+1] - point[i-1]). The two last columns solve X and Y.
    const system = points.map((point, index) => {
        const previousIndex = (index + count - 1) % count
        const nextIndex = (index + 1) % count
        const row = Array(count + 2).fill(0)
        row[index] = 4
        row[previousIndex] = 1
        row[nextIndex] = 1
        row[count] = 3 * (points[nextIndex].x - points[previousIndex].x)
        row[count + 1] = 3 * (points[nextIndex].y - points[previousIndex].y)
        return row
    })
    // The strictly diagonally dominant system has stable, nonzero pivots.
    for(let column = 0; column < count; column += 1) {
        const pivot = system[column][column]
        for(let entry = column; entry < count + 2; entry += 1) system[column][entry] /= pivot
        for(let row = 0; row < count; row += 1) {
            if(row === column) continue
            const factor = system[row][column]
            for(let entry = column; entry < count + 2; entry += 1) system[row][entry] -= factor * system[column][entry]
        }
    }
    const vertices = points.map((point, index) => ({
        ...point, dx: system[index][count] / 3, dy: system[index][count + 1] / 3,
    }))
    const coordinates = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`
    return `M ${coordinates(vertices[0].x, vertices[0].y)} ${vertices.map((point, index) => {
        const next = vertices[(index + 1) % count]
        return `C ${coordinates(point.x + point.dx, point.y + point.dy)} ${coordinates(next.x - next.dx, next.y - next.dy)} ${coordinates(next.x, next.y)}`
    }).join(' ')} Z`
}

const ringPoints = (fraction, { count, radius, center }) => polygonPoints(
    Array.from({ length: count }, () => fraction),
    { count, radius, center },
)

const formatAccuracy = (accuracy) => `${Math.round(Math.min(1, Math.max(0, Number(accuracy) || 0)) * 100)}%`

const domainById = (id) => SAT_DOMAINS.find((domain) => domain.id === id) ?? null

export {
    MASTERY_CONFIDENCE_THRESHOLD,
    SAT_DOMAINS,
    SECTION_LABELS,
    axisPoint,
    domainById,
    formatAccuracy,
    normalizeDomains,
    polygonPoints,
    ringPoints,
    smoothRadarPath,
}
