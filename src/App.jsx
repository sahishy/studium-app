import { Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './routes/PrivateRoute'
import MainScreen from './pages/main/MainScreen'
import Dashboard from './pages/dashboard/Dashboard'
import Agenda from './pages/agenda/Agenda'
import AgendaIndexRedirect from './pages/agenda/AgendaIndexRedirect'
import ListTab from './pages/agenda/ListTab'
import CalendarTab from './pages/agenda/CalendarTab'
import BoardTab from './pages/agenda/BoardTab'
import Buddy from './pages/buddy/Buddy'
import Circles from './pages/circles/Circles'
import CirclesOverview from './pages/circles/CirclesOverview'
import Account from './pages/account/Account'
import AccountIndexRedirect from './pages/account/AccountIndexRedirect'
import ProfileTab from './pages/account/ProfileTab'
import SettingsTab from './pages/account/SettingsTab'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import Landing from './pages/landing/Landing'
import { ModalProvider } from './contexts/ModalContext'
import JoinCircle from './pages/circles/JoinCircle'
import Subjects from './pages/subjects/Subjects'

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

				<Route path="/agenda" element={<Agenda/>}>
					<Route index element={<AgendaIndexRedirect/>}/>
					<Route path="list" element={<ListTab/>} />
					<Route path="calendar" element={<CalendarTab/>} />
					<Route path="board" element={<BoardTab/>} />
				</Route>

				<Route path="/subjects" element={<Subjects/>}/>

				<Route path="/circles">
					<Route index element={<Circles/>}/>
					<Route path=":circleId" element={<CirclesOverview/>}/>
				</Route>
				<Route path="/join/:inviteCode" element={<JoinCircle/>}/>

				<Route path="/buddy" element={<Buddy/>}/>

				<Route path="/account" element={<Account/>}>
					<Route index element={<AccountIndexRedirect/>}/>
					<Route path="profile" element={<ProfileTab/>}/>
					<Route path="settings" element={<SettingsTab/>}/>
				</Route>


			</Route>

		</Routes>
	)
}