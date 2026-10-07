import { useEffect, useRef, useState } from 'react'
import { useOutletContext, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import { FaCalendar, FaList, FaTh } from 'react-icons/fa'
import { useTasks } from '../contexts/TasksContext'
import BottomFade from '../../../shared/components/ui/BottomFade'
import IconTabSelector from '../../../shared/components/ui/IconTabSelector'
import LoadingState from '../../../shared/components/ui/LoadingState'
import { FaBookOpen, FaCircleExclamation } from 'react-icons/fa6'
import { MAX_USER_TASKS } from '../utils/taskUtils'
import { flushTaskOpsOnPageLifecycle, initializeTaskPendingOpsFlush } from '../services/taskCacheService'
import PageHeader from '../../../shared/components/ui/PageHeader'
import { resolveAgendaPreferences } from '../utils/agendaPreferences'
import { updateAgendaPreferences } from '../services/taskService'

const Agenda = () => {

    const { profile } = useOutletContext()
    const { user: userTasks, isReady: tasksReady } = useTasks()

    const location = useLocation()
    const navigate = useNavigate()
    const scrollRef = useRef(null)
    const [agendaPreferences, setAgendaPreferences] = useState(() => resolveAgendaPreferences(profile))

    useEffect(() => setAgendaPreferences(resolveAgendaPreferences(profile)), [profile])

    const saveAgendaPreferences = async (nextPreferences) => {
        await updateAgendaPreferences(profile.uid, nextPreferences)
        setAgendaPreferences(nextPreferences)
    }

    const tabs = [
        { name: 'list', label: 'List', icon: <FaList /> },
        { name: 'board', label: 'Board', icon: <FaTh /> },
        { name: 'calendar', label: 'Calendar', icon: <FaCalendar /> },
    ]
    const currentTab = tabs.findIndex(tab => location.pathname.includes(tab.name))
    const isTaskLimitReached = userTasks.length >= MAX_USER_TASKS

    useEffect(() => {
        initializeTaskPendingOpsFlush()
    }, [])

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                flushTaskOpsOnPageLifecycle()
            }
        }

        const handlePageHide = () => {
            flushTaskOpsOnPageLifecycle()
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('pagehide', handlePageHide)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('pagehide', handlePageHide)
        }
    }, [])

    const handleClick = (tab) => {
        navigate(`/agenda/${tab}`)
        localStorage.setItem('agenda:lastTab', tab)
    }

    const isCalendar = location.pathname.includes('/calendar')

    return (

        <div ref={scrollRef} className={`flex h-full min-h-0 flex-col ${isCalendar ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            <Topbar profile={profile} />
            <div className={`w-full min-h-0 flex-1 flex flex-col items-start gap-4 px-4 sm:px-8 lg:px-16 xl:px-24 pt-2 mx-auto ${isCalendar ? 'pb-4' : 'pb-8'}`}>

                <div className='flex justify-between items-start w-full'>

                    <PageHeader text={'Agenda'} icon={FaBookOpen} />

                    <IconTabSelector
                        tabs={tabs}
                        currentIndex={currentTab}
                        onSelect={(tab) => handleClick(tab.name)}
                    />

                </div>

                {isTaskLimitReached &&
                    <div className='w-full p-3 rounded-xl border border-red-200 bg-red-50 mb-4'>
                        <p className='text-sm text-red-400 flex items-center gap-2'><FaCircleExclamation />Max task limit of {MAX_USER_TASKS} tasks reached. This limit will be removed soon!</p>
                    </div>
                }

                {!tasksReady
                    ? <LoadingState />
                    : isCalendar ? <div className='min-h-0 w-full flex-1'><Outlet context={{ profile, scrollRef, agendaPreferences, saveAgendaPreferences }} /></div> : <Outlet context={{ profile, scrollRef, agendaPreferences, saveAgendaPreferences }} />}


            </div>
            <BottomFade scrollRef={scrollRef} />
        </div>
    )
}

export default Agenda
