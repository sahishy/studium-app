import { generateAvatarThumbnailBlob } from './avatarService'
import { supabase } from '../lib/supabase'
import { updateUserInfo } from './userService'

// const PROFILE_PICTURE_UPLOAD_DELAY_MS = 10_000
const PROFILE_PICTURE_UPLOAD_DELAY_MS = 1000
const PROFILE_PICTURE_BUCKET = 'profilePictures'

const pendingProfilePictureUploads = new Map()

const uploadAvatarThumbnailToSupabase = async (uid, thumbnailBlob) => {
    const filePath = `${uid}.jpeg`
    const { error } = await supabase.storage
        .from(PROFILE_PICTURE_BUCKET)
        .upload(filePath, thumbnailBlob, {
            upsert: true,
            contentType: 'image/jpeg',
        })

    if (error) {
        throw error
    }

    const { data } = supabase.storage
        .from(PROFILE_PICTURE_BUCKET)
        .getPublicUrl(filePath)

    return data?.publicUrl || ''
}

const scheduleProfilePictureUpload = ({ uid, profileForThumbnail }) => {
    if (!uid || !profileForThumbnail) {
        return
    }

    const previousEntry = pendingProfilePictureUploads.get(uid)
    const nextSeq = (previousEntry?.seq || 0) + 1

    if (previousEntry?.timerId) {
        clearTimeout(previousEntry.timerId)
    }

    const timerId = setTimeout(async () => {
        const activeEntry = pendingProfilePictureUploads.get(uid)
        if (!activeEntry || activeEntry.seq !== nextSeq) {
            return
        }

        try {
            const thumbnailBlob = await generateAvatarThumbnailBlob(activeEntry.profileForThumbnail)
            const profilePictureUrl = await uploadAvatarThumbnailToSupabase(uid, thumbnailBlob)

            const latestEntry = pendingProfilePictureUploads.get(uid)
            if (!latestEntry || latestEntry.seq !== nextSeq) {
                return
            }

            await updateUserInfo(uid, {
                'profile.profilePicture': {
                    url: profilePictureUrl,
                    lastUpdated: new Date(),
                },
            })
        } catch (error) {
            console.error('Profile picture pipeline failed:', error)
        } finally {
            const latestEntry = pendingProfilePictureUploads.get(uid)
            if (latestEntry?.seq === nextSeq) {
                pendingProfilePictureUploads.delete(uid)
            }
        }
    }, PROFILE_PICTURE_UPLOAD_DELAY_MS)

    pendingProfilePictureUploads.set(uid, {
        timerId,
        seq: nextSeq,
        profileForThumbnail,
    })
}

const cancelScheduledProfilePictureUpload = (uid) => {
    const entry = pendingProfilePictureUploads.get(uid)
    if (!entry) return

    clearTimeout(entry.timerId)
    pendingProfilePictureUploads.delete(uid)
}

export {
    PROFILE_PICTURE_UPLOAD_DELAY_MS,
    scheduleProfilePictureUpload,
    cancelScheduledProfilePictureUpload,
}
