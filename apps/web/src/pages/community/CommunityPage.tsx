import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Github, Linkedin, Loader2, MessageCircle, MessageSquarePlus, Pin, Plus, Search, Users, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { CollegeTag } from '@/components/college/FromYourCollege';
import { Avatar, Chip, NewTeamDialog, NewThreadDialog, TEAM_STATUS, ago, splitList, useCommunityCollege } from '@/features/community/common';
import {
  askToJoinTeam, fetchDirectory, fetchMyCard, fetchTeams, fetchThreads, leaveDirectory, saveMyCard,
  type DirectoryCard, type MyCard, type ThreadSummary,
} from '@/services/campus.service';

type Tab = 'doubts' | 'people' | 'teams';
const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'doubts', label: 'Doubts & discussions', icon: MessageCircle },
  { id: 'people', label: 'People', icon: Users },
  { id: 'teams', label: 'Teams & projects', icon: UserPlus },
];

/** Students of one college helping each other: doubts, the people directory, and project teams. */
export default function CommunityPage() {
  const { college, colleges, isLoading, choose } = useCommunityCollege();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'doubts') as Tab;
  const setTab = (t: Tab) => { const n = new URLSearchParams(params); n.set('tab', t); setParams(n, { replace: true }); };

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!college) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="font-display text-xl font-bold">Community is for college students</h1>
        <p className="mt-2 text-sm text-muted-foreground">When your college adds you to Forge Campus, you can ask doubts, find classmates and build projects together here.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Community</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CollegeTag college={{ id: college.orgId, name: college.orgName, logoUrl: college.logoUrl, brandColor: college.brandColor }} />
            <span>Only your college sees what's here.</span>
          </div>
        </div>
        {colleges.length > 1 && (
          <select aria-label="College" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={college.orgId} onChange={(e) => choose(e.target.value)}>
            {colleges.map((c) => <option key={c.orgId} value={c.orgId}>{c.orgName}</option>)}
          </select>
        )}
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border/50 bg-secondary/30 p-1" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn('inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
              tab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </nav>

      {tab === 'doubts' && <Doubts orgId={college.orgId} />}
      {tab === 'people' && <People orgId={college.orgId} />}
      {tab === 'teams' && <Teams orgId={college.orgId} />}
    </div>
  );
}

// ── Doubts ───────────────────────────────────────────────────────────────────

function Doubts({ orgId }: { orgId: string }) {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'unanswered' | 'mine'>('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  // Arriving from a practice problem ("Ask your college"): open the form about it.
  const problem = params.get('problem') && params.get('problemTitle') ? { id: params.get('problem')!, title: params.get('problemTitle')! } : null;
  const [asking, setAsking] = useState(Boolean(problem && params.get('ask')));
  useEffect(() => { const t = setTimeout(() => setSearch(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['community-threads', orgId, filter, search, problem?.id],
    queryFn: () => fetchThreads(orgId, { q: search || undefined, unanswered: filter === 'unanswered', mine: filter === 'mine', problemId: problem?.id }),
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search doubts" className="pl-9" placeholder="Search doubts and discussions" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {(['all', 'unanswered', 'mine'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'unanswered' ? 'Unanswered' : 'Mine'}
          </Button>
        ))}
        <Button size="sm" onClick={() => setAsking(true)}><MessageSquarePlus className="mr-1.5 h-4 w-4" />Ask a doubt</Button>
      </div>
      {problem && (
        <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          Showing doubts about <span className="font-medium">{problem.title}</span>. <Link to={`/community?college=${orgId}`} className="text-primary underline">Show everything</Link>
        </p>
      )}
      {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {data && data.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          {filter === 'all' && !search ? 'No doubts yet. Stuck on something? Ask — someone in your college has probably solved it.' : 'Nothing matches.'}
        </div>
      )}
      <ul className="space-y-2">{data?.map((t) => <ThreadRow key={t.id} orgId={orgId} t={t} />)}</ul>
      <NewThreadDialog orgId={orgId} open={asking} onOpenChange={setAsking} problem={problem} />
    </section>
  );
}

function ThreadRow({ orgId, t }: { orgId: string; t: ThreadSummary }) {
  return (
    <li>
      <Link to={`/community/${orgId}/threads/${t.id}`} className="card-glass block rounded-2xl border border-border/40 p-4 transition hover:border-primary/40">
        <div className="flex items-start gap-3">
          <Avatar person={t.author} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {t.pinned && <Pin className="h-3.5 w-3.5 text-primary" aria-label="Pinned" />}
              <h3 className="font-semibold text-foreground">{t.title}</h3>
              {t.kind === 'doubt' && (t.solved
                ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success"><CheckCircle2 className="h-3 w-3" />Answered</span>
                : <span className="rounded-full bg-reward/10 px-2 py-0.5 text-xs font-semibold text-reward">Doubt</span>)}
              {t.hidden && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Hidden</span>}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.excerpt}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{t.author.name}</span><span>·</span><span>{ago(t.lastActivityAt)}</span><span>·</span>
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{t.replies}</span>
              {t.problemTitle && <Chip>Problem: {t.problemTitle}</Chip>}
              {t.tags.map((g) => <Chip key={g}>#{g}</Chip>)}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

// ── People ───────────────────────────────────────────────────────────────────

function People({ orgId }: { orgId: string }) {
  const [q, setQ] = useState('');
  const [looking, setLooking] = useState(false);
  const [editing, setEditing] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['community-people', orgId, looking], queryFn: () => fetchDirectory(orgId, { looking }) });
  const mine = data?.find((c) => c.me);
  const needle = q.trim().toLowerCase();
  const shown = (data ?? []).filter((c) => !needle || c.person.name.toLowerCase().includes(needle)
    || (c.headline ?? '').toLowerCase().includes(needle) || c.skills.some((s) => s.toLowerCase().includes(needle)));

  return (
    <section className="space-y-4">
      {(editing || (!isLoading && !mine && !looking)) && <MyCardForm orgId={orgId} startOpen={editing} onDone={() => setEditing(false)} />}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search people" className="pl-9" placeholder="Search by name or skill (react, dsa, ml…)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={looking} onCheckedChange={setLooking} aria-label="Only people looking for a team" />Looking for a team</label>
        {mine && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit my card</Button>}
      </div>
      {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
      {data && shown.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{data.length === 0 ? 'Nobody has joined the directory yet.' : 'Nobody matches.'}</p>}
      <div className="grid gap-3 sm:grid-cols-2">{shown.map((c) => <PersonCard key={c.person.id} c={c} />)}</div>
    </section>
  );
}

function PersonCard({ c }: { c: DirectoryCard }) {
  return (
    <article className="card-glass rounded-2xl border border-border/40 p-4">
      <div className="flex items-start gap-3">
        <Avatar person={c.person} size={10} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{c.person.name}{c.me && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}</h3>
            {c.lookingForTeam && <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">Looking for a team</span>}
          </div>
          {c.headline && <p className="text-sm text-muted-foreground">{c.headline}</p>}
        </div>
      </div>
      {c.bio && <p className="mt-2 line-clamp-3 text-sm text-foreground/90">{c.bio}</p>}
      {c.skills.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{c.skills.map((s) => <Chip key={s}>{s}</Chip>)}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {c.teams.length > 0 && <span>On {c.teams.map((t) => t.name).join(', ')}</span>}
        {c.githubUrl && <a href={c.githubUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:text-foreground"><Github className="h-3.5 w-3.5" />GitHub</a>}
        {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:text-foreground"><Linkedin className="h-3.5 w-3.5" />LinkedIn</a>}
      </div>
    </article>
  );
}

function MyCardForm({ orgId, startOpen, onDone }: { orgId: string; startOpen: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(startOpen);
  const { data: card, isLoading } = useQuery({ queryKey: ['community-my-card', orgId], queryFn: () => fetchMyCard(orgId), enabled: open });
  const [f, setF] = useState({ headline: '', bio: '', skills: '', lookingForTeam: false, githubUrl: '', linkedinUrl: '' });
  useEffect(() => {
    if (card) setF({ headline: card.headline ?? '', bio: card.bio ?? '', skills: card.skills.join(', '), lookingForTeam: card.lookingForTeam, githubUrl: card.githubUrl ?? '', linkedinUrl: card.linkedinUrl ?? '' });
  }, [card]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['community-people', orgId] }); qc.invalidateQueries({ queryKey: ['community-my-card', orgId] }); };
  const save = useMutation({
    mutationFn: () => saveMyCard(orgId, {
      headline: f.headline.trim() || null, bio: f.bio.trim() || null, skills: splitList(f.skills), lookingForTeam: f.lookingForTeam,
      githubUrl: f.githubUrl.trim() || null, linkedinUrl: f.linkedinUrl.trim() || null,
    } satisfies MyCard),
    onSuccess: () => { toast.success('Your card is in the directory'); refresh(); setOpen(false); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const leave = useMutation({
    mutationFn: () => leaveDirectory(orgId),
    onSuccess: () => { toast.success('You left the directory'); refresh(); setOpen(false); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm text-foreground">Add your card so classmates can find you for projects and study groups. Only your college sees it.</p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Join the directory</Button>
      </div>
    );
  }
  if (isLoading) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />;
  return (
    <form className="card-glass space-y-3 rounded-2xl border border-border/40 p-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <h2 className="font-semibold">Your card</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="pc-headline">Headline</Label>
          <Input id="pc-headline" maxLength={120} placeholder="3rd year CSE · backend and DSA" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="pc-skills">Skills</Label>
          <Input id="pc-skills" placeholder="Java, Spring, SQL" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pc-bio">About you</Label>
          <Textarea id="pc-bio" rows={3} maxLength={1000} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="pc-gh">GitHub</Label>
          <Input id="pc-gh" type="url" placeholder="https://github.com/you" value={f.githubUrl} onChange={(e) => setF({ ...f, githubUrl: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="pc-li">LinkedIn</Label>
          <Input id="pc-li" type="url" placeholder="https://linkedin.com/in/you" value={f.linkedinUrl} onChange={(e) => setF({ ...f, linkedinUrl: e.target.value })} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><Switch checked={f.lookingForTeam} onCheckedChange={(v) => setF({ ...f, lookingForTeam: v })} aria-label="I'm looking for a team" />I'm looking for a team</label>
      <div className="flex flex-wrap justify-between gap-2">
        {card ? <Button type="button" variant="ghost" className="text-destructive" onClick={() => leave.mutate()}>Leave the directory</Button> : <span />}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => { setOpen(false); onDone(); }}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>Save card</Button>
        </div>
      </div>
    </form>
  );
}

// ── Teams ────────────────────────────────────────────────────────────────────


function Teams({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['community-teams', orgId, mine], queryFn: () => fetchTeams(orgId, { mine }) });
  const join = useMutation({
    mutationFn: (id: string) => askToJoinTeam(orgId, id),
    onSuccess: () => { toast.success('Request sent. The team lead will get back to you.'); qc.invalidateQueries({ queryKey: ['community-teams', orgId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant={!mine ? 'default' : 'outline'} onClick={() => setMine(false)}>All teams</Button>
          <Button size="sm" variant={mine ? 'default' : 'outline'} onClick={() => setMine(true)}>My teams</Button>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" />Start a team</Button>
      </div>
      {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
      {data && data.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          {mine ? "You're not on a team yet." : 'No teams yet. Have an idea? Start one and find people to build it with.'}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((t) => (
          <article key={t.id} className="card-glass flex flex-col rounded-2xl border border-border/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <button className="text-left font-semibold text-foreground hover:underline" onClick={() => navigate(`/community/${orgId}/teams/${t.id}`)}>{t.name}</button>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', TEAM_STATUS[t.status].tone)}>{TEAM_STATUS[t.status].label}</span>
            </div>
            {t.excerpt && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{t.excerpt}</p>}
            {t.skillsNeeded.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{t.skillsNeeded.map((s) => <Chip key={s}>{s}</Chip>)}</div>}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">{t.lead && <Avatar person={t.lead} size={6} />}{t.lead?.name ?? '—'} · {t.members}/{t.maxMembers} members</span>
              {t.myStatus === 'active' ? <Button size="sm" variant="outline" onClick={() => navigate(`/community/${orgId}/teams/${t.id}`)}>Open</Button>
                : t.myStatus === 'requested' ? <span className="font-medium">Request sent</span>
                : t.status === 'forming' || t.status === 'building'
                  ? <Button size="sm" disabled={t.members >= t.maxMembers || join.isPending} onClick={() => join.mutate(t.id)}>{t.members >= t.maxMembers ? 'Full' : 'Ask to join'}</Button>
                  : null}
            </div>
          </article>
        ))}
      </div>
      <NewTeamDialog orgId={orgId} open={creating} onOpenChange={setCreating} />
    </section>
  );
}
