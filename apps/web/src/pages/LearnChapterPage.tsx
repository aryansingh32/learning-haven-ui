import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Flame, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchChapterWithProgress,
  type ChapterStep,
  type StepType,
  type PracticeProblem,
} from '@/data/chapters';
import { api } from '@/services/api.svc';
import { useAuth } from '@/context/AuthContext';
import { StoryHook } from '@/features/learning/components/StoryHook';
import { VideoSection } from '@/features/learning/components/VideoSection';
import { QuizSection } from '@/features/learning/components/QuizSection';
import { TaskSection } from '@/features/learning/components/TaskSection';
import { UnlockSection } from '@/features/learning/components/UnlockSection';
import { ProblemsSection } from '@/features/learning/components/ProblemsSection';
import { VisualizerSection } from '@/features/learning/components/VisualizerSection';
import { DocSection } from '@/features/learning/components/DocSection';
import { CompleteStepSection } from '@/features/learning/components/CompleteStepSection';
import { MicroRevisionSection } from '@/features/learning/components/MicroRevisionSection';
import CelebrationOverlay from '@/features/learning/components/CelebrationOverlay';
import { ChapterCta } from '@/features/learning/components/ChapterCta';
import { toast } from 'sonner';
import { PremiumLockBadge } from '@/components/PremiumLockBadge';

const difficultyStyles: Record<string, string> = {
  BEGINNER: 'bg-success/15 text-success',
  INTERMEDIATE: 'bg-primary/15 text-primary',
  ADVANCED: 'bg-destructive/15 text-destructive',
  easy: 'bg-success/15 text-success',
  medium: 'bg-primary/15 text-primary',
  hard: 'bg-destructive/15 text-destructive',
};

const PRICING = {
  monthlyDisplay: '583'
};

function youtubeIdFromUrl(url?: string): string {
  if (!url) return '';
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] || '';
}

function formatDifficulty(d?: string) {
  if (!d) return 'BEGINNER';
  return d.toUpperCase();
}

export default function LearnChapterPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [started, setStarted] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPayload, setCelebrationPayload] = useState<{
    xp: number;
    badge: string;
    streak: number;
    nextChapterId?: string;
  } | null>(null);
  const [cinemaMode, setCinemaMode] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['chapter', chapterId],
    queryFn: () => fetchChapterWithProgress(chapterId!),
    enabled: Boolean(chapterId),
  });

  const stepMutation = useMutation({
    mutationFn: (stepId: string) =>
      api.post(`/chapters/${chapterId}/progress/step`, { step_id: stepId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chapter', chapterId] });
      void qc.invalidateQueries({ queryKey: ['learn-chapters'] });
    },
  });

  const quizMutation = useMutation({
    mutationFn: ({ score, passed, totalQuestions }: { score: number; passed: boolean; totalQuestions: number }) =>
      api.post(`/chapters/${chapterId}/progress/quiz`, {
        score,
        passed,
        total_questions: totalQuestions,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chapter', chapterId] });
      void qc.invalidateQueries({ queryKey: ['learn-chapters'] });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: () => api.post('/chapters/unlock', { chapter_id: chapterId }),
    onSuccess: (res: {
      celebration?: { xp_earned?: number; badge_name?: string; streak_day?: number };
      next_chapter?: { id: string };
    }) => {
      void qc.invalidateQueries({ queryKey: ['chapter', chapterId] });
      void qc.invalidateQueries({ queryKey: ['learn-chapters'] });
      setCelebrationPayload({
        xp: res?.celebration?.xp_earned ?? data?.celebration?.xp ?? 100,
        badge: res?.celebration?.badge_name ?? data?.celebration?.badge_name ?? 'Chapter Master',
        streak: res?.celebration?.streak_day ?? data?.user?.streak_day ?? 1,
        nextChapterId: res?.next_chapter?.id,
      });
      setShowCelebration(true);
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message || 'Could not unlock chapter. Try again.');
    },
  });

  const chapter = data?.chapter;
  const progress = data?.progress;
  const celebrationMeta = data?.celebration;
  const courseTitle = data?.course?.title || 'Learning Path';

  const steps: ChapterStep[] = useMemo(
    () => (data?.content?.steps || []).sort((a, b) => a.step_number - b.step_number),
    [data]
  );

  const completedSet = useMemo(
    () => new Set(progress?.steps_completed || []),
    [progress?.steps_completed]
  );

  const isLocked = progress?.status === 'LOCKED';
  const quizPassed = (progress?.quiz_score || 0) >= 66;
  const taskCompleted = (progress?.tasks_completed || 0) >= 1;
  const skipTokens = data?.user?.skip_tokens_remaining ?? user?.skip_tokens_remaining ?? 0;
  const userName = data?.user?.full_name || user?.full_name || 'Learner';

  const estMinutes = chapter?.est_minutes
    ? Math.max(5, Math.round((chapter.est_minutes || 60) / 60))
    : 15;
  const xpReward = celebrationMeta?.xp ?? 100;

  const hasSetInitialStep = useRef(false);

  useEffect(() => {
    hasSetInitialStep.current = false;
  }, [chapterId]);

  useEffect(() => {
    if (!steps.length || hasSetInitialStep.current) return;
    const firstIncomplete = steps.findIndex((step) => !completedSet.has(step.id));
    setActiveStepIndex(firstIncomplete >= 0 ? firstIncomplete : steps.length - 1);
    hasSetInitialStep.current = true;
  }, [steps, completedSet, chapterId]);

  useEffect(() => {
    if (!chapterId) return;
    const key = `chapter_started_${chapterId}`;
    setStarted(localStorage.getItem(key) === '1' || (progress?.steps_completed?.length || 0) > 0);
  }, [chapterId, progress?.steps_completed]);

  useEffect(() => {
    setCinemaMode(false);
  }, [activeStepIndex]);

  const activeStep = steps[activeStepIndex];
  const activeStepIsVideo = activeStep?.type === 'video';

  const handleStart = () => {
    setStarted(true);
    if (chapterId) localStorage.setItem(`chapter_started_${chapterId}`, '1');
  };

  const isStepUnlocked = useCallback(
    (index: number) => index === 0 || completedSet.has(steps[index - 1]?.id),
    [completedSet, steps]
  );

  const isStepDone = (id: string) => completedSet.has(id);

  const markStepDone = useCallback(
    (stepId: string, index: number) => {
      if (!isStepUnlocked(index)) return;

      const currentStep = steps.find(s => s.id === stepId);
      if (currentStep?.type === 'story_hook' && data?.course?.id) {
        // Mark as enrolled if they completed a story hook step
        api.post(`/courses/${data.course.id}/enroll`).then(() => {
          qc.invalidateQueries({ queryKey: ['my-course-enrollments'] });
        }).catch(() => {});
      }

      if (index + 1 < steps.length) {
        setActiveStepIndex(index + 1);
      }

      qc.setQueryData(['chapter', chapterId], (old: typeof data) => {
        if (!old?.progress) return old;
        const completed = [...(old.progress.steps_completed || [])];
        if (!completed.includes(stepId)) completed.push(stepId);
        return { ...old, progress: { ...old.progress, steps_completed: completed } };
      });

      stepMutation.mutate(stepId, {
        onError: () => {
          setActiveStepIndex(index);
          toast.error('Could not save progress. Please try again.');
          void qc.invalidateQueries({ queryKey: ['chapter', chapterId] });
        },
        onSettled: () => {
          void qc.invalidateQueries({ queryKey: ['chapter', chapterId] });
        },
      });
    },
    [chapterId, isStepUnlocked, qc, stepMutation, steps, data]
  );

  const handleCelebrate = (stepId: string, index: number) => {
    markStepDone(stepId, index);
    if (quizPassed && taskCompleted) {
      unlockMutation.mutate();
      return;
    }
    toast.info('Pass the quiz (≥66%) and complete the task to unlock the next chapter and earn XP.');
    setCelebrationPayload({
      xp: xpReward,
      badge: celebrationMeta?.badge_name || `${chapter?.title} Master`,
      streak: data?.user?.streak_day ?? 1,
    });
    setShowCelebration(true);
  };

  if (isLoading) {
    return (
      <motion.div className="flex min-h-[40vh] items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </motion.div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="max-w-7xl mx-auto card-layer-2 rounded-2xl p-6 text-center">
        <p className="text-lg font-semibold">Chapter not found</p>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" /> Back to courses
        </button>
      </div>
    );
  }

  if (isLocked || progress?.status === 'LOCKED_PAYWALL') {
    const isPaywall = progress?.status === 'LOCKED_PAYWALL';
    return (
      <motion.div className="max-w-7xl mx-auto card-layer-2 rounded-2xl p-8 text-center space-y-4">
        {isPaywall ? (
           <div className="flex justify-center mb-2">
             <PremiumLockBadge className="text-sm px-4 py-1" />
           </div>
        ) : (
           <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
        )}
        <h2 className="text-xl font-bold">{chapter.title}</h2>
        <p className="text-muted-foreground text-sm">
          {isPaywall 
            ? "You've built a strong foundation. Unlock the full path with Pro."
            : "Complete the previous chapter to unlock this one."}
        </p>
        <div className="flex items-center justify-center gap-4 mt-6">
          <ChapterCta variant="secondary" onClick={() => navigate(data?.course?.id ? `/course/${data.course.id}/chapters` : '/courses')}>
            Back to course
          </ChapterCta>
          {isPaywall && (
            <ChapterCta variant="primary" onClick={() => navigate('/pricing')}>
              Upgrade to Pro — ₹{PRICING.monthlyDisplay}/mo
            </ChapterCta>
          )}
        </div>
      </motion.div>
    );
  }

  const renderStepContent = (step: ChapterStep, index: number) => {
    const c = step.content || {};
    const type = step.type as StepType;

    switch (type) {
      case 'story_hook':
        return (
          <StoryHook
            content={c.story || chapter.story_hook || ''}
            onMarkDone={() => markStepDone(step.id, index)}
          />
        );
      case 'video':
        return (
          <VideoSection
            videoId={youtubeIdFromUrl(c.youtube_url) || (c as { youtube_id?: string }).youtube_id || ''}
            title={c.title}
            channel={c.channel}
            duration={c.duration_min}
            focusNote={c.focus_note}
            cinemaMode={cinemaMode}
            onCinemaModeChange={setCinemaMode}
            onMarkDone={() => markStepDone(step.id, index)}
          />
        );
      case 'doc':
        return <DocSection markdown={c.doc_md || ''} onMarkDone={() => markStepDone(step.id, index)} />;
      case 'visualizer':
        return (
          <VisualizerSection
            url={c.visualizer?.url}
            task={c.visualizer?.task}
            notes={c.visualizer?.notes}
            onMarkDone={() => markStepDone(step.id, index)}
          />
        );
      case 'practice':
        return (
          <ProblemsSection
            problems={(c.practice_problems || []).map((p: PracticeProblem) => ({
              id: p.id,
              name: p.prompt?.slice(0, 80) || 'Practice problem',
              description: p.prompt,
              url: (p as { url?: string }).url,
              difficulty: 'practice',
              platform: 'Practice',
            }))}
            onMarkDone={() => markStepDone(step.id, index)}
          />
        );
      case 'quiz':
        return (
          <QuizSection
            chapterId={chapter.id}
            savedScorePercent={progress?.quiz_score ?? null}
            alreadySubmitted={(progress?.quiz_score ?? 0) > 0}
            questions={(c.quiz_questions || []).map(
              (q: { question?: string; options: string[]; correctAnswer?: string; explanation?: string }) => ({
                question: q.question || '',
                options: q.options,
                correctAnswer: q.options.indexOf(q.correctAnswer || ''),
                explanation: q.explanation || '',
                q: q.question,
              })
            )}
            onSubmitQuiz={(score, passed, totalQuestions) => {
              quizMutation.mutate({ score, passed, totalQuestions });
            }}
            onProceed={() => markStepDone(step.id, index)}
          />
        );
      case 'task':
        return (
          <TaskSection
            chapterId={chapter.id}
            task={{ title: step.title, description: c.task_prompt || '' }}
            isCompleted={taskCompleted}
            onComplete={() => markStepDone(step.id, index)}
            onProceed={() => markStepDone(step.id, index)}
          />
        );
      case 'micro_revision':
        return (
          <motion.div className="space-y-6">
            <MicroRevisionSection
              connectionMap={c.connection_map}
              recallQuestions={c.recall_questions}
              identityAffirmation={c.identity_affirmation}
              streakReminder={c.streak_reminder}
              onCelebrate={() => handleCelebrate(step.id, index)}
            />
            {!quizPassed || !taskCompleted ? (
              <UnlockSection
                chapterId={chapter.id}
                quizPassed={quizPassed}
                taskCompleted={taskCompleted}
                skipTokens={skipTokens}
                onSkipped={() => void qc.invalidateQueries({ queryKey: ['learn-chapters'] })}
                onUnlocked={() => unlockMutation.mutate()}
                isUnlocking={unlockMutation.isPending}
              />
            ) : null}
          </motion.div>
        );
      case 'complete':
        return (
          <motion.div className="space-y-6">
            <CompleteStepSection
              title={chapter.title}
              xp={xpReward}
              badgeName={celebrationMeta?.badge_name || `${chapter.title} Master`}
              message={c.completion_celebration?.message as string | undefined}
              onCelebrate={() => handleCelebrate(step.id, index)}
            />
            {!quizPassed || !taskCompleted ? (
              <UnlockSection
                chapterId={chapter.id}
                quizPassed={quizPassed}
                taskCompleted={taskCompleted}
                skipTokens={skipTokens}
                onSkipped={() => void qc.invalidateQueries({ queryKey: ['learn-chapters'] })}
                onUnlocked={() => unlockMutation.mutate()}
                isUnlocking={unlockMutation.isPending}
              />
            ) : null}
          </motion.div>
        );
      default:
        return (
          <motion.div className="rounded-xl border border-border p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="font-semibold text-foreground mb-2">{step.title}</p>
            <ChapterCta variant="secondary" onClick={() => markStepDone(step.id, index)}>
              Mark complete
            </ChapterCta>
          </motion.div>
        );
    }
  };

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        type="button"
        onClick={() => navigate(data?.course?.id ? `/course/${data.course.id}/chapters` : '/courses')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to course
      </button>

      {/* Story hero — hidden in YouTube cinema mode */}
      {!(started && cinemaMode && activeStepIsVideo) && (
      <section className="rounded-2xl bg-[#111111] border border-white/10 text-white p-6 md:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(249,115,22,0.15),transparent_60%)] pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
          <div className="flex-1 min-w-[280px]">
            <div className="text-[10px] font-bold tracking-widest uppercase text-white/50 mb-3">
              {courseTitle.toUpperCase()} • CHAPTER {chapter.chapter_number}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold">{chapter.title}</h1>
            <p className="mt-4 text-sm text-white/80 max-w-2xl leading-relaxed">
              {chapter.story_hook || celebrationMeta?.identity_affirmation || 'Master this chapter step by step.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-semibold">
              <span
                className={cn(
                  'px-3 py-1.5 rounded-full',
                  difficultyStyles[formatDifficulty(chapter.difficulty)] || difficultyStyles.BEGINNER
                )}
              >
                {formatDifficulty(chapter.difficulty)}
              </span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white">~{estMinutes} minutes</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-white flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-400" /> +{xpReward} XP
              </span>
            </div>
          </div>
        </div>
        {!started && (
          <ChapterCta
            variant="primary"
            icon="play"
            onClick={handleStart}
            className="relative z-10 mt-8 px-8 py-3.5 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
          >
            Start Your Journey
          </ChapterCta>
        )}
      </section>
      )}

      {!started && (
        <div className="space-y-4 opacity-40 blur-[2px] select-none pointer-events-none px-2 max-w-3xl">
          {Array.from({ length: Math.min(6, steps.length || 6) }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-secondary/20"
            >
              <motion.div className="w-4 h-4 rounded-full border-[3px] border-border/60 shrink-0" />
              <div className="h-3 bg-border/40 rounded-full w-48" />
              <Lock className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
            </div>
          ))}
        </div>
      )}

      {started && (
        <section
          className={cn(
            'grid gap-6',
            cinemaMode && activeStepIsVideo ? 'grid-cols-1' : 'lg:grid-cols-[260px_1fr]'
          )}
        >
          {/* Timeline — below video in cinema mode */}
          <div
            className={cn(
              'relative h-fit rounded-2xl card-layer-2 p-5 border border-border/40',
              cinemaMode && activeStepIsVideo
                ? 'order-2'
                : 'order-1 lg:order-none lg:sticky lg:top-24'
            )}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-5">Timeline</p>
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-secondary/50 rounded-full" />
              <motion.div
                className="absolute left-[7px] top-2 w-[2px] bg-orange-500 origin-top rounded-full"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: activeStepIndex / Math.max(1, steps.length - 1) }}
                transition={{ duration: 0.5 }}
              />
              <div className="space-y-4 relative z-10">
                {steps.map((step, index) => {
                  const locked = !isStepUnlocked(index);
                  const done = isStepDone(step.id);
                  const active = index === activeStepIndex && !locked;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => !locked && setActiveStepIndex(index)}
                      disabled={locked}
                      className={cn(
                        'w-full flex items-center gap-3 text-left group transition-all relative',
                        locked && 'opacity-30'
                      )}
                    >
                      <div
                        className={cn(
                          'h-4 w-4 rounded-full border-[3px] shrink-0 bg-background transition-all duration-300 relative z-10',
                          done
                            ? 'border-orange-500 bg-orange-500 scale-90'
                            : active
                              ? 'border-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.4)] scale-110'
                              : 'border-border/80 group-hover:border-border scale-95'
                        )}
                      >
                        {locked && (
                          <Lock className="absolute inset-0 m-auto w-2 h-2 text-muted-foreground/50" />
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs transition-colors',
                          active
                            ? 'text-foreground font-bold'
                            : 'text-muted-foreground font-medium group-hover:text-foreground'
                        )}
                      >
                        {step.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active step — above timeline in cinema mode */}
          <div
            className={cn(
              'space-y-4',
              cinemaMode && activeStepIsVideo ? 'order-1' : 'order-2 lg:order-none'
            )}
          >
            {steps.map((step, index) => {
              const locked = !isStepUnlocked(index);
              const done = isStepDone(step.id);
              const active = index === activeStepIndex;
              if (!active) return null;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'rounded-2xl border p-5 md:p-6',
                    locked ? 'bg-secondary/40 border-border/50' : 'bg-background/90 border-border/60',
                    cinemaMode && step.type === 'video' && 'border-0 p-0 md:p-0 bg-transparent shadow-none'
                  )}
                >
                  {!(cinemaMode && step.type === 'video') && (
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500 mb-1">
                          Step {index + 1}
                        </p>
                        <h3 className="text-2xl font-extrabold text-foreground tracking-tight">{step.title}</h3>
                      </div>
                      {done && <CheckCircle2 className="h-6 w-6 text-success shrink-0" />}
                    </div>
                  )}

                  {renderStepContent(step, index)}
                </motion.div>
              );
            })}

            {steps.length === 0 && (
              <p className="text-muted-foreground text-sm">No steps configured for this chapter yet.</p>
            )}
          </div>
        </section>
      )}

      {started && progress?.status !== 'COMPLETED' && quizPassed && taskCompleted && (
        <UnlockSection
          chapterId={chapter.id}
          quizPassed={quizPassed}
          taskCompleted={taskCompleted}
          skipTokens={skipTokens}
          onSkipped={() => void qc.invalidateQueries({ queryKey: ['learn-chapters'] })}
          onUnlocked={() => unlockMutation.mutate()}
          isUnlocking={unlockMutation.isPending}
        />
      )}

      <CelebrationOverlay
        isOpen={showCelebration}
        onClose={() => {
          setShowCelebration(false);
          if (progress?.status === 'COMPLETED') navigate(data?.course?.id ? `/course/${data.course.id}/chapters` : '/courses');
        }}
        chapterTitle={chapter.title}
        chapterNumber={chapter.chapter_number}
        courseTitle={data?.course?.title}
        xpEarned={celebrationPayload?.xp ?? xpReward}
        badgeName={celebrationPayload?.badge ?? celebrationMeta?.badge_name ?? 'Chapter Master'}
        skills={celebrationMeta?.skills?.length ? celebrationMeta.skills : [chapter.topic_tag || chapter.title].filter(Boolean) as string[]}
        streakDay={celebrationPayload?.streak ?? data?.user?.streak_day ?? 1}
        userName={userName}
        linkedInText={celebrationMeta?.linkedin_text}
        onNext={
          celebrationPayload?.nextChapterId
            ? () => navigate(`/chapter/${celebrationPayload.nextChapterId}`)
            : () => navigate(data?.course?.id ? `/course/${data.course.id}/chapters` : '/courses')
        }
      />
    </motion.div>
  );
}
