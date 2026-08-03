import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPhases, fetchPhaseChapters } from '@/data/chapters';
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
  status: 'LOCKED' | 'UNLOCKED' | 'IN_PROGRESS' | 'COMPLETED';
  total_steps: number;
  completed_steps: number;
};

export function useLearnCourse(courseId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const phasesQuery = useQuery({
    queryKey: ['learn-phases'],
    queryFn: async () => {
      const courses = await fetchPhases();
      return Array.isArray(courses) ? courses : [];
    },
    staleTime: 60_000,
  });

  const activeCourse = courseId 
    ? phasesQuery.data?.find((p: any) => p.id === courseId)
    : phasesQuery.data?.[0];

  const chaptersQuery = useQuery({
    queryKey: ['learn-chapters', activeCourse?.id],
    queryFn: async () => {
      if (!activeCourse?.id) return [];
      const res = await fetchPhaseChapters(activeCourse.id);
      return (res?.chapters || []) as CourseChapter[];
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
      .channel(`learn-progress:${user.id}`)
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
  }, [user?.id, qc]);

  const chapters = (chaptersQuery.data || []).sort((a, b) => a.chapter_number - b.chapter_number);
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
    isLoading: phasesQuery.isLoading || chaptersQuery.isLoading,
    completedCount,
    progressPercent,
    activeChapter,
    refetch: chaptersQuery.refetch,
  };
}
