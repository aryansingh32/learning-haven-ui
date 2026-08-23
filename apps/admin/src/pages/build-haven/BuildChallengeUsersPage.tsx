import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildHavenAdminApi } from '@/services/build-haven.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Users, Search, CheckCircle, ArrowRight, ExternalLink, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function relativeTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function truncateUrl(url?: string, maxLen = 35): string {
  if (!url) return '—';
  try {
    const u = new URL(url);
    const short = u.host + u.pathname;
    return short.length > maxLen ? short.slice(0, maxLen) + '…' : short;
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + '…' : url;
  }
}

function userInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                    */
/* ------------------------------------------------------------------ */

export default function BuildChallengeUsersPage() {
  const qc = useQueryClient();
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [passDialog, setPassDialog] = useState<{
    open: boolean;
    enrollmentId: string;
    stageId: string;
    userName: string;
  }>({ open: false, enrollmentId: '', stageId: '', userName: '' });

  /* ---- Challenges list ---- */
  const challengesQuery = useQuery({
    queryKey: ['admin-build-challenges'],
    queryFn: () => buildHavenAdminApi.listChallenges(),
  });

  const challenges = challengesQuery.data?.challenges || [];

  /* ---- Enrollments for selected challenge ---- */
  const enrollmentsQuery = useQuery({
    queryKey: ['admin-build-enrollments', selectedChallengeId, search],
    queryFn: () =>
      buildHavenAdminApi.getEnrollments(selectedChallengeId, {
        ...(search ? { search } : {}),
      }),
    enabled: Boolean(selectedChallengeId),
    refetchInterval: 15000,
  });

  const enrollments = useMemo(() => {
    const items = enrollmentsQuery.data?.enrollments || [];
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter((e: any) => {
      const haystack = `${e.user?.full_name || ''} ${e.user?.email || ''} ${e.language || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [enrollmentsQuery.data?.enrollments, search]);

  /* ---- Manual pass stage mutation ---- */
  const passStage = useMutation({
    mutationFn: ({ enrollmentId, stageId }: { enrollmentId: string; stageId: string }) =>
      buildHavenAdminApi.manualPassStage(enrollmentId, stageId),
    onSuccess: () => {
      toast.success('Stage passed successfully');
      setPassDialog({ open: false, enrollmentId: '', stageId: '', userName: '' });
      qc.invalidateQueries({ queryKey: ['admin-build-enrollments', selectedChallengeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedChallenge = challenges.find((c: any) => c.id === selectedChallengeId);

  /* ---- Derived stats ---- */
  const stats = useMemo(() => {
    const total = enrollments.length;
    const completed = enrollments.filter((e: any) => e.status === 'completed').length;
    const inProgress = enrollments.filter((e: any) => e.status === 'in_progress').length;
    return { total, completed, inProgress };
  }, [enrollments]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Build Challenge Users</h1>
            <p className="text-sm text-muted-foreground">
              Monitor enrolled users, track progress, and manage stage completions.
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={selectedChallengeId} onValueChange={setSelectedChallengeId}>
          <SelectTrigger className="w-full sm:w-[320px]">
            <SelectValue placeholder="Select a challenge…" />
          </SelectTrigger>
          <SelectContent>
            {challengesQuery.isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : challenges.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">No challenges found</div>
            ) : (
              challenges.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    {c.title}
                    <Badge variant="outline" className="ml-1 text-[10px] capitalize">
                      {c.status}
                    </Badge>
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {selectedChallengeId && (
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-9"
            />
          </div>
        )}
      </div>

      {/* Empty state: no challenge selected */}
      {!selectedChallengeId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Select a Challenge</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Choose a build challenge from the dropdown above to view all enrolled users and their
              progress.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats summary */}
      {selectedChallengeId && !enrollmentsQuery.isLoading && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Enrolled</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <ArrowRight className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Enrollments table */}
      {selectedChallengeId && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Enrollments
              {selectedChallenge && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — {selectedChallenge.title}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              All users enrolled in this challenge with their current progress and status.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="min-w-[120px]">Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Repo / Submission</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollmentsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading enrollments…</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : enrollmentsQuery.isError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Shield className="h-6 w-6 text-destructive" />
                        <span className="text-sm text-destructive">
                          Failed to load enrollments. Please try again.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : enrollments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-6 w-6 text-muted-foreground/50" />
                        <span className="text-sm text-muted-foreground">
                          {search
                            ? 'No users match your search.'
                            : 'No enrollments found for this challenge.'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  enrollments.map((enrollment: any) => {
                    const currentStage = enrollment.current_stage_number ?? enrollment.current_stage ?? 0;
                    const totalStages = enrollment.total_stages ?? 0;
                    const progressPct =
                      totalStages > 0 ? Math.round((currentStage / totalStages) * 100) : 0;
                    const userName = enrollment.user?.full_name || enrollment.user_name || 'Unknown';
                    const avatarUrl = enrollment.user?.avatar_url;

                    return (
                      <TableRow key={enrollment.id} className="group">
                        {/* User */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={userName}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {userInitials(userName)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium truncate">{userName}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {enrollment.user?.email || ''}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Language */}
                        <TableCell>
                          <Badge variant="secondary" className="capitalize text-[11px]">
                            {enrollment.language || '—'}
                          </Badge>
                        </TableCell>

                        {/* Current / Total Stages */}
                        <TableCell>
                          <span className="text-sm font-medium">
                            {currentStage}
                            <span className="text-muted-foreground"> / {totalStages}</span>
                          </span>
                        </TableCell>

                        {/* Progress */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={progressPct} className="h-2 flex-1" />
                            <span className="text-xs font-medium text-muted-foreground w-9 text-right">
                              {progressPct}%
                            </span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              enrollment.status === 'completed'
                                ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
                                : enrollment.status === 'in_progress'
                                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  : ''
                            }
                          >
                            {enrollment.status === 'in_progress'
                              ? 'In Progress'
                              : enrollment.status === 'completed'
                                ? 'Completed'
                                : enrollment.status || '—'}
                          </Badge>
                        </TableCell>

                        {/* Repo URL */}
                        <TableCell>
                          {enrollment.repo_url ? (
                            <a
                              href={enrollment.repo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <span className="truncate max-w-[180px] inline-block">
                                {truncateUrl(enrollment.repo_url)}
                              </span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Last Activity */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {relativeTime(enrollment.updated_at || enrollment.last_activity_at)}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          {enrollment.status !== 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                              onClick={() =>
                                setPassDialog({
                                  open: true,
                                  enrollmentId: enrollment.id,
                                  stageId: 'current',
                                  userName,
                                })
                              }
                            >
                              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                              Pass Stage
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirmation dialog */}
      <Dialog
        open={passDialog.open}
        onOpenChange={(open) =>
          setPassDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manually Pass Stage</DialogTitle>
            <DialogDescription>
              Are you sure you want to manually pass the current stage for{' '}
              <span className="font-semibold text-foreground">{passDialog.userName}</span>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPassDialog({ open: false, enrollmentId: '', stageId: '', userName: '' })}
              disabled={passStage.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                passStage.mutate({
                  enrollmentId: passDialog.enrollmentId,
                  stageId: passDialog.stageId,
                })
              }
              disabled={passStage.isPending}
              className="gradient-primary text-white"
            >
              {passStage.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm Pass
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
