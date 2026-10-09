import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, patch } from '@/api/client';
import type { CollegeDefaults, Org } from '@/api/types';
import { ErrorNote, Field, Loading, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useOrg } from '@/context/CampusContext';

export default function Settings() {
  const { orgId } = useParams();
  const qc = useQueryClient();
  const { can } = useOrg(orgId);
  const org = useQuery({ queryKey: ['org', orgId], queryFn: () => api<Org>(`/orgs/${orgId}`) });
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#4f46e5');
  const [domains, setDomains] = useState('');

  useEffect(() => {
    if (!org.data) return;
    setName(org.data.name);
    setLogoUrl(org.data.logoUrl ?? '');
    setBrandColor(org.data.brandColor ?? '#4f46e5');
    setDomains(org.data.emailDomains.join(', '));
  }, [org.data]);

  const save = useMutation({
    mutationFn: () => patch(`/orgs/${orgId}/branding`, {
      name,
      logoUrl: logoUrl.trim() || null,
      brandColor,
      emailDomains: domains.split(/[,\s]+/).map((d) => d.trim().replace(/^@/, '')).filter(Boolean),
    }),
    onSuccess: () => {
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['org', orgId] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (org.isLoading) return <Loading />;
  if (org.error) return <ErrorNote error={org.error} />;

  return (
    <>
      <PageHeader title="Settings" description="How your college appears in Forge Campus, and the starting rules for new tests." />
      {can('org.manage') && <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="max-w-xl space-y-5 rounded-lg border bg-card p-6">
        <Field label="College name" htmlFor="s-name"><Input id="s-name" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Logo URL" htmlFor="s-logo" hint="A square PNG or SVG works best.">
          <div className="flex items-center gap-3">
            <Input id="s-logo" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
            {logoUrl && <img src={logoUrl} alt="Logo preview" className="h-10 w-10 shrink-0 rounded-md border object-contain" />}
          </div>
        </Field>
        <Field label="Brand colour" htmlFor="s-color" hint="Used for buttons, links and highlights. Pick a dark enough colour that white text stays readable on it.">
          <div className="flex items-center gap-3">
            <input id="s-color" type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-md border bg-card p-1" />
            <span className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: brandColor }}>Sample button</span>
          </div>
        </Field>
        <Field label="College email domains" htmlFor="s-domains" hint="Separate with commas, e.g. college.edu.in. Used for future single sign-on and auto-join.">
          <Input id="s-domains" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="college.edu.in" />
        </Field>
        <Button type="submit" disabled={save.isPending}>Save settings</Button>
      </form>}
      <p className="mt-6 max-w-xl text-sm text-muted-foreground">
        Your college's short name is <code className="rounded bg-secondary px-1.5 py-0.5 text-foreground">{org.data!.slug}</code>. Give it to another college that wants to share tests with you.
      </p>
      <DefaultsForm orgId={orgId!} />
    </>
  );
}

/** College-wide starting values for new assignments; faculty can still change them per test. */
function DefaultsForm({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const current = useQuery({ queryKey: ['org-settings', orgId], queryFn: () => api<{ defaults: CollegeDefaults }>(`/orgs/${orgId}/settings`) });
  const [d, setD] = useState<CollegeDefaults | null>(null);
  useEffect(() => { if (current.data) setD(current.data.defaults); }, [current.data]);
  const save = useMutation({
    mutationFn: () => patch(`/orgs/${orgId}/settings`, d),
    onSuccess: () => { toast.success('Defaults saved'); qc.invalidateQueries({ queryKey: ['org-settings', orgId] }); },
    onError: (e) => toast.error(e.message),
  });
  if (current.isLoading || !d) return <Loading />;
  if (current.error) return <ErrorNote error={current.error} />;
  const set = <K extends keyof CollegeDefaults>(k: K, v: CollegeDefaults[K]) => setD({ ...d, [k]: v });

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="mt-8 max-w-xl space-y-5 rounded-lg border bg-card p-6" aria-labelledby="defaults-title">
      <div>
        <h2 id="defaults-title" className="text-base font-semibold">Defaults for new tests and courses</h2>
        <p className="text-sm text-muted-foreground">Faculty start from these when they assign something, and can change them each time.</p>
      </div>
      <Field label="Show results" htmlFor="d-release">
        <select id="d-release" value={d.resultRelease} onChange={(e) => set('resultRelease', e.target.value as CollegeDefaults['resultRelease'])} className="w-full rounded-md border bg-card px-3 py-2 text-sm">
          <option value="after_close">After the test closes</option>
          <option value="immediately">Right after each student submits</option>
          <option value="manual">When staff release them</option>
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Attempts allowed" htmlFor="d-att"><Input id="d-att" type="number" min={1} max={10} value={d.maxAttempts} onChange={(e) => set('maxAttempts', Number(e.target.value))} /></Field>
        <Field label="Course due in (days)" htmlFor="d-due"><Input id="d-due" type="number" min={1} max={365} value={d.courseDueDays} onChange={(e) => set('courseDueDays', Number(e.target.value))} /></Field>
      </div>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="d-shuffle" className="text-sm font-medium">Shuffle questions and options</label>
        <Switch id="d-shuffle" checked={d.shuffle} onCheckedChange={(v) => set('shuffle', v)} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="d-lock" className="text-sm font-medium">Lockdown mode (full screen, no copy/paste)</label>
        <Switch id="d-lock" checked={d.lockdown} onCheckedChange={(v) => set('lockdown', v)} />
      </div>
      {d.lockdown && (
        <Field label="Auto-submit after this many violations" htmlFor="d-viol">
          <Input id="d-viol" type="number" min={1} max={50} value={d.maxViolations ?? ''} className="w-24"
            onChange={(e) => set('maxViolations', e.target.value ? Number(e.target.value) : null)} />
        </Field>
      )}
      <Button type="submit" disabled={save.isPending}>Save defaults</Button>
    </form>
  );
}
