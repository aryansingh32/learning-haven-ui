import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCourse, fetchPhases, fetchPhaseChapters, type CourseChaptersResponse } from '@/data/chapters';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type CourseChapter = {
  id: string;
  chapter_number: number;
  title: string;
  topic_tag?: string;
  difficulty?: string;
  est_minutes?: number;
  story_hook?: string;
  status: 'LOCKED' | 'UNLOCKED' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED_PAYWALL';
  total_steps: number;
  completed_steps: number;
  /** Drip release: when the chapter opens (null before the learner starts, or without drip). */
  available_at?: string | null;
  /** Drip release: days after starting the course when it opens. */
  available_after_days?: number | null;
  drip_locked?: boolean;
};

export type CourseGateInfo = Omit<CourseChaptersResponse, 'chapters'>;

export function useLearnCourse(courseId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Several components use this hook at once (roadmap, dashboard, path card). Supabase hands back the
  // existing channel for a topic it already has, and adding a listener to a subscribed channel throws,
  // so each instance gets its own topic.
  const instanceId = useId();

  const phasesQuery = useQuery({
    queryKey: ['learn-phases'],
    queryFn: async () => {
      const courses = await fetchPhases();
      return Array.isArray(courses) ? courses : [];
    },
    staleTime: 60_000,
  });

  const listedCourse = courseId
    ? phasesQuery.data?.find((p: any) => p.id === courseId)
    : phasesQuery.data?.[0];

  // Courses outside the public catalogue (a college's own courses) are loaded on their
  // own; the server only returns them to the people they're meant for.
  const unlistedQuery = useQuery({
    queryKey: ['learn-course', courseId],
    queryFn: () => fetchCourse(courseId!),
    enabled: Boolean(courseId) && phasesQuery.isSuccess && !listedCourse,
    staleTime: 60_000,
    retry: false,
  });
  const activeCourse = listedCourse ?? unlistedQuery.data;

  const chaptersQuery = useQuery({
    queryKey: ['learn-chapters', activeCourse?.id],
    queryFn: async () => {
      if (!activeCourse?.id) return { chapters: [] as CourseChapter[], gate: {} as CourseGateInfo };
      const res = await fetchPhaseChapters(activeCourse.id);
      const { chapters, ...gate } = res || { chapters: [] };
      return { chapters: (chapters || []) as CourseChapter[], gate: gate as CourseGateInfo };
    },
    enabled: Boolean(activeCourse?.id),
    staleTime: 15_000,
    retry: (failureCount, error: any) => {
      if (error?.status === 403 || error?.response?.status === 403) return false;
      return failureCount < 2;
    }
  });

  useEffect(() => {
    if (!supabase || !user?.id) return;

    const channel = supabase
      .channel(`learn-progress:${user.id}:${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_chapter_progress',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['learn-chapters'] });
          void qc.invalidateQueries({ queryKey: ['chapter'] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc, instanceId]);

  const chapters = [...(chaptersQuery.data?.chapters || [])].sort((a, b) => a.chapter_number - b.chapter_number);
  const completedCount = chapters.filter((c) => c.status === 'COMPLETED').length;
  const progressPercent = chapters.length
    ? Math.round((completedCount / chapters.length) * 100)
    : 0;

  // Find first non-completed, non-locked chapter that still has pending steps
  const activeChapter =
    chapters.find((c) => (c.status === 'IN_PROGRESS' || c.status === 'UNLOCKED') && c.completed_steps < c.total_steps) ||
    chapters.find((c) => c.status !== 'COMPLETED' && c.status !== 'LOCKED') || 
    chapters[chapters.length - 1];

  return {
    course: activeCourse,
    chapters,
    isLoading: phasesQuery.isLoading || unlistedQuery.isLoading || chaptersQuery.isLoading,
    completedCount,
    progressPercent,
    activeChapter,
    gate: chaptersQuery.data?.gate,
    refetch: chaptersQuery.refetch,
  };
}
