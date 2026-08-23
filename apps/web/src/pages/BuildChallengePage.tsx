import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { buildHavenService } from '@/features/build-haven/api/build-haven.service';
import { apprenticeshipService } from '@/features/apprenticeship/api/apprenticeship.service';
import { MarkdownContent } from '@/features/build-haven/components/MarkdownContent';
import { BuildDifficultyBadge } from '@/features/build-haven/components/BuildDifficultyBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { CheckCircle2, Loader2, ChevronRight, ArrowLeft, Clock, Layers, Code2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { buildGitHubReturnPath, handleGitHubOAuthReturn, stripGitHubOAuthParams } from '@/lib/githubOAuth';
import { stageStatus } from '@/features/build-haven/components/utils';
import { BuildModePicker } from '@/features/build-haven/components/BuildModePicker';

/* ── Language icon button ──────────────────────────────────────────── */
function LanguageButton({
  lang,
  selected,
  onClick,
}: {
  lang: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all duration-200',
        selected
          ? 'border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10'
          : 'border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      <Code2 className="h-4 w-4" />
      <span className="capitalize">{lang}</span>
    </button>
  );
}

/* ── Difficulty bar chart (CodeCrafters style) ─────────────────────── */
function DifficultyBars({ difficulty }: { difficulty?: string }) {
  const levels: Record<string, number> = {
    'very easy': 1,
    easy: 2,
    medium: 3,
    hard: 4,
  };
  const level = levels[(difficulty || 'medium').toLowerCase()] || 2;
  return (
    <div className="flex items-end gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-sm transition-colors',
            i <= level ? 'bg-primary' : 'bg-muted-foreground/20'
          )}
          style={{ height: `${6 + i * 3}px` }}
        />
      ))}
    </div>
  );
}

/* ── Recent attempts sidebar component ─────────────────────────────── */
function RecentAttempts({
  rows,
  totalStages,
  currentUserId,
}: {
  rows: any[];
  totalStages: number;
  currentUserId?: string;
}) {
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
      ),
    [rows]
  );

  return (
    <div className="space-y-2">
      {sorted.slice(0, 10).map((row) => {
        const isYou = row.user_id === currentUserId;
        const completed = row.stages_completed ?? 0;
        const pct = totalStages > 0 ? (completed / totalStages) * 100 : 0;
        return (
          <div
            key={row.user_id}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-xs',
              isYou ? 'bg-primary/5 ring-1 ring-primary/30' : 'bg-muted/30'
            )}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-[10px] font-bold text-white">
              {isYou ? 'U' : String(row.user_id).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className={cn('truncate font-medium', isYou && 'text-primary')}>
                  {isYou ? 'You' : row.display_name || `${String(row.user_id).slice(0, 8)}…`}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {completed}/{totalStages}
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
      {!sorted.length && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No attempts yet — be the first!
        </p>
      )}
    </div>
  );
}

function TestimonialsArea({ config }: { config?: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let sourceItems = config?.items || [];
    if (sourceItems.length > 0) {
       // Randomize items initially as requested
       const shuffled = [...sourceItems].sort(() => 0.5 - Math.random());
       setItems(shuffled);
    } else {
       setItems([]);
    }
  }, [config]);

  useEffect(() => {
    if (!config?.auto_slide || items.length <= 2) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 2) % items.length);
    }, 5000); // Auto slide every 5 seconds
    return () => clearInterval(interval);
  }, [config?.auto_slide, items.length]);

  if (!items.length) return null;

  const visibleItems = items.slice(currentIndex, currentIndex + 2);
  if (visibleItems.length === 1 && items.length > 1) {
     visibleItems.push(items[0]);
  }

  return (
    <div className="mt-12 min-h-[200px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="grid gap-x-8 gap-y-12 md:grid-cols-2 h-full"
        >
          {visibleItems.map((t: any, idx: number) => {
            const content = (
              <div className="relative border-l border-border/40 pl-6 py-1 h-full flex flex-col">
                <div className="flex gap-4 mb-6">
                  <div className="flex-shrink-0 text-[#6366f1] mt-0.5">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z" />
                    </svg>
                  </div>
                  <p className="text-[15px] leading-relaxed text-muted-foreground flex-1">
                    {t.text}
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-auto">
                  <img
                    src={t.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author_name || 'U')}&background=random`}
                    alt={t.author_name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t.author_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.author_title}</p>
                  </div>
                </div>
              </div>
            );

            return t.link && t.link !== '#' ? (
              <a
                key={`${t.id || idx}-${currentIndex}`}
                href={t.link}
                target={t.link.startsWith('http') ? '_blank' : '_self'}
                rel="noreferrer"
                className="group block transition-opacity hover:opacity-80 cursor-pointer h-full"
              >
                {content}
              </a>
            ) : (
              <div key={`${t.id || idx}-${currentIndex}`} className="block h-full">
                {content}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ══════════════════════════════════════════════════════════════════════ */
export default function BuildChallengePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [language, setLanguage] = useState('');
  const [buildMode, setBuildMode] = useState<'traditional' | 'vibe'>('traditional');
  const [showModePicker, setShowModePicker] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['build-challenge', slug],
    queryFn: () => buildHavenService.getChallengeBySlug(slug),
    enabled: Boolean(slug),
  });

  const githubStatusQuery = useQuery({
    queryKey: ['apprenticeship-github-status'],
    queryFn: () => apprenticeshipService.getGithubStatus(),
  });

  const workspaceQuery = useQuery({
    queryKey: ['build-workspace-preview', slug, language],
    queryFn: () => buildHavenService.getWorkspace(slug, language ? { language } : undefined),
    enabled: Boolean(slug),
  });

  const leaderboardQuery = useQuery({
    queryKey: ['build-leaderboard', slug, language],
    queryFn: () => buildHavenService.getLeaderboard(slug, language ? { language } : undefined),
    enabled: Boolean(slug),
  });

  const challenge = data?.challenge;
  const languages = challenge?.languages || [];
  const stages = useMemo(
    () => [...(challenge?.stages || [])].sort((a: any, b: any) => a.stage_number - b.stage_number),
    [challenge?.stages]
  );

  useEffect(() => {
    if (!language && languages[0]?.language) {
      setLanguage(languages[0].language);
    }
  }, [languages, language]);

  // Auto-configure build mode based on challenge config
  useEffect(() => {
    if (!challenge) return;
    const modes: string[] = challenge.available_modes || ['traditional'];
    if (modes.length === 1) {
      setBuildMode(modes[0] as 'traditional' | 'vibe');
      setShowModePicker(false);
    } else {
      setBuildMode((challenge.default_mode as 'traditional' | 'vibe') || 'traditional');
      setShowModePicker(true);
    }
  }, [challenge]);

  useEffect(() => {
    handleGitHubOAuthReturn(location.search, () => {
      void githubStatusQuery.refetch();
    });
    if (location.search.includes('github_connected')) {
      const clean = stripGitHubOAuthParams(location.search);
      navigate(`${location.pathname}${clean}`, { replace: true });
    }
  }, [location.search, location.pathname, navigate, githubStatusQuery]);

  const isGithubConnected = githubStatusQuery.data?.connected;
  const existingEnrollment = workspaceQuery.data?.workspace?.enrollment;

  const startMutation = useMutation({
    mutationFn: () => buildHavenService.startChallenge(slug, language, buildMode),
    onSuccess: () => {
      toast.success(buildMode === 'vibe' ? 'Ready — start vibe coding!' : 'Repository ready — let\'s build!');
      void refetch();
      navigate(`/projects/${slug}/workspace?language=${encodeURIComponent(language)}&mode=${buildMode}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const githubConnectMutation = useMutation({
    mutationFn: () =>
      apprenticeshipService.getGithubAuthUrl(
        buildGitHubReturnPath(location.pathname, location.search)
      ),
    onSuccess: (data: { url?: string }) => {
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      toast.error('GitHub auth URL is unavailable');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !challenge) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalMinutes = stages.reduce((acc: number, s: any) => acc + (s.estimated_minutes || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-0 pb-16">
      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </button>
      </div>

      {/* ── Hero / Overview Header ─────────────────────────────── */}
      <section className="rounded-2xl border border-border/50 bg-gradient-to-br from-card via-background to-card/80 p-8">
        <div className="flex flex-wrap items-center gap-2">
          <BuildDifficultyBadge difficulty={challenge.difficulty_level} />
          {challenge.is_free && (
            <Badge className="bg-success/10 text-success border-success/30">Free in beta</Badge>
          )}
          {/* TODO(payments): gate Start / premium examples when Razorpay membership is integrated */}
          {challenge.status === 'beta' && <Badge variant="secondary">Beta</Badge>}
        </div>

        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {challenge.title}
        </h1>

        {challenge.short_tagline && (
          <p className="mt-2 text-lg text-muted-foreground">{challenge.short_tagline}</p>
        )}

        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {challenge.description}
        </p>

        {/* Language selector */}
        {languages.length > 0 && (
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select a language
            </p>
            <div className="flex flex-wrap gap-2">
              {languages.map((l: any) => (
                <LanguageButton
                  key={l.language}
                  lang={l.language}
                  selected={language === l.language}
                  onClick={() => setLanguage(l.language)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Mode Picker (shown when challenge supports both modes) */}
        {showModePicker && (
          <div className="mt-6">
            <BuildModePicker
              availableModes={(challenge as any).available_modes || ['traditional']}
              selectedMode={buildMode}
              onSelect={setBuildMode}
            />
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          {buildMode === 'vibe' ? (
            <Button
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 px-8"
              disabled={!language || startMutation.isPending}
              onClick={() => {
                if (existingEnrollment) {
                  navigate(`/projects/${slug}/workspace?language=${encodeURIComponent(language)}&mode=vibe`);
                } else {
                  startMutation.mutate();
                }
              }}
            >
              {startMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up…</>
              ) : existingEnrollment ? (
                <>Resume Vibe Build<ChevronRight className="ml-1 h-4 w-4" /></>
              ) : (
                <>Start Vibe Coding<ChevronRight className="ml-1 h-4 w-4" /></>
              )}
            </Button>
          ) : !isGithubConnected ? (
            <Button
              size="lg"
              className="bg-[#24292F] text-white hover:bg-[#24292F]/90 shadow-lg"
              disabled={githubConnectMutation.isPending}
              onClick={() => githubConnectMutation.mutate()}
            >
              {githubConnectMutation.isPending ? 'Redirecting…' : 'Connect GitHub to Start'}
            </Button>
          ) : (
            <Button
              size="lg"
              className="gradient-golden text-primary-foreground shadow-lg shadow-primary/20 px-8"
              disabled={!language || startMutation.isPending}
              onClick={() => {
                if (existingEnrollment?.repo_url) {
                  navigate(`/projects/${slug}/workspace?language=${encodeURIComponent(language)}`);
                } else {
                  startMutation.mutate();
                }
              }}
            >
              {startMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up…</>
              ) : existingEnrollment?.repo_url ? (
                <>Resume Building<ChevronRight className="ml-1 h-4 w-4" /></>
              ) : (
                <>Start Building<ChevronRight className="ml-1 h-4 w-4" /></>
              )}
            </Button>
          )}
          {buildMode === 'traditional' && isGithubConnected && (
            <p className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              GitHub connected
            </p>
          )}
        </div>
      </section>

      {/* ── Main content + Sidebar ─────────────────────────────── */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Left: Stage list */}
        <div className="space-y-6">
          {/* How it works explainer */}
          {!existingEnrollment && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 mb-8">
              <h3 className="font-semibold text-primary mb-5 flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                How it works
              </h3>
              {buildMode === 'vibe' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                  <div className="hidden md:block absolute top-5 left-[16%] right-[16%] h-[2px] bg-violet-500/20" />
                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-10 h-10 rounded-full bg-background border-2 border-violet-500 flex items-center justify-center text-violet-500 font-bold shadow-sm mb-3">1</div>
                    <h4 className="font-medium text-sm text-foreground">Read the brief</h4>
                    <p className="text-xs text-muted-foreground mt-1">Study the Product Contract — we tell you WHAT to build, not HOW.</p>
                  </div>
                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-10 h-10 rounded-full bg-background border-2 border-violet-500/40 flex items-center justify-center text-violet-500/70 font-bold shadow-sm mb-3">2</div>
                    <h4 className="font-medium text-sm text-foreground">Build with AI</h4>
                    <p className="text-xs text-muted-foreground mt-1">Use Cursor, Claude, Bolt, Lovable — any tool you like.</p>
                  </div>
                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-10 h-10 rounded-full bg-background border-2 border-violet-500/40 flex items-center justify-center text-violet-500/70 font-bold shadow-sm mb-3">3</div>
                    <h4 className="font-medium text-sm text-foreground">Submit &amp; prove it</h4>
                    <p className="text-xs text-muted-foreground mt-1">Submit your repo or live URL — we run browser proof gates to verify each milestone.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                  <div className="hidden md:block absolute top-5 left-[16%] right-[16%] h-[2px] bg-primary/20" />
                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-10 h-10 rounded-full bg-background border-2 border-primary flex items-center justify-center text-primary font-bold shadow-sm mb-3">1</div>
                    <h4 className="font-medium text-sm text-foreground">Connect GitHub</h4>
                    <p className="text-xs text-muted-foreground mt-1">We'll create a private repository for your challenge.</p>
                  </div>
                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-10 h-10 rounded-full bg-background border-2 border-primary/40 flex items-center justify-center text-primary/70 font-bold shadow-sm mb-3">2</div>
                    <h4 className="font-medium text-sm text-foreground">Clone repo</h4>
                    <p className="text-xs text-muted-foreground mt-1">Write code in your favorite local environment.</p>
                  </div>
                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-10 h-10 rounded-full bg-background border-2 border-primary/40 flex items-center justify-center text-primary/70 font-bold shadow-sm mb-3">3</div>
                    <h4 className="font-medium text-sm text-foreground">Push code</h4>
                    <p className="text-xs text-muted-foreground mt-1">We run automated tests and update your progress instantly.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              {buildMode === 'vibe' ? 'Proof Gates' : 'Stages'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {buildMode === 'vibe'
                ? 'Each gate verifies a product milestone. Build with any tool, submit when ready.'
                : 'Complete each stage in order. Push your code to trigger automated tests.'}
            </p>
          </div>

          <div className="space-y-2">
            {stages.map((stage: any) => {
              const isCompleted = existingEnrollment && stageStatus(stage.stage_number, existingEnrollment) === 'completed';
              return (
              <div
                key={stage.id}
                onClick={() => navigate(`/projects/${slug}/workspace?language=${encodeURIComponent(language)}&stage=${stage.stage_number}`)}
                className="group flex items-center gap-4 rounded-xl border border-border/50 bg-card/60 px-5 py-4 transition-all hover:border-primary/30 hover:bg-card/80 cursor-pointer"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary">
                  {stage.stage_number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{stage.title}</p>
                  {stage.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {stage.description.replace(/[#*`]/g, '').slice(0, 80)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {stage.estimated_minutes ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {stage.estimated_minutes}m
                    </span>
                  ) : null}
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <DifficultyBars difficulty={stage.difficulty} />
                  )}
                </div>
              </div>
            )})}
          </div>

          {/* Info blocks as dropdowns */}
          {(challenge.what_you_build || challenge.what_you_learn) && (
            <div className="grid gap-4">
              {challenge.what_you_build && (
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-t-xl border border-border/50 bg-card/60 p-4 font-display text-sm font-semibold text-foreground hover:bg-card/80 transition-colors">
                    What you'll build
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="rounded-b-xl border border-t-0 border-border/50 bg-card/20 p-5">
                    <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none">
                      <MarkdownContent content={challenge.what_you_build} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              {challenge.what_you_learn && (
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-t-xl border border-border/50 bg-card/60 p-4 font-display text-sm font-semibold text-foreground hover:bg-card/80 transition-colors">
                    What you'll learn
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="rounded-b-xl border border-t-0 border-border/50 bg-card/20 p-5">
                    <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none">
                      <MarkdownContent content={challenge.what_you_learn} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          <TestimonialsArea config={challenge.testimonials_config} />
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Challenge stats */}
          <div className="rounded-xl border border-border/50 bg-card/60 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Challenge info
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" />
                  Stages
                </dt>
                <dd className="font-medium text-foreground">{stages.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Est. time
                </dt>
                <dd className="font-medium text-foreground">{totalMinutes || '—'} min</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Code2 className="h-3.5 w-3.5" />
                  Languages
                </dt>
                <dd className="font-medium text-foreground">{languages.length}</dd>
              </div>
            </dl>
          </div>

          {/* Recent attempts */}
          <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
            <div className="border-b border-border/50 px-5 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recent attempts
              </h3>
            </div>
            <ScrollArea className="max-h-[400px] p-3">
              <RecentAttempts
                rows={leaderboardQuery.data?.leaderboard || []}
                totalStages={stages.length}
                currentUserId={user?.id}
              />
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
