import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Eye, EyeOff, Flag, Loader2, MessageSquare, Pencil, Reply, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  apiErrorMessage, createPost, deletePost, editPost, fetchDiscussion, moderatePost, reportPost,
  type DiscussionPost, type ReportReason,
} from '@/data/learning';
import { cn } from '@/lib/utils';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'abuse', label: 'Abusive or harassing' },
  { value: 'off_topic', label: 'Off topic' },
  { value: 'other', label: 'Something else' },
];
const MAX = 4000;

function when(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

type Props = { chapterId: string; chapterTitle: string };

/** Per-chapter discussion: post, reply, edit/delete your own, report; staff hide. */
export function ChapterDiscussion({ chapterId, chapterTitle }: Props) {
  const qc = useQueryClient();
  const key = ['discussion', chapterId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => fetchDiscussion(chapterId), retry: false });
  const [draft, setDraft] = useState('');

  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const onError = (fallback: string) => (err: unknown) => toast.error(apiErrorMessage(err, fallback));

  const post = useMutation({
    mutationFn: () => createPost(chapterId, draft),
    onSuccess: () => {
      setDraft('');
      toast.success('Posted');
      refresh();
    },
    onError: onError('Could not post. Try again.'),
  });

  const unavailable = (error as { status?: number } | null)?.status === 503;
  const count = (data?.posts ?? []).reduce((n, p) => n + (p.deleted ? 0 : 1) + p.replies.length, 0);

  return (
    <section aria-labelledby="discussion-heading" className="rounded-2xl card-layer-2 border border-border/40 p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-orange-500" aria-hidden="true" />
        <h2 id="discussion-heading" className="text-lg font-extrabold text-foreground">Discussion</h2>
        {count > 0 && <span className="text-xs font-semibold text-muted-foreground">({count})</span>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <p className="text-sm text-muted-foreground">
          {unavailable ? 'Discussions are coming soon for this course.' : 'Could not load the discussion.'}
        </p>
      ) : (
        <>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) post.mutate();
            }}
          >
            <label htmlFor={`new-post-${chapterId}`} className="text-xs font-semibold text-muted-foreground">
              Ask a question or share a tip about “{chapterTitle}”
            </label>
            <Textarea
              id={`new-post-${chapterId}`}
              value={draft}
              maxLength={MAX}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Be kind and specific. Others in this course will see your name."
              className="min-h-[80px] text-sm"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={!draft.trim() || post.isPending} className="gap-1.5">
                {post.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Post
              </Button>
            </div>
          </form>

          {data && data.posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet. Start the conversation.</p>
          ) : (
            <ul className="space-y-3" aria-label="Posts">
              {data?.posts.map((p) => (
                <li key={p.id}>
                  <PostItem post={p} chapterId={chapterId} canModerate={Boolean(data?.can_moderate)} onChanged={refresh} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function PostItem({ post, chapterId, canModerate, onChanged, isReply = false }: {
  post: DiscussionPost; chapterId: string; canModerate: boolean; onChanged: () => void; isReply?: boolean;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'reply' | 'report' | 'confirm-delete'>('view');
  const [text, setText] = useState('');
  const [reason, setReason] = useState<ReportReason>('spam');
  const done = (msg: string) => () => {
    toast.success(msg);
    setMode('view');
    setText('');
    onChanged();
  };
  const onError = (fallback: string) => (err: unknown) => toast.error(apiErrorMessage(err, fallback));

  const edit = useMutation({ mutationFn: () => editPost(post.id, text), onSuccess: done('Post updated'), onError: onError('Could not save your edit.') });
  const reply = useMutation({ mutationFn: () => createPost(chapterId, text, post.id), onSuccess: done('Reply posted'), onError: onError('Could not post your reply.') });
  const remove = useMutation({ mutationFn: () => deletePost(post.id), onSuccess: done('Post deleted'), onError: onError('Could not delete the post.') });
  const report = useMutation({ mutationFn: () => reportPost(post.id, reason), onSuccess: done('Thanks — a moderator will take a look'), onError: onError('Could not send the report.') });
  const moderate = useMutation({
    mutationFn: (hidden: boolean) => moderatePost(post.id, hidden),
    onSuccess: (r) => done(r.hidden ? 'Post hidden' : 'Post visible again')(),
    onError: onError('Could not change the post.'),
  });

  const busy = edit.isPending || reply.isPending || remove.isPending || report.isPending || moderate.isPending;
  const action = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50';

  return (
    <article
      aria-label={post.deleted ? 'Deleted post' : `Post by ${post.author_name}`}
      className={cn('rounded-xl border p-3', isReply ? 'border-border/40 bg-background/40' : 'border-border/60 bg-background/70', post.hidden && 'border-dashed opacity-80')}
    >
      {post.deleted ? (
        <p className="text-sm italic text-muted-foreground">This post was deleted.</p>
      ) : (
        <>
          <header className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-bold text-foreground">{post.author_name}{post.mine ? ' (you)' : ''}</span>
            <span className="text-muted-foreground">{when(post.created_at)}</span>
            {post.edited_at && <span className="text-muted-foreground">· edited</span>}
            {post.hidden && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                Hidden by a moderator{post.hidden_reason ? `: ${post.hidden_reason}` : ''}
              </span>
            )}
            {canModerate && (post.open_reports ?? 0) > 0 && (
              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                {post.open_reports} report{post.open_reports === 1 ? '' : 's'}
              </span>
            )}
          </header>

          {mode === 'edit' ? (
            <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) edit.mutate(); }}>
              <label className="sr-only" htmlFor={`edit-${post.id}`}>Edit your post</label>
              <Textarea id={`edit-${post.id}`} value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} className="min-h-[70px] text-sm" />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setMode('view')}>Cancel</Button>
                <Button type="submit" size="sm" disabled={!text.trim() || busy}>Save</Button>
              </div>
            </form>
          ) : (
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground/90">{post.body}</p>
          )}

          {mode === 'view' && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {!isReply && !post.hidden && (
                <button type="button" className={action} onClick={() => { setText(''); setMode('reply'); }}><Reply className="h-3 w-3" /> Reply</button>
              )}
              {post.mine && !post.hidden && (
                <button type="button" className={action} onClick={() => { setText(post.body); setMode('edit'); }}><Pencil className="h-3 w-3" /> Edit</button>
              )}
              {(post.mine || canModerate) && (
                <button type="button" className={action} onClick={() => setMode('confirm-delete')}><Trash2 className="h-3 w-3" /> Delete</button>
              )}
              {!post.mine && (
                post.reported_by_me
                  ? <span className="px-2 py-1 text-[11px] text-muted-foreground">Reported</span>
                  : <button type="button" className={action} onClick={() => setMode('report')}><Flag className="h-3 w-3" /> Report</button>
              )}
              {canModerate && (
                <button type="button" className={action} disabled={busy} onClick={() => moderate.mutate(!post.hidden)}>
                  {post.hidden ? <><Eye className="h-3 w-3" /> Unhide</> : <><EyeOff className="h-3 w-3" /> Hide</>}
                </button>
              )}
            </div>
          )}

          {mode === 'confirm-delete' && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" role="alert">
              <span className="font-semibold">Delete this post?</span>
              <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => remove.mutate()}>Delete</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode('view')}>Keep</Button>
            </div>
          )}

          {mode === 'report' && (
            <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); report.mutate(); }}>
              <label htmlFor={`reason-${post.id}`} className="text-xs font-semibold">Why are you reporting this?</label>
              <select
                id={`reason-${post.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="h-8 rounded-lg border border-border/60 bg-background px-2 text-xs"
              >
                {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <Button type="submit" size="sm" disabled={busy}>Send report</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode('view')}>Cancel</Button>
            </form>
          )}

          {mode === 'reply' && (
            <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) reply.mutate(); }}>
              <label className="sr-only" htmlFor={`reply-${post.id}`}>Reply to {post.author_name}</label>
              <Textarea id={`reply-${post.id}`} value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} placeholder="Write a reply" className="min-h-[60px] text-sm" />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setMode('view')}>Cancel</Button>
                <Button type="submit" size="sm" disabled={!text.trim() || busy}>Reply</Button>
              </div>
            </form>
          )}
        </>
      )}

      {post.replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-border/50 pl-3" aria-label="Replies">
          {post.replies.map((r) => (
            <li key={r.id}>
              <PostItem post={r} chapterId={chapterId} canModerate={canModerate} onChanged={onChanged} isReply />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
