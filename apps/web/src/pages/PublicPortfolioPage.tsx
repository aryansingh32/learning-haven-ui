import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, BadgeCheck, Code2, ExternalLink, GraduationCap, Hammer, Loader2, Sparkles } from 'lucide-react';
import { LEVELS, accountApi } from '@/features/account/account.service';

const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.value, l.label]));
const LEVEL_DOTS: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
const month = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '');

/** /u/:handle — a learner's published portfolio (slice W2-A1). Public, read-only, not indexed by search engines. */
export default function PublicPortfolioPage() {
  const { handle = '' } = useParams<{ handle: string }>();
  const q = useQuery({ queryKey: ['public-portfolio', handle], queryFn: () => accountApi.publicPortfolio(handle), retry: false });

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);
  useEffect(() => { if (q.data) document.title = `${q.data.name} · Forge portfolio`; }, [q.data]);

  if (q.isLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (q.isError || !q.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">This portfolio isn't available</h1>
        <p className="max-w-sm text-sm text-muted-foreground">The address may be wrong, or its owner has made it private.</p>
        <Link to="/" className="text-sm font-semibold text-primary hover:underline">Go to Forge</Link>
      </main>
    );
  }
  const p = q.data;
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="card-glass rounded-2xl p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl gradient-golden font-display text-2xl font-bold text-white sm:h-20 sm:w-20">
              {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (p.name || '?').charAt(0)}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold text-foreground break-words sm:text-3xl">{p.name}</h1>
              {p.headline && <p className="mt-1 text-sm text-foreground/80 break-words">{p.headline}</p>}
              {p.college && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><GraduationCap className="h-3.5 w-3.5" aria-hidden /> {p.college}</p>}
            </div>
          </div>
          {p.bio && <p className="mt-4 whitespace-pre-line text-sm text-foreground/90 break-words">{p.bio}</p>}
        </header>

        {p.certificates.length > 0 && (
          <section className="card-glass rounded-2xl p-5 sm:p-6" aria-labelledby="pp-certs">
            <h2 id="pp-certs" className="mb-3 flex items-center gap-2 font-display font-bold text-foreground"><Award className="h-4 w-4 text-amber-500" /> Certificates</h2>
            <ul className="space-y-3">
              {p.certificates.map((c) => (
                <li key={`${c.kind}-${c.code}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground break-words">{c.title}{c.grade ? ` · ${c.grade}` : ''}</p>
                    <p className="text-xs text-muted-foreground">Issued {month(c.issued_at)} · code <span className="font-mono">{c.code}</span></p>
                  </div>
                  {c.kind === 'apprenticeship' && (
                    <Link to={`/certificates/${encodeURIComponent(c.code)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verify
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.projects.length > 0 && (
          <section className="card-glass rounded-2xl p-5 sm:p-6" aria-labelledby="pp-projects">
            <h2 id="pp-projects" className="mb-3 flex items-center gap-2 font-display font-bold text-foreground"><Hammer className="h-4 w-4 text-emerald-500" /> Projects</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {p.projects.map((pr) => (
                <li key={pr.slug + pr.language} className="rounded-xl border border-border/50 p-4">
                  <p className="font-medium text-foreground break-words">{pr.title}</p>
                  {pr.tagline && <p className="mt-0.5 text-xs text-muted-foreground break-words">{pr.tagline}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {pr.language} · {pr.status === 'completed' ? `finished ${month(pr.completed_at)}` : `${pr.stages_done} of ${pr.stages_total} stages`}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Stages are verified by Forge's automated tests.</p>
                  {pr.repo_url && (
                    <a href={pr.repo_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" /> Code on GitHub
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(p.skills.length > 0 || p.evidence.length > 0) && (
          <section className="card-glass rounded-2xl p-5 sm:p-6 space-y-4" aria-labelledby="pp-skills">
            <h2 id="pp-skills" className="flex items-center gap-2 font-display font-bold text-foreground"><Sparkles className="h-4 w-4 text-primary" /> Skills</h2>
            {p.skills.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Skills">
                {p.skills.map((s) => (
                  <li key={s.name} className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-foreground">
                    {s.name}
                    <span className="flex gap-0.5" role="img" aria-label={LEVEL_LABEL[s.level]}>
                      {[1, 2, 3, 4].map((n) => <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= LEVEL_DOTS[s.level] ? 'bg-primary' : 'bg-muted-foreground/30'}`} />)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {p.skills.length > 0 && <p className="text-xs text-muted-foreground">Self-assessed levels.</p>}
            {p.evidence.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Problems solved on Forge</h3>
                <ul className="flex flex-wrap gap-2" aria-label="Problems solved by topic">
                  {p.evidence.map((e) => (
                    <li key={e.skill} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-foreground">
                      <Code2 className="h-3 w-3 text-primary" aria-hidden /> {e.skill} · {e.amount}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Counted from solutions Forge's judge accepted.</p>
              </div>
            )}
          </section>
        )}

        <footer className="pb-6 text-center text-xs text-muted-foreground">
          Portfolio on <Link to="/" className="font-semibold text-primary hover:underline">Forge</Link>
          {p.published_at ? ` · public since ${month(p.published_at)}` : ''}
        </footer>
      </div>
    </main>
  );
}
