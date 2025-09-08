import { PiUserFill } from "react-icons/pi"
import { TbSettingsFilled } from "react-icons/tb"
import { NavLink, useLocation } from "react-router-dom"

const AccountSidebar = () => {

    const location = useLocation();

    const navItems = [
        { name: 'Profile', path: '/account/profile', icon: <PiUserFill/> },
        { name: 'Settings', path: '/account/settings', icon: <TbSettingsFilled/> },
    ]

    return (
        <div className='flex-1 p-4 flex flex-col gap-2 bg-background2 rounded-xl'>
            {navItems.map((item) => (

                <NavLink
                    key={item.name}
                    to={item.path}
                    end
                    className={({ isActive }) =>
                        `flex items-center font-semibold ${open ? 'py-2 px-4 gap-2' : 'justify-center p-3'} border-2 rounded-xl transition-all duration-200 ${
                            (location.pathname.startsWith(item.path)) ? 'text-text0 bg-background0 hover:bg-background2 border-border shadow-lg shadow-shadow' : 'text-text1 hover:bg-background5 border-transparent'
                        }`
                    }
                >
                    {item.icon}
                    {item.name}
                </NavLink>
            ))}                    
        </div>
    )

}

export default AccountSidebar