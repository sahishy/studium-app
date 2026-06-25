import { useMemo, useState } from 'react'
import Button from '../../../../shared/components/ui/Button'
import TextTabSelector from '../../../../shared/components/ui/TextTabSelector'
import { FaCheck } from 'react-icons/fa6'
import { CIRCLE_BACKGROUND_COLORS, CIRCLE_ICON_COLORS, CIRCLE_ICON_OPTIONS } from '../../utils/circleUtils'
import CircleBanner from '../CircleBanner'

const tabs = [
    { name: 'colors', label: 'Colors' },
    { name: 'icons', label: 'Icons' },
]

const EditCircleBannerModal = ({ banner, onSave, closeModal }) => {

    const [tab, setTab] = useState('colors')
    const [draftBanner, setDraftBanner] = useState(banner)

    const currentTabIndex = useMemo(() => tabs.findIndex((x) => x.name === tab), [tab])

    const handleSave = () => {
        onSave?.(draftBanner)
        closeModal?.()
    }

    return (
        <div className='flex flex-col gap-6'>

            <h1 className='text-2xl font-semibold text-center'>Edit Circle Banner</h1>

            <CircleBanner
                banner={draftBanner}
                className='w-24 h-24 rounded-2xl mx-auto text-3xl'
            />

            <TextTabSelector
                tabs={tabs}
                currentIndex={currentTabIndex >= 0 ? currentTabIndex : 0}
                onSelect={(selectedTab) => setTab(selectedTab.name)}
            />

            {tab === 'colors' ? (
                <div className='flex flex-col gap-5'>
                    <div className='flex flex-col gap-2'>

                        <p className='text-sm text-neutral1'>Banner Color</p>

                        <div className='flex flex-wrap gap-2'>
                                {CIRCLE_BACKGROUND_COLORS.map((color) => {
                                const selected = draftBanner.bgColor === color
                                return (
                                    <button
                                        key={`bg_${color}`}
                                        type='button'
                                        onClick={() => setDraftBanner((prev) => ({ ...prev, bgColor: color }))}
                                        className={`h-9 w-9 rounded-full border border-neutral4 cursor-pointer ${selected ? 'ring-2 ring-neutral1 ring-offset-2' : ''}`}
                                        style={{ backgroundColor: color }}
                                    />
                                )
                            })}
                        </div>

                    </div>
                    <div className='flex flex-col gap-2'>

                        <p className='text-sm text-neutral1'>Icon Color</p>

                        <div className='flex flex-wrap gap-2'>
                            {CIRCLE_ICON_COLORS.map((color) => {
                                const selected = draftBanner.iconColor === color
                                return (
                                    <button
                                        key={`icon_${color}`}
                                        type='button'
                                        onClick={() => setDraftBanner((prev) => ({ ...prev, iconColor: color }))}
                                        className={`h-9 w-9 rounded-full border border-neutral4 cursor-pointer ${selected ? 'ring-2 ring-neutral1 ring-offset-2' : ''}`}
                                        style={{ backgroundColor: color }}
                                    />
                                )
                            })}
                        </div>

                    </div>
                </div>
            ) : (
                <div className='grid grid-cols-5 gap-3'>

                    {CIRCLE_ICON_OPTIONS.map((Icon, index) => {

                        const selected = draftBanner.iconIndex === index

                        return (
                            <button
                                key={`icon_${index}`}
                                type='button'
                                onClick={() => setDraftBanner((prev) => ({ ...prev, iconIndex: index }))}
                                className={`relative w-20 h-20 rounded-xl border bg-white/4 transition-all cursor-pointer
                                    ${selected ? 'border-neutral0 border-2 scale-105' : 'border-neutral4 hover:scale-105'}
                                `}
                            >

                                <div className='w-full h-full overflow-hidden flex items-center justify-center text-2xl'>
                                    <Icon className='text-neutral1'/>
                                </div>

                                <div className={`absolute -top-2 -right-2 p-1 bg-neutral0 rounded-full scale-80 opacity-0
                                    ${selected && 'scale-100 opacity-100'} transition`}
                                >
                                    <FaCheck className='text-[9px] text-neutral6' />
                                </div>

                            </button>
                        )

                    })}

                </div>
            )}

            <div className='flex gap-4 mt-2'>
                <Button onClick={closeModal} type='secondary' className='w-full py-4'>
                    Cancel
                </Button>
                <Button onClick={handleSave} type='primary' className='w-full py-4'>
                    Save
                </Button>
            </div>

        </div>
    )
    
}

export default EditCircleBannerModal