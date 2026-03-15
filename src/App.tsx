import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/context/AuthContext";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import Onboarding from "@/pages/Onboarding";
import RoadmapPreview from "@/pages/RoadmapPreview";
//import LandingPage from "@/pages/LandingPage";
import PhaseCompletionPage from "@/pages/PhaseCompletionPage";
import CodeExecutorTest from "@/modules/CodeExecutor/test-page";
import Index from "./pages/Index";
import TopicsPage from "./pages/TopicsPage";
import VisualizerPage from "./pages/VisualizerPage";
import AICoachPage from "./pages/AICoachPage";
import ReferralsPage from "./pages/ReferralsPage";
import CertificatesPage from "./pages/CertificatesPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/Pricing";
import ChapterPage from "./pages/ChapterPage";
import ChaptersOverviewPage from "./pages/ChaptersOverviewPage";
import JobsPage from "./pages/JobsPage";
import ResumePage from "./pages/ResumePage";
import LandingPage from "./pages/LandingPage";

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

            {/* Public/Semi-public standalone pages */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<Pricing />} />

            <Route path="/*" element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/dashboard" element={<Index />} />
                    <Route path="/topics" element={<TopicsPage />} />
                    <Route path="/chapters" element={<ChaptersOverviewPage />} />
                    <Route path="/visualizer" element={<VisualizerPage />} />
                    <Route path="/ai-coach" element={<AICoachPage />} />
                    <Route path="/resume" element={<ResumePage />} />
                    <Route path="/referrals" element={<ReferralsPage />} />
                    <Route path="/certificates" element={<CertificatesPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/jobs" element={<JobsPage />} />
                    <Route path="/chapter/:chapterId" element={<ChapterPage />} />
                    <Route path="/phase-complete/:phaseId" element={<PhaseCompletionPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
