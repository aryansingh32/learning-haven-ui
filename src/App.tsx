import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";

function RedirectApprenticeshipSlug() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/jobs/apprenticeships/${slug || ''}`} replace />;
}

function RedirectBuildSlug() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/projects/${slug || ''}`} replace />;
}

function RedirectBuildWorkspaceSlug() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/projects/${slug || ''}/workspace`} replace />;
}
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/context/AuthContext";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import Onboarding from "@/pages/Onboarding";
import RoadmapPreview from "@/pages/RoadmapPreview";
import PhaseCompletionPage from "@/pages/PhaseCompletionPage";
import CodeExecutorTest from "@/modules/CodeExecutor/test-page";
import Index from "./pages/Index";
import TopicsPage from "./pages/TopicsPage";
import AICoachPage from "./pages/AICoachPage";
import ReferralsPage from "./pages/ReferralsPage";
import CertificatesPage from "./pages/CertificatesPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/Pricing";
import LearnChapterPage from "./pages/LearnChapterPage";
import ChaptersOverviewPage from "./pages/ChaptersOverviewPage";
import JobsPage from "./pages/JobsPage";
import ResumePage from "./pages/ResumePage";
import LandingPage from "./pages/LandingPage";
import ApprenticeshipProgramPage from "./pages/ApprenticeshipProgramPage";
import ApprenticeshipDashboardPage from "./pages/ApprenticeshipDashboardPage";
import ApprenticeshipEnrollmentPage from "./pages/ApprenticeshipEnrollmentPage";
import WorkspacePage from "./pages/WorkspacePage";
import ApprenticeshipCertificatePage from "./pages/ApprenticeshipCertificatePage";
import ProjectsPage from "./pages/ProjectsPage";
import BuildChallengePage from "./pages/BuildChallengePage";
import BuildWorkspacePage from "./pages/BuildWorkspacePage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/test-editor" element={<CodeExecutorTest />} />

            <Route element={<AuthLayout />}>
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/roadmap-preview" element={<RoadmapPreview />} />
            </Route>

            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/certificates/:code" element={<ApprenticeshipCertificatePage />} />

            {/* Legacy redirects */}
            <Route path="/apprenticeships" element={<Navigate to="/jobs?tab=apprenticeships" replace />} />
            <Route path="/apprenticeships/:slug" element={<RedirectApprenticeshipSlug />} />
            <Route path="/build" element={<Navigate to="/projects" replace />} />
            <Route path="/build/:slug" element={<RedirectBuildSlug />} />

            {/* Full-screen build workspace (CodeCrafters-style) */}
            <Route
              path="/projects/:slug/workspace"
              element={
                <ProtectedRoute>
                  <BuildWorkspacePage />
                </ProtectedRoute>
              }
            />
            <Route path="/build/:slug/workspace" element={<RedirectBuildWorkspaceSlug />} />

            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/dashboard" element={<Index />} />
                      <Route path="/topics" element={<TopicsPage />} />
                      <Route path="/chapters" element={<ChaptersOverviewPage />} />
                      <Route path="/chapter/:chapterId" element={<LearnChapterPage />} />
                      <Route path="/projects" element={<ProjectsPage />} />
                      <Route path="/projects/:slug" element={<BuildChallengePage />} />
                      <Route path="/jobs" element={<JobsPage />} />
                      <Route path="/jobs/apprenticeships/:slug" element={<ApprenticeshipProgramPage />} />
                      <Route path="/apprenticeship/dashboard" element={<ApprenticeshipDashboardPage />} />
                      <Route path="/apprenticeship/enrollments/:enrollmentId" element={<ApprenticeshipEnrollmentPage />} />
                      <Route path="/apprenticeship/projects/:projectId" element={<WorkspacePage />} />
                      <Route path="/ai-coach" element={<AICoachPage />} />
                      <Route path="/resume" element={<ResumePage />} />
                      <Route path="/referrals" element={<ReferralsPage />} />
                      <Route path="/certificates" element={<CertificatesPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/phase-complete/:phaseId" element={<PhaseCompletionPage />} />
                      <Route path="/visualizer" element={<Navigate to="/chapters" replace />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
