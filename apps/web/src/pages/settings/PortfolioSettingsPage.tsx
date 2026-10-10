import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, Globe, Loader2, Lock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { accountApi, portfolioUrl, type PortfolioSettings } from '@/features/account/account.service';

const HANDLE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const section = 'card-glass rounded-2xl border border-border/40 p-5 space-y-4';
const blank = (handle: string): PortfolioSettings => ({
  handle, is_public: false, headline: null, bio: null, show_college: false, show_skills: true, show_evidence: true,
  show_repo_links: false, certificate_refs: [], project_ids: [],
});

/** /settings/portfolio — an opt-in public page at /u/<handle> (slice W2-A1). */
export default function PortfolioSettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['portfolio-editor'], queryFn: accountApi.portfolio, retry: false });
  const [p, setP] = useState<PortfolioSettings | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { if (q.data) setP(q.data.portfolio ?? blank(q.data.suggested_handle)); }, [q.data]);

  const save = useMutation({
    mutationFn: accountApi.savePortfolio,
    onSuccess: (data, sent) => {
      qc.setQueryData(['portfolio-editor'], data);
      const was = q.data?.portfolio?.is_public ?? false;
      toast.success(sent.is_public && !was ? 'Your portfolio is public' : !sent.is_public && was ? 'Your portfolio is private again' : 'Saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: accountApi.deletePortfolio,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolio-editor'] }); toast.success('Portfolio deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading || (!p && !q.isError)) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (q.isError || !q.data || !p) return <p className="py-20 text-center text-sm text-muted-foreground">Portfolio settings are unavailable right now.</p>;
  const d = q.data;
  const saved = d.portfolio;
  const handleOk = HANDLE.test(p.handle) && !p.handle.includes('--');
  const set = (patch: Partial<PortfolioSettings>) => setP({ ...p, ...patch });
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));
  const submit = (patch: Partial<PortfolioSettings> = {}) => save.mutate({ ...p, ...patch });
  const live = Boolean(saved?.is_public);
  const url = portfolioUrl(saved?.handle ?? p.handle);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-page-title font-bold text-foreground">Public portfolio</h1>
        <p className="text-sm text-muted-foreground">
          A page you can share with recruiters, showing only what you pick here. It's off until you turn it on, never shows your email or phone,
          and you can take it down at any time.
        </p>
      </div>

      <section className={section} aria-labelledby="pub-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="pub-h" className="flex items-center gap-2 font-bold text-foreground">
            {live ? <Globe className="h-4 w-4 text-emerald-500" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            {live ? 'Public' : 'Private'}
          </h2>
          <label className="flex items-center gap-3 text-sm">
            <span className="text-foreground">Anyone with the link can see it</span>
            <Switch checked={live} disabled={save.isPending || (!live && (!handleOk || !d.email_verified))}
              onCheckedChange={(v) => submit({ is_public: v })} aria-label="Make my portfolio public" />
          </label>
        </div>
        {!d.email_verified && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Confirm your email before going public. <Link to="/settings/account" className="underline">Resend the link</Link>
          </p>
        )}
        {live && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-secondary px-3 py-2 text-xs text-foreground" data-testid="portfolio-url">{url}</code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={async () => {
                try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copy your link:', url); }
              }}>
                {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />} {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={`/u/${saved!.handle}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" /> View</a>
              </Button>
            </div>
          </div>
        )}
      </section>

      <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); if (handleOk) submit(); }}>
        <section className={section} aria-labelledby="about-h">
          <h2 id="about-h" className="font-bold text-foreground">About you</h2>
          <div className="space-y-1.5">
            <Label htmlFor="pf-handle">Address</Label>
            <div className="flex items-center gap-1 text-sm">
              <span className="shrink-0 text-muted-foreground">/u/</span>
              <Input id="pf-handle" value={p.handle} maxLength={30} aria-invalid={!handleOk} aria-describedby="pf-handle-hint"
                onChange={(e) => set({ handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
            </div>
            <p id="pf-handle-hint" className={handleOk ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
              3–30 lower-case letters, digits or single hyphens. Changing it breaks the old link.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-headline">Headline</Label>
            <Input id="pf-headline" value={p.headline ?? ''} maxLength={120} placeholder="e.g. Final-year CSE · backend and DSA"
              onChange={(e) => set({ headline: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-bio">About</Label>
            <Textarea id="pf-bio" value={p.bio ?? ''} maxLength={600} rows={4} placeholder="A few lines about what you build and what you're looking for."
              onChange={(e) => set({ bio: e.target.value })} />
            <p className="text-xs text-muted-foreground">{(p.bio ?? '').length} / 600</p>
          </div>
          {d.has_college && (
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-foreground">Show my college</span>
              <Switch checked={p.show_college} onCheckedChange={(v) => set({ show_college: v })} aria-label="Show my college" />
            </label>
          )}
        </section>

        <section className={section} aria-labelledby="certs-h">
          <h2 id="certs-h" className="font-bold text-foreground">Certificates</h2>
          {d.certificates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No certificates yet. <Link to="/certificates" className="text-primary underline">See how to earn one</Link></p>
          ) : (
            <ul className="space-y-2">
              {d.certificates.map((c) => (
                <li key={c.ref}>
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox checked={p.certificate_refs.includes(c.ref)} aria-label={`Show certificate ${c.title}`}
                      onCheckedChange={(v) => set({ certificate_refs: toggle(p.certificate_refs, c.ref, v === true) })} />
                    <span className="text-foreground">{c.title}</span>
                    <span className="text-xs text-muted-foreground">{new Date(c.issued_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={section} aria-labelledby="projects-h">
          <h2 id="projects-h" className="font-bold text-foreground">Projects</h2>
          {d.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet. <Link to="/projects" className="text-primary underline">Start a build challenge</Link></p>
          ) : (
            <ul className="space-y-2">
              {d.projects.map((pr) => (
                <li key={pr.id}>
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox checked={p.project_ids.includes(pr.id)} aria-label={`Show project ${pr.title}`}
                      onCheckedChange={(v) => set({ project_ids: toggle(p.project_ids, pr.id, v === true) })} />
                    <span className="min-w-0 text-foreground break-words">{pr.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {pr.language} · {pr.status === 'completed' ? 'finished' : `${pr.stages_done}/${pr.stages_total} stages`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <label className="flex items-center justify-between gap-4 text-sm">
            <span><span className="text-foreground">Link to GitHub repositories</span><br /><span className="text-xs text-muted-foreground">Shows your GitHub username to visitors.</span></span>
            <Switch checked={p.show_repo_links} onCheckedChange={(v) => set({ show_repo_links: v })} aria-label="Link to GitHub repositories" />
          </label>
        </section>

        <section className={section} aria-labelledby="skills-pf-h">
          <h2 id="skills-pf-h" className="font-bold text-foreground">Skills</h2>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span className="text-foreground">Show my skills profile</span>
            <Switch checked={p.show_skills} onCheckedChange={(v) => set({ show_skills: v })} aria-label="Show my skills profile" />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span><span className="text-foreground">Show problems solved per topic</span><br /><span className="text-xs text-muted-foreground">Counted from solutions Forge's judge accepted.</span></span>
            <Switch checked={p.show_evidence} onCheckedChange={(v) => set({ show_evidence: v })} aria-label="Show problems solved per topic" />
          </label>
          <p className="text-xs text-muted-foreground">Edit your skills on your <Link to="/profile" className="text-primary underline">profile</Link>.</p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={save.isPending || !handleOk}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
          {saved && (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete portfolio
            </Button>
          )}
        </div>
      </form>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your portfolio?</AlertDialogTitle>
            <AlertDialogDescription>The page and its address go away now. Your certificates, projects and skills stay on your account.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
