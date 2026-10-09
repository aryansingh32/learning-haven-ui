import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, GraduationCap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCampusMe, useMyCourseAssignments } from '@/hooks/useCampus';
import type { CourseAssignmentStatus, MyCourseAssignment } from '@/services/campus.service';
import { formatWhen, timeUntil } from './assignmentStatus';

// Courses a college gives a batch (slice D6). The course itself is the normal
// Learn course; these pieces only show that it was assigned, by when, and how
// far the student has got with the assigned chapters.

const STATUS: Record<CourseAssignmentStatus, { label: string; tone: string }> = {
  not_started: { label: 'Not started', tone: 'bg-secondary text-muted-foreground border-border/60' },
  in_progress: { label: 'In progress', tone: 'bg-primary/10 text-primary border-primary/20' },
  completed: { label: 'Completed', tone: 'bg-success/10 text-success border-success/30' },
  overdue: { label: 'Overdue', tone: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' },
};

const courseLink = (a: MyCourseAssignment) => `/course/${a.courseId}/chapters`;

function dueText(a: MyCourseAssignment) {
  if (!a.dueAt) return 'No due date';
  if (a.status === 'completed') return `Was due ${formatWhen(a.dueAt)}`;
  return new Date(a.dueAt).getTime() > Date.now() ? `Due in ${timeUntil(a.dueAt)}` : `Was due ${formatWhen(a.dueAt)}`;
}

/** Open first, soonest due first, finished last. */
function sortCourses(list: MyCourseAssignment[]) {
  const rank = (a: MyCourseAssignment) => (a.status === 'completed' ? 2 : a.status === 'overdue' ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b)
    || (a.dueAt ? +new Date(a.dueAt) : Infinity) - (b.dueAt ? +new Date(b.dueAt) : Infinity));
}

function ProgressBar({ percent, done }: { percent: number; done?: boolean }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full', done ? 'bg-success' : 'bg-primary')} style={{ width: `${percent}%` }} />
    </div>
  );
}

function CourseCard({ a, index }: { a: MyCourseAssignment; index: number }) {
  const navigate = useNavigate();
  const s = STATUS[a.status];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/40 hover:bg-primary/5 transition-all"
    >
      <div className={cn('w-11 h-11 rounded-xl items-center justify-center shrink-0 hidden sm:flex',
        a.status === 'completed' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary')}>
        {a.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-foreground">{a.title}</h3>
          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', s.tone)}>{s.label}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {a.wholeCourse ? 'Whole course' : `Chapters ${a.chapters.map((c) => c.number).join(', ')}`}
          {a.courseTitle && a.courseTitle !== a.title ? ` of ${a.courseTitle}` : ''} · {a.batchName} ·{' '}
          <span className={cn(a.status === 'overdue' && 'text-red-600 dark:text-red-400 font-semibold')}>{dueText(a)}</span>
        </p>
        <div className="flex items-center gap-3 max-w-sm">
          <ProgressBar percent={a.percent} done={a.status === 'completed'} />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">{a.completedChapters}/{a.totalChapters} chapters</span>
        </div>
        {a.instructions && <p className="text-xs text-muted-foreground line-clamp-2">{a.instructions}</p>}
      </div>
      <Button size="sm" variant={a.status === 'completed' ? 'outline' : 'default'} onClick={() => navigate(courseLink(a))} className="shrink-0">
        {a.status === 'completed' ? 'Review' : a.status === 'not_started' ? 'Start' : 'Continue'} <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    </motion.div>
  );
}

/** "Courses" section on My College. Hidden when nothing is assigned. */
export function CollegeCoursesSection() {
  const { isStudent } = useCampusMe();
  const courses = useMyCourseAssignments(isStudent);
  if (!isStudent || (courses.data && courses.data.length === 0) || courses.isError) return null;
  return (
    <section className="card-glass rounded-2xl p-5 sm:p-6 border border-border/40" aria-labelledby="college-courses">
      <h2 id="college-courses" className="text-xl font-display font-extrabold text-foreground flex items-center gap-2 mb-5">
        <BookOpen className="w-5 h-5 text-primary" /> Courses
      </h2>
      {courses.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {sortCourses(courses.data!).map((a, i) => <CourseCard key={a.id} a={a} index={i} />)}
        </div>
      )}
    </section>
  );
}

/** On a course page: which college assigned it, by when, and which chapters. */
export function AssignedCourseBanner({ courseId }: { courseId?: string }) {
  const { isStudent } = useCampusMe();
  const courses = useMyCourseAssignments(isStudent);
  if (!isStudent || !courseId) return null;
  const mine = sortCourses((courses.data ?? []).filter((a) => a.courseId === courseId || a.courseSlug === courseId));
  if (mine.length === 0) return null;
  return (
    <div className="space-y-2">
      {mine.map((a) => (
        <div key={a.id} className={cn('rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3',
          a.status === 'overdue' ? 'border-red-500/30 bg-red-500/5' : 'border-primary/20 bg-primary/5')}>
          <GraduationCap className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-bold text-foreground">
              Assigned by {a.orgName} · <span className={cn(a.status === 'overdue' && 'text-red-600 dark:text-red-400')}>{dueText(a)}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {a.wholeCourse ? 'The whole course' : `Chapters: ${a.chapters.map((c) => `${c.number}. ${c.title}${c.done ? ' ✓' : ''}`).join(' · ')}`}
              {a.instructions ? ` — ${a.instructions}` : ''}
            </p>
          </div>
          <div className="w-full sm:w-40 space-y-1">
            <ProgressBar percent={a.percent} done={a.status === 'completed'} />
            <p className="text-[11px] text-muted-foreground text-right">{a.completedChapters}/{a.totalChapters} assigned chapters done</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** One line per due course for the dashboard's college card. */
export function DueCourses({ limit = 2 }: { limit?: number }) {
  const navigate = useNavigate();
  const { isStudent } = useCampusMe();
  const courses = useMyCourseAssignments(isStudent);
  const due = sortCourses((courses.data ?? []).filter((a) => a.status !== 'completed')).slice(0, limit);
  if (due.length === 0) return null;
  return (
    <div className="space-y-2 mt-2">
      {due.map((a) => (
        <button key={a.id} onClick={() => navigate(courseLink(a))}
          className="w-full flex items-center gap-3 p-3 rounded-xl text-left border border-border/40 bg-background/60 hover:border-primary/40 transition-colors">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
            {a.dueAt ? <CalendarClock className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{a.title}</p>
            <p className={cn('text-[11px] text-muted-foreground', a.status === 'overdue' && 'text-red-600 dark:text-red-400')}>
              Course · {a.completedChapters}/{a.totalChapters} chapters · {dueText(a)}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
