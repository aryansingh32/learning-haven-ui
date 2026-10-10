import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, EyeOff, Flag, Loader2, Pencil, Pin, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownContent } from '@/features/build-haven/components/MarkdownContent';
import { Avatar, Chip, ReportDialog, ago, retryUnlessDenied } from '@/features/community/common';
import {
  deletePost, deleteThread, fetchThread, moderatePost, moderateThread, replyToThread, updatePost, updateThread,
  type ThreadPost,
} from '@/services/campus.service';

export default function CommunityThreadPage() {
  const { orgId = '', threadId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const key = ['community-thread', orgId, threadId];
  const { data: t, isLoading, error } = useQuery({ queryKey: key, queryFn: () => fetchThread(orgId, threadId), retry: retryUnlessDenied });
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '' });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['community-threads', orgId] }); };
  const onError = (e: Error) => toast.error(e.message);

  const send = useMutation({ mutationFn: () => replyToThread(orgId, threadId, reply.trim()), onSuccess: () => { setReply(''); refresh(); }, onError });
  const mark = useMutation({ mutationFn: (postId: string | null) => updateThread(orgId, threadId, { solvedPostId: postId }), onSuccess: refresh, onError });
  const saveEdit = useMutation({ mutationFn: () => updateThread(orgId, threadId, { title: draft.title.trim(), body: draft.body.trim() }), onSuccess: () => { setEditing(false); refresh(); }, onError });
  const remove = useMutation({ mutationFn: () => deleteThread(orgId, threadId), onSuccess: () => { qc.invalidateQueries({ queryKey: ['community-threads', orgId] }); navigate(back); }, onError });
  const moderate = useMutation({ mutationFn: (m: { hidden?: boolean; pinned?: boolean }) => moderateThread(orgId, threadId, m), onSuccess: refresh, onError });
  const [reporting, setReporting] = useState<{ threadId?: string; postId?: string } | null>(null);

  const back = t?.teamId ? `/community/${orgId}/teams/${t.teamId}` : `/community?college=${orgId}`;
  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error || !t) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-xl font-bold">This thread is not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been removed, or it belongs to a team you're not on.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/community')}>Back to Community</Button>
      </div>
    );
  }

  const answer = t.posts.find((p) => p.id === t.solvedPostId);
  const others = t.posts.filter((p) => p.id !== t.solvedPostId);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <Link to={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />{t.teamName ? t.teamName : 'Community'}
      </Link>

      <article className="card-glass space-y-3 rounded-2xl border border-border/40 p-5">
        <div className="flex items-start gap-3">
          <Avatar person={t.author} size={10} />
          <div className="min-w-0 flex-1">
            {editing ? (
              <input aria-label="Title" className="w-full rounded-md border border-input bg-background px-3 py-2 font-semibold" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            ) : (
              <h1 className="flex flex-wrap items-center gap-2 font-display text-xl font-bold text-foreground">
                {t.pinned && <Pin className="h-4 w-4 text-primary" aria-label="Pinned" />}{t.title}
                {t.kind === 'doubt' && answer && <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success"><CheckCircle2 className="h-3 w-3" />Answered</span>}
              </h1>
            )}
            <p className="text-xs text-muted-foreground">{t.author.name} · {ago(t.createdAt)}{t.editedAt && ' · edited'}{t.hidden && ' · hidden by a moderator'}</p>
          </div>
        </div>
        {(t.problemSlug || t.tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {t.problemSlug && <Link to={`/problems/${t.problemSlug}`}><Chip className="hover:text-foreground">Problem: {t.problemTitle}</Chip></Link>}
            {t.tags.map((g) => <Chip key={g}>#{g}</Chip>)}
          </div>
        )}
        {editing
          ? <Textarea aria-label="Details" rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          : <MarkdownContent content={t.body} className="prose-sm" />}
        <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
          {t.mine && !editing && <Button size="sm" variant="ghost" onClick={() => { setDraft({ title: t.title, body: t.body }); setEditing(true); }}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>}
          {editing && <><Button size="sm" onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></>}
          {(t.mine || t.canModerate) && !editing && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm('Delete this thread and its replies?')) remove.mutate(); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>
          )}
          {!t.mine && <Button size="sm" variant="ghost" onClick={() => setReporting({ threadId: t.id })}><Flag className="mr-1.5 h-3.5 w-3.5" />Report</Button>}
          {t.canModerate && <>
            <Button size="sm" variant="ghost" onClick={() => moderate.mutate({ pinned: !t.pinned })}><Pin className="mr-1.5 h-3.5 w-3.5" />{t.pinned ? 'Unpin' : 'Pin'}</Button>
            <Button size="sm" variant="ghost" onClick={() => moderate.mutate({ hidden: !t.hidden })}><EyeOff className="mr-1.5 h-3.5 w-3.5" />{t.hidden ? 'Unhide' : 'Hide'}</Button>
          </>}
        </div>
      </article>

      <section aria-label="Replies" className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t.posts.length} {t.posts.length === 1 ? 'reply' : 'replies'}</h2>
        {answer && <Post key={answer.id} orgId={orgId} p={answer} isAnswer canMark={t.mine && t.kind === 'doubt'} canModerate={t.canModerate} onMark={() => mark.mutate(null)} onChanged={refresh} onReport={() => setReporting({ postId: answer.id })} />}
        {others.map((p) => (
          <Post key={p.id} orgId={orgId} p={p} isAnswer={false} canMark={t.mine && t.kind === 'doubt' && !p.mine} canModerate={t.canModerate}
            onMark={() => mark.mutate(p.id)} onChanged={refresh} onReport={() => setReporting({ postId: p.id })} />
        ))}
      </section>

      {!t.hidden && (
        <form className="card-glass space-y-2 rounded-2xl border border-border/40 p-4" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) send.mutate(); }}>
          <label htmlFor="reply" className="text-sm font-medium">Your reply</label>
          <Textarea id="reply" rows={4} maxLength={20000} value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder={t.kind === 'doubt' ? 'Explain the idea, not just the code — that helps everyone learn.' : 'Add to the discussion'} />
          <div className="flex justify-end"><Button type="submit" disabled={!reply.trim() || send.isPending}>{send.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reply</Button></div>
        </form>
      )}
      <ReportDialog orgId={orgId} target={reporting} onClose={() => setReporting(null)} />
    </div>
  );
}

function Post({ orgId, p, isAnswer, canMark, canModerate, onMark, onChanged, onReport }: {
  orgId: string; p: ThreadPost; isAnswer: boolean; canMark: boolean; canModerate: boolean;
  onMark: () => void; onChanged: () => void; onReport: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(p.body);
  const onError = (e: Error) => toast.error(e.message);
  const save = useMutation({ mutationFn: () => updatePost(orgId, p.id, body.trim()), onSuccess: () => { setEditing(false); onChanged(); }, onError });
  const remove = useMutation({ mutationFn: () => deletePost(orgId, p.id), onSuccess: onChanged, onError });
  const hide = useMutation({ mutationFn: () => moderatePost(orgId, p.id, !p.hidden), onSuccess: onChanged, onError });
  return (
    <article className={cn('rounded-2xl border p-4', isAnswer ? 'border-success/40 bg-success/5' : 'border-border/40 bg-card/60')}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Avatar person={p.author} size={6} />
        <span className="font-medium text-foreground">{p.author.name}</span><span>· {ago(p.createdAt)}{p.editedAt && ' · edited'}</span>
        {isAnswer && <span className="inline-flex items-center gap-1 font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" />Marked as the answer</span>}
        {p.hidden && <span className="font-semibold text-destructive">Hidden by a moderator</span>}
      </div>
      {editing
        ? <Textarea aria-label="Edit reply" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        : <MarkdownContent content={p.body} className="prose-sm" />}
      <div className="mt-2 flex flex-wrap gap-1">
        {canMark && <Button size="sm" variant="ghost" onClick={onMark}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />{isAnswer ? 'Unmark answer' : 'Mark as answer'}</Button>}
        {p.mine && !editing && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>}
        {editing && <><Button size="sm" onClick={() => save.mutate()} disabled={!body.trim()}>Save</Button><Button size="sm" variant="ghost" onClick={() => { setEditing(false); setBody(p.body); }}>Cancel</Button></>}
        {(p.mine || canModerate) && !editing && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm('Delete this reply?')) remove.mutate(); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>}
        {!p.mine && <Button size="sm" variant="ghost" onClick={onReport}><Flag className="mr-1.5 h-3.5 w-3.5" />Report</Button>}
        {canModerate && <Button size="sm" variant="ghost" onClick={() => hide.mutate()}><EyeOff className="mr-1.5 h-3.5 w-3.5" />{p.hidden ? 'Unhide' : 'Hide'}</Button>}
      </div>
    </article>
  );
}
