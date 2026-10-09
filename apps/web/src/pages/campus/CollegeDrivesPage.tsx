import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Briefcase, CalendarClock, CheckCircle2, Loader2, MapPin, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCampusMe } from '@/hooks/useCampus';
import { applyToDrive, fetchMyDrives, withdrawFromDrive, type DriveStatus, type MyDrive } from '@/services/campus.service';
import { formatWhen, timeUntil } from '@/features/campus/assignmentStatus';

const STATUS: Record<DriveStatus, { label: string; tone: string }> = {
  registered: { label: 'Applied', tone: 'bg-primary/10 text-primary border-primary/20' },
  shortlisted: { label: 'Shortlisted', tone: 'bg-reward/10 text-reward border-reward/30' },
  selected: { label: 'Selected', tone: 'bg-success/10 text-success border-success/30' },
  rejected: { label: 'Not taken forward', tone: 'bg-secondary text-muted-foreground border-border/60' },
  withdrawn: { label: 'Withdrawn', tone: 'bg-secondary text-muted-foreground border-border/60' },
};
const JOB: Record<MyDrive['jobType'], string> = { full_time: 'Full time', internship: 'Internship', internship_ppo: 'Internship + PPO' };

function DriveCard({ d }: { d: MyDrive }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: (apply: boolean) => (apply ? applyToDrive(d.id) : withdrawFromDrive(d.id)),
    onSuccess: (_r, apply) => { toast.success(apply ? `Applied to ${d.company}` : 'Application withdrawn'); qc.invalidateQueries({ queryKey: ['my-drives'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const s = d.myStatus ? STATUS[d.myStatus] : null;
  return (
    <article className="card-glass rounded-2xl border border-border/40 p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{JOB[d.jobType]}</p>
          <h2 className="font-display text-xl font-bold text-foreground">{d.company}</h2>
          <p className="text-sm text-foreground">{d.roleTitle}</p>
        </div>
        {s && <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', s.tone)}>{s.label}</span>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {d.ctc && <span className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> {d.ctc}</span>}
        {d.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {d.location}</span>}
        {d.applyBy && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />
          {d.status === 'open' && new Date(d.applyBy) > new Date() ? `Apply within ${timeUntil(d.applyBy)}` : `Applications closed ${formatWhen(d.applyBy)}`}</span>}
      </div>
      {d.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground line-clamp-6">{d.description}</p>}
      {d.rounds.length > 0 && (
        <ol className="space-y-1 text-sm">
          {d.rounds.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-1.5">
              <span className="text-foreground">{i + 1}. {r.name}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {r.scheduledAt ? formatWhen(r.scheduledAt) : 'Date to be announced'}
                {r.assignmentId && (d.myStatus === 'registered' || d.myStatus === 'shortlisted') && (
                  <Button size="sm" variant="outline" className="h-7" onClick={() => navigate(`/college/tests/${r.assignmentId}`)}>Open test</Button>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex gap-2">
        {d.canApply && (!d.myStatus || d.myStatus === 'withdrawn') && (
          <Button onClick={() => act.mutate(true)} disabled={act.isPending}>{act.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Apply</Button>
        )}
        {d.myStatus === 'registered' && d.canApply && (
          <Button variant="outline" onClick={() => act.mutate(false)} disabled={act.isPending}>Withdraw</Button>
        )}
        {d.myStatus === 'selected' && <p className="flex items-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Congratulations! Your placement cell will contact you.</p>}
      </div>
    </article>
  );
}

/** Placement drives the student is eligible for. */
export default function CollegeDrivesPage() {
  const navigate = useNavigate();
  const { isStudent } = useCampusMe();
  const drives = useQuery({ queryKey: ['my-drives'], queryFn: fetchMyDrives, enabled: isStudent });
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate('/college')}><ArrowLeft className="mr-2 h-4 w-4" /> My College</Button>
      <div>
        <h1 className="flex items-center gap-2 font-display text-page-title font-bold text-foreground"><Briefcase className="h-6 w-6 text-primary" /> Placement drives</h1>
        <p className="text-sm text-muted-foreground">Companies visiting your college that you're eligible for.</p>
      </div>
      {drives.isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        : (drives.data ?? []).length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No drives for you right now. You'll get a notification when one opens.</p>
        : drives.data!.map((d) => <DriveCard key={d.id} d={d} />)}
    </div>
  );
}
