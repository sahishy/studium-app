import { useEffect, useMemo, useState } from 'react'
import BaseCommandPalette from '../../../../shared/components/commandPalettes/BaseCommandPalette'
import Card from '../../../../shared/components/ui/Card'
import { searchMajors } from '../../services/majorService'

const MajorCommandPalette = ({
    isOpen,
    onClose,
    selectedMajorIds = [],
    onSelectMajor,
}) => {
    const [query, setQuery] = useState('')

    useEffect(() => {
        if(!isOpen) {
            setQuery('')
        }
    }, [isOpen])

    const majorResults = useMemo(() => {
        return searchMajors(query, 200)
    }, [query])

    return (
        <BaseCommandPalette
            isOpen={isOpen}
            onClose={onClose}
            query={query}
            onQueryChange={setQuery}
            placeholder='Search majors by name, meta major, or id...'
        >
            <div className='h-full overflow-y-auto p-4 flex flex-col gap-2 bg-neutral6'>
                {majorResults.length === 0 ? (
                    <p className='text-sm text-neutral1 p-4'>No majors found for "{query.trim()}".</p>
                ) : majorResults.map((major) => {
                    const isSelected = selectedMajorIds.includes(major.majorId)

                    return (
                        <button
                            key={major.majorId}
                            type='button'
                            onClick={() => onSelectMajor?.(major.majorId)}
                            disabled={isSelected}
                            className='w-full disabled:opacity-70 disabled:cursor-not-allowed'
                        >
                            <Card hoverable={!isSelected} className='items-start gap-1!'>
                                <p className='text-sm text-neutral0 font-semibold'>{major.name}</p>
                                <p className='text-xs text-neutral1'>{major.metaMajor} · {major.majorId}</p>
                                {isSelected ? (
                                    <p className='text-xs text-neutral1'>Added</p>
                                ) : null}
                            </Card>
                        </button>
                    )
                })}
            </div>
        </BaseCommandPalette>
    )
}

export default MajorCommandPalette