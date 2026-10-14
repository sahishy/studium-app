import { FaPen, FaSliders } from 'react-icons/fa6'
import { HiSelector } from 'react-icons/hi'
import BooleanSelect from '../../../shared/components/ui/BooleanSelect'
import Select from '../../../shared/components/popovers/Select'
import { formatTick } from '../utils/elementGeometry.js'

// One strip per page rather than one per element: a variable belongs to the page, so a single
// slider can move everything on it at once.
const VariableControl = ({ variable, value, onChange }) => {

    if(variable.control === 'toggle') {
        return (
            <div className='flex items-center justify-between gap-3 text-xs font-semibold text-neutral0'>
                {variable.label}
                <BooleanSelect
                    value={value === 1}
                    onChange={(next) => onChange(next ? 1 : 0)}
                    leftOption={{ value: false, label: 'Off' }}
                    rightOption={{ value: true, label: 'On' }}
                />
            </div>
        )
    }

    if(variable.control === 'choice') {
        const selected = variable.options.find((option) => option.value === value)

        return (
            <div className='flex items-center justify-between gap-3 text-xs font-semibold text-neutral0'>
                {variable.label}
                <Select value={value} options={variable.options.map((option) => ({ value: option.value, label: option.label }))} onChange={(next) => onChange(Number(next))}>
                    {() => (
                        <button type='button' className='flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral5 text-xs font-normal text-neutral0 cursor-pointer hover:bg-neutral4 transition-colors'>
                            {selected?.label ?? 'Choose'}
                            <HiSelector className='text-neutral1' />
                        </button>
                    )}
                </Select>
            </div>
        )
    }

    if(variable.control === 'stepper') {
        return (
            <div className='flex items-center justify-between gap-3 text-xs font-semibold text-neutral0'>
                {variable.label}
                <div className='flex items-center gap-2'>
                    <button type='button' aria-label={`Decrease ${variable.label}`} onClick={() => onChange(value - variable.step)} className='px-2 py-0.5 rounded-lg bg-neutral5 cursor-pointer hover:bg-neutral4 transition-colors'>−</button>
                    <output className='min-w-10 text-center font-normal text-neutral1'>{formatTick(value)}</output>
                    <button type='button' aria-label={`Increase ${variable.label}`} onClick={() => onChange(value + variable.step)} className='px-2 py-0.5 rounded-lg bg-neutral5 cursor-pointer hover:bg-neutral4 transition-colors'>+</button>
                </div>
            </div>
        )
    }

    return (
        <label className='flex flex-col gap-1 text-xs font-semibold text-neutral0'>
            <span className='flex items-center justify-between gap-3'>
                {variable.label}
                <output className='font-normal text-neutral1'>{formatTick(value)}</output>
            </span>
            <input
                type='range'
                min={variable.min}
                max={variable.max}
                step={variable.step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className='w-full accent-sat1 cursor-pointer'
            />
        </label>
    )
}

const VariableControls = ({ variables = [], values, onChange, onEdit, selectedId, className = '' }) => {

    if(!variables.length) return null

    return (
        <div className={`flex flex-col gap-3 px-4 py-3 rounded-2xl bg-neutral6 ${className}`}>

            <p className='flex items-center gap-2 text-xs text-neutral1'>
                <FaSliders className='text-[10px]' /> Try changing these
            </p>

            <div className='grid gap-3 sm:grid-cols-2'>
                {variables.map((variable) => (
                    <div
                        key={variable.id}
                        className={`group/variable flex items-start gap-2 rounded-lg transition-colors ${variable.id === selectedId ? 'ring-1 ring-sat1 p-2 -m-2' : ''}`}
                    >
                        <div className='min-w-0 flex-1'>
                            <VariableControl
                                variable={variable}
                                value={values[variable.id] ?? variable.value}
                                onChange={(next) => onChange(variable.id, next)}
                            />
                        </div>

                        {/* In the builder each control doubles as the way into its settings, so a
                            variable is one thing on screen rather than a chip and a slider. */}
                        {onEdit ? (
                            <button
                                type='button'
                                aria-label={`Edit ${variable.label}`}
                                onClick={() => onEdit(variable.id)}
                                className='shrink-0 p-1.5 rounded-md text-[10px] text-neutral1 opacity-0 group-hover/variable:opacity-100 focus:opacity-100 cursor-pointer hover:text-neutral0 hover:bg-neutral5 transition'
                            >
                                <FaPen />
                            </button>
                        ) : null}
                    </div>
                ))}
            </div>

        </div>
    )
}

export default VariableControls
