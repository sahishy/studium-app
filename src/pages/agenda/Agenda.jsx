import { useOutletContext, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Header from '../../components/main/Header.jsx'
import { FaCalendar, FaList, FaTh } from 'react-icons/fa'
import { useCircles } from '../../contexts/CirclesContext.jsx'
import { useTasks } from '../../contexts/TasksContext.jsx'
import { useSubjects } from '../../contexts/SubjectsContext.jsx'
import BottomFade from '../main/BottomFade.jsx'
import Tooltip from '../../components/tooltips/Tooltip.jsx'

const Agenda = () => {

    const { profile } = useOutletContext()
    const { circles } = useCircles()
    const { user: userTasks, circle: circleTasks } = useTasks()
    const { user: userSubjects, circle: circleSubjects } = useSubjects()

    const location = useLocation()
    const navigate = useNavigate()

    const tabs = [
        { name: 'list', icon: <FaList/> },
        { name: 'board', icon: <FaTh/> },
        { name: 'calendar', icon: <FaCalendar/> },
    ]
    const currentTab = tabs.findIndex(tab => location.pathname.includes(tab.name))

    const handleClick = (tab) => {
        navigate(`/agenda/${tab}`)
        localStorage.setItem('agenda:lastTab', tab)
    }

    return (

        <div className="flex flex-col h-full relative">
            <div className="flex-1 overflow-y-auto relative">
                <Header text={'Agenda'} profile={profile}/>
                <div className='w-full flex flex-col items-start gap-4 px-24 pb-8 pt-2 m-auto'>

                    <div className='p-1 bg-background2 text-text1 text-center text-sm rounded-xl flex gap-1'>
                        {tabs.map((tab, index) => (
                            <TabButton 
                                key={tab.name}
                                tab={tab}
                                isCurrent={currentTab === index}
                                onClick={() => 
                                    handleClick(tab.name)
                                }
                            />
                        ))}
                    </div>

                    <Outlet context={{ profile }}/>


                </div>
                
            </div>
            <BottomFade/>
        </div>
    ) 
}

const TabButton = ( { tab, isCurrent, onClick } ) => {

    const label = tab.name.charAt(0).toUpperCase() + tab.name.slice(1)

    return (
        <Tooltip text={label}>
            <button 
                onClick={onClick}
                className={`flex-1 px-4 py-2 rounded-xl border-2
                    ${isCurrent ? 'bg-background1 border-border text-text1' : 'hover:bg-background5 border-transparent text-text2'}
                    transition-colors duration-200 cursor-pointer`}
            >
                {tab.icon}
            </button>
        </Tooltip>
    )
}

export default Agenda