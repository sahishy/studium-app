import { Outlet, useLocation, useOutletContext } from 'react-router-dom'
import Header from '../../components/main/Header';

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

            <Header text={getTabTitle()} profile={profile}/>

        </div>
    )
}

export default Account
