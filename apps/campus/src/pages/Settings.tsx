import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, patch } from '@/api/client';
import type { Org } from '@/api/types';
import { ErrorNote, Field, Loading, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Settings() {
  const { orgId } = useParams();
  const qc = useQueryClient();
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
      <PageHeader title="Settings" description="How your college appears in Forge Campus." />
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="max-w-xl space-y-5 rounded-lg border bg-card p-6">
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
      </form>
    </>
  );
}
