import { useOutletContext } from 'react-router-dom'

import Header from '../../components/main/Header.jsx'
import DashboardTasks from  '../../components/dashboard/DashboardTasks.jsx'
import DashboardLevel from '../../components/dashboard/DashboardLevel.jsx'
import DashboardStreak from '../../components/dashboard/DashboardStreak.jsx'
import DashboardCircles from '../../components/dashboard/DashboardCircles.jsx'
import DashboardBuddy from '../../components/dashboard/DashboardBuddy.jsx'
import DashboardGreeting from '../../components/dashboard/DashboardGreeting.jsx'

const Dashboard = () => {
    const { profile } = useOutletContext()

    return (
        <div className="flex flex-col h-full overflow-scroll">

            <Header text={'Dashboard'} profile={profile}/>

            <div className='w-full h-full flex flex-col gap-4 lg:flex-row lg:gap-8 px-24 pb-8 pt-2 m-auto min-w-0'>

                <div className='flex-5 min-w-0 flex flex-col gap-4'>

                    <DashboardGreeting profile={profile}/>
                    <DashboardTasks profile={profile}/>

                </div>

                <div className='flex-3 flex flex-col justify-start gap-4 w-full min-w-0'>
                    
                    <DashboardLevel profile={profile}/>
                    <DashboardCircles/>
                    {/* <DashboardBuddy profile={profile}/> */}
                    {/* <DashboardStreak profile={profile}/> */}

                </div>

            </div>

        </div>
    )
}

export default Dashboard