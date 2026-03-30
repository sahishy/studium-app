import { useOutletContext, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Topbar from '../../components/main/Topbar.jsx'
import { FaCalendar, FaList, FaTh } from 'react-icons/fa'
import { useCircles } from '../../contexts/CirclesContext.jsx'
import { useTasks } from '../../contexts/TasksContext.jsx'
import BottomFade from '../../components/main/BottomFade.jsx'
import IconTabSelector from '../../components/main/IconTabSelector.jsx'

const Agenda = () => {

    const { profile } = useOutletContext()
    const { circles } = useCircles()
    const { user: userTasks, circle: circleTasks } = useTasks()

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

        <div className="flex flex-col h-full relative">
            <Topbar profile={profile} />
            <div className="flex-1 overflow-y-auto relative">
                <div className='w-full flex flex-col items-start gap-4 px-24 pb-8 pt-2 m-auto'>

                    <div className='flex items-center justify-between w-full'>
                        <h1 className="text-2xl font-semibold">Agenda</h1>

                        <IconTabSelector
                            tabs={tabs}
                            currentIndex={currentTab}
                            onSelect={(tab) => handleClick(tab.name)}
                        />
                    </div>


                    <Outlet context={{ profile }}/>


                </div>
                
            </div>
            <BottomFade/>
        </div>
    ) 
}

export default Agenda