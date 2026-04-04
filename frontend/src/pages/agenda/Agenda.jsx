import { useOutletContext, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Topbar from '../../components/main/Topbar.jsx'
import { FaCalendar, FaList, FaTh } from 'react-icons/fa'
import { useTasks } from '../../contexts/TasksContext.jsx'
import BottomFade from '../../components/main/BottomFade.jsx'
import IconTabSelector from '../../components/main/IconTabSelector.jsx'
import LoadingState from '../../components/main/LoadingState.jsx'

const Agenda = () => {

    const { profile } = useOutletContext()
    const { isReady: tasksReady } = useTasks()

    const location = useLocation()
    const navigate = useNavigate()

    const tabs = [
        { name: 'list', label: 'List', icon: <FaList/> },
        { name: 'board', label: 'Board', icon: <FaTh/> },
        { name: 'calendar', label: 'Calendar', icon: <FaCalendar/> },
    ]
    const currentTab = tabs.findIndex(tab => location.pathname.includes(tab.name))

    const handleClick = (tab) => {
        navigate(`/agenda/${tab}`)
        localStorage.setItem('agenda:lastTab', tab)
    }

    return (

        <div className="flex flex-col h-full overflow-scroll">
            <Topbar profile={profile}/>
            <div className='w-full flex flex-col items-start gap-4 px-24 pb-8 pt-2 mx-auto'>

                <div className='flex justify-between w-full'>
                    <h1 className="text-2xl font-semibold">Agenda</h1>

                    <IconTabSelector
                        tabs={tabs}
                        currentIndex={currentTab}
                        onSelect={(tab) => handleClick(tab.name)}
                    />
                </div>

                {!tasksReady
                    ? <LoadingState label='Loading tasks...' />
                    : <Outlet context={{ profile }} />}


            </div>
            <BottomFade/>
        </div>
    ) 
}

export default Agenda