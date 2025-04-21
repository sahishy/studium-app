import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react';
import { TbLayoutDashboardFilled, TbFileFilled, TbPawFilled, TbSettingsFilled, TbLogout2 } from "react-icons/tb";
import { PiCaretUpFill, PiUserFill } from "react-icons/pi";
import { FaUserFriends } from "react-icons/fa";
import { useAuth } from '../../contexts/AuthContext.jsx';
import Dropdown from '../../components/Popovers/Dropdown.jsx';
import { getActiveUserCount } from '../../utils/userUtils.jsx';

import favicon from '../../../public/favicon.ico'
import pfp from '../../assets/default-profile.jpg'


const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: <TbLayoutDashboardFilled/> },
  { name: 'Agenda', path: '/agenda', icon: <TbFileFilled/> },
  { name: 'Circles', path: '/circles', icon: <FaUserFriends/> },
  { name: 'Buddy', path: '/buddy', icon: <TbPawFilled/> },
]

const Sidebar = ( {profile } ) => {

    const navigate = useNavigate();
    const location = useLocation()
    const { logout } = useAuth();
    const [activeUserCount, setActiveUserCount] = useState(0);

    useEffect(() => {

        const unsubscribe = getActiveUserCount(setActiveUserCount);
        
        return () => unsubscribe;

    }, [])

    const handleSelectOption = (option) => {
        switch(option.label) {
            case 'Profile':
                navigate('/account')
                break
            case 'Settings':
                navigate('/account')
                break
            case 'Log Out':
                logout()
                break
            default:
                break
        }
    }
    
    return (
        <aside className="w-2xs bg-gray-50 border-r-2 border-r-gray-200 p-8 flex flex-col gap-8">

            <div className='flex flex-col gap-2'>
                <div className='flex items-center justify-start gap-2'>
                    <img src={favicon} alt="Logo" className="w-8 h-8"/>
                    <h2 className="text-2xl font-extrabold">Studium</h2>
                    <p className='text-sm text-gray-400'>BETA</p>
                </div>
                <h2 className='text-gray-400 text-sm'>{activeUserCount} student{activeUserCount != 1 && 's'} online</h2>
            </div>

            <nav className="flex flex-col justify-between h-full">

                <div className='flex flex-col gap-2'>
                    {navItems.map((item) => (

                        <NavLink
                            key={item.name}
                            to={item.path}
                            end
                            className={({ isActive }) =>
                                `font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                                    (location.pathname.startsWith(item.path)) ? 'text-white bg-gray-800 hover:bg-black' : 'text-gray-600 hover:bg-gray-800/5'
                                }`
                            }
                        >
                            {item.icon}
                            {item.name}
                        </NavLink>

                    ))}                    
                </div>

                <Dropdown
                    options={[
                        { label: 'Profile', icon: <PiUserFill/> },
                        { label: 'Settings', icon: <TbSettingsFilled/> },
                        { isDivider: true },
                        { label: 'Log Out', icon: <TbLogout2/> },
                    ]}
                    onSelect={handleSelectOption}
                >
                    {(isOpen) =>
                        <div className={`group p-2 mb-2 rounded-lg flex justify-between ${isOpen && 'bg-gray-100'} hover:bg-gray-100 transition-colors duration-200`}>
                            <div className='flex items-center gap-4'>

                                <div className="relative w-8 h-8">
                                    <img
                                        src={pfp}
                                        alt="profile"
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                    <span
                                        className={`absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 ${isOpen && 'border-gray-100'} group-hover:border-gray-100 border-white rounded-full  transition-colors duration-200`}
                                    ></span>
                                </div>

                                <div className="flex flex-col pr-2 min-w-0">
                                    <div className='text-gray-600 shrink-0'>
                                        {profile.firstName} {profile.lastName.substring(0, 1)}.
                                    </div>
                                    {profile.currentTask && (
                                        <div className='text-sm text-gray-400 truncate'>
                                            {profile.currentTask.title}
                                        </div>
                                    )}
                                </div>

                            </div>
                            <div className='p-2'>
                                <PiCaretUpFill className='text-gray-600 text-lg'/>
                            </div>
                        </div>
                    }
                </Dropdown>

            </nav>

        </aside>
    )
}

export default Sidebar