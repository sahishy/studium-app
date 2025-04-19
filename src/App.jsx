import { Routes, Route } from 'react-router-dom'
import PrivateRoute from './routes/PrivateRoute'
import MainScreen from './features/main/MainScreen'
import Dashboard from './features/dashboard/Dashboard'
import Agenda from './features/agenda/Agenda'
import Buddy from './features/buddy/Buddy'
import Circles from './features/circles/Circles'
import CirclesOverview from './features/circles/CirclesOverview'
import Account from './features/account/Account'
import Login from './features/auth/Login'
import Signup from './features/auth/Signup'
import Landing from './features/landing/Landing'
import { ModalProvider } from './contexts/ModalContext'
import JoinCircle from './features/circles/JoinCircle'

export default function App() {
	return (
		<Routes>

		<Route path="/" element={<Landing/>}/>
		<Route path="/login" element={<Login/>}/>
		<Route path="/signup" element={<Signup/>}/>

		<Route
			element={
			<PrivateRoute>
				<ModalProvider>
					<MainScreen/>
				</ModalProvider>
			</PrivateRoute>
			}
		>
			<Route path="/dashboard" element={<Dashboard/>}/>
			<Route path="/agenda" element={<Agenda/>}/>
			<Route path="/buddy" element={<Buddy/>}/>

			<Route path="/circles">
				<Route index element={<Circles/>}/>
				<Route path=":circleId" element={<CirclesOverview/>}/>
			</Route>

			<Route path="/join/:inviteCode" element={<JoinCircle/>}/>

			<Route path="/account" element={<Account/>}/>
		</Route>
		</Routes>
	)
}