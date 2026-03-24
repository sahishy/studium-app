import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react';
import { TbFileFilled, TbSettingsFilled } from "react-icons/tb";
import { PiCaretUpFill, PiUserFill } from "react-icons/pi";
import { BiSolidDoorOpen } from "react-icons/bi";
import { FaUserFriends } from "react-icons/fa";
import { useAuth } from '../../contexts/AuthContext.jsx';
import Dropdown from '../Popovers/Dropdown.jsx';
import { getActiveUserCount } from '../../services/userService.jsx';

import favicon from '../../../public/favicon.ico'
import pfp from '../../assets/default-profile.jpg'


const navItems = [
    { header: true, title: 'General' },
    { title: 'Agenda', path: '/agenda', icon: <TbFileFilled/> },
    { title: 'Circles', path: '/circles', icon: <FaUserFriends/> },
    // { header: true, title: 'Resources' }
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
                navigate('/account/profile')
                break
            case 'Settings':
                navigate('/account/settings')
                break
            case 'Log Out':
                logout()
                break
            default:
                break
        }
    }
    
    return (
        <aside className={`bg-background2 px-4 py-10 flex flex-col justify-between shrink-0 
            w-72 rounded-r-xl border-r-2 border-r-border`}>
            
            <div className='flex flex-col gap-2'>
                <div className='flex flex-col'>
                    <div className='flex items-center justify-between gap-4'>

                        <div className='flex items-center justify-start gap-2'>
                            <img src={favicon} alt="Logo" className="w-12 h-12 p-2"/>
                            <div className='flex flex-col gap-2'>
                                <h2 className="text-2xl font-extrabold leading-4 text-nowrap">Studium</h2>
                                
                                <div className='flex gap-2 items-center'>
                                    <span className={`w-2 h-2 bg-emerald-400 rounded-full`}></span>
                                    <h2 className='text-text2 leading-3 text-sm text-nowrap'>{activeUserCount} student{activeUserCount != 1 && 's'} online</h2>
                                </div>
                            </div>
                        </div>
                        
                    </div>
                </div>

                {navItems.map((item, index) => (
                    (item.header ? (
                        <div className='p-1 mt-4 flex items-center gap-4' key={crypto.randomUUID()}>
                            <h2 className='text-text2 text-nowrap'>{item.title}</h2>
                            <hr className='border-1 border-border rounded-full w-full'></hr>
                        </div>
                    ) : (
                        <SidebarNavLink key={index} item={item} isActive={location.pathname.startsWith(item.path)} />
                    ))
                ))}

            </div>                 

            <div className='flex flex-col gap-4'>

                <Dropdown
                    options={[
                        { label: 'Profile', icon: <PiUserFill/> },
                        { label: 'Settings', icon: <TbSettingsFilled/> },
                        { isDivider: true },
                        { label: 'Log Out', icon: <BiSolidDoorOpen className='text-lg'/> },
                    ]}
                    onSelect={handleSelectOption}
                >
                    {(isOpen) =>
                        <div className={`group p-2 mb-2 rounded-xl flex justify-between items-center
                            ${isOpen && 'bg-background5'} hover:bg-background5 
                            transition-colors duration-200 min-w-0`}>
                            <div className='flex items-center gap-4 min-w-0'>

                                <div className="relative w-8 h-8 shrink-0">
                                    <img
                                        src={pfp}
                                        alt="profile"
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                    <span
                                        className={`absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-background2 group-hover:border-background4 rounded-full transition-colors duration-200`}
                                    ></span>
                                </div>

                                <div className="flex flex-col pr-2 min-w-0">
                                    <div className='text-text1 shrink-0 text-nowrap'>
                                        {profile.firstName} {profile.lastName.substring(0, 1)}.
                                    </div>
                                    {profile.currentTask && (
                                        <div className='text-sm text-text2 truncate text-nowrap'>
                                            {profile.currentTask.title}
                                        </div>
                                    )}
                                </div>

                            </div>

                            <div className='p-2'>
                                <PiCaretUpFill className='text-text1 text-lg'/>
                            </div>
                        </div>
                    }
                </Dropdown>                
            </div>


        </aside>
    )
}

const SidebarNavLink = ( { item, isActive } ) => {
    return (
        <NavLink
            key={item.title}
            to={item.path}
            end
            className={
                `flex items-center font-semibold p-3 gap-2 border-2 rounded-xl transition-all duration-200 ${
                    (isActive) ? 'text-text0 bg-background1 border-border shadow-lg shadow-shadow' : 'text-text2 hover:bg-background5 border-transparent'
                }`
            }
        >
            <div className='text-xl'>{item.icon}</div>
            <div className='text-sm leading-0 text-nowrap'>{item.title}</div>
        </NavLink>
    )
}

export default Sidebar