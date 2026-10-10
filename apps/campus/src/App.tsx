import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { studentAppUrl, forgeAdminUrl } from '@/api/client';
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
const Content = lazy(() => import('@/pages/content/Content'));
const CourseEditor = lazy(() => import('@/pages/content/CourseEditor'));
const ProblemEditor = lazy(() => import('@/pages/content/ProblemEditor'));

function Home() {
  const { staffOrgs, me, signOut } = useCampus();
  if (staffOrgs.length > 0) return <Navigate to={`/o/${staffOrgs[0].orgId}/overview`} replace />;
  const isStudent = me?.memberships.some((m) => m.role === 'student');
  const closed = me?.unavailableColleges?.find((c) => c.role !== 'student');
  // Forge staff manage colleges from Forge's admin panel; the Campus portal is only each college's own workspace.
  const title = closed ? `${closed.orgName} is ${closed.status}`
    : me?.isPlatformAdmin ? 'Colleges are managed in the Forge admin panel'
    : isStudent ? 'Campus is for college staff' : 'You are not on a college staff list yet';
  const body = closed ? (closed.status === 'suspended' ? 'Forge has paused this college. Contact Forge to restore access; nothing has been deleted.' : 'This college has been archived by Forge.')
    : me?.isPlatformAdmin ? 'The Campus portal is each college\'s own workspace. Create colleges, change seats, suspend or reactivate them, and grant course licences from the Colleges section of the Forge admin panel.'
    : isStudent ? 'Your tests and results are in the Forge app.'
    : 'Ask your college admin to add your email to the staff roster, then sign in again.';
  return (
    <main className="mx-auto max-w-lg px-4 py-24">
      <EmptyState
        title={title}
        action={
          <div className="flex justify-center gap-2">
            {me?.isPlatformAdmin && !closed && <Button asChild><a href={`${forgeAdminUrl}/colleges`}>Open Forge admin</a></Button>}
            {isStudent && <Button asChild><a href={studentAppUrl}>Go to my tests</a></Button>}
            <Button variant="outline" onClick={signOut}>Sign out</Button>
          </div>
        }
      >
        {body}
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
  const { session, loadingMe } = useCampus();
  if (!session) return <Login />;
  if (loadingMe) return <Loading label="Loading your colleges…" />;

  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
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
            <Route path="content" element={<Content />} />
            <Route path="content/courses/:courseId" element={<CourseEditor />} />
            <Route path="content/problems/:problemId" element={<ProblemEditor />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
