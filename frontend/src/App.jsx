import { Routes, Route } from 'react-router-dom'
import PrivateRoute from './routes/PrivateRoute'
import MainScreen from './features/main/pages/MainScreen'
import Agenda from './features/agenda/pages/Agenda'
import AgendaIndexRedirect from './routes/AgendaIndexRedirect'
import ListTab from './features/agenda/pages/ListTab'
import CalendarTab from './features/agenda/pages/CalendarTab'
import BoardTab from './features/agenda/pages/BoardTab'
import Circles from './features/circles/pages/Circles'
import CirclesOverview from './features/circles/pages/CirclesOverview'
import Courses from './features/courses/pages/Courses'
import MyCoursesTab from './features/courses/pages/MyCoursesTab'
import AllCoursesTab from './features/courses/pages/AllCoursesTab'
import CourseOverview from './features/courses/pages/CourseOverview'
import CoursesIndexRedirect from './routes/CoursesIndexRedirect'
import MultiplayerSessionRedirect from './routes/MultiplayerSessionRedirect'
import Avatar from './features/profile/pages/Avatar'
import Settings from './features/profile/pages/Settings'
import ProfileOverview from './features/profile/pages/ProfileOverview'
import Login from './features/auth/pages/Login'
import Signup from './features/auth/pages/Signup'
import Landing from './features/main/pages/Landing'
import { ModalProvider } from './shared/contexts/ModalContext'
import { ToastProvider } from './shared/contexts/ToastContext'
import JoinCircle from './features/circles/pages/JoinCircle'
import ErrorState from './shared/components/ui/ErrorState'
import Resources from './features/resources/pages/Resources'
import Ranked from './features/multiplayer/pages/Ranked'
import MatchRoom from './features/multiplayer/pages/MatchRoom'
import MaintenanceRoute from './routes/MaintenanceRoute'

export default function App() {
	return (
		<MaintenanceRoute>
			<Routes>

			<Route path="/" element={<Landing/>}/>
			<Route path="/login" element={<Login/>}/>
			<Route path="/signup" element={<Signup/>}/>

			<Route
				element={
					<PrivateRoute>
						<ToastProvider>
							<ModalProvider>
								<MainScreen/>
							</ModalProvider>
						</ToastProvider>
					</PrivateRoute>
				}
			>

				<Route element={<MultiplayerSessionRedirect/>}>
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
					<Route path="/courses" element={<Courses/>}>
						<Route index element={<CoursesIndexRedirect/>}/>
						<Route path="me" element={<MyCoursesTab/>}/>
						<Route path="all" element={<AllCoursesTab/>}/>
						<Route path="all/:courseId" element={<CourseOverview/>}/>
					</Route>
					<Route path="/resources" element={<Resources/>}/>
					<Route path="/ranked" element={<Ranked/>}/>
					<Route path="/ranked/room/:roomId" element={<MatchRoom/>}/>
					<Route path="/join/:inviteCode" element={<JoinCircle/>}/>
					<Route path="/avatar" element={<Avatar/>}/>
					<Route path="/settings" element={<Settings/>}/>
					<Route path="/profile/:userId" element={<ProfileOverview/>}/>
				</Route>


			</Route>

			<Route
				path="*"
				element={
					<ErrorState
						fullPage
						title="Page not found"
						description="The page you're looking for doesn't exist or may have been moved."
					/>
				}
			/>

			</Routes>
		</MaintenanceRoute>
	)
}