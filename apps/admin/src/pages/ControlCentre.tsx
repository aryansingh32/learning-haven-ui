import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Megaphone, Plus, Power, Save, ToggleRight, Trash2 } from 'lucide-react';
import api from '../services/api';
import { collegesService } from '../services/colleges.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface Flag { key: string; kind: 'release' | 'kill_switch'; enabled: boolean; rollout: number; orgIds: string[]; description: string | null; updatedAt: string }
interface Announcement {
  id: string; title: string; body: string; level: 'info' | 'warning' | 'critical'; audience: 'everyone' | 'signed_in' | 'colleges';
  linkUrl: string | null; linkLabel: string | null; startsAt: string; endsAt: string | null; isActive: boolean;
}
interface Control { maintenance: boolean; maintenanceMessage: string; signupsOpen: boolean; flags: Flag[]; announcements: Announcement[] }

const errorOf = (e: any) => e?.response?.data?.error || e?.message || 'Something went wrong';
const MODULE_LABEL: Record<string, string> = {
  'module.ai': 'AI coach', 'module.code_execution': 'Running code', 'module.payments': 'New purchases',
  'module.test_series': 'Test series', 'module.discussions': 'Course discussions', 'module.community': 'College community',
};
const AUDIENCE_LABEL = { everyone: 'Everyone', signed_in: 'Signed-in learners', colleges: 'College students' };
const LEVEL_CLASS = { info: 'bg-blue-100 text-blue-800', warning: 'bg-amber-100 text-amber-900', critical: 'bg-red-100 text-red-800' };
/** <input type="datetime-local"> value ↔ ISO */
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

/**
 * Switches that act on the whole product at once: maintenance mode, sign-ups,
 * module kill switches, gradual feature roll-outs and announcement banners.
 */
export default function ControlCentre() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['control'], queryFn: async () => (await api.get<Control>('/admin/control')).data });
  const refresh = () => qc.invalidateQueries({ queryKey: ['control'] });

  if (isLoading || !data) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Control Centre</h2>
        <p className="text-muted-foreground">Changes apply to everyone within about ten seconds.</p>
      </div>
      <SystemCard data={data} onSaved={refresh} />
      <KillSwitches flags={data.flags.filter((f) => f.kind === 'kill_switch')} onSaved={refresh} />
      <ReleaseFlags flags={data.flags.filter((f) => f.kind === 'release')} onSaved={refresh} />
      <Announcements items={data.announcements} onSaved={refresh} />
    </div>
  );
}

function SystemCard({ data, onSaved }: { data: Control; onSaved: () => void }) {
  const [message, setMessage] = useState(data.maintenanceMessage);
  useEffect(() => setMessage(data.maintenanceMessage), [data.maintenanceMessage]);
  const save = useMutation({
    mutationFn: (body: Partial<Pick<Control, 'maintenance' | 'maintenanceMessage' | 'signupsOpen'>>) => api.put('/admin/control/system', body),
    onSuccess: () => { toast.success('Saved'); onSaved(); },
    onError: (e) => toast.error(errorOf(e)),
  });
  return (
    <Card className={data.maintenance ? 'border-destructive' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Power className="h-4 w-4" />Maintenance and sign-ups</CardTitle>
        <CardDescription>Maintenance mode shows learners a "back soon" screen and the API refuses their requests. You and other staff keep working, and so do payment webhooks. Super admins only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.maintenance && (
          <p role="status" className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />Maintenance mode is ON. Learners can't use Forge right now.
          </p>
        )}
        <label className="flex items-center gap-3 text-sm font-medium">
          <Switch checked={data.maintenance} aria-label="Maintenance mode" disabled={save.isPending}
            onCheckedChange={(v) => { if (!v || window.confirm('Turn on maintenance mode? Learners will be locked out until you turn it off.')) save.mutate({ maintenance: v }); }} />
          Maintenance mode
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="mm">What learners see</Label>
          <div className="flex gap-2">
            <Input id="mm" maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button variant="outline" disabled={message.trim().length < 2 || message === data.maintenanceMessage || save.isPending}
              onClick={() => save.mutate({ maintenanceMessage: message.trim() })}><Save className="mr-1.5 h-4 w-4" />Save</Button>
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm font-medium">
          <Switch checked={data.signupsOpen} aria-label="New sign-ups" disabled={save.isPending} onCheckedChange={(v) => save.mutate({ signupsOpen: v })} />
          New sign-ups {data.signupsOpen ? 'open' : 'paused'}
        </label>
      </CardContent>
    </Card>
  );
}

function KillSwitches({ flags, onSaved }: { flags: Flag[]; onSaved: () => void }) {
  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => api.put(`/admin/control/flags/${key}`, { enabled }),
    onSuccess: (_r, v) => { toast.success(`${MODULE_LABEL[v.key] ?? v.key} ${v.enabled ? 'back on' : 'switched off'}`); onSaved(); },
    onError: (e) => toast.error(errorOf(e)),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Emergency switches</CardTitle>
        <CardDescription>Turn a part of Forge off at once, for example if a provider is down or something is being abused. Learners see "switched off for a short while"; nothing is deleted.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {flags.map((f) => (
          <label key={f.key} className={`flex items-start gap-3 rounded-md border px-3 py-2 ${f.enabled ? '' : 'border-destructive bg-destructive/5'}`}>
            <Switch className="mt-0.5" checked={f.enabled} aria-label={MODULE_LABEL[f.key] ?? f.key} disabled={toggle.isPending}
              onCheckedChange={(enabled) => { if (enabled || window.confirm(`Switch off ${MODULE_LABEL[f.key] ?? f.key} for everyone?`)) toggle.mutate({ key: f.key, enabled }); }} />
            <span className="text-sm">
              <span className="font-medium">{MODULE_LABEL[f.key] ?? f.key}</span> {!f.enabled && <Badge variant="destructive" className="ml-1">Off</Badge>}
              {f.description && <span className="block text-xs text-muted-foreground">{f.description}</span>}
            </span>
          </label>
        ))}
        {flags.length === 0 && <p className="text-sm text-muted-foreground">No switches yet (the control-centre migration hasn't been applied).</p>}
      </CardContent>
    </Card>
  );
}

type FlagDraft = { key: string; description: string; enabled: boolean; rollout: number; orgIds: string[]; isNew: boolean };

function ReleaseFlags({ flags, onSaved }: { flags: Flag[]; onSaved: () => void }) {
  const [draft, setDraft] = useState<FlagDraft | null>(null);
  const { data: colleges } = useQuery({ queryKey: ['colleges'], queryFn: collegesService.list, enabled: Boolean(draft), retry: false });
  const save = useMutation({
    mutationFn: (d: FlagDraft) => (d.isNew
      ? api.post('/admin/control/flags', { key: d.key, description: d.description || null, enabled: d.enabled, rollout: d.rollout, orgIds: d.orgIds })
      : api.put(`/admin/control/flags/${d.key}`, { description: d.description || null, enabled: d.enabled, rollout: d.rollout, orgIds: d.orgIds })),
    onSuccess: () => { toast.success('Flag saved'); setDraft(null); onSaved(); },
    onError: (e) => toast.error(errorOf(e)),
  });
  const remove = useMutation({
    mutationFn: (key: string) => api.delete(`/admin/control/flags/${key}`),
    onSuccess: () => { toast.success('Flag deleted'); onSaved(); },
    onError: (e) => toast.error(errorOf(e)),
  });
  const collegeName = (id: string) => colleges?.find((c) => c.id === id)?.name ?? id.slice(0, 8);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><ToggleRight className="h-4 w-4" />Feature roll-outs</CardTitle>
          <CardDescription>Give a new feature to a share of learners, or to chosen colleges first. A learner keeps the same answer as the percentage grows.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDraft({ key: '', description: '', enabled: true, rollout: 10, orgIds: [], isNew: true })}><Plus className="mr-1 h-3.5 w-3.5" />New flag</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {flags.map((f) => (
          <div key={f.key} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <code className="font-medium">{f.key}</code>
            {f.enabled ? <Badge variant="secondary">{f.rollout}% of learners{f.orgIds.length ? ` + ${f.orgIds.length} college${f.orgIds.length > 1 ? 's' : ''}` : ''}</Badge> : <Badge variant="outline">Off</Badge>}
            <span className="flex-1 text-xs text-muted-foreground">{f.description}</span>
            <Button size="sm" variant="ghost" onClick={() => setDraft({ key: f.key, description: f.description ?? '', enabled: f.enabled, rollout: f.rollout, orgIds: f.orgIds, isNew: false })}>Edit</Button>
            <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Delete ${f.key}`}
              onClick={() => { if (window.confirm(`Delete the flag ${f.key}? Code that checks it will treat it as off.`)) remove.mutate(f.key); }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        {flags.length === 0 && !draft && <p className="text-sm text-muted-foreground">No roll-outs yet.</p>}
        {draft && (
          <form className="space-y-3 rounded-md border bg-muted/30 p-3" onSubmit={(e) => { e.preventDefault(); save.mutate(draft); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="fk">Key</Label>
                <Input id="fk" required disabled={!draft.isNew} placeholder="practice.new_editor" pattern="[a-z][a-z0-9_.]{1,63}" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="fd">What it does</Label>
                <Input id="fd" maxLength={500} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} aria-label="Flag on" />On</label>
              <div className="flex flex-1 items-center gap-3">
                <Label htmlFor="fr" className="whitespace-nowrap">Learners: {draft.rollout}%</Label>
                <input id="fr" type="range" min={0} max={100} step={5} className="w-full" value={draft.rollout} onChange={(e) => setDraft({ ...draft, rollout: Number(e.target.value) })} />
              </div>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Colleges that always get it</legend>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
                {(colleges ?? []).map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs">
                    <input type="checkbox" checked={draft.orgIds.includes(c.id)}
                      onChange={(e) => setDraft({ ...draft, orgIds: e.target.checked ? [...draft.orgIds, c.id] : draft.orgIds.filter((x) => x !== c.id) })} />
                    {c.name}
                  </label>
                ))}
                {draft.orgIds.filter((id) => !colleges?.some((c) => c.id === id)).map((id) => <Badge key={id} variant="outline">{collegeName(id)}</Badge>)}
                {!colleges?.length && <span className="text-xs text-muted-foreground">No colleges to choose from.</span>}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}><Save className="mr-1.5 h-4 w-4" />Save flag</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

type AnnDraft = Omit<Announcement, 'id'> & { id: string | null };
const emptyAnn = (): AnnDraft => ({ id: null, title: '', body: '', level: 'info', audience: 'everyone', linkUrl: null, linkLabel: null, startsAt: new Date().toISOString(), endsAt: null, isActive: true });

function annState(a: Announcement) {
  const now = Date.now();
  if (!a.isActive) return 'Hidden';
  if (new Date(a.startsAt).getTime() > now) return 'Scheduled';
  if (a.endsAt && new Date(a.endsAt).getTime() <= now) return 'Ended';
  return 'Showing';
}

function Announcements({ items, onSaved }: { items: Announcement[]; onSaved: () => void }) {
  const [draft, setDraft] = useState<AnnDraft | null>(null);
  const save = useMutation({
    mutationFn: ({ id, ...a }: AnnDraft) => (id ? api.put(`/admin/control/announcements/${id}`, a) : api.post('/admin/control/announcements', a)),
    onSuccess: () => { toast.success('Announcement saved'); setDraft(null); onSaved(); },
    onError: (e) => toast.error(errorOf(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/control/announcements/${id}`),
    onSuccess: () => { toast.success('Announcement deleted'); onSaved(); },
    onError: (e) => toast.error(errorOf(e)),
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" />Announcements</CardTitle>
          <CardDescription>A banner across the learner app between two times: planned downtime, a new feature, exam-week tips.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDraft(emptyAnn())}><Plus className="mr-1 h-3.5 w-3.5" />New</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${LEVEL_CLASS[a.level]}`}>{a.level}</span>
            <span className="flex-1 font-medium">{a.title}</span>
            <span className="text-xs text-muted-foreground">{AUDIENCE_LABEL[a.audience]}</span>
            <Badge variant={annState(a) === 'Showing' ? 'default' : 'outline'}>{annState(a)}</Badge>
            <Button size="sm" variant="ghost" onClick={() => setDraft({ ...a })}>Edit</Button>
            <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Delete ${a.title}`}
              onClick={() => { if (window.confirm(`Delete "${a.title}"?`)) remove.mutate(a.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        {items.length === 0 && !draft && <p className="text-sm text-muted-foreground">No announcements.</p>}
        {draft && (
          <form className="space-y-3 rounded-md border bg-muted/30 p-3" onSubmit={(e) => { e.preventDefault(); save.mutate(draft); }}>
            <div className="space-y-1.5"><Label htmlFor="at">Title</Label>
              <Input id="at" required minLength={2} maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="ab">Message (optional)</Label>
              <Textarea id="ab" maxLength={1000} rows={2} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="al">Level</Label>
                <select id="al" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as AnnDraft['level'] })}>
                  <option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
                </select></div>
              <div className="space-y-1.5"><Label htmlFor="aa">Who sees it</Label>
                <select id="aa" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as AnnDraft['audience'] })}>
                  {Object.entries(AUDIENCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></div>
              <div className="space-y-1.5"><Label htmlFor="as">Starts</Label>
                <Input id="as" type="datetime-local" required value={toLocal(draft.startsAt)} onChange={(e) => setDraft({ ...draft, startsAt: fromLocal(e.target.value) ?? new Date().toISOString() })} /></div>
              <div className="space-y-1.5"><Label htmlFor="ae">Ends (optional)</Label>
                <Input id="ae" type="datetime-local" value={toLocal(draft.endsAt)} onChange={(e) => setDraft({ ...draft, endsAt: fromLocal(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label htmlFor="au">Link (https, optional)</Label>
                <Input id="au" type="url" pattern="https://.*" value={draft.linkUrl ?? ''} onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value || null })} /></div>
              <div className="space-y-1.5"><Label htmlFor="ak">Link text</Label>
                <Input id="ak" maxLength={40} placeholder="Learn more" value={draft.linkLabel ?? ''} onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value || null })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isActive} onCheckedChange={(v) => setDraft({ ...draft, isActive: v })} aria-label="Show this announcement" />Show it</label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}><Save className="mr-1.5 h-4 w-4" />Save announcement</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
