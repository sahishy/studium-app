import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useState } from 'react'
import Topbar from '../../../shared/components/ui/Topbar'
import LoadingState from '../../../shared/components/ui/LoadingState'
import ErrorState from '../../../shared/components/ui/ErrorState'
import TextTabSelector from '../../../shared/components/ui/TextTabSelector'
import Button from '../../../shared/components/ui/Button'
import BottomFade from '../../../shared/components/ui/BottomFade'
import { FaCheck, FaUserPlus } from 'react-icons/fa6'
import { useCircle, useCircleMembers } from '../services/circleService'
import CircleBanner from '../components/CircleBanner'

const tabs = [
    { name: 'agenda', label: 'Agenda' },
    { name: 'members', label: 'Members' },
    { name: 'settings', label: 'Settings' },
]

const CircleOverview = () => {

    const { profile } = useOutletContext()
    const { circleId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()

    const { circle, loading } = useCircle(circleId)
    const { members: circleMembers, loading: circleMembersLoading } = useCircleMembers(circleId)

    const [copied, setCopied] = useState(false)

    if (loading || circleMembersLoading) {
        return <LoadingState fullPage />
    }

    if (!circle) {
        return <ErrorState fullPage title='Circle not found' />
    }

    if (!circleMembers.some((member) => member.userId === profile.uid)) {
        return <ErrorState fullPage title="You aren't in that circle" />
    }

    const activeTab = location.pathname.includes('/settings')
        ? 'settings'
        : location.pathname.includes('/members')
            ? 'members'
            : 'agenda'
    const currentTab = tabs.findIndex((tab) => tab.name === activeTab)

    const handleInvite = async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/join/${circle.inviteCode}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
    }

    const handleTabClick = (tabName) => {
        navigate(`/socials/circle/${circleId}/${tabName}`)
    }

    return (
        <div className='flex flex-col h-full overflow-scroll'>

            <Topbar profile={profile} />

            <div className='w-full flex-1 flex flex-col gap-4 px-24 pb-24 pt-2'>

                <div className='w-full grid grid-cols-[1fr_auto_1fr] items-center gap-6'>

                    <div className='flex items-center gap-4 justify-self-start min-w-0'>
                        <CircleBanner
                            banner={circle.profile.banner}
                            className='rounded-xl w-16 h-16 text-2xl shrink-0'
                        />
                        <div className='flex flex-col min-w-0'>
                            <h1 className='text-2xl font-semibold text-neutral0 truncate'>{circle.profile.title}</h1>
                            <span className="text-sm text-neutral1">{circle.memberCount} member{circle.memberCount !== 1 && 's'}</span>
                        </div>
                    </div>

                    <TextTabSelector
                        className='justify-self-center'
                        tabs={tabs}
                        currentIndex={currentTab >= 0 ? currentTab : 0}
                        onSelect={(tab) => handleTabClick(tab.name)}
                    />

                    <div className='justify-self-end'>
                        <Button type='secondary' onClick={handleInvite}>
                            {copied ? <FaCheck /> : <FaUserPlus />}
                            {copied ? 'Copied' : 'Invite'}
                        </Button>
                    </div>
                </div>


                <div className='w-full min-w-0'>
                    <Outlet context={{ profile, circle, circleId }} />
                </div>

            </div>

            <BottomFade />
            
        </div>
    )
}

export default CircleOverview
