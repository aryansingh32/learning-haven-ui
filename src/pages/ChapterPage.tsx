import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApiQuery, useApiMutation } from "@/hooks/useApi";
import { api } from "@/services/api.svc";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { StoryHook } from "@/components/chapter/StoryHook";
import { VideoSection } from "@/components/chapter/VideoSection";
import { ProblemsSection } from "@/components/chapter/ProblemsSection";
import { QuizSection } from "@/components/chapter/QuizSection";
import { TaskSection } from "@/components/chapter/TaskSection";
import { UnlockSection } from "@/components/chapter/UnlockSection";

type ChapterContent = {
  video_youtube_id?: string | null;
  video_channel?: string | null;
  video_title?: string | null;
  video_duration?: number | null;
  video_timestamps?: Array<{ label?: string; seconds?: number }> | null;
  article_url?: string | null;
  article_source?: string | null;
  article_title?: string | null;
  problems?: any[] | null;
  quiz?: any[] | null;
  tasks?: any[] | null;
};

type Chapter = {
  id: string;
  chapter_number?: number | null;
  title?: string | null;
  story_hook?: string | null;
  chapter_content?: ChapterContent;
};

type Progress = {
  status?: string;
  quiz_score?: number | null;
  quiz_attempts?: number | null;
  tasks_completed?: number | null;
  used_skip_token?: boolean | null;
};

type UserProfile = {
  skip_tokens_remaining?: number | null;
};

type ChapterResponse = {
  chapter: Chapter;
  chapter_content?: ChapterContent;
  content?: ChapterContent;
};

const ChapterPage: React.FC = () => {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/signin", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const {
    data: chapterData,
    isLoading: chapterLoading,
    error: chapterError,
    refetch: refetchChapter,
  } = useApiQuery<ChapterResponse>(
    ["chapter", chapterId],
    `/chapters/${chapterId}`
  );

  const {
    data: progress,
    isLoading: progressLoading,
    error: progressError,
    refetch: refetchProgress,
  } = useApiQuery<Progress>(
    ["chapter-progress", chapterId],
    `/chapters/${chapterId}/progress`,
    {
      enabled: !!chapterId,
    }
  );

  const {
    data: userProfile,
  } = useApiQuery<UserProfile>(
    ["user-profile-basic"],
    "/users/me",
    {
      enabled: isAuthenticated,
    }
  );

  const loading = chapterLoading || progressLoading || authLoading;
  const error = chapterError || progressError;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !chapterData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800 mb-1">
            Something went wrong
          </p>
          <p className="text-xs text-red-700 mb-3">
            We couldn&apos;t load this chapter. Please try again.
          </p>
          <button
            type="button"
            onClick={() => {
              refetchChapter();
              refetchProgress();
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const chapter = chapterData.chapter;
  const content: ChapterContent =
    (chapterData.content as ChapterContent | undefined) ??
    (chapterData.chapter_content as ChapterContent | undefined) ??
    (chapter.chapter_content as ChapterContent | undefined) ??
    {};

  const quizPassed = (progress?.quiz_score ?? 0) >= 66;
  const taskCompleted = (progress?.tasks_completed ?? 0) > 0;

  const mainTask =
    Array.isArray(content.tasks) && content.tasks.length > 0
      ? content.tasks[0]
      : null;

  const quizMutation = useApiMutation(
    (payload: { score: number; passed: boolean }) =>
      api.post(`/chapters/${chapter.id}/progress/quiz`, payload)
  );

  const handleQuizComplete = async (score: number, passed: boolean) => {
    try {
      await quizMutation.mutateAsync({ score, passed });
      await refetchProgress();
    } catch {
      // silently ignore; unlock section still uses last known progress
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <header className="mb-5">
        <p className="text-xs font-semibold text-blue-600 mb-1 uppercase">
          Chapter {chapter.chapter_number}
        </p>
        <h1 className="text-xl font-bold text-gray-900">
          {chapter.title}
        </h1>
      </header>

      {/* PART 1 — STORY HOOK */}
      <StoryHook story={chapter.story_hook} />

      {/* PART 2 — CURATED VIDEO */}
      <VideoSection
        youtubeId={content.video_youtube_id}
        channel={content.video_channel}
        durationMinutes={content.video_duration ?? undefined}
        timestamps={content.video_timestamps as any}
      />

      {/* PART 3 — CHEATSHEET */}
      {content.article_url && (
        <section className="mb-6">
          <p className="text-sm font-semibold text-gray-800 mb-2">
            📄 Read This (Just This One Article)
          </p>
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900">
              {content.article_title || "Recommended Article"}
            </p>
            {content.article_source && (
              <span className="inline-flex px-2.5 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                {content.article_source}
              </span>
            )}
            <button
              type="button"
              className="mt-2 inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700"
              onClick={() => {
                window.open(content.article_url as string, "_blank", "noopener,noreferrer");
              }}
            >
              Open Article →
            </button>
            <p className="text-[11px] text-gray-500">
              This is the only article you need for this topic.
            </p>
          </div>
        </section>
      )}

      {/* PART 4 — PRACTICE PROBLEMS */}
      <ProblemsSection problems={content.problems as any[]} />

      {/* PART 5 — MINI QUIZ */}
      <QuizSection
        chapterId={chapter.id}
        questions={(content.quiz as any[]) || []}
        onComplete={handleQuizComplete}
      />

      {/* PART 6 — TASK */}
      <TaskSection
        chapterId={chapter.id}
        task={mainTask}
        initialCompleted={taskCompleted}
      />

      {/* PART 7 — CHAPTER UNLOCK */}
      <UnlockSection
        chapterId={chapter.id}
        chapterNumber={chapter.chapter_number ?? undefined}
        quizPassed={quizPassed}
        taskCompleted={taskCompleted}
        usedSkipToken={progress?.used_skip_token ?? undefined}
        skipTokensRemaining={userProfile?.skip_tokens_remaining ?? null}
      />
    </div>
  );
};

export default ChapterPage;

