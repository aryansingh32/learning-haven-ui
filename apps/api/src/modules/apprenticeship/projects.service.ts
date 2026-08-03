import { supabase } from '../../config/database';
import logger from '../../config/logger';
import { apprenticeshipCacheKeys, clearApprenticeshipCache } from './cache';
import { CreateProjectInput, Project, UpdateProjectInput } from './types';

export class ProjectsService {
  static async createProject(programId: string, input: CreateProjectInput): Promise<Project> {
    let sortOrder = input.sort_order;

    if (sortOrder === undefined) {
      const { data: existing } = await supabase
        .from('apprenticeship_projects')
        .select('sort_order')
        .eq('program_id', programId)
        .order('sort_order', { ascending: false })
        .limit(1);

      sortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;
    }

    const { data, error } = await supabase
      .from('apprenticeship_projects')
      .insert({
        program_id: programId,
        project_number: input.project_number,
        title: input.title,
        slug: input.slug,
        description: input.description || null,
        estimated_hours: input.estimated_hours || null,
        traditional_guide: input.traditional_guide || null,
        ai_guide: input.ai_guide || null,
        starter_repo_url: input.starter_repo_url || null,
        reference_solution_url: input.reference_solution_url || null,
        helpful_resources: input.helpful_resources || [],
        verification_mode: input.verification_mode || 'automated',
        verification_requirements: input.verification_requirements || null,
        docker_test_image: input.docker_test_image || null,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating project:', error);
      if (error.code === '23505') {
        throw new Error('A project with this number already exists in this program');
      }
      throw new Error('Failed to create project');
    }

    await this.syncProgramProjectCount(programId);
    await this.clearProgramDetailCache(programId);
    return data;
  }

  static async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.project_number !== undefined) updateData.project_number = input.project_number;
    if (input.estimated_hours !== undefined) updateData.estimated_hours = input.estimated_hours;
    if (input.traditional_guide !== undefined) updateData.traditional_guide = input.traditional_guide;
    if (input.ai_guide !== undefined) updateData.ai_guide = input.ai_guide;
    if (input.starter_repo_url !== undefined) updateData.starter_repo_url = input.starter_repo_url;
    if (input.reference_solution_url !== undefined) updateData.reference_solution_url = input.reference_solution_url;
    if (input.helpful_resources !== undefined) updateData.helpful_resources = input.helpful_resources;
    if (input.verification_mode !== undefined) updateData.verification_mode = input.verification_mode;
    if (input.verification_requirements !== undefined) updateData.verification_requirements = input.verification_requirements;
    if (input.docker_test_image !== undefined) updateData.docker_test_image = input.docker_test_image;
    if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;

    const { data, error } = await supabase
      .from('apprenticeship_projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating project:', error);
      throw new Error('Failed to update project');
    }

    await this.clearProgramDetailCache(data.program_id);
    return data;
  }

  static async deleteProject(id: string): Promise<void> {
    const { data: project } = await supabase
      .from('apprenticeship_projects')
      .select('program_id')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('apprenticeship_projects')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      logger.error('Error deleting project:', error);
      throw new Error('Failed to delete project');
    }

    if (project) {
      await this.syncProgramProjectCount(project.program_id);
      await this.clearProgramDetailCache(project.program_id);
    }
  }

  static async getProjectById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('apprenticeship_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  static async getProjectsByProgram(programId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('apprenticeship_projects')
      .select('*')
      .eq('program_id', programId)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Error listing projects:', error);
      throw new Error('Failed to fetch projects');
    }

    return data || [];
  }

  static async getProjectWorkspace(projectId: string, userId: string) {
    const { data: project, error: projectError } = await supabase
      .from('apprenticeship_projects')
      .select('*')
      .eq('id', projectId)
      .eq('is_active', true)
      .single();

    if (projectError || !project) {
      return null;
    }

    const { data: progress } = await supabase
      .from('apprenticeship_project_progress')
      .select(`
        *,
        apprenticeship_enrollments!inner (
          id,
          program_id,
          learning_path,
          status,
          progress_percentage,
          expires_at
        )
      `)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    return {
      project,
      progress,
    };
  }

  static async startProject(
    projectId: string,
    userId: string,
    repo: {
      github_repo_full_name: string;
      github_repo_url: string;
      webhook_secret: string;
    }
  ) {
    const { data, error } = await supabase
      .from('apprenticeship_project_progress')
      .update({
        status: 'in_progress',
        github_repo_full_name: repo.github_repo_full_name,
        github_repo_url: repo.github_repo_url,
        webhook_secret: repo.webhook_secret,
        started_at: new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .in('status', ['available', 'in_progress'])
      .select()
      .single();

    if (error) {
      logger.error('Error starting project:', error);
      throw new Error('Failed to start project');
    }

    return data;
  }

  private static async syncProgramProjectCount(programId: string) {
    const { count, error } = await supabase
      .from('apprenticeship_projects')
      .select('id', { head: true, count: 'exact' })
      .eq('program_id', programId)
      .eq('is_active', true);

    if (error) {
      logger.error('Error counting program projects:', error);
      throw new Error('Failed to sync project count');
    }

    await supabase
      .from('apprenticeship_programs')
      .update({ total_projects: count || 0 })
      .eq('id', programId);
  }

  private static async clearProgramDetailCache(programId: string) {
    const { data } = await supabase
      .from('apprenticeship_programs')
      .select('slug')
      .eq('id', programId)
      .maybeSingle();

    if (data?.slug) {
      await clearApprenticeshipCache(
        apprenticeshipCacheKeys.programsList,
        apprenticeshipCacheKeys.programDetail(data.slug)
      );
    }
  }
}
