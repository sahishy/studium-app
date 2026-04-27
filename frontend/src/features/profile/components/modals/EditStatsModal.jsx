import { useMemo, useState } from 'react'
import Button from '../../../../shared/components/ui/Button'
import { isNumberInRange } from '../../utils/profileUtils'
import { FaCircleExclamation } from 'react-icons/fa6'

const EditStatsModal = ({
    title,
    label,
    value,
    min,
    max,
    step = 1,
    closeModal,
    onSave,
}) => {
    const [draftValue, setDraftValue] = useState(value ?? '')

    const isValid = useMemo(() => {
        return isNumberInRange(draftValue, min, max)
    }, [draftValue, min, max])

    const handleSave = () => {
        if (!isValid) {
            return
        }

        onSave?.(draftValue)
        closeModal?.()
    }

    return (
        <div className='flex flex-col gap-8'>
            <h1 className='text-2xl font-semibold text-center'>{title}</h1>

            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    handleSave()
                }}
                className='flex flex-col gap-4'
            >
                <input
                    type='number'
                    min={min}
                    max={max}
                    step={step}
                    value={draftValue}
                    onChange={(event) => setDraftValue(event.target.value)}
                    className='w-full p-4 border-2 border-neutral4 rounded-xl focus:outline-gray-400 bg-neutral6 text-neutral0'
                    placeholder={label}
                />

                {!isValid ? (
                    <p className='text-sm text-red-400 flex items-center gap-2'><FaCircleExclamation /> Value must be between {min} and {max}.</p>
                ) : null}

                <div className='flex gap-4 mt-4'>
                    <Button onClick={closeModal} className='w-full py-4'>Cancel</Button>
                    <Button htmlType='submit' type='primary' className='w-full py-4' disabled={!isValid}>
                        Save
                    </Button>
                </div>
            </form>
        </div>
    )
}

export default EditStatsModal