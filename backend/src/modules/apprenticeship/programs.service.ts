import { supabase } from '../../config/database';
import logger from '../../config/logger';
import {
  apprenticeshipCacheKeys,
  clearApprenticeshipCache,
  getCachedJson,
  setCachedJson,
} from './cache';
import {
  CreateProgramInput,
  Program,
  ProgramWithProjects,
  UpdateProgramInput,
} from './types';

export class ProgramsService {
  static async listActivePrograms(filters?: {
    difficulty?: string;
    tech_stack?: string;
  }): Promise<Program[]> {
    const canUseCache = !filters?.difficulty && !filters?.tech_stack;
    if (canUseCache) {
      const cached = await getCachedJson<Program[]>(apprenticeshipCacheKeys.programsList);
      if (cached) return cached;
    }

    let query = supabase
      .from('apprenticeship_programs')
      .select('*')
      .eq('status', 'active')
      .or('program_type.eq.standard,learning_paths.cs.{"apprenticeship"}')
      .order('created_at', { ascending: false });

    if (filters?.difficulty) {
      query = query.eq('difficulty_level', filters.difficulty);
    }

    if (filters?.tech_stack) {
      query = query.contains('tech_stack', [filters.tech_stack]);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error listing active programs:', error);
      throw new Error('Failed to fetch programs');
    }

    const programs = data || [];
    if (canUseCache) {
      await setCachedJson(apprenticeshipCacheKeys.programsList, programs, 300);
    }

    return programs;
  }

  static async getProgramBySlug(slug: string): Promise<ProgramWithProjects | null> {
    const cached = await getCachedJson<ProgramWithProjects>(apprenticeshipCacheKeys.programDetail(slug));
    if (cached) return cached;

    const { data: program, error } = await supabase
      .from('apprenticeship_programs')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (error || !program) {
      return null;
    }

    const { data: projects } = await supabase
      .from('apprenticeship_projects')
      .select(`
        id,
        program_id,
        project_number,
        title,
        slug,
        description,
        estimated_hours,
        verification_mode,
        verification_requirements,
        sort_order,
        is_active,
        created_at,
        updated_at
      `)
      .eq('program_id', program.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    const hydrated = {
      ...program,
      projects: (projects || []).map((project: any) => ({
        ...project,
        traditional_guide: null,
        ai_guide: null,
        starter_repo_url: null,
        reference_solution_url: null,
        helpful_resources: [],
        docker_test_image: null,
        unlock_condition: 'complete_previous',
      })),
    };

    await setCachedJson(apprenticeshipCacheKeys.programDetail(slug), hydrated, 300);
    return hydrated;
  }

  static async listAllPrograms(): Promise<Program[]> {
    const { data, error } = await supabase
      .from('apprenticeship_programs')
      .select('*')
      .or('program_type.eq.standard,learning_paths.cs.{"apprenticeship"}')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error listing all programs:', error);
      throw new Error('Failed to fetch programs');
    }

    return data || [];
  }

  static async getProgramById(id: string): Promise<ProgramWithProjects | null> {
    const { data: program, error } = await supabase
      .from('apprenticeship_programs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !program) {
      return null;
    }

    const { data: projects } = await supabase
      .from('apprenticeship_projects')
      .select('*')
      .eq('program_id', id)
      .order('sort_order', { ascending: true });

    return { ...program, projects: projects || [] };
  }

  static async createProgram(input: CreateProgramInput): Promise<Program> {
    const { data, error } = await supabase
      .from('apprenticeship_programs')
      .insert({
        title: input.title,
        slug: input.slug,
        description: input.description || null,
        duration_days: input.duration_days,
        price_inr: input.price_inr,
        original_price_inr: input.original_price_inr || null,
        tech_stack: input.tech_stack || [],
        difficulty_level: input.difficulty_level,
        total_projects: input.total_projects || 0,
        learning_paths: input.learning_paths || ['traditional', 'ai_assisted'],
        max_enrollments: input.max_enrollments || null,
        status: input.status || 'draft',
        certificate_preview_url: input.certificate_preview_url || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating program:', error);
      if (error.code === '23505') {
        throw new Error('A program with this slug already exists');
      }
      throw new Error('Failed to create program');
    }

    await clearApprenticeshipCache(apprenticeshipCacheKeys.programsList);
    return data;
  }

  static async updateProgram(id: string, input: UpdateProgramInput): Promise<Program> {
    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.duration_days !== undefined) updateData.duration_days = input.duration_days;
    if (input.price_inr !== undefined) updateData.price_inr = input.price_inr;
    if (input.original_price_inr !== undefined) updateData.original_price_inr = input.original_price_inr;
    if (input.tech_stack !== undefined) updateData.tech_stack = input.tech_stack;
    if (input.difficulty_level !== undefined) updateData.difficulty_level = input.difficulty_level;
    if (input.total_projects !== undefined) updateData.total_projects = input.total_projects;
    if (input.learning_paths !== undefined) updateData.learning_paths = input.learning_paths;
    if (input.max_enrollments !== undefined) updateData.max_enrollments = input.max_enrollments;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.certificate_preview_url !== undefined) updateData.certificate_preview_url = input.certificate_preview_url;

    const { data, error } = await supabase
      .from('apprenticeship_programs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating program:', error);
      if (error.code === '23505') {
        throw new Error('A program with this slug already exists');
      }
      throw new Error('Failed to update program');
    }

    await clearApprenticeshipCache(
      apprenticeshipCacheKeys.programsList,
      apprenticeshipCacheKeys.programDetail(data.slug)
    );
    return data;
  }

  static async archiveProgram(id: string): Promise<void> {
    const { error } = await supabase
      .from('apprenticeship_programs')
      .update({ status: 'archived' })
      .eq('id', id);

    if (error) {
      logger.error('Error archiving program:', error);
      throw new Error('Failed to archive program');
    }

    await clearApprenticeshipCache(apprenticeshipCacheKeys.programsList);
  }

  static async reorderProjects(
    programId: string,
    projectOrder: { id: string; sort_order: number }[]
  ): Promise<void> {
    const results = await Promise.all(
      projectOrder.map(({ id, sort_order }) =>
        supabase
          .from('apprenticeship_projects')
          .update({ sort_order })
          .eq('id', id)
          .eq('program_id', programId)
      )
    );

    const hasError = results.find((result) => result.error);
    if (hasError) {
      logger.error('Error reordering projects:', hasError.error);
      throw new Error('Failed to reorder projects');
    }

    const { data: program } = await supabase
      .from('apprenticeship_programs')
      .select('slug')
      .eq('id', programId)
      .single();

    if (program?.slug) {
      await clearApprenticeshipCache(apprenticeshipCacheKeys.programDetail(program.slug));
    }
  }

  static async getLeaderboard(programId: string, type: string) {
    const cacheKey = apprenticeshipCacheKeys.leaderboard(programId, type);
    const cached = await getCachedJson<any[]>(cacheKey);
    if (cached) return cached;

    if (type === 'helpful') {
      const { data, error } = await supabase
        .from('apprenticeship_posts')
        .select('user_id, upvotes')
        .eq('program_id', programId)
        .eq('is_deleted', false)
        .order('upvotes', { ascending: false })
        .limit(20);

      if (error) {
        logger.error('Error fetching helpful leaderboard:', error);
        throw new Error('Failed to fetch leaderboard');
      }

      const leaderboard = (data || []).map((row, index) => ({
        rank: index + 1,
        user_id: row.user_id,
        score: row.upvotes || 0,
      }));

      await setCachedJson(cacheKey, leaderboard, 300);
      return leaderboard;
    }

    const { data, error } = await supabase
      .from('apprenticeship_enrollments')
      .select(`
        id,
        user_id,
        completed_projects,
        progress_percentage,
        enrolled_at,
        status,
        apprenticeship_project_progress (
          best_code_quality_score
        )
      `)
      .eq('program_id', programId)
      .limit(100);

    if (error) {
      logger.error('Error fetching leaderboard enrollments:', error);
      throw new Error('Failed to fetch leaderboard');
    }

    const ranked = (data || []).map((row: any) => {
      const qualityScores = (row.apprenticeship_project_progress || [])
        .map((progress: any) => progress.best_code_quality_score)
        .filter((value: number | null) => typeof value === 'number');

      const avgQuality = qualityScores.length
        ? qualityScores.reduce((sum: number, score: number) => sum + score, 0) / qualityScores.length
        : 0;

      return {
        user_id: row.user_id,
        completed_projects: row.completed_projects || 0,
        progress_percentage: row.progress_percentage || 0,
        enrolled_at: row.enrolled_at,
        avg_quality_score: Math.round(avgQuality),
      };
    });

    ranked.sort((a, b) => {
      if (type === 'quality') {
        return b.avg_quality_score - a.avg_quality_score;
      }

      if (b.completed_projects !== a.completed_projects) {
        return b.completed_projects - a.completed_projects;
      }

      return new Date(a.enrolled_at).getTime() - new Date(b.enrolled_at).getTime();
    });

    const leaderboard = ranked.slice(0, 20).map((row, index) => ({
      rank: index + 1,
      ...row,
    }));

    await setCachedJson(cacheKey, leaderboard, 300);
    return leaderboard;
  }

  static async verifyCertificate(code: string) {
    const { data, error } = await supabase
      .from('apprenticeship_certificates')
      .select('*')
      .eq('verification_code', code)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }
}
