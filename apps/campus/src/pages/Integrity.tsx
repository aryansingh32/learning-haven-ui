import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Camera, Copy, Laptop, MonitorSmartphone, Network, ShieldAlert, Smartphone, Tablet, Timer } from 'lucide-react';
import { api } from '@/api/client';
import { ErrorNote, formatDateTime, Loading, PageHeader, Stat } from '@/components/common';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Student { userId: string; name: string; rollNumber: string | null }
interface IntegrityAttempt extends Student {
  attemptId: string; status: string; startedAt: string;
  device: { id: string | null; os?: string | null; osVersion?: string | null; browser?: string | null; browserVersion?: string | null;
    deviceType?: 'desktop' | 'mobile' | 'tablet' | null; screen?: string | null; screens?: number | null; timezone?: string | null } | null;
  ip: string | null; ips: string[]; otherDevices: number; violations: number; events: Record<string, number>;
  similarAnswers: number; fastFinisher: boolean; snapshots?: number;
}
interface Integrity {
  attempts: IntegrityAttempt[];
  sharedDevices: { device: string; students: Student[] }[];
  sharedIps: { ip: string; students: Student[] }[];
  similarAnswers: { question: string; kind: 'code' | 'text'; score: number; students: Student[] }[];
  fastFinishers: (Student & { minutes: number; scorePercent: number })[];
}

const EVENT_LABEL: Record<string, string> = {
  tab_switch: 'Tab switches', window_blur: 'Left window', fullscreen_exit: 'Left full screen', copy: 'Copy', paste: 'Paste',
  context_menu: 'Right-click', device_change: 'Other device', multiple_screens: 'Second screen', devtools_open: 'Dev tools',
  screenshot_key: 'Screenshot', large_paste: 'Large insert', camera_off: 'Camera off',
};
const SERIOUS = new Set(['device_change', 'devtools_open', 'multiple_screens', 'large_paste', 'camera_off']);
const TypeIcon = ({ t }: { t?: string | null }) => (t === 'mobile' ? <Smartphone className="h-4 w-4" /> : t === 'tablet' ? <Tablet className="h-4 w-4" /> : <Laptop className="h-4 w-4" />);
const deviceLine = (d: IntegrityAttempt['device']) =>
  d ? [[d.browser, d.browserVersion].filter(Boolean).join(' '), [d.os, d.osVersion].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Unknown device' : 'Not recorded';
const who = (s: Student) => `${s.name}${s.rollNumber ? ` (${s.rollNumber})` : ''}`;

interface Snapshot { id: string; takenAt: string; ip: string | null; image: string }

/** The webcam photos of one attempt, in the order they were taken. */
function SnapshotsDialog({ orgId, assignmentId, attempt, onClose }: {
  orgId: string; assignmentId: string; attempt: IntegrityAttempt | null; onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ['snapshots', attempt?.attemptId],
    queryFn: () => api<Snapshot[]>(`/orgs/${orgId}/assignments/${assignmentId}/attempts/${attempt!.attemptId}/snapshots`),
    enabled: Boolean(attempt),
    staleTime: 60_000,
  });
  return (
    <Dialog open={Boolean(attempt)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Webcam photos — {attempt ? who(attempt) : ''}</DialogTitle></DialogHeader>
        {q.isLoading ? <Loading /> : q.error ? <ErrorNote error={q.error} /> : (q.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos yet.</p>
        ) : (
          <ul className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {q.data!.map((s) => (
              <li key={s.id}>
                <img src={s.image} alt={`Photo at ${formatDateTime(s.takenAt)}`} className="aspect-[4/3] w-full rounded-md bg-muted object-cover" loading="lazy" />
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(s.takenAt)}{s.ip ? ` · ${s.ip}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Exam integrity for one test: the device and network each student used, devices
 * or networks shared between students, devices changed mid-test, and flagged events.
 */
export default function Integrity() {
  const { orgId, assignmentId } = useParams();
  const [photosOf, setPhotosOf] = useState<IntegrityAttempt | null>(null);
  const q = useQuery({
    queryKey: ['integrity', assignmentId],
    queryFn: () => api<Integrity>(`/orgs/${orgId}/assignments/${assignmentId}/integrity`),
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const { attempts, sharedDevices, sharedIps, similarAnswers = [], fastFinishers = [] } = q.data!;
  const changed = attempts.filter((a) => a.otherDevices > 0);
  const flagged = attempts.filter((a) => Object.keys(a.events).some((k) => SERIOUS.has(k)));

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Results
      </Link>
      <PageHeader title="Integrity" description="Devices, networks and integrity signals for this test. Each attempt is tied to the device it started on." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Attempts" value={attempts.length} />
        <Stat label="Shared devices" value={sharedDevices.length} tone={sharedDevices.length ? 'warning' : undefined} hint="Same device, different students" />
        <Stat label="Device changed mid-test" value={changed.length} tone={changed.length ? 'warning' : undefined} />
        <Stat label="Similar answers" value={similarAnswers.length} tone={similarAnswers.length ? 'warning' : undefined} hint="Pairs of students, per question" />
        <Stat label="Other signals" value={flagged.length} hint="Second screen, dev tools, large inserts" />
      </div>

      {sharedDevices.length > 0 && (
        <section className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4" aria-label="Shared devices">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-destructive"><ShieldAlert className="h-4 w-4" />One device, several students</h2>
          <p className="mb-2 text-sm text-muted-foreground">The strongest sign of someone taking a test for another student. Check these first.</p>
          <ul className="space-y-1 text-sm">
            {sharedDevices.map((d) => <li key={d.device}><span className="font-mono text-xs">{d.device}…</span> — {d.students.map(who).join(', ')}</li>)}
          </ul>
        </section>
      )}

      {similarAnswers.length > 0 && (
        <section className="mb-6 rounded-lg border border-warning/40 bg-warning/5 p-4" aria-label="Similar answers">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Copy className="h-4 w-4" />Similar answers</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            Pairs whose code or written answer is mostly the same after ignoring names, comments, spacing and the starter code. Read both answers before deciding.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 pr-3 font-medium">Students</th><th className="pr-3 font-medium">Question</th><th className="text-right font-medium">Match</th></tr></thead>
              <tbody>
                {similarAnswers.slice(0, 50).map((p, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="py-1.5 pr-3">{p.students.map(who).join(' & ')}</td>
                    <td className="pr-3 text-muted-foreground">{p.kind === 'code' ? 'Code · ' : 'Written · '}{p.question}</td>
                    <td className="text-right tabular font-medium">{Math.round(p.score * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {fastFinishers.length > 0 && (
        <section className="mb-6 rounded-lg border p-4" aria-label="Unusually fast">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Timer className="h-4 w-4" />Top scores in unusually little time</h2>
          <p className="mb-2 text-sm text-muted-foreground">Finished in about a third of the class's typical time with a top-quarter score. Often just a strong student — worth a look alongside the other signals.</p>
          <ul className="space-y-1 text-sm">
            {fastFinishers.map((f) => <li key={f.userId}>{who(f)} — {f.minutes} min, {f.scorePercent}%</li>)}
          </ul>
        </section>
      )}

      {sharedIps.length > 0 && (
        <section className="mb-6 rounded-lg border p-4" aria-label="Shared networks">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Network className="h-4 w-4" />Same network address</h2>
          <p className="mb-2 text-sm text-muted-foreground">Usually a college lab or hostel Wi-Fi. Worth a look for a take-home test.</p>
          <ul className="space-y-1 text-sm">
            {sharedIps.slice(0, 20).map((g) => <li key={g.ip}><span className="font-mono text-xs">{g.ip}</span> — {g.students.length} students: {g.students.slice(0, 8).map(who).join(', ')}{g.students.length > 8 ? '…' : ''}</li>)}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="p-2 font-medium">Student</th><th className="p-2 font-medium">Device</th><th className="p-2 font-medium">Network</th><th className="p-2 font-medium">Signals</th><th className="p-2 text-right font-medium">Violations</th></tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.attemptId} className={cn('border-t align-top', a.otherDevices > 0 && 'bg-destructive/5')}>
                <td className="p-2"><p className="font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{a.rollNumber ?? '—'} · started {formatDateTime(a.startedAt)}</p></td>
                <td className="p-2">
                  <p className="flex items-center gap-1.5"><TypeIcon t={a.device?.deviceType} />{deviceLine(a.device)}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.device?.screen ?? '—'}{a.device?.screens && a.device.screens > 1 ? ` · ${a.device.screens} screens` : ''}{a.device?.timezone ? ` · ${a.device.timezone}` : ''}
                  </p>
                  {a.otherDevices > 0 && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive"><MonitorSmartphone className="h-3.5 w-3.5" />Continued on {a.otherDevices} other device{a.otherDevices > 1 ? 's' : ''}</p>}
                </td>
                <td className="p-2 font-mono text-xs">{a.ip ?? '—'}{a.ips.length > 1 && <p className="text-destructive">+ {a.ips.filter((x) => x !== a.ip).join(', ')}</p>}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(a.events).map(([k, n]) => (
                      <span key={k} className={cn('rounded px-1.5 py-0.5 text-xs', SERIOUS.has(k) ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>
                        {EVENT_LABEL[k] ?? k} ×{n}
                      </span>
                    ))}
                    {a.similarAnswers > 0 && <span className="rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">Similar answers ×{a.similarAnswers}</span>}
                    {a.fastFinisher && <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Very fast, top score</span>}
                    {Object.keys(a.events).length === 0 && !a.similarAnswers && !a.fastFinisher && <span className="text-xs text-muted-foreground">None</span>}
                  </div>
                  {Boolean(a.snapshots) && (
                    <Button variant="outline" size="sm" className="mt-1.5 h-7 px-2 text-xs" onClick={() => setPhotosOf(a)}>
                      <Camera className="mr-1 h-3.5 w-3.5" />{a.snapshots} photo{a.snapshots === 1 ? '' : 's'}
                    </Button>
                  )}
                </td>
                <td className="p-2 text-right tabular">{a.violations}</td>
              </tr>
            ))}
            {attempts.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No attempts yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <SnapshotsDialog orgId={orgId!} assignmentId={assignmentId!} attempt={photosOf} onClose={() => setPhotosOf(null)} />
    </>
  );
}
