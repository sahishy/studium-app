import { useOutletContext, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Header from '../../components/main/Header.jsx'
import { FaCalendar, FaList, FaTh } from 'react-icons/fa'

const Agenda = () => {

    const { profile } = useOutletContext()
    const location = useLocation()
    const navigate = useNavigate()

    const tabs = [
        { name: 'list', icon: <FaList/> },
        { name: 'calendar', icon: <FaCalendar/> },
        { name: 'board', icon: <FaTh/> }
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
                <div className='w-full flex flex-col items-start gap-8 px-8 pb-8 pt-2 max-w-5xl m-auto'>


                    <div className='p-2 bg-gray-100 text-gray-600 text-center text-sm rounded-lg flex gap-2'>
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
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent"/>
        </div>
    ) 
}

const TabButton = ( { tab, isCurrent, onClick } ) => {

    const label = tab.name.charAt(0).toUpperCase() + tab.name.slice(1)

    return (
        <button 
            onClick={onClick}
            className={`flex-1 px-4 py-2 rounded-lg border-2
                ${isCurrent ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600' : 'hover:bg-gray-800/5 border-transparent text-gray-400'}
                transition-colors duration-200 cursor-pointer`}
        >
            {tab.icon}
        </button>
    )
}

export default Agenda