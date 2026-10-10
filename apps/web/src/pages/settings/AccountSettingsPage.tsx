import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BadgeCheck, History, KeyRound, Loader2, LogOut, Mail, Monitor, ShieldCheck, Smartphone, AlertTriangle,
  LogIn, CreditCard, Globe, UserPlus, Send, MonitorX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { accountApi, formatWhen, timeAgo, type ActivityRow, type SessionRow } from '@/features/account/account.service';

const ACTIVITY: Record<string, { label: string; icon: typeof LogIn }> = {
  account_created: { label: 'Account created', icon: UserPlus },
  email_verified: { label: 'Email verified', icon: BadgeCheck },
  sign_in: { label: 'Signed in', icon: LogIn },
  sign_out: { label: 'Signed out', icon: LogOut },
  session_revoked: { label: 'Signed out a device', icon: MonitorX },
  other_sessions_revoked: { label: 'Signed out other devices', icon: MonitorX },
  password_changed: { label: 'Password changed', icon: KeyRound },
  password_reset_requested: { label: 'Password reset requested', icon: KeyRound },
  verification_email_sent: { label: 'Verification email sent', icon: Send },
  account_updated: { label: 'Account details changed', icon: ShieldCheck },
  plan_purchased: { label: 'Payment', icon: CreditCard },
  portfolio_published: { label: 'Portfolio made public', icon: Globe },
  portfolio_unpublished: { label: 'Portfolio made private', icon: Globe },
};

const section = 'card-glass rounded-2xl border border-border/40 p-5 space-y-4';

function EmailSection() {
  const info = useQuery({ queryKey: ['account-info'], queryFn: accountApi.info, retry: false });
  const send = useMutation({
    mutationFn: accountApi.sendVerification,
    onSuccess: (r) => toast.success(`Verification email sent to ${r.email}`),
    onError: (e: Error) => toast.error(e.message),
  });
  if (info.isLoading) return <section className={section}><Loader2 className="h-5 w-5 animate-spin text-primary" /></section>;
  if (info.isError || !info.data) return <section className={section}><p className="text-sm text-muted-foreground">Account details are unavailable right now.</p></section>;
  const a = info.data;
  return (
    <section className={section} aria-labelledby="email-h">
      <h2 id="email-h" className="flex items-center gap-2 font-bold text-foreground"><Mail className="h-4 w-4 text-primary" /> Email</h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-foreground break-all">{a.email}</span>
        {a.email_verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Not verified
          </span>
        )}
      </div>
      {a.email_verified ? (
        <p className="text-sm text-muted-foreground">Verified on {formatWhen(a.email_verified_at)}.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Until you confirm this address you can't pay for a plan, earn certificates or make your portfolio public — receipts,
            invoices and certificates are tied to it. Open the link we emailed you, or send a new one.
          </p>
          <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Resend verification email
          </Button>
        </div>
      )}
      {a.pending_email && <p className="text-sm text-muted-foreground">A change to <strong className="text-foreground">{a.pending_email}</strong> is waiting for confirmation.</p>}
      {a.providers.length > 0 && (
        <p className="text-xs text-muted-foreground">Sign-in methods: {a.providers.map((p) => (p === 'email' ? 'email and password' : p[0].toUpperCase() + p.slice(1))).join(', ')}</p>
      )}
    </section>
  );
}

function PasswordSection() {
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ['account-info'], queryFn: accountApi.info, retry: false });
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const change = useMutation({
    mutationFn: accountApi.changePassword,
    onSuccess: (r) => {
      toast.success(r.signed_out_sessions ? `Password changed. ${r.signed_out_sessions} other device${r.signed_out_sessions === 1 ? '' : 's'} signed out.` : 'Password changed.');
      setCurrent(''); setNext(''); setConfirm('');
      qc.invalidateQueries({ queryKey: ['account-sessions'] });
      qc.invalidateQueries({ queryKey: ['account-activity'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!info.data) return null;
  if (!info.data.has_password) {
    return (
      <section className={section} aria-labelledby="pw-h">
        <h2 id="pw-h" className="flex items-center gap-2 font-bold text-foreground"><KeyRound className="h-4 w-4 text-primary" /> Password</h2>
        <p className="text-sm text-muted-foreground">You sign in with Google or GitHub, so this account has no password to change.</p>
      </section>
    );
  }
  const mismatch = confirm.length > 0 && confirm !== next;
  const weak = next.length > 0 && (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next));
  return (
    <section className={section} aria-labelledby="pw-h">
      <h2 id="pw-h" className="flex items-center gap-2 font-bold text-foreground"><KeyRound className="h-4 w-4 text-primary" /> Change password</h2>
      <form
        className="grid gap-3 sm:max-w-md"
        onSubmit={(e) => { e.preventDefault(); change.mutate({ current_password: current, new_password: next, sign_out_others: signOutOthers }); }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">Current password</Label>
          <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">New password</Label>
          <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="pw-hint" required />
          <p id="pw-hint" className={weak ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>At least 8 characters, with a letter and a number.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Repeat new password</Label>
          <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} required />
          {mismatch && <p className="text-xs text-destructive">The passwords don't match.</p>}
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={signOutOthers} onCheckedChange={(v) => setSignOutOthers(v === true)} aria-label="Sign out my other devices" />
          Sign out my other devices
        </label>
        <div>
          <Button type="submit" size="sm" disabled={change.isPending || !current || weak || mismatch || !next || !confirm}>
            {change.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Change password
          </Button>
        </div>
      </form>
    </section>
  );
}

function SessionsSection() {
  const qc = useQueryClient();
  const sessions = useQuery({ queryKey: ['account-sessions'], queryFn: accountApi.sessions, retry: false });
  const [confirm, setConfirm] = useState<{ kind: 'one'; session: SessionRow } | { kind: 'others' } | null>(null);
  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ['account-sessions'] });
    qc.invalidateQueries({ queryKey: ['account-activity'] });
  };
  const revoke = useMutation({ mutationFn: accountApi.revokeSession, onSuccess: () => done('That device is signed out.'), onError: (e: Error) => toast.error(e.message) });
  const revokeOthers = useMutation({
    mutationFn: accountApi.revokeOthers,
    onSuccess: (r) => done(r.revoked ? `Signed out ${r.revoked} other device${r.revoked === 1 ? '' : 's'}.` : 'No other devices were signed in.'),
    onError: (e: Error) => toast.error(e.message),
  });
  const list = sessions.data?.sessions ?? [];
  const others = list.filter((s) => !s.current);

  return (
    <section className={section} aria-labelledby="sessions-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sessions-h" className="flex items-center gap-2 font-bold text-foreground"><Monitor className="h-4 w-4 text-primary" /> Where you're signed in</h2>
        {others.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: 'others' })} disabled={revokeOthers.isPending}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out all other devices
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Signing a device out ends that session: it can't renew its sign-in, and Forge stops accepting it straight away. Don't recognise one? Sign it out and change your password.
      </p>
      {sessions.isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      {sessions.isError && <p className="text-sm text-muted-foreground">Your sessions can't be loaded right now.</p>}
      {sessions.data && !sessions.data.supported && <p className="text-sm text-muted-foreground">The list of devices isn't available yet.</p>}
      {sessions.data?.supported && !sessions.data.current_session_id && (
        <p className="text-sm text-muted-foreground">This device's own session can't be identified, so it isn't marked below.</p>
      )}
      {list.length > 0 && (
        <ul className="divide-y divide-border/40" aria-label="Signed-in devices">
          {list.map((s) => {
            const Icon = s.mobile ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid="session-row">
                <div className="flex min-w-0 items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-foreground">
                      {s.device}
                      {s.current && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">This device</span>}
                    </p>
                    <p className="text-xs text-muted-foreground break-words">
                      {[s.ip, s.method, `signed in ${formatWhen(s.signed_in_at)}`].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-muted-foreground">Last active {timeAgo(s.last_active_at)}</p>
                  </div>
                </div>
                {!s.current && (
                  <Button size="sm" variant="ghost" className="self-start text-destructive hover:text-destructive sm:self-center"
                    onClick={() => setConfirm({ kind: 'one', session: s })} aria-label={`Sign out ${s.device}`}>
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === 'others' ? 'Sign out all other devices?' : `Sign out ${confirm?.kind === 'one' ? confirm.session.device : ''}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'others'
                ? `${others.length} other session${others.length === 1 ? '' : 's'} will end. You stay signed in here.`
                : 'That device will need to sign in again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirm?.kind === 'others') revokeOthers.mutate();
              else if (confirm?.kind === 'one') revoke.mutate(confirm.session.id);
              setConfirm(null);
            }}>
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ActivitySection() {
  const q = useInfiniteQuery({
    queryKey: ['account-activity'],
    queryFn: ({ pageParam }) => accountApi.activity(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_before,
    retry: false,
  });
  const items: ActivityRow[] = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className={section} aria-labelledby="activity-h">
      <h2 id="activity-h" className="flex items-center gap-2 font-bold text-foreground"><History className="h-4 w-4 text-primary" /> Account activity</h2>
      {q.isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      {q.isError && <p className="text-sm text-muted-foreground">Activity can't be loaded right now.</p>}
      {!q.isLoading && !q.isError && items.length === 0 && <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>}
      {items.length > 0 && (
        <ol className="space-y-3" aria-label="Account activity">
          {items.map((i, n) => {
            const meta = ACTIVITY[i.kind] ?? { label: i.kind, icon: ShieldCheck };
            const Icon = meta.icon;
            return (
              <li key={`${i.at}-${i.kind}-${n}`} className="flex gap-3 text-sm">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="text-foreground">
                    <span className="font-medium">{meta.label}</span>
                    {i.detail && <span className="text-muted-foreground"> · {i.detail}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground break-words">
                    {[formatWhen(i.at), i.device, i.ip, i.source === 'auth_log' ? 'from the sign-in service log' : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {q.hasNextPage && (
        <Button size="sm" variant="outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Show older
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Sign-ins show the device and network they came from. Entries marked "from the sign-in service log" are older and have less detail; payments come from your order history.
      </p>
    </section>
  );
}

export default function AccountSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-page-title font-bold text-foreground">Account &amp; security</h1>
        <p className="text-sm text-muted-foreground">Your email, password, the devices you're signed in on, and what's happened on your account.</p>
      </div>
      <EmailSection />
      <PasswordSection />
      <SessionsSection />
      <ActivitySection />
    </div>
  );
}
