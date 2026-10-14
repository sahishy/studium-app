import { useMemo, useState } from 'react'
import { FaClock, FaDivide, FaHashtag, FaMagnifyingGlass, FaRepeat, FaSliders, FaWaveSquare } from 'react-icons/fa6'
import BasePopover from '../../../../shared/components/popovers/BasePopover'
import { EXPR_FUNCTIONS } from '../../utils/elementExpr.js'

// What each function is for, in words a student would use. A bare list of names assumes you
// already know trigonometry is in there.
const FUNCTION_HELP = {
    abs: 'Distance from zero — turns negatives positive.',
    sqrt: 'Square root.',
    exp: 'e to the power of a number — growth.',
    ln: 'Natural logarithm — the inverse of growth.',
    floor: 'Round down to a whole number.',
    round: 'Round to the nearest whole number.',
    sin: 'Sine — up and down waves, or the y part of an angle.',
    cos: 'Cosine — the x part of an angle.',
    tan: 'Tangent — slope of an angle.',
    atan2: 'The angle between two points.',
    min: 'The smaller of the values.',
    max: 'The larger of the values.',
    clamp: 'Keep a value between a low and a high limit.',
}

const VARIABLE_HELP = {
    x: { label: 'x position', hint: 'Where you are across the canvas.', icon: <FaHashtag /> },
    u: { label: 'Along the curve', hint: 'Runs from the start of the curve to its end.', icon: <FaWaveSquare /> },
    t: { label: 'Time', hint: 'Seconds since the timeline started.', icon: <FaClock /> },
    i: { label: 'Copy number', hint: 'Which copy this is: 0, 1, 2 and so on.', icon: <FaRepeat /> },
}

const buildOptions = (scope) => [
    { value: 'num', group: 'Value', label: 'A number', hint: 'Type any fixed number.', icon: <FaHashtag /> },
    ...scope.params.map((param) => ({ value: `param:${param.id}`, group: 'Variables', label: param.label || 'Control', hint: 'Changes when the reader moves it.', icon: <FaSliders /> })),
    ...scope.derived.map((entry) => ({ value: `derived:${entry.id}`, group: 'Variables', label: entry.label || 'Step', hint: 'A value worked out earlier.', icon: <FaDivide /> })),
    ...scope.variables.map((name) => ({ value: `var:${name}`, group: 'Position', label: VARIABLE_HELP[name]?.label ?? name, hint: VARIABLE_HELP[name]?.hint, icon: VARIABLE_HELP[name]?.icon ?? <FaHashtag /> })),
    ...Object.keys(EXPR_FUNCTIONS).map((name) => ({ value: `fn:${name}`, group: 'Maths', label: `${name}(…)`, hint: FUNCTION_HELP[name], icon: <FaDivide /> })),
]

// A searchable list beats a thirty-item dropdown: you can type what you want, and every entry
// says what it does.
const ValuePicker = ({ current, scope, onPick, children }) => {

    const [query, setQuery] = useState('')
    const options = useMemo(() => buildOptions(scope), [scope])

    const matches = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return options.filter((option) => !needle || `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(needle))
    }, [options, query])

    const groups = useMemo(() => matches.reduce((all, option) => {
        return { ...all, [option.group]: [...(all[option.group] ?? []), option] }
    }, {}), [matches])

    const content = (closePopover) => (
        <div className='flex flex-col w-72 max-h-80'>

            <div className='flex items-center gap-2 px-3 py-2.5 border-b border-neutral4'>
                <FaMagnifyingGlass className='shrink-0 text-xs text-neutral1' />
                <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder='Search values and maths'
                    aria-label='Search values'
                    className='w-full bg-transparent text-sm text-neutral0 outline-none placeholder:text-neutral2'
                />
            </div>

            <div className='flex flex-col gap-2 p-2 overflow-y-auto no-scrollbar'>
                {Object.entries(groups).map(([group, entries]) => (
                    <div key={group} className='flex flex-col gap-0.5'>
                        <p className='px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral2'>{group}</p>
                        {entries.map((option) => (
                            <button
                                key={option.value}
                                type='button'
                                onClick={() => { onPick(option.value); setQuery(''); closePopover() }}
                                className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left cursor-pointer transition-colors
                                    ${option.value === current ? 'bg-neutral5' : 'hover:bg-neutral5'}`}
                            >
                                <span className='mt-0.5 shrink-0 text-xs text-neutral1'>{option.icon}</span>
                                <span className='min-w-0'>
                                    <span className='block text-sm text-neutral0'>{option.label}</span>
                                    {option.hint ? <span className='block text-[11px] leading-4 text-neutral1'>{option.hint}</span> : null}
                                </span>
                            </button>
                        ))}
                    </div>
                ))}

                {matches.length ? null : <p className='px-2 py-3 text-xs text-neutral1'>Nothing matches “{query}”.</p>}
            </div>

        </div>
    )

    return <BasePopover content={content}>{children}</BasePopover>
}

export default ValuePicker
