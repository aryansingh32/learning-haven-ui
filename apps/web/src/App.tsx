import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { SiteConfigProvider } from "@/context/SiteConfigContext";
import { initErrorTracking } from "@/lib/analytics";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/context/AuthContext";

initErrorTracking();

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

// BH-002: Lazy-load all route-level pages so Vite can split them into separate
// chunks. Previously everything was imported statically, producing a single
// 1.64 MB / 482 KB-gzip bundle that every learner had to download on first load.
const AppLayout = lazy(() => import("@/components/AppLayout").then(m => ({ default: m.AppLayout })));
const AuthLayout = lazy(() => import("@/components/layouts/AuthLayout").then(m => ({ default: m.AuthLayout })));
const SignIn = lazy(() => import("@/pages/auth/SignIn"));
const SignUp = lazy(() => import("@/pages/auth/SignUp"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const CoursePreview = lazy(() => import("@/pages/CoursePreview"));
const CodeExecutorTest = lazy(() => import("@/modules/CodeExecutor/test-page"));
const Index = lazy(() => import("./pages/Index"));
const TopicsPage = lazy(() => import("./pages/TopicsPage"));
const AICoachPage = lazy(() => import("./pages/AICoachPage"));
const ReferralsPage = lazy(() => import("./pages/ReferralsPage"));
const CertificatesPage = lazy(() => import("./pages/CertificatesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Pricing = lazy(() => import("./pages/Pricing"));
const LearnChapterPage = lazy(() => import("./pages/LearnChapterPage"));
const ChaptersOverviewPage = lazy(() => import("./pages/ChaptersOverviewPage"));
const NotebookPage = lazy(() => import("./pages/NotebookPage"));
const CoursesCatalogPage = lazy(() => import("./pages/CoursesCatalogPage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const ResumePage = lazy(() => import("./pages/ResumePage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const ApprenticeshipProgramPage = lazy(() => import("./pages/ApprenticeshipProgramPage"));
const ApprenticeshipDashboardPage = lazy(() => import("./pages/ApprenticeshipDashboardPage"));
const ApprenticeshipEnrollmentPage = lazy(() => import("./pages/ApprenticeshipEnrollmentPage"));
const WorkspacePage = lazy(() => import("./pages/WorkspacePage"));
const ApprenticeshipCertificatePage = lazy(() => import("./pages/ApprenticeshipCertificatePage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const BuildChallengePage = lazy(() => import("./pages/BuildChallengePage"));
const BuildWorkspacePage = lazy(() => import("./pages/BuildWorkspacePage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const PhaseCompletionPage = lazy(() => import("./pages/PhaseCompletionPage"));
const ProtectedRoute = lazy(() => import("@/components/ProtectedRoute").then(m => ({ default: m.ProtectedRoute })));

const queryClient = new QueryClient();

// Minimal full-page loading fallback used while lazy chunks download
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SiteConfigProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          {/* BH-002: Suspense boundary required for all React.lazy() components */}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/test-editor" element={<CodeExecutorTest />} />

              <Route element={<AuthLayout />}>
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/course-preview" element={<CoursePreview />} />
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
                        <Route path="/courses" element={<CoursesCatalogPage />} />
                        <Route path="/course/:courseId/chapters" element={<ChaptersOverviewPage />} />
                        <Route path="/course/:courseId/notebook" element={<NotebookPage />} />
                        <Route path="/chapters" element={<Navigate to="/courses" replace />} />
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
                        <Route path="/subscription" element={<SubscriptionPage />} />
                        <Route path="/phase-complete/:phaseId" element={<PhaseCompletionPage />} />
                        <Route path="/visualizer" element={<Navigate to="/courses" replace />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </AuthProvider>
        </BrowserRouter>
      </SiteConfigProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
