import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// import { HashRouter as Router } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'

const applySavedAppearance = () => {

	try {
		const appearance = localStorage.getItem('appearance');
		if(!appearance || appearance === 'system') return;

		const existing = document.getElementById('app-theme-vars');
		if(existing) existing.remove();

		const style = document.createElement('style');
		style.id = 'app-theme-vars';

		if(appearance === 'light') {
			style.textContent = `:root {
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
			}`;
		} else if(appearance === 'dark') {
			style.textContent = `:root {
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
			}`;
		}

		document.head.appendChild(style);
	} catch (e) {
		// ignore errors like localStorage unavailable
	}
};

// run before mounting react so the correct theme is visible on first draw
applySavedAppearance();

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<BrowserRouter>
			<AuthProvider>
				<App />
			</AuthProvider>
		</BrowserRouter>
	</StrictMode>,
)
