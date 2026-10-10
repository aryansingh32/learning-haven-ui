import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCampusMe } from '@/hooks/useCampus';
import { createTeam, createThread, reportContent, type CommunityPerson, type TeamStatus, type ThreadKind } from '@/services/campus.service';

/**
 * The college whose community is open: ?college= when the learner picked one,
 * otherwise their first college. Students only ever see their own colleges.
 */
export function useCommunityCollege(fromRoute?: string) {
  const { colleges, isLoading } = useCampusMe();
  const [params, setParams] = useSearchParams();
  const wanted = fromRoute ?? params.get('college');
  const college = colleges.find((c) => c.orgId === wanted) ?? (fromRoute ? undefined : colleges[0]);
  const choose = (orgId: string) => {
    const next = new URLSearchParams(params);
    next.set('college', orgId);
    setParams(next, { replace: true });
  };
  return { college, colleges, isLoading, choose };
}

export function Avatar({ person, size = 8 }: { person: CommunityPerson; size?: 6 | 8 | 10 }) {
  const dims = { 6: 'h-6 w-6 text-[10px]', 8: 'h-8 w-8 text-xs', 10: 'h-10 w-10 text-sm' }[size];
  return person.avatarUrl
    ? <img src={person.avatarUrl} alt="" className={cn('shrink-0 rounded-full object-cover', dims)} />
    : (
      <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary', dims)}>
        {person.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
      </span>
    );
}

export function ago(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Don't retry answers that won't change (not allowed, not found). */
export const retryUnlessDenied = (n: number, e: unknown) => ![403, 404].includes((e as { status?: number })?.status ?? 0) && n < 2;

export const splitList = (s: string) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))];

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('rounded-full border border-border/60 bg-secondary/50 px-2 py-0.5 text-xs text-muted-foreground', className)}>{children}</span>;
}

/** Ask a doubt or start a discussion — for the college, or inside one team. */
export function NewThreadDialog({ orgId, open, onOpenChange, teamId, problem, defaultKind = 'doubt' }: {
  orgId: string; open: boolean; onOpenChange: (o: boolean) => void; teamId?: string;
  problem?: { id: string; title: string } | null; defaultKind?: ThreadKind;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [kind, setKind] = useState<ThreadKind>(teamId ? 'discussion' : defaultKind);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const save = useMutation({
    mutationFn: () => createThread(orgId, { kind, title: title.trim(), body: body.trim(), tags: splitList(tags.toLowerCase()), teamId: teamId ?? null, problemId: problem?.id ?? null }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['community-threads', orgId] });
      onOpenChange(false);
      setTitle(''); setBody(''); setTags('');
      navigate(`/community/${orgId}/threads/${r.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{teamId ? 'New team thread' : kind === 'doubt' ? 'Ask your college' : 'Start a discussion'}</DialogTitle>
          <DialogDescription>
            {teamId ? 'Only your team sees this.' : 'Only students and staff of your college see this.'}
            {problem && <> About <span className="font-medium text-foreground">{problem.title}</span>.</>}
          </DialogDescription>
        </DialogHeader>
        <form id="new-thread" className="space-y-3" onSubmit={submit}>
          {!teamId && (
            <div className="flex gap-2" role="radiogroup" aria-label="Kind">
              {(['doubt', 'discussion'] as const).map((k) => (
                <Button key={k} type="button" size="sm" variant={kind === k ? 'default' : 'outline'} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>
                  {k === 'doubt' ? 'Doubt' : 'Discussion'}
                </Button>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 'doubt' ? 'Why does my solution time out on large inputs?' : 'What should we build for the hackathon?'} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-body">Details</Label>
            <Textarea id="t-body" required rows={7} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="What you tried, what happened, and where you're stuck. Markdown and ``` code blocks work." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-tags">Tags</Label>
            <Input id="t-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="arrays, dp, sql" />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="new-thread" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Post</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewTeamDialog({ orgId, open, onOpenChange }: { orgId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', description: '', skills: '', size: '4' });
  const save = useMutation({
    mutationFn: () => createTeam(orgId, { name: f.name.trim(), description: f.description.trim() || null, skillsNeeded: splitList(f.skills), maxMembers: Number(f.size) }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['community-teams', orgId] });
      onOpenChange(false);
      navigate(`/community/${orgId}/teams/${r.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Start a team</DialogTitle>
          <DialogDescription>Describe what you want to build. Classmates ask to join and you choose who's in.</DialogDescription>
        </DialogHeader>
        <form id="new-team" className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="tm-name">Team or project name</Label>
            <Input id="tm-name" required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tm-desc">The idea</Label>
            <Textarea id="tm-desc" rows={5} maxLength={4000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })}
              placeholder="What problem it solves, what you have so far, and how much time it needs." />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div className="space-y-1.5">
              <Label htmlFor="tm-skills">Skills you need</Label>
              <Input id="tm-skills" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} placeholder="React, Node, UI design" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-size">Team size</Label>
              <select id="tm-size" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })}>
                {[2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n} people</option>)}
              </select>
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="new-team" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create team</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Flag a thread or reply for the college's moderators. */
export function ReportDialog({ orgId, target, onClose }: { orgId: string; target: { threadId?: string; postId?: string } | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const send = useMutation({
    mutationFn: () => reportContent(orgId, { ...target, reason: reason.trim() }),
    onSuccess: () => { toast.success('Reported. Moderators from your college will take a look.'); setReason(''); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report this {target?.postId ? 'reply' : 'thread'}</DialogTitle>
          <DialogDescription>Tell your college's moderators what's wrong. The author isn't told who reported it.</DialogDescription>
        </DialogHeader>
        <form id="report" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
          <Label htmlFor="report-reason">Reason</Label>
          <Textarea id="report-reason" className="mt-1.5" rows={3} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Rude, spam, sharing exam answers…" />
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="report" disabled={reason.trim().length < 3 || send.isPending}>Report</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const TEAM_STATUS: Record<TeamStatus, { label: string; tone: string }> = {
  forming: { label: 'Looking for members', tone: 'bg-success/10 text-success' },
  building: { label: 'Building', tone: 'bg-primary/10 text-primary' },
  shipped: { label: 'Shipped', tone: 'bg-reward/10 text-reward' },
  archived: { label: 'Archived', tone: 'bg-secondary text-muted-foreground' },
};
