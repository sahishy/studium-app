import { useRef } from 'react'
import { useOutletContext, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Topbar from '../../../shared/components/ui/Topbar'
import { FaCalendar, FaList, FaTh } from 'react-icons/fa'
import { useTasks } from '../contexts/TasksContext'
import BottomFade from '../../../shared/components/ui/BottomFade'
import IconTabSelector from '../../../shared/components/ui/IconTabSelector'
import LoadingState from '../../../shared/components/ui/LoadingState'
import { FaCircleExclamation } from 'react-icons/fa6'
import { MAX_USER_TASKS } from '../utils/taskUtils'

const Agenda = () => {

    const { profile } = useOutletContext()
    const { user: userTasks, isReady: tasksReady } = useTasks()

    const location = useLocation()
    const navigate = useNavigate()
    const scrollRef = useRef(null)

    const tabs = [
        { name: 'list', label: 'List', icon: <FaList /> },
        { name: 'board', label: 'Board', icon: <FaTh /> },
        { name: 'calendar', label: 'Calendar', icon: <FaCalendar /> },
    ]
    const currentTab = tabs.findIndex(tab => location.pathname.includes(tab.name))
    const isTaskLimitReached = userTasks.length >= MAX_USER_TASKS

    const handleClick = (tab) => {
        navigate(`/agenda/${tab}`)
        localStorage.setItem('agenda:lastTab', tab)
    }

    return (

        <div ref={scrollRef} className="flex flex-col h-full overflow-scroll">
            <Topbar profile={profile} />
            <div className='w-full flex flex-col items-start gap-4 px-24 pb-8 pt-2 mx-auto'>

                <div className='flex justify-between w-full'>
                    <h1 className="text-2xl font-semibold">Agenda</h1>

                    <IconTabSelector
                        tabs={tabs}
                        currentIndex={currentTab}
                        onSelect={(tab) => handleClick(tab.name)}
                    />
                </div>

                {isTaskLimitReached && 
                    <div className='w-full p-3 rounded-xl border border-red-200 bg-red-50 mb-4'>
                        <p className='text-sm text-red-400 flex items-center gap-2'><FaCircleExclamation/>Max task limit of {MAX_USER_TASKS} tasks reached. This limit will be removed soon!</p>
                    </div>
                }

                {!tasksReady
                    ? <LoadingState />
                    : <Outlet context={{ profile, scrollRef }} />}


            </div>
            <BottomFade scrollRef={scrollRef} />
        </div>
    )
}

export default Agenda