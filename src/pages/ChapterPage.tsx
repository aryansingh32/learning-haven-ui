import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApiQuery } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { StoryHook } from '@/components/chapter/StoryHook';
import { VideoSection } from '@/components/chapter/VideoSection';
import { CheatsheetSection } from '@/components/chapter/CheatsheetSection';
import { ProblemsSection } from '@/components/chapter/ProblemsSection';
import { QuizSection } from '@/components/chapter/QuizSection';
import { TaskSection } from '@/components/chapter/TaskSection';
import { UnlockSection } from '@/components/chapter/UnlockSection';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/services/api.svc';

export default function ChapterPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      navigate('/signin');
    }
  }, [isAuthenticated, isAuthLoading, navigate]);

  const {
    data: chapterRes,
    isLoading: isChapterLoading,
    isError: isChapterError,
    refetch: refetchChapter
  } = useApiQuery<any>(
    ['chapter', chapterId],
    `/chapters/${chapterId}`,
    { enabled: !!chapterId && !!isAuthenticated }
  );

  const {
    data: progressRes,
    isLoading: isProgressLoading,
    isError: isProgressError,
  } = useApiQuery<any>(
    ['chapterProgress', chapterId],
    `/chapters/${chapterId}/progress`,
    { enabled: !!chapterId && !!isAuthenticated }
  );

  const isLoading = isChapterLoading || isProgressLoading || isAuthLoading;
  const isError = isChapterError || isProgressError;

  const handleRefresh = () => {
    refetchChapter();
    queryClient.invalidateQueries({ queryKey: ['chapterProgress', chapterId] });
  };

  const handleQuizComplete = async (score: number, passed: boolean) => {
    try {
      await api.post(`/chapters/${chapterId}/progress/quiz`, {
        score,
        passed
      });
      if (passed) {
        toast.success("Quiz passed successfully! 🎉");
      } else {
        toast.error("Quiz failed. You need at least 2/3 correct. Try again later.");
      }
      handleRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save quiz score');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans p-6 sm:p-12 pb-32 max-w-4xl mx-auto space-y-8">
        <Skeleton className="h-12 w-3/4 rounded-2xl mb-10" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !chapterRes?.data) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center p-6 pb-32">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Oops! Something went wrong</h2>
          <p className="text-slate-500 mb-6">We couldn't load this chapter. Please check your connection and try again.</p>
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const chapter = chapterRes.data;
  const content = chapterRes.data.content || {}; // The chapter_content merged or appended
  const progress = progressRes?.data || {};

  // For testing, mock tasks if they are null
  const fallbackTask = { title: "Reflect on this chapter", description: "Write down 3 things you learned." };
  let taskData = fallbackTask;
  if (content.tasks && Array.isArray(content.tasks) && content.tasks.length > 0) {
    taskData = content.tasks[0];
  } else if (content.tasks && typeof content.tasks === 'object' && content.tasks.title) {
    taskData = content.tasks; // Handle case where it's a single object
  }

  const quizPassed = (progress.quiz_score !== null && progress.quiz_score >= 2);
  const taskCompleted = (progress.tasks_completed > 0);
  const skipTokens = user?.skip_tokens_remaining || 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      {/* Hero Header */}
      <div className="bg-white border-b border-slate-200 pt-10 pb-8 px-6 mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-50 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 opacity-70 pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 font-bold text-xs rounded-full tracking-wide uppercase">
              Chapter {chapter.chapter_number}
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 font-bold text-xs rounded-full">
              {chapter.difficulty || 'Beginner'}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {chapter.title}
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 space-y-2">
        {/* PARt 1: STORY HOOK */}
        <StoryHook content={chapter.story_hook} />

        {/* PARt 2: VIDEO */}
        <VideoSection
          videoId={content.video_youtube_id}
          channel={content.video_channel}
          title={content.video_title}
          duration={content.video_duration}
          timestamps={content.video_timestamps}
        />

        {/* PARt 3: CHEATSHEET */}
        <CheatsheetSection
          url={content.article_url}
          source={content.article_source}
          title={content.article_title}
        />

        {/* PARt 4: PRACTICE PROBLEMS */}
        <ProblemsSection problems={content.problems} />

        {/* PARt 5: MINI QUIZ */}
        <QuizSection
          chapterId={chapterId!}
          questions={content.quiz}
          onComplete={handleQuizComplete}
        />

        {/* PARt 6: TASK */}
        <TaskSection
          chapterId={chapterId!}
          task={taskData}
          isCompleted={taskCompleted}
          onComplete={handleRefresh}
        />

        {/* PARt 7: UNLOCK NEXT CHAPTER */}
        <UnlockSection
          chapterId={chapterId!}
          quizPassed={quizPassed}
          taskCompleted={taskCompleted}
          skipTokens={skipTokens}
          onSkipped={handleRefresh}
          onUnlocked={handleRefresh}
        />
      </div>
    </div>
  );
}
