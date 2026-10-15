import { FaXmark } from 'react-icons/fa6'
import { HiSelector } from 'react-icons/hi'
import Select from '../../../../shared/components/popovers/Select'
import { EXPR_FUNCTIONS } from '../../utils/elementExpr.js'
import { num } from '../../utils/elementDefaults.js'
import ValuePicker from './ValuePicker'

const OPERATORS = [
    { value: '+', label: 'add' },
    { value: '-', label: 'subtract' },
    { value: '*', label: 'multiply by' },
    { value: '/', label: 'divide by' },
    { value: '^', label: 'to the power of' },
]

const VARIABLE_LABELS = {
    x: 'x position',
    u: 'along the curve',
    t: 'time',
    i: 'copy number',
}

// An expression is edited as nested chips rather than typed as text: there is no syntax to get
// wrong, and the editor's state is the stored tree itself, so nothing has to be parsed.
const Chip = ({ node, scope, onChange, onRemove, depth = 0 }) => {

    const [kind] = node

    const current = kind === 'num' ? 'num' : kind === 'op' ? 'op' : `${kind}:${node[1]}`

    const currentLabel = () => {
        if(kind === 'num') return 'A number'
        if(kind === 'var') return VARIABLE_LABELS[node[1]] ?? node[1]
        if(kind === 'fn') return `${node[1]}(…)`
        const source = kind === 'param' ? scope.params : scope.derived
        return source.find((entry) => entry.id === node[1])?.label || 'Value'
    }

    const replace = (value) => {
        const [type, name] = value.split(':')

        if(type === 'num') return onChange(num(0))
        if(type === 'fn') {
            const { min } = EXPR_FUNCTIONS[name]
            return onChange(['fn', name, ...Array.from({ length: min }, () => num(0))])
        }

        onChange([type, name])
    }

    // Wrapping keeps what the author already built as the left operand, so combining never
    // throws work away.
    const combine = (operator) => onChange(['op', operator, node, num(operator === '*' || operator === '/' || operator === '^' ? 1 : 0)])

    return (
        <span className={`inline-flex flex-wrap items-center gap-1 ${depth ? 'px-1.5 py-1 rounded-lg bg-neutral5' : ''}`}>

            {kind === 'op' ? (
                <>
                    <Chip node={node[2]} scope={scope} depth={depth + 1} onChange={(next) => onChange(['op', node[1], next, node[3]])} />

                    <Select
                        value={node[1]}
                        options={OPERATORS}
                        onChange={(value) => onChange(['op', String(value), node[2], node[3]])}
                    >
                        {() => (
                            <button type='button' className='px-2 py-1 rounded-lg bg-neutral4 text-xs text-neutral0 cursor-pointer hover:bg-neutral3 transition-colors'>
                                {OPERATORS.find((operator) => operator.value === node[1])?.label}
                            </button>
                        )}
                    </Select>

                    <Chip node={node[3]} scope={scope} depth={depth + 1} onChange={(next) => onChange(['op', node[1], node[2], next])} onRemove={() => onChange(node[2])} />
                </>
            ) : (
                <>
                    <ValuePicker current={current} scope={scope} onPick={replace}>
                        {() => (
                            <button type='button' className='flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral4 text-xs text-neutral0 cursor-pointer hover:bg-neutral3 transition-colors'>
                                {currentLabel()}
                                <HiSelector className='text-neutral1' />
                            </button>
                        )}
                    </ValuePicker>

                    {kind === 'num' ? (
                        <input
                            type='number'
                            value={node[1]}
                            onChange={(event) => onChange(num(Number(event.target.value)))}
                            aria-label='Number'
                            className='w-20 px-2 py-1 rounded-lg bg-neutral6 dark:bg-neutral4 text-xs text-neutral0 outline-none border border-neutral4 focus:border-neutral2'
                        />
                    ) : null}

                    {kind === 'fn' ? (
                        <span className='inline-flex flex-wrap items-center gap-1'>
                            {node.slice(2).map((argument, index) => (
                                <Chip
                                    key={index}
                                    node={argument}
                                    scope={scope}
                                    depth={depth + 1}
                                    onChange={(next) => onChange(node.map((entry, position) => (position === index + 2 ? next : entry)))}
                                    onRemove={node.length - 2 > EXPR_FUNCTIONS[node[1]].min ? () => onChange(node.filter((entry, position) => position !== index + 2)) : undefined}
                                />
                            ))}
                            {node.length - 2 < EXPR_FUNCTIONS[node[1]].max ? (
                                <button type='button' onClick={() => onChange([...node, num(0)])} className='px-2 py-1 rounded-lg text-xs text-neutral1 cursor-pointer hover:text-neutral0 transition-colors'>+ value</button>
                            ) : null}
                        </span>
                    ) : null}
                </>
            )}

            {kind !== 'op' ? (
                <Select value='' options={OPERATORS} onChange={(value) => combine(String(value))}>
                    {() => (
                        <button type='button' aria-label='Combine with another value' className='px-2 py-1 rounded-lg text-xs text-neutral1 cursor-pointer hover:text-neutral0 transition-colors'>+</button>
                    )}
                </Select>
            ) : null}

            {onRemove ? (
                <button type='button' onClick={onRemove} aria-label='Remove this part' className='p-1 text-neutral1 cursor-pointer hover:text-red-500 transition-colors'>
                    <FaXmark className='text-[10px]' />
                </button>
            ) : null}

        </span>
    )
}

const ExpressionField = ({ label, value, scope, onChange }) => (
    <label className='flex flex-col gap-1.5 text-xs font-semibold text-neutral0'>
        {label}
        <span className='flex flex-wrap items-center gap-1 p-2 rounded-xl border border-neutral4'>
            <Chip node={value ?? num(0)} scope={scope} onChange={onChange} />
        </span>
    </label>
)

export default ExpressionField
