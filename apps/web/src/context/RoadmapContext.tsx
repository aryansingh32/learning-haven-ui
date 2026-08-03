/**
 * RoadmapContext — Global learning roadmap state.
 *
 * Provides every component with access to the user's:
 * - Selected career track
 * - Week-by-week roadmap
 * - Knowledge graph (per-topic proficiency)
 * - Career readiness metrics
 * - Learning momentum / churn risk
 * - Adaptive difficulty hints
 *
 * This context is the "North Star" — all pages revolve around the roadmap.
 * It reads from existing API endpoints and augments them.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useApiQuery } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { useLearnCourse } from '@/hooks/useLearnCourse';
import type { Mission, Identity, MentorContext } from '@/lib/gamification';

// ─── Knowledge Graph Types ──────────────────────────────────────────────────

export type KnowledgeNode = {
  topic: string;
  proficiency: number; // 0-100
  solved: number;
  total: number;
  lastPracticed?: string;
};

export type CareerReadiness = {
  targetRole: string;
  readinessPercent: number;
  salaryBand: string;
  skillsLearned: number;
  skillsMissing: string[];
  targetCompanies: string[];
  projectsBuilt: number;
  interviewReadiness: number;
};

export type LearningMomentum = {
  velocityScore: number;        // 0-100 (how fast they learn)
  consistencyScore: number;     // 0-100 (how regular)
  churnRisk: 'low' | 'medium' | 'high';
  daysInactive: number;
  averageSessionMinutes: number;
  lastLoginDate: string | null;
};

export type RoadmapWeek = {
  week: number;
  title: string;
  topics: string[];
  status: 'completed' | 'current' | 'upcoming' | 'locked';
  progress: number; // 0-100
};

export type RoadmapState = {
  // Career
  targetRole: string | null;
  careerReadiness: CareerReadiness | null;

  // Knowledge
  knowledgeGraph: KnowledgeNode[];
  weakAreas: KnowledgeNode[];
  strongAreas: KnowledgeNode[];

  // Roadmap
  roadmapWeeks: RoadmapWeek[];
  currentWeek: RoadmapWeek | null;

  // Momentum
  momentum: LearningMomentum | null;

  // Existing data passthrough
  mission: Mission | null;
  identity: Identity | null;
  mentorContext: MentorContext | null;

  // Loading states
  isLoading: boolean;
};

const defaultState: RoadmapState = {
  targetRole: null,
  careerReadiness: null,
  knowledgeGraph: [],
  weakAreas: [],
  strongAreas: [],
  roadmapWeeks: [],
  currentWeek: null,
  momentum: null,
  mission: null,
  identity: null,
  mentorContext: null,
  isLoading: true,
};

const RoadmapContext = createContext<RoadmapState>(defaultState);

/**
 * Derive knowledge graph from existing topic progress data.
 * This builds the graph from what we already have — no new backend needed.
 */
function deriveKnowledgeGraph(topicProgress: any[] | undefined): KnowledgeNode[] {
  if (!topicProgress || !Array.isArray(topicProgress)) return [];
  return topicProgress.map((t) => ({
    topic: t.topic,
    proficiency: t.progress || 0,
    solved: t.solved || 0,
    total: t.total || 0,
    lastPracticed: t.last_solved_at || undefined,
  }));
}

/**
 * Derive career readiness from mission + stats.
 */
function deriveCareerReadiness(
  mission: Mission | null | undefined,
  stats: any,
  knowledgeGraph: KnowledgeNode[]
): CareerReadiness | null {
  const career = mission?.career;
  if (!career && !mission?.pathTitle) return null;

  const weakTopics = knowledgeGraph
    .filter((k) => k.proficiency < 40)
    .map((k) => k.topic);

  return {
    targetRole: mission?.pathTitle || 'Developer',
    readinessPercent: career?.interviewReadiness ?? mission?.progress ?? 0,
    salaryBand: career?.salaryBand ?? '₹4-8 LPA',
    skillsLearned: career?.skillsLearned ?? knowledgeGraph.filter((k) => k.proficiency >= 60).length,
    skillsMissing: weakTopics.slice(0, 5),
    targetCompanies: ['TCS', 'Infosys', 'Wipro', 'Accenture', 'Amazon'],
    projectsBuilt: career?.projectsBuilt ?? 0,
    interviewReadiness: career?.interviewReadiness ?? 0,
  };
}

/**
 * Derive learning momentum from stats + heatmap.
 */
function deriveMomentum(stats: any, mentorCtx: MentorContext | null | undefined): LearningMomentum | null {
  if (!stats) return null;

  const daysInactive = mentorCtx?.context?.daysInactive ?? 0;
  const streak = stats.streak || 0;

  let churnRisk: 'low' | 'medium' | 'high' = 'low';
  if (daysInactive >= 7) churnRisk = 'high';
  else if (daysInactive >= 3 || streak === 0) churnRisk = 'medium';

  return {
    velocityScore: Math.min(100, (stats.total_solved || 0) * 2),
    consistencyScore: Math.min(100, streak * 10),
    churnRisk,
    daysInactive,
    averageSessionMinutes: 30, // placeholder; can be computed from analytics
    lastLoginDate: null,
  };
}

/**
 * Derive roadmap weeks from course chapters.
 */
function deriveRoadmapWeeks(
  chapters: any[],
  progressPercent: number
): RoadmapWeek[] {
  if (!chapters.length) return [];

  // Group chapters into weeks (roughly 2-3 chapters per week)
  const chaptersPerWeek = 2;
  const weeks: RoadmapWeek[] = [];

  for (let i = 0; i < chapters.length; i += chaptersPerWeek) {
    const slice = chapters.slice(i, i + chaptersPerWeek);
    const weekNum = Math.floor(i / chaptersPerWeek) + 1;
    const allCompleted = slice.every((c: any) => c.status === 'COMPLETED');
    const anyInProgress = slice.some(
      (c: any) => c.status === 'IN_PROGRESS' || c.status === 'UNLOCKED'
    );
    const allLocked = slice.every((c: any) => c.status === 'LOCKED');

    let status: RoadmapWeek['status'] = 'upcoming';
    if (allCompleted) status = 'completed';
    else if (anyInProgress) status = 'current';
    else if (allLocked) status = 'locked';

    const completedInSlice = slice.filter((c: any) => c.status === 'COMPLETED').length;
    const progress = Math.round((completedInSlice / slice.length) * 100);

    weeks.push({
      week: weekNum,
      title: slice.map((c: any) => c.title || c.topic_tag || `Chapter ${c.chapter_number}`).join(' & '),
      topics: slice.map((c: any) => c.topic_tag || c.title).filter(Boolean),
      status,
      progress,
    });
  }

  return weeks;
}

export const RoadmapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Re-use existing hooks & queries — no new backend endpoints needed
  const { chapters, progressPercent, course, isLoading: chaptersLoading } = useLearnCourse();

  const { data: mission, isLoading: missionLoading } = useApiQuery<Mission>(
    ['user-mission'],
    '/users/me/mission',
  );

  const { data: identity, isLoading: identityLoading } = useApiQuery<Identity>(
    ['user-identity'],
    '/users/me/identity',
  );

  const { data: mentorContext, isLoading: mentorLoading } = useApiQuery<MentorContext>(
    ['mentor-context'],
    '/users/me/mentor-context',
  );

  const { data: topicProgress } = useApiQuery<any[]>(
    ['topic-progress'],
    '/users/me/progress',
  );

  const { data: profileStats } = useApiQuery<any>(
    ['user-profile-stats'],
    '/users/me/stats',
  );

  const state = useMemo<RoadmapState>(() => {
    const knowledgeGraph = deriveKnowledgeGraph(topicProgress);
    const weakAreas = [...knowledgeGraph]
      .filter((k) => k.proficiency < 40 && k.total > 0)
      .sort((a, b) => a.proficiency - b.proficiency);
    const strongAreas = [...knowledgeGraph]
      .filter((k) => k.proficiency >= 60)
      .sort((a, b) => b.proficiency - a.proficiency);

    const careerReadiness = deriveCareerReadiness(mission, profileStats, knowledgeGraph);
    const momentum = deriveMomentum(profileStats, mentorContext);
    const roadmapWeeks = deriveRoadmapWeeks(chapters, progressPercent);
    const currentWeek = roadmapWeeks.find((w) => w.status === 'current') || null;

    return {
      targetRole: mission?.pathTitle || null,
      careerReadiness,
      knowledgeGraph,
      weakAreas,
      strongAreas,
      roadmapWeeks,
      currentWeek,
      momentum,
      mission: mission || null,
      identity: identity || null,
      mentorContext: mentorContext || null,
      isLoading: chaptersLoading || missionLoading || identityLoading || mentorLoading,
    };
  }, [
    topicProgress, mission, profileStats, mentorContext,
    chapters, progressPercent, identity,
    chaptersLoading, missionLoading, identityLoading, mentorLoading,
  ]);

  return (
    <RoadmapContext.Provider value={state}>
      {children}
    </RoadmapContext.Provider>
  );
};

export const useRoadmap = () => useContext(RoadmapContext);
