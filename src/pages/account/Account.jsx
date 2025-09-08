import { Outlet, useLocation, useOutletContext } from 'react-router-dom'
import Header from '../../components/main/Header';
import AccountSidebar from '../../components/account/AccountSidebar';

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

            <div className='w-full h-full flex gap-4 px-24 pb-8 pt-2 m-auto'>
                <div className='w-full p-4 mb-8 border-2 border-border rounded-xl flex gap-4'>
                    
                    <AccountSidebar/>

                    <div className='flex-3'>
                        <Outlet context={{ profile }}/> 
                    </div>

                </div>
            </div>

        </div>
    )
}

export default Account
