import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apprenticeshipApi } from '../../services/apprenticeship.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const statuses = ['all', 'pending', 'testing', 'passed', 'failed', 'manual_review'] as const;

const badgeClass = (status: string) => {
  if (status.includes('pass')) return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100';
  if (status.includes('fail')) return 'bg-rose-100 text-rose-800 hover:bg-rose-100';
  if (status === 'testing') return 'bg-sky-100 text-sky-800 hover:bg-sky-100';
  if (status === 'manual_review') return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
  return 'bg-zinc-100 text-zinc-700 hover:bg-zinc-100';
};

const SubmissionsPage = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'passed' | 'failed'>('passed');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [qualityOverride, setQualityOverride] = useState('');
  const [xpBonus, setXpBonus] = useState('0');

  const { data, isLoading } = useQuery({
    queryKey: ['apprenticeship-admin-submissions', status],
    queryFn: () => apprenticeshipApi.listSubmissions(status === 'all' ? {} : { status }),
    refetchInterval: 10000,
  });

  const reviewMutation = useMutation({
    mutationFn: (submissionId: string) => apprenticeshipApi.reviewSubmission(submissionId, {
      status: reviewStatus,
      reviewer_notes: reviewerNotes,
      code_quality_override: qualityOverride ? Number(qualityOverride) : null,
      xp_bonus: Number(xpBonus || 0),
    }),
    onSuccess: () => {
      toast.success('Review saved');
      void queryClient.invalidateQueries({ queryKey: ['apprenticeship-admin-submissions'] });
      setReviewerNotes('');
      setQualityOverride('');
      setXpBonus('0');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save review'),
  });

  const submissions = useMemo(() => {
    const items = data?.submissions || [];
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter((item: any) => {
      const student = `${item.users?.full_name || ''} ${item.users?.email || ''}`.toLowerCase();
      const program = `${item.apprenticeship_enrollments?.apprenticeship_programs?.title || ''}`.toLowerCase();
      const project = `${item.apprenticeship_projects?.title || ''}`.toLowerCase();
      return student.includes(term) || program.includes(term) || project.includes(term);
    });
  }, [data?.submissions, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Submissions</h2>
        <p className="text-muted-foreground">Review live verification attempts and apply manual overrides.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {statuses.map((item) => (
          <Button key={item} variant={status === item ? 'default' : 'outline'} size="sm" onClick={() => setStatus(item)}>
            {item.replace('_', ' ')}
          </Button>
        ))}
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by student, program, or project"
          className="max-w-sm"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_420px]">
        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No submissions found.
                    </TableCell>
                  </TableRow>
                ) : submissions.map((submission: any) => (
                  <TableRow
                    key={submission.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(submission)}
                  >
                    <TableCell>
                      <div className="font-medium">{submission.users?.full_name || 'Unknown student'}</div>
                      <div className="text-xs text-muted-foreground">{submission.users?.email}</div>
                    </TableCell>
                    <TableCell>{submission.apprenticeship_enrollments?.apprenticeship_programs?.title || '—'}</TableCell>
                    <TableCell>{submission.apprenticeship_projects?.title || '—'}</TableCell>
                    <TableCell>
                      <Badge className={badgeClass(submission.verification_status)} variant="outline">
                        {submission.verification_status}
                      </Badge>
                    </TableCell>
                    <TableCell>#{submission.attempt_number}</TableCell>
                    <TableCell>{submission.code_quality_override || submission.code_quality_score || '—'}</TableCell>
                    <TableCell>{new Date(submission.submitted_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>{selected ? 'Submission Review' : 'Select a submission'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Choose a row to inspect stage failures, console output, and manual override controls.</p>
            ) : (
              <>
                <div>
                  <p className="font-semibold">{selected.users?.full_name || 'Unknown student'}</p>
                  <p className="text-sm text-muted-foreground">{selected.apprenticeship_projects?.title || 'Project'}</p>
                </div>

                <div className="rounded-lg border p-3 text-sm">
                  <p><span className="font-medium">Repo:</span> {selected.github_repo_full_name || '—'}</p>
                  <p><span className="font-medium">Commit:</span> {selected.commit_hash || '—'}</p>
                  <p><span className="font-medium">Code quality:</span> {selected.code_quality_override || selected.code_quality_score || '—'}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Failures</p>
                  {Array.isArray(selected.failed_tests) && selected.failed_tests.length > 0 ? (
                    selected.failed_tests.map((failure: any, index: number) => (
                      <div key={index} className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
                        <p className="font-medium text-rose-800">{failure.name || `Failure ${index + 1}`}</p>
                        <p className="text-rose-700">{failure.error || 'Unknown error'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No failed stage details recorded.</p>
                  )}
                </div>

                <div className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
                  <pre className="whitespace-pre-wrap">{selected.console_output_tail || 'No console output captured.'}</pre>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex gap-2">
                    <Button variant={reviewStatus === 'passed' ? 'default' : 'outline'} size="sm" onClick={() => setReviewStatus('passed')}>
                      Mark Passed
                    </Button>
                    <Button variant={reviewStatus === 'failed' ? 'default' : 'outline'} size="sm" onClick={() => setReviewStatus('failed')}>
                      Mark Failed
                    </Button>
                  </div>
                  <textarea
                    value={reviewerNotes}
                    onChange={(event) => setReviewerNotes(event.target.value)}
                    className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Reviewer notes"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={qualityOverride} onChange={(event) => setQualityOverride(event.target.value)} placeholder="Quality override" />
                    <Input value={xpBonus} onChange={(event) => setXpBonus(event.target.value)} placeholder="XP bonus" />
                  </div>
                  <Button
                    onClick={() => reviewMutation.mutate(selected.id)}
                    disabled={reviewMutation.isPending}
                    className="w-full"
                  >
                    {reviewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Review
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubmissionsPage;
