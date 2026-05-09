import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// import { HashRouter as Router } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './features/auth/contexts/AuthContext.jsx'

// document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<BrowserRouter>
			<AuthProvider>
				<App />
			</AuthProvider>
		</BrowserRouter>
	</StrictMode>,
)
