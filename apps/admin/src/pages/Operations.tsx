import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Mail, Pause, Play, Plug, RotateCcw, Send, Server, Trash2, XCircle } from 'lucide-react';
import api from '../services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface QueueInfo {
  name: string; label: string; deadLetter?: boolean; paused: boolean;
  counts: { waiting: number; active: number; delayed: number; failed: number; completed: number; paused: number };
}
interface Job { id: string; name: string; attempts: number; failedReason: string | null; createdAt: string | null; finishedAt: string | null; data: Record<string, unknown> }
interface EmailInfo { provider: string; configured: boolean; keyHint: string; from: string; fromIsDefault: boolean }
interface Integration { key: string; label: string; configured: boolean; mode?: string }

const errorOf = (e: any) => e?.response?.data?.error || e?.message || 'Something went wrong';
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Background jobs, email and outside services: what's running, what failed, what's set up. */
export default function Operations() {
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Operations</h2>
        <p className="text-muted-foreground">Background jobs, email and the services Forge depends on.</p>
      </div>
      <Queues />
      <div className="grid gap-6 lg:grid-cols-2">
        <Email />
        <Integrations />
      </div>
    </div>
  );
}

function Queues() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['ops-queues'], queryFn: async () => (await api.get<QueueInfo[]>('/admin/ops/queues')).data, refetchInterval: 15_000, retry: false,
  });
  const jobs = useQuery({
    queryKey: ['ops-jobs', open], enabled: Boolean(open), retry: false,
    queryFn: async () => (await api.get<Job[]>(`/admin/ops/queues/${open}/jobs`, { params: { state: 'failed' } })).data,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['ops-queues'] }); qc.invalidateQueries({ queryKey: ['ops-jobs'] }); };
  const act = useMutation({
    mutationFn: ({ name, action, body }: { name: string; action: 'retry' | 'clean' | 'pause'; body?: object }) =>
      api.post(`/admin/ops/queues/${name}/${action}`, body ?? {}),
    onSuccess: (r: any) => {
      const d = r.data ?? {};
      toast.success(d.retried !== undefined ? `Retrying ${d.retried} job${d.retried === 1 ? '' : 's'}` : d.removed !== undefined ? `Removed ${d.removed}` : d.paused ? 'Queue paused' : 'Queue running');
      refresh();
    },
    onError: (e) => toast.error(errorOf(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4" />Job queues</CardTitle>
        <CardDescription>Project checks, referrals and subscription upkeep run in the background. Failed jobs are kept for 7 days. Retrying, clearing and pausing need a super admin.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : error ? <p className="text-sm text-destructive">{errorOf(error)}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Queue</th>
                {['Waiting', 'Running', 'Delayed', 'Failed', 'Done'].map((h) => <th key={h} className="px-2 py-2 text-right font-medium">{h}</th>)}
                <th className="py-2 pl-2 text-right font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {(data ?? []).map((q) => (
                  <tr key={q.name} className="border-b last:border-0">
                    <td className="py-2 pr-2">
                      <span className="font-medium">{q.label}</span> {q.paused && <Badge variant="outline">Paused</Badge>}
                      {q.deadLetter && <Badge variant="secondary" className="ml-1">Gave up</Badge>}
                      <span className="block text-xs text-muted-foreground"><code>{q.name}</code></span>
                    </td>
                    <td className="px-2 text-right tabular-nums">{q.counts.waiting + q.counts.paused}</td>
                    <td className="px-2 text-right tabular-nums">{q.counts.active}</td>
                    <td className="px-2 text-right tabular-nums">{q.counts.delayed}</td>
                    <td className={`px-2 text-right tabular-nums ${q.counts.failed ? 'font-semibold text-destructive' : ''}`}>
                      {q.counts.failed ? <button className="underline" onClick={() => setOpen(open === q.name ? null : q.name)}>{q.counts.failed}</button> : 0}
                    </td>
                    <td className="px-2 text-right tabular-nums text-muted-foreground">{q.counts.completed}</td>
                    <td className="py-2 pl-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" disabled={!q.counts.failed || act.isPending} aria-label={`Retry failed jobs in ${q.label}`}
                          onClick={() => act.mutate({ name: q.name, action: 'retry' })}><RotateCcw className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" disabled={!q.counts.failed || act.isPending} aria-label={`Clear failed jobs in ${q.label}`}
                          onClick={() => { if (window.confirm(`Delete ${q.counts.failed} failed job(s) in ${q.label}?`)) act.mutate({ name: q.name, action: 'clean', body: { state: 'failed' } }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" disabled={act.isPending} aria-label={`${q.paused ? 'Resume' : 'Pause'} ${q.label}`}
                          onClick={() => act.mutate({ name: q.name, action: 'pause', body: { paused: !q.paused } })}>{q.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {open && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-semibold">Failed jobs: {data?.find((q) => q.name === open)?.label}</h4>
            {jobs.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (jobs.data ?? []).map((j) => (
              <div key={j.id} className="rounded-md border px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-medium">{j.name}</code>
                  <span className="text-muted-foreground">#{j.id} · {j.attempts} attempt{j.attempts === 1 ? '' : 's'} · {when(j.finishedAt ?? j.createdAt)}</span>
                  <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => act.mutate({ name: open, action: 'retry', body: { jobId: j.id } })}><RotateCcw className="mr-1 h-3 w-3" />Retry</Button>
                </div>
                {j.failedReason && <p className="mt-1 text-destructive">{j.failedReason}</p>}
                {Object.keys(j.data).length > 0 && <p className="mt-1 break-all text-muted-foreground">{Object.entries(j.data).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Email() {
  const { data } = useQuery({ queryKey: ['ops-email'], queryFn: async () => (await api.get<EmailInfo>('/admin/ops/email')).data });
  const [to, setTo] = useState('');
  const test = useMutation({
    mutationFn: async () => (await api.post<{ sent: boolean; message: string }>('/admin/ops/email/test', to ? { to } : {})).data,
    onSuccess: (r) => (r.sent ? toast.success(r.message) : toast.error(r.message)),
    onError: (e) => toast.error(errorOf(e)),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" />Email</CardTitle>
        <CardDescription>Set on the server (RESEND_API_KEY, RESEND_FROM_EMAIL).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Provider</dt><dd>{data.provider} {data.configured ? <Badge>Set up</Badge> : <Badge variant="destructive">Not set up</Badge>}</dd>
            <dt className="text-muted-foreground">Key</dt><dd><code>{data.keyHint || '—'}</code></dd>
            <dt className="text-muted-foreground">Sends as</dt><dd>{data.from}{data.fromIsDefault && <span className="text-xs text-muted-foreground"> (default)</span>}</dd>
          </dl>
        )}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); test.mutate(); }}>
          <Label htmlFor="tt" className="sr-only">Send a test to</Label>
          <Input id="tt" type="email" placeholder="Your email (default)" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button type="submit" variant="outline" disabled={test.isPending}>{test.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}Send test</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Integrations() {
  const { data } = useQuery({ queryKey: ['ops-integrations'], queryFn: async () => (await api.get<Integration[]>('/admin/ops/integrations')).data });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Plug className="h-4 w-4" />Integrations</CardTitle>
        <CardDescription>Which outside services the server has keys for. Keys themselves are never shown; AI keys are under AI Config.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {(data ?? []).map((i) => (
            <li key={i.key} className="flex items-center gap-2">
              {i.configured ? <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Set up" /> : <XCircle className="h-4 w-4 text-muted-foreground" aria-label="Not set up" />}
              <span className={i.configured ? '' : 'text-muted-foreground'}>{i.label}</span>
              {i.mode && i.configured && <Badge variant={i.mode === 'live' ? 'default' : 'outline'}>{i.mode}</Badge>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
