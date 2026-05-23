import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Users from './pages/Users';
import Problems from './pages/Problems';
import ProblemEditor from './pages/ProblemEditor';
import Categories from './pages/Categories';
import Patterns from './pages/Patterns';
import Roadmaps from './pages/Roadmaps';
import Chapters from './pages/Chapters';
import Tasks from './pages/Tasks';
import Feedback from './pages/Feedback';
import Referrals from './pages/Referrals';
import Plans from './pages/Plans';
import Withdrawals from './pages/Withdrawals';
import Leaderboard from './pages/Leaderboard';
import AIConfig from './pages/AIConfig';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import DashboardLayout from './layouts/DashboardLayout';

import ProgramsPage from './pages/apprenticeship/ProgramsPage';
import ProgramEditorPage from './pages/apprenticeship/ProgramEditorPage';
import ProjectEditorPage from './pages/apprenticeship/ProjectEditorPage';
import OverviewPage from './pages/apprenticeship/OverviewPage';
import SubmissionsPage from './pages/apprenticeship/SubmissionsPage';
import StudentsPage from './pages/apprenticeship/StudentsPage';
import StudentDetailPage from './pages/apprenticeship/StudentDetailPage';
import ApprenticeshipAnalyticsPage from './pages/apprenticeship/AnalyticsPage';
import CouponsPage from './pages/apprenticeship/CouponsPage';
import NotificationsPage from './pages/apprenticeship/NotificationsPage';
import BuildChallengesPage from './pages/apprenticeship/BuildChallengesPage';
import BuildChallengeUsersPage from './pages/build-haven/BuildChallengeUsersPage';

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
              <Route path="/roadmaps" element={<Roadmaps />} />
              <Route path="/chapters" element={<Chapters />} />
              <Route path="/tasks" element={<Tasks />} />

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
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/referrals" element={<Referrals />} />

              {/* Finance */}
              <Route path="/plans" element={<Plans />} />
              <Route path="/withdrawals" element={<Withdrawals />} />

              {/* System */}
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/ai-config" element={<AIConfig />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/logs" element={<AuditLogs />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </Router>
  );
}

export default App;
