import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import Card from '../../../shared/components/ui/Card'
import AvatarModel from '../../../shared/components/avatar/AvatarModel'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import background from '../../../assets/images/background.jpeg'
import { AVATAR_COLORS, AVATAR_FACES } from '../utils/avatarUtils'
import { updateUserInfo } from '../../auth/services/userService'
import {
    cancelScheduledProfilePictureUpload,
    scheduleProfilePictureUpload,
} from '../../../shared/services/storageService'

const tabs = [
    { name: 'color', label: 'Color' },
    { name: 'face', label: 'Face' },
    { name: 'hat', label: 'Hat' },
]

const Avatar = () => {

    const { profile } = useOutletContext()
    const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0])
    const [selectedFace, setSelectedFace] = useState(0)
    const [activeTab, setActiveTab] = useState(0)
    const [saving, setSaving] = useState(false)

    useEffect(() => {

        if(!profile) return

        const profileInfo = profile.profile || {}
        setSelectedColor(profileInfo.avatar?.color || profile.avatar?.color || AVATAR_COLORS[0])
        setSelectedFace(profileInfo.avatar?.face ?? profile.avatar?.face ?? 0)

    }, [profile])

    const previewProfile = useMemo(() => {

        if(!profile) return null

        return {
            ...profile,
            profile: {
                ...(profile.profile || {}),
                avatar: {
                    color: selectedColor,
                    face: selectedFace,
                },
            },
        }

    }, [profile, selectedColor, selectedFace])

    const persistAvatar = async (nextColor, nextFace) => {

        if(!profile?.uid) return

        const latestProfileForThumbnail = {
            ...profile,
            profile: {
                ...(profile.profile || {}),
                avatar: {
                    color: nextColor,
                    face: nextFace,
                },
            },
        }

        try {
            setSaving(true)

            await updateUserInfo(profile.uid, {
                'profile.avatar': {
                    color: nextColor,
                    face: nextFace,
                },
            })

            scheduleProfilePictureUpload({
                uid: profile.uid,
                profileForThumbnail: latestProfileForThumbnail,
            })
        } finally {
            setSaving(false)
        }

    }

    const handleColorSelect = (color) => {

        if(color === selectedColor) return

        setSelectedColor(color)
        persistAvatar(color, selectedFace)

    }

    const handleFaceSelect = (faceIndex) => {

        if(faceIndex === selectedFace) return

        setSelectedFace(faceIndex)
        persistAvatar(selectedColor, faceIndex)

    }

    useEffect(() => {

        if(!profile?.uid) return

        return () => {
            cancelScheduledProfilePictureUpload(profile.uid)
        }

    }, [profile?.uid])

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full flex-1 flex flex-col gap-4 px-24 pb-24 pt-2'>
                <div className='flex justify-between items-start'>
                    <h1 className='text-2xl font-semibold'>Avatar</h1>
                    <TextTabSelector
                        tabs={tabs}
                        currentIndex={activeTab}
                        onSelect={(_, index) => setActiveTab(index)}
                    />
                </div>

                <div className='flex-1 flex gap-8'>

                    <div className='relative flex-1 rounded-xl bg-white flex justify-center overflow-hidden'>
                        <img src={background} className='opacity-40' />
                        <AvatarModel
                            profile={previewProfile || profile}
                            animation={'Idle'}
                            className='absolute w-144! h-144!'
                        />
                    </div>

                    <Card className='flex-1 flex flex-col p-8! gap-6'>
                        {activeTab === 0 && (
                            <div className='flex flex-col gap-4'>
                                <h2 className='text-lg font-semibold'>Color</h2>

                                <div className='flex flex-wrap gap-4'>
                                    {AVATAR_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type='button'
                                            onClick={() => handleColorSelect(color)}
                                            className={`w-14 h-14 rounded-full border-2 transition-all cursor-pointer ${selectedColor === color ? 'border-neutral0 scale-105' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                            aria-label={`Select color ${color}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 1 && (
                            <div className='flex flex-col gap-4'>
                                <h2 className='text-lg font-semibold'>Face</h2>

                                <div className='flex flex-wrap gap-4'>
                                    {AVATAR_FACES.map((faceTexture, faceIndex) => (
                                        <button
                                            key={faceTexture}
                                            type='button'
                                            onClick={() => handleFaceSelect(faceIndex)}
                                            className={`w-20 h-20 rounded-xl border overflow-hidden bg-neutral6 transition-all cursor-pointer ${selectedFace === faceIndex ? 'border-neutral0 border-2 scale-105' : 'border-neutral4'}`}
                                            aria-label={`Select face ${faceIndex + 1}`}
                                        >
                                            <img
                                                src={faceTexture}
                                                alt={`Face option ${faceIndex + 1}`}
                                                className='w-full h-full object-cover'
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 2 && (
                            <div className='flex flex-col gap-4'>
                                <h2 className='text-lg font-semibold'>Hat</h2>
                                <p className='text-sm text-text2'>Coming soon.</p>
                            </div>
                        )}

                        {saving ? <p className='text-xs text-text2 mt-auto'>Saving...</p> : null}
                    </Card>

                </div>
            </div>
        </div>
    )
}

export default Avatar