import { Outlet, useLocation, useOutletContext } from 'react-router-dom'
import Topbar from '../../components/main/Topbar.jsx';

const Account = () => {

    const { profile } = useOutletContext()
    const location = useLocation();

    const getTabTitle = () => {
        const trim = location.pathname.substring(1, location.pathname.length);
        const end = trim.substring(trim.indexOf('/') + 1, trim.length);
        return end[0].toUpperCase() + end.substring(1, end.length);
    }

    return (
        <div className='flex flex-col h-full overflow-scroll'>
            <Topbar profile={profile} />

            <div className='w-full px-24 pt-2'>
                <h1 className='text-2xl font-semibold'>{getTabTitle()}</h1>
            </div>

        </div>
    )
}

export default Account
