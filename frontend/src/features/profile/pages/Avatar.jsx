import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import Card from '../../../shared/components/ui/Card'
import AvatarModel from '../../../shared/components/avatar/AvatarModel'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import background from '../../../assets/images/background.jpeg'
import { AVATAR_COLORS, AVATAR_FACES } from '../utils/avatarUtils'
import { getAvatarSaveCooldownSecondsLeft, isAvatarSaveOnCooldown, startAvatarSaveCooldown } from '../services/avatarService'
import { updateUserInfo } from '../../auth/services/userService'
import { uploadProfilePicture } from '../../../shared/services/storageService'
import Button from '../../../shared/components/ui/Button'
import LoadingState from '../../../shared/components/ui/LoadingState'

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
    const [saveCooldownSecondsLeft, setSaveCooldownSecondsLeft] = useState(() => getAvatarSaveCooldownSecondsLeft())
    const [avatarLoading, setAvatarLoading] = useState(true)

    const currentProfileAvatar = profile?.profile?.avatar || profile?.avatar || {}
    const currentColor = currentProfileAvatar?.color || AVATAR_COLORS[0]
    const currentFace = currentProfileAvatar?.face ?? 0

    useEffect(() => {

        if (!profile) {
            setAvatarLoading(true)
            return
        }

        setSelectedColor(currentColor)
        setSelectedFace(currentFace)
        setAvatarLoading(false)

    }, [profile, currentColor, currentFace])

    useEffect(() => {

        if (saveCooldownSecondsLeft <= 0) return

        const intervalId = setInterval(() => {
            const nextSecondsLeft = getAvatarSaveCooldownSecondsLeft()
            setSaveCooldownSecondsLeft(nextSecondsLeft)

            if (nextSecondsLeft <= 0) {
                clearInterval(intervalId)
            }
        }, 1000)

        return () => clearInterval(intervalId)

    }, [saveCooldownSecondsLeft])

    const hasUnsavedChanges = selectedColor !== currentColor || selectedFace !== currentFace

    const previewProfile = useMemo(() => {

        if (!profile) return null

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

    const handleSaveChanges = async () => {

        if (!profile?.uid || saving || isAvatarSaveOnCooldown() || !hasUnsavedChanges) return

        const latestProfileForThumbnail = {
            ...profile,
            profile: {
                ...(profile.profile || {}),
                avatar: {
                    color: selectedColor,
                    face: selectedFace,
                },
            },
        }

        try {
            setSaving(true)

            await updateUserInfo(profile.uid, {
                'profile.avatar': {
                    color: selectedColor,
                    face: selectedFace,
                },
            })

            await uploadProfilePicture({
                uid: profile.uid,
                profileForThumbnail: latestProfileForThumbnail,
            })

            const cooldownSecondsLeft = startAvatarSaveCooldown()
            setSaveCooldownSecondsLeft(cooldownSecondsLeft)
        } finally {
            setSaving(false)
        }

    }

    const handleColorSelect = (color) => {

        if (color === selectedColor) return
        setSelectedColor(color)

    }

    const handleFaceSelect = (faceIndex) => {

        if (faceIndex === selectedFace) return
        setSelectedFace(faceIndex)

    }

    const handleDiscardChanges = () => {
        setSelectedColor(currentColor)
        setSelectedFace(currentFace)
    }

    const saveButtonText = saving
        ? 'Saving...'
        : saveCooldownSecondsLeft > 0
            ? `Cooldown (${saveCooldownSecondsLeft}s)`
            : 'Save Changes'

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

                {avatarLoading ? (
                    <LoadingState className='flex-1' />
                ) : (
                    <div className='flex-1 flex gap-8'>

                        <div className='relative flex-1 rounded-xl bg-white flex justify-center overflow-hidden'>
                            <img
                                src={background}
                                alt='Avatar preview background'
                                className='absolute inset-0 w-full h-full object-cover opacity-60 z-0'
                            />

                            <div className='pointer-events-none absolute inset-0 z-1'>
                                <div className='absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-neutral6 to-transparent' />
                                <div className='absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-neutral6 to-transparent' />
                                <div className='absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-neutral6 to-transparent' />
                                <div className='absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-neutral6 to-transparent' />
                            </div>

                            <AvatarModel
                                profile={previewProfile || profile}
                                animation={'Idle'}
                                className='absolute bottom-16 z-2 w-144! h-144!'
                            />

                            <div className={`
                                    z-3 absolute bottom-8 w-full max-w-xs flex justify-center gap-3 pt-12 bg-gradient-to-t from-neutral6 to-transparent
                                    transition-all
                                    ${hasUnsavedChanges ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'}
                                `}
                            >
                                <Button
                                    className='flex-1 p-3!'
                                    onClick={handleDiscardChanges}
                                >
                                    Discard Changes
                                </Button>
                                <Button
                                    type='primary'
                                    className='flex-1 p-3!'
                                    onClick={handleSaveChanges}
                                    disabled={!hasUnsavedChanges || saving || saveCooldownSecondsLeft > 0}
                                >
                                    {saveButtonText}
                                </Button>
                            </div>

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

                        </Card>

                    </div>
                )}
            </div>
        </div>
    )
}

export default Avatar