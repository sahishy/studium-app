import { useEffect, useState } from 'react'
import Button from '../../../../shared/components/ui/Button'
import { getMajorNameById } from '../../services/majorService'
import MajorCommandPalette from '../commandPalettes/MajorCommandPalette'

const EditMajorModal = ({
    value = [],
    closeModal,
    onSave,
}) => {
    const [selectedMajors, setSelectedMajors] = useState(Array.isArray(value) ? value : [])
    const [paletteOpen, setPaletteOpen] = useState(false)

    useEffect(() => {
        setSelectedMajors(Array.isArray(value) ? value : [])
    }, [value])

    const handleAddMajor = (majorId) => {
        setSelectedMajors((prev) => {
            if(prev.includes(majorId)) {
                return prev
            }
            return [...prev, majorId]
        })
    }

    const handleRemoveMajor = (majorId) => {
        setSelectedMajors((prev) => prev.filter((id) => id !== majorId))
    }

    const handleSave = () => {
        onSave?.(selectedMajors)
        closeModal?.()
    }

    return (
        <div className='flex flex-col gap-8'>
            <h1 className='text-2xl font-semibold text-center'>Edit Target Major(s)</h1>

            <div className='flex flex-wrap gap-2 min-h-8 border-2 border-neutral4 rounded-xl p-3'>
                {selectedMajors.map((majorId) => (
                    <button
                        key={majorId}
                        type='button'
                        onClick={() => handleRemoveMajor(majorId)}
                        className='text-xs px-3 py-1 rounded-full bg-neutral5 text-neutral0 cursor-pointer'
                    >
                        {getMajorNameById(majorId) ?? majorId} ×
                    </button>
                ))}
                {selectedMajors.length === 0 ? (
                    <p className='text-sm text-neutral1'>No target majors selected.</p>
                ) : null}
            </div>

            <div>
                <Button onClick={() => setPaletteOpen(true)} className='py-4'>Add Major</Button>
            </div>

            <div className='flex gap-4 mt-2'>
                <Button onClick={closeModal} className='w-full py-4'>Cancel</Button>
                <Button type='primary' onClick={handleSave} className='w-full py-4'>Save</Button>
            </div>

            <MajorCommandPalette
                isOpen={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                selectedMajorIds={selectedMajors}
                onSelectMajor={(majorId) => {
                    handleAddMajor(majorId)
                    setPaletteOpen(false)
                }}
            />
        </div>
    )
}

export default EditMajorModal