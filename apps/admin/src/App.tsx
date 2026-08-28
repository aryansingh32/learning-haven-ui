import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import DashboardLayout from './layouts/DashboardLayout';

// Lazy-load every route page so Vite can split them into separate chunks —
// previously all 30+ admin pages were imported eagerly into one bundle that
// every admin login had to download in full before the dashboard could render.
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Users = lazy(() => import('./pages/Users'));
const UserDetail = lazy(() => import('./pages/UserDetail'));
const SystemHealth = lazy(() => import('./pages/SystemHealth'));
const Permissions = lazy(() => import('./pages/Permissions'));
const Experiments = lazy(() => import('./pages/Experiments'));
const CommunicationCenter = lazy(() => import('./pages/CommunicationCenter'));
const Problems = lazy(() => import('./pages/Problems'));
const ProblemEditor = lazy(() => import('./pages/ProblemEditor'));
const Categories = lazy(() => import('./pages/Categories'));
const Patterns = lazy(() => import('./pages/Patterns'));
const Courses = lazy(() => import('./pages/Courses'));
const Chapters = lazy(() => import('./pages/Chapters'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Feedback = lazy(() => import('./pages/Feedback'));
const Referrals = lazy(() => import('./pages/Referrals'));
const Plans = lazy(() => import('./pages/Plans'));
const Withdrawals = lazy(() => import('./pages/Withdrawals'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const AIConfig = lazy(() => import('./pages/AIConfig'));
const VisualRoadmapBuilder = lazy(() => import('./pages/VisualRoadmapBuilder'));
const Settings = lazy(() => import('./pages/Settings'));
const GamificationSettings = lazy(() => import('./pages/GamificationSettings'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Certificates = lazy(() => import('./pages/Certificates'));
const CMSControl = lazy(() => import('./pages/CMSControl'));
const NetworkMonitoring = lazy(() => import('./pages/NetworkMonitoring'));
const CoursePageCMS = lazy(() => import('./pages/CoursePageCMS'));
const ContentImport = lazy(() => import('./pages/ContentImport'));

const ProgramsPage = lazy(() => import('./pages/apprenticeship/ProgramsPage'));
const ProgramEditorPage = lazy(() => import('./pages/apprenticeship/ProgramEditorPage'));
const ProjectEditorPage = lazy(() => import('./pages/apprenticeship/ProjectEditorPage'));
const OverviewPage = lazy(() => import('./pages/apprenticeship/OverviewPage'));
const SubmissionsPage = lazy(() => import('./pages/apprenticeship/SubmissionsPage'));
const StudentsPage = lazy(() => import('./pages/apprenticeship/StudentsPage'));
const StudentDetailPage = lazy(() => import('./pages/apprenticeship/StudentDetailPage'));
const ApprenticeshipAnalyticsPage = lazy(() => import('./pages/apprenticeship/AnalyticsPage'));
const CouponsPage = lazy(() => import('./pages/apprenticeship/CouponsPage'));
const NotificationsPage = lazy(() => import('./pages/apprenticeship/NotificationsPage'));
const BuildChallengesPage = lazy(() => import('./pages/apprenticeship/BuildChallengesPage'));
const BuildChallengeUsersPage = lazy(() => import('./pages/build-haven/BuildChallengeUsersPage'));
const CommerceCouponsPage = lazy(() => import('./pages/commerce/CouponsPage'));
const RevenuePage = lazy(() => import('./pages/commerce/RevenuePage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

const PublicRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              {/* Overview */}
              <Route path="/" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />

              {/* Content */}
              <Route path="/problems" element={<Problems />} />
              <Route path="/problems/new" element={<ProblemEditor />} />
              <Route path="/problems/:id" element={<ProblemEditor />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/patterns" element={<Patterns />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/roadmap-builder" element={<VisualRoadmapBuilder />} />
              <Route path="/catalog-builder" element={<CoursePageCMS />} />
              <Route path="/chapters" element={<Chapters />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/content-import" element={<ContentImport />} />

              {/* Apps */}
              <Route path="/apprenticeship" element={<OverviewPage />} />
              <Route path="/apprenticeship/programs" element={<ProgramsPage />} />
              <Route path="/apprenticeship/programs/new" element={<ProgramEditorPage />} />
              <Route path="/apprenticeship/programs/:id/edit" element={<ProgramEditorPage />} />
              <Route path="/apprenticeship/programs/:id/projects/new" element={<ProjectEditorPage />} />
              <Route path="/apprenticeship/programs/:id/projects/:projectId/edit" element={<ProjectEditorPage />} />
              <Route path="/apprenticeship/submissions" element={<SubmissionsPage />} />
              <Route path="/apprenticeship/students" element={<StudentsPage />} />
              <Route path="/apprenticeship/students/:userId" element={<StudentDetailPage />} />
              <Route path="/apprenticeship/analytics" element={<ApprenticeshipAnalyticsPage />} />
              <Route path="/apprenticeship/coupons" element={<CouponsPage />} />
              <Route path="/apprenticeship/notifications" element={<NotificationsPage />} />
              <Route path="/build-challenges" element={<BuildChallengesPage />} />
              <Route path="/build-challenges/users" element={<BuildChallengeUsersPage />} />

              {/* People */}
              <Route path="/users" element={<Users />} />
              <Route path="/users/:id" element={<UserDetail />} />
              <Route path="/permissions" element={<Permissions />} />
              <Route path="/communications" element={<CommunicationCenter />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/certificates" element={<Certificates />} />

              {/* Finance */}
              <Route path="/plans" element={<Plans />} />
              <Route path="/coupons" element={<CommerceCouponsPage />} />
              <Route path="/revenue" element={<RevenuePage />} />
              <Route path="/withdrawals" element={<Withdrawals />} />

              {/* System */}
              <Route path="/system-health" element={<SystemHealth />} />
              <Route path="/experiments" element={<Experiments />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/gamification" element={<GamificationSettings />} />
              <Route path="/ai-config" element={<AIConfig />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/logs" element={<AuditLogs />} />
              <Route path="/cms" element={<CMSControl />} />
              <Route path="/network" element={<NetworkMonitoring />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </Router>
  );
}

export default App;
