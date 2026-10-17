import { useOnboarding } from '../../onboarding/OnboardingContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams, useNavigate } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import Card from '../../../shared/components/ui/Card'
import AvatarModel from '../../../shared/components/avatar/AvatarModel'
import FittedAvatarStage from '../../../shared/components/avatar/FittedAvatarStage'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import background from '../../../assets/images/background.jpeg'
import { AVATAR_COLORS, AVATAR_FACES, STARTER_FACES } from '../utils/avatarUtils'
import { getAvatarSaveCooldownSecondsLeft, isAvatarSaveOnCooldown, startAvatarSaveCooldown } from '../services/avatarService'
import { useEconomy } from '../../economy/EconomyContext'
import { post } from '../../../shared/services/apiService'
import { uploadProfilePicture } from '../../../shared/services/storageService'
import Button from '../../../shared/components/ui/Button'
import LoadingState from '../../../shared/components/ui/LoadingState'
import { FaCheck, FaChild, FaDroplet, FaFaceSmile, FaLock, FaUnlock } from 'react-icons/fa6'
import PageHeader from '../../../shared/components/ui/PageHeader'
import { FaCheckCircle, FaSmile } from 'react-icons/fa'
import CrateView from '../../economy/components/CrateView'
import CrateHeader from '../../economy/components/CrateHeader'
import CrateDropTable from '../../economy/components/CrateDropTable'
import useCrateOpening from '../../economy/useCrateOpening'
import CosmeticTooltip from '../../economy/components/CosmeticTooltip'
import Logo from '../../../shared/components/misc/Logo'
import Title from '../components/Title'
import { DEFAULT_TITLE_ID } from '../utils/titleUtils'
import { describeColor, describeFace, getRarityStyle } from '../../economy/utils/rarityUtils'
import ColorSwatch from '../../economy/components/ColorSwatch'

const tabs = [
    { name: 'color', label: 'Color' },
    { name: 'face', label: 'Face' },
    { name: 'title', label: 'Title' },
    { name: 'hat', label: 'Hat' },
]

const Locker = () => {

    const lockerRef = useRef(null)
    const { profile } = useOutletContext()
    const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0])
    const [selectedFace, setSelectedFace] = useState(0)
    const [selectedTitle, setSelectedTitle] = useState(DEFAULT_TITLE_ID)
    const { tab: requestedTab } = useParams()
    const navigate = useNavigate()
    const activeTab = tabs.some(tab => tab.name === requestedTab) ? requestedTab : 'color'
    const showingCrates = requestedTab === 'crates'
    useEffect(() => {
        if(!requestedTab || ![...tabs.map(tab => tab.name), 'crates'].includes(requestedTab)) navigate('/locker/color', {replace:true})
    }, [requestedTab, navigate])
    const { snapshot: economy } = useEconomy()
    const { crateOffer } = useOnboarding()
    const crate = useCrateOpening(crateOffer)
    const [saving, setSaving] = useState(false)
    const [saveCooldownSecondsLeft, setSaveCooldownSecondsLeft] = useState(() => getAvatarSaveCooldownSecondsLeft())
    const [avatarLoading, setAvatarLoading] = useState(true)
    const unlockedColors = [...AVATAR_COLORS, ...(economy?.catalog || []).filter((item) => item.type === 'color' && economy?.wallet?.inventory?.includes(item.id)).map((item) => item.value)]
    const inventory = economy?.wallet?.inventory ?? []
    const colorCatalog = (economy?.catalog || []).filter((item) => item.type === 'color')
    const faceCatalog = (economy?.catalog || []).filter((item) => item.type === 'face')
    const titleCatalog = (economy?.catalog || []).filter((item) => item.type === 'title')
    const lockedColors = colorCatalog.filter((item) => !inventory.includes(item.id))
    const unlockedFaces = [...STARTER_FACES, ...faceCatalog.filter((item) => inventory.includes(item.id)).map((item) => item.value)]
    const lockedFaces = faceCatalog.filter((item) => !inventory.includes(item.id))
    const ownsTitle = (id) => id === DEFAULT_TITLE_ID || inventory.includes(id)
    const unlockedTitles = titleCatalog.filter((item) => ownsTitle(item.id))
    const lockedTitles = titleCatalog.filter((item) => !ownsTitle(item.id))
    const earnedRequirements = Object.fromEntries((economy?.earnedTitles ?? []).map((entry) => [entry.id, entry.requirement]))
    const isOpeningCrate = showingCrates && crate.phase !== 'ready' && crate.phase !== 'closing'

    const currentProfileAvatar = profile?.profile?.avatar || profile?.avatar || {}
    const currentColor = currentProfileAvatar?.color || AVATAR_COLORS[0]
    const currentFace = currentProfileAvatar?.face ?? 0
    const currentTitle = profile?.profile?.title || DEFAULT_TITLE_ID

    useEffect(() => {

        if (!profile) {
            setAvatarLoading(true)
            return
        }

        setSelectedColor(currentColor)
        setSelectedFace(currentFace)
        setSelectedTitle(currentTitle)
        setAvatarLoading(false)

    }, [profile, currentColor, currentFace, currentTitle])

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

    const hasUnsavedChanges = selectedColor !== currentColor
        || selectedFace !== currentFace
        || selectedTitle !== currentTitle

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

            await post('/v1/economy/avatar/equip', { color: selectedColor, face: selectedFace })

            // Titles are equipped through their own endpoint: equipAvatar validates a colour and a
            // face as a matched pair and has no slot for a third, independent cosmetic.
            if(selectedTitle !== currentTitle) {
                await post('/v1/economy/title/equip', { title: selectedTitle })
            }

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

    const handleTitleSelect = (titleId) => {

        if (titleId === selectedTitle) return
        setSelectedTitle(titleId)

    }

    const handleDiscardChanges = () => {
        setSelectedColor(currentColor)
        setSelectedFace(currentFace)
        setSelectedTitle(currentTitle)
    }

    const saveButtonText = saving
        ? 'Saving...'
        : saveCooldownSecondsLeft > 0
            ? `Cooldown (${saveCooldownSecondsLeft}s)`
            : 'Save Changes'

    return (
        <div ref={lockerRef} className='relative flex flex-col h-full overflow-hidden'>
            <Topbar profile={profile} alwaysShowCrates={showingCrates} />

            <div className='w-full flex-1 min-h-0 flex flex-col gap-4 px-4 pb-8 pt-2 sm:px-8 lg:px-16 xl:px-24'>
                <div className='flex justify-between items-start'>

                    <PageHeader text={'Locker'} icon={FaChild} />

                    <div className='flex items-center gap-2'>
                        <TextTabSelector
                            tabs={tabs}
                            currentIndex={showingCrates ? -1 : tabs.findIndex((tab) => tab.name === activeTab)}
                            onSelect={(tab) => navigate(`/locker/${tab.name}`)}
                        />

                        <div className='p-1 bg-neutral5 rounded-full'>
                            <button
                                type='button'
                                data-onboarding="locker:crates"
                                onClick={() => navigate('/locker/crates')}
                                className={`px-4 py-2 rounded-full text-sm transition-colors cursor-pointer
                                    ${showingCrates
                                        ? 'bg-neutral6 text-neutral0'
                                        : 'text-neutral1 hover:text-neutral0'}`}
                            >
                                Crates
                            </button>
                        </div>
                    </div>

                </div>

                {avatarLoading ? (
                    <LoadingState className='flex-1' />
                ) : (
                    <div data-onboarding={showingCrates ? 'locker:crate-shop' : 'locker:customize'} className='flex-1 min-h-0 flex flex-col gap-8 lg:flex-row'>

                        <div className={`relative min-h-[320px] flex-1 rounded-xl flex justify-center lg:min-h-0
                            ${showingCrates ? '' : 'bg-neutral6 overflow-hidden'}`}
                        >
                            {!showingCrates ? (
                                <>
                                    <img
                                        src={background}
                                        alt='Avatar preview background'
                                        className='absolute inset-0 w-full h-full object-cover opacity-60 z-0 dark:opacity-8'
                                    />

                                    <div className='pointer-events-none absolute inset-0 z-1'>
                                        <div className='absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-neutral6 to-transparent' />
                                        <div className='absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-neutral6 to-transparent' />
                                        <div className='absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-neutral6 to-transparent' />
                                        <div className='absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-neutral6 to-transparent' />
                                    </div>
                                </>
                            ) : null}

                            {showingCrates ? (
                                <CrateView crate={crate} lockerRef={lockerRef} />
                            ) : (
                                <>
                                    <FittedAvatarStage minWidth={36} minHeight={40} className='absolute! inset-0 z-2'>
                                        <AvatarModel
                                            profile={previewProfile || profile}
                                            animation={'Idle'}
                                            className='absolute bottom-16 left-1/2 -translate-x-1/2 w-144! h-144!'
                                        />
                                    </FittedAvatarStage>

                                    <div className={`
                                            z-3 absolute bottom-0 w-full flex justify-center gap-3 py-12 bg-gradient-to-t from-neutral6 to-transparent
                                            transition-all
                                            ${hasUnsavedChanges ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'}
                                        `}
                                    >
                                        <div className='flex w-full gap-3 max-w-xs'>
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
                                </>
                            )}

                        </div>

                        <div className={`flex flex-col justify-center gap-5 min-h-0 transition-[opacity,transform] ease-out ${crate.phase === 'closing' ? 'duration-250' : 'duration-500'}
                            ${showingCrates ? 'w-full lg:max-w-[16rem]' : 'flex-1'}
                            ${isOpeningCrate ? 'opacity-0 translate-x-8 pointer-events-none' : 'opacity-100 translate-x-0'}`}
                        >
                        <Card className={`flex flex-col p-6! gap-6 ${showingCrates ? '' : 'flex-1 min-h-0 p-8! overflow-y-auto'}`}>

                            {showingCrates && <CrateDropTable />}

                            {!showingCrates && activeTab === 'color' && (
                                <div className='flex flex-col gap-4'>

                                    <h2 className='flex items-center gap-2 text-lg font-semibold text-neutral0'>
                                        Unlocked Colors
                                        <FaUnlock className='text-sm mb-0.5' />
                                    </h2>

                                    <div className='flex flex-wrap gap-4'>
                                        {unlockedColors.map((color) => {

                                            const item = colorCatalog.find((entry) => entry.value === color)
                                            const described = describeColor(color, item)

                                            return (
                                                <CosmeticTooltip placement='cursor'
                                                    key={color}
                                                    name={described.name}
                                                    rarity={described.rarity}
                                                >
                                                    <button
                                                        onClick={() => handleColorSelect(color)}
                                                        className='relative w-20 h-20 cursor-pointer'
                                                    >
                                                        <div className={`relative w-full h-full rounded-xl overflow-hidden border-2 transition
                                                            ${selectedColor === color ? 'border-neutral0 scale-105' : 'border-transparent hover:scale-105'}
                                                        `}>
                                                            <ColorSwatch color={color} className='w-full h-full rounded-none!' />
                                                        </div>

                                                        <div className={`absolute -top-2 -right-2 p-1 bg-neutral0 rounded-full scale-80 opacity-0
                                                            ${selectedColor === color && 'scale-100 opacity-100'} transition`}
                                                        >
                                                            <FaCheck className='text-neutral6 text-xs' />
                                                        </div>
                                                    </button>
                                                </CosmeticTooltip>
                                            )
                                        })}
                                    </div>

                                    <h2 className='flex items-center gap-2 text-lg font-semibold text-neutral1 mt-3'>
                                        Locked Colors
                                        <FaLock className='text-sm mb-0.5' />
                                    </h2>

                                    <div className='flex flex-wrap gap-4'>
                                        {lockedColors.map((item) => (
                                            <CosmeticTooltip placement='cursor' key={item.id} locked rarity={item.rarity}>
                                                <div className='relative w-20 h-20 flex items-center justify-center overflow-hidden rounded-xl bg-neutral5'>
                                                    <div className={`absolute inset-0 ${getRarityStyle(item.rarity).tint}`} />
                                                    <FaLock className='relative text-neutral0/10 text-lg' />
                                                    <span className='sr-only'>Locked {item.rarity} color</span>
                                                </div>
                                            </CosmeticTooltip>
                                        ))}
                                    </div>

                                </div>
                            )}

                            {!showingCrates && activeTab === 'face' && (
                                <div className='flex flex-col gap-4'>

                                    <h2 className='flex items-center gap-2 text-lg font-semibold text-neutral0'>
                                        Unlocked Faces
                                        <FaUnlock className='text-sm mb-0.5' />
                                    </h2>

                                    <div className='flex flex-wrap gap-4'>
                                        {unlockedFaces.map((faceIndex) => {

                                            const described = describeFace(faceIndex, faceCatalog.find((entry) => entry.value === faceIndex))

                                            return (
                                                <CosmeticTooltip placement='cursor'
                                                    key={faceIndex}
                                                    name={described.name}
                                                    rarity={described.rarity}
                                                >
                                                    <button
                                                        onClick={() => handleFaceSelect(faceIndex)}
                                                        className={`relative w-20 h-20 overflow-hidden rounded-xl border bg-white/4 transition-all cursor-pointer
                                                            ${selectedFace === faceIndex ? 'border-neutral0 border-2 scale-105' : 'border-neutral4 hover:scale-105'}`}
                                                    >
                                                        <img
                                                            src={AVATAR_FACES[faceIndex]}
                                                            alt={described.name}
                                                            className='w-full h-full object-cover'
                                                        />

                                                        <div className={`absolute top-1 right-1 p-1 bg-neutral0 rounded-full scale-80 opacity-0
                                                            ${selectedFace === faceIndex && 'scale-100 opacity-100'} transition`}
                                                        >
                                                            <FaCheck className='text-neutral6 text-xs' />
                                                        </div>
                                                    </button>
                                                </CosmeticTooltip>
                                            )
                                        })}
                                    </div>

                                    <h2 className='flex items-center gap-2 text-lg font-semibold text-neutral1 mt-6'>
                                        Locked Faces
                                        <FaLock className='text-sm mb-0.5' />
                                    </h2>

                                    <div className='flex flex-wrap gap-4'>
                                        {lockedFaces.map((item) => (
                                            <CosmeticTooltip placement='cursor' key={item.id} locked rarity={item.rarity}>
                                                <div className='relative w-20 h-20 flex items-center justify-center overflow-hidden rounded-xl bg-neutral5'>
                                                    <div className={`absolute inset-0 ${getRarityStyle(item.rarity).tint}`} />
                                                    <FaLock className='relative text-neutral0/10 text-lg' />
                                                    <span className='sr-only'>Locked {item.rarity} face</span>
                                                </div>
                                            </CosmeticTooltip>
                                        ))}
                                    </div>

                                </div>
                            )}

                            {!showingCrates && activeTab === 'hat' && (
                                <div className='flex flex-col gap-4 h-full'>

                                    <h2 className='flex items-center gap-2 text-lg font-semibold text-neutral1'>
                                        Hats
                                        <FaLock className='text-sm mb-0.5' />
                                    </h2>

                                    <div className='flex-1 mb-12 flex flex-col justify-center items-center '>
                                        <Logo className={'mb-3'} />
                                        <h1 className='text-3xl font-bold'>Coming soon</h1>
                                        <p className='mt-2 text-sm text-neutral1'>Hats will be obtained in a future system.</p>
                                    </div>

                                </div>
                            )}

                            {!showingCrates && activeTab === 'title' && (
                                <div className='flex flex-col gap-4'>

                                    <h2 className='flex items-center gap-2 text-lg font-semibold text-neutral0'>
                                        Unlocked Titles
                                        <FaUnlock className='text-sm mb-0.5' />
                                    </h2>

                                    <div className='flex flex-wrap gap-4'>
                                        {unlockedTitles.map((item) => (
                                            <CosmeticTooltip placement='cursor' key={item.id} name={item.name} rarity={item.rarity}>
                                                <button
                                                    onClick={() => handleTitleSelect(item.id)}
                                                    className={`relative w-20 h-20 flex items-center justify-center overflow-hidden rounded-xl border p-2 transition-all cursor-pointer
                                                        ${selectedTitle === item.id ? 'border-neutral0 border-2 scale-105' : 'border-neutral4 hover:scale-105'}`}
                                                >
                                                    <div className={`absolute inset-0 ${getRarityStyle(item.rarity).tint}`} />

                                                    <Title titleId={item.id} size='xs' className='relative text-center leading-tight' />

                                                    <div className={`absolute top-1 right-1 p-1 bg-neutral0 rounded-full scale-80 opacity-0
                                                        ${selectedTitle === item.id && 'scale-100 opacity-100'} transition`}
                                                    >
                                                        <FaCheck className='text-neutral6 text-xs' />
                                                    </div>
                                                </button>
                                            </CosmeticTooltip>
                                        ))}
                                    </div>

                                    <h2 className='flex items-center gap-2 text-lg font-semibold text-neutral1 mt-6'>
                                        Locked Titles
                                        <FaLock className='text-sm mb-0.5' />
                                    </h2>

                                    <div className='flex flex-wrap gap-4'>
                                        {lockedTitles.map((item) => (
                                            <CosmeticTooltip placement='cursor'
                                                key={item.id}
                                                locked
                                                rarity={item.rarity}
                                                // The three earned titles never drop from a crate, so the
                                                // tooltip says how they are unlocked. The tile itself stays
                                                // identical to every other locked cosmetic.
                                                hint={item.earned ? earnedRequirements[item.id] : undefined}
                                            >
                                                <div className='relative w-20 h-20 flex items-center justify-center overflow-hidden rounded-xl bg-neutral5'>
                                                    <div className={`absolute inset-0 ${getRarityStyle(item.rarity).tint}`} />
                                                    <FaLock className='relative text-neutral0/10 text-lg' />
                                                    <span className='sr-only'>Locked {item.rarity} title</span>
                                                </div>
                                            </CosmeticTooltip>
                                        ))}
                                    </div>

                                </div>
                            )}


                        </Card>

                        {showingCrates ? <CrateHeader crate={crate} /> : null}
                        </div>

                    </div>
                )}
            </div>

        </div>
    )
}

export default Locker
