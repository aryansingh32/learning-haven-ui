import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { buildHavenService } from '@/services/build-haven.service';
import { useAuth } from '@/context/AuthContext';
import { MarkdownContent } from '@/components/build-haven/MarkdownContent';
import { BuildStageSidebar } from '@/components/build-haven/BuildStageSidebar';
import { BuildTestRunner } from '@/components/build-haven/BuildTestRunner';
import { BuildLeaderboardPanel } from '@/components/build-haven/BuildLeaderboardPanel';
import { BuildRepoSetup } from '@/components/build-haven/BuildRepoSetup';
import { BuildWorkspaceTopBar } from '@/components/build-haven/BuildWorkspaceTopBar';
import { BuildDifficultyBadge } from '@/components/build-haven/BuildDifficultyBadge';
import { BuildExampleGate } from '@/components/build-haven/BuildExampleGate';
import { buildGitHubReturnPath, handleGitHubOAuthReturn, stripGitHubOAuthParams } from '@/lib/githubOAuth';
import { apprenticeshipService } from '@/services/apprenticeship.service';
import { stageStatus } from '@/components/build-haven/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Loader2, Copy, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';

type ViewMode = 'setup' | number;

export default function BuildWorkspacePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const languageFromUrl = searchParams.get('language') || undefined;
  const { user } = useAuth();
  const qc = useQueryClient();

  const [viewModeState, setViewModeState] = useState<ViewMode | null>(() => {
    const stageFromUrl = searchParams.get('stage');
    if (stageFromUrl === 'setup') return 'setup';
    if (stageFromUrl && !isNaN(parseInt(stageFromUrl, 10))) return parseInt(stageFromUrl, 10);
    return null;
  });

  const setViewMode = useCallback((mode: ViewMode | null) => {
    setViewModeState(mode);
    setSearchParams(prev => {
      if (mode !== null) prev.set('stage', mode.toString());
      else prev.delete('stage');
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const viewMode = viewModeState;
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeCommitHash, setActiveCommitHash] = useState<string | null>(null);
  const [showLogsOpen, setShowLogsOpen] = useState(false);
  const celebratedRef = useRef<Set<number>>(new Set());
  const [dismissedOverlayStages, setDismissedOverlayStages] = useState<Set<number>>(new Set());
  const [mainTab, setMainTab] = useState('instructions');
  const [exampleGateOpen, setExampleGateOpen] = useState(false);
  const [examplesUnlocked, setExamplesUnlocked] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const workspaceQuery = useQuery({
    queryKey: ['build-workspace', slug, languageFromUrl],
    queryFn: () => buildHavenService.getWorkspace(slug, { language: languageFromUrl }),
    enabled: Boolean(slug),
    refetchInterval: 8000,
  });

  const workspace = workspaceQuery.data?.workspace;
  const challenge = workspace?.challenge;
  const enrollment = workspace?.enrollment;
  const attempts = workspace?.attempts || [];

  const leaderboardQuery = useQuery({
    queryKey: ['build-leaderboard', slug, workspace?.enrollment?.language],
    queryFn: () =>
      buildHavenService.getLeaderboard(slug, {
        language: workspace?.enrollment?.language,
      }),
    enabled: Boolean(slug && workspace?.enrollment?.language),
  });

  const languageConfig = useMemo(
    () => (challenge?.languages || []).find((item: { language: string }) => item.language === enrollment?.language),
    [challenge?.languages, enrollment?.language]
  );

  const stagesSorted = useMemo(
    () => [...(challenge?.stages || [])].sort((a: { stage_number: number }, b: { stage_number: number }) => a.stage_number - b.stage_number),
    [challenge?.stages]
  );

  const activeView: ViewMode = viewMode ?? enrollment?.current_stage ?? stagesSorted[0]?.stage_number ?? 'setup';

  const viewedStage = useMemo(() => {
    if (activeView === 'setup') return null;
    return stagesSorted.find((s: { stage_number: number }) => s.stage_number === activeView);
  }, [stagesSorted, activeView]);

  const hints: string[] = Array.isArray(viewedStage?.hints) ? viewedStage.hints : [];
  const stageAttempts = useMemo(() => {
    if (typeof activeView !== 'number') return [];
    return attempts.filter((a: any) => a.build_stages?.stage_number === activeView);
  }, [attempts, activeView]);

  const lastResult = stageAttempts[0];
  const structured = (lastResult?.structured_feedback || {}) as Record<string, unknown>;
  const verdict = String(structured.verdict || lastResult?.status || 'pending');

  const isViewingTestTarget =
    enrollment && viewedStage && viewedStage.stage_number === enrollment.current_stage;

  const nextStage = useMemo(() => {
    if (!enrollment || activeView === 'setup') return null;
    return stagesSorted.find((s: { stage_number: number }) => s.stage_number === enrollment.current_stage + 1);
  }, [stagesSorted, enrollment, activeView]);

  const userRank = useMemo(() => {
    const rows = leaderboardQuery.data?.leaderboard || [];
    const idx = rows.findIndex((r: { user_id: string }) => r.user_id === user?.id);
    return idx >= 0 ? idx + 1 : null;
  }, [leaderboardQuery.data?.leaderboard, user?.id]);

  useEffect(() => {
    setHintsRevealed(0);
    setShowSolution(false);
    setExamplesUnlocked(false);
    setMainTab('instructions');
  }, [activeView]);

  useEffect(() => {
    handleGitHubOAuthReturn(location.search);
    if (location.search.includes('github_connected')) {
      const clean = stripGitHubOAuthParams(location.search);
      navigate(`${location.pathname}${clean}`, { replace: true });
      void workspaceQuery.refetch();
    }
  }, [location.search, location.pathname, navigate, workspaceQuery]);

  const invalidateWorkspace = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['build-workspace', slug, languageFromUrl] });
    void qc.invalidateQueries({ queryKey: ['build-leaderboard', slug] });
  }, [qc, slug, languageFromUrl]);

  // Realtime subscription
  useEffect(() => {
    if (!enrollment?.id) return;
    const unsubscribe = buildHavenService.subscribeToEnrollmentEvents(enrollment.id, (event) => {
      if (event.type === 'attempt_started' || event.type === 'verification_started' || event.type === 'verification_queued') {
        setIsVerifying(true);
        if (event.payload?.commitHash) setActiveCommitHash(event.payload.commitHash as string);
      } else if (event.type === 'stage_result' || event.type === 'verification_complete') {
        setIsVerifying(false);
        setActiveCommitHash(null);
        if (event.type === 'stage_result' && event.payload?.status === 'passed') {
          const passedStageNum = event.payload?.stage_number as number | undefined;
          if (passedStageNum) {
            setDismissedOverlayStages(prev => new Set(prev).add(passedStageNum));
          }
          const celebratedStages: number[] = enrollment.celebrated_stages || [];
          if (
            passedStageNum &&
            !celebratedStages.includes(passedStageNum) &&
            !celebratedRef.current.has(passedStageNum)
          ) {
            celebratedRef.current.add(passedStageNum);
            confetti({
              particleCount: 120,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#f97316', '#eab308', '#22c55e', '#3b82f6'],
            });
            buildHavenService.celebrateStage(slug, passedStageNum).catch(() => {
              // silently ignore celebrate failures
            });
          }
        }
        invalidateWorkspace();
      }
    });
    return () => unsubscribe();
  }, [enrollment?.id, enrollment?.celebrated_stages, invalidateWorkspace, slug]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  if (workspaceQuery.isLoading || !challenge) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stageStatusForView = viewedStage ? stageStatus(viewedStage.stage_number, enrollment) : null;
  const rankHint =
    userRank && enrollment
      ? `Complete this stage to hit #${Math.max(1, userRank - 1)}`
      : undefined;

  const enrollmentStatus = enrollment?.status === 'completed' ? 'completed' : enrollment ? 'in_progress' : null;

  const handleMainTabChange = (value: string) => {
    if (
      value === 'examples' &&
      viewedStage &&
      stageStatusForView !== 'completed' &&
      !examplesUnlocked
    ) {
      setExampleGateOpen(true);
      return;
    }
    setMainTab(value);
  };

  const connectGitHubFromWorkspace = async () => {
    try {
      const data = await apprenticeshipService.getGithubAuthUrl(
        buildGitHubReturnPath(location.pathname, location.search)
      );
      if (data?.url) window.location.href = data.url;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to start GitHub connection');
    }
  };

  return (
    <div className="flex h-screen flex-col bg-depth text-foreground">
      {/* Top bar */}
      <BuildWorkspaceTopBar
        slug={slug}
        title={challenge.title}
        language={enrollment?.language}
        stageLabel={activeView === 'setup' ? 'Local setup' : viewedStage?.title}
        statusBadge={enrollmentStatus}
        repoUrl={enrollment?.repo_url}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
      />

      {/* 3-column layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar — Stage navigation */}
        <BuildStageSidebar
          slug={slug}
          challengeTitle={challenge.title}
          language={enrollment?.language}
          stages={stagesSorted}
          enrollment={enrollment}
          activeView={activeView}
          onSelectSetup={() => setViewMode('setup')}
          onSelectStage={(n) => setViewMode(n)}
        />

        {/* Middle column — Main content */}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background/50">
          {activeView === 'setup' ? (
            <ScrollArea className="min-h-0 flex-1 p-4 md:p-6">
              <BuildRepoSetup
                repoUrl={enrollment?.repo_url}
                setupInstructions={languageConfig?.setup_instructions}
                onCopy={copyText}
              />
              {!enrollment?.repo_url && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild className="gradient-golden text-primary-foreground">
                    <Link to={`/projects/${slug}`}>Start challenge</Link>
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void connectGitHubFromWorkspace()}>
                    Connect GitHub
                  </Button>
                </div>
              )}
            </ScrollArea>
          ) : (
            <>
            {typeof activeView === 'number' && viewedStage && (
            <>
              {/* Blur overlay for completed stages */}
              {activeView < (enrollment?.current_stage_number ?? enrollment?.current_stage ?? 1) && !dismissedOverlayStages.has(activeView) && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm m-2 rounded-xl">
                  <div className="bg-card border border-border/50 rounded-xl p-6 shadow-xl max-w-sm w-full relative text-center space-y-4">
                    <button 
                      onClick={() => setDismissedOverlayStages(prev => new Set(prev).add(activeView))}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                    <h3 className="font-semibold text-lg text-foreground">Stage Completed</h3>
                    <p className="text-sm text-muted-foreground">
                      You've already completed this stage.
                    </p>
                    <Button 
                      className="w-full mt-2" 
                      onClick={() => setViewMode(enrollment?.current_stage_number ?? enrollment?.current_stage ?? 1)}
                    >
                      Go to Current Stage
                    </Button>
                  </div>
                </div>
              )}

              {/* Main content tabs */}
              <header className="shrink-0 border-b border-border/60 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-semibold text-foreground">{viewedStage?.title}</h2>
                  <BuildDifficultyBadge difficulty={viewedStage?.difficulty} />
                  {stageStatusForView === 'in_progress' && (
                    <Badge className="bg-primary/10 text-primary border-primary/20">In progress</Badge>
                  )}
                  {stageStatusForView === 'completed' && (
                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                      Complete
                    </Badge>
                  )}
                  {stageStatusForView !== 'in_progress' && stageStatusForView !== 'completed' && enrollment && (
                    <Badge variant="outline" className="text-muted-foreground">
                      View only
                    </Badge>
                  )}
                </div>
                {!isViewingTestTarget && enrollment && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Git pushes are verified only for stage {enrollment.current_stage}. Browse other stages for reference.
                  </p>
                )}
              </header>

              {/* Sticky tabs */}
              <Tabs value={mainTab} onValueChange={handleMainTabChange} className="flex min-h-0 flex-1 flex-col">
                <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 px-5 pt-2 backdrop-blur-sm">
                  <TabsList className="h-auto w-fit gap-1 bg-transparent p-0">
                    <TabsTrigger
                      value="instructions"
                      className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                      Instructions
                    </TabsTrigger>
                    <TabsTrigger
                      value="examples"
                      className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                      Code Examples
                    </TabsTrigger>
                    <TabsTrigger
                      value="concepts"
                      className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                      Concepts
                    </TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="min-h-0 flex-1 pb-16">
                  <div className="px-5 py-5">
                    <TabsContent value="instructions" className="m-0 space-y-6">
                      {/* Your Task card */}
                      {viewedStage?.description && (
                        <section className="rounded-xl border border-border/50 bg-card/40 p-5">
                          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">
                            Your task
                          </h3>
                          <div>
                            <MarkdownContent content={viewedStage.description} />
                          </div>
                        </section>
                      )}

                      {viewedStage?.instructions && (
                        <section>
                          <MarkdownContent content={viewedStage.instructions} />
                        </section>
                      )}

                      {!viewedStage?.description && !viewedStage?.instructions && (
                        <p className="text-sm text-muted-foreground">No instructions for this stage yet.</p>
                      )}

                      {/* How to pass this stage */}
                      {(viewedStage?.test_command || viewedStage?.success_criteria) && (
                        <section className="rounded-xl border border-border/50 bg-card/40 p-5">
                          <h3 className="text-sm font-semibold text-foreground">How to pass this stage</h3>

                          <div className="mt-4 space-y-4">
                            {/* Step 1: Write code */}
                            <div className="flex gap-3">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                1
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground">Write your code</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Implement the required functionality in your local repository.
                                </p>
                              </div>
                            </div>

                            {/* Step 2: Submit */}
                            <div className="flex gap-3">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                2
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground">Submit your code</p>
                                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                                  <code className="flex-1 font-mono text-xs text-foreground">
                                    git add . && git commit -m "pass stage" && git push origin main
                                  </code>
                                  <button
                                    type="button"
                                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => copyText('git add . && git commit -m "pass stage" && git push origin main')}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {viewedStage.test_command && (
                            <div className="mt-4 space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Test command
                              </p>
                              <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-xs">
                                {viewedStage.test_command}
                              </pre>
                            </div>
                          )}
                        </section>
                      )}

                      {/* Hints */}
                      {hints.length > 0 && (
                        <section className="space-y-2">
                          <h3 className="text-sm font-semibold text-foreground">Hints</h3>
                          {hints.slice(0, hintsRevealed).map((hint, idx) => (
                            <Collapsible key={idx} defaultOpen>
                              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-card/50 px-4 py-2.5 text-left text-sm hover:bg-secondary/40 transition-colors">
                                <span className="font-medium">Hint #{idx + 1}</span>
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="rounded-b-lg border border-t-0 border-border/50 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                                {hint}
                              </CollapsibleContent>
                            </Collapsible>
                          ))}
                          {hintsRevealed < hints.length && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-primary/30 text-primary hover:bg-primary/5"
                              onClick={() => setHintsRevealed((n) => Math.min(n + 1, hints.length))}
                            >
                              Show hint {hintsRevealed + 1}
                            </Button>
                          )}
                        </section>
                      )}

                      {/* Solution with blur overlay */}
                      {viewedStage?.code_example && (
                        <section className="relative space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-foreground">Complete Solution</h3>
                            <Button
                              size="sm"
                              variant={showSolution ? 'secondary' : 'default'}
                              className={cn(!showSolution && 'gradient-golden text-primary-foreground')}
                              onClick={() => setShowSolution((s) => !s)}
                            >
                              {showSolution ? 'Hide solution' : 'Reveal complete solution'}
                            </Button>
                          </div>
                          {showSolution ? (
                            <div className="rounded-lg border border-border/50 bg-card/40 p-4">
                              <MarkdownContent content={viewedStage.code_example} />
                            </div>
                          ) : (
                            <div className="relative overflow-hidden rounded-lg border border-border/50 bg-card/40 p-4">
                              <div className="pointer-events-none select-none blur-sm opacity-50">
                                <MarkdownContent content={viewedStage.code_example.slice(0, 200) + '...'} />
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
                                <p className="text-xs text-muted-foreground">Click "Reveal" to see the solution</p>
                              </div>
                            </div>
                          )}
                        </section>
                      )}

                      {/* Stage complete — next stage prompt */}
                      {verdict === 'passed' && nextStage && (
                        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
                          <p className="text-sm text-foreground">
                            🎉 Stage complete! Ready for the next challenge?
                          </p>
                          <Button
                            size="sm"
                            className="gradient-golden text-primary-foreground"
                            onClick={() => setViewMode(nextStage.stage_number)}
                          >
                            Next stage
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="examples" className="m-0">
                      {viewedStage?.code_example ? (
                        <div className="rounded-lg border border-border/50 bg-card/40 p-4">
                          <MarkdownContent content={viewedStage.code_example} />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No code examples configured for this stage.</p>
                      )}
                    </TabsContent>

                    <TabsContent value="concepts" className="m-0 space-y-4">
                      {viewedStage?.concepts_content ? (
                        <section className="rounded-xl border border-border/50 bg-card/40 p-5">
                          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">
                            Concepts
                          </h3>
                          <MarkdownContent content={viewedStage.concepts_content} />
                        </section>
                      ) : null}
                      {viewedStage?.docs_url ? (
                        <a
                          href={viewedStage.docs_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-sm font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Open external documentation →
                        </a>
                      ) : null}
                      {!viewedStage?.concepts_content && !viewedStage?.docs_url && (
                        <p className="text-sm text-muted-foreground">
                          No concepts for this stage yet. Admins can add content in the Build Challenges panel.
                        </p>
                      )}
                    </TabsContent>
                  </div>
                </ScrollArea>
              </Tabs>

              {/* Fixed bottom test results bar */}
              <BuildTestRunner
                verdict={verdict}
                isVerifying={isVerifying}
                activeCommitHash={activeCommitHash}
                stageNumber={lastResult?.build_stages?.stage_number}
                testOutput={lastResult?.test_output}
                showLogs={showLogsOpen}
                onToggleLogs={() => setShowLogsOpen((o) => !o)}
                onCopyLogs={
                  lastResult?.test_output ? () => void copyText(String(lastResult.test_output)) : undefined
                }
                onNextStage={
                  activeView === (lastResult?.build_stages?.stage_number || activeView) &&
                  (enrollment?.current_stage_number ?? enrollment?.current_stage ?? 1) > activeView
                    ? () => setViewMode(enrollment?.current_stage_number ?? enrollment?.current_stage ?? 1)
                    : undefined
                }
              />
            </>
          )}
            </>
          )}
        </main>

        {/* Right sidebar — Leaderboard */}
        <BuildLeaderboardPanel
          language={enrollment?.language}
          rows={leaderboardQuery.data?.leaderboard || []}
          currentUserId={user?.id}
          rankHint={rankHint}
        />
      </div>

      <BuildExampleGate
        open={exampleGateOpen}
        onOpenChange={setExampleGateOpen}
        stageTitle={viewedStage?.title}
        onConfirm={() => {
          setExamplesUnlocked(true);
          setExampleGateOpen(false);
          setMainTab('examples');
        }}
      />
    </div>
  );
}
