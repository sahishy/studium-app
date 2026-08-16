import { useEffect, useState } from 'react'
import defaultProfilePicture from '../../../assets/images/default-profile.jpg'
import { generateAvatarThumbnailBlob } from '../../../features/profile/services/avatarService'

const generatedAvatarUrls = new Map()
const generatedAvatarPromises = new Map()

const avatarFallbackUrl = (avatar) => {
    if(!avatar) return null
    const color = /^#[0-9a-f]{6}$/i.test(avatar.color ?? '') ? avatar.color : '#60a5fa'
    const face = Math.max(0, Math.min(2, Number(avatar.face) || 0))
    const mouth = face === 0
        ? '<path d="M64 88 Q96 116 128 88" fill="none" stroke="#1f2937" stroke-width="9" stroke-linecap="round"/>'
        : face === 1
            ? '<path d="M68 96 Q96 82 124 96" fill="none" stroke="#1f2937" stroke-width="9" stroke-linecap="round"/>'
            : '<path d="M66 86 Q96 124 126 86 Q121 125 96 130 Q71 125 66 86" fill="#1f2937"/>'
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="#e5e7eb"/><circle cx="96" cy="104" r="70" fill="${color}"/><ellipse cx="71" cy="75" rx="8" ry="12" fill="#1f2937"/><ellipse cx="121" cy="75" rx="8" ry="12" fill="#1f2937"/>${mouth}</svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const AvatarPicture = ({ profile, avatar: avatarProp = null, className = '', children }) => {
    
    const rawUrl = profile?.profile?.profilePicture?.url
    const lastUpdated = profile?.profile?.profilePicture?.lastUpdated
    const avatar = avatarProp ?? profile?.profile?.avatar ?? profile?.avatar ?? null
    const avatarKey = avatar ? `${avatar.color ?? ''}:${Number(avatar.face) || 0}` : null
    const [generatedUrl, setGeneratedUrl] = useState(() => avatarKey ? generatedAvatarUrls.get(avatarKey) ?? avatarFallbackUrl(avatar) : null)

    useEffect(() => {
        let active = true
        if(rawUrl || !avatarKey || generatedAvatarUrls.has(avatarKey)) {
            setGeneratedUrl(avatarKey ? generatedAvatarUrls.get(avatarKey) ?? avatarFallbackUrl(avatar) : null)
            return () => { active = false }
        }
        setGeneratedUrl(avatarFallbackUrl(avatar))
        if(!generatedAvatarPromises.has(avatarKey)) {
            generatedAvatarPromises.set(avatarKey, generateAvatarThumbnailBlob({ avatar }).then((blob) => {
                const url = URL.createObjectURL(blob)
                generatedAvatarUrls.set(avatarKey, url)
                return url
            }).finally(() => generatedAvatarPromises.delete(avatarKey)))
        }
        generatedAvatarPromises.get(avatarKey).then((url) => {
            if(active) setGeneratedUrl(url)
        }).catch(() => {})
        return () => { active = false }
    }, [rawUrl, avatarKey, avatar])

    const profilePictureUrl = rawUrl ? `${rawUrl}?v=${lastUpdated ?? ''}` : (generatedUrl || defaultProfilePicture)

    return (
        <div className={`relative w-8 h-8 shrink-0 ${className}`}>
            <img
                src={profilePictureUrl}
                alt="profile picture"
                className={`w-full h-full rounded-full object-cover select-none pointer-events-none ${!rawUrl && !generatedUrl ? 'animate-pulse' : ''}`}
            />
            {/* <span
                className={`absolute bottom-0 right-0 w-3 h-3 ${statusColorClass} border-2 ${isOpen ? 'border-background4' : 'border-background0'} group-hover:border-background4 rounded-full transition-colors`}
            ></span> */}
            {children}
        </div>
    )
}

export default AvatarPicture
