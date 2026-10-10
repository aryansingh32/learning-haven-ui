import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, ExternalLink, Github, Loader2, LogOut, MessageCircle, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { MarkdownContent } from '@/features/build-haven/components/MarkdownContent';
import { Avatar, Chip, NewThreadDialog, TEAM_STATUS, ago, retryUnlessDenied, splitList } from '@/features/community/common';
import {
  acceptTeamRequest, askToJoinTeam, deleteTeam, fetchTeam, fetchThreads, removeTeamMember, updateTeam, type TeamDetail, type TeamStatus,
} from '@/services/campus.service';

export default function CommunityTeamPage() {
  const { orgId = '', teamId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ['community-team', orgId, teamId];
  const { data: team, isLoading, error } = useQuery({ queryKey: key, queryFn: () => fetchTeam(orgId, teamId), retry: retryUnlessDenied });
  const onTeam = Boolean(team?.myRole);
  const threads = useQuery({
    queryKey: ['community-threads', orgId, 'team', teamId],
    queryFn: () => fetchThreads(orgId, { teamId }),
    enabled: onTeam || Boolean(team?.canModerate),
  });
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['community-teams', orgId] }); };
  const onError = (e: Error) => toast.error(e.message);

  const join = useMutation({ mutationFn: () => askToJoinTeam(orgId, teamId, message.trim() || undefined), onSuccess: () => { toast.success('Request sent'); setMessage(''); refresh(); }, onError });
  const accept = useMutation({ mutationFn: (userId: string) => acceptTeamRequest(orgId, teamId, userId), onSuccess: refresh, onError });
  const remove = useMutation({
    mutationFn: (userId: string) => removeTeamMember(orgId, teamId, userId),
    onSuccess: (_r, userId) => { refresh(); if (userId === user?.id) navigate(`/community?college=${orgId}&tab=teams`); },
    onError,
  });
  const destroy = useMutation({ mutationFn: () => deleteTeam(orgId, teamId), onSuccess: () => { refresh(); navigate(`/community?college=${orgId}&tab=teams`); }, onError });

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error || !team) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-xl font-bold">This team is not available</h1>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/community?tab=teams')}>Back to teams</Button>
      </div>
    );
  }
  const isLead = team.myRole === 'lead';
  const full = team.members.length >= team.maxMembers;
  const open = team.status === 'forming' || team.status === 'building';

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <Link to={`/community?college=${orgId}&tab=teams`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Teams</Link>

      <header className="card-glass space-y-3 rounded-2xl border border-border/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{team.name}</h1>
            <p className="text-xs text-muted-foreground">Started {ago(team.createdAt)} · {team.members.length}/{team.maxMembers} members</p>
          </div>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', TEAM_STATUS[team.status].tone)}>{TEAM_STATUS[team.status].label}</span>
        </div>
        {editing ? <TeamEditor orgId={orgId} team={team} onDone={() => { setEditing(false); refresh(); }} /> : (
          <>
            {team.description ? <MarkdownContent content={team.description} className="prose-sm" /> : <p className="text-sm text-muted-foreground">No description yet.</p>}
            {team.skillsNeeded.length > 0 && <div className="flex flex-wrap gap-1"><span className="mr-1 text-xs text-muted-foreground">Needs</span>{team.skillsNeeded.map((s) => <Chip key={s}>{s}</Chip>)}</div>}
            <div className="flex flex-wrap gap-3 text-sm">
              {team.repoUrl && <a href={team.repoUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline"><Github className="h-4 w-4" />Code</a>}
              {team.demoUrl && <a href={team.demoUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="h-4 w-4" />Live demo</a>}
            </div>
          </>
        )}
        <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
          {isLead && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit project</Button>}
          {team.myRole && <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(isLead ? 'Leave the team? The next member becomes lead.' : 'Leave the team?')) remove.mutate(user!.id); }}><LogOut className="mr-1.5 h-3.5 w-3.5" />Leave</Button>}
          {(isLead || team.canModerate) && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm('Delete this team and its discussion?')) destroy.mutate(); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete team</Button>}
        </div>
      </header>

      {!team.myRole && (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          {team.myRequest ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>You asked to join. The lead will let you know.</span>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(user!.id)}>Withdraw request</Button>
            </div>
          ) : open && !full ? (
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); join.mutate(); }}>
              <Label htmlFor="join-msg">Ask to join</Label>
              <Textarea id="join-msg" rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What you'd bring to the team (optional)" />
              <Button type="submit" size="sm" disabled={join.isPending}>Send request</Button>
            </form>
          ) : <p className="text-sm text-muted-foreground">{full ? 'This team is full.' : 'This team is not taking new members.'}</p>}
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-[1fr_18rem]">
        <section className="space-y-3" aria-label="Team discussion">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Team discussion</h2>
            {onTeam && <Button size="sm" onClick={() => setPosting(true)}><Plus className="mr-1.5 h-4 w-4" />New thread</Button>}
          </div>
          {!onTeam && !team.canModerate ? <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">Only the team sees its discussion.</p>
            : threads.data?.length === 0 ? <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">Plan the work here: who does what, links, decisions.</p>
            : (
              <ul className="space-y-2">
                {threads.data?.map((t) => (
                  <li key={t.id}>
                    <Link to={`/community/${orgId}/threads/${t.id}`} className="block rounded-xl border border-border/40 bg-card/60 p-3 hover:border-primary/40">
                      <p className="font-medium text-foreground">{t.title}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">{t.author.name} · {ago(t.lastActivityAt)} · <MessageCircle className="h-3 w-3" />{t.replies}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <aside className="space-y-4">
          <section aria-label="Members" className="space-y-2">
            <h2 className="font-semibold">Members</h2>
            <ul className="space-y-1.5">
              {team.members.map((m) => (
                <li key={m.person.id} className="flex items-center gap-2 text-sm">
                  <Avatar person={m.person} size={6} /><span className="flex-1 truncate">{m.person.name}</span>
                  {m.role === 'lead' ? <span className="text-xs font-semibold text-primary">Lead</span>
                    : (isLead || team.canModerate) && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove ${m.person.name}`} onClick={() => { if (window.confirm(`Remove ${m.person.name}?`)) remove.mutate(m.person.id); }}><X className="h-3.5 w-3.5" /></Button>}
                </li>
              ))}
            </ul>
          </section>
          {isLead && team.requests.length > 0 && (
            <section aria-label="Requests" className="space-y-2">
              <h2 className="font-semibold">Requests</h2>
              <ul className="space-y-2">
                {team.requests.map((r) => (
                  <li key={r.person.id} className="rounded-xl border border-border/40 p-2 text-sm">
                    <div className="flex items-center gap-2"><Avatar person={r.person} size={6} /><span className="flex-1 truncate font-medium">{r.person.name}</span></div>
                    {r.message && <p className="mt-1 text-xs text-muted-foreground">"{r.message}"</p>}
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" className="h-7" disabled={full} onClick={() => accept.mutate(r.person.id)} aria-label={`Accept ${r.person.name}`}><Check className="mr-1 h-3.5 w-3.5" />Accept</Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => remove.mutate(r.person.id)} aria-label={`Decline ${r.person.name}`}>Decline</Button>
                    </div>
                  </li>
                ))}
              </ul>
              {full && <p className="text-xs text-muted-foreground">The team is full. Make it bigger in Edit project to accept more.</p>}
            </section>
          )}
        </aside>
      </div>
      {onTeam && <NewThreadDialog orgId={orgId} open={posting} onOpenChange={setPosting} teamId={teamId} />}
    </div>
  );
}

function TeamEditor({ orgId, team, onDone }: { orgId: string; team: TeamDetail; onDone: () => void }) {
  const [f, setF] = useState({ name: '', description: '', skills: '', size: '4', status: 'forming' as TeamStatus, repoUrl: '', demoUrl: '' });
  useEffect(() => {
    setF({ name: team.name, description: team.description ?? '', skills: team.skillsNeeded.join(', '), size: String(team.maxMembers),
      status: team.status, repoUrl: team.repoUrl ?? '', demoUrl: team.demoUrl ?? '' });
  }, [team]);
  const save = useMutation({
    mutationFn: () => updateTeam(orgId, team.id, {
      name: f.name.trim(), description: f.description.trim() || null, skillsNeeded: splitList(f.skills), maxMembers: Number(f.size),
      status: f.status, repoUrl: f.repoUrl.trim() || null, demoUrl: f.demoUrl.trim() || null,
    }),
    onSuccess: () => { toast.success('Saved'); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="te-name">Name</Label><Input id="te-name" required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="te-status">Stage</Label>
          <select id="te-status" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as TeamStatus })}>
            {(Object.keys(TEAM_STATUS) as TeamStatus[]).map((s) => <option key={s} value={s}>{TEAM_STATUS[s].label}</option>)}
          </select></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="te-desc">The idea and progress</Label><Textarea id="te-desc" rows={6} maxLength={4000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="te-skills">Skills needed</Label><Input id="te-skills" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="te-size">Team size</Label>
          <select id="te-size" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })}>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} people</option>)}
          </select></div>
        <div className="space-y-1.5"><Label htmlFor="te-repo">Code (https)</Label><Input id="te-repo" type="url" placeholder="https://github.com/…" value={f.repoUrl} onChange={(e) => setF({ ...f, repoUrl: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="te-demo">Live demo (https)</Label><Input id="te-demo" type="url" value={f.demoUrl} onChange={(e) => setF({ ...f, demoUrl: e.target.value })} /></div>
      </div>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onDone}>Cancel</Button><Button type="submit" disabled={save.isPending}>Save</Button></div>
    </form>
  );
}
