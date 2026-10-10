import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Loader2, Plus, Save, Star, Trash2 } from 'lucide-react';
import api from '../services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type Kind = 'topic' | 'apprenticeship';
interface Layout {
  title: string; subtitle: string; intro: string; body: string; footer: string; accent: string; background: string; text: string;
  border: 'double' | 'single' | 'none'; showQr: boolean; signatoryName: string; signatoryTitle: string; logoUrl: string;
}
interface Template { id: string; kind: Kind; name: string; isDefault: boolean; layout: Layout }

const KIND_LABEL: Record<Kind, string> = { topic: 'Practice topic', apprenticeship: 'Apprenticeship' };
const errorOf = (e: any) => e?.response?.data?.error || e?.message || 'Something went wrong';
const TEXT_FIELDS: Array<[keyof Layout, string, string]> = [
  ['title', 'Title', 'CERTIFICATE OF ACHIEVEMENT'],
  ['subtitle', 'Under the title', 'Forge'],
  ['intro', 'Before the name', 'This is to certify that'],
  ['body', 'After the name', 'has successfully completed all problems in'],
  ['footer', 'Footer', 'Forge — from zero to hired'],
  ['signatoryName', 'Signed by (name)', ''],
  ['signatoryTitle', 'Signed by (title)', ''],
  ['logoUrl', 'Logo (https PNG or JPG)', ''],
];

/**
 * How certificates look and read, per kind. Placeholders: {name} {achievement} {date}
 * {code} {grade}. Already-issued certificates keep their template; new ones use the default.
 */
export default function CertificateTemplates() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['certificate-templates'], queryFn: async () => (await api.get<Template[]>('/admin/certificate-templates')).data });
  const [editing, setEditing] = useState<(Omit<Template, 'id'> & { id: string | null }) | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['certificate-templates'] });
  const save = useMutation({
    mutationFn: async (t: NonNullable<typeof editing>) => (t.id
      ? api.put(`/admin/certificate-templates/${t.id}`, { name: t.name, layout: t.layout, isDefault: t.isDefault || undefined })
      : api.post('/admin/certificate-templates', { kind: t.kind, name: t.name, layout: t.layout, isDefault: t.isDefault })),
    onSuccess: () => { toast.success('Template saved'); setEditing(null); refresh(); },
    onError: (e) => toast.error(errorOf(e)),
  });
  const makeDefault = useMutation({
    mutationFn: (id: string) => api.put(`/admin/certificate-templates/${id}`, { isDefault: true }),
    onSuccess: () => { toast.success('New certificates will use this template'); refresh(); },
    onError: (e) => toast.error(errorOf(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/certificate-templates/${id}`),
    onSuccess: () => { toast.success('Template deleted'); refresh(); },
    onError: (e) => toast.error(errorOf(e)),
  });
  const preview = useMutation({
    mutationFn: async (t: NonNullable<typeof editing>) =>
      (await api.post('/admin/certificate-templates/preview', { kind: t.kind, layout: t.layout }, { responseType: 'blob' })).data as Blob,
    onSuccess: (blob) => setPreviewUrl(URL.createObjectURL(blob)),
    onError: (e) => toast.error(errorOf(e)),
  });

  const set = <K extends keyof Layout>(k: K, v: Layout[K]) => editing && setEditing({ ...editing, layout: { ...editing.layout, [k]: v } });

  return (
    <section className="space-y-4" aria-label="Certificate templates">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-xl font-semibold">Templates</h3>
          <p className="text-sm text-muted-foreground">How new certificates look. Placeholders: {'{name} {achievement} {date} {code} {grade}'}. Each certificate has a QR code to its verification page.</p>
        </div>
      </div>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {(['topic', 'apprenticeship'] as Kind[]).map((kind) => (
            <Card key={kind}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{KIND_LABEL[kind]} certificates</CardTitle>
                <Button size="sm" variant="outline" onClick={() => {
                  const base = data?.find((t) => t.kind === kind && t.isDefault);
                  setPreviewUrl(null);
                  setEditing({ id: null, kind, name: '', isDefault: false, layout: base ? { ...base.layout } : ({} as Layout) });
                }}><Plus className="mr-1.5 h-3.5 w-3.5" />New</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data ?? []).filter((t) => t.kind === kind).map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="h-4 w-4 rounded-full border" style={{ background: t.layout.accent }} aria-hidden />
                    <span className="flex-1 font-medium">{t.name}</span>
                    {t.isDefault ? <Badge>Default</Badge> : (
                      <Button size="sm" variant="ghost" onClick={() => makeDefault.mutate(t.id)}><Star className="mr-1 h-3.5 w-3.5" />Make default</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { setPreviewUrl(null); setEditing({ ...t, layout: { ...t.layout } }); }}>Edit</Button>
                    {!t.isDefault && <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Delete ${t.name}`}
                      onClick={() => { if (window.confirm(`Delete "${t.name}"? Certificates issued with it will use the default.`)) remove.mutate(t.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Card>
          <CardHeader><CardTitle className="text-base">{editing.id ? `Edit "${editing.name}"` : `New ${KIND_LABEL[editing.kind].toLowerCase()} template`}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}>
                <div className="space-y-1.5"><Label htmlFor="ct-name">Template name</Label>
                  <Input id="ct-name" required minLength={2} maxLength={80} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                {TEXT_FIELDS.map(([k, label, placeholder]) => (
                  <div key={k} className="space-y-1.5"><Label htmlFor={`ct-${k}`}>{label}</Label>
                    <Input id={`ct-${k}`} maxLength={k === 'logoUrl' ? 1000 : 160} placeholder={placeholder} value={String(editing.layout[k] ?? '')}
                      onChange={(e) => set(k, e.target.value as never)} /></div>
                ))}
                <div className="grid grid-cols-3 gap-3">
                  {(['accent', 'background', 'text'] as const).map((k) => (
                    <div key={k} className="space-y-1.5"><Label htmlFor={`ct-${k}`} className="capitalize">{k === 'text' ? 'Text colour' : k}</Label>
                      <Input id={`ct-${k}`} type="color" className="h-9 p-1" value={editing.layout[k] || '#000000'} onChange={(e) => set(k, e.target.value)} /></div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="space-y-1.5"><Label htmlFor="ct-border">Border</Label>
                    <select id="ct-border" className="h-9 rounded-md border bg-background px-3 text-sm" value={editing.layout.border || 'double'} onChange={(e) => set('border', e.target.value as Layout['border'])}>
                      <option value="double">Double</option><option value="single">Single</option><option value="none">None</option>
                    </select></div>
                  <label className="flex items-center gap-2 pt-5 text-sm"><Switch checked={editing.layout.showQr ?? true} onCheckedChange={(v) => set('showQr', v)} aria-label="QR code" />QR code to verify</label>
                  {!editing.isDefault && <label className="flex items-center gap-2 pt-5 text-sm"><Switch checked={editing.isDefault} onCheckedChange={(v) => setEditing({ ...editing, isDefault: v })} aria-label="Use for new certificates" />Use for new certificates</label>}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button type="button" variant="outline" onClick={() => preview.mutate(editing)} disabled={preview.isPending}>
                    {preview.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}Preview</Button>
                  <Button type="submit" disabled={save.isPending}><Save className="mr-2 h-4 w-4" />Save template</Button>
                </div>
              </form>
              <div className="min-h-[320px] rounded-lg border bg-muted/30">
                {previewUrl
                  ? <iframe title="Certificate preview" src={previewUrl} className="h-[460px] w-full rounded-lg" />
                  : <p className="p-6 text-sm text-muted-foreground">Press Preview to see a sample certificate with these settings.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
