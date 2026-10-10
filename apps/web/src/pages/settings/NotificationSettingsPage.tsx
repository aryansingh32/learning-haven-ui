import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Loader2, Mail } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { fetchNotificationPreferences, saveNotificationPreferences, type NotificationKind, type NotificationPreferences } from '@/services/campus.service';

const KINDS: Array<{ kind: NotificationKind; label: string; hint: string }> = [
  { kind: 'test_assigned', label: 'New tests', hint: 'When your college gives you a test.' },
  { kind: 'test_closing', label: 'Test closing soon', hint: "A day before a test you haven't submitted closes." },
  { kind: 'result_released', label: 'Results', hint: 'When your score is out.' },
  { kind: 'feedback', label: 'Feedback', hint: 'When an evaluator marks your written answers.' },
  { kind: 'course_assigned', label: 'New courses', hint: 'When your college gives you a course.' },
  { kind: 'course_due', label: 'Course due soon', hint: 'Two days before a course is due.' },
  { kind: 'drive_announced', label: 'Placement drives', hint: "When a company you're eligible for opens applications." },
  { kind: 'drive_update', label: 'Drive updates', hint: 'Shortlists, selections, and the last day to apply.' },
  { kind: 'job_alert', label: 'Job alerts', hint: 'New jobs on Forge that match you.' },
  { kind: 'announcement', label: 'Announcements', hint: 'Messages from your college or Forge.' },
  { kind: 'community_reply', label: 'Replies to your doubts', hint: 'When someone in your college answers a thread you started.' },
  { kind: 'team_request', label: 'Team requests', hint: 'When someone asks to join a team you lead.' },
  { kind: 'team_update', label: 'Team updates', hint: "When you're accepted onto a team, or removed." },
];

export default function NotificationSettingsPage() {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: ['notification-prefs'], queryFn: fetchNotificationPreferences, retry: false });
  const save = useMutation({
    mutationFn: saveNotificationPreferences,
    onSuccess: (p) => { qc.setQueryData(['notification-prefs'], p); toast.success('Saved'); },
    onError: () => toast.error('Could not save. Try again.'),
  });
  if (prefs.isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (prefs.isError) return <p className="py-20 text-center text-sm text-muted-foreground">Notification settings are unavailable right now.</p>;
  const p = prefs.data as NotificationPreferences;
  const toggleKind = (k: NotificationKind, on: boolean) =>
    save.mutate({ mutedKinds: on ? p.mutedKinds.filter((x) => x !== k) : [...p.mutedKinds, k] });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-page-title font-bold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">Choose what you hear about. Anything you turn off here won't appear in the bell or by email.</p>
      </div>

      <section className="card-glass rounded-2xl border border-border/40 p-5 space-y-4">
        <h2 className="flex items-center gap-2 font-bold text-foreground"><Mail className="h-4 w-4 text-primary" /> Email</h2>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span><span className="font-medium text-foreground">Send me emails</span><br /><span className="text-muted-foreground">To the address you sign in with.</span></span>
          <Switch checked={p.emailEnabled} onCheckedChange={(v) => save.mutate({ emailEnabled: v })} aria-label="Send me emails" />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span><span className="font-medium text-foreground">One daily summary instead</span><br /><span className="text-muted-foreground">A single email a day with everything new.</span></span>
          <Switch checked={p.dailyDigest} disabled={!p.emailEnabled} onCheckedChange={(v) => save.mutate({ dailyDigest: v })} aria-label="Daily summary" />
        </label>
      </section>

      <section className="card-glass rounded-2xl border border-border/40 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-foreground"><Bell className="h-4 w-4 text-primary" /> What to tell me about</h2>
        <ul className="divide-y divide-border/40">
          {KINDS.map((k) => (
            <li key={k.kind}>
              <label className="flex items-center justify-between gap-4 py-3 text-sm">
                <span><span className="font-medium text-foreground">{k.label}</span><br /><span className="text-muted-foreground">{k.hint}</span></span>
                <Switch checked={!p.mutedKinds.includes(k.kind)} onCheckedChange={(v) => toggleKind(k.kind, v)} aria-label={k.label} />
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
