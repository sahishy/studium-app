import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react';
import { TbSettingsFilled } from "react-icons/tb";
import { PiCaretUpFill, PiUserFill } from "react-icons/pi";
import { BiSolidDoorOpen } from "react-icons/bi";
import { FaBookOpen, FaUserFriends } from "react-icons/fa";
import { useAuth } from '../../contexts/AuthContext.jsx';
import Dropdown from '../Popovers/Dropdown.jsx';
import { getActiveUserCount } from '../../services/userService.jsx';

import logo from '../../assets/images/logo_lg.png'
import pfp from '../../assets/images/default-profile.jpg'
import { FaGraduationCap } from 'react-icons/fa6';


const navItems = [
    { title: 'Agenda', path: '/agenda', icon: <FaBookOpen/> },
    { title: 'Courses', path: '/courses', icon: <FaGraduationCap/> },
    { title: 'Circles', path: '/circles', icon: <FaUserFriends/> },
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
        <aside className={`bg-neutral5 p-4 flex flex-col justify-between shrink-0 w-64 border-r border-neutral4`}>
            
            <div className='flex flex-col gap-6'>
                
                <img src={logo} alt="Logo" className="w-36 h-12 p-2 object-contain"/>

                <div className='flex flex-col'>
                    {navItems.map((item, index) => (
                        <SidebarNavLink key={index} item={item} isActive={location.pathname.startsWith(item.path)} />
                    ))}                    
                </div>
  

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
                            ${isOpen && 'bg-neutral3'} hover:bg-neutral3 
                            transition-colors  min-w-0`}>
                            <div className='flex items-center gap-4 min-w-0'>

                                <div className="relative w-8 h-8 shrink-0">
                                    <img
                                        src={pfp}
                                        alt="profile"
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                    <span
                                        className={`absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-background2 group-hover:border-background4 rounded-full transition-colors `}
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
                `flex items-center p-3 gap-2 rounded-xl transition-all  ${
                    (isActive) ? 'text-neutral0 bg-neutral3' : 'text-neutral1 hover:bg-neutral4'
                }`
            }
        >
            <div className='text-sm'>{item.icon}</div>
            <div className='text-sm leading-0 text-nowrap'>{item.title}</div>
        </NavLink>
    )
}

export default Sidebar