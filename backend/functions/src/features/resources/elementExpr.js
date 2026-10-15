// Shared evaluator for interactive-element expressions. Kept dependency-free and pure so
// the renderer and the server validator agree exactly: what an author previews is what
// publishing accepts. The frontend holds a byte-identical copy — see elementExpr.test.js.

export const MAX_EXPR_DEPTH = 6
export const MAX_EXPR_NODES = 48
export const MIN_POWER = -4
export const MAX_POWER = 4

export const EXPR_VARIABLES = new Set(['x', 'u', 't', 'i'])
const OPERATORS = new Set(['+', '-', '*', '/', '^'])

// Arity is checked at validation time so evaluation never has to guard argument counts.
// `pow` is deliberately absent: `^` is the only exponent path, which keeps the exponent
// bound in MIN_POWER..MAX_POWER impossible to route around.
const FUNCTIONS = {
    abs: { min: 1, max: 1, apply: (a) => Math.abs(a) },
    sqrt: { min: 1, max: 1, apply: (a) => (a < 0 ? NaN : Math.sqrt(a)) },
    exp: { min: 1, max: 1, apply: (a) => Math.exp(a) },
    ln: { min: 1, max: 1, apply: (a) => (a <= 0 ? NaN : Math.log(a)) },
    floor: { min: 1, max: 1, apply: (a) => Math.floor(a) },
    round: { min: 1, max: 1, apply: (a) => Math.round(a) },
    sin: { min: 1, max: 1, apply: (a) => Math.sin(a) },
    cos: { min: 1, max: 1, apply: (a) => Math.cos(a) },
    tan: { min: 1, max: 1, apply: (a) => Math.tan(a) },
    atan2: { min: 2, max: 2, apply: (a, b) => Math.atan2(a, b) },
    min: { min: 2, max: 4, apply: (...args) => Math.min(...args) },
    max: { min: 2, max: 4, apply: (...args) => Math.max(...args) },
    clamp: { min: 3, max: 3, apply: (a, low, high) => Math.min(Math.max(a, low), high) },
}

export const EXPR_FUNCTIONS = Object.fromEntries(Object.entries(FUNCTIONS).map(([name, fn]) => [name, { min: fn.min, max: fn.max }]))

const fail = (message) => { throw new Error(message) }

// Scope is passed in rather than inferred because the same rules drive the chip editor's
// "what can I reference here" list: `u` only inside a curve, `i` only inside a repeated
// shape, `t` only when the element has a timeline.
export const exprScope = ({ params = [], derived = [], variables = [] } = {}) => ({
    params: new Set(params.map((param) => (typeof param === 'string' ? param : param?.id)).filter(Boolean)),
    derived: new Set(derived.map((entry) => (typeof entry === 'string' ? entry : entry?.id)).filter(Boolean)),
    variables: new Set(variables.filter((name) => EXPR_VARIABLES.has(name))),
})

const validateNode = (node, scope, depth, counter) => {
    if(depth > MAX_EXPR_DEPTH) fail('This expression is nested too deeply.')
    if(++counter.nodes > MAX_EXPR_NODES) fail('This expression is too long.')
    if(!Array.isArray(node) || !node.length) fail('Malformed expression.')
    const [kind] = node
    if(kind === 'num') {
        const value = Number(node[1])
        if(!Number.isFinite(value)) fail('Expression numbers must be finite.')
        return ['num', value]
    }
    if(kind === 'param') {
        const id = String(node[1] ?? '')
        if(!scope.params.has(id)) fail(`Expression references a parameter that doesn't exist.`)
        return ['param', id]
    }
    if(kind === 'derived') {
        const id = String(node[1] ?? '')
        if(!scope.derived.has(id)) fail(`Expression references a value that doesn't exist here.`)
        return ['derived', id]
    }
    if(kind === 'var') {
        const name = String(node[1] ?? '')
        if(!EXPR_VARIABLES.has(name)) fail('Unknown expression variable.')
        if(!scope.variables.has(name)) fail(`"${name}" can't be used here.`)
        return ['var', name]
    }
    if(kind === 'op') {
        const symbol = String(node[1] ?? '')
        if(!OPERATORS.has(symbol)) fail('Unsupported operator.')
        const left = validateNode(node[2], scope, depth + 1, counter)
        const right = validateNode(node[3], scope, depth + 1, counter)
        // An exponent has to be a literal integer in range: a computed one could be driven
        // to an arbitrary size by a slider and make evaluation cost unbounded.
        if(symbol === '^') {
            if(right[0] !== 'num' || !Number.isInteger(right[1]) || right[1] < MIN_POWER || right[1] > MAX_POWER) fail(`Exponents must be whole numbers from ${MIN_POWER} to ${MAX_POWER}.`)
        }
        return ['op', symbol, left, right]
    }
    if(kind === 'fn') {
        const name = String(node[1] ?? '')
        const fn = FUNCTIONS[name]
        if(!fn) fail('Unsupported function.')
        const args = node.slice(2)
        if(args.length < fn.min || args.length > fn.max) fail(`${name} takes ${fn.min === fn.max ? fn.min : `${fn.min} to ${fn.max}`} values.`)
        return ['fn', name, ...args.map((arg) => validateNode(arg, scope, depth + 1, counter))]
    }
    return fail('Unsupported expression.')
}

// Returns a normalized copy, so callers store the validated tree rather than the input.
export const validateExpr = (expr, scope) => validateNode(expr, scope, 1, { nodes: 0 })

const applyOperator = (symbol, left, right) => {
    if(symbol === '+') return left + right
    if(symbol === '-') return left - right
    if(symbol === '*') return left * right
    // Division and roots yield NaN rather than Infinity so a single rule covers every
    // undefined result: non-finite means "skip this sample", never a thrown error.
    if(symbol === '/') return right === 0 ? NaN : left / right
    return left ** right
}

// May return NaN or Infinity by design; callers skip the sample instead of failing.
export const evaluateExpr = (expr, context = {}) => {
    const { params = {}, derived = {}, variables = {} } = context
    const walk = (node) => {
        const [kind] = node
        if(kind === 'num') return node[1]
        if(kind === 'param') return Number(params[node[1]] ?? NaN)
        if(kind === 'derived') return Number(derived[node[1]] ?? NaN)
        if(kind === 'var') return Number(variables[node[1]] ?? NaN)
        if(kind === 'op') return applyOperator(node[1], walk(node[2]), walk(node[3]))
        return FUNCTIONS[node[1]].apply(...node.slice(2).map(walk))
    }
    const value = walk(expr)
    return typeof value === 'number' ? value : NaN
}

export const evaluatePoint = (point, context) => [evaluateExpr(point[0], context), evaluateExpr(point[1], context)]

export const isFinitePoint = (point) => Number.isFinite(point[0]) && Number.isFinite(point[1])
