import { Routes, Route } from 'react-router-dom'
import PrivateRoute from './routes/PrivateRoute'
import MainScreen from './features/main/pages/MainScreen'
import Agenda from './features/agenda/pages/Agenda'
import AgendaIndexRedirect from './routes/AgendaIndexRedirect'
import ListTab from './features/agenda/pages/ListTab'
import CalendarTab from './features/agenda/pages/CalendarTab'
import BoardTab from './features/agenda/pages/BoardTab'
import Socials from './features/socials/pages/Socials'
import CircleOverview from './features/socials/pages/CircleOverview'
import CircleAgenda from './features/socials/pages/CircleAgenda'
import CircleAgendaListTab from './features/socials/pages/CircleAgendaListTab'
import CircleAgendaBoardTab from './features/socials/pages/CircleAgendaBoardTab'
import CircleAgendaCalendarTab from './features/socials/pages/CircleAgendaCalendarTab'
import CircleMembersTab from './features/socials/pages/CircleMembersTab'
import CircleSettingsTab from './features/socials/pages/CircleSettingsTab'
import Friends from './features/socials/pages/Friends'
import AllFriendsTab from './features/socials/pages/AllFriendsTab'
import IncomingFriendsTab from './features/socials/pages/IncomingFriendsTab'
import Courses from './features/courses/pages/Courses'
import MyCoursesTab from './features/courses/pages/MyCoursesTab'
import AllCoursesTab from './features/courses/pages/AllCoursesTab'
import CourseOverview from './features/courses/pages/CourseOverview'
import CoursesIndexRedirect from './routes/CoursesIndexRedirect'
import MultiplayerSessionRedirect from './routes/MultiplayerSessionRedirect'
import Avatar from './features/profile/pages/Avatar'
import Settings from './features/profile/pages/Settings'
import ProfileOverview from './features/profile/pages/ProfileOverview'
import Landing from './features/main/pages/Landing'
import Welcome from './features/auth/pages/Welcome'
import { ModalProvider } from './shared/contexts/ModalContext'
import { ToastProvider } from './shared/contexts/ToastContext'
import JoinCircle from './features/socials/pages/JoinCircle'
import ErrorState from './shared/components/ui/ErrorState'
import Resources from './features/resources/pages/Resources'
import Play from './features/multiplayer/pages/Play'
import MatchRoom from './features/multiplayer/pages/MatchRoom'
import MaintenanceRoute from './routes/MaintenanceRoute'
import FriendsIndexRedirect from './routes/FriendsIndexRedirect'
import CircleOverviewIndexRedirect from './routes/CircleOverviewIndexRedirect'
import CircleAgendaIndexRedirect from './routes/CircleAgendaIndexRedirect'

export default function App() {
	return (
		<ModalProvider>
			<MaintenanceRoute>
				<Routes>

					<Route path="/" element={<Landing />} />
					<Route path="/welcome" element={<Welcome />} />

					<Route
						element={
							<PrivateRoute>
								<ToastProvider>
									<MainScreen />
								</ToastProvider>
							</PrivateRoute>
						}
					>

						<Route element={<MultiplayerSessionRedirect />}>
							<Route path="/agenda" element={<Agenda />}>
								<Route index element={<AgendaIndexRedirect />} />
								<Route path="list" element={<ListTab />} />
								<Route path="calendar" element={<CalendarTab />} />
								<Route path="board" element={<BoardTab />} />
							</Route>
							<Route path="/socials">
								<Route index element={<Socials />} />
								<Route path="circle/:circleId" element={<CircleOverview />}>
									<Route index element={<CircleOverviewIndexRedirect />} />
									<Route path="agenda" element={<CircleAgenda />}>
										<Route index element={<CircleAgendaIndexRedirect />} />
										<Route path="list" element={<CircleAgendaListTab />} />
										<Route path="board" element={<CircleAgendaBoardTab />} />
										<Route path="calendar" element={<CircleAgendaCalendarTab />} />
									</Route>
									<Route path="members" element={<CircleMembersTab />} />
									<Route path="settings" element={<CircleSettingsTab />} />
								</Route>
								<Route path="friends" element={<Friends />}>
									<Route index element={<FriendsIndexRedirect />} />
									<Route path="all" element={<AllFriendsTab />} />
									<Route path="incoming" element={<IncomingFriendsTab />} />
								</Route>
							</Route>
							<Route path="/courses" element={<Courses />}>
								<Route index element={<CoursesIndexRedirect />} />
								<Route path="me" element={<MyCoursesTab />} />
								<Route path="all" element={<AllCoursesTab />} />
								<Route path="all/:courseId" element={<CourseOverview />} />
							</Route>
							<Route path="/resources" element={<Resources />} />
							<Route path="/play" element={<Play />} />
							<Route path="/play/room/:roomId" element={<MatchRoom />} />
							<Route path="/join/:inviteCode" element={<JoinCircle />} />
							<Route path="/avatar" element={<Avatar />} />
							<Route path="/settings" element={<Settings />} />
							<Route path="/profile/:username" element={<ProfileOverview />} />
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
		</ModalProvider>
	)
}