import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPhases, fetchPhaseChapters } from '@/data/chapters';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type RoadmapChapter = {
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

export function useLearnRoadmap() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const phasesQuery = useQuery({
    queryKey: ['learn-phases'],
    queryFn: async () => {
      const roadmaps = await fetchPhases();
      return Array.isArray(roadmaps) ? roadmaps : [];
    },
    staleTime: 60_000,
  });

  const activeRoadmap = phasesQuery.data?.[0];

  const chaptersQuery = useQuery({
    queryKey: ['learn-chapters', activeRoadmap?.id],
    queryFn: async () => {
      if (!activeRoadmap?.id) return [];
      const res = await fetchPhaseChapters(activeRoadmap.id);
      return (res?.chapters || []) as RoadmapChapter[];
    },
    enabled: Boolean(activeRoadmap?.id),
    staleTime: 15_000,
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

  const chapters = chaptersQuery.data || [];
  const completedCount = chapters.filter((c) => c.status === 'COMPLETED').length;
  const progressPercent = chapters.length
    ? Math.round((completedCount / chapters.length) * 100)
    : 0;

  const activeChapter =
    chapters.find((c) => c.status === 'IN_PROGRESS' || c.status === 'UNLOCKED') ||
    chapters.find((c) => c.status !== 'COMPLETED' && c.status !== 'LOCKED');

  return {
    roadmap: activeRoadmap,
    chapters,
    isLoading: phasesQuery.isLoading || chaptersQuery.isLoading,
    completedCount,
    progressPercent,
    activeChapter,
    refetch: chaptersQuery.refetch,
  };
}
