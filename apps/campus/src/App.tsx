import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { studentAppUrl } from '@/api/client';
import { EmptyState, Loading } from '@/components/common';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useCampus, useOrg } from '@/context/CampusContext';
import Login from '@/pages/Login';

const Overview = lazy(() => import('@/pages/Overview'));
const People = lazy(() => import('@/pages/People'));
const Batches = lazy(() => import('@/pages/Batches'));
const Tests = lazy(() => import('@/pages/Tests'));
const TestEditor = lazy(() => import('@/pages/TestEditor'));
const Assignments = lazy(() => import('@/pages/Assignments'));
const AssignmentResults = lazy(() => import('@/pages/AssignmentResults'));
const LiveBoard = lazy(() => import('@/pages/LiveBoard'));
const Marking = lazy(() => import('@/pages/Marking'));
const Analysis = lazy(() => import('@/pages/Analysis'));
const Insights = lazy(() => import('@/pages/Insights'));
const Activity = lazy(() => import('@/pages/Activity'));
const Placements = lazy(() => import('@/pages/Placements'));
const StudentReport = lazy(() => import('@/pages/StudentReport'));
const Courses = lazy(() => import('@/pages/Courses'));
const CourseProgress = lazy(() => import('@/pages/CourseProgress'));
const Settings = lazy(() => import('@/pages/Settings'));
const Platform = lazy(() => import('@/pages/Platform'));

function Home() {
  const { staffOrgs, me, signOut } = useCampus();
  if (staffOrgs.length > 0) return <Navigate to={`/o/${staffOrgs[0].orgId}/overview`} replace />;
  if (me?.isPlatformAdmin) return <Navigate to="/platform" replace />;
  const isStudent = me?.memberships.some((m) => m.role === 'student');
  return (
    <main className="mx-auto max-w-lg px-4 py-24">
      <EmptyState
        title={isStudent ? 'Campus is for college staff' : 'You are not on a college staff list yet'}
        action={
          <div className="flex justify-center gap-2">
            {isStudent && <Button asChild><a href={studentAppUrl}>Go to my tests</a></Button>}
            <Button variant="outline" onClick={signOut}>Sign out</Button>
          </div>
        }
      >
        {isStudent
          ? 'Your tests and results are in the Forge app.'
          : 'Ask your college admin to add your email to the staff roster, then sign in again.'}
      </EmptyState>
    </main>
  );
}

/** Keep people out of colleges they don't belong to, even by typing a URL. */
function OrgGate() {
  const { orgId } = useParams();
  const { membership } = useOrg(orgId);
  if (!membership) return <Navigate to="/" replace />;
  return <Layout />;
}

export default function App() {
  const { session, loadingMe, me } = useCampus();
  if (!session) return <Login />;
  if (loadingMe) return <Loading label="Loading your colleges…" />;

  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/platform" element={me?.isPlatformAdmin ? <Platform /> : <Navigate to="/" replace />} />
          <Route path="/o/:orgId" element={<OrgGate />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<Overview />} />
            <Route path="people" element={<People />} />
            <Route path="batches" element={<Batches />} />
            <Route path="tests" element={<Tests />} />
            <Route path="tests/:testId" element={<TestEditor />} />
            <Route path="assignments" element={<Assignments />} />
            <Route path="assignments/:assignmentId" element={<AssignmentResults />} />
            <Route path="assignments/:assignmentId/live" element={<LiveBoard />} />
            <Route path="assignments/:assignmentId/marking" element={<Marking />} />
            <Route path="assignments/:assignmentId/analysis" element={<Analysis />} />
            <Route path="insights" element={<Insights />} />
            <Route path="activity" element={<Activity />} />
            <Route path="placements" element={<Placements />} />
            <Route path="placements/:driveId" element={<Placements />} />
            <Route path="insights/students/:studentId" element={<StudentReport />} />
            <Route path="courses" element={<Courses />} />
            <Route path="courses/:assignmentId" element={<CourseProgress />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
