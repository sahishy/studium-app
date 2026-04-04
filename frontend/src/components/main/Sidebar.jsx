import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { FaBookOpen, FaUserFriends } from "react-icons/fa";
import logo from '../../assets/images/logo_lg.png'
import { FaArrowRight, FaChild, FaGraduationCap } from 'react-icons/fa6';
import Avatar from '../avatar/Avatar.jsx';

const navItems = [
    { title: 'Agenda', path: '/agenda', icon: <FaBookOpen /> },
    { title: 'Courses', path: '/courses', icon: <FaGraduationCap /> },
    { title: 'Circles', path: '/circles', icon: <FaUserFriends /> },
    { title: 'Profile', path: '/account/profile', icon: <FaChild/> },
]

const Sidebar = ({ profile }) => {

    const navigate = useNavigate();
    const location = useLocation()

    const displayName = profile?.profile?.displayName || profile?.displayName || ''

    return (
        <aside className={`bg-neutral5 p-4 flex flex-col justify-between shrink-0 w-64 border-r border-neutral4`}>

            <div className='flex flex-col gap-6'>

                <img src={logo} alt="Logo" className="w-36 h-12 p-2 object-contain" />

                <div className='py-6 flex flex-col gap-3 items-center'>
                    <button onClick={() => navigate('/account/settings')}>
                        <Avatar profile={profile} className='relative w-16 h-16 group/avatar cursor-pointer'>
                            <div className={`absolute -bottom-1 -right-1 bg-neutral3/40 backdrop-blur-xs rounded-full p-2
                                opacity-0 group-hover/avatar:opacity-100 transition
                            `}>
                                <FaArrowRight className='text-sm group-hover/avatar:-rotate-45 transition'/>
                            </div>
                        </Avatar>
                    </button>

                    <div className='flex flex-col items-center'>
                        <h1 className='font-semibold'>{profile.firstName} {profile.lastName}</h1>
                        <p className='text-xs text-text2'>@{displayName}</p>
                    </div>
                </div>

                <div className='flex flex-col'>
                    {navItems.map((item, index) => (
                        <SidebarNavLink key={index} item={item} isActive={location.pathname.startsWith(item.path)} />
                    ))}
                </div>


            </div>

            <div className='flex flex-col gap-4'>

                

            </div>


        </aside>
    )
}

const SidebarNavLink = ({ item, isActive }) => {
    return (
        <NavLink
            key={item.title}
            to={item.path}
            end
            className={
                `flex items-center p-3 gap-2 rounded-xl transition-all  ${(isActive) ? 'text-neutral0 bg-neutral3' : 'text-neutral1 hover:bg-neutral4'
                }`
            }
        >
            <div className='text-sm'>{item.icon}</div>
            <div className='text-sm leading-0 text-nowrap'>{item.title}</div>
        </NavLink>
    )
}

export default Sidebar