import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { EyeOff, Pin } from 'lucide-react';
import { api, post } from '@/api/client';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';

interface Person { id: string; name: string }
interface Report {
  id: string; reason: string; createdAt: string; threadId: string; postId: string | null; threadTitle: string;
  excerpt: string; hidden: boolean; reporter: Person; author: Person;
}
interface Thread {
  id: string; kind: 'doubt' | 'discussion'; title: string; excerpt: string; pinned: boolean; hidden: boolean;
  solved: boolean; replies: number; lastActivityAt: string; author: Person;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Students' community, seen by moderators: reports to handle, and the latest threads to pin
 * or hide. Students post from the Forge app; nothing here edits what they wrote.
 */
export default function Community() {
  const { orgId } = useParams();
  const qc = useQueryClient();
  const base = `/community/${orgId}`;
  const reports = useQuery({ queryKey: ['community-reports', orgId], queryFn: () => api<Report[]>(`${base}/reports`) });
  const threads = useQuery({ queryKey: ['community-threads', orgId], queryFn: () => api<Thread[]>(`${base}/threads`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['community-reports', orgId] }); qc.invalidateQueries({ queryKey: ['community-threads', orgId] }); };
  const onError = (e: Error) => toast.error(e.message);
  const resolve = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'hide' | 'dismiss' }) => post(`${base}/reports/${id}/resolve`, { action }),
    onSuccess: (_r, v) => { toast.success(v.action === 'hide' ? 'Hidden from students' : 'Report dismissed'); refresh(); },
    onError,
  });
  const moderate = useMutation({
    mutationFn: ({ id, ...m }: { id: string; hidden?: boolean; pinned?: boolean }) => post(`${base}/threads/${id}/moderate`, m),
    onSuccess: refresh,
    onError,
  });

  return (
    <>
      <PageHeader title="Community" description="Your students' doubts, discussions and project teams. Handle what they report; pin what helps everyone." />

      <section className="mb-8">
        <h2 className="mb-3 font-medium">Reports {reports.data && reports.data.length > 0 && <span className="ml-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{reports.data.length}</span>}</h2>
        {reports.isLoading ? <Loading /> : reports.error ? <ErrorNote error={reports.error} /> : reports.data!.length === 0 ? (
          <EmptyState title="Nothing reported">When a student reports a thread or reply, it shows up here.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {reports.data!.map((r) => (
              <li key={r.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.postId ? 'Reply in' : 'Thread'} “{r.threadTitle}” by {r.author.name}</p>
                    <p className="text-xs text-muted-foreground">Reported by {r.reporter.name} · {when(r.createdAt)}{r.hidden && ' · already hidden'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, action: 'hide' })}>Hide it</Button>
                    <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, action: 'dismiss' })}>Dismiss</Button>
                  </div>
                </div>
                <p className="mt-2 rounded bg-secondary/60 p-2 text-sm whitespace-pre-wrap">{r.excerpt}</p>
                <p className="mt-2 text-sm"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">Latest threads</h2>
        {threads.isLoading ? <Loading /> : threads.error ? <ErrorNote error={threads.error} /> : threads.data!.length === 0 ? (
          <EmptyState title="No threads yet">Students ask doubts and start discussions from the Forge app.</EmptyState>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2">Thread</th><th className="px-3 py-2">By</th><th className="px-3 py-2">Replies</th><th className="px-3 py-2">Last activity</th><th className="px-3 py-2" /></tr>
              </thead>
              <tbody>
                {threads.data!.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{t.pinned && <Pin className="mr-1 inline h-3.5 w-3.5 text-primary" aria-label="Pinned" />}{t.title}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{t.kind === 'doubt' ? (t.solved ? 'Answered doubt' : 'Open doubt') : 'Discussion'}{t.hidden && ' · hidden'} · {t.excerpt}</p>
                    </td>
                    <td className="px-3 py-2">{t.author.name}</td>
                    <td className="px-3 py-2">{t.replies}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{when(t.lastActivityAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" aria-label={`${t.pinned ? 'Unpin' : 'Pin'} ${t.title}`} onClick={() => moderate.mutate({ id: t.id, pinned: !t.pinned })}><Pin className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" aria-label={`${t.hidden ? 'Unhide' : 'Hide'} ${t.title}`} onClick={() => moderate.mutate({ id: t.id, hidden: !t.hidden })}><EyeOff className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
