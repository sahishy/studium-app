import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react';
import { TbLayoutDashboardFilled, TbFileFilled, TbPawFilled, TbSettingsFilled, TbLogout2, TbArrowBarLeft, TbArrowBarRight } from "react-icons/tb";
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

    const [open, setOpen] = useState(true);

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
        <aside className={`bg-gray-50 border-r-2 border-r-gray-200 flex flex-col shrink-0 ${open ? 'w-2xs p-8 gap-8' : 'p-4 justify-center items-center gap-4'}`}>
            
            <div className='flex flex-col gap-2'>
                <div className={`flex flex-col gap-1 ${!open && 'items-center mt-5'}`}>
                    <div className='flex items-center justify-between gap-4'>

                        <div className='flex items-center justify-start gap-2'>
                            <img src={favicon} alt="Logo" className="w-8 h-8"/>
                            {open && <h2 className="text-2xl font-extrabold">Studium</h2>}
                        </div>

                        {open && (
                            <button
                                onClick={() => setOpen(!open)}
                                className='text-2xl text-gray-600 p-2 rounded-lg hover:bg-gray-800/5 transition-colors duration-200 cursor-pointer'
                            >
                                <TbArrowBarLeft/>
                            </button>
                        )}
                        
                    </div>
                    {open && <h2 className='text-gray-400 text-sm'>{activeUserCount} student{activeUserCount != 1 && 's'} online</h2>}
                </div>

                {!open && (
                    <button
                        onClick={() => setOpen(!open)}
                        className='text-2xl text-gray-600 p-2 rounded-lg hover:bg-gray-800/5 transition-colors duration-200 cursor-pointer flex justify-center items-center'
                    >
                        <TbArrowBarRight/>
                    </button>
                    
                )}
            </div>

            <nav className={`flex flex-col justify-between h-full ${!open && 'mb-5'}`}>

                <div className='flex flex-col gap-2'>
                    {navItems.map((item) => (

                        <NavLink
                            key={item.name}
                            to={item.path}
                            end
                            className={({ isActive }) =>
                                `flex items-center font-semibold ${open ? 'py-2 px-4 gap-2' : 'justify-center'} rounded-lg transition-colors duration-200 ${
                                    (location.pathname.startsWith(item.path)) ? 'text-white bg-gray-800 hover:bg-black' : 'text-gray-600 hover:bg-gray-800/5'
                                }`
                            }
                        >
                            {item.icon}
                            {open && (item.name)}
                            {!open && <div className="invisible pb-[100%]"></div>}
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
                        <div className={`group p-2 mb-2 rounded-lg flex justify-between items-center ${isOpen && 'bg-gray-800/5'} hover:bg-gray-800/5 transition-colors duration-200 min-w-0`}>
                            <div className='flex items-center gap-4 min-w-0'>

                                <div className="relative w-8 h-8 shrink-0">
                                    <img
                                        src={pfp}
                                        alt="profile"
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                    <span
                                        className={`absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 ${isOpen && 'border-gray-200'} group-hover:border-gray-200 border-white rounded-full  transition-colors duration-200`}
                                    ></span>
                                </div>

                                {open && (
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
                                )}

                            </div>
                            {open && (
                                <div className='p-2'>
                                    <PiCaretUpFill className='text-gray-600 text-lg'/>
                                </div>
                            )}
                        </div>
                    }
                </Dropdown>

            </nav>

        </aside>
    )
}

export default Sidebar