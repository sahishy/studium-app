import { useOutletContext } from 'react-router-dom'
import AvatarModel from '../../components/avatar/AvatarModel'
import background from '../../assets/images/background.jpeg'
import Card from '../../components/main/Card'
import Button from '../../components/main/Button'
import { useEffect, useMemo, useState } from 'react'
import { isDisplayNameAvailable, updateUserInfo } from '../../services/userService'
import {
    cancelScheduledProfilePictureUpload,
    scheduleProfilePictureUpload,
} from '../../services/storageService'
import { AVATAR_COLORS, AVATAR_FACES } from '../../utils/avatarUtils'
import {
    DISPLAY_NAME_MAX,
    DISPLAY_NAME_MIN,
    DISPLAY_NAME_REGEX,
    isDisplayNameFormatValid,
} from '../../utils/userUtils'

const ProfileTab = () => {

    const { profile } = useOutletContext()
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [displayName, setDisplayName] = useState('')
    const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0])
    const [selectedFace, setSelectedFace] = useState(0)
    const [error, setError] = useState('')

    useEffect(() => {
        if(!profile) return

        const profileInfo = profile.profile || {}
        setDisplayName(profileInfo.displayName || profile.displayName || '')
        setSelectedColor(profileInfo.avatar?.color || profile.avatar?.color || AVATAR_COLORS[0])
        setSelectedFace(profileInfo.avatar?.face ?? profile.avatar?.face ?? 0)
    }, [profile])

    const previewProfile = useMemo(() => {
        if(!profile) return null

        if(!editing) {
            return profile
        }

        return {
            ...profile,
            profile: {
                ...(profile.profile || {}),
                displayName,
                avatar: {
                    color: selectedColor,
                    face: selectedFace,
                },
                profilePicture: profile.profile?.profilePicture || {
                    url: '',
                    lastUpdated: new Date(),
                }
            }
        }
    }, [profile, editing, displayName, selectedColor, selectedFace])

    const resetToProfile = () => {
        const profileInfo = profile.profile || {}
        setDisplayName(profileInfo.displayName || profile.displayName || '')
        setSelectedColor(profileInfo.avatar?.color || profile.avatar?.color || AVATAR_COLORS[0])
        setSelectedFace(profileInfo.avatar?.face ?? profile.avatar?.face ?? 0)
        setError('')
    }

    const handleEdit = () => {
        resetToProfile()
        setEditing(true)
    }

    const handleCancel = () => {
        resetToProfile()
        setEditing(false)
    }

    const validateDisplayName = (value) => {
        if(!value) {
            return 'Display name is required.'
        }

        if(!isDisplayNameFormatValid(value)) {
            if(value.length < DISPLAY_NAME_MIN || value.length > DISPLAY_NAME_MAX) {
                return `Display name must be ${DISPLAY_NAME_MIN}-${DISPLAY_NAME_MAX} characters.`
            }

            if(!DISPLAY_NAME_REGEX.test(value)) {
                return 'Display name must only contain letters and numbers.'
            }
        }

        return ''
    }

    const hasChanges = useMemo(() => {
        if(!profile) return false

        const profileInfo = profile.profile || {}

        return (
            displayName !== (profileInfo.displayName || profile.displayName || '') ||
            selectedColor !== (profileInfo.avatar?.color || profile.avatar?.color || AVATAR_COLORS[0]) ||
            selectedFace !== (profileInfo.avatar?.face ?? profile.avatar?.face ?? 0)
        )
    }, [profile, displayName, selectedColor, selectedFace])

    const handleSave = async () => {
        setError('')

        const validationError = validateDisplayName(displayName)
        if(validationError) {
            setError(validationError)
            return
        }

        try {
            setSaving(true)

            const existingDisplayName = profile.profile?.displayName || profile.displayName || ''

            if(displayName !== existingDisplayName) {
                const available = await isDisplayNameAvailable(displayName, profile.uid)
                if(!available) {
                    setError('This display name is already taken.')
                    return
                }
            }

            await updateUserInfo(profile.uid, {
                'profile.displayName': displayName,
                'profile.avatar': {
                    color: selectedColor,
                    face: selectedFace,
                },
                'profile.profilePicture': profile.profile?.profilePicture || {
                    url: '',
                    lastUpdated: new Date(),
                },
            })

            const latestProfileForThumbnail = {
                ...profile,
                profile: {
                    ...(profile.profile || {}),
                    displayName,
                    avatar: {
                        color: selectedColor,
                        face: selectedFace,
                    },
                },
            }

            scheduleProfilePictureUpload({
                uid: profile.uid,
                profileForThumbnail: latestProfileForThumbnail,
            })

            setEditing(false)
        } catch {
            setError('Unable to save profile changes. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    useEffect(() => {
        if(!profile?.uid) return

        return () => {
            cancelScheduledProfilePictureUpload(profile.uid)
        }
    }, [profile?.uid])

    return (
        <div className='flex-1 flex gap-8'>

            <div className='relative flex-1 rounded-xl bg-white flex justify-center overflow-hidden'>
                <img src={background} className='opacity-40' />
                <AvatarModel
                    profile={previewProfile || profile}
                    animation={'Idle'}
                    className='absolute w-144! h-144!'
                />
            </div>

            <Card className='flex-1 flex flex-col justify-between p-8!'>
                <div className='flex-1 flex flex-col gap-8'>
                    <div className='flex flex-col gap-2'>
                        <label className='text-sm font-semibold text-text1'>Display Name</label>
                        <input
                            type='text'
                            value={displayName}
                            onChange={(e) => {
                                setDisplayName(e.target.value)
                                if(error) setError('')
                            }}
                            disabled={!editing || saving}
                            className={`w-full p-3 rounded-xl border text-sm bg-background0 ${editing ? 'border-neutral4' : 'border-neutral5 text-text2 cursor-not-allowed'}`}
                            placeholder='Enter display name'
                            maxLength={DISPLAY_NAME_MAX}
                        />
                        <p className='text-xs text-text2'>3-23 chars, letters and numbers only.</p>
                    </div>

                    <div className='flex flex-col gap-3'>
                        <p className='text-sm font-semibold text-text1'>Color</p>
                        <div className='flex gap-3'>
                            {AVATAR_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type='button'
                                    disabled={!editing || saving}
                                    onClick={() => setSelectedColor(color)}
                                    className={`w-10 h-10 rounded-full border-2 ${selectedColor === color ? 'border-neutral0' : 'border-transparent'} ${!editing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                    style={{ backgroundColor: color }}
                                    aria-label={`Select color ${color}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className='flex flex-col gap-3'>
                        <p className='text-sm font-semibold text-text1'>Face</p>
                        <div className='flex gap-3'>
                            {AVATAR_FACES.map((faceTexture, faceIndex) => (
                                <button
                                    key={faceTexture}
                                    type='button'
                                    disabled={!editing || saving}
                                    onClick={() => setSelectedFace(faceIndex)}
                                    className={`w-16 h-16 rounded-xl border overflow-hidden bg-neutral6 ${selectedFace === faceIndex ? 'border-neutral0 border-2' : 'border-neutral4'} ${!editing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
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

                    {error && (
                        <p className='text-sm text-red-400'>{error}</p>
                    )}
                </div>
                <div className='flex justify-center gap-3'>
                    {!editing ? (
                        <Button
                            type={'secondary'}
                            onClick={handleEdit}
                        >
                            Edit
                        </Button>
                    ) : (
                        <>
                            <Button
                                type={'secondary'}
                                onClick={handleCancel}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button
                                type={'primary'}
                                onClick={handleSave}
                                disabled={!hasChanges || saving}
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </>
                    )}

                </div>
            </Card>

        </div>

    )
}


export default ProfileTab
