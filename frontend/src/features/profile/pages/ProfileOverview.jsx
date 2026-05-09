import { useEffect, useMemo, useState } from 'react'
import { useParams, useOutletContext, useNavigate } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import LoadingState from '../../../shared/components/ui/LoadingState'
import ErrorState from '../../../shared/components/ui/ErrorState'
import AvatarModel from '../../../shared/components/avatar/AvatarModel'
import AvatarPicture from '../../../shared/components/avatar/AvatarPicture'
import background from '../../../assets/images/background.jpeg'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import ProgressBar from '../../../shared/components/ui/ProgressBar'
import { useModal } from '../../../shared/contexts/ModalContext'
import { getSchoolNameById } from '../services/schoolService'
import { getMajorNameById } from '../services/majorService'
import { getUserStatsByUserId, updateUserStatsByUserId } from '../services/statsService'
import { getUserById, updateUserInfo } from '../../auth/services/userService'
import { buildRankedUiState } from '../../multiplayer/utils/multiplayerUtils'
import { FaGear, FaSchool, FaFlask } from 'react-icons/fa6'
import { FaEdit } from 'react-icons/fa'
import EditStatsModal from '../components/modals/EditStatsModal'
import EditDisplayNameModal from '../components/modals/EditDisplayNameModal'
import EditMajorModal from '../components/modals/EditMajorModal'
import { ACT_MAX, ACT_MIN, GPA_MAX, GPA_MIN, SAT_MAX, SAT_MIN, getDraftAcademicFromStats, getParsedNumber, toModeLabel } from '../utils/profileUtils'
import { useUserStats } from '../contexts/UserStatsContext'
import Podium from '../../../shared/components/avatar/Podium'

const SAT_CLASSIC_MODE_ID = 'sat-classic'

const ProfileOverview = () => {

    const navigate = useNavigate()

    const { profile: currentUserProfile } = useOutletContext()
    const { userStats: currentUserStats, loading: currentUserStatsLoading } = useUserStats()
    const { openModal, closeModal } = useModal()
    const { userId } = useParams()

    const [profile, setProfile] = useState(null)
    const [profileLoading, setProfileLoading] = useState(true)
    const [userStats, setUserStats] = useState(null)
    const [statsLoading, setStatsLoading] = useState(true)
    const [isEditMode, setIsEditMode] = useState(false)
    const [draftAcademic, setDraftAcademic] = useState(getDraftAcademicFromStats({ userStats: null, displayName: '' }))
    const [saveError, setSaveError] = useState('')

    const isCurrentUser = currentUserProfile?.uid === userId

    useEffect(() => {

        if (!userId) {
            setProfile(null)
            setProfileLoading(false)
            return
        }

        if (isCurrentUser) {
            setProfile(currentUserProfile ?? null)
            setProfileLoading(false)
            return
        }

        let isCancelled = false

        const loadProfile = async () => {
            setProfileLoading(true)

            try {
                const nextProfile = await getUserById(userId)
                if (!isCancelled) {
                    setProfile(nextProfile)
                }
            } finally {
                if (!isCancelled) {
                    setProfileLoading(false)
                }
            }
        }

        loadProfile()

        return () => {
            isCancelled = true
        }

    }, [userId, isCurrentUser, currentUserProfile])

    useEffect(() => {

        if (!userId) {
            setUserStats(null)
            setStatsLoading(false)
            return
        }

        if (isCurrentUser) {
            setStatsLoading(false)
            return
        }

        let isCancelled = false

        const loadUserStats = async () => {
            setStatsLoading(true)

            try {
                const nextUserStats = await getUserStatsByUserId(userId)
                if (!isCancelled) {
                    setUserStats(nextUserStats)
                }
            } finally {
                if (!isCancelled) {
                    setStatsLoading(false)
                }
            }
        }

        loadUserStats()

        return () => {
            isCancelled = true
        }

    }, [userId, isCurrentUser])

    const displayedProfile = isCurrentUser ? currentUserProfile : profile
    const displayedUserStats = isCurrentUser ? currentUserStats : userStats

    useEffect(() => {
        if (!isEditMode) {
            const currentDisplayName = displayedProfile?.profile?.displayName ?? displayedProfile?.displayName ?? ''
            setDraftAcademic(getDraftAcademicFromStats({ userStats: displayedUserStats, displayName: currentDisplayName }))
        }
    }, [displayedUserStats, displayedProfile, isEditMode])

    const loading = isCurrentUser
        ? profileLoading || currentUserStatsLoading
        : profileLoading || statsLoading

    const academic = displayedUserStats?.academic ?? {}
    const schoolId = academic?.schoolId ?? null
    const schoolAffiliations = Array.isArray(academic?.schoolAffiliations) ? academic.schoolAffiliations : []
    const schoolName = getSchoolNameById(schoolId)
    const attendsAcademies = schoolAffiliations.includes('LCPS-000')

    const targetMajors = Array.isArray(academic?.targetMajors) ? academic.targetMajors : []
    const targetMajorNames = targetMajors
        .map((majorId) => getMajorNameById(majorId) ?? majorId)
        .filter(Boolean)

    const satScore = academic?.scores?.sat
    const actScore = academic?.scores?.act
    const unweightedGpa = academic?.gpa?.unweighted
    const weightedGpa = academic?.gpa?.weighted

    const satClassicRankedUi = useMemo(() => {
        return buildRankedUiState({ userStats: displayedUserStats, modeId: SAT_CLASSIC_MODE_ID })
    }, [displayedUserStats])

    const {
        rankedStats,
        rankInfo,
        currentTierMinElo,
        currentTierSpan,
        currentTierProgress,
        eloToNextTier,
        rankLabel,
        nextTierLabel,
        nextTierThreshold,
    } = satClassicRankedUi

    const handleCancelEditMode = () => {
        const currentDisplayName = displayedProfile?.profile?.displayName ?? displayedProfile?.displayName ?? ''
        setDraftAcademic(getDraftAcademicFromStats({ userStats: displayedUserStats, displayName: currentDisplayName }))
        setSaveError('')
        setIsEditMode(false)
    }

    const openEditDisplayNameModal = () => {
        openModal(
            <EditDisplayNameModal
                value={draftAcademic.displayName}
                closeModal={closeModal}
                onSave={async (nextValue) => {
                    try {
                        await updateUserInfo(userId, {
                            'profile.displayName': nextValue,
                        })
                        setSaveError('')
                    } catch (error) {
                        setSaveError(error?.message || 'Unable to update display name.')
                        return
                    }

                    setDraftAcademic((prev) => ({
                        ...prev,
                        displayName: nextValue,
                    }))
                }}
            />
        )
    }

    const openEditStatsModal = ({ title, label, field, min, max, step = 1 }) => {
        openModal(
            <EditStatsModal
                title={title}
                label={label}
                value={draftAcademic[field]}
                min={min}
                max={max}
                step={step}
                closeModal={closeModal}
                onSave={async (nextValue) => {
                    const nextDraft = {
                        ...draftAcademic,
                        [field]: nextValue,
                    }

                    try {
                        await updateUserStatsByUserId(userId, {
                            academic: {
                                ...academic,
                                targetMajors: nextDraft.targetMajors,
                                scores: {
                                    ...(academic?.scores ?? {}),
                                    sat: getParsedNumber(nextDraft.sat),
                                    act: getParsedNumber(nextDraft.act),
                                },
                                gpa: {
                                    ...(academic?.gpa ?? {}),
                                    unweighted: getParsedNumber(nextDraft.unweightedGpa),
                                    weighted: getParsedNumber(nextDraft.weightedGpa),
                                },
                            },
                        })
                        setSaveError('')
                    } catch (error) {
                        setSaveError(error?.message || 'Unable to update stats.')
                        return
                    }

                    setDraftAcademic((prev) => ({
                        ...prev,
                        [field]: nextValue,
                    }))
                }}
            />
        )
    }

    const openEditMajorModal = () => {
        openModal(
            <EditMajorModal
                value={draftAcademic.targetMajors}
                closeModal={closeModal}
                onSave={async (nextMajors) => {
                    const resolvedMajors = Array.isArray(nextMajors) ? nextMajors : draftAcademic.targetMajors

                    try {
                        await updateUserStatsByUserId(userId, {
                            academic: {
                                ...academic,
                                targetMajors: resolvedMajors,
                                scores: {
                                    ...(academic?.scores ?? {}),
                                    sat: getParsedNumber(draftAcademic.sat),
                                    act: getParsedNumber(draftAcademic.act),
                                },
                                gpa: {
                                    ...(academic?.gpa ?? {}),
                                    unweighted: getParsedNumber(draftAcademic.unweightedGpa),
                                    weighted: getParsedNumber(draftAcademic.weightedGpa),
                                },
                            },
                        })
                        setSaveError('')
                    } catch (error) {
                        setSaveError(error?.message || 'Unable to update target majors.')
                        return
                    }

                    setDraftAcademic((prev) => ({
                        ...prev,
                        targetMajors: resolvedMajors,
                    }))
                }}
            />
        )
    }

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={currentUserProfile} />

            <div className='w-full flex-1 flex flex-col gap-4 px-24 pb-24 pt-2'>

                {loading ? <LoadingState /> : null}

                {!loading && !displayedProfile ? (
                    <ErrorState
                        title='Profile not found'
                        description='This user profile does not exist.'
                    />
                ) : null}

                {!loading && displayedProfile ? (
                    <section className='flex flex-col'>

                        <div className='relative w-full h-64'>
                            <div className='relative w-full h-full overflow-hidden rounded-xl bg-white'>
                                <img src={background} className='absolute opacity-40 w-full' />
                            </div>
                            <AvatarModel
                                profile={displayedProfile}
                                animation={'Idle'}
                                className='absolute w-full! h-64! top-0'
                            />
                            <div className='absolute w-36 h-36 -bottom-12 left-8 rounded-full border-8 border-neutral6 bg-neutral3'>
                                <AvatarPicture
                                    profile={displayedProfile}
                                    className='w-full h-full'
                                />
                            </div>
                        </div>

                        <div className={`flex justify-end gap-3 mt-3`}>
                            {isCurrentUser ? (
                                <>
                                    {isEditMode ? (
                                        <Button type='primary' onClick={handleCancelEditMode}>Done</Button>
                                    ) : (
                                        <Button onClick={() => setIsEditMode(true)}>
                                            Edit Profile
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => navigate('/settings')}
                                        className='p-3!'
                                    >
                                        <FaGear />
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    disabled={true}
                                >
                                    Report
                                </Button>
                            )}
                        </div>

                        <div className='flex flex-col'>
                            <div className='flex items-center gap-3'>
                                <h1 className='text-2xl font-semibold'>
                                    {displayedProfile?.profile?.displayName ?? displayedProfile?.displayName ?? 'Unknown'}
                                </h1>
                                {isCurrentUser && isEditMode ? (
                                    <button
                                        type='button'
                                        onClick={openEditDisplayNameModal}
                                        className='text-neutral1 hover:text-neutral0 transition cursor-pointer'
                                    >
                                        <FaEdit className='text-sm' />
                                    </button>
                                ) : null}
                            </div>
                            <p className='text-xs text-neutral1 flex items-center gap-2 mt-1'>
                                <FaSchool />
                                {schoolName ? `Attends ${schoolName} High School` : 'School unavailable'}
                            </p>
                            {attendsAcademies && (
                                <p className='text-xs text-neutral1 flex items-center gap-2 mt-1'>
                                    <FaFlask />
                                    Attends Academies of Loudoun
                                </p>
                            )}

                        </div>

                        {saveError ? (
                            <p className='text-xs text-red-400 mt-3'>{saveError}</p>
                        ) : null}

                        <hr className='border-neutral4 my-6' />

                        <section className='flex flex-col gap-4'>
                            <h2 className='text-lg font-semibold text-neutral0'>Academics</h2>

                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>

                                <Card className='gap-8! p-6! items-center'>

                                    {(isCurrentUser && isEditMode) && (
                                        <button
                                            type='button'
                                            onClick={openEditMajorModal}
                                            className='absolute top-3 right-3 text-neutral1 hover:text-neutral0 transition cursor-pointer'
                                        >
                                            <FaEdit className='text-sm' />
                                        </button>
                                    )}

                                    <p className='text-lg font-semibold text-neutral1'>Target Major{targetMajorNames.length > 1 && 's'}</p>

                                    <div className={`mt-3 px-3 flex flex-col gap-1 items-center absolute top-1/2 -translate-y-1/2 font-bold text-4xl text-center
                                        ${targetMajorNames.length > 0 ? `text-neutral0 ${targetMajorNames.length > 1 && 'text-xl!'}` : 'text-neutral1'}`}
                                    >
                                        {targetMajorNames.length > 0 ? (
                                            targetMajorNames.map((name) => <p key={name}>{name}</p>)
                                        ) : (
                                            'Undecided'
                                        )}
                                    </div>

                                </Card>

                                <Card className='gap-8! p-6! items-center overflow-hidden'>

                                    <p className='text-lg font-semibold text-neutral1 z-1'>GPA</p>

                                    <div className='flex justify-center gap-24'>

                                        <div className='relative flex flex-col gap-1 items-center w-32 h-24'>
                                            <div className='flex gap-3'>
                                                <p className='text-xs text-neutral1 z-1'>UNWEIGHTED</p>
                                                {(isCurrentUser && isEditMode) && (
                                                    <button
                                                        type='button'
                                                        onClick={() => openEditStatsModal({
                                                            title: 'Edit Unweighted GPA',
                                                            label: 'Unweighted GPA (0-5)',
                                                            field: 'unweightedGpa',
                                                            min: GPA_MIN,
                                                            max: GPA_MAX,
                                                            step: 0.01,
                                                        })}
                                                        className='text-neutral1 hover:text-neutral0 transition cursor-pointer'
                                                    >
                                                        <FaEdit className='text-sm' />
                                                    </button>
                                                )}
                                            </div>
                                            <p className={`font-bold z-1 ${unweightedGpa ? 'text-neutral0 text-5xl' : 'text-neutral1 text-xl'}`}>{unweightedGpa ?? 'Not provided'}</p>
                                            <Podium className={'absolute top-4 w-32 h-32 object-contain pointer-events-none'}/>
                                        </div>

                                        <div className='relative flex flex-col gap-1 items-center w-32 h-24'>
                                            <div className='flex gap-3'>
                                                <p className='text-xs text-neutral1 z-1'>WEIGHTED</p>
                                                {(isCurrentUser && isEditMode) && (
                                                    <button
                                                        type='button'
                                                        onClick={() => openEditStatsModal({
                                                            title: 'Edit Weighted GPA',
                                                            label: 'Weighted GPA (0-5)',
                                                            field: 'weightedGpa',
                                                            min: GPA_MIN,
                                                            max: GPA_MAX,
                                                            step: 0.01,
                                                        })}
                                                        className='text-neutral1 hover:text-neutral0 transition cursor-pointer'
                                                    >
                                                        <FaEdit className='text-sm' />
                                                    </button>
                                                )}
                                            </div>
                                            <p className={`font-bold z-1 ${weightedGpa ? 'text-neutral0 text-5xl' : 'text-neutral1 text-xl'}`}>{weightedGpa ?? 'Not provided'}</p>
                                            <Podium className={'absolute top-4 w-32 h-32 object-contain pointer-events-none'}/>
                                        </div>

                                    </div>
                                </Card>
                            </div>

                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>

                                <Card className='relative gap-9! p-0! overflow-hidden flex items-center justify-end bg-sat0!'>

                                    <p className='text-lg font-semibold text-white z-1 mt-6'>SAT®</p>

                                    {isCurrentUser && isEditMode ? (
                                        <button
                                            type='button'
                                            onClick={() => openEditStatsModal({
                                                title: 'Edit SAT',
                                                label: 'SAT Score (400-1600)',
                                                field: 'sat',
                                                min: SAT_MIN,
                                                max: SAT_MAX,
                                                step: 1,
                                            })}
                                            className='absolute top-3 right-3 text-white hover:text-white/80 transition cursor-pointer z-10'
                                        >
                                            <FaEdit className='text-sm' />
                                        </button>
                                    ) : null}

                                    <div className='bg-white rounded-t-2xl rounded-b-none p-5 min-h-48 w-full max-w-xs flex flex-col'>
                                        <div className='flex-1 flex flex-col gap-1 items-center justify-center'>
                                            {satScore !== null ? (
                                                <>
                                                    <p className='text-xs font-semibold mb-1'>TOTAL SCORE</p>
                                                    <p className='text-6xl font-bold text-[#1F2937]'>{satScore}</p>
                                                    <p className='text-xs font-semibold text-neutral1 underline underline-offset-3'>400-1600</p>
                                                </>
                                            ) : (
                                                <p className='text-xl font-semibold text-neutral1'>Not taken</p>
                                            )}
                                        </div>
                                    </div>
                                </Card>

                                <Card className='relative gap-9! p-0! overflow-hidden flex items-center justify-end bg-sky-50'>

                                    <p className='text-lg font-semibold text-neutral1 z-1 mt-6'>ACT®</p>

                                    {isCurrentUser && isEditMode ? (
                                        <button
                                            type='button'
                                            onClick={() => openEditStatsModal({
                                                title: 'Edit ACT',
                                                label: 'ACT Score (1-36)',
                                                field: 'act',
                                                min: ACT_MIN,
                                                max: ACT_MAX,
                                                step: 1,
                                            })}
                                            className='absolute top-3 right-3 text-neutral1 hover:text-neutral0 transition cursor-pointer z-10'
                                        >
                                            <FaEdit className='text-sm' />
                                        </button>
                                    ) : null}

                                    <div className='bg-white rounded-t-2xl rounded-b-none p-5 min-h-48 w-full max-w-xs flex flex-col'>
                                        <div className='flex-1 flex flex-col gap-3 items-center justify-center'>
                                            {actScore !== null ? (
                                                <>
                                                    <div className='w-28 h-28 rounded-full bg-emerald-600 border-4 border-neutral0 flex items-center justify-center'>
                                                        <p className='text-5xl font-bold text-white'>{actScore}</p>
                                                    </div>
                                                    <p className='text-lg font-semibold'>Composite</p>
                                                </>
                                            ) : (
                                                <p className='text-xl font-semibold text-neutral1'>Not taken</p>
                                            )}
                                        </div>
                                    </div>
                                </Card>

                            </div>
                        </section>

                        <hr className='border-neutral4 my-6' />

                        <section className='flex flex-col gap-4'>
                            <h2 className='text-lg font-semibold text-neutral0'>Ranked</h2>

                            <Card className='max-w-md p-6! gap-3 flex-row items-center'>
                                <img
                                    src={rankInfo.imageSrc}
                                    alt={`${rankLabel} icon`}
                                    className='w-32 h-32 object-cover'
                                />
                                <div className='flex-1 flex flex-col gap-3'>

                                    <div className='flex flex-col'>
                                        <p className='text-xs text-neutral1 uppercase tracking-wide'>{toModeLabel(SAT_CLASSIC_MODE_ID)}</p>
                                        <p className='text-lg font-semibold text-neutral0'>{rankLabel}</p>
                                    </div>

                                    <div className='flex flex-col gap-1'>
                                        <p className='text-4xl font-bold'>
                                            {rankedStats.elo} <span className='text-lg font-semibold text-neutral1'>SAT</span>
                                        </p>
                                        <ProgressBar
                                            value={currentTierProgress}
                                            max={currentTierSpan}
                                            secondaryValue={Math.max(0, rankedStats.peakElo - currentTierMinElo)}
                                            secondaryMax={currentTierSpan}
                                            secondaryClassName='bg-sky-300/40'
                                        />
                                    </div>

                                </div>
                            </Card>
                        </section>

                    </section>
                ) : null}

            </div>
        </div>
    )

}

export default ProfileOverview