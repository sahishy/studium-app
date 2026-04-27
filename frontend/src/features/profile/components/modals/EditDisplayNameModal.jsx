import { useMemo, useState } from 'react'
import Button from '../../../../shared/components/ui/Button'
import { hasFlaggedWords } from '../../../../shared/services/censorService'
import { validateDisplayNameFormat } from '../../utils/profileUtils'
import { FaCircleExclamation, FaExclamation } from 'react-icons/fa6'

const EditDisplayNameModal = ({
    value = '',
    closeModal,
    onSave,
}) => {
    const [draftValue, setDraftValue] = useState(value)

    const validation = useMemo(() => {

        const baseValidation = validateDisplayNameFormat(draftValue)
        if(!baseValidation.isValid) {
            return baseValidation
        }

        if(hasFlaggedWords(String(draftValue).trim())) {
            return { isValid: false, error: 'Inappropriate name.' }
        }

        return { isValid: true, error: '' }

    }, [draftValue])

    const handleSave = () => {
        if(!validation.isValid) {
            return
        }

        onSave?.(String(draftValue).trim())
        closeModal?.()
    }

    return (
        <div className='flex flex-col gap-8'>
            <h1 className='text-2xl font-semibold text-center'>Edit Display Name</h1>

            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    handleSave()
                }}
                className='flex flex-col gap-4'
            >
                <input
                    type='text'
                    value={draftValue}
                    onChange={(event) => setDraftValue(event.target.value)}
                    className='w-full p-4 border-2 border-neutral4 rounded-xl focus:outline-gray-400 bg-neutral6 text-neutral0'
                    placeholder='Only letters and numbers'
                    required={true}
                />
                {!validation.isValid ? (
                    <p className='text-sm text-red-400 flex items-center gap-2'><FaCircleExclamation/> {validation.error}</p>
                ) : null}

                <div className='flex gap-4 mt-4'>
                    <Button onClick={closeModal} className='w-full py-4'>Cancel</Button>
                    <Button htmlType='submit' type='primary' className='w-full py-4' disabled={!validation.isValid}>
                        Save
                    </Button>
                </div>
            </form>
        </div>
    )
}

export default EditDisplayNameModal