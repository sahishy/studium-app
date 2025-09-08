import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const SettingsTab = () => {

    const { profile } = useOutletContext()
    const { logout } = useAuth()

    return (
        <div className='flex flex-col gap-4'>

            <ProfileAppearance profile={profile}/>

        </div>
    )
}

const ProfileContainer = ( { className, children } ) => {
    return (
        <div className={`p-4 border-2 border-border rounded-xl ${className}`}>
            {children}
        </div>
    )
}

const ProfileAppearance = ( { profile } ) => {
    const [appearance, setAppearance] = useState(() => {
        try {
            return localStorage.getItem('appearance') || 'system';
        } catch (e) {
            return 'system';
        }
    });

    // apply theme whenever appearance changes
    useEffect(() => {
        applyTheme(appearance);
        try { localStorage.setItem('appearance', appearance); } catch (e) {}
    }, [appearance]);

    // helper that injects/removes CSS variable overrides for light/dark
    const applyTheme = (mode) => {
        const existing = document.getElementById('app-theme-vars');
        if (existing) existing.remove();

        if (mode === 'system' || typeof document === 'undefined') {
            // system: do not override -- let CSS use prefers-color-scheme
            return;
        }

        const style = document.createElement('style');
        style.id = 'app-theme-vars';

        if (mode === 'light') {
            style.textContent = `
:root {
  --color-primary0: #111827;
  --color-primary1: #111827;
  --color-background0: #ffffff;
  --color-background1: #ffffff;
  --color-background2: oklch(97.6% 0.0025 256.0);
  --color-background3: #f5f6f7;
  --color-background4: #f5f6f7;
  --color-background5: rgba(0,0,0,0.1);
  --color-text0: #1f2937;
  --color-text1: #4b5563;
  --color-border: #e5e7eb;
}
`;
        } else if (mode === 'dark') {
            style.textContent = `
:root {
        --color-primary0: white;
        --color-primary1: #dfdfe0;

        --color-background0: #28282c;
        --color-background1: #303034;
        --color-background2: #242428;
        --color-background3: #38383c;
        --color-background4: #404044;
        --color-background5: #48484c60;

        --color-text0: #FFFFFF;
        --color-text1: #FFFFFF;
        --color-text2: #9e9fa2;
        --color-text3: #4f5055;
        --color-text4: #4b5563;

        --color-border: #38383c;
        --color-shadow: transparent;
        --color-backdrop: #0a0a0d66;

}
`;
        }

        document.head.appendChild(style);
    };

    const btnBase = "w-30 h-30 rounded-xl flex justify-end items-end cursor-pointer border-2";

    return (
        <ProfileContainer>
            <div className='flex-1 flex flex-col gap-4'>
                <p className='text-text1'>App Appearance</p>

                <div className='flex gap-4'>

                    {/* light mode */}
                    <button
                        onClick={() => setAppearance('light')}
                        className={btnBase + " bg-gray-200"}
                        style={appearance === 'light' ? { borderColor: "var(--color-primary1)" } : { borderColor: "transparent" }}
                        aria-pressed={appearance === 'light'}
                        title="Light"
                    >
                        <div className='w-[85%] h-[85%] bg-white rounded-xl flex items-center justify-center'>
                        </div>
                    </button>

                    {/* dark mode */}
                    <button
                        onClick={() => setAppearance('dark')}
                        className={btnBase + " bg-[#28282c]"}
                        style={appearance === 'dark' ? { borderColor: "var(--color-primary1)" } : { borderColor: "transparent" }}
                        aria-pressed={appearance === 'dark'}
                        title="Dark"
                    >
                        <div className='w-[85%] h-[85%] bg-[#404044] rounded-xl flex items-center justify-center'>
                        </div>
                    </button>

                    {/* system default */}
                    <button
                        onClick={() => setAppearance('system')}
                        className={btnBase + " rounded-xl flex"}
                        style={appearance === 'system' ? { borderColor: "var(--color-primary1)" } : { borderColor: "transparent" }}
                        aria-pressed={appearance === 'system'}
                        title="System preference"
                    >
                        <div className='flex-1 h-full bg-gray-200 border-r-0 border-border rounded-l-lg flex justify-end items-end'>
                            <div className='w-[60%] h-[85%] bg-white rounded-l-lg'></div>
                        </div>
                        <div className='flex-1 h-full bg-[#28282c] border-l-0 border-gray-600 rounded-r-lg flex items-end'>
                            <div className='w-full h-[85%] bg-[#404044] rounded-r-lg'></div>
                        </div>
                    </button>

                </div>
            </div>
        </ProfileContainer>
    )
}

export default SettingsTab
