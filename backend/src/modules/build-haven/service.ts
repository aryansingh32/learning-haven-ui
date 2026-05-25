import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { supabase } from '../../config/database';
import logger from '../../config/logger';
import { GitHubService } from '../github/github.service';
import { validateBuildLanguageConfig } from './validation';
import { CreateBuildChallengeInput, CreateBuildStageInput, UpsertLanguageInput, UpdateBuildChallengeInput, UpdateBuildStageInput } from './types';

export class BuildHavenService {
  static async listChallenges(filters?: { difficulty?: string; status?: string; language?: string }) {
    let query = supabase
      .from('apprenticeship_programs')
      .select('*')
      .eq('program_type', 'build_challenge')
      .order('created_at', { ascending: false });

    if (filters?.difficulty) query = query.eq('difficulty_level', filters.difficulty);
    if (filters?.status) {
      if (filters.status === 'active' || filters.status === 'live') {
        query = query.in('status', ['active', 'beta', 'live']);
      } else {
        query = query.eq('status', filters.status);
      }
    }
    if (filters?.language) query = query.contains('supported_languages', [filters.language]);

    const { data, error } = await query;
    if (error) throw error;

    const challenges = data || [];
    if (challenges.length === 0) return challenges;

    const programIds = challenges.map((challenge: any) => challenge.id);
    const { data: stageRows } = await supabase
      .from('build_stages')
      .select('program_id')
      .in('program_id', programIds)
      .eq('is_active', true);

    const stageCountByProgram = new Map<string, number>();
    (stageRows || []).forEach((row: any) => {
      stageCountByProgram.set(row.program_id, (stageCountByProgram.get(row.program_id) || 0) + 1);
    });

    return challenges.map((challenge: any) => ({
      ...challenge,
      stages_count: stageCountByProgram.get(challenge.id) || 0,
    }));
  }

  static async getChallengeBySlug(slug: string) {
    const { data: program, error } = await supabase
      .from('apprenticeship_programs')
      .select('*')
      .eq('slug', slug)
      .eq('program_type', 'build_challenge')
      .single();

    if (error || !program) return null;

    const [{ data: stages }, { data: languages }] = await Promise.all([
      supabase
        .from('build_stages')
        .select('*')
        .eq('program_id', program.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('build_challenge_languages')
        .select('*')
        .eq('program_id', program.id)
        .order('language', { ascending: true }),
    ]);

    return {
      ...program,
      stages: stages || [],
      languages: languages || [],
    };
  }

  static async getChallengeById(id: string) {
    const { data, error } = await supabase
      .from('apprenticeship_programs')
      .select('*')
      .eq('id', id)
      .eq('program_type', 'build_challenge')
      .single();

    if (error || !data) return null;
    return data;
  }

  static async createChallenge(input: CreateBuildChallengeInput) {
    const { data, error } = await supabase
      .from('apprenticeship_programs')
      .insert({
        title: input.title,
        slug: input.slug,
        description: input.description || null,
        short_tagline: input.short_tagline || null,
        thumbnail_url: input.thumbnail_url || null,
        difficulty_level: input.difficulty_level,
        is_free: input.is_free ?? false,
        what_you_build: input.what_you_build || null,
        what_you_learn: input.what_you_learn || null,
        why_build: input.why_build || null,
        prerequisites_content: input.prerequisites_content || null,
        supported_languages: input.supported_languages || [],
        status: input.status || 'draft',
        program_type: 'build_challenge',
        price_inr: input.price_inr || 0,
        original_price_inr: input.original_price_inr || null,
        duration_days: input.duration_days || 30,
        total_projects: 0,
        learning_paths: ['build'],
        tech_stack: input.supported_languages || [],
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateChallenge(id: string, input: UpdateBuildChallengeInput) {
    const payload = { ...input } as Record<string, unknown>;
    if (Array.isArray(input.supported_languages)) {
      payload.tech_stack = input.supported_languages;
    }

    const { data, error } = await supabase
      .from('apprenticeship_programs')
      .update(payload)
      .eq('id', id)
      .eq('program_type', 'build_challenge')
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async listStages(programId: string) {
    const { data, error } = await supabase
      .from('build_stages')
      .select('*')
      .eq('program_id', programId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async createStage(programId: string, input: CreateBuildStageInput) {
    let sortOrder = input.sort_order;
    if (sortOrder === undefined) {
      const { data: existing } = await supabase
        .from('build_stages')
        .select('sort_order')
        .eq('program_id', programId)
        .order('sort_order', { ascending: false })
        .limit(1);
      sortOrder = existing?.[0] ? existing[0].sort_order + 1 : 1;
    }

    const { data, error } = await supabase
      .from('build_stages')
      .insert({
        program_id: programId,
        stage_number: input.stage_number,
        title: input.title,
        difficulty: input.difficulty || 'medium',
        description: input.description || null,
        instructions: input.instructions || null,
        code_example: input.code_example || null,
        hints: input.hints || [],
        test_command: input.test_command || null,
        docker_test_image: input.docker_test_image ?? null,
        timeout_seconds: input.timeout_seconds ?? 120,
        expected_exit_code: input.expected_exit_code ?? 0,
        success_criteria: input.success_criteria || {},
        estimated_minutes: input.estimated_minutes || null,
        docs_url: input.docs_url || null,
        concepts_content: input.concepts_content || null,
        image_url: input.image_url || null,
        sort_order: sortOrder,
      })
      .select()
      .single();
    if (error) throw error;

    await this.syncStageCount(programId);
    return data;
  }

  static async updateStage(stageId: string, input: UpdateBuildStageInput) {
    const { data, error } = await supabase
      .from('build_stages')
      .update(input as Record<string, unknown>)
      .eq('id', stageId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async reorderStages(programId: string, order: { id: string; sort_order: number }[]) {
    await Promise.all(order.map((item) => (
      supabase
        .from('build_stages')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
        .eq('program_id', programId)
    )));

    const { data: activeStages } = await supabase
      .from('build_stages')
      .select('id')
      .eq('program_id', programId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (activeStages?.length) {
      await Promise.all(
        activeStages.map((row, index) =>
          supabase.from('build_stages').update({ stage_number: index + 1 }).eq('id', row.id)
        )
      );
    }

    await this.syncStageCount(programId);
  }

  static async deleteStage(stageId: string) {
    const { data: stage } = await supabase
      .from('build_stages')
      .select('program_id')
      .eq('id', stageId)
      .single();

    const { error } = await supabase
      .from('build_stages')
      .update({ is_active: false })
      .eq('id', stageId);
    if (error) throw error;

    if (stage?.program_id) {
      await this.syncStageCount(stage.program_id);
    }
  }

  static async listLanguages(programId: string) {
    const { data, error } = await supabase
      .from('build_challenge_languages')
      .select('*')
      .eq('program_id', programId)
      .order('language', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async upsertLanguage(programId: string, input: UpsertLanguageInput) {
    const validationError = validateBuildLanguageConfig(input);
    if (validationError) {
      throw new Error(validationError);
    }

    const { data, error } = await supabase
      .from('build_challenge_languages')
      .upsert({
        program_id: programId,
        language: input.language,
        starter_repo_url: input.starter_repo_url,
        docker_test_image: input.docker_test_image || null,
        setup_instructions: input.setup_instructions || null,
      }, { onConflict: 'program_id,language' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async updateLanguage(languageId: string, input: Partial<UpsertLanguageInput>) {
    if (input.language !== undefined || input.starter_repo_url !== undefined) {
      const { data: existing } = await supabase
        .from('build_challenge_languages')
        .select('language, starter_repo_url, docker_test_image')
        .eq('id', languageId)
        .single();
      if (existing) {
        const validationError = validateBuildLanguageConfig({
          language: input.language ?? existing.language,
          starter_repo_url: input.starter_repo_url ?? existing.starter_repo_url,
          docker_test_image: input.docker_test_image ?? existing.docker_test_image,
        });
        if (validationError) throw new Error(validationError);
      }
    }

    const payload: Record<string, unknown> = {};
    if (input.language !== undefined) payload.language = input.language;
    if (input.starter_repo_url !== undefined) payload.starter_repo_url = input.starter_repo_url;
    if (input.docker_test_image !== undefined) payload.docker_test_image = input.docker_test_image || null;
    if (input.setup_instructions !== undefined) payload.setup_instructions = input.setup_instructions || null;

    const { data, error } = await supabase
      .from('build_challenge_languages')
      .update(payload)
      .eq('id', languageId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async removeLanguage(programId: string, language: string) {
    const { error } = await supabase
      .from('build_challenge_languages')
      .delete()
      .eq('program_id', programId)
      .eq('language', language);
    if (error) throw error;
  }

  static async removeLanguageById(languageId: string) {
    const { error } = await supabase
      .from('build_challenge_languages')
      .delete()
      .eq('id', languageId);
    if (error) throw error;
  }

  static async getWorkspace(userId: string, slug: string, language?: string) {
    const challenge = await this.getChallengeBySlug(slug);
    if (!challenge) return null;

    let enrollmentQuery = supabase
      .from('build_enrollments')
      .select('*')
      .eq('user_id', userId)
      .eq('program_id', challenge.id);

    if (language) {
      enrollmentQuery = enrollmentQuery.eq('language', language);
    }

    const { data: enrollmentRows } = await enrollmentQuery.order('updated_at', { ascending: false });
    const enrollment = enrollmentRows?.[0] || null;

    let attempts: any[] = [];
    if (enrollment?.id) {
      const { data: attemptRows } = await supabase
        .from('build_stage_results')
        .select('*, build_stages!inner(stage_number, title)')
        .eq('user_id', userId)
        .eq('enrollment_id', enrollment.id)
        .order('created_at', { ascending: false })
        .limit(50);
      attempts = attemptRows || [];
    }

    return { challenge, enrollment, attempts };
  }

  static async startChallenge(userId: string, slug: string, language: string) {
    const challenge = await this.getChallengeBySlug(slug);
    if (!challenge) throw new Error('Challenge not found');

    const languageConfig = (challenge.languages || []).find((l: any) => l.language === language);
    if (!languageConfig) throw new Error('Language is not configured for this challenge');

    const configError = validateBuildLanguageConfig({
      language: languageConfig.language,
      starter_repo_url: languageConfig.starter_repo_url,
      docker_test_image: languageConfig.docker_test_image,
    });
    if (configError) throw new Error(configError);

    const { data: enrollment } = await supabase
      .from('build_enrollments')
      .select('*')
      .eq('user_id', userId)
      .eq('program_id', challenge.id)
      .eq('language', language)
      .maybeSingle();

    if (enrollment?.repo_url) {
      return { enrollment, repository: null, clone_command: `git clone ${enrollment.repo_url}` };
    }

    const repo = await GitHubService.provisionRepository(
      userId,
      challenge.slug,
      language,
      languageConfig.starter_repo_url
    );

    const totalStages = challenge.stages.length;
    const { data, error } = await supabase
      .from('build_enrollments')
      .upsert({
        user_id: userId,
        program_id: challenge.id,
        language,
        current_stage: 1,
        completed_stages: [],
        total_stages: totalStages,
        progress_percentage: 0,
        repo_full_name: repo.repo_name,
        repo_url: repo.html_url,
        webhook_secret: repo.webhook_secret,
        status: 'in_progress',
      }, { onConflict: 'user_id,program_id,language' })
      .select()
      .single();
    if (error) throw error;

    return {
      enrollment: data,
      repository: repo,
      clone_command: `git clone ${repo.clone_url}`,
    };
  }

  static async getEnrollmentByRepo(repoFullName: string) {
    const { data } = await supabase
      .from('build_enrollments')
      .select('*, apprenticeship_programs!inner(id, slug, title, program_type)')
      .eq('repo_full_name', repoFullName)
      .maybeSingle();
    return data;
  }

  static async resolveCurrentStage(enrollmentId: string) {
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('build_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();
    if (enrollmentError || !enrollment) return null;

    const { data: stage } = await supabase
      .from('build_stages')
      .select('*')
      .eq('program_id', enrollment.program_id)
      .eq('stage_number', enrollment.current_stage)
      .eq('is_active', true)
      .single();

    const { data: languageConfig } = await supabase
      .from('build_challenge_languages')
      .select('*')
      .eq('program_id', enrollment.program_id)
      .eq('language', enrollment.language)
      .maybeSingle();

    return { enrollment, stage, languageConfig };
  }

  static async runStageVerification(params: {
    repoFullName: string;
    commitHash: string;
    stageId: string;
    testCommand: string;
    dockerImage: string;
    expectedExitCode: number;
    timeoutMs: number;
    successCriteria: Record<string, unknown>;
    hints: string[];
    githubToken?: string;
  }) {
    const workdir = path.join('/tmp/verify-build', `${params.stageId}-${Date.now()}`);
    await fs.mkdir(workdir, { recursive: true });
    const startedAt = Date.now();
    const containerName = `bh-verify-${params.stageId}-${Date.now()}`;
    const tail = (s: string, maxLines = 100) => {
      const trimmed = s.trim();
      const lines = trimmed.split('\n');
      if (lines.length <= maxLines) return trimmed;
      return lines.slice(-maxLines).join('\n');
    };

    try {
      const token = params.githubToken || process.env.GITHUB_BOT_TOKEN || '';
      const authPrefix = token ? `${token}@` : '';
      await runProcess('git', ['clone', '--depth=1', `https://${authPrefix}github.com/${params.repoFullName}`, workdir], 180_000);
      await runProcess('git', ['-C', workdir, 'fetch', '--depth=1', 'origin', params.commitHash], 120_000);
      await runProcess('git', ['-C', workdir, 'checkout', params.commitHash], 60_000);

      const command = params.testCommand || 'echo "No test configured"';
      const dockerResult = await runDockerInWorkspace({
        dockerImage: params.dockerImage,
        workdir,
        shellCommand: command,
        timeoutMs: params.timeoutMs,
        containerName,
      });

      const combinedOutput = tail(`${dockerResult.stdout}\n${dockerResult.stderr}`);
      const exitMatches = dockerResult.exitCode === params.expectedExitCode;
      let criteriaOk = true;
      let criteriaMessage: string | undefined;

      const crit = params.successCriteria || {};
      const mustContain = typeof crit.output_contains === 'string' ? crit.output_contains : null;
      if (mustContain && !combinedOutput.includes(mustContain)) {
        criteriaOk = false;
        criteriaMessage = `Output must contain: ${mustContain}`;
      }
      const mustMatch = typeof crit.output_regex === 'string' ? crit.output_regex : null;
      if (mustMatch) {
        try {
          const re = new RegExp(mustMatch);
          if (!re.test(combinedOutput)) {
            criteriaOk = false;
            criteriaMessage = criteriaMessage || `Output must match regex: ${mustMatch}`;
          }
        } catch {
          criteriaOk = false;
          criteriaMessage = criteriaMessage || 'Invalid output_regex in success_criteria';
        }
      }

      const passed = exitMatches && criteriaOk;
      const nextHintOnFail = typeof crit.next_hint_on_fail === 'string' ? crit.next_hint_on_fail : undefined;
      const structuredFeedback: Record<string, unknown> = {
        verdict: passed ? 'passed' : 'failed',
        exit_code: dockerResult.exitCode,
        expected_exit_code: params.expectedExitCode,
        exit_code_match: exitMatches,
        criteria_ok: criteriaOk,
        criteria_message: criteriaMessage || null,
        duration_ms: Date.now() - startedAt,
        logs_tail: combinedOutput,
        suggested_hint: passed ? null : (nextHintOnFail || params.hints[0] || null),
      };

      return {
        status: passed ? ('passed' as const) : ('failed' as const),
        output: combinedOutput,
        exitCode: dockerResult.exitCode,
        executionTimeMs: Date.now() - startedAt,
        structuredFeedback,
      };
    } catch (error: any) {
      logger.error('Error:', error);
      const msg = String(error?.message || 'Stage verification failed');
      const structuredFeedback: Record<string, unknown> = {
        verdict: 'failed',
        error: msg,
        duration_ms: Date.now() - startedAt,
        logs_tail: tail(msg),
        suggested_hint: params.hints[0] || null,
      };
      return {
        status: 'failed' as const,
        output: tail(msg),
        exitCode: 1,
        executionTimeMs: Date.now() - startedAt,
        structuredFeedback,
      };
    } finally {
      await fs.rm(workdir, { recursive: true, force: true });
    }
  }

  static async completeStage(params: {
    enrollmentId: string;
    stageId: string;
    userId: string;
    commitHash: string;
    status: 'passed' | 'failed';
    output: string;
    exitCode: number;
    executionTimeMs: number;
    structuredFeedback: Record<string, unknown>;
  }) {
    const { count } = await supabase
      .from('build_stage_results')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', params.enrollmentId)
      .eq('stage_id', params.stageId);
    const attemptNumber = (count || 0) + 1;

    await supabase
      .from('build_stage_results')
      .insert({
        enrollment_id: params.enrollmentId,
        stage_id: params.stageId,
        user_id: params.userId,
        commit_hash: params.commitHash,
        status: params.status,
        test_output: params.output,
        exit_code: params.exitCode,
        execution_time_ms: params.executionTimeMs,
        attempt_number: attemptNumber,
        structured_feedback: params.structuredFeedback,
        completed_at: new Date().toISOString(),
      });

    if (params.status !== 'passed') {
      await supabase
        .from('build_enrollments')
        .update({ last_push_at: new Date().toISOString() })
        .eq('id', params.enrollmentId);
      return;
    }

    const { data: enrollment } = await supabase
      .from('build_enrollments')
      .select('*')
      .eq('id', params.enrollmentId)
      .single();
    if (!enrollment) return;

    const completed = Array.from(new Set([...(enrollment.completed_stages || []), enrollment.current_stage]));
    const nextStage = enrollment.current_stage + 1;
    const finished = nextStage > enrollment.total_stages;

    const progressPct =
      enrollment.total_stages > 0 ? Math.round((completed.length / enrollment.total_stages) * 10000) / 100 : 0;

    await supabase
      .from('build_enrollments')
      .update({
        completed_stages: completed,
        current_stage: finished ? enrollment.current_stage : nextStage,
        progress_percentage: progressPct,
        status: finished ? 'completed' : 'in_progress',
        completed_at: finished ? new Date().toISOString() : null,
        last_push_at: new Date().toISOString(),
      })
      .eq('id', enrollment.id);
  }

  static async getLeaderboard(programId: string, language?: string) {
    let query = supabase
      .from('build_enrollments')
      .select('user_id, language, completed_stages, progress_percentage, current_stage, status, updated_at')
      .eq('program_id', programId)
      .order('progress_percentage', { ascending: false })
      .limit(50);

    if (language) {
      query = query.eq('language', language);
    }

    const { data, error } = await query;
    if (error) throw error;

    const enrollments = data || [];
    const userIds = [...new Set(enrollments.map((row: { user_id: string }) => row.user_id))];

    const userMap = new Map<string, { full_name?: string; email?: string }>();
    const githubMap = new Map<string, string>();

    if (userIds.length > 0) {
      const [{ data: users }, { data: connections }] = await Promise.all([
        supabase.from('users').select('id, full_name, email').in('id', userIds),
        supabase
          .from('apprenticeship_github_connections')
          .select('user_id, github_username')
          .in('user_id', userIds)
          .eq('is_active', true),
      ]);

      (users || []).forEach((u: { id: string; full_name?: string; email?: string }) => {
        userMap.set(u.id, u);
      });
      (connections || []).forEach((c: { user_id: string; github_username: string }) => {
        githubMap.set(c.user_id, c.github_username);
      });
    }

    const rows = enrollments.map((row: any, index: number) => {
      const user = userMap.get(row.user_id);
      const githubUsername = githubMap.get(row.user_id);
      const display_name =
        user?.full_name?.trim() ||
        githubUsername ||
        (user?.email ? user.email.split('@')[0] : null) ||
        `Builder ${String(row.user_id).slice(0, 6)}`;

      return {
        rank: index + 1,
        user_id: row.user_id,
        display_name,
        github_username: githubUsername || null,
        language: row.language,
        progress_percentage: row.progress_percentage,
        stages_completed: Array.isArray(row.completed_stages) ? row.completed_stages.length : 0,
        current_stage: row.current_stage,
        status: row.status,
        updated_at: row.updated_at,
      };
    });

    return rows;
  }

  static async celebrateStage(userId: string, slug: string, stageNumber: number) {
    const challenge = await this.getChallengeBySlug(slug);
    if (!challenge) throw new Error('Challenge not found');

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('build_enrollments')
      .select('*')
      .eq('user_id', userId)
      .eq('program_id', challenge.id)
      .maybeSingle();

    if (enrollmentError) throw enrollmentError;
    if (!enrollment) throw new Error('Enrollment not found');

    const celebratedStages: number[] = enrollment.celebrated_stages || [];
    if (celebratedStages.includes(stageNumber)) {
      return enrollment;
    }

    const updatedCelebrated = [...celebratedStages, stageNumber];
    const { data, error } = await supabase
      .from('build_enrollments')
      .update({ celebrated_stages: updatedCelebrated })
      .eq('id', enrollment.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async adminListEnrollments(programId: string, filters?: { language?: string; status?: string; search?: string }) {
    let query = supabase
      .from('build_enrollments')
      .select('*', { count: 'exact' })
      .eq('program_id', programId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (filters?.language) query = query.eq('language', filters.language);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data: enrollments, error, count } = await query;
    if (error) throw error;

    const enrollmentList = enrollments || [];
    if (enrollmentList.length === 0) {
      return { enrollments: [], total: 0 };
    }

    // Fetch user info
    const userIds = [...new Set(enrollmentList.map((e: any) => e.user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds);

    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    // Apply search filter on user name (post-query since users is a separate table)
    let enrichedEnrollments = enrollmentList.map((e: any) => ({
      ...e,
      user: userMap.get(e.user_id) || null,
    }));

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      enrichedEnrollments = enrichedEnrollments.filter((e: any) =>
        e.user?.full_name?.toLowerCase().includes(searchLower) ||
        e.user?.email?.toLowerCase().includes(searchLower)
      );
    }

    // Fetch stage results for each enrollment
    const enrollmentIds = enrollmentList.map((e: any) => e.id);
    const { data: stageResults } = await supabase
      .from('build_stage_results')
      .select('*, build_stages!inner(stage_number, title)')
      .in('enrollment_id', enrollmentIds)
      .order('created_at', { ascending: false });

    const resultsByEnrollment = new Map<string, any[]>();
    for (const r of (stageResults || []) as any[]) {
      const list = resultsByEnrollment.get(r.enrollment_id) || [];
      list.push(r);
      resultsByEnrollment.set(r.enrollment_id, list);
    }

    enrichedEnrollments = enrichedEnrollments.map((e: any) => ({
      ...e,
      stage_results: resultsByEnrollment.get(e.id) || [],
    }));

    return { enrollments: enrichedEnrollments, total: count || enrichedEnrollments.length };
  }

  static async adminManualPassStage(enrollmentId: string, stageId: string, adminUserId: string) {
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('build_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) throw new Error('Enrollment not found');

    let stage;
    if (stageId === 'current') {
      const { data: currentStage, error: stageError } = await supabase
        .from('build_stages')
        .select('*')
        .eq('program_id', enrollment.program_id)
        .eq('stage_number', enrollment.current_stage)
        .single();
      if (stageError || !currentStage) throw new Error('Stage not found');
      stage = currentStage;
    } else {
      const { data: specificStage, error: stageError } = await supabase
        .from('build_stages')
        .select('*')
        .eq('id', stageId)
        .single();
      if (stageError || !specificStage) throw new Error('Stage not found');
      stage = specificStage;
    }

    // Insert a passed result with manual override
    await supabase
      .from('build_stage_results')
      .insert({
        enrollment_id: enrollmentId,
        stage_id: stage.id,
        user_id: enrollment.user_id,
        commit_hash: 'manual_override',
        status: 'passed',
        test_output: 'Manually passed by admin',
        exit_code: 0,
        execution_time_ms: 0,
        attempt_number: 1,
        structured_feedback: { verdict: 'passed', manual_override: true },
        is_manual_override: true,
        overridden_by_admin_id: adminUserId,
        completed_at: new Date().toISOString(),
      });

    // Update enrollment progress
    const completed = Array.from(new Set([...(enrollment.completed_stages || []), stage.stage_number]));
    const nextStage = Math.max(enrollment.current_stage, stage.stage_number) + 1;
    const finished = nextStage > enrollment.total_stages;

    const progressPct =
      enrollment.total_stages > 0 ? Math.round((completed.length / enrollment.total_stages) * 10000) / 100 : 0;

    const { error: updateError } = await supabase
      .from('build_enrollments')
      .update({
        completed_stages: completed,
        current_stage: finished ? enrollment.current_stage : nextStage,
        progress_percentage: progressPct,
        status: finished ? 'completed' : 'in_progress',
        completed_at: finished ? new Date().toISOString() : null,
      })
      .eq('id', enrollmentId);

    if (updateError) throw updateError;
  }

  private static async syncStageCount(programId: string) {
    const { count } = await supabase
      .from('build_stages')
      .select('id', { head: true, count: 'exact' })
      .eq('program_id', programId)
      .eq('is_active', true);

    await supabase
      .from('apprenticeship_programs')
      .update({ total_projects: count || 0 })
      .eq('id', programId);
  }

  // ---- Phase 2: Admin archive (soft-delete) ----

  static async archiveChallenge(id: string) {
    const { data, error } = await supabase
      .from('apprenticeship_programs')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('program_type', 'build_challenge')
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ---- Phase 2: Admin analytics ----

  static async getAnalytics(programId: string) {
    const { data: enrollments } = await supabase
      .from('build_enrollments')
      .select('id, user_id, language, current_stage, completed_stages, progress_percentage, status, started_at, completed_at, last_push_at')
      .eq('program_id', programId);

    const enrollmentList = enrollments || [];
    if (enrollmentList.length === 0) {
      return {
        enrollments: [],
        stageStats: [],
        summary: { total: 0, active: 0, activeThisWeek: 0, completed: 0, completionRate: 0, avgProgress: 0 },
      };
    }

    const enrollmentIds = enrollmentList.map((e: any) => e.id);
    const { data: results } = await supabase
      .from('build_stage_results')
      .select('id, enrollment_id, stage_id, status, execution_time_ms, created_at, build_stages!inner(stage_number, title)')
      .in('enrollment_id', enrollmentIds);

    const resultList = results || [];

    // Per-stage stats
    const stageMap = new Map<string, { stage_number: number; title: string; attempts: number; passed: number; totalTimeMs: number }>();
    for (const r of resultList as any[]) {
      const key = r.stage_id;
      if (!stageMap.has(key)) {
        stageMap.set(key, {
          stage_number: r.build_stages.stage_number,
          title: r.build_stages.title,
          attempts: 0,
          passed: 0,
          totalTimeMs: 0,
        });
      }
      const entry = stageMap.get(key)!;
      entry.attempts += 1;
      if (r.status === 'passed') entry.passed += 1;
      entry.totalTimeMs += r.execution_time_ms || 0;
    }

    const stageStats = Array.from(stageMap.values())
      .sort((a, b) => a.stage_number - b.stage_number)
      .map((s) => ({
        ...s,
        pass_rate: s.attempts > 0 ? Math.round((s.passed / s.attempts) * 100) : 0,
        avg_time_ms: s.attempts > 0 ? Math.round(s.totalTimeMs / s.attempts) : 0,
      }));

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const activeThisWeek = enrollmentList.filter((e: any) =>
      e.last_push_at && new Date(e.last_push_at) > weekAgo
    ).length;
    const completed = enrollmentList.filter((e: any) => e.status === 'completed').length;
    const avgProgress = enrollmentList.length > 0
      ? Math.round(enrollmentList.reduce((sum: number, e: any) => sum + (Number(e.progress_percentage) || 0), 0) / enrollmentList.length)
      : 0;

    return {
      enrollments: enrollmentList,
      stageStats,
      summary: {
        total: enrollmentList.length,
        active: enrollmentList.filter((e: any) => e.status === 'in_progress').length,
        activeThisWeek,
        completed,
        completionRate: enrollmentList.length > 0 ? Math.round((completed / enrollmentList.length) * 100) : 0,
        avgProgress,
      },
    };
  }

  // ---- Phase 2: Rate limit check ----

  static async checkRateLimit(enrollmentId: string, maxPerHour = 20): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('build_stage_results')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .gte('created_at', oneHourAgo);
    return (count || 0) < maxPerHour;
  }
}

async function runDockerInWorkspace(params: {
  dockerImage: string;
  workdir: string;
  shellCommand: string;
  timeoutMs: number;
  containerName: string;
}) {
  return await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn('docker', [
      'run',
      '--rm',
      '--name',
      params.containerName,
      '--network',
      'none',
      '--memory',
      '512m',
      '--cpus',
      '0.5',
      '-v',
      `${params.workdir}:/workspace:ro`,
      '-w',
      '/workspace',
      params.dockerImage,
      'sh',
      '-lc',
      params.shellCommand,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      try {
        execSync(`docker kill ${params.containerName} >/dev/null 2>&1`);
      } catch (err: any) {
      logger.error('Error:', err);
        // ignore
      }
      stderr += '\n[runner] docker timeout';
      resolve({ exitCode: 124, stdout, stderr });
    }, params.timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      stderr += `\n${error.message}`;
      resolve({ exitCode: 1, stdout, stderr });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

async function runProcess(command: string, args: string[], timeoutMs = 60_000) {
  return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} timed out`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        logger.warn('Process failed', { command, args, code, stderr });
        reject(new Error(stderr || `${command} failed`));
      }
    });
  });
}
