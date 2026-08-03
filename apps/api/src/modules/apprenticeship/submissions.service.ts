import { supabase as supabaseAdmin } from '../../config/database';
import logger from '../../config/logger';

export class SubmissionsService {
  static async getSubmissionStatus(submissionId: string, userId: string) {
    const { data, error } = await supabaseAdmin
      .from('apprenticeship_submissions')
      .select('*')
      .eq('id', submissionId)
      .eq('user_id', userId)
      .single();

    if (error) {
      logger.error(`Error fetching submission ${submissionId}:`, error);
      throw new Error('Failed to fetch submission');
    }

    return data;
  }

  static async getTestStages(submissionId: string) {
    const { data, error } = await supabaseAdmin
      .from('apprenticeship_test_stages')
      .select('*')
      .eq('submission_id', submissionId)
      .order('stage_number', { ascending: true });

    if (error) {
      logger.error(`Error fetching stages for submission ${submissionId}:`, error);
      throw new Error('Failed to fetch test stages');
    }

    return data || [];
  }

  static async getMySubmissions(userId: string, enrollmentId?: string, projectId?: string) {
    let query = supabaseAdmin
      .from('apprenticeship_submissions')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });

    if (enrollmentId) {
      query = query.eq('enrollment_id', enrollmentId);
    }

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching user submissions:', error);
      throw new Error('Failed to fetch submissions');
    }

    return data || [];
  }

  static async adminListSubmissions(filters: Record<string, string | undefined>) {
    let query = supabaseAdmin
      .from('apprenticeship_submissions')
      .select(`
        *,
        users:user_id (id, full_name, email),
        apprenticeship_projects:project_id (id, title, project_number, program_id),
        apprenticeship_enrollments:enrollment_id (
          id,
          program_id,
          apprenticeship_programs:program_id (id, title, slug)
        )
      `)
      .order('submitted_at', { ascending: false })
      .limit(200);

    if (filters.status) query = query.eq('verification_status', filters.status);
    if (filters.projectId) query = query.eq('project_id', filters.projectId);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.from) query = query.gte('submitted_at', filters.from);
    if (filters.to) query = query.lte('submitted_at', filters.to);

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching admin submissions:', error);
      throw new Error('Failed to fetch submissions');
    }

    return data || [];
  }

  static async adminReviewSubmission(
    submissionId: string,
    reviewerId: string,
    payload: {
      status: 'passed' | 'failed';
      reviewer_notes?: string;
      code_quality_override?: number | null;
      xp_bonus?: number;
    }
  ) {
    const verificationStatus = payload.status === 'passed' ? 'manual_passed' : 'manual_failed';
    const { data, error } = await supabaseAdmin
      .from('apprenticeship_submissions')
      .update({
        verification_status: verificationStatus,
        reviewer_id: reviewerId,
        reviewer_notes: payload.reviewer_notes || null,
        code_quality_override: payload.code_quality_override ?? null,
        xp_bonus: payload.xp_bonus || 0,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select(`
        *,
        users:user_id (id, full_name, email),
        apprenticeship_projects:project_id (id, title, project_number, program_id),
        apprenticeship_enrollments:enrollment_id (
          id,
          program_id,
          apprenticeship_programs:program_id (id, title, slug)
        )
      `)
      .single();

    if (error) {
      logger.error('Error reviewing submission:', error);
      throw new Error('Failed to review submission');
    }

    return data;
  }
}
