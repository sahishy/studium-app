import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import { BrowserRouter } from 'react-router-dom'
import { HashRouter as Router  } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<Router>
			<AuthProvider>
				<App/>
			</AuthProvider>
		</Router>
	</StrictMode>,
)