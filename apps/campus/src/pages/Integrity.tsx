import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Laptop, MonitorSmartphone, Network, ShieldAlert, Smartphone, Tablet } from 'lucide-react';
import { api } from '@/api/client';
import { ErrorNote, formatDateTime, Loading, PageHeader, Stat } from '@/components/common';
import { cn } from '@/lib/utils';

interface Student { userId: string; name: string; rollNumber: string | null }
interface IntegrityAttempt extends Student {
  attemptId: string; status: string; startedAt: string;
  device: { id: string | null; os?: string | null; osVersion?: string | null; browser?: string | null; browserVersion?: string | null;
    deviceType?: 'desktop' | 'mobile' | 'tablet' | null; screen?: string | null; screens?: number | null; timezone?: string | null } | null;
  ip: string | null; ips: string[]; otherDevices: number; violations: number; events: Record<string, number>;
}
interface Integrity { attempts: IntegrityAttempt[]; sharedDevices: { device: string; students: Student[] }[]; sharedIps: { ip: string; students: Student[] }[] }

const EVENT_LABEL: Record<string, string> = {
  tab_switch: 'Tab switches', window_blur: 'Left window', fullscreen_exit: 'Left full screen', copy: 'Copy', paste: 'Paste',
  context_menu: 'Right-click', device_change: 'Other device', multiple_screens: 'Second screen', devtools_open: 'Dev tools',
  screenshot_key: 'Screenshot', large_paste: 'Large insert',
};
const SERIOUS = new Set(['device_change', 'devtools_open', 'multiple_screens', 'large_paste']);
const TypeIcon = ({ t }: { t?: string | null }) => (t === 'mobile' ? <Smartphone className="h-4 w-4" /> : t === 'tablet' ? <Tablet className="h-4 w-4" /> : <Laptop className="h-4 w-4" />);
const deviceLine = (d: IntegrityAttempt['device']) =>
  d ? [[d.browser, d.browserVersion].filter(Boolean).join(' '), [d.os, d.osVersion].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Unknown device' : 'Not recorded';
const who = (s: Student) => `${s.name}${s.rollNumber ? ` (${s.rollNumber})` : ''}`;

/**
 * Exam integrity for one test: the device and network each student used, devices
 * or networks shared between students, devices changed mid-test, and flagged events.
 */
export default function Integrity() {
  const { orgId, assignmentId } = useParams();
  const q = useQuery({
    queryKey: ['integrity', assignmentId],
    queryFn: () => api<Integrity>(`/orgs/${orgId}/assignments/${assignmentId}/integrity`),
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  const { attempts, sharedDevices, sharedIps } = q.data!;
  const changed = attempts.filter((a) => a.otherDevices > 0);
  const flagged = attempts.filter((a) => Object.keys(a.events).some((k) => SERIOUS.has(k)));

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Results
      </Link>
      <PageHeader title="Integrity" description="Devices, networks and integrity signals for this test. Each attempt is tied to the device it started on." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Attempts" value={attempts.length} />
        <Stat label="Shared devices" value={sharedDevices.length} tone={sharedDevices.length ? 'warning' : undefined} hint="Same device, different students" />
        <Stat label="Device changed mid-test" value={changed.length} tone={changed.length ? 'warning' : undefined} />
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
                    {Object.keys(a.events).length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                  </div>
                </td>
                <td className="p-2 text-right tabular">{a.violations}</td>
              </tr>
            ))}
            {attempts.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No attempts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
