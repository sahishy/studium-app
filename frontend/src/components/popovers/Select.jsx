import BasePopover from './BasePopover'
import { HiSelector } from 'react-icons/hi'

const Select = ({
    options = [],
    value = null,
    onChange = () => {},
    onSelect = null,
    isOptionSelected = null,
    className = '',
    placeholder = 'Select...',
    children = null,
    renderTrigger = null,
}) => {
    const getOptionValue = (option, index) => {
        if(option?.value != null) return option.value
        if(option?.uid != null) return option.uid
        if(option?.id != null) return option.id
        return index
    }

    const selectedOption = options.find((option, index) => {
        if(typeof isOptionSelected === 'function') {
            return Boolean(isOptionSelected(option))
        }

        return String(getOptionValue(option, index)) === String(value)
    }) ?? null

    const selectContent = (closePopover) => (
        <ul className='flex flex-col min-w-56'>
            {options.map((option, index) => {
                const optionValue = getOptionValue(option, index)
                const isSelected = typeof isOptionSelected === 'function'
                    ? Boolean(isOptionSelected(option))
                    : String(optionValue) === String(value)

                return (
                    <li
                        key={String(optionValue)}
                        onClick={() => {
                            if(typeof onSelect === 'function') {
                                onSelect(option)
                            }

                            if(typeof onChange === 'function') {
                                onChange(optionValue, option)
                            }

                            closePopover()
                        }}
                        className={`flex items-center justify-between p-2 text-sm rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-neutral4 text-neutral0' : 'text-neutral0 hover:bg-neutral5'}`}
                    >
                        <span className='flex items-center gap-2 truncate'>
                            {option?.icon ? <span className='text-neutral1'>{option.icon}</span> : null}
                            <span className='truncate'>{option.label}</span>
                        </span>
                    </li>
                )
            })}
        </ul>
    )

    return (
        <BasePopover content={selectContent} className={className}>
            {(isOpen) => {
                if(typeof children === 'function') {
                    return children(isOpen)
                }

                if(renderTrigger) {
                    return renderTrigger({ isOpen, selectedOption })
                }

                return (
                    <button
                        type='button'
                        className='w-full flex items-center justify-between px-4 py-3 rounded-xl border border-neutral4 text-left text-sm text-neutral0 hover:bg-neutral5 transition-colors cursor-pointer'
                    >
                        <span className='truncate text-neutral0'>
                            {selectedOption?.label ?? placeholder}
                        </span>
                        <HiSelector className='text-neutral1 '/>
                    </button>
                )
            }}
        </BasePopover>
    )
}

export default Select