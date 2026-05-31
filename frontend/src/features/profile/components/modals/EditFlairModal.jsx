import { useMemo, useState } from 'react'
import { FaCircleExclamation } from 'react-icons/fa6'
import { FLAIR_OPTIONS } from '../../../auth/utils/userUtils'
import Button from '../../../../shared/components/ui/Button'
import Card from '../../../../shared/components/ui/Card'

const EditFlairModal = ({ currentFlair = '', closeModal, onSave }) => {

    const [draftFlair, setDraftFlair] = useState(currentFlair)
    const [isSaving, setIsSaving] = useState(false)
    const [submitError, setSubmitError] = useState('')

    const selectedOption = FLAIR_OPTIONS.find((option) => option.value === draftFlair)

    const handleSave = async () => {

        setSubmitError('')
        setIsSaving(true)

        try {
            await onSave?.(draftFlair)
            closeModal?.()
        } catch (error) {
            setSubmitError(error?.message || 'Unable to update flair.')
        } finally {
            setIsSaving(false)
        }
        
    }

    return (
        <div className='flex flex-col gap-8'>
            <h1 className='text-2xl font-semibold text-center'>Edit Flair</h1>

            <div className='flex justify-center flex-wrap gap-2'>
                {FLAIR_OPTIONS.map((option) => {
                    const isSelected = draftFlair === option.value

                    return (
                        <button
                            key={option.value}
                            type='button'
                            onClick={() => {
                                setDraftFlair(option.value)
                                if (submitError) {
                                    setSubmitError('')
                                }
                            }}
                        >
                            <Card className={`gap-1! items-start outline-neutral3 ${isSelected ? 'outline-2' : 'hover:bg-neutral5'} cursor-pointer transition`}>
                                <p className='text-sm font-semibold text-neutral0'>{option.label}</p>
                            </Card>
                        </button>
                    )
                })}
            </div>

            {submitError ? (
                <p className='text-sm text-red-400 flex items-center gap-2'><FaCircleExclamation /> {submitError}</p>
            ) : null}

            <div className='flex gap-4'>
                <Button onClick={closeModal} className='w-full py-4' disabled={isSaving}>Back</Button>
                <Button type='primary' onClick={handleSave} className='w-full py-4'>
                    {isSaving ? 'Saving...' : 'Save'}
                </Button>
            </div>
        </div>
    )

}

export default EditFlairModal