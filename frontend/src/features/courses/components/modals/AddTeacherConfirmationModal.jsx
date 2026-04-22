import Button from '../../../../shared/components/ui/Button'
import { useState } from 'react'
import Select from '../../../../shared/components/popovers/Select'

const AddTeacherConfirmationModal = ({ teacherName = '', schoolOptions = [], defaultSchoolId = null, onCancel = () => { }, onConfirm = async () => { }, confirmLoading = false }) => {

    const [selectedSchoolId, setSelectedSchoolId] = useState(defaultSchoolId)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleConfirm = async () => {
        if (!selectedSchoolId) {
            return
        }

        setIsSubmitting(true)
        try {
            await onConfirm(selectedSchoolId)
        } finally {
            setIsSubmitting(false)
        }

    }

    return (
        <div className='flex flex-col gap-8'>
            <h1 className='text-2xl font-semibold text-center'>Add Teacher</h1>

            <p className='text-center text-lg text-text1'>
                Which school does <span className='font-semibold text-neutral0'>"{teacherName}"</span> teach at?
            </p>

            {schoolOptions.length === 0 ? (
                <p className='text-sm text-red-400'>No school found. Please add your school in settings first.</p>
            ) : (
                <div className='flex flex-col gap-2'>
                    <p className='text-sm text-neutral1'>School</p>
                    <Select
                        options={schoolOptions.map((option) => ({ value: option.id, label: option.label }))}
                        value={selectedSchoolId}
                        onChange={setSelectedSchoolId}
                        placeholder='Select school'
                    />
                </div>
            )}

            <div className='flex gap-4 mt-2'>
                <Button type='secondary' onClick={onCancel} className='w-full py-4'>
                    Cancel
                </Button>
                <Button
                    type='primary'
                    onClick={handleConfirm}
                    className='w-full py-4'
                    disabled={confirmLoading || isSubmitting || !selectedSchoolId || schoolOptions.length === 0}
                >
                    {(confirmLoading || isSubmitting) ? 'Adding...' : 'Confirm'}
                </Button>
            </div>

        </div>
    )
}

export default AddTeacherConfirmationModal