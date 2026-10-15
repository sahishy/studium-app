import { FaCircleExclamation } from 'react-icons/fa6'

const TextField = ({
    label = '',
    value = '',
    onChange,
    placeholder = '',
    type = 'text',
    rows = 0,
    error = '',
    hint = '',
    maxLength,
    className = '',
    autoFocus = false,
}) => {

    const isMultiline = rows > 0

    const sharedClass = `w-full bg-neutral5 px-4 py-3 text-sm text-neutral0 outline-neutral3 transition-colors
        placeholder:text-neutral2 ${isMultiline ? 'rounded-2xl resize-none' : 'rounded-full'}`

    return (
        <label className={`flex flex-col gap-1.5 ${className}`}>

            {label ? (
                <span className='text-xs font-semibold text-neutral1 px-1'>{label}</span>
            ) : null}

            {isMultiline ? (
                <textarea
                    rows={rows}
                    value={value ?? ''}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    onChange={(event) => onChange?.(event.target.value)}
                    className={sharedClass}
                />
            ) : (
                <input
                    type={type}
                    value={value ?? ''}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    onChange={(event) => onChange?.(event.target.value)}
                    className={sharedClass}
                />
            )}

            {error ? (
                <p className='flex items-center gap-2 text-xs text-red-400 px-1'><FaCircleExclamation />{error}</p>
            ) : hint ? (
                <p className='text-xs text-neutral2 px-1'>{hint}</p>
            ) : null}

        </label>
    )
}

export default TextField
