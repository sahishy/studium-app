import { Routes, Route } from 'react-router-dom'
import PrivateRoute from './routes/PrivateRoute'
import MainScreen from './pages/main/MainScreen'
import Agenda from './pages/agenda/Agenda'
import AgendaIndexRedirect from './routes/AgendaIndexRedirect'
import ListTab from './pages/agenda/ListTab'
import CalendarTab from './pages/agenda/CalendarTab'
import BoardTab from './pages/agenda/BoardTab'
import Circles from './pages/circles/Circles'
import CirclesOverview from './pages/circles/CirclesOverview'
import Courses from './pages/courses/Courses'
import Account from './pages/account/Account'
import AccountIndexRedirect from './routes/AccountIndexRedirect'
import ProfileTab from './pages/account/ProfileTab'
import SettingsTab from './pages/account/SettingsTab'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import Landing from './pages/landing/Landing'
import { ModalProvider } from './contexts/ModalContext'
import JoinCircle from './pages/circles/JoinCircle'

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

				<Route path="/agenda" element={<Agenda/>}>
					<Route index element={<AgendaIndexRedirect/>}/>
					<Route path="list" element={<ListTab/>} />
					<Route path="calendar" element={<CalendarTab/>} />
					<Route path="board" element={<BoardTab/>} />
				</Route>

				<Route path="/circles">
					<Route index element={<Circles/>}/>
					<Route path=":circleId" element={<CirclesOverview/>}/>
				</Route>
				<Route path="/courses" element={<Courses/>}/>
				<Route path="/join/:inviteCode" element={<JoinCircle/>}/>

				<Route path="/account" element={<Account/>}>
					<Route index element={<AccountIndexRedirect/>}/>
					<Route path="profile" element={<ProfileTab/>}/>
					<Route path="settings" element={<SettingsTab/>}/>
				</Route>


			</Route>

		</Routes>
	)
}