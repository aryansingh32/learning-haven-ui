import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Loader2, Package, Pencil, Plus, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { coursesService, type Course } from '../../services/courses.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const FORGE = '00000000-0000-0000-0000-00000000f0f0';

interface Bundle {
  id: string; slug: string; title: string; description: string | null; coverImage: string | null;
  price: number; isPublished: boolean; courses: Array<{ id: string; title: string; price: number | null }>;
}
interface Form { id: string | null; slug: string; title: string; description: string; coverImage: string; rupees: string; isPublished: boolean; courseIds: string[] }

const blank: Form = { id: null, slug: '', title: '', description: '', coverImage: '', rupees: '', isPublished: false, courseIds: [] };
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const errorOf = (e: any) => e?.response?.data?.error || e?.message || 'Something went wrong';

/** Several Forge courses sold together for one price. Buyers get lifetime access to each course. */
export default function BundlesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const bundles = useQuery({ queryKey: ['admin-bundles'], queryFn: async () => (await api.get<Bundle[]>('/admin/bundles')).data });
  const courses = useQuery({ queryKey: ['admin-courses'], queryFn: coursesService.list });
  // Only Forge's own public courses can be bundled (the database refuses the rest).
  const bundleable = useMemo(() => (courses.data ?? []).filter((c: Course & { owner_org_id?: string; visibility?: string; deleted_at?: string | null }) =>
    !c.deleted_at && (c.owner_org_id ?? FORGE) === FORGE && (c.visibility ?? 'public') === 'public'), [courses.data]);
  const titleOf = (id: string) => bundleable.find((c) => c.id === id)?.title ?? 'Unknown course';
  const priceOf = (id: string) => bundleable.find((c) => c.id === id)?.price ?? null;

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const body = {
        slug: f.slug, title: f.title.trim(), description: f.description.trim() || null, coverImage: f.coverImage.trim() || null,
        price: Math.round(Number(f.rupees) * 100), isPublished: f.isPublished, courseIds: f.courseIds,
      };
      return f.id ? api.put(`/admin/bundles/${f.id}`, body) : api.post('/admin/bundles', body);
    },
    onSuccess: () => { toast.success('Bundle saved'); setForm(null); qc.invalidateQueries({ queryKey: ['admin-bundles'] }); },
    onError: (e) => toast.error(errorOf(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/bundles/${id}`),
    onSuccess: () => { toast.success('Bundle removed. Past buyers keep their courses.'); qc.invalidateQueries({ queryKey: ['admin-bundles'] }); },
    onError: (e) => toast.error(errorOf(e)),
  });

  const separately = form ? form.courseIds.map(priceOf) : [];
  const separatelyTotal = separately.every((p) => p != null) ? separately.reduce<number>((s, p) => s + (p ?? 0), 0) : null;
  const move = (i: number, d: -1 | 1) => form && setForm({ ...form, courseIds: form.courseIds.map((id, j, a) => (j === i ? a[i + d] : j === i + d ? a[i] : id)) });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Package className="h-6 w-6" />Course bundles</h1>
          <p className="text-sm text-muted-foreground">Sell several courses together for one price. Buyers get lifetime access to every course in the bundle.</p>
        </div>
        {!form && <Button onClick={() => setForm(blank)}><Plus className="mr-2 h-4 w-4" />New bundle</Button>}
      </div>

      {form && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{form.id ? 'Edit bundle' : 'New bundle'}</CardTitle>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setForm(null)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="b-title">Title</Label>
                  <Input id="b-title" required minLength={2} maxLength={120} value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label htmlFor="b-slug">Address</Label>
                  <Input id="b-slug" required pattern="[a-z0-9][a-z0-9-]{1,79}" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
                  <p className="text-xs text-muted-foreground">/bundles/{form.slug || '…'}</p></div>
                <div className="space-y-1.5 md:col-span-2"><Label htmlFor="b-desc">Description</Label>
                  <Textarea id="b-desc" rows={3} maxLength={4000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="b-price">Price (₹, before GST)</Label>
                  <Input id="b-price" required type="number" min={0} step="1" value={form.rupees} onChange={(e) => setForm({ ...form, rupees: e.target.value })} />
                  {separatelyTotal != null && form.courseIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">Separately {rupees(separatelyTotal)}
                      {Number(form.rupees) > 0 && separatelyTotal > 0 && ` · saves ${Math.max(0, Math.round(100 - (Number(form.rupees) * 100 / separatelyTotal) * 100))}%`}</p>
                  )}</div>
                <div className="space-y-1.5"><Label htmlFor="b-cover">Cover image (https)</Label>
                  <Input id="b-cover" type="url" value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} /></div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="b-add">Courses ({form.courseIds.length})</Label>
                <ol className="space-y-1">
                  {form.courseIds.map((id, i) => (
                    <li key={id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                      <span className="w-5 text-muted-foreground">{i + 1}.</span>
                      <span className="flex-1">{titleOf(id)}</span>
                      <span className="text-xs text-muted-foreground">{priceOf(id) != null ? rupees(priceOf(id)!) : 'no own price'}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Move ${titleOf(id)} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Move ${titleOf(id)} down`} disabled={i === form.courseIds.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove ${titleOf(id)}`} onClick={() => setForm({ ...form, courseIds: form.courseIds.filter((x) => x !== id) })}><X className="h-3.5 w-3.5" /></Button>
                    </li>
                  ))}
                </ol>
                <select id="b-add" aria-label="Add a course" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value=""
                  onChange={(e) => e.target.value && setForm({ ...form, courseIds: [...form.courseIds, e.target.value] })}>
                  <option value="">Add a course…</option>
                  {bundleable.filter((c) => !form.courseIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.title}{c.is_published ? '' : ' (draft)'}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} aria-label="Published" />
                Published {form.isPublished && form.courseIds.length < 2 && <span className="text-xs text-destructive">needs at least two courses</span>}
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
                <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save bundle</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {bundles.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (bundles.data ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No bundles yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bundles.data!.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{b.title}</h2>
                    <p className="text-xs text-muted-foreground">/bundles/{b.slug}</p>
                  </div>
                  <Badge variant={b.isPublished ? 'default' : 'secondary'}>{b.isPublished ? 'Published' : 'Draft'}</Badge>
                </div>
                <p className="text-lg font-bold">{rupees(b.price)} <span className="text-xs font-normal text-muted-foreground">+ GST · {b.courses.length} courses</span></p>
                <ul className="list-inside list-disc text-sm text-muted-foreground">{b.courses.map((c) => <li key={c.id}>{c.title}</li>)}</ul>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setForm({ id: b.id, slug: b.slug, title: b.title, description: b.description ?? '', coverImage: b.coverImage ?? '',
                    rupees: String(b.price / 100), isPublished: b.isPublished, courseIds: b.courses.map((c) => c.id) })}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm(`Remove "${b.title}"? Past buyers keep their courses.`)) remove.mutate(b.id); }}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
