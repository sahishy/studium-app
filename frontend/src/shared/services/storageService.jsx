import { generateAvatarThumbnailBlob } from '../../features/profile/services/avatarService'
import { storage } from '../../lib/firebase'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { updateUserInfo } from '../../features/auth/services/userService'

const PROFILE_PICTURE_FOLDER = 'profilePictures'

const uploadProfilePicture = async ({ uid, profileForThumbnail }) => {

    if(!uid || !profileForThumbnail) {
        return
    }

    const thumbnailBlob = await generateAvatarThumbnailBlob(profileForThumbnail)
    const fileRef = ref(storage, `${PROFILE_PICTURE_FOLDER}/${uid}.jpeg`)

    await uploadBytes(fileRef, thumbnailBlob, {
        contentType: 'image/jpeg',
    })

    const profilePictureUrl = await getDownloadURL(fileRef)

    await updateUserInfo(uid, {
        'profile.profilePicture': {
            url: profilePictureUrl,
            lastUpdated: new Date(),
        },
    })

}

export {
    uploadProfilePicture,
}
