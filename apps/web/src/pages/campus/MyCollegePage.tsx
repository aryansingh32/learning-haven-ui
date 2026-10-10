import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GraduationCap, ClipboardCheck, CalendarClock, CheckCircle2, Target, Clock, ShieldCheck,
  ArrowRight, RotateCw, Hourglass, Trophy, Mail, Loader2, AlertTriangle, Users, CircleSlash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useCampusMe, useMyAssignments } from '@/hooks/useCampus';
import type { CampusMembership, MyAssignment } from '@/services/campus.service';
import {
  assignmentStatus, formatWhen, sortTodo, timeUntil, type AssignmentBucket, type AssignmentStatus,
} from '@/features/campus/assignmentStatus';
import { CollegeCoursesSection } from '@/features/campus/CollegeCourses';
import { DrivesTeaser } from '@/features/campus/DrivesTeaser';

const TONE: Record<AssignmentStatus['tone'], string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  warning: 'bg-reward/10 text-reward border-reward/30',
  success: 'bg-success/10 text-success border-success/30',
  muted: 'bg-secondary text-muted-foreground border-border/60',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
};

function StatTile({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-glass rounded-2xl p-4 flex items-center gap-4 border border-border/40"
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-meta text-muted-foreground font-semibold uppercase tracking-wider truncate">{label}</p>
        <p className="text-section-title font-display font-bold text-foreground">{value}</p>
      </div>
    </motion.div>
  );
}

function CollegeBadge({ college }: { college: CampusMembership }) {
  const initials = college.orgName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return college.logoUrl ? (
    <img src={college.logoUrl} alt="" className="w-14 h-14 rounded-2xl object-contain bg-background border border-border/50 p-1.5 shrink-0" />
  ) : (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-display font-bold text-lg shrink-0 shadow-md"
      style={{ background: college.brandColor || 'hsl(var(--primary))' }}
    >
      {initials || <GraduationCap className="w-6 h-6" />}
    </div>
  );
}

function ActionButton({ a, status, size = 'sm' }: { a: MyAssignment; status: AssignmentStatus; size?: 'sm' | 'default' | 'lg' }) {
  const navigate = useNavigate();
  const go = () => navigate(`/college/tests/${a.id}`);
  switch (status.action.kind) {
    case 'resume':
      return <Button size={size} onClick={go} className="btn-reward border-0">Resume <ArrowRight className="ml-1.5 h-4 w-4" /></Button>;
    case 'start':
      return (
        <Button size={size} onClick={go}>
          {status.action.attemptNumber > 1 ? <><RotateCw className="mr-1.5 h-4 w-4" /> Retake</> : <>Start test <ArrowRight className="ml-1.5 h-4 w-4" /></>}
        </Button>
      );
    case 'result': {
      const attemptId = status.action.attemptId;
      return <Button size={size} variant="outline" onClick={() => navigate(`/college/attempts/${attemptId}`)}>View result</Button>;
    }
    case 'wait':
      return <Button size={size} variant="outline" disabled><Hourglass className="mr-1.5 h-4 w-4" /> Opens in {timeUntil(status.action.opensAt)}</Button>;
    default:
      return null;
  }
}

function AssignmentCard({ a, index }: { a: MyAssignment; index: number }) {
  const status = assignmentStatus(a);
  const closingSoon = a.state === 'open' && new Date(a.closesAt).getTime() - Date.now() < 24 * 3600 * 1000;
  const missed = status.action.kind === 'missed';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/40 hover:bg-primary/5 transition-all"
    >
      <div className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 hidden sm:flex',
        missed ? 'bg-red-500/10 text-red-600 dark:text-red-400'
          : status.bucket === 'past' ? 'bg-success/10 text-success'
          : status.bucket === 'upcoming' ? 'bg-secondary text-muted-foreground' : 'bg-primary/10 text-primary',
      )}>
        {missed ? <CircleSlash className="w-5 h-5" />
          : status.bucket === 'past' ? <CheckCircle2 className="w-5 h-5" />
          : status.bucket === 'upcoming' ? <CalendarClock className="w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-foreground">{a.title}</h3>
          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', TONE[status.tone])}>{status.label}</span>
          {a.proctoring?.enabled && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-secondary/60 text-muted-foreground border-border/60 inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Proctored
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {a.batch}</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {a.durationMinutes} min</span>
          {a.state === 'upcoming' && <span>Opens {formatWhen(a.opensAt)}</span>}
          {a.state === 'open' && (
            <span className={cn(closingSoon && 'text-red-600 dark:text-red-400 font-semibold')}>Closes in {timeUntil(a.closesAt)}</span>
          )}
          {a.state === 'closed' && <span>Closed {formatWhen(a.closesAt)}</span>}
          {a.maxAttempts > 1 && <span>Attempts {a.attemptsUsed}/{a.maxAttempts}</span>}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:justify-end shrink-0">
        {status.percent !== null && (
          <div className="text-right">
            <p className="text-lg font-display font-bold text-foreground leading-none">{status.percent}%</p>
            <p className="text-[10px] text-muted-foreground mt-1">{a.bestScore} / {a.totalMarks}</p>
          </div>
        )}
        <ActionButton a={a} status={status} />
      </div>
    </motion.div>
  );
}

function NextUpCard({ a }: { a: MyAssignment }) {
  const status = assignmentStatus(a);
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-glass rounded-2xl p-5 sm:p-6 border border-primary/20 bg-primary/5"
    >
      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
        {status.action.kind === 'resume' ? 'Pick up where you left off' : 'Do this next'}
      </p>
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div className="w-12 h-12 rounded-xl gradient-golden flex items-center justify-center text-primary-foreground shadow-md shrink-0">
          <Target className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-display font-bold text-foreground">{a.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {a.durationMinutes} minutes · closes in <span className="font-semibold text-foreground">{timeUntil(a.closesAt)}</span>
            {a.proctoring?.enabled ? ' · proctored, full screen' : ''}
          </p>
          {a.instructions && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{a.instructions}</p>}
        </div>
        <ActionButton a={a} status={status} size="lg" />
      </div>
    </motion.section>
  );
}

function NotEnrolled({ email, onRecheck, checking }: { email?: string; onRecheck: () => void; checking: boolean }) {
  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div className="card-glass rounded-2xl p-6 sm:p-8 border border-border/40 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <GraduationCap className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">Your college isn't connected yet</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          When your college uses Forge Campus, your training and placement team adds you with your email.
          Your tests then show up here automatically.
        </p>
        {email && (
          <div className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-xl bg-secondary/60 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" /> Signed in as <span className="font-semibold text-foreground">{email}</span>
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-3 mt-6 text-left">
          {[
            ['1', 'Share this email', 'Give it to your TPO or faculty if they ask.'],
            ['2', 'They add you', 'Your college uploads its student list.'],
            ['3', 'Tests appear', 'Check back here, or press the button below.'],
          ].map(([n, title, sub]) => (
            <div key={n} className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-background/50">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{n}</div>
              <div>
                <p className="text-sm font-bold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>
        <Button className="mt-6" variant="outline" onClick={onRecheck} disabled={checking}>
          {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />} Check again
        </Button>
      </div>
    </div>
  );
}

const TABS: Array<{ key: AssignmentBucket; label: string }> = [
  { key: 'todo', label: 'To do' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

const EMPTY: Record<AssignmentBucket, string> = {
  todo: "You're all caught up. New tests from your faculty will appear here.",
  upcoming: 'Nothing scheduled yet.',
  past: 'Tests you finish or miss will be listed here with your results.',
};

export default function MyCollegePage() {
  const { user } = useAuth();
  const me = useCampusMe();
  const assignments = useMyAssignments(me.isStudent);
  const [tab, setTab] = useState<AssignmentBucket>('todo');

  const grouped = useMemo(() => {
    const out: Record<AssignmentBucket, MyAssignment[]> = { todo: [], upcoming: [], past: [] };
    for (const a of assignments.data ?? []) out[assignmentStatus(a).bucket].push(a);
    out.todo = sortTodo(out.todo);
    out.upcoming.sort((a, b) => new Date(a.opensAt).getTime() - new Date(b.opensAt).getTime());
    out.past.sort((a, b) => new Date(b.closesAt).getTime() - new Date(a.closesAt).getTime());
    return out;
  }, [assignments.data]);

  if (me.isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (me.isError) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 mx-auto text-reward" />
        <p className="text-foreground font-semibold">College services are unavailable right now.</p>
        <p className="text-sm text-muted-foreground">Your Forge learning is unaffected. Please try again in a few minutes.</p>
        <Button variant="outline" onClick={() => me.refetch()}>Try again</Button>
      </div>
    );
  }

  const paused = me.data?.unavailableColleges?.find((c) => c.role === 'student');
  if (!me.isStudent && paused) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="card-glass rounded-2xl p-6 sm:p-8 border border-border/40 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">{paused.orgName} is paused</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Your college's tests and courses aren't available right now. Nothing is lost: your results come back when
            the college is restored. Ask your training and placement office if you need them sooner.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => me.refetch()} disabled={me.isFetching}>Check again</Button>
        </div>
      </div>
    );
  }

  if (!me.isStudent) {
    return <NotEnrolled email={user?.email} onRecheck={() => me.refetch()} checking={me.isFetching} />;
  }

  const college = me.colleges[0];
  const graded = (assignments.data ?? []).map((a) => assignmentStatus(a).percent).filter((p): p is number => p !== null);
  const avg = graded.length ? `${Math.round(graded.reduce((s, p) => s + p, 0) / graded.length)}%` : '—';
  const completed = (assignments.data ?? []).filter((a) => a.attemptsUsed > 0 && a.latestStatus === 'completed').length;
  const nextUp = grouped.todo[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* College header */}
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <CollegeBadge college={college} />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">My College</p>
          <h1 className="text-page-title font-display font-bold text-foreground truncate">{college.orgName}</h1>
          <p className="text-sm text-muted-foreground">
            {college.rollNumber ? <>Roll no. <span className="font-semibold text-foreground">{college.rollNumber}</span></> : 'Student'}
            {me.colleges.length > 1 && ` · also at ${me.colleges.slice(1).map((c) => c.orgName).join(', ')}`}
          </p>
        </div>
      </motion.header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile icon={ClipboardCheck} label="To do" value={grouped.todo.length} color="bg-primary/10 text-primary" />
        <StatTile icon={CalendarClock} label="Upcoming" value={grouped.upcoming.length} color="bg-secondary text-muted-foreground" />
        <StatTile icon={CheckCircle2} label="Completed" value={completed} color="bg-success/10 text-success" />
        <StatTile icon={Trophy} label="Average score" value={avg} color="bg-reward/10 text-reward" />
      </div>

      {nextUp && <NextUpCard a={nextUp} />}

      <DrivesTeaser />

      <section className="card-glass rounded-2xl p-5 sm:p-6 border border-border/40">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-xl font-display font-extrabold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" /> Tests & assignments
          </h2>
          <div role="tablist" className="inline-flex p-1 rounded-xl bg-secondary/60">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                <span className="ml-1.5 text-[10px] text-muted-foreground">{grouped[t.key].length}</span>
              </button>
            ))}
          </div>
        </div>

        {assignments.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : assignments.isError ? (
          <div className="text-center py-10 space-y-3">
            <p className="text-sm text-muted-foreground">{assignments.error?.message || 'Could not load your tests.'}</p>
            <Button size="sm" variant="outline" onClick={() => assignments.refetch()}>Try again</Button>
          </div>
        ) : grouped[tab].length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">{EMPTY[tab]}</p>
        ) : (
          <div className="space-y-3">
            {grouped[tab].map((a, i) => <AssignmentCard key={a.id} a={a} index={i} />)}
          </div>
        )}
      </section>

      <CollegeCoursesSection />
    </div>
  );
}
